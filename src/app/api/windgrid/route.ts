import { NextResponse } from "next/server";

// Атырау бойынша жел бағыты мен жылдамдығы торы — карта «Жел» қабаты үшін.
// Дереккөз: Open-Meteo (тегін, кілтсіз) — нақты ауа райы моделі.

export const revalidate = 3600;

const LATS = [46.2, 46.7, 47.1, 47.5, 47.9, 48.4];
const LNGS = [49.8, 50.6, 51.4, 51.9, 52.6, 53.4, 54.2];
const points: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) points.push({ lat, lng });

const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=wind_speed_10m,wind_direction_10m&timezone=auto`;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 3600_000) return NextResponse.json(cache.data);
  try {
    const res = await fetch(URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];
    const grid = list.map((d, i) => ({
      lat: points[i].lat,
      lng: points[i].lng,
      speed: d.current?.wind_speed_10m ?? 0,
      dir: d.current?.wind_direction_10m ?? 0, // метеорологиялық: желдің КЕЛЕТІН бағыты (градус)
    }));
    const speeds = grid.map((g) => g.speed);
    const avg = +(speeds.reduce((a, b) => a + b, 0) / (speeds.length || 1)).toFixed(1);
    const max = +Math.max(...speeds).toFixed(1);
    // Басым бағыт (орташа векторлық)
    let sx = 0, sy = 0;
    for (const g of grid) { const r = (g.dir * Math.PI) / 180; sx += Math.sin(r); sy += Math.cos(r); }
    const domDir = Math.round(((Math.atan2(sx, sy) * 180) / Math.PI + 360) % 360);

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (ECMWF) — нақты жел моделі",
      grid, avgSpeed: avg, maxSpeed: max, dominantDir: domDir,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Windgrid error:", err);
    return NextResponse.json({ error: "Жел деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo." }, { status: 503 });
  }
}
