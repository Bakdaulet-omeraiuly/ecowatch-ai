// Аймақ есебі — сызылған/жүктелген полигон бойынша НАҚТЫ көрсеткіштер (тек сервер).
//
//  · ndvi — Sentinel-2 L2A, SCL бұлт/көлеңке/қар маскасы, КҮНДЕЛІКТІ өтулер →
//    айлық медиана. 🛰 өлшем (спутник индексі, жердегі шындық емес).
//  · no2  — Sentinel-5P TROPOMI тропосфералық NO₂ бағаны, qa ≥ 0.75, күнделікті →
//    айлық орташа. 🛰 өлшем (баған, жер бетіндегі концентрация ЕМЕС).
//  · fires — NASA FIRMS VIIRS жылу аномалиялары полигон ішінде, айлық, алау/расталмаған.
//  · overlay — OSM жер пайдалану/жасыл аймақ + Ақжайық резерваты, тор-сынама әдісі.
//
// Неге күнделікті интервал: Statistical API айлық интервалда бір мозаика (ең соңғы
// өту) береді, орташа емес. Сондықтан P1D сұралып, ай ішінде өзіміз жинаймыз.
// Жоқ мән — null, ешқашан 0 емес. Көз қолжетімсіз — қате көтереді (route → 503).

import { SH_STATS_URL } from "./cdse";
import { MIN_COVERAGE } from "./floodSar";
import { toMercator } from "./reedHabitat";
import { loadFireArchive } from "./firmsArchive";
import { classifyAnomaly } from "./fireClassify";
import { ringBbox, sampleRing, pointInRing, type Ring } from "./areaGeo";
import landuseSnap from "../../public/data/layers/landuse-atyrau.json";
import greenerySnap from "../../public/data/layers/greenery-atyrau.json";
import reserve from "@/data/protected/akzhaiyk.json";

export const AREA_METRICS = ["ndvi", "no2", "fires", "overlay"] as const;
export type AreaMetric = typeof AREA_METRICS[number];

export interface MonthRow {
  month: string; // YYYY-MM
  value: number | null;
  /** жарамды өту/күн саны */
  n: number;
  /** жарамды пиксель үлесінің медианасы */
  coverage: number | null;
}

const month = (d: string) => d.slice(0, 7);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split("-").map(Number);
  const [ty, tm] = to.slice(0, 7).split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return out;
}

function mercatorGeometry(ring: Ring) {
  const r = ring.map(([x, y]) => toMercator(x, y));
  return { type: "Polygon", coordinates: [[...r, r[0]]] };
}

function maxSideM(ring: Ring): number {
  const [w, s, e, n] = ringBbox(ring);
  const [x1, y1] = toMercator(w, s), [x2, y2] = toMercator(e, n);
  return Math.max(x2 - x1, y2 - y1);
}

interface BandStats { mean?: number; sampleCount?: number; noDataCount?: number }
interface StatsJson { data?: { interval?: { from?: string }; outputs?: Record<string, { bands?: { B0?: { stats?: BandStats } } }> }[] }

export interface DailyStat { date: string; value: number; coverage: number }

