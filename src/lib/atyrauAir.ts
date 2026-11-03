// Атырау ауа панелінің ЕСЕПТЕУ ЛОГИКАСЫ (таза функциялар — UI мен API-дан тәуелсіз).
//
// Кіріс: CAMS модельдік жауабы (Open-Meteo) + OpenAQ жерүсті стансалары.
// Шығыс: 7 көрсеткіштің AirReading-тері және қауіп деңгейі.
// Ешқандай мок немесе кездейсоқ мән жоқ. Дерек жоқ болса — value: null.

import type { AirReading, Pollutant } from "@/lib/airReading";
import { NORMS, ACTS, type LegalNorm } from "@/data/legalNorms";

export const POLLUTANTS: Pollutant[] = ["so2", "co", "no2", "h2s", "no", "pm25", "pm10"];

export const CAMS_SOURCE = {
  id: "cams",
  name: "Copernicus CAMS (Open-Meteo Air Quality API)",
  url: "https://open-meteo.com/en/docs/air-quality-api",
};

export const GROUND_SOURCE = {
  id: "openaq",
  name: "OpenAQ (мемлекеттік мониторинг станса желісі)",
  url: "https://openaq.org",
};

/** Жерүсті станса мәні ағымдағы болып саналатын ең ұзақ жас (сағат). Одан ескі мән
 *  негізгі (primary) бола алмайды: CAMS модель мәні сақталады, ал станса карточкада
 *  «ескі» себебімен көрсетіледі. */
export const GROUND_MAX_AGE_H = 3;
const HOUR_MS = 3_600_000;

/** CAMS `current.time` — Атырау жергілікті уақыты (timezone=auto), TZ белгісіз naive ISO.
 *  Қазақстан 2024-03-01-ден бастап бүкіл елде UTC+5 (Asia/Atyrau осы). */
export function camsTimeMs(naive: string | null | undefined): number | null {
  if (!naive) return null;
  const full = /T\d{2}:\d{2}$/.test(naive) ? `${naive}:00` : naive;
  const ms = Date.parse(`${full}+05:00`);
  return Number.isNaN(ms) ? null : ms;
}

/** CAMS мәнінің жасы (сағат), сұрау уақытына қатысты. Уақыты белгісіз болса — null. */
export function camsAgeHours(time: string | null | undefined, nowMs: number): number | null {
  const t = camsTimeMs(time);
  return t == null ? null : (nowMs - t) / HOUR_MS;
}

/** Жерүсті мән (UTC ISO) ағым мезетіне қатысты жаңа ма. Уақыты жоқ мән жаңа емес. */
export function isFreshGround(atUtc: string | null, nowMs: number): boolean {
  if (!atUtc) return false;
  const t = Date.parse(atUtc);
  if (Number.isNaN(t)) return false;
  const age = nowMs - t;
  return age <= GROUND_MAX_AGE_H * HOUR_MS && age >= -10 * 60_000;
}

/** Жерүсті станса параметрінің атауы (OpenAQ) → біздің көрсеткіш */
const OAQ_PARAM: Record<string, Pollutant> = {
  pm25: "pm25", pm10: "pm10", no2: "no2", so2: "so2", co: "co", no: "no", h2s: "h2s",
};

/** CAMS (Open-Meteo current) өрісі → көрсеткіш. H₂S-ке CAMS өрісі жоқ. */
const CAMS_FIELD: Partial<Record<Pollutant, "pm2_5" | "pm10" | "sulphur_dioxide" | "nitrogen_dioxide" | "carbon_monoxide">> = {
  pm25: "pm2_5", pm10: "pm10", so2: "sulphur_dioxide", no2: "nitrogen_dioxide", co: "carbon_monoxide",
};

export interface CamsCurrent {
  time?: string;
  pm2_5?: number | null; pm10?: number | null; sulphur_dioxide?: number | null;
  nitrogen_dioxide?: number | null; carbon_monoxide?: number | null;
}

export interface GroundValue {
  parameter: string;
  value: number;
  unit: string | null;
  atUtc: string | null;
  stationName: string;
  distanceKm: number | null;
}

/** Модельдік мән: CAMS сағаттық ағымдағы өлшем (current) — сағаттық орташа */
export function buildModelReadings(cams: CamsCurrent | null, fetchedAt: string, sourceOk: boolean): AirReading[] {
  return POLLUTANTS.map((p) => {
    const field = CAMS_FIELD[p];
    const base = {
      pollutant: p,
      sourceId: CAMS_SOURCE.id,
      sourceName: CAMS_SOURCE.name,
      sourceUrl: CAMS_SOURCE.url,
      fetchedAt,
      updateInterval: "hourly" as const,
      averaging: "hourly" as const,
      quality: "model-unvalidated" as const,
      uncertainty: { kind: "not-estimated" as const },
    };
    if (!field) {
      return { ...base, kind: "none", value: null, unit: null, observedAt: null,
        missingReason: "no-model-field", quality: "none", averaging: "unknown", updateInterval: "unknown" } satisfies AirReading;
    }
    if (!sourceOk || !cams) {
      return { ...base, kind: "none", value: null, unit: null, observedAt: null,
        missingReason: "source-unavailable", quality: "none", averaging: "unknown", updateInterval: "unknown" } satisfies AirReading;
    }
    const raw = cams[field];
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
      return { ...base, kind: "none", value: null, unit: null, observedAt: cams.time ?? null,
        missingReason: "source-unavailable", quality: "none", averaging: "unknown", updateInterval: "unknown" } satisfies AirReading;
    }
    // Open-Meteo CAMS current өрістері µg/m³ (CO де µg/m³) қайтарады
    return { ...base, kind: "model", value: raw, unit: "µg/m³", observedAt: cams.time ?? null } satisfies AirReading;
  });
}

