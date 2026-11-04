import { CHANGE_PP, VEG_NDVI, type GreenBbox } from "@/data/greenery";
import { SH_STATS_URL } from "./cdse";
import { MIN_COVERAGE } from "./floodSar";
import { NDVI_DENSE, REED_RES_M, toMercator } from "./reedHabitat";

export function summerSeasons(now: Date) {
  const recentYear = now.getUTCFullYear() - (now.getUTCMonth() < 8 ? 1 : 0);
  const season = (year: number) => ({ year, from: `${year}-06-01`, to: `${year}-08-31` });
  return { baseline: season(recentYear - 5), recent: season(recentYear) };
}

export type CellPosition = "nw" | "n" | "ne" | "w" | "c" | "e" | "sw" | "s" | "se";
export interface GreenCell { id: string; pos: CellPosition; bbox: GreenBbox }
export function cityCells([w, s, e, n]: GreenBbox, rows: number, cols: number): GreenCell[] {
  if (rows !== 3 || cols !== 3) throw new Error("Greenery positions require a 3×3 grid");
  const positions: CellPosition[] = ["nw", "n", "ne", "w", "c", "e", "sw", "s", "se"];
  return Array.from({ length: rows * cols }, (_, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      id: `r${r}c${c}`, pos: positions[i],
      bbox: [w + (e - w) * c / cols, n - (n - s) * (r + 1) / rows,
        w + (e - w) * (c + 1) / cols, n - (n - s) * r / rows],
    };
  });
}

export const GREEN_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "SCL", "dataMask"] }],
    output: [
      { id: "ndvi", bands: 1, sampleType: "FLOAT32" },
      { id: "veg", bands: 1, sampleType: "FLOAT32" },
      { id: "dense", bands: 1, sampleType: "FLOAT32" },
      { id: "water", bands: 1, sampleType: "FLOAT32" },
      { id: "dataMask", bands: 1, sampleType: "UINT8" }
    ]
  };
}
function evaluatePixel(s) {
  var bad = s.SCL === 3 || s.SCL === 8 || s.SCL === 9 || s.SCL === 10 || s.SCL === 11;
  var den = s.B08 + s.B04;
  if (!s.dataMask || bad || den <= 0) return { ndvi: [0], veg: [0], dense: [0], water: [0], dataMask: [0] };
  var ndvi = (s.B08 - s.B04) / den;
  return { ndvi: [ndvi], veg: [ndvi >= ${VEG_NDVI} ? 1 : 0],
    dense: [ndvi > ${NDVI_DENSE} ? 1 : 0], water: [s.SCL === 6 ? 1 : 0], dataMask: [1] };
}`;

export interface GreenWeek {
  date: string;
  meanNdvi: number;
  vegFraction: number;
  denseFraction: number;
  waterFraction: number;
  coverage: number;
}
interface BandStats { mean?: number; sampleCount?: number; noDataCount?: number }
interface StatsResponse {
  data?: {
    interval?: { from?: string };
    outputs?: Record<string, { bands?: { B0?: { stats?: BandStats } } }>;
  }[];
}

export async function fetchGreenWeekly(token: string, bbox: GreenBbox, from: string, to: string, signal?: AbortSignal): Promise<GreenWeek[]> {
  const [w, s, e, n] = bbox;
  const res = await fetch(SH_STATS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store", signal,
    body: JSON.stringify({
      input: {
        bounds: { bbox: [...toMercator(w, s), ...toMercator(e, n)], properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/3857" } },
        data: [{ type: "sentinel-2-l2a" }],
      },
      aggregation: {
        timeRange: { from: `${from}T00:00:00Z`, to: `${to}T23:59:59Z` },
        aggregationInterval: { of: "P7D" }, evalscript: GREEN_EVALSCRIPT,
        resx: REED_RES_M, resy: REED_RES_M,
      },
    }),
  });
  if (!res.ok) throw new Error(`Statistical API (greenery) ${res.status}`);
  const json = await res.json() as StatsResponse;
  if (!Array.isArray(json.data)) throw new Error("Invalid Statistical API response");
  const weeks: GreenWeek[] = [];
  for (const d of json.data) {
    const date = d.interval?.from?.slice(0, 10);
    const stats = ["ndvi", "veg", "dense", "water"].map((key) => d.outputs?.[key]?.bands?.B0?.stats);
    if (!date || stats.some((st) => !st || !Number.isFinite(st.mean) || !st.sampleCount || (st.noDataCount ?? 0) >= st.sampleCount)) continue;
    const [ndvi, veg, dense, water] = stats as Required<BandStats>[];
    const coverage = Math.min(...stats.map((st) => (st!.sampleCount! - (st!.noDataCount ?? 0)) / st!.sampleCount!));
    weeks.push({ date, meanNdvi: ndvi.mean, vegFraction: veg.mean, denseFraction: dense.mean, waterFraction: water.mean, coverage });
  }
  return weeks.sort((a, b) => a.date.localeCompare(b.date));
}

export function seasonStat(weeks: GreenWeek[]) {
  const usable = weeks.filter((w) => w.coverage >= MIN_COVERAGE
    && [w.meanNdvi, w.vegFraction, w.denseFraction, w.waterFraction, w.coverage].every(Number.isFinite))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (usable.length < 2) return null;
  const median = (key: "meanNdvi" | "vegFraction" | "denseFraction" | "waterFraction" | "coverage") => {
    const xs = usable.map((w) => w[key]).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  };
  return {
    meanNdvi: median("meanNdvi"), vegFraction: median("vegFraction"), denseFraction: median("denseFraction"),
    waterFraction: median("waterFraction"), coverage: median("coverage"),
    usableWeeks: usable.length, firstDate: usable[0].date, lastDate: usable[usable.length - 1].date,
  };
}
export type GreenSeasonStat = NonNullable<ReturnType<typeof seasonStat>>;
export function cellChange(baseline: GreenSeasonStat | null, recent: GreenSeasonStat | null) {
  if (!baseline || !recent) return null;
  const dVeg = recent.vegFraction - baseline.vegFraction;
  const trend: "up" | "down" | "stable" = dVeg >= CHANGE_PP - 1e-12 ? "up" : dVeg <= -CHANGE_PP + 1e-12 ? "down" : "stable";
  return { dVeg, dNdvi: recent.meanNdvi - baseline.meanNdvi, trend };
}
export interface GreenChangeCell extends GreenCell {
  baseline: GreenSeasonStat | null;
  recent: GreenSeasonStat | null;
  change: ReturnType<typeof cellChange>;
  status: "ok" | "partial" | "no-data";
}
export interface GreenChangeData {
  fetchedAt: string;
  source: string;
  tier: "measurement";
  label: string;
  seasons: ReturnType<typeof summerSeasons>;
  thresholds: { VEG_NDVI: number; NDVI_DENSE: number; CHANGE_PP: number; MIN_COVERAGE: number };
  resolutionM: number;
  cells: GreenChangeCell[];
  summary: { up: number; down: number; stable: number; noData: number };
  caveats: string[];
}
