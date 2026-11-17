import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import {
  aggregateBuckets, BUCKETS, DATA_START, facilityBearings, fetchChunks, latestDate, MIN_COVERAGE,
  normLines, POLLUTANTS, resolveRange, windSectors, CALM_MS, MIN_SECTOR_HOURS,
  type Bucket, type HourRow, type PollutantKey,
} from "@/lib/sourceAnalytics";

// ЛАСТАНУ КӨЗІ АНАЛИТИКАСЫ — кезең бойынша концентрация және жел румбы.
//
// `?pollutant=so2|no2|pm25|pm10|co|o3&bucket=hour|day|month|year&from=YYYY-MM-DD&to=YYYY-MM-DD`
//
// Дерек: CAMS Global (Open-Meteo Air Quality API) — қала нүктесіндегі сағаттық
// концентрация; жел — ERA5 реанализі (Open-Meteo архиві). Екеуі де МОДЕЛЬ.
// Есептеу — src/lib/sourceAnalytics.ts. Дереккөз жауап бермесе — 503, мок жоқ.

export const dynamic = "force-dynamic";

const TZ = "Asia%2FAtyrau";
const DAY = 86400;

type Hourly = { time?: string[] } & Record<string, (number | null)[] | string[] | undefined>;

async function getHourly(url: string, revalidate: number): Promise<Hourly> {
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const j = (await res.json()) as { hourly?: Hourly };
  if (!j.hourly?.time?.length) throw new Error("бос жауап");
  return j.hourly;
}

const cache = new Map<string, { at: number; body: unknown }>();
const CACHE_MS = 6 * 3600_000;

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const pollutant = q.get("pollutant") as PollutantKey | null;
  const bucket = q.get("bucket") as Bucket | null;
  if (!pollutant || !(pollutant in POLLUTANTS)) return fail(`pollutant көрсетіңіз: ${Object.keys(POLLUTANTS).join(" | ")}`, 400);
  if (!bucket || !BUCKETS.includes(bucket)) return fail(`bucket көрсетіңіз: ${BUCKETS.join(" | ")}`, 400);
  const range = resolveRange(q.get("from"), q.get("to"), bucket);
  if (!range.ok) return fail(range.error, 400);

  const region = getRegion("atyrau");
  const key = `${pollutant}|${bucket}|${range.from}|${range.to}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  const p = POLLUTANTS[pollutant];
  try {
    const chunks = fetchChunks(range.from, range.to, bucket);
    const parts = await Promise.all(chunks.map(async (c) => {
      const loc = `latitude=${region.lat}&longitude=${region.lng}&start_date=${c.start}&end_date=${c.end}&timezone=${TZ}`;
      const ttl = c.complete ? 30 * DAY : DAY;
      const [air, wind] = await Promise.all([
        getHourly(`https://air-quality-api.open-meteo.com/v1/air-quality?${loc}&hourly=${p.api}`, ttl),
        getHourly(`https://archive-api.open-meteo.com/v1/archive?${loc}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`, ttl),
      ]);
      const wIdx = new Map((wind.time ?? []).map((t, i) => [t, i]));
      const ws = (wind.wind_speed_10m ?? []) as (number | null)[];
      const wd = (wind.wind_direction_10m ?? []) as (number | null)[];
      const vals = (air[p.api] ?? []) as (number | null)[];
      return (air.time ?? []).map((time, i): HourRow => {
        const w = wIdx.get(time);
        return { time, value: vals[i] ?? null, windFrom: w == null ? null : wd[w] ?? null, windSpeed: w == null ? null : ws[w] ?? null };
      });
    }));
    // Жыл бойынша сұралған бөліктер таңдалған кезеңге қиылады
    const rows = parts.flat().filter((r) => r.time.slice(0, 10) >= range.from && r.time.slice(0, 10) <= range.to);
    const withValue = rows.filter((r) => r.value != null).length;
    if (!withValue) return fail("Таңдалған кезеңде модель мәні жоқ — жалған дерек көрсетілмейді", 503);

    const buckets = aggregateBuckets(rows, bucket);
    const wind = windSectors(rows);
    const body = {
      fetchedAt: new Date().toISOString(),
      region: { id: region.id, name: region.name, lat: region.lat, lng: region.lng },
      pollutant, pollutantLabel: p.label, unit: "µg/m³",
      bucket,
      range: { from: range.from, to: range.to, clipped: range.clipped, dataStart: DATA_START, dataEnd: latestDate() },
      hours: { total: rows.length, withValue },
      minCoverage: MIN_COVERAGE[bucket],
      buckets,
      norms: normLines(pollutant, bucket, buckets),
      wind: { ...wind, calmBelowMs: CALM_MS, minSectorHours: MIN_SECTOR_HOURS },
      facilities: facilityBearings(region.lat, region.lng),
      tier: "model" as const,
      sources: ["Copernicus CAMS Global (Open-Meteo Air Quality API)", "ECMWF ERA5 реанализі (Open-Meteo архиві)"],
      aiIncluded: false,
    };
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (err) {
    console.error("source-analytics error:", err);
    return fail("Архив деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді. Дереккөз: Open-Meteo (CAMS, ERA5).", 503);
  }
}
