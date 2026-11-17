import { NORMS, ACTS, type Averaging } from "@/data/legalNorms";
import { FACILITIES } from "@/data/facilities";

// ЛАСТАНУ КӨЗІ АНАЛИТИКАСЫ — таза есептеу (дереккөзге сұраныс жоқ).
//
// Екі сұраққа жауап береді:
//   1) Таңдалған кезеңде қала нүктесіндегі концентрация қалай өзгерді
//      (сағат / тәулік / ай / жыл бойынша орташа мен ең жоғары мән)?
//   2) Жел ҚАЙ ЖАҚТАН соққанда концентрация жоғары болды
//      (16 румб бойынша шартты орташа)?
//
// ⚠️ НЕ ІСТЕМЕЙДІ: кәсіпорындарды жауапты деп реттемейді және үлес
// есептемейді. CAMS торы ~40 км: АМӨЗ бен АБЗ қаладан 4–7 км жерде, яғни
// бір ұяшықтың ішінде. Румб бойынша айырма — модельдің аймақтық тасымалы,
// нақты зауыттың шлейфі емес. Нысандардың бағыты тек БАҒДАР ретінде беріледі.

export const DATA_START = "2022-08-04"; // CAMS Global қатары Атырау үшін осы күннен басталады
export const ARCHIVE_LAG_DAYS = 7; // ERA5 кідірісі (~5 тәулік) + қор

export const BUCKETS = ["hour", "day", "month", "year"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const POLLUTANTS = {
  so2: { api: "sulphur_dioxide", label: "SO₂", indicatorId: "so2" },
  no2: { api: "nitrogen_dioxide", label: "NO₂", indicatorId: "no2" },
  pm25: { api: "pm2_5", label: "PM₂.₅", indicatorId: "pm25" },
  pm10: { api: "pm10", label: "PM₁₀", indicatorId: "pm10" },
  co: { api: "carbon_monoxide", label: "CO", indicatorId: "co" },
  o3: { api: "ozone", label: "O₃", indicatorId: "ozone" },
} as const;
export type PollutantKey = keyof typeof POLLUTANTS;

/** Бір сұраныстағы ең ұзын кезең (күн); ай мен жыл — шексіз (дерек басынан) */
export const MAX_RANGE_DAYS: Record<Bucket, number | null> = { hour: 7, day: 366, month: null, year: null };

/**
 * Кезең орташасы жариялануы үшін қажет толықтық. Тәулік үшін 75% —
 * ауа сапасы есептілігіндегі әдеттегі шек (24 сағаттың 18-і). Ай мен жылда
 * 90%: маусымдық жүрісі бар қатарда жартылай кезең орташаны бұрмалайды.
 */
export const MIN_COVERAGE: Record<Bucket, number> = { hour: 1, day: 0.75, month: 0.9, year: 0.9 };

/** Кезең орташасы қай нормамен салыстырылады (тек бірдей орташалау кезеңі) */
export const BUCKET_AVERAGING: Record<Bucket, Averaging | null> = {
  hour: "hourly", day: "daily", month: null, year: "annual",
};

export interface HourRow {
  /** Жергілікті уақыт «YYYY-MM-DDTHH:00» */
  time: string;
  value: number | null;
  /** Жел СОҚҚАН бағыт, ° (метеорологиялық) */
  windFrom: number | null;
  /** м/с */
  windSpeed: number | null;
}

export interface BucketStat {
  key: string;
  /** Толықтық жеткіліксіз болса — null (сан көрсетілмейді) */
  mean: number | null;
  max: number | null;
  n: number;
  expected: number;
  coverage: number;
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const daysInYear = (y: number) => (new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1 ? 366 : 365);

export function bucketKey(time: string, bucket: Bucket): string {
  return bucket === "hour" ? time.slice(0, 13) : bucket === "day" ? time.slice(0, 10) : bucket === "month" ? time.slice(0, 7) : time.slice(0, 4);
}

export function expectedHours(key: string, bucket: Bucket): number {
  if (bucket === "hour") return 1;
  if (bucket === "day") return 24;
  const y = Number(key.slice(0, 4));
  return bucket === "month" ? daysInMonth(y, Number(key.slice(5, 7))) * 24 : daysInYear(y) * 24;
}

const round = (v: number, d = 2) => +v.toFixed(d);

export function aggregateBuckets(rows: HourRow[], bucket: Bucket): BucketStat[] {
  const acc = new Map<string, { sum: number; max: number; n: number }>();
  for (const r of rows) {
    const key = bucketKey(r.time, bucket);
    let a = acc.get(key);
    if (!a) { a = { sum: 0, max: -Infinity, n: 0 }; acc.set(key, a); }
    if (r.value == null || !Number.isFinite(r.value)) continue;
    a.sum += r.value; a.n += 1; if (r.value > a.max) a.max = r.value;
  }
  return [...acc.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, a]) => {
    const expected = expectedHours(key, bucket);
    const coverage = Math.min(1, a.n / expected);
    const enough = a.n > 0 && coverage >= MIN_COVERAGE[bucket];
    return {
      key,
      mean: enough ? round(a.sum / a.n) : null,
      max: enough ? round(a.max) : null,
      n: a.n, expected, coverage: round(coverage, 3),
    };
  });
}

