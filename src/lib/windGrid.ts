// Жел торы — `/api/windgrid` үшін таза есептеу (P1.10).
//
// ЕРЕЖЕ: дерек жоқ нүкте НӨЛ ЖЕЛ емес. Open-Meteo `current` бос болса (немесе
// мән жарамсыз болса) — `speed`/`dir` = null. Нөл — тек НАҚТЫ өлшенген 0 м/с.
// Жиынтық (орташа/максимум/басым бағыт) тек жарамды нүктелер бойынша есептеледі;
// жарамды нүкте жоқ болса — null (Math.max([]) = -Infinity да, 0 да емес).

export interface WindCurrent {
  wind_speed_10m?: number | null;
  wind_direction_10m?: number | null;
}

export interface WindGridPoint {
  lat: number;
  lng: number;
  /** Жылдамдық — Open-Meteo бірлігімен (әдепкі: км/сағ). Түрлендіру жоқ. */
  speed: number | null;
  /** Желдің КЕЛЕТІН бағыты, градус (метеорологиялық). Жоқ болса null. */
  dir: number | null;
}

export interface WindGridSummary {
  grid: WindGridPoint[];
  avgSpeed: number | null;
  maxSpeed: number | null;
  dominantDir: number | null;
  /** Жарамды жылдамдығы бар нүкте саны */
  validCount: number;
  /** Жылдамдығы жоқ нүкте саны */
  missingCount: number;
}

const finiteOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param list Open-Meteo жауабының нүктелері (`current` өрістерімен)
 * @param points сұрау нүктелері (lat/lng), `list`-пен бірдей индекс бойынша
 */
export function buildWindGrid(
  list: ({ current?: WindCurrent | null } | null | undefined)[],
  points: { lat: number; lng: number }[]
): WindGridSummary {
  const grid: WindGridPoint[] = list.map((d, i) => ({
    lat: points[i]?.lat ?? NaN,
    lng: points[i]?.lng ?? NaN,
    speed: finiteOrNull(d?.current?.wind_speed_10m),
    dir: finiteOrNull(d?.current?.wind_direction_10m),
  }));

  const speeds = grid.map((g) => g.speed).filter((v): v is number => v != null);
  const validCount = speeds.length;

  // Басым бағыт — тек жарамды бағыты бар нүктелер бойынша векторлық орташа
  let sx = 0;
  let sy = 0;
  let dirCount = 0;
  for (const g of grid) {
    if (g.dir == null) continue;
    const r = (g.dir * Math.PI) / 180;
    sx += Math.sin(r);
    sy += Math.cos(r);
    dirCount++;
  }

  return {
    grid,
    avgSpeed: validCount ? round1(speeds.reduce((a, b) => a + b, 0) / validCount) : null,
    maxSpeed: validCount ? round1(Math.max(...speeds)) : null,
    dominantDir: dirCount ? Math.round(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360) : null,
    validCount,
    missingCount: grid.length - validCount,
  };
}

// ── P2.3: сағаттық жел — өткен 24 сағ және алдағы 24 сағ ──────────────
//
// Open-Meteo `hourly` (past_days=1, forecast_days=2) жауабынан:
//   · `current.time` — ағымдағы сағат (уақыт белгісі) — анкер;
//   · ағымдағы сағатқа дейінгі 24 сағат → kind "past" (өлшенген/модельденген өткені);
//   · ағымдағы сағаттан кейінгі 24 сағат → kind "forecast" (болжам).
// Әр сағат үшін тор бойынша орташа жылдамдық пен басым бағыт есептеледі;
// жарамды мән жоқ сағат — null (0 емес).

export interface WindHourlyPoint {
  time: string;
  kind: "past" | "forecast";
  /** Тор бойынша орташа жылдамдық, км/сағ; жарамды мән жоқ болса null */
  avgSpeed: number | null;
  /** Басым бағыт (желдің КЕЛЕТІН бағыты), градус; жоқ болса null */
  dominantDir: number | null;
  /** Осы сағатта жарамды жылдамдығы бар нүкте саны */
  validCount: number;
}

