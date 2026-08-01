// JAIYQ-ML белгілері (features).
//
// МАҢЫЗДЫ: бұл файл `ml-service/features.py` файлының дәл көшірмесі болуы керек.
// Біреуін өзгертсең — екіншісін де өзгерт, әйтпесе оқытылған модель дұрыс
// емес кірісті алады да, болжам мәнсіз болады.
// (`ml-service/selftest.py` екеуінің сәйкестігін тексереді.)

export const FEATURE_NAMES = [
  "t2m", "rh", "dew", "psfc", "precip", "cloud", "wspd", "wgust",
  "wdir_sin", "wdir_cos", "blh", "t850", "inversion", "vent",
  "precip24", "wspd24", "hour_sin", "hour_cos", "doy_sin", "doy_cos",
] as const;

export const RAW_KEYS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "surface_pressure",
  "precipitation",
  "cloud_cover",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
  "boundary_layer_height",
  "temperature_850hPa",
] as const;

export type RawKey = (typeof RAW_KEYS)[number];
export type RawRow = { time: string } & Partial<Record<RawKey, number | null>>;

export const WINDOW = 24;

function toUtc(t: string): Date {
  // Open-Meteo `timezone=UTC` кезінде "2025-06-01T13:00" түрінде қайтарады
  return new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(t) ? t : `${t}Z`);
}

function dayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((d.getTime() - start) / 86_400_000) + 1;
}

/**
 * Уақыт бойынша өсу ретімен берілген жолдардан белгілер матрицасын құрады.
 * Алғашқы (WINDOW − 1) жол rolling терезесі толмағандықтан тасталады.
 */
export function buildFeatures(rows: RawRow[]): { X: number[][]; times: string[] } {
  // Жетіспейтін мәндерді алдыңғы сағаттан толтыру (Python нұсқасымен бірдей)
  const last: Partial<Record<RawKey, number>> = {};
  const clean = rows.map((r) => {
    const c: Record<string, number> = {};
    for (const k of RAW_KEYS) {
      const v = r[k];
      if (v == null || Number.isNaN(v)) {
        c[k] = last[k] ?? 0;
      } else {
        c[k] = v;
        last[k] = v;
      }
    }
    return { time: r.time, v: c };
  });

  const X: number[][] = [];
  const times: string[] = [];
  const precipWin: number[] = [];
  const wspdWin: number[] = [];

  for (const row of clean) {
    const v = row.v;
    precipWin.push(v.precipitation);
    wspdWin.push(v.wind_speed_10m);
    if (precipWin.length > WINDOW) {
      precipWin.shift();
      wspdWin.shift();
    }
    if (precipWin.length < WINDOW) continue;

    const d = toUtc(row.time);
    const hour = d.getUTCHours();
    const doy = dayOfYear(d);
    const wdir = (v.wind_direction_10m * Math.PI) / 180;
    const t2m = v.temperature_2m;
    const t850 = v.temperature_850hPa;
    const blh = v.boundary_layer_height;
    const wspd = v.wind_speed_10m;

    X.push([
      t2m,
      v.relative_humidity_2m,
      v.dew_point_2m,
      v.surface_pressure,
      v.precipitation,
      v.cloud_cover,
      wspd,
      v.wind_gusts_10m,
      Math.sin(wdir),
      Math.cos(wdir),
      blh,
      t850,
      t850 - t2m,
      (blh * wspd) / 1000,
      precipWin.reduce((a, b) => a + b, 0),
      wspdWin.reduce((a, b) => a + b, 0) / WINDOW,
      Math.sin((2 * Math.PI * hour) / 24),
      Math.cos((2 * Math.PI * hour) / 24),
      Math.sin((2 * Math.PI * doy) / 365.25),
      Math.cos((2 * Math.PI * doy) / 365.25),
    ]);
    times.push(row.time);
  }

  return { X, times };
}
