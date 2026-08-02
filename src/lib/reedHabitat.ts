// ҚАМЫС МЕКЕНІ — Sentinel-2 NDVI арқылы, JAIYQ-MRI моделінің L4 қабаты.
//
// НЕГЕ КЕРЕК:
// Модель құжаты бойынша Culex modestus (Батыс Нил вирусының басты
// тасымалдаушысы) — ТҰРАҚТЫ су масасы, ал оның ең күшті мекен предикторы
// қамыс алқаптары (Phragmites). Кодта бұған дейін оның орнына «қалаға
// жақындық» тұрған: ол дренаж бен подвал суын жуықтайды, бірақ Жайық
// атырауындағы қамыс алқаптарын мүлдем көрсетпейді.
//
// ӘДІС (жаңа модель емес, стандартты тәсіл):
//   NDVI = (NIR − RED) / (NIR + RED) = (B08 − B04) / (B08 + B04)
// Тығыз өсімдік NDVI > 0.4 береді. Шөлейт атырауда сондай тығыздық
// негізінен қамыс пен жайылма шалғынында ғана болады.
//
// ⚠️ БҰЛ — ПРОКСИ, қамыстың картасы ЕМЕС:
//   · Суармалы егіс пен ағаш екпелері де NDVI > 0.4 береді
//   · Қыста қамыс қурап қалады → NDVI төмендейді. Сондықтан мән
//     МАУСЫМДЫҚ: жаз айларындағы ең жоғары мән алынады
//   · Бұлт SCL маскасымен алынып тасталады; бұлтты күндер есепке кірмейді
//
// ⚠️ ӨЛШЕМ БОЛМАСА — НӨЛ ЕМЕС. Спутник өтуі/бұлтсыз күн табылмаса,
// мән `null` болады да, модель бұрынғы проксиге шегінеді.

import { SH_STATS_URL } from "./cdse";
import { MIN_COVERAGE } from "./floodSar";

/** Тығыз өсімдік шегі — осыдан жоғары пиксель «қамыс/шалғын» деп саналады */
export const NDVI_DENSE = 0.4;

/** Есептеу қадамы (м). S2 10 м, бірақ статистика үшін 60 м жеткілікті */
export const REED_RES_M = 60;

// SCL (Scene Classification) маскасы:
//   3 — бұлт көлеңкесі, 8 — орташа ықтимал бұлт, 9 — жоғары ықтимал бұлт,
//   10 — жіңішке бұлт (cirrus), 11 — қар/мұз
const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "reed", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}
function evaluatePixel(s) {
  var bad = s.SCL === 3 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10 || s.SCL === 11;
  if (s.dataMask === 0 || bad) return { reed: [0], dataMask: [0] };
  var den = s.B08 + s.B04;
  if (den <= 0) return { reed: [0], dataMask: [1] };
  var ndvi = (s.B08 - s.B04) / den;
  return { reed: [ndvi > ${NDVI_DENSE} ? 1 : 0], dataMask: [1] };
}`;

function toMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.342789244) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.342789244 / 180);
  return [x, y];
}

export interface ReedStat {
  date: string;
  /** Тығыз өсімдік басқан пиксель үлесі (0..1) */
  denseFraction: number;
  coverage: number;
}

interface StatsResponse {
  data?: {
    interval?: { from?: string };
    outputs?: {
      reed?: { bands?: { B0?: { stats?: { mean?: number; sampleCount?: number; noDataCount?: number } } } };
    };
  }[];
}

/** Бір аймақ бойынша тығыз өсімдік үлесінің күндік қатары */
export async function fetchReed(
  token: string,
  bbox: [number, number, number, number],
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<ReedStat[]> {
  const [w, s, e, n] = bbox;
  const [minX, minY] = toMercator(w, s);
  const [maxX, maxY] = toMercator(e, n);

  const body = {
    input: {
      bounds: {
        bbox: [minX, minY, maxX, maxY],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" },
      },
      data: [{ type: "sentinel-2-l2a" }],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      // Апталық: бұлтты күндерді біріктіріп, сұраныс көлемін азайтады
      aggregationInterval: { of: "P7D" },
      evalscript: EVALSCRIPT,
      resx: REED_RES_M,
      resy: REED_RES_M,
    },
  };

  const res = await fetch(SH_STATS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Statistical API (S2) ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as StatsResponse;

  const out: ReedStat[] = [];
  for (const d of json.data ?? []) {
    const st = d.outputs?.reed?.bands?.B0?.stats;
    const date = d.interval?.from?.slice(0, 10);
    if (!st || !date || st.mean == null || !st.sampleCount) continue;
    const total = st.sampleCount;
    const valid = total - (st.noDataCount ?? 0);
    if (valid <= 0) continue;
    out.push({ date, denseFraction: st.mean, coverage: valid / total });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/**
 * Терезедегі мекен ауданының бағасы.
 *
 * Ең ЖОҒАРЫ мән алынады, орташа емес: бұлт пен ішінара қамту мәнді
 * жасанды түрде төмендетеді, ал бізге қамыс алқабының МАКСИМАЛДЫ жайылымы
 * керек. Қамтуы жеткіліксіз күндер мүлдем есепке алынбайды.
 */
export function reedExtent(stats: ReedStat[]): { fraction: number; date: string; dates: number } | null {
  const usable = stats.filter((s) => s.coverage >= MIN_COVERAGE);
  if (!usable.length) return null;
  const best = usable.reduce((a, b) => (b.denseFraction > a.denseFraction ? b : a));
  return {
    fraction: +best.denseFraction.toFixed(4),
    date: best.date,
    dates: usable.length,
  };
}

/**
 * Мекен үлесін 0..1 «қолайлылық» шамасына келтіру.
 *
 * Аймақ ауданының 30%-ы тығыз өсімдік болса — Culex үшін мекен толық
 * қаныққан деп саналады (одан әрі көбейгені масаны арттыра бермейді:
 * шектеуші фактор су мен температураға ауысады).
 */
export const REED_SATURATION = 0.3;

export function reedSuitability(fraction: number): number {
  return Math.max(0, Math.min(1, fraction / REED_SATURATION));
}
