// Спутник қабаттары — тегін, нақты деректер.
//  • Sentinel Hub (Copernicus, 10 м) — Instance ID болса, жоғары айқындықты
//    Sentinel-2 спектрлік қабаттар (~2-3 күн сайын жаңарады). iLoveNatura деңгейі.
//  • Болмаса — NASA GIBS (MODIS/VIIRS) ғылыми қабаттарына қайтады.

export interface SatLayer {
  key: string;
  labelKz: string;
  descKz: string;
  source: "eox" | "gibs" | "sentinel" | "sentinel1" | "sentinel5p";
  layer: string;
  matrix?: string;
  ext: "jpg" | "png";
  maxzoom: number;
  tileSize: number;
  cadence?: "daily" | "8day" | "monthly" | "static";
  fixedDate?: string; // тоқтаған аспаптар үшін бекітілген күн (AIRS т.б.)
  dateOffset?: number; // dailyDate үшін күн кешігуі (OMI ~60 күн, қалғаны 3 күн)
  opacity: number;
}

const SH_INSTANCE = process.env.NEXT_PUBLIC_SENTINELHUB_INSTANCE_ID;
const S1_INSTANCE = process.env.NEXT_PUBLIC_SENTINELHUB_S1_INSTANCE_ID;
const S5P_INSTANCE = process.env.NEXT_PUBLIC_SENTINELHUB_S5P_INSTANCE_ID;

