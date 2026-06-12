import { NextResponse } from "next/server";

// Live environmental data for Atyrau from Open-Meteo (free, no key).
// Weather: official Open-Meteo forecast model.
// Air quality: Copernicus CAMS (EU's official atmosphere monitoring service).
// NO mock data — if the upstream fails, we return an error and the UI says so.

export const revalidate = 3600; // refresh hourly

const LAT = 47.1167;
const LNG = 51.8833; // Atyrau city

const WEATHER_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
  `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,surface_pressure` +
  `&timezone=auto`;

const AIR_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LNG}` +
  `&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,dust,european_aqi` +
  `&hourly=pm2_5,pm10&past_days=30&forecast_days=1&timezone=auto`;

interface DailyPoint {
  date: string;
  pm2_5: number;
  pm10: number;
}

// Aggregate hourly arrays into daily means
function dailyMeans(time: string[], pm25: (number | null)[], pm10: (number | null)[]): DailyPoint[] {
  const byDay = new Map<string, { p25: number[]; p10: number[] }>();
  time.forEach((t, i) => {
    const day = t.slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, { p25: [], p10: [] });
    const bucket = byDay.get(day)!;
    if (pm25[i] != null) bucket.p25.push(pm25[i]!);
    if (pm10[i] != null) bucket.p10.push(pm10[i]!);
  });
  const mean = (a: number[]) => (a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : 0);
  return [...byDay.entries()]
    .map(([date, b]) => ({ date, pm2_5: mean(b.p25), pm10: mean(b.p10) }))
    .filter((d) => d.pm2_5 > 0 || d.pm10 > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const [wRes, aRes] = await Promise.all([
      fetch(WEATHER_URL, { next: { revalidate: 3600 } }),
      fetch(AIR_URL, { next: { revalidate: 3600 } }),
    ]);
    if (!wRes.ok || !aRes.ok) throw new Error(`upstream ${wRes.status}/${aRes.status}`);
    const weather = await wRes.json();
    const air = await aRes.json();

    const data = {
      fetchedAt: new Date().toISOString(),
      sources: {
        weather: "Open-Meteo (open-meteo.com)",
        air: "Copernicus CAMS — Open-Meteo Air Quality API",
      },
      current: {
        temperature: weather.current?.temperature_2m ?? null,
        humidity: weather.current?.relative_humidity_2m ?? null,
        windSpeed: weather.current?.wind_speed_10m ?? null,
        pressure: weather.current?.surface_pressure ?? null,
        pm2_5: air.current?.pm2_5 ?? null,
        pm10: air.current?.pm10 ?? null,
        no2: air.current?.nitrogen_dioxide ?? null,
        so2: air.current?.sulphur_dioxide ?? null,
        ozone: air.current?.ozone ?? null,
        dust: air.current?.dust ?? null,
        europeanAqi: air.current?.european_aqi ?? null,
      },
      daily: dailyMeans(air.hourly?.time ?? [], air.hourly?.pm2_5 ?? [], air.hourly?.pm10 ?? []),
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Environment fetch error:", err);
    return NextResponse.json(
      { error: "Тірі деректер уақытша қолжетімсіз. Дереккөз: Open-Meteo." },
      { status: 503 }
    );
  }
}
