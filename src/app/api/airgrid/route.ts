import { NextResponse } from "next/server";

// Live air-quality grid across Atyrau region for the map's air layer.
// Source: Open-Meteo Air Quality API (Copernicus CAMS) — real model data,
// one multi-location request. Refreshed hourly.

export const revalidate = 3600;

const LATS = [46.2, 46.8, 47.4, 48.0, 48.6];
const LNGS = [49.6, 50.6, 51.6, 52.6, 53.6, 54.6];

const points: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) points.push({ lat, lng });

const URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=european_aqi,pm2_5,pm10`;

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
    const grid = list.map((d: { latitude: number; longitude: number; current?: { european_aqi?: number; pm2_5?: number; pm10?: number } }) => ({
      lat: d.latitude,
      lng: d.longitude,
      aqi: d.current?.european_aqi ?? null,
      pm2_5: d.current?.pm2_5 ?? null,
      pm10: d.current?.pm10 ?? null,
    }));
    const data = { fetchedAt: new Date().toISOString(), source: "Open-Meteo / Copernicus CAMS", grid };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Air grid error:", err);
    return NextResponse.json({ error: "Тірі ауа деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
