import { NextResponse } from "next/server";

// Live mosquito environmental-suitability grid for the Atyrau region.
// Methodology: climate-driven suitability (the approach used by WHO/ECDC/VECTRI
// when field-trap data is unavailable). We combine LIVE weather variables from
// Open-Meteo into a suitability index 0-100. No field data is invented.
//
// Index = 100 * (Wt * tempSuit) * (Wr * rainFactor + Wh * humidityFactor + Ws * soilFactor)
// normalised; each factor is grounded in published vector-ecology relationships.

export const revalidate = 3600;

// 10×10 = 100-point grid covering the Atyrau region
const LAT_MIN = 46.0, LAT_MAX = 48.8;
const LNG_MIN = 49.2, LNG_MAX = 54.8;
const N = 10;
const points: { lat: number; lng: number }[] = [];
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++)
    points.push({
      lat: +(LAT_MIN + ((LAT_MAX - LAT_MIN) * i) / (N - 1)).toFixed(4),
      lng: +(LNG_MIN + ((LNG_MAX - LNG_MIN) * j) / (N - 1)).toFixed(4),
    });

// Settlements: cities concentrate breeding habitat (containers, tires, drains,
// irrigation) independent of rainfall — a documented urban amplification of
// mosquito density. Stored with a weight (bigger town = stronger boost).
const SETTLEMENTS: { lat: number; lng: number; w: number }[] = [
  { lat: 47.1167, lng: 51.8833, w: 1.0 }, // Atyrau city (largest)
  { lat: 46.98, lng: 54.02, w: 0.6 }, // Kulsary
  { lat: 47.65, lng: 53.31, w: 0.4 }, // Makat
  { lat: 47.53, lng: 52.98, w: 0.35 }, // Dossor
  { lat: 48.55, lng: 51.78, w: 0.4 }, // Inderbor
  { lat: 47.67, lng: 51.58, w: 0.35 }, // Makhambet
  { lat: 46.6, lng: 49.27, w: 0.3 }, // Ganyushkino
  { lat: 47.0, lng: 51.18, w: 0.3 }, // Akkystau
];

// 0..1 urban factor: peaks at a settlement centre, fades out ~25 km
function urbanFactor(lat: number, lng: number): number {
  let max = 0;
  for (const s of SETTLEMENTS) {
    const dLat = (lat - s.lat) * 111;
    const dLng = (lng - s.lng) * 111 * Math.cos((lat * Math.PI) / 180);
    const distKm = Math.sqrt(dLat * dLat + dLng * dLng);
    max = Math.max(max, s.w * Math.max(0, 1 - distKm / 35));
  }
  return max;
}

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
        // breeding/survival drivers (weighted): rain 0.40, humidity 0.25, soil 0.20, urban 0.15
        const urban = urbanFactor(d.latitude, d.longitude);
        const drivers =
          0.4 * rainFactor(weekRain) + 0.25 * humidityFactor(rh) + 0.2 * soilFactor(soil) + 0.15 * urban;
        // base climate suitability, then an extra urban amplification on top
        const base = 100 * tSuit * (0.35 + 0.65 * drivers);
        const index = Math.round(Math.min(100, base * (1 + 0.8 * urban)));

        return {
          lat: d.latitude,
          lng: d.longitude,
          index,
          temperature: t,
          humidity: rh,
          weekRainMm: +weekRain.toFixed(1),
          urban: +urban.toFixed(2),
        };
      }
    );

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (live weather) · Mordecai 2017 thermal suitability + urban amplification",
      grid,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Mosquito grid error:", err);
    return NextResponse.json({ error: "Тірі ауа райы деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
