// БАСЫМДЫҚ ТОРЫ (i-Tree Landscape / Tree Equity Score үлгісі) — 1 км ұяшықтар.
// Әр ұяшықта ӨЛШЕНГЕН/КАРТАЛАНҒАН критерийлер ғана; салмақты пайдаланушы
// өзі таңдайды (клиентте). Нәтиже — 📊 модель: басымдық, «қажеттілік» дәлелі емес.
//
//  · ndvi        — Sentinel-2 L2A, соңғы жаз (06–08), пиксель бойынша медиана, 50 м
//  · residential — OSM landuse=residential үлесі (халық тығыздығының ПРОКСИ-і)
//  · green       — OSM жасыл аймақ үлесі (wood/grass/park)
//  · sourceKm    — тізілімдегі ең жақын өнеркәсіп нысанына дейін, км

import { pointInRing, ringBbox, type Ring } from "./areaGeo";

export const PRIORITY_CELL_KM = 1;

export interface PriorityCell {
  id: string;
  bbox: [number, number, number, number];
  ndvi: number | null;
  ndviCoverage: number;
  residential: number;
  green: number;
  sourceKm: number;
}

export function buildCells([w, s, e, n]: [number, number, number, number], km = PRIORITY_CELL_KM) {
  const lat0 = (s + n) / 2;
  const dLat = km / 111.32, dLng = km / (111.32 * Math.cos((lat0 * Math.PI) / 180));
  const cells: { id: string; bbox: [number, number, number, number] }[] = [];
  for (let r = 0, y = n; y - dLat >= s - 1e-9; r++, y -= dLat) {
    for (let c = 0, x = w; x + dLng <= e + 1e-9; c++, x += dLng) {
      cells.push({ id: `r${r}c${c}`, bbox: [x, y - dLat, x + dLng, y] });
    }
  }
  return cells;
}

/** UINT8 кодтау: 0 = дерек жоқ, 1..255 → NDVI −1..1 */
export const NDVI_PNG_EVAL = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:{bands:1,sampleType:"UINT8"},mosaicking:"ORBIT"};}
function evaluatePixel(ss){var v=[];for(var i=0;i<ss.length;i++){var s=ss[i];var bad=s.SCL===0||s.SCL===1||s.SCL===3||s.SCL===8||s.SCL===9||s.SCL===10||s.SCL===11;var d=s.B08+s.B04;
if(s.dataMask&&!bad&&d>0)v.push((s.B08-s.B04)/d);}if(v.length<2)return[0];v.sort(function(a,b){return a-b});var m=Math.floor(v.length/2);var med=v.length%2?v[m]:(v[m-1]+v[m])/2;
return[1+Math.round((Math.max(-1,Math.min(1,med))+1)/2*254)];}`;

export const decodeNdvi = (v: number) => (v === 0 ? null : ((v - 1) / 254) * 2 - 1);

/** Растр → ұяшық орташасы мен жамылғысы */
export function rasterCellStats(img: { width: number; height: number; data: Uint8Array }, rb: [number, number, number, number], cell: [number, number, number, number]) {
  const [w, s, e, n] = rb;
  const x0 = Math.max(0, Math.floor(((cell[0] - w) / (e - w)) * img.width));
  const x1 = Math.min(img.width, Math.ceil(((cell[2] - w) / (e - w)) * img.width));
  const y0 = Math.max(0, Math.floor(((n - cell[3]) / (n - s)) * img.height));
  const y1 = Math.min(img.height, Math.ceil(((n - cell[1]) / (n - s)) * img.height));
  let sum = 0, ok = 0, tot = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    tot++;
    const v = decodeNdvi(img.data[y * img.width + x]);
    if (v != null) { sum += v; ok++; }
  }
  return { mean: ok ? sum / ok : null, coverage: tot ? ok / tot : 0 };
}

type Poly = { ring: Ring; bbox: [number, number, number, number] };
export const toPolys = (rings: Ring[]): Poly[] => rings.map((ring) => ({ ring, bbox: ringBbox(ring) }));

/** Ұяшық ішіндегі 10×10 сынама нүктесінің полигонға түскен үлесі */
export function cellFraction(cell: [number, number, number, number], polys: Poly[], k = 10): number {
  const [w, s, e, n] = cell;
  const cand = polys.filter((p) => p.bbox[0] <= e && p.bbox[2] >= w && p.bbox[1] <= n && p.bbox[3] >= s);
  if (!cand.length) return 0;
  let hit = 0;
  for (let i = 0; i < k; i++) for (let j = 0; j < k; j++) {
    const x = w + ((j + 0.5) / k) * (e - w), y = s + ((i + 0.5) / k) * (n - s);
    if (cand.some((p) => x >= p.bbox[0] && x <= p.bbox[2] && y >= p.bbox[1] && y <= p.bbox[3] && pointInRing(x, y, p.ring))) hit++;
  }
  return hit / (k * k);
}

export function kmBetween(a: [number, number], b: [number, number]) {
  const kx = 111.32 * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * kx, (a[1] - b[1]) * 111.32);
}

export interface Weights { ndvi: number; residential: number; source: number }
export const DEFAULT_WEIGHTS: Weights = { ndvi: 40, residential: 40, source: 20 };
export const SOURCE_RANGE_KM = 10;

/** Салмақты индекс 0..1 (клиентте). NDVI жоқ ұяшық — null (бағаланбайды). */
export function scoreCells(cells: PriorityCell[], w: Weights): (number | null)[] {
  const nd = cells.map((c) => c.ndvi).filter((x): x is number => x != null);
  const lo = Math.min(...nd), hi = Math.max(...nd);
  const total = w.ndvi + w.residential + w.source;
  return cells.map((c) => {
    if (c.ndvi == null || !total) return null;
    const deficit = hi > lo ? 1 - (c.ndvi - lo) / (hi - lo) : 0;
    const near = 1 - Math.min(c.sourceKm, SOURCE_RANGE_KM) / SOURCE_RANGE_KM;
    return (w.ndvi * deficit + w.residential * c.residential + w.source * near) / total;
  });
}

export const PRIORITY_CAVEATS = [
  "Басымдық индексі — шешім қабылдауға көмек, «ағаш керек» деген дәлел емес. Салмақтарды сіз таңдайсыз.",
  "Халық тығыздығының ресми торы жалғанбаған: OSM тұрғын үй үлесі тек ПРОКСИ ретінде қолданылады.",
  "NDVI — соңғы жаздың медианасы (Sentinel-2, 50 м); бұлтты пиксельдер шығарылады, жамылғысы 50%-дан аз ұяшық бағаланбайды.",
  "Өнеркәсіп нысандарына қашықтық — тізілімдегі 11 нысан бойынша; жел бағыты ескерілмейді.",
];
