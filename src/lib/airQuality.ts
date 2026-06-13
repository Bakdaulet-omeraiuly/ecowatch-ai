// European Air Quality Index (EAQI) — the official scale used by Copernicus CAMS,
// which is the live source we already fetch (current.european_aqi).
// Bands and health advice follow the European Environment Agency definition.

export interface AqiCategory {
  name: string; // Kazakh label
  color: string;
  range: [number, number];
  advice: string; // general health recommendation
  sensitiveAdvice: string; // for sensitive groups (children, elderly, asthma, heart/lung)
}

export const AQI_CATEGORIES: AqiCategory[] = [
  {
    name: "Жақсы",
    color: "#22c55e",
    range: [0, 20],
    advice: "Ауа таза — сыртта еркін болуға болады.",
    sensitiveAdvice: "Сезімтал топтарға да қауіпсіз.",
  },
  {
    name: "Қалыпты",
    color: "#a3e635",
    range: [20, 40],
    advice: "Ауа сапасы қанағаттанарлық — көпшілікке қауіпсіз.",
    sensitiveAdvice: "Өте сезімтал адамдар ұзақ ауыр жүктемеге назар аударсын.",
  },
  {
    name: "Орташа",
    color: "#eab308",
    range: [40, 60],
    advice: "Көпшілік үшін қолайлы, бірақ ұзақ ауыр жүктемеден байқаңыз.",
    sensitiveAdvice: "Астма, жүрек/өкпе ауруы барлар, балалар мен қарттар сыртқы ауыр жүктемені азайтсын.",
  },
  {
    name: "Нашар",
    color: "#f97316",
    range: [60, 80],
    advice: "Сыртқы ұзақ белсенділікті азайтқан жөн.",
    sensitiveAdvice: "Сезімтал топтар сыртқы белсенділіктен бас тартсын, қажет болса маска кисін.",
  },
  {
    name: "Өте нашар",
    color: "#ef4444",
    range: [80, 100],
    advice: "Барлығы сыртта аз болсын, терезені жабыңыз.",
    sensitiveAdvice: "Сезімтал топтар үйде қалсын. Тыныс қиындаса — дәрігерге жүгініңіз.",
  },
  {
    name: "Аса нашар",
    color: "#a855f7",
    range: [100, Infinity],
    advice: "Сыртқа шықпаған жөн. Терезені жабыңыз, ауа тазалағышты қосыңыз, маска киіңіз.",
    sensitiveAdvice: "Сезімтал топтарға қауіпті — үйден шықпаңыз, медициналық бақылауда болыңыз.",
  },
];

export function aqiCategory(aqi: number): AqiCategory {
  return AQI_CATEGORIES.find((c) => aqi >= c.range[0] && aqi < c.range[1]) ?? AQI_CATEGORIES[0];
}
