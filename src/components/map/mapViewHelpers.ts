// MapView-тің таза көмекші функциялары мен тұрақтылары (React-сыз). MapView.tsx-тен бөлінді.
import type { Site } from "@/types/site";
import type { LayerKey } from "@/data/historyFactors";

// Real yearly satellite mosaics. All imagery is real, no simulation:
//  • 1984–2001 → Landsat WELD Annual TrueColor (NASA GIBS, 30 м)
//  • 2002–2015 → NASA MODIS Terra True Color (250 м)
//  • 2016–2025 → Sentinel-2 Cloudless yearly mosaic by EOX (10 м)
export const LANDSAT_YEARS = new Set([1984, 1985, 1986, 1989, 1990, 1991, 1999, 2000, 2001]);
export const HISTORY_YEARS: number[] = [
  1984, 1985, 1986, 1989, 1990, 1991,
  1999, 2000, 2001,
  2003, 2006, 2009, 2012, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

// Raster tile config for the selected year's map layer
export function yearTileConfig(year: number): { tiles: string[]; maxzoom: number; attribution: string } {
  if (LANDSAT_YEARS.has(year)) {
    return {
      tiles: [
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual/default/${year}-07-15/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpeg`,
      ],
      maxzoom: 12,
      attribution: "NASA EOSDIS GIBS — Landsat WELD · 30 м",
    };
  }
  if (year < 2016) {
    return {
      tiles: [
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${year}-07-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      ],
      maxzoom: 9,
      attribution: "NASA EOSDIS GIBS — MODIS Terra · 250 м",
    };
  }
  const layer = year === 2016 ? "s2cloudless_3857" : `s2cloudless-${year}_3857`;
  return {
    tiles: [`https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/{z}/{y}/{x}.jpg`],
    maxzoom: 16,
    attribution: "Sentinel-2 cloudless by EOX — ESA Copernicus · 10 м",
  };
}
// Per-layer weight for a site (0..1)
export function layerWeight(s: Site, layer: LayerKey): number {
  const a = s.analysis;
  switch (layer) {
    case "green": return 0;
    case "landuse": return 0;
    case "nature": return 0;
    case "mosquito": return s.mosquitoRiskIndex / 100;
    case "oil": return a.oilPollution ? a.riskScore / 100 : 0.05;
    case "air": return a.oilPollution ? a.riskScore / 110 : a.riskScore / 250; // air follows industry
    case "soil": return a.landDegradation ? a.riskScore / 100 : 0.08;
    case "waste": return a.illegalDumping ? a.riskScore / 100 : 0.05;
    case "water": return a.standingWater ? 0.4 + a.riskScore / 250 : 0.05;
    case "fire": return 0.5; // өрт — аймақтық көрсеткіш (FWI), нүктеге тәуелсіз
    case "drought": return 0.5; // құрғақшылық — аймақтық көрсеткіш (SPI)
    case "wind": return 0; // жел — жылу картасы емес, стрелкалармен көрсетіледі
  }
}

// Қарапайым тілмен түсіндірме — кез келген адам ұғатындай кеңес
export function fireAdvice(fwi: number): string {
  if (fwi < 5.2) return "Өрт қаупі өте төмен — қауіп жоқ.";
  if (fwi < 11.2) return "Өрт қаупі төмен — сақтық жеткілікті.";
  if (fwi < 21.3) return "Орташа қауіп — далада отпен абай болыңыз.";
  if (fwi < 38) return "Жоғары қауіп — далада от жақпаңыз, темекі тастамаңыз.";
  return "Аса қауіпті — кез келген ұшқын дала өртін тудыруы мүмкін.";
}
export function droughtAdvice(spi: number): string {
  if (spi >= 1) return "Жер ылғалды — су тапшылығы жоқ.";
  if (spi > -1) return "Ылғалдылық қалыпты деңгейде.";
  if (spi > -1.5) return "Орташа құрғақшылық — өсімдікке су жетіспейді.";
  if (spi > -2) return "Қатты құрғақшылық — суды үнемдеу қажет.";
  return "Апатты құрғақшылық — су ресурстарын қатаң үнемдеңіз.";
}
export function mosquitoAdvice(idx: number): string {
  if (idx < 20) return "Маса жоқтың қасы — қорғану қажет емес.";
  if (idx < 35) return "Маса аз — қорғану қажеті шамалы.";
  if (idx < 50) return "Орташа төмен — кешке репеллент жеткілікті.";
  if (idx < 65) return "Орташа жоғары — репеллент пен жабық киім қажет.";
  return "Маса өте көп — репеллент, тор қажет, тұрған суды құрғатыңыз.";
}
export function soilAdvice(stress: number): string {
  if (stress < 25) return "Топырақ сау әрі ылғалды — деградация қаупі төмен.";
  if (stress < 45) return "Топырақ қалыпты — елеулі стресс жоқ.";
  if (stress < 65) return "Орташа стресс — құрғау мен тұздану басталуы мүмкін.";
  return "Жоғары стресс — топырақ құрғаған, шөлейттену қаупі бар.";
}
export function flaresAdvice(count: number): string {
  if (count <= 3) return "Бірнеше жылу аномалиясы — расталған өрт емес, тек спутниктің жылу сигналы.";
  if (count <= 10) return "Жылу аномалиялары орташа — факел, өрт немесе жалынды спутник ажыратпайды.";
  return "Жылу аномалиялары көп — бұл расталған өрт емес; себебін жердегі тексеру анықтайды.";
}
/** lib/floodPulse joins its measured parts with " · " and appends one fixed
 *  sentence; each part has its own dictionary entry or template. */
export const FLOOD_NOTE_TAIL = "Су басу жұмыртқа банкінің жарылуын іске қосады — импульс жоғары болса жайылмадағы индекс те көтеріледі.";
export function trFloodNote(note: string, tr: (s: string) => string): string {
  const tail = `. ${FLOOD_NOTE_TAIL}`;
  if (!note.endsWith(tail)) return tr(note);
  const parts = note.slice(0, -tail.length).split(" · ").map(tr).join(" · ");
  return `${parts}. ${tr(FLOOD_NOTE_TAIL)}`;
}
export function compassKz(deg: number): string {
  const dirs = ["Солтүстік", "Солтүстік-шығыс", "Шығыс", "Оңтүстік-шығыс", "Оңтүстік", "Оңтүстік-батыс", "Батыс", "Солтүстік-батыс"];
  return dirs[Math.round(deg / 45) % 8];
}
export function windAdvice(maxSpeed: number): string {
  if (maxSpeed < 15) return "Жел әлсіз — қалыпты жағдай.";
  if (maxSpeed < 30) return "Жел орташа — шаң аздап көтеріледі.";
  if (maxSpeed < 45) return "Жел күшті — шаң мен ластану тез таралады, өрт қаупі артады.";
  return "Дауыл — өте қатты жел, далада сақ болыңыз.";
}
export function waterAdvice(level: string): string {
  if (level.includes("Жоғары")) return "Тасқын қаупі жоғары — өзен жайылмасынан аулақ болыңыз.";
  if (level.includes("Орташа")) return "Су деңгейі көтерілуде — жағада сақ болыңыз.";
  if (level.includes("Бақылауда")) return "Су деңгейі бақылауда — әзірге қауіп жоқ.";
  return "Өзен деңгейі қалыпты — тасқын қаупі жоқ.";
}

// WAQI жердегі станса US EPA AQI шкаласын қолданады (біздің EU aqiCategory-мен бөлек)
export function usAqiColor(a: number): string {
  return a <= 50 ? "#22c55e" : a <= 100 ? "#eab308" : a <= 150 ? "#f97316" : a <= 200 ? "#ef4444" : a <= 300 ? "#a855f7" : "#7f1d1d";
}

// Болжам footprint шеңберін GeoJSON сақина ретінде жасау
export function fcCircle(lat: number, lng: number, radiusKm: number): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    const dLat = (radiusKm / 111) * Math.cos(a);
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a);
    ring.push([lng + dLng, lat + dLat]);
  }
  return ring;
}

// Нүктені желмен алға жылжыту (advection) — болжам footprint орталығы үшін
export function advect(lat: number, lng: number, toBearing: number, speedKmh: number, hours: number): [number, number] {
  const dist = speedKmh * hours; // км
  const b = (toBearing * Math.PI) / 180;
  const dLat = (dist / 111) * Math.cos(b);
  const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(b);
  return [lat + dLat, lng + dLng];
}

// Панельдің екінші бөлімі — қабат емес, бөлек беттер.
export const MOS_LEVELS: { max: number; color: string; label: string }[] = [
  { max: 25, color: "#60a5fa", label: "өте төмен" },
  { max: 45, color: "#4ade80", label: "төмен" },
  { max: 62, color: "#facc15", label: "орташа" },
  { max: 78, color: "#fb923c", label: "жоғары" },
  { max: 101, color: "#ef4444", label: "өте жоғары" },
];

export function mosLevel(idx: number): { color: string; label: string } {
  const l = MOS_LEVELS.find((x) => idx < x.max) ?? MOS_LEVELS[MOS_LEVELS.length - 1];
  return { color: l.color, label: l.label };
}

export const FIRE_PRESETS = [30, 90, 180, 365] as const;
export const FIRE_CATEGORY_COLOR = { industrial_flare: "#ef4444", unconfirmed_anomaly: "#facc15" } as const;

/** YYYY-MM-DD датасынан `days` күн шегеру (UTC) — туынды мән үшін таза функция */
export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

