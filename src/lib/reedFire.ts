// ҚАМЫС ӨРТІ ТӘУЕКЕЛІ — түтін бағытының конусы (P4.5). 📊 МОДЕЛЬ.
//
// Не істейді:
//   1. Қамыс «полигоны» = бақылау терезесі (FLOOD_ZONES bbox), онда Sentinel-2
//      NDVI > 0.4 тығыз өсімдікті көрген (`/api/reed-habitat`). Бұл — ПРОКСИ,
//      қамыс картасы ЕМЕС: суармалы егіс пен ағаш екпелері де өтеді.
//   2. FIRMS жылу аномалиялары (архив + NRT, `classifyAnomaly` арқылы
//      серверде жіктелген) осы терезелермен қиылыстырылады.
//      ⚠️ «industrial_flare» ЕШҚАШАН қамыс өртіне саналмайды — полигон
//      тексерісінен БҰРЫН алынып тасталады.
//   3. Түтін бағыты: ең жақын Open-Meteo жел нүктесі; желдің КЕЛЕТІН бағыты
//      + 180° = түтін кететін бағыт. Конус ені — Pasquill–Gifford σy
//      (D класы, бейтарап — болжам) + жел бағытының ауытқуы.
//   4. Жел дерегі жоқ болса — status «no-wind», конус ЖОҚ. Нөл жел деп
//      есептелмейді, бағыт ойдан берілмейді.
//
// ⚠️ Жылу аномалиясы — расталған өрт ЕМЕС. Конус — бағыт бағасы,
// концентрация өрісі емес: µg/m³ берілмейді.
//
// Таза модуль: fetch жоқ, React жоқ. Геометрия — [lng, lat] ретімен.

import type { AnomalyCategory } from "./fireClassify";
import { pointInPolygon } from "./firms";
import { angularDelta, bearing, destPoint, haversineKm, plumeCone } from "./pollutionSource";
import {
  MIN_VISUAL_HALF_ANGLE, coneHalfAngle, kmhToMs, plumeLengthKm,
} from "./dispersion";
import { PLACES } from "@/data/places";

export interface ReedZoneInput {
  id: string;
  name: string;
  /** [w, s, e, n] */
  bbox: [number, number, number, number];
  denseFraction: number | null;
  status: "ok" | "no-data";
}

export interface ReedPolygon {
  id: string;
  name: string;
  denseFraction: number;
  /** Жабық сақина, [lng, lat] */
  ring: [number, number][];
}

/** Тек өлшемі бар әрі тығыз өсімдік табылған терезелер (null ≠ 0, екеуі де алынбайды) */
export function reedPolygons(zones: ReedZoneInput[]): ReedPolygon[] {
  const out: ReedPolygon[] = [];
  for (const z of zones) {
    if (z.status !== "ok") continue;
    if (typeof z.denseFraction !== "number" || !Number.isFinite(z.denseFraction)) continue;
    if (z.denseFraction <= 0) continue;
    const [w, s, e, n] = z.bbox;
    out.push({
      id: z.id,
      name: z.name,
      denseFraction: z.denseFraction,
      ring: [[w, s], [e, s], [e, n], [w, n], [w, s]],
    });
  }
  return out;
}

export interface FireAnomalyInput {
  lat: number;
  lng: number;
  acqDate: string;
  dayNight: string;
  frp: number;
  category: AnomalyCategory;
}

export type ReedFireAnomaly = FireAnomalyInput & { zoneId: string; zoneName: string };

/** Қайталанбау кілті — firmsArchive.ts-пен бірдей (архив пен NRT қиылысады) */
export function reedAnomalyKey(a: Pick<FireAnomalyInput, "lat" | "lng" | "acqDate" | "dayNight">): string {
  return `${a.lat.toFixed(4)}|${a.lng.toFixed(4)}|${a.acqDate}|${a.dayNight}`;
}

export function reedFireAnomalies(anoms: FireAnomalyInput[], polys: ReedPolygon[]): ReedFireAnomaly[] {
  const seen = new Set<string>();
  const out: ReedFireAnomaly[] = [];
  for (const a of anoms) {
    // Өндірістік алау — қамыс өрті емес. Полигон тексерісінен БҰРЫН.
    if (a.category === "industrial_flare") continue;
    const key = reedAnomalyKey(a);
    if (seen.has(key)) continue;
    const poly = polys.find((p) => pointInPolygon(a.lng, a.lat, p.ring));
    if (!poly) continue;
    seen.add(key);
    out.push({ ...a, zoneId: poly.id, zoneName: poly.name });
  }
  return out;
}

/** Желдің КЕЛЕТІН бағыты (метеорологиялық) → түтін КЕТЕТІН бағыт, [0, 360) */
export function downwindBearing(windFromDeg: number): number {
  return (((windFromDeg + 180) % 360) + 360) % 360;
}

