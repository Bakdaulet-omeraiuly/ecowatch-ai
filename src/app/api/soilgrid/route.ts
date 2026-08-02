import { NextResponse } from "next/server";
import { regionPoints } from "@/lib/regionGrid";

// Live soil-dryness / land-degradation stress grid for the Atyrau region.
// Source: Open-Meteo (ECMWF/ERA model) — real root-zone soil moisture, soil
// temperature, recent precipitation. Arid + low-moisture + low-rain = high
// degradation/salinization stress, a documented issue in the Caspian lowland.

export const revalidate = 3600;

const SRC_URL = (points: { lat: number; lng: number }[]) => `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=soil_moisture_9_to_27cm,soil_temperature_18cm,temperature_2m` +
  `&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=auto`;

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

    const grid = list.map((d: {
      latitude: number; longitude: number;
      current?: { soil_moisture_9_to_27cm?: number; soil_temperature_18cm?: number; temperature_2m?: number };
      daily?: { precipitation_sum?: (number | null)[] };
    }) => {
      const sm = d.current?.soil_moisture_9_to_27cm ?? 0.2; // m³/m³
      const soilT = d.current?.soil_temperature_18cm ?? 20;
      const rain30 = (d.daily?.precipitation_sum ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);

      // dryness: low root-zone moisture (healthy ~0.35, dry < 0.15)
      const dryness = Math.max(0, Math.min(1, (0.35 - sm) / 0.3));
      // thermal/evaporative stress (hot soil dries faster)
      const thermal = Math.max(0, Math.min(1, (soilT - 20) / 20));
      // rain deficit over last 30 days (≥60mm = no deficit)
      const rainDeficit = Math.max(0, Math.min(1, (60 - rain30) / 60));

      const stress = Math.round(100 * (0.55 * dryness + 0.2 * thermal + 0.25 * rainDeficit));
      return {
        lat: d.latitude,
        lng: d.longitude,
        soilMoisture: +sm.toFixed(3),
        soilTemp: +soilT.toFixed(1),
        rain30: +rain30.toFixed(1),
        stress,
      };
    });

    const stresses = grid.map((g) => g.stress);
    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (ECMWF) — топырақ ылғалы, температура, жауын-шашын",
      avgStress: Math.round(stresses.reduce((a, b) => a + b, 0) / stresses.length),
      avgMoisture: +(grid.reduce((a, g) => a + g.soilMoisture, 0) / grid.length).toFixed(3),
      grid,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Soil grid error:", err);
    return NextResponse.json({ error: "Тірі топырақ деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