/** Жерүсті мән: әр көрсеткіш үшін ең жаңа (atUtc бойынша) өлшем. Мән жоқ — null. */
export function buildGroundReadings(
  values: GroundValue[] | null,
  fetchedAt: string,
  state: "ok" | "unavailable" | "no-station"
): AirReading[] {
  const latest = new Map<Pollutant, GroundValue>();
  for (const v of values ?? []) {
    const p = OAQ_PARAM[v.parameter];
    if (!p || !Number.isFinite(v.value)) continue;
    const prev = latest.get(p);
    if (!prev || (v.atUtc ?? "") > (prev.atUtc ?? "")) latest.set(p, v);
  }
  return POLLUTANTS.map((p) => {
    const common = {
      pollutant: p,
      sourceId: GROUND_SOURCE.id,
      sourceName: GROUND_SOURCE.name,
      sourceUrl: GROUND_SOURCE.url,
      fetchedAt,
      quality: "ground-unvalidated" as const,
      uncertainty: { kind: "not-estimated" as const },
    };
    const g = latest.get(p);
    if (state !== "ok" || !g) {
      return {
        ...common,
        kind: "none", value: null, unit: null, observedAt: null,
        updateInterval: "unknown", averaging: "unknown", quality: "none",
        missingReason: state === "unavailable" ? "source-unavailable" : "no-verified-source",
      } satisfies AirReading;
    }
    // Ескі станса мәні ағымдағы мән ретінде берілмейді (primary-ға түспейді, CAMS қалады)
    if (!isFreshGround(g.atUtc, Date.parse(fetchedAt))) {
      return {
        ...common,
        kind: "none", value: null, unit: null, observedAt: g.atUtc,
        updateInterval: "unknown", averaging: "unknown", quality: "none",
        missingReason: "stale-ground",
      } satisfies AirReading;
    }
    const unit = g.unit === "µg/m³" || g.unit === "mg/m³" || g.unit === "ppm" || g.unit === "ppb" ? g.unit : null;
    return {
      ...common,
      kind: "ground",
      value: g.value,
      unit,
      observedAt: g.atUtc,
      updateInterval: "hourly",
      // OpenAQ мәні — станса ағымдағы өлшемі; біз оны сағаттық деп танымаймыз
      // (орташалау кезеңі станса әдісіне байланысты, расталмаған) → салыстыруға жарамайды.
      averaging: "unknown",
      station: { name: g.stationName, distanceKm: g.distanceKm },
    } satisfies AirReading;
  });
}

// ─── ҚАУІП ДЕҢГЕЙІ (SPEC §8, PLAN P1.5) ─────────────────────────────────────

export type RiskLevel = "low" | "elevated" | "high" | "insufficient-data";

export interface RiskRow {
  pollutant: Pollutant;
  status: "compared" | "not-comparable" | "no-data";
  ratio: number | null;
  norm: { limit: number; unit: string; averaging: string; actTitle: string; status: string } | null;
  reason: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  rows: RiskRow[];
  missing: Pollutant[];
}

/**
 * Қауіп деңгейі. Ережелер:
 * - Салыстыру ТЕК бірдей орташалау кезеңінде (reading.averaging === norm.averaging).
 * - Бірлік норма бірлігімен бірдей болуы керек.
 * - Жоғары: расталған норма бойынша салыстырылатын мән ≥ шек.
 * - Жоғарылаған: салыстырылатын мән ≥ 50% шек, немесе расталмаған норма асқан.
 * - Төмен: БАРЛЫҚ 7 көрсеткіш салыстырылған және ешбірі шекке жақын емес.
 * - Қалған жағдайда (бір де көрсеткіш салыстырылмаса) — «дерек жеткіліксіз». «Төмен» ЕШҚАШАН шықпайды.
 */
export function assessRisk(readings: AirReading[]): RiskAssessment {
  const rows: RiskRow[] = readings.map((r) => {
    if (r.value == null) {
      return { pollutant: r.pollutant, status: "no-data", ratio: null, norm: null, reason: "no-verified-source" };
    }
    const norms = NORMS.filter((n) => n.indicatorId === r.pollutant && n.unit === r.unit);
    const same = norms.filter((n) => n.averaging === r.averaging);
    if (!same.length) {
      return { pollutant: r.pollutant, status: "not-comparable", ratio: null, norm: null,
        reason: r.averaging === "unknown" ? "averaging-unknown" : "no-matching-averaging-norm" };
    }
    // Ең қатаң (ең төменгі шекті) норманы аламыз; расталмағаны да бірдей ескеріледі
    const n: LegalNorm = same.reduce((a, b) => (b.limit < a.limit ? b : a));
    return {
      pollutant: r.pollutant,
      status: "compared",
      ratio: r.value / n.limit,
      norm: { limit: n.limit, unit: n.unit, averaging: n.averaging, actTitle: ACTS[n.actId]?.title ?? n.actId, status: n.status },
      reason: "",
    };
  });

  const compared = rows.filter((r) => r.status === "compared" && r.norm);
  const verifiedHigh = compared.some((r) => r.norm!.status === "verified" && (r.ratio ?? 0) >= 1);
  const unverifiedHigh = compared.some((r) => r.norm!.status !== "verified" && (r.ratio ?? 0) >= 1);
  const near = compared.some((r) => (r.ratio ?? 0) >= 0.5);
  const missing = rows.filter((r) => r.status !== "compared").map((r) => r.pollutant);

  let level: RiskLevel;
  if (verifiedHigh) level = "high";
  else if (unverifiedHigh || near) level = "elevated";
  else if (missing.length === 0) level = "low";
  else level = "insufficient-data";

  return { level, rows, missing };
}
