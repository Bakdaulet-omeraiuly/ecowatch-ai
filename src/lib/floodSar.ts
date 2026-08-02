// Sentinel-1 SAR арқылы су бетін анықтау — Copernicus Data Space
// Statistical API.
//
// ӘДІС (жаңа модель емес, стандартты операциялық тәсіл):
// Радар сәулесі тегіс су бетінен айнадай шағылысып, спутникке қайтпайды.
// Сондықтан су VV поляризациясында өте КҮҢГІРТ көрінеді. Табалдырықтан
// (−16 дБ) төмен пиксельдер су деп саналады. Бұл — Copernicus Emergency
// Management Service қолданатын классикалық тәсілдің оңайлатылған нұсқасы.
//
// НЕГЕ SAR: бұлт пен түнді елемейді. Тасқын әдетте бұлтты ауа райымен
// қатар жүреді — оптикалық спутник дәл сол кезде көрмей қалады.
//
// НЕГЕ АЙЫРМА (Δ) ЕСЕПТЕЛЕДІ: құрғақ сор, тегіс тақыр, асфальт та радарда
// күңгірт көрінеді — бұл жалған оң нәтиже береді. Сондықтан ағымдағы су
// ауданынан ТІРЕК КЕЗЕҢДЕГІ (күзгі төмен су) су ауданы алынады. Тұрақты
// күңгірт беттер екеуінде де бар болғандықтан өзара жойылады, ал қалғаны —
// шынымен жаңа су.

import { SH_STATS_URL } from "./cdse";

export const THRESHOLD_DB = -16; // VV gamma0, ашық су үшін операциялық шама
export const RES_M = 120; // EPSG:3857 бірлігі (метр) — есептеу қадамы
export const MIN_COVERAGE = 0.6; // жарамды пиксель үлесі осыдан төмен болса — қабылданбайды

const EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "dataMask"] }],
    output: [
      { id: "water", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}
function evaluatePixel(s) {
  if (s.dataMask === 0 || s.VV <= 0) return { water: [0], dataMask: [0] };
  var db = 10 * Math.log(s.VV) / Math.LN10;
  return { water: [db < ${THRESHOLD_DB} ? 1 : 0], dataMask: [1] };
}`;

/** WGS84 → EPSG:3857 */
function toMercator(lng: number, lat: number): [number, number] {
  const x = (lng * 20037508.342789244) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.342789244 / 180);
  return [x, y];
}

/**
 * EPSG:3857 бірлігі экваторда ғана нақты метр. φ ендігінде бір бірлік
 * cos(φ) метрді ғана құрайды. Сондықтан пиксельдің НАҚТЫ жер ауданы:
 * (RES_M · cos φ)². Бұл түзетусіз аудан 47°-та ~2.1 есе асып кетер еді.
 */
export function pixelAreaKm2(midLat: number): number {
  const ground = RES_M * Math.cos((midLat * Math.PI) / 180);
  return (ground * ground) / 1_000_000;
}

export interface DayStat {
  date: string;
  waterFraction: number;
  validPixels: number;
  totalPixels: number;
  coverage: number;
}

interface StatsResponse {
  data?: {
    interval?: { from?: string };
    outputs?: {
      water?: { bands?: { B0?: { stats?: { mean?: number; sampleCount?: number; noDataCount?: number } } } };
    };
  }[];
  status?: string;
}

/** Бір аймақ, бір уақыт аралығы бойынша күндік су үлестерін қайтарады. */
export async function fetchDailyWater(
  token: string,
  bbox: [number, number, number, number],
  from: string,
  to: string,
  signal?: AbortSignal
): Promise<DayStat[]> {
  const [w, s, e, n] = bbox;
  const [minX, minY] = toMercator(w, s);
  const [maxX, maxY] = toMercator(e, n);

  const body = {
    input: {
      bounds: {
        bbox: [minX, minY, maxX, maxY],
        properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" },
      },
      data: [
        {
          type: "sentinel-1-grd",
          dataFilter: { acquisitionMode: "IW", polarization: "DV", resolution: "HIGH" },
          processing: { orthorectify: true, backCoeff: "GAMMA0_TERRAIN" },
        },
      ],
    },
    aggregation: {
      timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
      aggregationInterval: { of: "P1D" },
      evalscript: EVALSCRIPT,
      resx: RES_M,
      resy: RES_M,
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
    throw new Error(`Statistical API ${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = (await res.json()) as StatsResponse;

  const out: DayStat[] = [];
  for (const d of json.data ?? []) {
    const st = d.outputs?.water?.bands?.B0?.stats;
    const date = d.interval?.from?.slice(0, 10);
    if (!st || !date || st.mean == null || !st.sampleCount) continue;
    const total = st.sampleCount;
    const valid = total - (st.noDataCount ?? 0);
    if (valid <= 0) continue;
    out.push({
      date,
      waterFraction: st.mean,
      validPixels: valid,
      totalPixels: total,
      coverage: valid / total,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Медиана — бір күндік шуға төзімді (орташадан сенімдірек). */
export function median(vals: number[]): number {
  if (!vals.length) return 0;
  const a = [...vals].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Тірек кезең: өткен күздің төмен су маусымы (Жайықтың ең аз ағыны). */
export function baselineWindow(now: Date): { from: string; to: string; label: string } {
  const y = now.getUTCFullYear();
  // Қараша басталмаса, өткен жылдың күзін аламыз
  const year = now.getUTCMonth() >= 10 ? y : y - 1;
  return {
    from: `${year}-09-15`,
    to: `${year}-10-31`,
    label: `${year} ж. 15 қыркүйек – 31 қазан (төмен су кезеңі)`,
  };
}

// ── ГИДРОПЕРИОД ──────────────────────────────────────────────────────────
//
// «Су неше күн тұрды» — JAIYQ-MRI моделінің L2 қабатындағы негізгі шарт:
// дернәсіл ересекке жету үшін көлшік ЖЕТКІЛІКТІ ҰЗАҚ тұруы керек. Су басып,
// үш күнде кеуіп кетсе — маса шықпайды.
//
// ⚠️ ДӘЛДІК ШЕГІ: Sentinel-1 қайталау кезеңі ~6 күн. Сондықтан бұл сан
// «дәл N күн» емес, «КЕМІНДЕ N күн» дегенді білдіреді. Екі өту арасында
// су кеуіп, қайта басуы мүмкін — радар оны көрмейді. Осы себепті
// нәтижеде `atLeast: true` белгісі беріледі.
//
// Әдісі: соңғы өтуден артқа қарай, су тірек деңгейінен жоғары болған
// ҚАТАРЛАС өтулерді санаймыз. Аралық — сол өтулердің күндері арасы.

/** Тірек деңгейінен қанша артық болса «су басқан» деп саналады (үлес) */
export const HYDRO_EXCESS = 0.02;

export interface Hydroperiod {
  /** Кемінде осынша күн су тұрды */
  days: number;
  /** Есептеуге негіз болған өтулер саны */
  passes: number;
  firstDate: string;
  lastDate: string;
  /** Әрқашан true — SAR қайталау кезеңі себепті бұл төменгі шек */
  atLeast: true;
}

/**
 * Тірек деңгейімен салыстырып, судың қанша күн тұрғанын бағалау.
 * @param days   ағымдағы терезенің тәуліктік статистикасы (күні бойынша реттелген)
 * @param baselineFraction тірек кезеңдегі медиана су үлесі
 */
export function hydroperiod(
  days: DayStat[],
  baselineFraction: number
): Hydroperiod | null {
  const usable = days
    .filter((d) => d.coverage >= MIN_COVERAGE)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;

  const wet = (d: DayStat) => d.waterFraction > baselineFraction + HYDRO_EXCESS;

  // Соңғы өту су басқан күйде болмаса — қазір су тұрған жоқ
  const last = usable[usable.length - 1];
  if (!wet(last)) return null;

  // Артқа қарай қатарлас «су басқан» өтулерді жинаймыз
  let i = usable.length - 1;
  while (i - 1 >= 0 && wet(usable[i - 1])) i--;
  const first = usable[i];

  const ms = new Date(last.date).getTime() - new Date(first.date).getTime();
  return {
    days: Math.max(1, Math.round(ms / 86400_000)),
    passes: usable.length - i,
    firstDate: first.date,
    lastDate: last.date,
    atLeast: true,
  };
}