export interface WindHourlyUpstream {
  current?: { time?: string | null } | null;
  hourly?: {
    time?: (string | null)[];
    wind_speed_10m?: (number | null)[];
    wind_direction_10m?: (number | null)[];
  } | null;
}

export interface WindHourlySeries {
  past: WindHourlyPoint[];
  forecast: WindHourlyPoint[];
}

const HOURS = 24;

/**
 * @returns null — ағымдағы уақыт анкері табылмады (жауап жарамсыз).
 */
export function buildWindHourly(
  list: (WindHourlyUpstream | null | undefined)[]
): WindHourlySeries | null {
  const anchor = list.find((d) => typeof d?.current?.time === "string")?.current?.time;
  const times = list.find((d) => Array.isArray(d?.hourly?.time))?.hourly?.time;
  if (!anchor || !times) return null;
  // `current.time` — 15 мин қадам ("…T17:30"), ал `hourly.time` — сағат басы ("…T17:00").
  // Тіке indexOf табылмайды (нақты Open-Meteo жауабында дәл осылай), сондықтан
  // сағат кілті (YYYY-MM-DDTHH) бойынша салыстырамыз.
  const hourKey = (t: string) => t.slice(0, 13);
  const now = times.findIndex((t) => typeof t === "string" && hourKey(t) === hourKey(anchor));
  if (now < 0) return null;

  const point = (j: number, kind: "past" | "forecast"): WindHourlyPoint | null => {
    const time = times[j];
    if (typeof time !== "string") return null;
    let sx = 0;
    let sy = 0;
    let dirCount = 0;
    const speeds: number[] = [];
    for (const d of list) {
      const s = finiteOrNull(d?.hourly?.wind_speed_10m?.[j]);
      if (s != null) speeds.push(s);
      const dir = finiteOrNull(d?.hourly?.wind_direction_10m?.[j]);
      if (dir != null) {
        const r = (dir * Math.PI) / 180;
        sx += Math.sin(r);
        sy += Math.cos(r);
        dirCount++;
      }
    }
    return {
      time,
      kind,
      avgSpeed: speeds.length ? round1(speeds.reduce((a, b) => a + b, 0) / speeds.length) : null,
      dominantDir: dirCount ? Math.round(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360) : null,
      validCount: speeds.length,
    };
  };

  const past: WindHourlyPoint[] = [];
  for (let j = now - HOURS + 1; j <= now; j++) {
    if (j < 0) continue;
    const p = point(j, "past");
    if (p) past.push(p);
  }
  const forecast: WindHourlyPoint[] = [];
  for (let j = now + 1; j <= now + HOURS; j++) {
    const p = point(j, "forecast");
    if (p) forecast.push(p);
  }
  return { past, forecast };
}

// ── P2.4: таралу слайдері — жел деректері жоқ болса сұрланады ─────────────

export type WindDataState = "loading" | "error" | "ok";

/**
 * Таралу слайдері (модель нәтижесі) жел деректерінсіз есептелмейді.
 * Сұрлану шарты:
 *   · көз нүктесінің жел жылдамдығы (`source.wind.speed`) ақырлы сан емес;
 *   · жел торы сұрауы сәтсіз (`error`);
 *   · жел торы жауап берді (`ok`), бірақ сағаттық серияда бір де жарамды жылдамдық жоқ.
 * `loading` кезінде сұрламаймыз — дерек әлі белгісіз, «жоқ» деп айтпаймыз.
 */
export function isDispersionWindMissing(opts: {
  sourceSpeed: unknown;
  windState: WindDataState;
  hourly: WindHourlySeries | null | undefined;
}): boolean {
  if (typeof opts.sourceSpeed !== "number" || !Number.isFinite(opts.sourceSpeed)) return true;
  if (opts.windState === "error") return true;
  if (opts.windState === "loading") return false;
  const points = opts.hourly ? [...opts.hourly.past, ...opts.hourly.forecast] : [];
  return !points.some((p) => p.avgSpeed != null);
}