// ── Sentinel-2 (Copernicus, 10 м) — 8 спектрлік қабат ───────────────────
const SENTINEL_LAYERS: SatLayer[] = [
  { key: "truecolor", labelKz: "Шынайы түс (10 м)", descKz: "Sentinel-2 табиғи түс — ең соңғы бұлтсыз сурет",
    source: "sentinel", layer: "TRUE_COLOR", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
  { key: "infrared", labelKz: "Жалған түс (өсімдік)", descKz: "Инфрақызыл — өсімдік ашық қызыл, су қара",
    source: "sentinel", layer: "COLOR_INFRARED", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
  { key: "ndvi", labelKz: "Өсімдік (NDVI)", descKz: "Жасыл өсімдік тығыздығы — 10 м дәлдік",
    source: "sentinel", layer: "VEGETATION_INDEX", ext: "png", maxzoom: 16, tileSize: 512, opacity: 0.95 },
  { key: "moisture", labelKz: "Ылғалдылық (NDMI)", descKz: "Өсімдік/топырақ ылғалдылық индексі",
    source: "sentinel", layer: "MOISTURE_INDEX", ext: "png", maxzoom: 16, tileSize: 512, opacity: 0.95 },
  { key: "agri", labelKz: "Ауыл шаруашылығы", descKz: "Егістік пен өсімдік жамылғысын ажырату",
    source: "sentinel", layer: "AGRICULTURE", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
  { key: "swir", labelKz: "SWIR (өрт/ылғал)", descKz: "Қысқа толқынды инфрақызыл — өрт іздері, ылғал",
    source: "sentinel", layer: "SWIR", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
  { key: "geology", labelKz: "Геология / топырақ", descKz: "Жыныс пен топырақ түрлерін ажырату",
    source: "sentinel", layer: "GEOLOGY", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
  { key: "bathymetric", labelKz: "Су беті / тереңдік", descKz: "Су айдындары мен таяз су аймақтары",
    source: "sentinel", layer: "BATHYMETRIC", ext: "png", maxzoom: 16, tileSize: 512, opacity: 1 },
];

// ── NASA GIBS (кілтсіз резерв) ──────────────────────────────────────────
const GIBS_FALLBACK: SatLayer[] = [
  { key: "truecolor", labelKz: "Шынайы түс (10 м)", descKz: "Sentinel-2 Cloudless (EOX, ESA)",
    source: "eox", layer: "s2cloudless-2024_3857", ext: "jpg", maxzoom: 16, tileSize: 256, opacity: 1 },
  { key: "falsecolor", labelKz: "Жалған түс (7-2-1)", descKz: "Өсімдік/су/өрт іздері (MODIS)",
    source: "gibs", layer: "MODIS_Terra_CorrectedReflectance_Bands721", matrix: "GoogleMapsCompatible_Level9",
    ext: "jpg", maxzoom: 9, tileSize: 256, cadence: "daily", opacity: 1 },
  { key: "ndvi", labelKz: "Өсімдік (NDVI)", descKz: "Өсімдік тығыздығы (MODIS, 8 күндік)",
    source: "gibs", layer: "MODIS_Terra_NDVI_8Day", matrix: "GoogleMapsCompatible_Level9",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "8day", opacity: 0.9 },
  { key: "lstday", labelKz: "Жер беті жылуы (күндіз)", descKz: "MODIS LST күндізгі",
    source: "gibs", layer: "MODIS_Terra_Land_Surface_Temp_Day", matrix: "GoogleMapsCompatible_Level7",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", opacity: 0.75 },
  { key: "aerosol", labelKz: "Аэрозоль / шаң", descKz: "Аэрозоль оптикалық тығыздығы",
    source: "gibs", layer: "MODIS_Combined_Value_Added_AOD", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", opacity: 0.7 },
  { key: "night", labelKz: "Түнгі жарық", descKz: "VIIRS Black Marble",
    source: "gibs", layer: "VIIRS_Black_Marble", matrix: "GoogleMapsCompatible_Level8",
    ext: "png", maxzoom: 8, tileSize: 256, cadence: "static", opacity: 1 },
];

// ── Sentinel-1 (радар) — бұлт/түн кедергі емес, мұнай/тасқынды көреді ────
const RADAR_LAYERS: SatLayer[] = [
  { key: "radar_vv", labelKz: "Су / мұнай (VV)", descKz: "Sentinel-1 VV радары — су бетіндегі мұнай, тасқын (қара = тегіс су)",
    source: "sentinel1", layer: "IW_VV_DB", ext: "png", maxzoom: 15, tileSize: 512, opacity: 1 },
  { key: "radar_vh", labelKz: "Өсімдік / құрылым (VH)", descKz: "Sentinel-1 VH радары — өсімдік, құрылыс, рельеф",
    source: "sentinel1", layer: "IW-VH-DB", ext: "png", maxzoom: 15, tileSize: 512, opacity: 1 },
];

// Instance ID болса — Sentinel-2 (жоғары сапа), болмаса — GIBS
export const GIBS_LAYERS: SatLayer[] = SH_INSTANCE ? SENTINEL_LAYERS : GIBS_FALLBACK;
export const SAT_PROVIDER = SH_INSTANCE ? "Sentinel-2 · 10 м" : "NASA GIBS";
// ATMOS_PROVIDER төменде HAS_S5P жарияланғаннан кейін экспортталады

// Радар қабаттары (S1 кілті болса ғана)
export const RADAR_SAT_LAYERS: SatLayer[] = S1_INSTANCE ? RADAR_LAYERS : [];

// ── Sentinel-5P / TROPOMI (5.5 км — ең үздік, тегін Copernicus) ──────────
// SH_INSTANCE болса — TROPOMI нақты спутник суреттері (тәуліктік, 5.5 км).
// Болмаса — NASA GIBS резервіне қайтады (25–50 км, өрескел).
const S5P_LAYERS: SatLayer[] = [
  { key: "no2",  labelKz: "NO₂ · TROPOMI · 5.5 км", descKz: "Азот диоксиді — Sentinel-5P нақты спутник · тәуліктік",
    source: "sentinel5p", layer: "no2",  ext: "png", maxzoom: 8, tileSize: 512, opacity: 0.9 },
  { key: "so2",  labelKz: "SO₂ · TROPOMI · 5.5 км", descKz: "Күкірт диоксиді — факел пен мұнай өңдеу · тәуліктік",
    source: "sentinel5p", layer: "so2",  ext: "png", maxzoom: 8, tileSize: 512, opacity: 0.9 },
  { key: "ch4",  labelKz: "CH₄ · TROPOMI · 5.5 км", descKz: "Метан — мұнай-газ ағуы · Sentinel-5P · тәуліктік",
    source: "sentinel5p", layer: "ch4",  ext: "png", maxzoom: 8, tileSize: 512, opacity: 0.9 },
  { key: "co",   labelKz: "CO · TROPOMI · 5.5 км",  descKz: "Көміртек тотығы — жану өнімдері · тәуліктік",
    source: "sentinel5p", layer: "co",   ext: "png", maxzoom: 8, tileSize: 512, opacity: 0.9 },
  { key: "aod",  labelKz: "Аэрозоль · TROPOMI",      descKz: "Аэрозоль индексі — шаң мен бөлшектер · тәуліктік",
    source: "sentinel5p", layer: "aod", ext: "png", maxzoom: 8, tileSize: 512, opacity: 0.9 },
  { key: "snow", labelKz: "Қар жамылғысы · MODIS",   descKz: "MODIS NDSI — қар жамылғысы (қыс мезгілінде)",
    source: "gibs", layer: "MODIS_Terra_NDSI_Snow_Cover", matrix: "GoogleMapsCompatible_Level8",
    ext: "png", maxzoom: 6, tileSize: 256, cadence: "daily", opacity: 0.85 },
];

// NASA GIBS резерві (кілтсіз, бірақ өрескел 25–50 км)
const GIBS_ATMOS_LAYERS: SatLayer[] = [
  { key: "no2", labelKz: "NO₂ · OMI (60 күн кешігеді)", descKz: "Азот диоксиді · OMI/Aura · 25 км",
    source: "gibs", layer: "OMI_Nitrogen_Dioxide_Tropo_Column", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", dateOffset: 60, opacity: 0.85 },
  { key: "so2", labelKz: "SO₂ · OMI (60 күн кешігеді)", descKz: "Күкірт диоксиді · OMI/Aura · 25 км",
    source: "gibs", layer: "OMI_SO2_Planetary_Boundary_Layer", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", dateOffset: 60, opacity: 0.85 },
  { key: "ch4", labelKz: "CH₄ · AIRS (2022)", descKz: "Метан · AIRS тарихи · 2022-09-15",
    source: "gibs", layer: "AIRS_L2_Methane_400hPa_Volume_Mixing_Ratio_Day", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, fixedDate: "2022-09-15", opacity: 0.85 },
  { key: "co",  labelKz: "Аэрозоль · MODIS", descKz: "Шаң мен жану өнімдері · MODIS Combined · күнделікті",
    source: "gibs", layer: "MODIS_Combined_Value_Added_AOD", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", opacity: 0.85 },
  { key: "aod", labelKz: "Аэрозоль (3 км) · Terra", descKz: "Аэрозоль оптикалық тығыздығы · MODIS Terra",
    source: "gibs", layer: "MODIS_Terra_Aerosol_Optical_Depth_3km", matrix: "GoogleMapsCompatible_Level6",
    ext: "png", maxzoom: 5, tileSize: 256, cadence: "daily", opacity: 0.85 },
  { key: "snow", labelKz: "Қар жамылғысы · MODIS", descKz: "MODIS NDSI — қар жамылғысы (қыс мезгілінде)",
    source: "gibs", layer: "MODIS_Terra_NDSI_Snow_Cover", matrix: "GoogleMapsCompatible_Level8",
    ext: "png", maxzoom: 6, tileSize: 256, cadence: "daily", opacity: 0.85 },
];

// SENTINELHUB_CLIENT_ID болса → TROPOMI Process API (5.5 км), болмаса → GIBS (25–50 км)
const HAS_S5P = !!(process.env.SENTINELHUB_CLIENT_ID || S5P_INSTANCE);
export const ATMOS_LAYERS: SatLayer[] = HAS_S5P ? S5P_LAYERS : GIBS_ATMOS_LAYERS;
export const ATMOS_PROVIDER = HAS_S5P ? "TROPOMI · 5.5 км" : "NASA GIBS · 25 км";

// Кез келген қабатты key бойынша табу (оптика + радар + атмосфера)
export function findSatLayer(key: string): SatLayer | undefined {
  return [...GIBS_LAYERS, ...RADAR_SAT_LAYERS, ...ATMOS_LAYERS].find((l) => l.key === key);
}

function isoAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
}

function dailyDate(): string { return isoAgo(3); }

function eightDayDate(): string {
  const now = new Date(Date.now() - 16 * 86400_000);
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const doy = Math.floor((now.getTime() - start) / 86400_000) + 1;
  const periodStart = Math.floor((doy - 1) / 8) * 8;
  return new Date(start + periodStart * 86400_000).toISOString().slice(0, 10);
}

export function gibsTiles(def: SatLayer): string[] {
  if (def.source === "sentinel") {
    // Соңғы 45 күндік терезе — ең жаңа бұлтсыз суретті алу үшін
    const time = `${isoAgo(45)}/${isoAgo(0)}`;
    return [
      `https://sh.dataspace.copernicus.eu/ogc/wms/${SH_INSTANCE}?SERVICE=WMS&REQUEST=GetMap` +
        `&VERSION=1.1.1&LAYERS=${def.layer}&BBOX={bbox-epsg-3857}&SRS=EPSG:3857` +
        `&WIDTH=512&HEIGHT=512&FORMAT=image/png&TIME=${time}&MAXCC=40&PRIORITY=mostRecent`,
    ];
  }
  if (def.source === "sentinel5p") {
    // Серверлік прокси арқылы Sentinel Hub Process API → TROPOMI тайлдары
    return [`/api/s5p/${def.layer}/{z}/{x}/{y}`];
  }
  if (def.source === "sentinel1") {
    // Радар — соңғы 30 күн (бұлт кедергі емес)
    const time = `${isoAgo(30)}/${isoAgo(0)}`;
    return [
      `https://sh.dataspace.copernicus.eu/ogc/wms/${S1_INSTANCE}?SERVICE=WMS&REQUEST=GetMap` +
        `&VERSION=1.1.1&LAYERS=${def.layer}&BBOX={bbox-epsg-3857}&SRS=EPSG:3857` +
        `&WIDTH=512&HEIGHT=512&FORMAT=image/png&TIME=${time}&PRIORITY=mostRecent`,
    ];
  }
  if (def.source === "eox") {
    return [`https://tiles.maps.eox.at/wmts/1.0.0/${def.layer}/default/g/{z}/{y}/{x}.${def.ext}`];
  }
  const base = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${def.layer}/default`;
  let date: string;
  if (def.cadence === "static") {
    return [`${base}/${def.matrix}/{z}/{y}/{x}.${def.ext}`];
  } else if (def.fixedDate) {
    return [`${base}/${def.fixedDate}/${def.matrix}/{z}/{y}/{x}.${def.ext}`];
  } else if (def.cadence === "monthly") {
    // Алдыңғы аяқталған айдың 1-күні
    const d = new Date();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() - 1);
    date = d.toISOString().slice(0, 10);
  } else if (def.cadence === "8day") {
    date = eightDayDate();
  } else {
    date = isoAgo(def.dateOffset ?? 3);
  }
  return [`${base}/${date}/${def.matrix}/{z}/{y}/{x}.${def.ext}`];
}
