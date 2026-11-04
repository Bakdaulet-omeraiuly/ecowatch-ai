// Аймақ құралдарының геометриясы (клиент пен сервер ортақ, таза функциялар).
// Сақина — [lng, lat][] жабық емес тізім (соңғы төбе біріншісін қайталамайды).

import { ATYRAU_OBLAST, pointInPolygon } from "./firms";

export type LngLat = [number, number];
export type Ring = LngLat[];

export const AREA_MAX_KM2 = 2000;
export const AREA_MAX_VERTICES = 500;
const R_EARTH_M = 6_371_008.8;

/** Соңғы төбе біріншісін қайталаса — алып тастайды */
export function openRing(ring: Ring): Ring {
  if (ring.length > 1) {
    const [a, b] = [ring[0], ring[ring.length - 1]];
    if (a[0] === b[0] && a[1] === b[1]) return ring.slice(0, -1);
  }
  return ring;
}

/** Сфералық аудан, км² (Chamberlain & Duquette 2007) */
export function ringAreaKm2(ring: Ring): number {
  const r = openRing(ring);
  if (r.length < 3) return 0;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0; i < r.length; i++) {
    const [x1, y1] = r[i];
    const [x2, y2] = r[(i + 1) % r.length];
    sum += (x2 - x1) * rad * (2 + Math.sin(y1 * rad) + Math.sin(y2 * rad));
  }
  return Math.abs((sum * R_EARTH_M * R_EARTH_M) / 2) / 1e6;
}

export function ringBbox(ring: Ring): [number, number, number, number] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of ring) {
    if (x < w) w = x; if (x > e) e = x;
    if (y < s) s = y; if (y > n) n = y;
  }
  return [w, s, e, n];
}

export function ringCentroid(ring: Ring): LngLat {
  const r = openRing(ring);
  return [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length];
}

export function pointInRing(lng: number, lat: number, ring: Ring): boolean {
  return pointInPolygon(lng, lat, ring);
}

function segmentsCross(a: LngLat, b: LngLat, c: LngLat, d: LngLat): boolean {
  const o = (p: LngLat, q: LngLat, r: LngLat) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/** Өзін-өзі қиятын полигон ба (көрші емес қырлар) */
export function selfIntersects(ring: Ring): boolean {
  const r = openRing(ring);
  const n = r.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsCross(r[i], r[(i + 1) % n], r[j], r[(j + 1) % n])) return true;
    }
  }
  return false;
}

export type RingCheck = { ok: true; ring: Ring; areaKm2: number } | { ok: false; error: string };

/** Сервер мен клиент бірдей тексереді: пішін, өлшем, облыс шегі */
export function validateRing(input: unknown): RingCheck {
  if (!Array.isArray(input)) return { ok: false, error: "Полигон төбелері жоқ" };
  const pts = input.filter((p): p is LngLat =>
    Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]),
  ).map((p) => [+p[0], +p[1]] as LngLat);
  if (pts.length !== input.length) return { ok: false, error: "Төбе координаттары жарамсыз" };
  const ring = openRing(pts);
  if (ring.length < 3) return { ok: false, error: "Кемінде 3 төбе керек" };
  if (ring.length > AREA_MAX_VERTICES) return { ok: false, error: `Төбе саны ${AREA_MAX_VERTICES}-ден аспауы керек` };
  if (ring.some(([x, y]) => x < -180 || x > 180 || y < -90 || y > 90)) return { ok: false, error: "Координаттар ауқымнан тыс" };
  if (selfIntersects(ring)) return { ok: false, error: "Полигон өзін-өзі қиып тұр" };
  const areaKm2 = ringAreaKm2(ring);
  if (areaKm2 < 0.0005) return { ok: false, error: "Аймақ тым кішкентай (< 500 м²)" };
  if (areaKm2 > AREA_MAX_KM2) return { ok: false, error: `Аймақ ${AREA_MAX_KM2} км²-ден аспауы керек` };
  if (!ring.every(([x, y]) => pointInPolygon(x, y, ATYRAU_OBLAST))) {
    return { ok: false, error: "Аймақ толығымен Атырау облысының ішінде болуы керек" };
  }
  return { ok: true, ring, areaKm2 };
}

/** GeoJSON (Feature/FeatureCollection/Polygon/MultiPolygon) → бірінші сыртқы сақина */
export function parseGeoJsonRing(text: string): Ring | null {
  let j: unknown;
  try { j = JSON.parse(text); } catch { return null; }
  const geoms: unknown[] = [];
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const g = o as { type?: string; features?: unknown[]; geometry?: unknown; geometries?: unknown[] };
    if (g.type === "FeatureCollection") g.features?.forEach(walk);
    else if (g.type === "Feature") walk(g.geometry);
    else if (g.type === "GeometryCollection") g.geometries?.forEach(walk);
    else geoms.push(o);
  };
  walk(j);
  for (const g of geoms as { type?: string; coordinates?: unknown }[]) {
    if (g.type === "Polygon" && Array.isArray(g.coordinates)) return openRing(g.coordinates[0] as Ring);
    if (g.type === "MultiPolygon" && Array.isArray(g.coordinates)) return openRing((g.coordinates[0] as Ring[])[0]);
  }
  return null;
}

/** KML → бірінші Polygon/outerBoundaryIs ішіндегі <coordinates> */
export function parseKmlRing(text: string): Ring | null {
  const outer = text.match(/<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i)
    ?? text.match(/<Polygon>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!outer) return null;
  const pts = outer[1].trim().split(/\s+/).map((t) => t.split(",").map(Number))
    .filter((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [p[0], p[1]] as LngLat);
  return pts.length >= 3 ? openRing(pts) : null;
}

export function parseAreaFile(name: string, text: string): Ring | null {
  return /\.kml$/i.test(name) ? parseKmlRing(text) : parseGeoJsonRing(text);
}

export function ringToFeature(ring: Ring, properties: Record<string, unknown> = {}) {
  const r = openRing(ring);
  return {
    type: "Feature" as const,
    properties,
    geometry: { type: "Polygon" as const, coordinates: [[...r, r[0]]] },
  };
}

/** Полигон ішіндегі тұрақты тор нүктелері (метрлік қадаммен), ≤ maxSamples */
export function sampleRing(ring: Ring, maxSamples = 20_000): { points: LngLat[]; stepM: number; cellKm2: number } {
  const [w, s, e, n] = ringBbox(ring);
  const lat0 = (s + n) / 2;
  const mLat = 111_320, mLng = 111_320 * Math.cos((lat0 * Math.PI) / 180);
  const bboxM2 = (e - w) * mLng * (n - s) * mLat;
  const stepM = Math.max(10, Math.sqrt(bboxM2 / maxSamples));
  const dLat = stepM / mLat, dLng = stepM / mLng;
  const points: LngLat[] = [];
  for (let y = s + dLat / 2; y < n; y += dLat) {
    for (let x = w + dLng / 2; x < e; x += dLng) {
      if (pointInPolygon(x, y, ring)) points.push([x, y]);
    }
  }
  return { points, stepM, cellKm2: (stepM * stepM) / 1e6 };
}
