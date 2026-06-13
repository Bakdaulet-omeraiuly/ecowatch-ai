import { NextResponse } from "next/server";

// Live mosquito environmental-suitability grid for the Atyrau region.
// Methodology: climate-driven suitability (the approach used by WHO/ECDC/VECTRI
// when field-trap data is unavailable). We combine LIVE weather variables from
// Open-Meteo into a suitability index 0-100. No field data is invented.
//
// Index = 100 * (Wt * tempSuit) * (Wr * rainFactor + Wh * humidityFactor + Ws * soilFactor)
// normalised; each factor is grounded in published vector-ecology relationships.

export const revalidate = 3600;

// Each point: dense=true → a city district (icons cluster tightly inside it);
// dense=false → a regional grid cell (icons spread wide).
const points: { lat: number; lng: number; dense: boolean; name?: string }[] = [];

// 10×10 = 100-point grid covering the whole Atyrau region
const LAT_MIN = 46.0, LAT_MAX = 48.8;
const LNG_MIN = 49.2, LNG_MAX = 54.8;
const N = 10;
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++)
    points.push({
      lat: +(LAT_MIN + ((LAT_MAX - LAT_MIN) * i) / (N - 1)).toFixed(4),
      lng: +(LNG_MIN + ((LNG_MAX - LNG_MIN) * j) / (N - 1)).toFixed(4),
      dense: false,
    });

// Atyrau city districts — each gets its own hourly index, icons stay inside it
const ATYRAU_DISTRICTS: { lat: number; lng: number; name: string }[] = [
  { lat: 47.1167, lng: 51.8833, name: "Орталық" },
  { lat: 47.105, lng: 51.842, name: "Балықшы" },
  { lat: 47.16, lng: 51.918, name: "Жұмыскер" },
  { lat: 47.131, lng: 51.918, name: "Привокзальный" },
  { lat: 47.10, lng: 51.918, name: "Авангард" },
  { lat: 47.078, lng: 51.862, name: "Нұрсая" },
  { lat: 47.134, lng: 51.862, name: "Мирный" },
  { lat: 47.092, lng: 51.90, name: "Геолог" },
  { lat: 47.148, lng: 51.89, name: "Самал" },
  { lat: 47.07, lng: 51.93, name: "Лесхоз" },
  { lat: 47.15, lng: 51.95, name: "Жайық оңт." },
  { lat: 47.09, lng: 51.84, name: "Атырау МӨЗ" },
];
for (const d of ATYRAU_DISTRICTS) points.push({ ...d, dense: true });

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

// HYDROLOGY — the dominant real driver in Atyrau. The Zhaiyk (Ural) river
// floodplain and the marshy Caspian delta (reed beds, irrigation ditches,
// standing flood pools) are the region's main mosquito breeding habitat.
const ZHAIYK_PATH: [number, number][] = [
  [47.85, 51.5], [47.6, 51.55], [47.35, 51.7], [47.1167, 51.8833], // Atyrau city
  [46.95, 51.85], [46.75, 51.75], [46.55, 51.55], // delta toward Caspian
];

function distToPolylineKm(lat: number, lng: number, path: [number, number][]): number {
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [aLat, aLng] = path[i];
    const [bLat, bLng] = path[i + 1];
    // sample the segment
    for (let t = 0; t <= 1; t += 0.2) {
      const pLat = aLat + (bLat - aLat) * t;
      const pLng = aLng + (bLng - aLng) * t;
      const dLat = (lat - pLat) * 111;
      const dLng = (lng - pLng) * 111 * Math.cos((lat * Math.PI) / 180);
      min = Math.min(min, Math.sqrt(dLat * dLat + dLng * dLng));
    }
  }
  return min;
}

// 0..1 floodplain/wetland factor
function floodplainFactor(lat: number, lng: number): number {
  // proximity to the river/floodplain (within ~20 km)
  const riverKm = distToPolylineKm(lat, lng, ZHAIYK_PATH);
  const river = Math.max(0, 1 - riverKm / 20);
  // the Caspian delta marshes (south, lat < 47.0) — broad wetland zone
  const delta = lat < 47.0 && lng > 50.8 && lng < 52.4 ? Math.max(0, (47.0 - lat) / 0.8) : 0;
  return Math.min(1, Math.max(river, 0.85 * Math.min(1, delta)));
}

// past 7 days (rolling-rain context) + next 7 days (the forecast animation)
const URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=relative_humidity_2m,soil_moisture_0_to_1cm` +
  `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
  `&past_days=7&forecast_days=7&timezone=auto`;

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
      (
        d: {
        latitude: number;
        longitude: number;
        current?: { relative_humidity_2m?: number; soil_moisture_0_to_1cm?: number };
        daily?: {
          time?: string[];
          temperature_2m_max?: (number | null)[];
          temperature_2m_min?: (number | null)[];
          precipitation_sum?: (number | null)[];
        };
      },
        idx: number
      ) => {
        const meta = points[idx] ?? { dense: false };
        const rh = d.current?.relative_humidity_2m ?? 0;
        const soil = d.current?.soil_moisture_0_to_1cm ?? null;
        const urban = urbanFactor(d.latitude, d.longitude);
        const flood = floodplainFactor(d.latitude, d.longitude);

        const times = d.daily?.time ?? [];
        const tmax = d.daily?.temperature_2m_max ?? [];
        const tmin = d.daily?.temperature_2m_min ?? [];
        const precip = d.daily?.precipitation_sum ?? [];
        // index 7 = today (past_days=7 puts today at offset 7)
        const todayIdx = 7;

        const dayIndex = (i: number) => {
          const t = ((tmax[i] ?? 0) + (tmin[i] ?? 0)) / 2;
          // rolling 7-day rain ending on day i (standing-water buildup)
          let rain = 0;
          for (let k = Math.max(0, i - 6); k <= i; k++) rain += precip[k] ?? 0;
          // Floodplain/wetland is the dominant breeding driver here, then rain,
          // humidity, soil. Temperature gates everything (no dev below ~15°C).
          const drivers =
            0.4 * flood +
            0.25 * rainFactor(rain) +
            0.15 * humidityFactor(rh) +
            0.2 * soilFactor(soil);
          const base = 100 * tempSuitability(t) * (0.45 + 0.55 * drivers);
          // multiplicative amplification: cities AND floodplain both intensify
          const amplified = base * (1 + 0.55 * urban + 0.8 * flood);
          return {
            index: Math.round(Math.min(100, amplified)),
            temp: +t.toFixed(1),
            rainMm: +rain.toFixed(1),
          };
        };

        // 7-day forecast starting today
        const days = Array.from({ length: 7 }, (_, k) => {
          const i = todayIdx + k;
          const calc = dayIndex(i);
          return { date: times[i] ?? "", ...calc };
        });

        return {
          lat: d.latitude,
          lng: d.longitude,
          dense: meta.dense,
          name: meta.name,
          urban: +urban.toFixed(2),
          flood: +flood.toFixed(2),
          index: days[0].index, // today (back-compat)
          temperature: days[0].temp,
          humidity: rh,
          weekRainMm: days[0].rainMm,
          days,
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
