import { NextResponse } from "next/server";
import { regionPoints } from "@/lib/regionGrid";
import { dominantPollutant } from "@/lib/pollutant";

// Таңдалған аймақ бойынша тірі ауа сапасы торы — картаның «Ауа» қабаты үшін.
// Тор аймақтың bbox-ынан құрылады (src/lib/regionGrid.ts), сондықтан қала
// ауысқанда деректер де сол қаланікі болады.
// Source: Open-Meteo Air Quality API (Copernicus CAMS) — real model data.
// Adds: full pollutant components, 24h hourly forecast, city districts.

export const revalidate = 3600;

const SRC_URL = (points: { lat: number; lng: number }[]) => `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,dust,methane,carbon_monoxide,ammonia,aerosol_optical_depth,uv_index` +
  `&hourly=european_aqi&forecast_days=2&timezone=auto`;

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const { region, points } = regionPoints(new URL(req.url).searchParams.get("region"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);
  try {
    const res = await fetch(SRC_URL(points), { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];

    const nowMs = Date.now();
    const grid = list.map(
      (
        d: {
          latitude: number;
          longitude: number;
          current?: {
            european_aqi?: number; pm2_5?: number; pm10?: number;
            nitrogen_dioxide?: number; sulphur_dioxide?: number; ozone?: number; dust?: number;
            methane?: number; carbon_monoxide?: number;
            ammonia?: number; aerosol_optical_depth?: number; uv_index?: number;
          };
          hourly?: { time?: string[]; european_aqi?: (number | null)[] };
        },
        idx: number
      ) => {
        const meta = points[idx] ?? { dense: false };
        // next 24 hourly AQI values from now
        const times = d.hourly?.time ?? [];
        const aqiH = d.hourly?.european_aqi ?? [];
        const hourly: { time: string; aqi: number | null }[] = [];
        for (let i = 0; i < times.length && hourly.length < 24; i++) {
          if (new Date(times[i]).getTime() >= nowMs - 3600_000) {
            hourly.push({ time: times[i], aqi: aqiH[i] ?? null });
          }
        }
        return {
          lat: d.latitude,
          lng: d.longitude,
          dense: meta.dense,
          name: meta.name,
          aqi: d.current?.european_aqi ?? null,
          pm2_5: d.current?.pm2_5 ?? null,
          pm10: d.current?.pm10 ?? null,
          no2: d.current?.nitrogen_dioxide ?? null,
          so2: d.current?.sulphur_dioxide ?? null,
          ozone: d.current?.ozone ?? null,
          dust: d.current?.dust ?? null,
          ch4: d.current?.methane ?? null,
          co: d.current?.carbon_monoxide ?? null,
          nh3: d.current?.ammonia ?? null,
          aod: d.current?.aerosol_optical_depth ?? null,
          uv: d.current?.uv_index ?? null,
          hourly,
        };
      }
    );

    // Region-average dominant pollutant
    const avg = (k: "pm2_5" | "pm10" | "no2" | "so2" | "ozone" | "dust") => {
      const vals = grid.map((g) => g[k]).filter((v): v is number => v != null);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const dominant = dominantPollutant({
      pm2_5: avg("pm2_5"), pm10: avg("pm10"), no2: avg("no2"),
      so2: avg("so2"), ozone: avg("ozone"), dust: avg("dust"),
    });

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo / Copernicus CAMS",
      dominant,
      grid,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Air grid error:", err);
    return NextResponse.json({ error: "Тірі ауа деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
