import { NextResponse } from "next/server";
import { dominantPollutant } from "@/lib/pollutant";

// Live air-quality grid across Atyrau region for the map's air layer.
// Source: Open-Meteo Air Quality API (Copernicus CAMS) — real model data.
// Adds: full pollutant components, 24h hourly forecast, city districts.

export const revalidate = 3600;

// Regional 5×6 grid
const LATS = [46.2, 46.8, 47.4, 48.0, 48.6];
const LNGS = [49.6, 50.6, 51.6, 52.6, 53.6, 54.6];
const points: { lat: number; lng: number; dense: boolean; name?: string }[] = [];
for (const lat of LATS) for (const lng of LNGS) points.push({ lat, lng, dense: false });

// Atyrau city districts (denser sampling over the city)
const DISTRICTS: { lat: number; lng: number; name: string }[] = [
  { lat: 47.1167, lng: 51.8833, name: "Орталық" },
  { lat: 47.105, lng: 51.842, name: "Балықшы" },
  { lat: 47.16, lng: 51.918, name: "Жұмыскер" },
  { lat: 47.10, lng: 51.918, name: "Авангард" },
  { lat: 47.078, lng: 51.862, name: "Нұрсая" },
  { lat: 47.09, lng: 51.84, name: "МӨЗ маңы" },
  { lat: 47.148, lng: 51.89, name: "Самал" },
  { lat: 47.07, lng: 51.93, name: "Лесхоз" },
];
for (const d of DISTRICTS) points.push({ ...d, dense: true });

const URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,ozone,dust` +
  `&hourly=european_aqi&forecast_days=2&timezone=auto`;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 3600 } });
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
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Air grid error:", err);
    return NextResponse.json({ error: "Тірі ауа деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
