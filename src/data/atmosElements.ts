// Атмосфера элементтері — барлығы НАҚТЫ, тегін көздерден (Copernicus CAMS / Open-Meteo).
// Ойдан дерек жоқ. Атырау үшін жаһандық CAMS қолжетімді айнымалылар ғана.
// `key` — AirGridPoint өрісі; `maxRef` — heatmap нормалау шегі (µg/m³ немесе индекс).

export interface AtmosElement {
  key: "aqi" | "pm2_5" | "pm10" | "no2" | "so2" | "ozone" | "co" | "nh3" | "ch4" | "dust" | "aod" | "uv";
  short: string;
  label: string;
  unit: string;
  category: "Индекс" | "Негізгі ластаушылар" | "Қосымша газдар" | "Аэрозоль / басқа";
  maxRef: number;
  ramp: [string, string, string, string];
}

const RAMP: [string, string, string, string] = [
  "rgba(56,189,248,0.35)", "rgba(163,230,53,0.6)", "rgba(250,204,21,0.8)", "rgba(239,68,68,0.95)",
];

export const ATMOS_ELEMENTS: AtmosElement[] = [
  { key: "aqi",   short: "EU AQI", label: "Ауа сапасы индексі", unit: "", category: "Индекс", maxRef: 80, ramp: RAMP },

  { key: "pm2_5", short: "PM₂.₅", label: "Ұсақ шаң (2.5 мкм)", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 75, ramp: RAMP },
  { key: "pm10",  short: "PM₁₀",  label: "Ірі шаң (10 мкм)", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 100, ramp: RAMP },
  { key: "no2",   short: "NO₂",   label: "Азот диоксиді", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 100, ramp: RAMP },
  { key: "so2",   short: "SO₂",   label: "Күкірт диоксиді", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 100, ramp: RAMP },
  { key: "ozone", short: "O₃",    label: "Озон", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 160, ramp: RAMP },
  { key: "co",    short: "CO",    label: "Көміртек тотығы", unit: "µg/m³", category: "Негізгі ластаушылар", maxRef: 4000, ramp: RAMP },

  { key: "nh3",   short: "NH₃",   label: "Аммиак", unit: "µg/m³", category: "Қосымша газдар", maxRef: 30, ramp: RAMP },
  { key: "ch4",   short: "CH₄",   label: "Метан", unit: "µg/m³", category: "Қосымша газдар", maxRef: 2200, ramp: RAMP },

  { key: "dust",  short: "Шаң",   label: "Шөл шаңы", unit: "µg/m³", category: "Аэрозоль / басқа", maxRef: 120, ramp: RAMP },
  { key: "aod",   short: "AOD",   label: "Аэрозоль оптикалық тығыздығы", unit: "", category: "Аэрозоль / басқа", maxRef: 1, ramp: RAMP },
  { key: "uv",    short: "UV",    label: "Ультракүлгін индексі", unit: "", category: "Аэрозоль / басқа", maxRef: 11, ramp: RAMP },
];

export const ATMOS_CATEGORIES = ["Индекс", "Негізгі ластаушылар", "Қосымша газдар", "Аэрозоль / басқа"] as const;
