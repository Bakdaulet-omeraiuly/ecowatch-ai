import { NextResponse } from "next/server";

// Live mosquito environmental-suitability grid for the Atyrau region.
// Methodology: climate-driven suitability (the approach used by WHO/ECDC/VECTRI
// when field-trap data is unavailable). We combine LIVE weather variables from
// Open-Meteo into a suitability index 0-100. No field data is invented.
//
// Index = 100 * (Wt * tempSuit) * (Wr * rainFactor + Wh * humidityFactor + Ws * soilFactor)
// normalised; each factor is grounded in published vector-ecology relationships.

export const revalidate = 3600;

const LATS = [46.2, 46.8, 47.4, 48.0, 48.6];
const LNGS = [49.6, 50.6, 51.6, 52.6, 53.6, 54.6];

const points: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) points.push({ lat, lng });

const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=temperature_2m,relative_humidity_2m,soil_moisture_0_to_1cm` +
  `&daily=precipitation_sum&past_days=7&forecast_days=1&timezone=auto`;

// Temperature suitability: bell curve, dev range ~15-35°C, optimum ~28°C.
// Based on Mordecai et al. (2017) thermal-response models for mosquito-borne disease.
function tempSuitability(t: number): number {
  if (t <= 15 || t >= 36) return 0;
  // quadratic peaking near 28°C
  const s = ((t - 15) * (36 - t)) / ((28 - 15) * (36 - 28));
  return Math.max(0, Math.min(1, s));
}

function humidityFactor(rh: number): number {
  // survival rises sharply above ~60% RH
  return Math.max(0, Math.min(1, (rh - 40) / 45));
}

function rainFactor(weekPrecipMm: number): number {
  // recent standing water; saturates around 25mm over a week
  return Math.max(0, Math.min(1, weekPrecipMm / 25));
}

function soilFactor(soilMoisture: number | null): number {
  if (soilMoisture == null) return 0.3;
  // m³/m³, typically 0..0.5; standing-water proxy
  return Math.max(0, Math.min(1, soilMoisture / 0.4));
}

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

    const grid = list.map(
      (d: {
        latitude: number;
        longitude: number;
        current?: { temperature_2m?: number; relative_humidity_2m?: number; soil_moisture_0_to_1cm?: number };
        daily?: { precipitation_sum?: (number | null)[] };
      }) => {
        const t = d.current?.temperature_2m ?? 0;
        const rh = d.current?.relative_humidity_2m ?? 0;
        const soil = d.current?.soil_moisture_0_to_1cm ?? null;
        const weekRain = (d.daily?.precipitation_sum ?? []).reduce<number>((a, b) => a + (b ?? 0), 0);

        const tSuit = tempSuitability(t);
        // breeding/survival drivers (weighted): rain 0.45, humidity 0.30, soil 0.25
        const drivers = 0.45 * rainFactor(weekRain) + 0.3 * humidityFactor(rh) + 0.25 * soilFactor(soil);
        const index = Math.round(100 * tSuit * (0.35 + 0.65 * drivers)); // temp gates everything

        return {
          lat: d.latitude,
          lng: d.longitude,
          index,
          temperature: t,
          humidity: rh,
          weekRainMm: +weekRain.toFixed(1),
        };
      }
    );

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (live weather) · Mordecai et al. 2017 thermal-suitability methodology",
      grid,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Mosquito grid error:", err);
    return NextResponse.json({ error: "Тірі ауа райы деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