export const SECTOR_LABELS = ["С", "ССШ", "СШ", "ШСШ", "Ш", "ШОШ", "ОШ", "ООШ", "О", "ООБ", "ОБ", "БОБ", "Б", "БСБ", "СБ", "ССБ"] as const;
export const CALM_MS = 1; // бұдан баяу желдің бағыты сенімсіз — румб есебіне кірмейді
export const MIN_SECTOR_HOURS = 24;

export function sectorIndex(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 22.5) % 16;
}

export interface SectorStat {
  label: string;
  centerDeg: number;
  /** Сағат саны жеткіліксіз болса — null */
  mean: number | null;
  n: number;
}

export function windSectors(rows: HourRow[]): { sectors: SectorStat[]; calmHours: number; usedHours: number; overallMean: number | null } {
  const acc = Array.from({ length: 16 }, () => ({ sum: 0, n: 0 }));
  let calm = 0, used = 0, total = 0;
  for (const r of rows) {
    if (r.value == null || r.windFrom == null || r.windSpeed == null) continue;
    if (r.windSpeed < CALM_MS) { calm += 1; continue; }
    const a = acc[sectorIndex(r.windFrom)];
    a.sum += r.value; a.n += 1; used += 1; total += r.value;
  }
  return {
    sectors: acc.map((a, i) => ({
      label: SECTOR_LABELS[i],
      centerDeg: i * 22.5,
      mean: a.n >= MIN_SECTOR_HOURS ? round(a.sum / a.n) : null,
      n: a.n,
    })),
    calmHours: calm,
    usedHours: used,
    overallMean: used >= MIN_SECTOR_HOURS ? round(total / used) : null,
  };
}

// ── Нысандардың қаладан бағыты (бағдар ғана) ─────────────────────────────
const rad = (d: number) => (d * Math.PI) / 180;

export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const y = Math.sin(rad(lng2 - lng1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lng2 - lng1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export interface FacilityBearing { id: string; short: string; name: string; bearing: number; sector: string; distanceKm: number }

/** Қала нүктесінен `maxKm` ішіндегі нысандар: жел осы бағыттан соқса, нысан жел өтінде тұр. */
export function facilityBearings(lat: number, lng: number, maxKm = 60): FacilityBearing[] {
  return FACILITIES.map((f) => {
    const b = bearingDeg(lat, lng, f.lat, f.lng);
    return { id: f.id, short: f.short, name: f.name, bearing: Math.round(b), sector: SECTOR_LABELS[sectorIndex(b)], distanceKm: round(distanceKm(lat, lng, f.lat, f.lng), 1) };
  }).filter((f) => f.distanceKm <= maxKm).sort((a, b) => a.distanceKm - b.distanceKm);
}

// ── Нормалар: тек бірдей орташалау кезеңі ────────────────────────────────
export interface NormLine { limit: number; unit: string; jurisdiction: string; actTitle: string; verified: boolean; overCount: number }

export function normLines(pollutant: PollutantKey, bucket: Bucket, stats: BucketStat[]): NormLine[] {
  const averaging = BUCKET_AVERAGING[bucket];
  if (!averaging) return [];
  const id = POLLUTANTS[pollutant].indicatorId;
  return NORMS.filter((n) => n.indicatorId === id && n.averaging === averaging).map((n) => ({
    limit: n.limit,
    unit: n.unit,
    jurisdiction: ACTS[n.actId].jurisdiction,
    actTitle: ACTS[n.actId].title,
    verified: n.status === "verified",
    overCount: stats.filter((s) => s.mean != null && s.mean > n.limit).length,
  }));
}

// ── Кезеңді тексеру ──────────────────────────────────────────────────────
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function latestDate(now = new Date()): string {
  return isoDay(new Date(now.getTime() - ARCHIVE_LAG_DAYS * 86400_000));
}

export type RangeResult = { ok: true; from: string; to: string; clipped: boolean } | { ok: false; error: string };

export function resolveRange(from: string | null, to: string | null, bucket: Bucket, now = new Date()): RangeResult {
  if (!from || !to || !ISO.test(from) || !ISO.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
    return { ok: false, error: "Кезең жарамсыз: from және to — YYYY-MM-DD" };
  }
  const max = latestDate(now);
  const f = from < DATA_START ? DATA_START : from;
  const t = to > max ? max : to;
  if (f > t) return { ok: false, error: `Таңдалған кезеңде дерек жоқ: қатар ${DATA_START} — ${max} аралығын қамтиды` };
  const days = Math.round((Date.parse(t) - Date.parse(f)) / 86400_000) + 1;
  const cap = MAX_RANGE_DAYS[bucket];
  if (cap != null && days > cap) return { ok: false, error: `Бұл бөлшектеу үшін кезең тым ұзын: ең көбі ${cap} күн` };
  return { ok: true, from: f, to: t, clipped: f !== from || t !== to };
}

/** Ай мен жыл үшін дерек күнтізбелік жыл бойынша сұралады — аяқталған жыл ұзақ кэштеледі. */
export function fetchChunks(from: string, to: string, bucket: Bucket, now = new Date()): { start: string; end: string; complete: boolean }[] {
  const max = latestDate(now);
  if (bucket === "hour" || bucket === "day") return [{ start: from, end: to, complete: to < max }];
  const out: { start: string; end: string; complete: boolean }[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const start = `${y}-01-01` < DATA_START ? DATA_START : `${y}-01-01`;
    const end = `${y}-12-31` > max ? max : `${y}-12-31`;
    if (start <= end) out.push({ start, end, complete: end === `${y}-12-31` });
  }
  return out;
}
