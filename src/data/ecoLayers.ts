// ЭКО ҚАБАТТАР ТІЗІЛІМІ — әр қабаттың деректері, нормасы, уақыт қатары.
//
// Әр қабат үшін анықталады:
//   · қандай көрсеткіштер кіреді (indicatorRegistry-мен байланысады)
//   · өткен 24 сағат пен алдағы 24 сағат қайдан алынады
//   · уақыт қатары ЖОҚ болса — НЕГЕ жоқ екені (жалған сан жасалмайды)
//   · AI талдауына қандай контекст берілетіні
//
// МАҢЫЗДЫ: қабаттардың өз деректерінде AI ЖОҚ. AI тек бөлек қойындыда,
// бөлек батырмамен шақырылады да, нәтижесі анық белгіленеді.

export type LayerKey =
  | "air" | "water" | "soil" | "oil" | "fire"
  | "drought" | "wind" | "mosquito" | "source";

export type SeriesApi = "air-quality" | "weather" | "flood" | "none";

export interface SeriesVar {
  /** Open-Meteo айнымалысының аты */
  api: string;
  /** UI-дегі аты */
  label: string;
  unit: string;
  /** indicatorRegistry идентификаторы (норма тексеру үшін) */
  indicatorId?: string;
}

export interface EcoLayer {
  key: LayerKey;
  name: string;
  emoji: string;
  /** Түс — Tailwind класы */
  accent: string;
  what: string;
  /** Ағымдағы күйді беретін эндпоинт */
  currentEndpoint: string;
  /** Уақыт қатары қай API-дан алынады */
  seriesApi: SeriesApi;
  /** Сағаттық айнымалылар (seriesApi ≠ none болса) */
  vars: SeriesVar[];
  /** Уақыт қатары жоқ болса — себебі */
  noSeriesReason?: string;
  /** Заңнамалық норма тексерілетін көрсеткіштер */
  indicatorIds: string[];
  /** AI талдауына берілетін контекст сипаттамасы */
  aiContext: string;
  sources: string[];
}

