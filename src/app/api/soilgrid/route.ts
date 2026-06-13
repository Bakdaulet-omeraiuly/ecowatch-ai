import { NextResponse } from "next/server";

// Live soil-dryness / land-degradation stress grid for the Atyrau region.
// Source: Open-Meteo (ECMWF/ERA model) — real root-zone soil moisture, soil
// temperature, recent precipitation. Arid + low-moisture + low-rain = high
// degradation/salinization stress, a documented issue in the Caspian lowland.

export const revalidate = 3600;

const LATS = [46.2, 46.8, 47.4, 48.0, 48.6];
const LNGS = [49.6, 50.6, 51.6, 52.6, 53.6, 54.6];
const points: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) points.push({ lat, lng });

const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=soil_moisture_9_to_27cm,soil_temperature_18cm,temperature_2m` +
  `&daily=precipitation_sum&past_days=30&forecast_days=1&timezone=auto`;

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
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Soil grid error:", err);
    return NextResponse.json({ error: "Тірі топырақ деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
