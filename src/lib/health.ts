// P5.2 / P5.3 — aggregated official health statistics (no individual records).
// Source snapshot: src/data/health/atyrau-mortality.json (scripts/fetch-taldau-health.mjs).
// NOTE: this is MORTALITY by cause of death, not morbidity (case counts): the Ministry of
// Health morbidity tables are published only as PDF compendia, not as open data.
import snapshot from "@/data/health/atyrau-mortality.json";

export type Cause = "respiratory" | "circulatory" | "all";
export type AreaId = "atyrau_city" | "atyrau_oblast";

export interface RateRow { year: number; deaths: number; population: number; per100k: number }

/** Deaths per 100 000 average annual population — the formula, documented once. */
export function per100k(deaths: number, population: number): number {
  if (!(population > 0)) throw new Error("population must be > 0");
  return +((deaths / population) * 100_000).toFixed(1);
}

export function rateSeries(area: AreaId, cause: Cause): RateRow[] {
  const a = snapshot.areas[area];
  const deaths = a.deaths[cause] as Record<string, number>;
  const pop = a.population as Record<string, number>;
  return Object.keys(pop).filter((y) => deaths[y] != null).map(Number).sort()
    .map((year) => ({ year, deaths: deaths[year], population: pop[year], per100k: per100k(deaths[year], pop[year]) }));
}

export function countSeries(area: AreaId, cause: Cause): { year: number; deaths: number }[] {
  const deaths = snapshot.areas[area].deaths[cause] as Record<string, number>;
  return Object.entries(deaths).map(([y, d]) => ({ year: Number(y), deaths: d })).sort((a, b) => a.year - b.year);
}

export const HEALTH_SOURCE = {
  source: snapshot.source, fetchedAt: snapshot.fetchedAt, indicators: snapshot.indicators,
};

/** Project rule (not a statistical law): below this many paired years no r is shown. */
export const MIN_CORRELATION_N = 8;

export type Correlation =
  | { ok: true; n: number; r: number; ci95: [number, number]; note: string }
  | { ok: false; n: number; reason: string };

/** Pearson r with a Fisher-z 95 % CI. Correlation only — never evidence of cause. */
export function correlate(pairs: [number, number][]): Correlation {
  const n = pairs.length;
  if (n < MIN_CORRELATION_N) {
    return { ok: false, n, reason: `n=${n} < ${MIN_CORRELATION_N}: дерек жеткіліксіз — корреляция есептелмейді` };
  }
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
  if (sxx === 0 || syy === 0) return { ok: false, n, reason: "бір қатар тұрақты — корреляция анықталмайды" };
  const r = sxy / Math.sqrt(sxx * syy);
  const z = Math.atanh(Math.min(0.999999, Math.max(-0.999999, r)));
  const se = 1 / Math.sqrt(n - 3);
  const ci95: [number, number] = [+Math.tanh(z - 1.96 * se).toFixed(3), +Math.tanh(z + 1.96 * se).toFixed(3)];
  return { ok: true, n, r: +r.toFixed(3), ci95, note: "корреляция, себеп-салдар емес" };
}