export const ECO_LAYERS: EcoLayer[] = [
  {
    key: "air",
    name: "Ауа",
    emoji: "🌫",
    accent: "sky",
    what: "Атмосфералық ластаушылардың концентрациясы және ауа сапасы индексі",
    currentEndpoint: "/api/environment",
    seriesApi: "air-quality",
    vars: [
      { api: "european_aqi", label: "EU AQI", unit: "", indicatorId: "aqi" },
      { api: "pm2_5", label: "PM₂.₅", unit: "µg/m³", indicatorId: "pm25" },
      { api: "pm10", label: "PM₁₀", unit: "µg/m³", indicatorId: "pm10" },
      { api: "nitrogen_dioxide", label: "NO₂", unit: "µg/m³", indicatorId: "no2" },
      { api: "sulphur_dioxide", label: "SO₂", unit: "µg/m³", indicatorId: "so2" },
      { api: "ozone", label: "O₃", unit: "µg/m³", indicatorId: "ozone" },
    ],
    indicatorIds: ["aqi", "pm25", "pm10", "no2", "so2", "ozone"],
    aiContext:
      "Ауа сапасының соңғы 24 сағаттағы динамикасы, заңнамалық нормалармен " +
      "салыстыруы және алдағы 24 сағатқа CAMS болжамы",
    sources: ["Copernicus CAMS (Open-Meteo арқылы)"],
  },
  {
    key: "wind",
    name: "Жел",
    emoji: "🌬",
    accent: "cyan",
    what: "Жел жылдамдығы, бағыты және екпіні — ластанудың таралуын анықтайды",
    currentEndpoint: "/api/environment",
    seriesApi: "weather",
    vars: [
      { api: "wind_speed_10m", label: "Жел жылдамдығы", unit: "км/сағ" },
      { api: "wind_gusts_10m", label: "Жел екпіні", unit: "км/сағ" },
      { api: "wind_direction_10m", label: "Жел бағыты", unit: "°" },
    ],
    indicatorIds: [],
    aiContext:
      "Жел режимінің өзгеруі және оның ластану шлейфінің бағытына әсері",
    sources: ["ECMWF (Open-Meteo арқылы)"],
  },
  {
    key: "soil",
    name: "Топырақ",
    emoji: "🌱",
    accent: "amber",
    what: "Топырақ ылғалдылығы мен температурасы — деградация мен эрозия қаупі",
    currentEndpoint: "/api/soilgrid",
    seriesApi: "weather",
    vars: [
      { api: "soil_moisture_0_to_7cm", label: "Ылғалдылық 0–7 см", unit: "м³/м³" },
      { api: "soil_temperature_0cm", label: "Температура (бет)", unit: "°C" },
      { api: "soil_temperature_6cm", label: "Температура 6 см", unit: "°C" },
    ],
    indicatorIds: [],
    aiContext: "Топырақ ылғалының тәуліктік динамикасы және құрғау үрдісі",
    sources: ["ECMWF топырақ моделі (Open-Meteo арқылы)"],
  },
  {
    key: "water",
    name: "Су",
    emoji: "💧",
    accent: "teal",
    what:
      "Өзен ағыны және Sentinel-1 радарымен өлшенген су беті. " +
      "⚠️ Екеуі де аймақтық тізілімді талап етеді (арна нүктелері мен " +
      "бақылау терезелері) — тізілімі жоқ қалада «жоқ» деп көрсетіледі.",
    currentEndpoint: "/api/flood-extent",
    seriesApi: "flood",
    vars: [{ api: "river_discharge", label: "Өзен ағыны", unit: "м³/с" }],
    noSeriesReason:
      "GloFAS ағынды ТӘУЛІКТІК береді — сағаттық қатар жоқ. Сондықтан 24 сағаттық " +
      "емес, тәуліктік қатар көрсетіледі.",
    indicatorIds: ["floodedKm2", "waterTotalKm2", "riverTrend"],
    aiContext: "Өзен ағынының өзгерісі және су басу қаупінің дамуы",
    sources: ["Copernicus GloFAS", "Copernicus Sentinel-1 SAR"],
  },
  {
    key: "fire",
    name: "Өрт",
    emoji: "🔥",
    accent: "red",
    what: "Өрт ауа райы индексі және спутник тіркеген жылу аномалиялары",
    currentEndpoint: "/api/fire",
    seriesApi: "weather",
    vars: [
      { api: "temperature_2m", label: "Температура", unit: "°C" },
      { api: "relative_humidity_2m", label: "Ылғалдылық", unit: "%" },
      { api: "wind_speed_10m", label: "Жел", unit: "км/сағ" },
      { api: "precipitation", label: "Жауын", unit: "мм" },
    ],
    indicatorIds: ["fwi", "flares"],
    aiContext:
      "Өрт қаупін құрайтын метеорологиялық факторлардың 24 сағаттық динамикасы",
    sources: ["ECMWF (Open-Meteo арқылы)", "NASA FIRMS VIIRS"],
  },
  {
    key: "oil",
    name: "Мұнай",
    emoji: "🛢",
    accent: "neutral",
    what: "Жылу аномалиялары (газ факелдері) және SAR арқылы дақ іздеу",
    currentEndpoint: "/api/flares",
    seriesApi: "none",
    vars: [],
    noSeriesReason:
      "Жылу аномалиясы — спутник өткен сәттегі оқиға, үздіксіз өлшем емес. " +
      "VIIRS тәулігіне бірнеше рет қана өтеді, сондықтан сағаттық қатар ЖОҚ. " +
      "Оның орнына соңғы 24 сағаттағы детекциялар тізімі беріледі. Болжам " +
      "жасалмайды — факелдің қашан жанатынын метеорологиядан білу мүмкін емес.",
    indicatorIds: ["flares"],
    aiContext: "Соңғы детекциялардың орналасуы және өнеркәсіп нысандарына жақындығы",
    sources: ["NASA FIRMS VIIRS", "Copernicus Sentinel-1 SAR"],
  },
  {
    key: "drought",
    name: "Құрғақшылық",
    emoji: "🌾",
    accent: "orange",
    what: "Стандартталған жауын индексі — ұзақ мерзімді ылғал тапшылығы",
    currentEndpoint: "/api/drought",
    seriesApi: "none",
    vars: [],
    noSeriesReason:
      "SPI-3 — ҮШ АЙЛЫҚ жинақталған көрсеткіш. 24 сағатта ол мәнді өзгермейді, " +
      "сондықтан сағаттық қатар мағынасыз болар еді. Оның орнына айлық динамика " +
      "көрсетіледі.",
    indicatorIds: ["spi"],
    aiContext: "Құрғақшылық сыныбы және оның ауыл шаруашылығына ықтимал әсері",
    sources: ["ECMWF ERA5 архиві (Open-Meteo арқылы)"],
  },
  {
    key: "mosquito",
    name: "Маса",
    emoji: "🦟",
    accent: "purple",
    what: "Климаттық қолайлылық индексі — маса көбеюіне жағдай қаншалық қолайлы",
    currentEndpoint: "/api/mosquitogrid",
    seriesApi: "weather",
    vars: [
      { api: "temperature_2m", label: "Температура", unit: "°C" },
      { api: "relative_humidity_2m", label: "Ылғалдылық", unit: "%" },
      { api: "precipitation", label: "Жауын", unit: "мм" },
    ],
    indicatorIds: ["mri"],
    aiContext:
      "Маса белсенділігіне әсер ететін температура мен ылғалдың динамикасы",
    sources: ["Open-Meteo (ECMWF)", "JAIYQ-MRI моделі"],
  },
  {
    key: "source",
    name: "Ластану көзі",
    emoji: "📍",
    accent: "rose",
    what:
      "Жел бағыты бойынша кері траектория — ластанудың ЫҚТИМАЛ өнеркәсіптік көзі. " +
      "Таралу конусы Pasquill–Gifford орнықтылық класымен есептеледі; ені = " +
      "физикалық жайылу (2σy) + жел бағытының ауытқуы.",
    currentEndpoint: "/api/pollution-source",
    seriesApi: "weather",
    vars: [
      { api: "wind_speed_10m", label: "Жел жылдамдығы", unit: "км/сағ" },
      { api: "wind_direction_10m", label: "Жел бағыты", unit: "°" },
    ],
    indicatorIds: [],
    aiContext:
      "Жел бағытының өзгеруі және оның ықтимал ластану көзін анықтауға әсері",
    sources: [
      "Copernicus CAMS",
      "ECMWF жел өрісі (тордың әр нүктесінде) + күн радиациясы, бұлттылық",
      "WAQI жер бетіндегі станциялар",
    ],
  },
];

export const LAYER_BY_KEY = new Map(ECO_LAYERS.map((l) => [l.key, l]));

/** Open-Meteo API негізгі URL-дері */
export const SERIES_BASE: Record<Exclude<SeriesApi, "none">, string> = {
  "air-quality": "https://air-quality-api.open-meteo.com/v1/air-quality",
  weather: "https://api.open-meteo.com/v1/forecast",
  flood: "https://flood-api.open-meteo.com/v1/flood",
};
