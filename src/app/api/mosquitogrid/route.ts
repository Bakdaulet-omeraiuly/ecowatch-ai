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

// 5×5 = 25-нүктелі тор (облыс деңгейі) — Open-Meteo 100 лимитіне сыйдыру үшін
// Қалған 75 слот → қала аудандары мен көшелері
const LAT_MIN = 46.0, LAT_MAX = 48.8;
const LNG_MIN = 49.2, LNG_MAX = 54.8;
const N = 5;
for (let i = 0; i < N; i++)
  for (let j = 0; j < N; j++)
    points.push({
      lat: +(LAT_MIN + ((LAT_MAX - LAT_MIN) * i) / (N - 1)).toFixed(4),
      lng: +(LNG_MIN + ((LNG_MAX - LNG_MIN) * j) / (N - 1)).toFixed(4),
      dense: false,
    });

// Атырау қаласының аудандары, көшелері, нақты нүктелері
const ATYRAU_DISTRICTS: { lat: number; lng: number; name: string }[] = [
  // ── Орталық аудан ──
  { lat: 47.1167, lng: 51.8833, name: "Орталық алаң" },
  { lat: 47.1130, lng: 51.8860, name: "Әзіз Мамбетов к." },
  { lat: 47.1155, lng: 51.8910, name: "Сатпаев к." },
  { lat: 47.1175, lng: 51.8780, name: "Махамбет к." },
  { lat: 47.1195, lng: 51.8850, name: "Абай даңғылы" },
  { lat: 47.1100, lng: 51.8800, name: "Молдағали к." },
  { lat: 47.1215, lng: 51.8920, name: "Аймауытов к." },
  { lat: 47.1085, lng: 51.8845, name: "Орталық базар" },

  // ── Жайық өзені жағасы — маса тәуекелі ең жоғары ──
  { lat: 47.1220, lng: 51.8730, name: "Жайық сол жағасы-1" },
  { lat: 47.1150, lng: 51.8750, name: "Жайық сол жағасы-2" },
  { lat: 47.1080, lng: 51.8770, name: "Жайық сол жағасы-3" },
  { lat: 47.1250, lng: 51.8790, name: "Жайық оң жағасы-1" },
  { lat: 47.1180, lng: 51.8800, name: "Жайық оң жағасы-2" },
  { lat: 47.1100, lng: 51.8820, name: "Жайық оң жағасы-3" },
  { lat: 47.1350, lng: 51.8820, name: "Жоғарғы көпір" },
  { lat: 47.1050, lng: 51.8860, name: "Төменгі көпір" },
  { lat: 47.0980, lng: 51.8920, name: "Өзен дельтасы-1" },
  { lat: 47.0920, lng: 51.8960, name: "Өзен дельтасы-2" },

  // ── Балықшы ──
  { lat: 47.1050, lng: 51.8420, name: "Балықшы орт." },
  { lat: 47.1000, lng: 51.8380, name: "Балықшы батыс" },
  { lat: 47.1080, lng: 51.8460, name: "Балықшы шығыс" },
  { lat: 47.0980, lng: 51.8440, name: "Балықшы оңт." },

  // ── Жұмыскер / Привокзальный ──
  { lat: 47.1600, lng: 51.9180, name: "Жұмыскер" },
  { lat: 47.1560, lng: 51.9100, name: "Жұмыскер батыс" },
  { lat: 47.1310, lng: 51.9180, name: "Привокзальный" },
  { lat: 47.1270, lng: 51.9240, name: "Вокзал маңы" },
  { lat: 47.1350, lng: 51.9050, name: "Студенттік аудан" },

  // ── Авангард / Геолог ──
  { lat: 47.1000, lng: 51.9180, name: "Авангард" },
  { lat: 47.0950, lng: 51.9140, name: "Авангард оңт." },
  { lat: 47.0920, lng: 51.9000, name: "Геолог" },
  { lat: 47.0880, lng: 51.9060, name: "Геолог оңт." },

  // ── Нұрсая / Мирный ──
  { lat: 47.0780, lng: 51.8620, name: "Нұрсая" },
  { lat: 47.0740, lng: 51.8660, name: "Нұрсая оңт." },
  { lat: 47.1340, lng: 51.8620, name: "Мирный" },
  { lat: 47.1380, lng: 51.8680, name: "Мирный шығыс" },

  // ── Самал ──
  { lat: 47.1480, lng: 51.8900, name: "Самал-1" },
  { lat: 47.1450, lng: 51.8960, name: "Самал-2" },
  { lat: 47.1420, lng: 51.9020, name: "Самал-3" },

  // ── Лесхоз / Жайық оңтүстік ──
  { lat: 47.0700, lng: 51.9300, name: "Лесхоз" },
  { lat: 47.0650, lng: 51.9380, name: "Лесхоз оңт." },
  { lat: 47.1500, lng: 51.9500, name: "Жайық оңт.-1" },
  { lat: 47.1460, lng: 51.9580, name: "Жайық оңт.-2" },

  // ── МӨЗ / Батыс ──
  { lat: 47.0900, lng: 51.8400, name: "Атырау МӨЗ" },
  { lat: 47.0950, lng: 51.8320, name: "МӨЗ маңы" },
  { lat: 47.1200, lng: 51.8200, name: "Батыс аудан" },
  { lat: 47.1050, lng: 51.8080, name: "Батыс-2" },
  { lat: 47.1380, lng: 51.8300, name: "Батыс-3" },

  // ── Солтүстік аудан ──
  { lat: 47.1680, lng: 51.8750, name: "Солтүстік-1" },
  { lat: 47.1750, lng: 51.8900, name: "Солтүстік-2" },
  { lat: 47.1800, lng: 51.8550, name: "Нұрқала" },
  { lat: 47.1620, lng: 51.8550, name: "Жаңа қала" },
  { lat: 47.1720, lng: 51.9100, name: "Солтүстік шығыс" },

  // ── Оңтүстік аудан ──
  { lat: 47.0620, lng: 51.8750, name: "Оңтүстік-1" },
  { lat: 47.0550, lng: 51.9000, name: "Оңтүстік-2" },
  { lat: 47.0680, lng: 51.8500, name: "Теміржол маңы" },
  { lat: 47.0600, lng: 51.9150, name: "Оңтүстік шығыс" },

  // ── Шығыс аудан ──
  { lat: 47.1180, lng: 51.9450, name: "Шығыс-1" },
  { lat: 47.1020, lng: 51.9600, name: "Шығыс-2" },
  { lat: 47.1400, lng: 51.9520, name: "Достық" },
  { lat: 47.1250, lng: 51.9350, name: "Алтын орда" },
  { lat: 47.1100, lng: 51.9700, name: "Шығыс-3" },

  // ── Жаңа нұр / т.б. ──
  { lat: 47.0820, lng: 51.9100, name: "Жаңа нұр" },
  { lat: 47.1430, lng: 51.9050, name: "Жаңа аудан" },
  { lat: 47.1580, lng: 51.8600, name: "Орталық солт." },
  { lat: 47.1000, lng: 51.8700, name: "Орталық оңт." },
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
  `&hourly=temperature_2m,relative_humidity_2m,precipitation,soil_moisture_0_to_1cm` +
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

// ── JAIYQ-MRI · FPEB ядросы (Flood-Pulse Egg-Bank, қос түр) ──────────────────
// Тасқын-импульс жұмыртқа банкін жарады → дернәсіл → ересек. Aedes caspius
// (тасқын-су) мен Culex modestus (тұрақты-су) бөлек, айлық динамикалық салмақпен.
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// Жұмыртқа банкі дайындығы (Aedes floodwater фенологиясы: мамырдан шыңы)
const EGG_READY = [0.05, 0.05, 0.12, 0.45, 0.9, 1.0, 0.95, 0.8, 0.5, 0.2, 0.07, 0.05];
// Динамикалық салмақ: көктем → Aedes (су), жаз ортасы → Culex (WNV)
const AEDES_W = [0.2, 0.2, 0.4, 0.85, 0.9, 0.85, 0.7, 0.5, 0.4, 0.3, 0.2, 0.2];
const CULEX_W = [0.1, 0.1, 0.15, 0.3, 0.5, 0.7, 0.9, 0.95, 0.7, 0.4, 0.15, 0.1];

function fpebIndex(o: {
  t: number; rh: number; soil: number | null; rain: number;
  flood: number; urban: number; month: number;
}): number {
  const phiT = tempSuitability(o.t); // температура гейті (Mordecai)
  if (phiT <= 0) return 0;
  const egg = EGG_READY[o.month];
  const hatch = clamp01(0.5 * o.flood + 0.3 * soilFactor(o.soil) + 0.2 * rainFactor(o.rain)); // тасқын-импульс
  const hydro = clamp01(0.6 * soilFactor(o.soil) + 0.4 * o.flood); // гидропериод (тірі қалу)
  const aedes = egg * hatch * hydro; // тасқын-су Aedes ересек индексі
  const culex = clamp01(0.5 * o.flood + 0.5 * o.urban) * humidityFactor(o.rh); // тұрақты-су Culex
  const species = clamp01(AEDES_W[o.month] * aedes + CULEX_W[o.month] * culex);
  const amplified = 100 * phiT * (0.15 + 0.85 * species) * (1 + 0.4 * o.urban + 0.5 * o.flood);
  return Math.round(Math.min(100, amplified));
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
    const month = new Date().getMonth(); // FPEB айлық фенология салмағы үшін

    const grid = list.map(
      (
        d: {
        latitude: number;
        longitude: number;
        current?: { relative_humidity_2m?: number; soil_moisture_0_to_1cm?: number };
        hourly?: {
          time?: string[];
          temperature_2m?: (number | null)[];
          relative_humidity_2m?: (number | null)[];
          precipitation?: (number | null)[];
          soil_moisture_0_to_1cm?: (number | null)[];
        };
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
          return {
            index: fpebIndex({ t, rh, soil, rain, flood, urban, month }),
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

        // САҒАТТЫҚ индекс — бүгінгі 24 сағат (past_days=7 → бүгін 00:00 = offset 168).
        // Температура тәуліктік ырғағы (түн салқын+ылғал → жоғары) иконка шоғырын
        // сағат сайын жылжытады. Жаңбыр/тасқын/қала — тұрақты контекст.
        const hTime = d.hourly?.time ?? [];
        const hTemp = d.hourly?.temperature_2m ?? [];
        const hRh = d.hourly?.relative_humidity_2m ?? [];
        const hSoil = d.hourly?.soil_moisture_0_to_1cm ?? [];
        const HSTART = 7 * 24; // бүгін 00:00
        const dayRain = days[0].rainMm;
        const hours = Array.from({ length: 24 }, (_, h) => {
          const i = HSTART + h;
          const t = hTemp[i] ?? days[0].temp;
          const hrh = hRh[i] ?? rh;
          const hsoil = hSoil[i] ?? soil;
          return {
            time: hTime[i] ?? "",
            index: fpebIndex({ t, rh: hrh, soil: hsoil, rain: dayRain, flood, urban, month }),
            temp: +t.toFixed(1),
          };
        });

        return {
          lat: meta.lat ?? d.latitude,   // нақты координата (Open-Meteo snap емес)
          lng: meta.lng ?? d.longitude,
          dense: meta.dense,
          name: meta.name,
          urban: +urban.toFixed(2),
          flood: +flood.toFixed(2),
          index: days[0].index, // today (back-compat)
          temperature: days[0].temp,
          humidity: rh,
          weekRainMm: days[0].rainMm,
          days,
          hours,
        };
      }
    );

    // Облыс бойынша орташа — эко-паспортқа жиынтық көрсеткіш ретінде керек
    const idx = grid.map((g) => g.index).filter((v): v is number => Number.isFinite(v));
    const avgIndex = idx.length
      ? Math.round(idx.reduce((a, b) => a + b, 0) / idx.length)
      : null;

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "JAIYQ-MRI · FPEB (Flood-Pulse Egg-Bank) · Open-Meteo (live) + Mordecai термиялық гейт + қос түр (Aedes/Culex)",
      avgIndex,
      maxIndex: idx.length ? Math.max(...idx) : null,
      gridPoints: grid.length,
      grid,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Mosquito grid error:", err);
    return NextResponse.json({ error: "Тірі ауа райы деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