/** Statistical API P1D жауабы → жарамды күндер (таза, тестіленеді) */
export function parseDaily(json: StatsJson, output: string, minCoverage: number): DailyStat[] {
  const out: DailyStat[] = [];
  for (const d of json.data ?? []) {
    const date = d.interval?.from?.slice(0, 10);
    const st = d.outputs?.[output]?.bands?.B0?.stats;
    if (!date || !st || !Number.isFinite(st.mean) || !st.sampleCount) continue;
    const coverage = (st.sampleCount - (st.noDataCount ?? 0)) / st.sampleCount;
    if (coverage < minCoverage) continue;
    out.push({ date, value: st.mean!, coverage });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Күндер → айлар; жоқ ай — value null, n 0 */
export function toMonthly(days: DailyStat[], months: string[], agg: "median" | "mean"): MonthRow[] {
  return months.map((m) => {
    const ds = days.filter((d) => month(d.date) === m);
    if (!ds.length) return { month: m, value: null, n: 0, coverage: null };
    const vals = ds.map((d) => d.value);
    const value = agg === "median" ? median(vals) : vals.reduce((a, b) => a + b, 0) / vals.length;
    return { month: m, value, n: ds.length, coverage: median(ds.map((d) => d.coverage)) };
  });
}

async function statsRequest(token: string, body: unknown, signal?: AbortSignal): Promise<StatsJson> {
  const res = await fetch(SH_STATS_URL, {
    method: "POST", cache: "no-store", signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Statistical API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json() as StatsJson;
  if (!Array.isArray(j.data)) throw new Error("Statistical API жауабы жарамсыз");
  return j;
}

/** Кезеңді бөліктерге бөледі (бір сұраныстың уақыты қысқа болу үшін): ndvi — жыл, no2 — ай */
export function timeChunks(from: string, to: string, stepMonths: number): [string, string][] {
  const out: [string, string][] = [];
  let cur = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T23:59:59Z`);
  while (cur <= end) {
    const next = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + stepMonths, 1));
    const stop = next > end ? end : new Date(next.getTime() - 1000);
    out.push([cur.toISOString().slice(0, 19) + "Z", stop.toISOString().slice(0, 19) + "Z"]);
    cur = next;
  }
  return out;
}

async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const NDVI_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){var bad=s.SCL===0||s.SCL===1||s.SCL===3||s.SCL===8||s.SCL===9||s.SCL===10||s.SCL===11;var den=s.B08+s.B04;
if(!s.dataMask||bad||den<=0)return{ndvi:[0],dataMask:[0]};return{ndvi:[(s.B08-s.B04)/den],dataMask:[1]};}`;

const NO2_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["NO2","dataMask"]}],output:[{id:"no2",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){return{no2:[s.NO2],dataMask:[s.dataMask]};}`;

export const NDVI_RES = (ring: Ring) => Math.max(10, Math.ceil(maxSideM(ring) / 2000));
export const NO2_RES = (ring: Ring) => Math.min(2000, Math.max(500, Math.ceil(maxSideM(ring) / 10)));
/** S5P пикселінің бір бөлігін жамылғы деп санау шегі — бұлт/qa сүзгісінен кейін */
export const NO2_MIN_COVERAGE = 0.5;

async function dailySeries(token: string, ring: Ring, from: string, to: string, kind: "ndvi" | "no2", signal?: AbortSignal) {
  const res = kind === "ndvi" ? NDVI_RES(ring) : NO2_RES(ring);
  const data = kind === "ndvi"
    ? [{ type: "sentinel-2-l2a" }]
    : [{ type: "sentinel-5p-l2", dataFilter: { minQa: 75 } }];
  const parts = timeChunks(from, to, kind === "ndvi" ? 6 : 1);
  const chunks = await pool(parts, kind === "ndvi" ? 4 : 12, ([f, t]) => statsRequest(token, {
    input: { bounds: { geometry: mercatorGeometry(ring), properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" } }, data },
    aggregation: { timeRange: { from: f, to: t }, aggregationInterval: { of: "P1D" }, evalscript: kind === "ndvi" ? NDVI_EVAL : NO2_EVAL, resx: res, resy: res },
  }, signal));
  const days = chunks.flatMap((j) => parseDaily(j, kind, kind === "ndvi" ? MIN_COVERAGE : NO2_MIN_COVERAGE));
  return { days, resolutionM: res };
}

export async function ndviMonthly(token: string, ring: Ring, from: string, to: string, signal?: AbortSignal) {
  const { days, resolutionM } = await dailySeries(token, ring, from, to, "ndvi", signal);
  return { rows: toMonthly(days, monthsBetween(from, to), "median"), days, resolutionM };
}

/** mol/m² → µmol/m² */
export async function no2Monthly(token: string, ring: Ring, from: string, to: string, signal?: AbortSignal) {
  const { days, resolutionM } = await dailySeries(token, ring, from, to, "no2", signal);
  const scaled = days.map((d) => ({ ...d, value: d.value * 1e6 }));
  return { rows: toMonthly(scaled, monthsBetween(from, to), "mean"), days: scaled, resolutionM };
}

export interface FireRow { month: string; flare: number; unconfirmed: number }

export function firesByMonth<D extends { lat: number; lng: number; acqDate: string }>(dets: D[], ring: Ring, months: string[]) {
  const inside = dets.filter((d) => pointInRing(d.lng, d.lat, ring));
  const rows: FireRow[] = months.map((m) => ({ month: m, flare: 0, unconfirmed: 0 }));
  const idx = new Map(rows.map((r) => [r.month, r]));
  const points = inside.map((d) => {
    const c = classifyAnomaly(d.lat, d.lng);
    const row = idx.get(month(d.acqDate));
    if (row) row[c.category === "industrial_flare" ? "flare" : "unconfirmed"]++;
    return { ...d, category: c.category, facility: c.facilityName };
  });
  return { rows, points };
}

export async function firesInArea(key: string, ring: Ring, regionId: string, regionBbox: [number, number, number, number]) {
  const archive = await loadFireArchive({ key, regionId, bbox: regionBbox, days: 365 });
  const months = monthsBetween(archive.window.from, archive.window.to);
  return { ...firesByMonth(archive.detections, ring, months), window: archive.window, complete: archive.complete, failedWindows: archive.failedWindows.length };
}

// ── Қабаттасу (OSM + Ақжайық) ─────────────────────────────────────────────
type PolyFeature = { category: string; ring: Ring; bbox: [number, number, number, number] };

function polysFrom(fc: { features: { properties: { category: string }; geometry: { type: string; coordinates: unknown } }[] }, prefix: string): PolyFeature[] {
  return fc.features.filter((f) => f.geometry.type === "Polygon").map((f) => {
    const ring = (f.geometry.coordinates as Ring[])[0];
    return { category: `${prefix}${f.properties.category}`, ring, bbox: ringBbox(ring) };
  });
}

let overlayIndex: PolyFeature[] | null = null;
function overlayPolys(): PolyFeature[] {
  if (overlayIndex) return overlayIndex;
  const lu = polysFrom((landuseSnap as unknown as { features: Parameters<typeof polysFrom>[0] }).features, "landuse:");
  const gr = polysFrom((greenerySnap as unknown as { features: Parameters<typeof polysFrom>[0] }).features, "green:");
  const rs = (reserve.rings as unknown as { ring: Ring }[]).map((r) => ({ category: "nature:akzhaiyk", ring: r.ring, bbox: ringBbox(r.ring) }));
  overlayIndex = [...lu, ...gr, ...rs];
  return overlayIndex;
}

export interface OverlayRow { category: string; areaKm2: number; fraction: number }

export function overlayInArea(ring: Ring, polys: PolyFeature[] = overlayPolys()) {
  const [w, s, e, n] = ringBbox(ring);
  const cand = polys.filter((p) => p.bbox[0] <= e && p.bbox[2] >= w && p.bbox[1] <= n && p.bbox[3] >= s);
  const { points, stepM, cellKm2 } = sampleRing(ring);
  const counts = new Map<string, number>();
  for (const [x, y] of points) {
    const hit = new Set<string>();
    for (const p of cand) {
      if (hit.has(p.category)) continue;
      if (x < p.bbox[0] || x > p.bbox[2] || y < p.bbox[1] || y > p.bbox[3]) continue;
      if (pointInRing(x, y, p.ring)) hit.add(p.category);
    }
    for (const c of hit) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  const total = points.length;
  const rows: OverlayRow[] = [...counts.entries()]
    .map(([category, c]) => ({ category, areaKm2: c * cellKm2, fraction: total ? c / total : 0 }))
    .sort((a, b) => b.areaKm2 - a.areaKm2);
  return { rows, samples: total, stepM: Math.round(stepM), snapshotFetchedAt: (landuseSnap as { fetchedAt?: string }).fetchedAt ?? null };
}