/** WindGridPoint пішінімен бірдей (src/lib/windGrid.ts) */
export interface WindSample {
  lat: number;
  lng: number;
  /** км/сағ; null — дерек жоқ (нөл емес) */
  speed: number | null;
  /** Желдің КЕЛЕТІН бағыты, градус; null — дерек жоқ */
  dir: number | null;
}

export interface Settlement {
  name: string;
  lat: number;
  lng: number;
}

/** Облыстың елді мекендері (қала + аудан орталығы) — places.ts-тен */
export const REED_FIRE_SETTLEMENTS: Settlement[] = PLACES
  .filter((p) => p.kind === "city" || p.kind === "district")
  .map((p) => ({ name: p.name, lat: p.lat, lng: p.lng }));

/**
 * Pasquill орнықтылық класы — БОЛЖАМ: D (бейтарап). Өрт түтіні қалқымалы,
 * құбыр шлейфі емес; нақты класс белгісіз болғандықтан орташа класс алынды.
 */
export const SMOKE_STABILITY = "D" as const;

/** Жел жоқ кездегі сұр үзік шеңбердің радиусы (км) — тек белгі, модель емес */
export const NO_WIND_RING_KM = 3;

export type SmokeCone =
  | {
      status: "ok";
      windFrom: number;
      downwind: number;
      speedKmh: number;
      lengthKm: number;
      /** НАҚТЫ жарты бұрыш (сызба кемінде MIN_VISUAL_HALF_ANGLE-мен салынады) */
      halfAngleDeg: number;
      ring: [number, number][];
      settlements: { name: string; distanceKm: number }[];
    }
  | { status: "no-wind"; ring: null; settlements: [] };

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

export function smokeCone(
  origin: { lat: number; lng: number },
  wind: WindSample[] | null | undefined,
  opts: { dirSigmaDeg?: number; settlements?: Settlement[] } = {}
): SmokeCone {
  // 1) Ең жақын ЖАРАМДЫ жел нүктесі (speed пен dir екеуі де бар)
  let best: { s: WindSample & { speed: number; dir: number }; d: number } | null = null;
  for (const s of wind ?? []) {
    if (!isNum(s.speed) || !isNum(s.dir)) continue;
    const d = haversineKm(origin.lat, origin.lng, s.lat, s.lng);
    if (!best || d < best.d) best = { s: s as WindSample & { speed: number; dir: number }, d };
  }
  if (!best) return { status: "no-wind", ring: null, settlements: [] };

  const { speed, dir } = best.s;
  // bearingStdDev бағыттар бір-бірін толық жойғанда Infinity қайтарады —
  // бұл «бағыт мүлде тұрақсыз», яғни ЕҢ КЕҢ конус (45°), ал 0 емес.
  // NaN/жоқ — ауытқу белгісіз → 0 (тек физикалық бұрыш).
  const rawSigma = opts.dirSigmaDeg;
  const dirSigma =
    typeof rawSigma === "number" && !Number.isNaN(rawSigma)
      ? Math.max(0, Math.min(45, rawSigma))
      : 0;
  const downwind = downwindBearing(dir);
  const windMs = kmhToMs(speed);
  const lengthKm = plumeLengthKm(SMOKE_STABILITY, windMs);
  const halfAngleDeg = coneHalfAngle(lengthKm, SMOKE_STABILITY, dirSigma).total;

  // Сызба — көрнекілік үшін кемінде MIN_VISUAL_HALF_ANGLE
  const ring = plumeCone(
    origin, downwind, speed,
    { stability: SMOKE_STABILITY, windMs, dirSigma },
    MIN_VISUAL_HALF_ANGLE
  );

  // Елді мекендер — НАҚТЫ бұрышпен (жобаның конвенциясы)
  const settlements = (opts.settlements ?? REED_FIRE_SETTLEMENTS)
    .map((s) => ({
      name: s.name,
      d: haversineKm(origin.lat, origin.lng, s.lat, s.lng),
      delta: angularDelta(bearing(origin.lat, origin.lng, s.lat, s.lng), downwind),
    }))
    .filter((s) => s.d <= lengthKm && s.delta <= halfAngleDeg)
    .sort((a, b) => a.d - b.d)
    .map((s) => ({ name: s.name, distanceKm: +s.d.toFixed(1) }));

  return {
    status: "ok",
    windFrom: dir,
    downwind,
    speedKmh: speed,
    lengthKm,
    halfAngleDeg: +halfAngleDeg.toFixed(1),
    ring,
    settlements,
  };
}

/** Жел жоқ кездегі белгі — жабық сақина, [lng, lat], steps + 1 нүкте */
export function noWindRing(
  origin: { lat: number; lng: number },
  radiusKm = NO_WIND_RING_KM,
  steps = 32
): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    ring.push(destPoint(origin.lat, origin.lng, (360 * i) / steps, radiusKm));
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}
