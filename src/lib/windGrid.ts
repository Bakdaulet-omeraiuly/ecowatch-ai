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
