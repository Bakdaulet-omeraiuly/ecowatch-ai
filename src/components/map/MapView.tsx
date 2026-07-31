"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Map, { Marker, Layer, Source, Popup, type MapRef } from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import { toast } from "sonner";
import {
  Loader2, Layers, Satellite, History, X, MapPinPlus, Plus, Minus, Locate,
  Bug, Wind, Mountain, Fuel, Trash2, Waves, Radio, Camera, Sparkles, Play, Pause, Flame, Droplets,
  Factory, AlertTriangle, Navigation,
} from "lucide-react";
import { useSitesStore } from "@/store/useSitesStore";
import { RISK_COLORS } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import { LAYERS, type LayerKey } from "@/data/historyFactors";
import { GIBS_LAYERS, RADAR_SAT_LAYERS, ATMOS_LAYERS, gibsTiles, findSatLayer, SAT_PROVIDER, ATMOS_PROVIDER } from "@/data/gibsLayers";
import { useLang } from "@/lib/i18n";
import { MapSearch } from "./MapSearch";

// Real yearly satellite mosaics. All imagery is real, no simulation:
//  • 1984–2001 → Landsat WELD Annual TrueColor (NASA GIBS, 30 м)
//  • 2002–2015 → NASA MODIS Terra True Color (250 м)
//  • 2016–2025 → Sentinel-2 Cloudless yearly mosaic by EOX (10 м)
const LANDSAT_YEARS = new Set([1984, 1985, 1986, 1989, 1990, 1991, 1999, 2000, 2001]);
const HISTORY_YEARS: number[] = [
  1984, 1985, 1986, 1989, 1990, 1991,
  1999, 2000, 2001,
  2003, 2006, 2009, 2012, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

// Raster tile config for the selected year's map layer
function yearTileConfig(year: number): { tiles: string[]; maxzoom: number; attribution: string } {
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
import { AnalysisDrawer } from "@/components/analysis/AnalysisDrawer";
import { MosquitoIcon } from "./MosquitoIcon";
import { aqiCategory, AQI_CATEGORIES } from "@/lib/airQuality";
import {
  useSharedReports, useAirGrid, useMosquitoGrid, useSoilGrid, useFlood, useFlares,
  usePollutionSource,
  type AirGridPoint, type MosquitoGridPoint, type PollutionSourceCandidate,
} from "@/hooks/useEcoData";
import type { Site, AnalysisResult } from "@/types/site";

const ATYRAU = { latitude: 47.1167, longitude: 51.9014, zoom: 7.5 };

const LAYER_ICONS: Record<LayerKey, React.ElementType> = {
  mosquito: Bug,
  air: Wind,
  soil: Mountain,
  oil: Fuel,
  waste: Trash2,
  water: Waves,
  fire: Flame,
  drought: Droplets,
  wind: Wind,
};


// Per-layer weight for a site (0..1)
function layerWeight(s: Site, layer: LayerKey): number {
  const a = s.analysis;
  switch (layer) {
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
function fireAdvice(fwi: number): string {
  if (fwi < 5.2) return "Өрт қаупі өте төмен — қауіп жоқ.";
  if (fwi < 11.2) return "Өрт қаупі төмен — сақтық жеткілікті.";
  if (fwi < 21.3) return "Орташа қауіп — далада отпен абай болыңыз.";
  if (fwi < 38) return "Жоғары қауіп — далада от жақпаңыз, темекі тастамаңыз.";
  return "Аса қауіпті — кез келген ұшқын дала өртін тудыруы мүмкін.";
}
function droughtAdvice(spi: number): string {
  if (spi >= 1) return "Жер ылғалды — су тапшылығы жоқ.";
  if (spi > -1) return "Ылғалдылық қалыпты деңгейде.";
  if (spi > -1.5) return "Орташа құрғақшылық — өсімдікке су жетіспейді.";
  if (spi > -2) return "Қатты құрғақшылық — суды үнемдеу қажет.";
  return "Апатты құрғақшылық — су ресурстарын қатаң үнемдеңіз.";
}
function mosquitoAdvice(idx: number): string {
  if (idx < 20) return "Маса жоқтың қасы — қорғану қажет емес.";
  if (idx < 35) return "Маса аз — қорғану қажеті шамалы.";
  if (idx < 50) return "Орташа төмен — кешке репеллент жеткілікті.";
  if (idx < 65) return "Орташа жоғары — репеллент пен жабық киім қажет.";
  return "Маса өте көп — репеллент, тор қажет, тұрған суды құрғатыңыз.";
}
function soilAdvice(stress: number): string {
  if (stress < 25) return "Топырақ сау әрі ылғалды — деградация қаупі төмен.";
  if (stress < 45) return "Топырақ қалыпты — елеулі стресс жоқ.";
  if (stress < 65) return "Орташа стресс — құрғау мен тұздану басталуы мүмкін.";
  return "Жоғары стресс — топырақ құрғаған, шөлейттену қаупі бар.";
}
function flaresAdvice(count: number): string {
  if (count <= 3) return "Бірнеше факел — қалыпты мұнай-газ белсенділігі.";
  if (count <= 10) return "Факел саны орташа — ауаға жану өнімдері бөлінуде.";
  return "Факел көп — ауа сапасына әсер ететін қарқынды жану.";
}
function compassKz(deg: number): string {
  const dirs = ["Солтүстік", "Солтүстік-шығыс", "Шығыс", "Оңтүстік-шығыс", "Оңтүстік", "Оңтүстік-батыс", "Батыс", "Солтүстік-батыс"];
  return dirs[Math.round(deg / 45) % 8];
}
function windAdvice(maxSpeed: number): string {
  if (maxSpeed < 15) return "Жел әлсіз — қалыпты жағдай.";
  if (maxSpeed < 30) return "Жел орташа — шаң аздап көтеріледі.";
  if (maxSpeed < 45) return "Жел күшті — шаң мен ластану тез таралады, өрт қаупі артады.";
  return "Дауыл — өте қатты жел, далада сақ болыңыз.";
}
function waterAdvice(level: string): string {
  if (level.includes("Жоғары")) return "Тасқын қаупі жоғары — өзен жайылмасынан аулақ болыңыз.";
  if (level.includes("Орташа")) return "Су деңгейі көтерілуде — жағада сақ болыңыз.";
  if (level.includes("Бақылауда")) return "Су деңгейі бақылауда — әзірге қауіп жоқ.";
  return "Өзен деңгейі қалыпты — тасқын қаупі жоқ.";
}

// WAQI жердегі станса US EPA AQI шкаласын қолданады (біздің EU aqiCategory-мен бөлек)
function usAqiColor(a: number): string {
  return a <= 50 ? "#22c55e" : a <= 100 ? "#eab308" : a <= 150 ? "#f97316" : a <= 200 ? "#ef4444" : a <= 300 ? "#a855f7" : "#7f1d1d";
}

// Болжам footprint шеңберін GeoJSON сақина ретінде жасау
function fcCircle(lat: number, lng: number, radiusKm: number): [number, number][] {
  const ring: [number, number][] = [];
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * 2 * Math.PI;
    const dLat = (radiusKm / 111) * Math.cos(a);
    const dLng = (radiusKm / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(a);
    ring.push([lng + dLng, lat + dLat]);
  }
  return ring;
}

export function MapView() {
  const { lang, tr } = useLang();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef>(null);
  const userSites = useSitesStore((s) => s.userSites);
  const addSite = useSitesStore((s) => s.addSite);
  const addAlert = useSitesStore((s) => s.addAlert);
  const [addOpen, setAddOpen] = useState(false);
  const [addLat, setAddLat] = useState("");
  const [addLng, setAddLng] = useState("");
  const [selected, setSelected] = useState<Site | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "streets">("satellite");
  const [activeLayer, setActiveLayer] = useState<LayerKey | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const [showReports, setShowReports] = useState(true);
  const [sourceMode, setSourceMode] = useState(false); // Ластану көзін анықтау режимі
  // Біріккен AI талдау: қосулы болғанда «нүкте» немесе «аумақ» режимінде істейді
  const [aiOn, setAiOn] = useState(false);
  const [aiTool, setAiTool] = useState<"point" | "area">("point");
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]); // [lng, lat] төбелер
  const [analyzedArea, setAnalyzedArea] = useState<[number, number][] | null>(null); // талданған аумақ (айқын белгіленеді)
  // last index = "Қазір" (current Mapbox imagery)
  const [yearIdx, setYearIdx] = useState(HISTORY_YEARS.length);

  const isHistoricYear = yearIdx < HISTORY_YEARS.length;
  const year = isHistoricYear ? HISTORY_YEARS[yearIdx] : null;
  // The imagery year currently on screen: null = current Mapbox imagery
  const viewYear = historyMode ? year : null;
  // Each imagery year keeps its own set of analysis points
  const allSites = useMemo(
    () => userSites.filter((s) => (s.imageryYear ?? null) === viewYear),
    [userSites, viewYear]
  );
  const sharedReports = useSharedReports();

  // Citizen photo reports: shared (Supabase) + any local ones not yet synced
  const photoReports = useMemo(() => {
    const localPhotos = userSites.filter((s) => !!s.photoThumb && !s.imageryYear);
    const sharedIds = new Set(sharedReports.map((s) => s.id));
    return [...sharedReports, ...localPhotos.filter((s) => !sharedIds.has(s.id))];
  }, [userSites, sharedReports]);

  // Waste layer = every dumping signal (AI analyses + citizen reports), crowdsourced
  const wasteSites = useMemo(() => {
    const fromAnalyses = userSites.filter((s) => !s.imageryYear && s.analysis.illegalDumping);
    const fromReports = sharedReports.filter((s) => s.analysis.illegalDumping);
    const seen = new Set<string>();
    return [...fromReports, ...fromAnalyses].filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  }, [userSites, sharedReports]);
  const layerDef = LAYERS.find((l) => l.key === activeLayer);
  const { airGrid, airDominant, airError } = useAirGrid(activeLayer === "air");
  const [airHour, setAirHour] = useState(0); // 0 = now … 23 = +23h
  const [airPlaying, setAirPlaying] = useState(false);

  // 24h forecast animation
  useEffect(() => {
    if (!airPlaying || activeLayer !== "air") return;
    const t = setInterval(() => setAirHour((h) => (h + 1) % 24), 700);
    return () => clearInterval(t);
  }, [airPlaying, activeLayer]);

  const airHourAqi = (p: AirGridPoint) => p.hourly?.[airHour]?.aqi ?? p.aqi;
  const airHours = airGrid?.[0]?.hourly;

  const { soilGrid, soilMeta, soilError } = useSoilGrid(activeLayer === "soil");

  const { flood, floodError } = useFlood(activeLayer === "water");

  const { flares, flaresError } = useFlares(activeLayer === "oil");

  // Өрт қаупі (FWI) — қабат белсенді болғанда жүктеледі
  const [fireData, setFireData] = useState<{
    fwi: number; dangerLabel: string; dangerColor: string;
    isi: number; bui: number; dc: number; spinupDays: number;
  } | null>(null);
  const [fireError, setFireError] = useState(false);
  useEffect(() => {
    if (activeLayer !== "fire") return;
    setFireError(false);
    fetch("/api/fire")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFireData)
      .catch(() => setFireError(true));
  }, [activeLayer]);

  // Жел бағыты — қабат белсенді болғанда жүктеледі
  const [windData, setWindData] = useState<{
    grid: { lat: number; lng: number; speed: number; dir: number }[];
    avgSpeed: number; maxSpeed: number; dominantDir: number;
  } | null>(null);
  const [windError, setWindError] = useState(false);
  useEffect(() => {
    if (activeLayer !== "wind") return;
    setWindError(false);
    fetch("/api/windgrid")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setWindData)
      .catch(() => setWindError(true));
  }, [activeLayer]);

  // Құрғақшылық (SPI) — қабат белсенді болғанда жүктеледі
  const [droughtData, setDroughtData] = useState<{
    spi: number; droughtLabel: string; droughtColor: string;
    precip3m: number; yearsOfRecord: number; period: string;
  } | null>(null);
  const [droughtError, setDroughtError] = useState(false);
  useEffect(() => {
    if (activeLayer !== "drought") return;
    setDroughtError(false);
    fetch("/api/drought")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDroughtData)
      .catch(() => setDroughtError(true));
  }, [activeLayer]);

  // When the oil layer opens, fit the map to the real flare locations
  useEffect(() => {
    if (activeLayer !== "oil" || !flares || flares.length === 0) return;
    const lats = flares.map((f) => f.lat);
    const lngs = flares.map((f) => f.lng);
    mapRef.current?.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: 120, duration: 1400, maxZoom: 11 }
    );
  }, [activeLayer, flares]);

  const { mosGrid, mosError } = useMosquitoGrid(activeLayer === "mosquito");

  // Ластану көзін анықтау — тірі CAMS + жел → ықтимал өнеркәсіп көзі
  const { source, sourceError } = usePollutionSource(sourceMode);
  const plumeLine = useMemo(() => {
    if (!source?.detected || !source.top || !source.plume.length) return null;
    const coords: [number, number][] = [
      [source.top.lng, source.top.lat],
      ...source.plume.map((p) => [p.lng, p.lat] as [number, number]),
    ];
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } }],
    };
  }, [source]);
  // Уақыт-анимация: соңғы 24 сағаттағы желмен конустың қозғалысы
  const [sourcePlaying, setSourcePlaying] = useState(false);
  const [sourceFrame, setSourceFrame] = useState(0);
  useEffect(() => {
    if (!sourcePlaying || !source?.frames?.length) return;
    const t = setInterval(() => setSourceFrame((f) => (f + 1) % source.frames.length), 450);
    return () => clearInterval(t);
  }, [sourcePlaying, source]);
  // Белсенді конус: ойнатылып жатса — кадр, әйтпесе ағымдағы
  const activeCone = useMemo(() => {
    if (!source?.detected) return null;
    if (sourcePlaying && source.frames?.length) return source.frames[sourceFrame % source.frames.length]?.cone;
    return source.cone?.length ? source.cone : null;
  }, [source, sourcePlaying, sourceFrame]);
  const activeFrame = sourcePlaying && source?.frames?.length ? source.frames[sourceFrame % source.frames.length] : null;
  const plumeConeGeo = useMemo(() => {
    if (!activeCone?.length) return null;
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [activeCone] } }],
    };
  }, [activeCone]);
  // Дисперсия болжамы: таңдалған көкжиек (30мин/1сағ/3сағ) footprint шеңбері
  const [fcStep, setFcStep] = useState<number | null>(null);
  const forecastGeo = useMemo(() => {
    if (fcStep == null || !source?.forecast?.[fcStep]) return null;
    const f = source.forecast[fcStep];
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "Polygon" as const, coordinates: [fcCircle(f.lat, f.lng, f.radiusKm)] } }],
    };
  }, [fcStep, source]);
  // Газ-мұнай көздері метан шығарады → Sentinel-5P CH₄ қабатын ұсыну
  const topEmitsMethane = !!source?.top && ["tco", "kpi", "bolashak"].includes(source.top.id);
  // Жоғары сенімді көзді «Ескертулер» бөліміне жіберу
  const sendSourceAlert = () => {
    if (!source?.top) return;
    const conf = source.top.confidence;
    const riskLevel = conf >= 70 ? "critical" : conf >= 50 ? "high" : "medium";
    addAlert({
      id: `alert-source-${source.top.id}`,
      siteId: `source-${source.top.id}`,
      siteName: `Ластану көзі: ${source.top.name}`,
      lat: source.top.lat,
      lng: source.top.lng,
      riskScore: conf,
      riskLevel,
      recipient: "Атырау облысының экология департаменті",
      reason: `Ауа ластану көзі анықталды (${source.pollutantLabel}, сенімділік ${conf}%) — өнеркәсіптік эмиссия тексерілуі қажет`,
      createdAt: new Date().toISOString(),
      status: "sent",
    });
    toast.success(tr("Ескерту жіберілді — «Ескертулер» бөлімінен қараңыз"));
  };
  // Зауыт басылғанда сол координатаның тірі ауа сапасын көрсету
  interface FacAir { aqi: number | null; pm2_5: number | null; pm10: number | null; so2: number | null; no2: number | null }
  interface StationAir {
    found: boolean; source?: string; station?: string; distanceKm?: number | null; time?: string | null;
    aqi?: number | null; dominant?: string | null;
    iaqi?: { pm25: number | null; pm10: number | null; no2: number | null; so2: number | null; o3: number | null; co: number | null };
  }
  const [facAir, setFacAir] = useState<
    { fac: PollutionSourceCandidate; data: FacAir | null; station: StationAir | null; error: boolean } | null
  >(null);
  const openFacilityAir = useCallback((fac: PollutionSourceCandidate) => {
    setFacAir({ fac, data: null, station: null, error: false });
    // Екеуін қатар тартамыз: нақты жердегі станса (Qazhydromet/WAQI) + CAMS моделі
    fetch(`/api/station-air?lat=${fac.lat}&lng=${fac.lng}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((st: StationAir | null) => setFacAir((cur) => (cur && cur.fac.id === fac.id ? { ...cur, station: st } : cur)))
      .catch(() => {});
    fetch(`/api/point-air?lat=${fac.lat}&lng=${fac.lng}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setFacAir((cur) => (cur && cur.fac.id === fac.id ? (d.error ? { ...cur, error: true } : { ...cur, data: d }) : cur)))
      .catch(() => setFacAir((cur) => (cur && cur.fac.id === fac.id ? { ...cur, error: true } : cur)));
  }, []);
  // Азаматтық растау: plume конусы ішіндегі ластану хабарламаларын санау
  const sourceCorroboration = useMemo(() => {
    if (!source?.detected || !source.cone?.length) return 0;
    const ring = source.cone;
    const inside = (lng: number, lat: number) => {
      let hit = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    return photoReports.filter(
      (s) => (s.analysis.oilPollution || s.analysis.riskScore >= 55) && inside(s.lng, s.lat)
    ).length;
  }, [source, photoReports]);

  const [timelapsePlaying, setTimelapsePlaying] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true); // эко қабаттар панелі (мобильде жинауға болады)
  const [gibsKey, setGibsKey] = useState<string | null>(null);

  // Атмосфера газ қабаты белсенді болса CAMS деректерін жүктеу
  const ATMOS_GAS_KEYS = ["no2", "so2", "ch4", "co"] as const;
  type AtmosGasKey = typeof ATMOS_GAS_KEYS[number];
  const atmosGasActive = ATMOS_GAS_KEYS.includes(gibsKey as AtmosGasKey);
  const { airGrid: atmosAirGrid } = useAirGrid(atmosGasActive);

  // Белсенді газдың Атырау облысы бойынша орташа мәні
  const atmosLevel = useMemo(() => {
    if (!gibsKey || !ATMOS_GAS_KEYS.includes(gibsKey as AtmosGasKey) || !atmosAirGrid) return null;
    const key = gibsKey as AtmosGasKey;
    const vals = atmosAirGrid.map((p) => p[key] ?? 0).filter((v) => v > 0);
    if (!vals.length) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const max = Math.max(...vals);
    const units: Record<AtmosGasKey, string> = {
      no2: "мкг/м³", so2: "мкг/м³", ch4: "мкг/м³", co: "мкг/м³"
    };
    return { avg: avg.toFixed(1), max: max.toFixed(1), unit: units[key] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gibsKey, atmosAirGrid]);

  const [gibsPanelOpen, setGibsPanelOpen] = useState(true); // оң жақ спутник панелі
  const [mosDay, setMosDay] = useState(0); // 0 = today … 6 = +6 days
  const [mosPlaying, setMosPlaying] = useState(false);

  // Timelapse: auto-advance through historical years
  useEffect(() => {
    if (!timelapsePlaying || !historyMode) return;
    const t = setInterval(() => {
      setYearIdx((i) => {
        if (i >= HISTORY_YEARS.length) { setTimelapsePlaying(false); return i; }
        return i + 1;
      });
    }, 1400);
    return () => clearInterval(t);
  }, [timelapsePlaying, historyMode]);

  // Animation: step through the 7 forecast days
  useEffect(() => {
    if (!mosPlaying || activeLayer !== "mosquito") return;
    const t = setInterval(() => setMosDay((d) => (d + 1) % 7), 900);
    return () => clearInterval(t);
  }, [mosPlaying, activeLayer]);

  // Index for the selected forecast day (falls back to current index)
  const mosDayIndex = (p: MosquitoGridPoint) => p.days?.[mosDay]?.index ?? p.index;
  const mosDays = mosGrid?.[0]?.days;

  const mosStats = useMemo(() => {
    if (!mosGrid?.length) return null;
    const vals = mosGrid.map(mosDayIndex);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      hottest: mosGrid.reduce((a, b) => (mosDayIndex(b) > mosDayIndex(a) ? b : a)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosGrid, mosDay]);

  const airStats = useMemo(() => {
    const vals = (airGrid ?? []).map(airHourAqi).filter((v): v is number => v != null);
    if (!vals.length) return null;
    // city districts ranked by AQI (best → worst)
    const districts = (airGrid ?? [])
      .filter((p) => p.dense && airHourAqi(p) != null)
      .map((p) => ({ name: p.name ?? "?", aqi: airHourAqi(p)! }))
      .sort((a, b) => a.aqi - b.aqi);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      districts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airGrid, airHour]);

  const heatmapData = useMemo(() => {
    if (!activeLayer) return null;
    // Air layer: real live AQI grid; other layers: platform analyses
    if (activeLayer === "air") {
      if (!airGrid) return null;
      return {
        type: "FeatureCollection" as const,
        features: airGrid
          .filter((p) => airHourAqi(p) != null)
          .map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
            properties: { weight: Math.min(1, (airHourAqi(p) ?? 0) / 100) },
          })),
      };
    }
    if (activeLayer === "mosquito") {
      if (!mosGrid) return null;
      return {
        type: "FeatureCollection" as const,
        features: mosGrid.map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          properties: { weight: Math.min(1, mosDayIndex(p) / 100) },
        })),
      };
    }
    if (activeLayer === "soil") {
      if (!soilGrid) return null;
      return {
        type: "FeatureCollection" as const,
        features: soilGrid.map((p) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          properties: { weight: Math.min(1, p.stress / 100) },
        })),
      };
    }
    if (activeLayer === "waste") {
      return {
        type: "FeatureCollection" as const,
        features: wasteSites.map((s) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
          properties: { weight: Math.min(1, s.analysis.riskScore / 100) },
        })),
      };
    }
    return {
      type: "FeatureCollection" as const,
      features: allSites.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { weight: layerWeight(s, activeLayer) },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSites, activeLayer, airGrid, mosGrid, mosDay, airHour, soilGrid, wasteSites]);

  // Grid layers need a wide radius — sparse regional points
  const isGridLayer = activeLayer === "air" || activeLayer === "mosquito" || activeLayer === "soil";

  // Scatter mosquito icons around each grid point — count scales with the live index
  const mosquitoSwarm = useMemo(() => {
    if (activeLayer !== "mosquito" || !mosGrid) return [];
    const swarm: { id: string; lat: number; lng: number; size: number; color: string }[] = [];
    for (const p of mosGrid) {
      const idx = mosDayIndex(p);
      const color = idx < 25 ? "#6ee7b7" : idx < 45 ? "#4ade80" : idx < 62 ? "#facc15" : idx < 78 ? "#fb923c" : "#ef4444";
      if (p.dense) {
        // Қала нүктесі — әрқашан дәл координатта бір иконка
        swarm.push({ id: `${p.lat},${p.lng},${mosDay}`, lat: p.lat, lng: p.lng, size: 16, color });
      } else {
        // Аймақтық тор — кең шашыратылған 1–5 иконка
        const count = idx < 40 ? 1 : idx < 60 ? 2 : idx < 80 ? 3 : 5;
        for (let i = 0; i < count; i++) {
          const a = Math.sin(p.lat * 91 + p.lng * 47 + i * 13);
          const b = Math.cos(p.lat * 53 + p.lng * 71 + i * 29);
          swarm.push({
            id: `${p.lat},${p.lng},${mosDay},${i}`,
            lat: p.lat + a * 0.13,
            lng: p.lng + b * 0.18,
            size: 12,
            color,
          });
        }
      }
    }
    return swarm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, mosGrid, mosDay]);

  const analyzeAt = useCallback(
    async (lat: number, lng: number, opts?: { zoom?: number; areaKm2?: number; imageUrl?: string }) => {
      if (analyzing) return;
      setAnalyzing(true);
      try {
        // Нүкте режимі → көп дереккөзді агент (спутник + тірі деректер).
        // Аумақ режимі (opts.areaKm2) → таңдалған аймақтың спутник талдауы.
        if (!opts?.areaKm2) {
          // AI agent: zoom the map to the point itself, then synthesise
          // satellite imagery + live official data (CAMS, weather)
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1400 });
          toast.info(tr("🤖 AI агент картаны жақындатып, спутник + тірі ресми деректерді талдап жатыр…"));
          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng, lang }),
          });
          if (!res.ok) throw new Error();
          const data = await res.json();
          const site: Site = {
            id: `agent-${Date.now()}`,
            lat,
            lng,
            name: "AI агент бағалауы",
            district: "Атырау облысы",
            // analysisLang төменде
            mode: "satellite",
            analysis: data.analysis,
            mosquitoRiskIndex: data.mri,
            imageUrl: data.imageUrl,
            createdAt: new Date().toISOString(),
            analysisLang: lang,
            flagged: data.analysis.riskScore >= 80,
          };
          addSite(site);
          setSelected(site);
          toast.success(
            data.mock ? "AI агент бағалауы дайын (демо режимі)" : "🤖 AI агент көп дереккөзді бағалауы дайын!"
          );
        } else {
          toast.info(
            viewYear
              ? `AI ${viewYear} ${tr("жылғы Sentinel-2 суретін талдап жатыр…")}`
              : tr("AI спутник суретін талдап жатыр…")
          );
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "satellite", lat, lng, imageryYear: viewYear, zoom: opts?.zoom, areaKm2: opts?.areaKm2, lang }),
          });
          if (!res.ok) throw new Error("API қатесі");
          const data = await res.json();
          const site: Site = {
            id: `user-${Date.now()}`,
            lat,
            lng,
            district: "Атырау облысы",
            mode: "satellite",
            imageryYear: viewYear,
            analysis: data.analysis,
            mosquitoRiskIndex: mosquitoRiskIndex(lat, lng, data.analysis.standingWater),
            // Аумақ режимінде — полигон шекарасы белгіленген спутник суреті
            imageUrl: opts?.imageUrl ?? data.imageUrl,
            areaKm2: opts?.areaKm2,
            createdAt: new Date().toISOString(),
            analysisLang: lang,
            flagged: false,
          };
          addSite(site);
          setSelected(site);
          toast.success(data.mock ? tr("Талдау дайын (демо режимі — API кілті жоқ)") : tr("AI талдауы дайын!"));
          if (data.analysis.riskScore >= 55) {
            toast.warning(tr("⚠️ Жоғары тәуекел! Жауапты органға хабарлама автоматты жіберілді"), {
              description: tr("Толығырақ: «Ескертулер» бөлімінде"),
            });
          }
        }
      } catch {
        toast.error(tr("Талдау сәтсіз аяқталды. Қайталап көріңіз."));
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing, addSite, viewYear, lang]
  );

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!aiOn) return;
      if (aiTool === "area") {
        // Аумақ режимі: басқан жерге полигон төбесін қосады (жаңа сызу — ескі белгіні тазалайды)
        setAnalyzedArea(null);
        setDrawPoints((pts) => [...pts, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }
      // Нүкте режимі: сол жерді көп дереккөзді агент талдайды
      setAnalyzedArea(null);
      analyzeAt(e.lngLat.lat, e.lngLat.lng);
    },
    [analyzeAt, aiOn, aiTool]
  );

  // Сызылған полигонның центроиді, ауданы (км²) және сай масштабы
  const finishAreaAnalysis = useCallback(() => {
    if (drawPoints.length < 3) return;
    const lngs = drawPoints.map((p) => p[0]);
    const lats = drawPoints.map((p) => p[1]);
    const cLng = lngs.reduce((a, b) => a + b, 0) / drawPoints.length;
    const cLat = lats.reduce((a, b) => a + b, 0) / drawPoints.length;
    // Shoelace ауданы (метрге шамалап)
    const mPerDegLat = 111_320;
    const mPerDegLng = 111_320 * Math.cos((cLat * Math.PI) / 180);
    let area2 = 0;
    for (let i = 0; i < drawPoints.length; i++) {
      const [x1, y1] = drawPoints[i];
      const [x2, y2] = drawPoints[(i + 1) % drawPoints.length];
      area2 += (x1 * mPerDegLng) * (y2 * mPerDegLat) - (x2 * mPerDegLng) * (y1 * mPerDegLat);
    }
    const areaKm2 = Math.abs(area2 / 2) / 1e6;
    // Масштабты аумақ ауқымынан есептеу
    const spanLng = Math.max(...lngs) - Math.min(...lngs);
    const spanLat = (Math.max(...lats) - Math.min(...lats)) * Math.cos((cLat * Math.PI) / 180);
    const span = Math.max(spanLng, spanLat, 0.0008);
    const zoom = Math.max(11, Math.min(16, Math.round(Math.log2(720 / span) - 0.4)));
    mapRef.current?.flyTo({ center: [cLng, cLat], zoom: Math.min(zoom, 15), duration: 1000 });

    // Полигон шекарасы белгіленген спутник суреті (Mapbox Static GeoJSON overlay,
    // auto — дәл аумаққа шақталады). Талдау нәтижесінде осы айқын сурет көрінеді.
    const ring = [...drawPoints, drawPoints[0]];
    const overlay = {
      type: "Feature",
      properties: { stroke: "#38bdf8", "stroke-width": 4, "stroke-opacity": 1, fill: "#38bdf8", "fill-opacity": 0.12 },
      geometry: { type: "Polygon", coordinates: [ring] },
    };
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
    const areaImageUrl =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
      `geojson(${encodeURIComponent(JSON.stringify(overlay))})/auto/1024x1024?padding=50&access_token=${token}`;

    setAnalyzedArea([...drawPoints]); // картада да айқын белгіленіп қалады
    setDrawPoints([]);
    analyzeAt(cLat, cLng, { zoom, areaKm2, imageUrl: areaImageUrl });
  }, [drawPoints, analyzeAt]);

  const addByCoords = () => {
    const la = parseFloat(addLat), ln = parseFloat(addLng);
    if (isNaN(la) || isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
      toast.error(tr("Координаттар жарамсыз"));
      return;
    }
    setAddOpen(false);
    setAddLat("");
    setAddLng("");
    analyzeAt(la, ln);
  };

  if (!token) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <div className="max-w-md rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 text-center">
          <Satellite className="mx-auto mb-3 h-8 w-8 text-yellow-400" />
          <h2 className="mb-2 font-semibold text-white">Mapbox токені керек</h2>
          <p className="text-sm text-neutral-400">
            <code className="rounded bg-white/10 px-1">.env.local</code> файлына{" "}
            <code className="rounded bg-white/10 px-1">NEXT_PUBLIC_MAPBOX_TOKEN</code> қосыңыз да,
            серверді қайта іске қосыңыз.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100dvh-3.5rem)] overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={ATYRAU}
        mapStyle={
          mapStyle === "satellite"
            ? "mapbox://styles/mapbox/satellite-streets-v12"
            : "mapbox://styles/mapbox/dark-v11"
        }
        onClick={handleClick}
        cursor={analyzing ? "wait" : aiOn ? "crosshair" : "grab"}
      >
        {/* Real historical Sentinel-2 mosaic for the selected year */}
        {historyMode && year && (
          <Source
            key={`hist-${year}`}
            id="hist-imagery"
            type="raster"
            tiles={yearTileConfig(year).tiles}
            tileSize={256}
            maxzoom={yearTileConfig(year).maxzoom}
            attribution={yearTileConfig(year).attribution}
          >
            <Layer id="hist-imagery-layer" type="raster" paint={{ "raster-opacity": 1 }} />
          </Source>
        )}
        {/* NASA GIBS спутник қабаты (нақты MODIS/VIIRS тайлдары) */}
        {gibsKey && (() => {
          const def = findSatLayer(gibsKey);
          if (!def) return null;
          return (
            <Source
              key={`gibs-${gibsKey}`}
              id="gibs-layer"
              type="raster"
              tiles={gibsTiles(def)}
              tileSize={def.tileSize}
              maxzoom={def.maxzoom}
              attribution={def.source === "sentinel" ? "Sentinel-2 · Copernicus / Sentinel Hub" : "NASA GIBS / EOSDIS"}
            >
              <Layer
                id="gibs-raster"
                type="raster"
                paint={{
                  "raster-opacity": Math.min(1, def.opacity * 1.2),
                  "raster-contrast": 0.3,
                  "raster-saturation": 0.4,
                  "raster-resampling": "linear",
                  "raster-fade-duration": 200,
                }}
              />
            </Source>
          );
        })()}


        {/* Сызылған аумақ (полигон) */}
        {drawPoints.length > 0 && (
          <>
            <Source
              id="draw-area"
              type="geojson"
              data={{
                type: "Feature",
                properties: {},
                geometry:
                  drawPoints.length >= 3
                    ? { type: "Polygon", coordinates: [[...drawPoints, drawPoints[0]]] }
                    : { type: "LineString", coordinates: drawPoints },
              }}
            >
              <Layer id="draw-fill" type="fill" paint={{ "fill-color": "#38bdf8", "fill-opacity": 0.18 }} />
              <Layer id="draw-line" type="line" paint={{ "line-color": "#38bdf8", "line-width": 2, "line-dasharray": [2, 1] }} />
            </Source>
            {drawPoints.map((p, i) => (
              <Marker key={`dp-${i}`} longitude={p[0]} latitude={p[1]}>
                <div className="h-2.5 w-2.5 rounded-full border border-white bg-sky-400 shadow" />
              </Marker>
            ))}
          </>
        )}

        {/* Талданған аумақ — айқын белгіленген (анализден кейін қалады) */}
        {analyzedArea && analyzedArea.length >= 3 && (
          <Source
            id="analyzed-area"
            type="geojson"
            data={{
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [[...analyzedArea, analyzedArea[0]]] },
            }}
          >
            <Layer id="analyzed-fill" type="fill" paint={{ "fill-color": "#38bdf8", "fill-opacity": 0.12 }} />
            <Layer id="analyzed-outline" type="line" paint={{ "line-color": "#38bdf8", "line-width": 3 }} />
            <Layer
              id="analyzed-glow"
              type="line"
              paint={{ "line-color": "#7dd3fc", "line-width": 8, "line-opacity": 0.25, "line-blur": 4 }}
            />
          </Source>
        )}

        {heatmapData && layerDef && (
          <Source id="eco-layer" type="geojson" data={heatmapData}>
            <Layer
              id="eco-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "weight"],
                // grid layers are sparse regional points — need a much wider radius
                "heatmap-radius": isGridLayer
                  ? ["interpolate", ["linear"], ["zoom"], 5, 90, 8, 220, 10, 400]
                  : ["interpolate", ["linear"], ["zoom"], 6, 40, 10, 90],
                "heatmap-intensity": isGridLayer ? 1 : 2,
                "heatmap-opacity": 0.7,
                "heatmap-color": [
                  "interpolate", ["linear"], ["heatmap-density"],
                  0, "rgba(0,0,0,0)",
                  0.2, layerDef.ramp[0],
                  0.5, layerDef.ramp[1],
                  0.8, layerDef.ramp[2],
                  1, layerDef.ramp[3],
                ],
              }}
            />
          </Source>
        )}

        {/* Жел бағыты — стрелкалар (желдің КЕТЕТІН бағытын көрсетеді) */}
        {activeLayer === "wind" && windData?.grid.map((w, i) => (
          <Marker key={`wind-${i}`} latitude={w.lat} longitude={w.lng}>
            <div
              title={`${Math.round(w.speed)} км/сағ`}
              style={{ transform: `rotate(${w.dir + 180}deg)`, opacity: Math.min(1, 0.45 + w.speed / 30) }}
            >
              <svg width={14 + Math.min(14, w.speed / 2)} height={14 + Math.min(14, w.speed / 2)} viewBox="0 0 24 24" className="drop-shadow">
                <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#67e8f9" stroke="#0e7490" strokeWidth="1" />
              </svg>
            </div>
          </Marker>
        ))}

        {/* Live mosquito swarm — icon density follows the real suitability index */}
        {mosquitoSwarm.map((m) => (
          <Marker key={m.id} latitude={m.lat} longitude={m.lng}>
            <MosquitoIcon size={m.size} style={{ color: m.color, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.6))" }} />
          </Marker>
        ))}

        {/* Live Zhaiyk river discharge points (GloFAS) — water layer */}
        {activeLayer === "water" &&
          flood?.map((p) => (
            <Marker key={`flood-${p.name}`} latitude={p.lat} longitude={p.lng}>
              <div
                title={`${p.name}: ${p.discharge} м³/с · ${p.level} · тренд ${p.trend}`}
                className="flex flex-col items-center"
              >
                <div
                  className="rounded-full border-2 border-white/80 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-md"
                  style={{ backgroundColor: p.color }}
                >
                  {Math.round(p.discharge)}
                </div>
              </div>
            </Marker>
          ))}

        {/* Waste sites (AI + citizen reports) — waste layer */}
        {activeLayer === "waste" &&
          wasteSites.map((s) => (
            <Marker
              key={`waste-${s.id}`}
              latitude={s.lat}
              longitude={s.lng}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(s);
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white/80 shadow-md transition-transform hover:scale-125"
                style={{ backgroundColor: RISK_COLORS[s.analysis.riskLevel] }}
                title={`${s.name ?? "Қоқыс нүктесі"} · тәуекел ${s.analysis.riskScore}`}
              >
                <Trash2 className="h-3 w-3 text-white" />
              </div>
            </Marker>
          ))}

        {/* Live gas flares (NASA FIRMS) — oil layer */}
        {activeLayer === "oil" &&
          flares?.map((f, i) => (
            <Marker key={`flare-${i}`} latitude={f.lat} longitude={f.lng}>
              <div
                title={`Жану нүктесі · FRP ${f.frp}МВт · ${f.acqDate} · сенімділік ${f.confidence}`}
                className="flex items-center justify-center"
              >
                <Flame
                  className="text-orange-400 drop-shadow"
                  style={{ width: 12 + Math.min(14, f.frp / 3), height: 12 + Math.min(14, f.frp / 3) }}
                  fill="#fb923c"
                />
              </div>
            </Marker>
          ))}

        {/* Analysis points (non-photo) for the current imagery year */}
        {allSites
          .filter((s) => !s.photoThumb)
          .map((s) => (
            <Marker
              key={s.id}
              latitude={s.lat}
              longitude={s.lng}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(s);
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white/80 text-[10px] shadow-lg transition-transform hover:scale-125"
                style={{ backgroundColor: RISK_COLORS[s.analysis.riskLevel] }}
                title={s.name}
              >
                {s.analysis.verificationStatus === "confirmed" ? "✓" : ""}
              </div>
            </Marker>
          ))}

        {/* Citizen photo-report layer — real photo thumbnails as map points */}
        {showReports &&
          photoReports.map((s) => (
            <Marker
              key={s.id}
              latitude={s.lat}
              longitude={s.lng}
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                setSelected(s);
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-white/90 text-white shadow-md transition-transform hover:scale-125"
                style={{ backgroundColor: RISK_COLORS[s.analysis.riskLevel] }}
                title={s.name}
              >
                <Camera className="h-3 w-3" />
              </div>
            </Marker>
          ))}

        {/* Ластану көзі режимі: дисперсия конусы + plume сызығы + маркерлер */}
        {sourceMode && plumeConeGeo && (
          <Source id="plume-cone" type="geojson" data={plumeConeGeo}>
            <Layer
              id="plume-cone-fill"
              type="fill"
              paint={{ "fill-color": "#ef4444", "fill-opacity": 0.14 }}
            />
            <Layer
              id="plume-cone-outline"
              type="line"
              paint={{ "line-color": "#f87171", "line-width": 1, "line-opacity": 0.4 }}
            />
          </Source>
        )}
        {sourceMode && source?.detected && source.top && (
          <Marker latitude={source.top.lat} longitude={source.top.lng}>
            <div
              className="transition-transform duration-300"
              style={{ transform: `rotate(${sourcePlaying && activeFrame ? activeFrame.toBearing : source.wind.toBearing}deg)` }}
              title="Жел бағыты"
            >
              <Navigation className="h-5 w-5 fill-red-400 text-red-300 drop-shadow" />
            </div>
          </Marker>
        )}
        {/* Ағып тұратын «түтін» бөлшектері — желмен таралу әсері */}
        {sourceMode && source?.detected && source.top && (() => {
          const b = ((sourcePlaying && activeFrame ? activeFrame.toBearing : source.wind.toBearing) * Math.PI) / 180;
          const D = 48;
          const style = { "--dx": `${Math.sin(b) * D}px`, "--dy": `${-Math.cos(b) * D}px` } as React.CSSProperties;
          return (
            <Marker latitude={source.top.lat} longitude={source.top.lng}>
              <div className="pointer-events-none relative" style={style}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="plume-particle" style={{ animationDelay: `${i * 0.5}s` }} />
                ))}
              </div>
            </Marker>
          );
        })()}
        {/* Дисперсия болжамы: бұлттың болашақ орны (footprint + орталық) */}
        {sourceMode && forecastGeo && fcStep != null && source?.forecast?.[fcStep] && (
          <>
            <Source id="fc-footprint" type="geojson" data={forecastGeo}>
              <Layer id="fc-fill" type="fill" paint={{ "fill-color": "#fb923c", "fill-opacity": 0.2 }} />
              <Layer id="fc-outline" type="line" paint={{ "line-color": "#fb923c", "line-width": 2, "line-dasharray": [2, 1.5] }} />
            </Source>
            <Marker latitude={source.forecast[fcStep].lat} longitude={source.forecast[fcStep].lng}>
              <div className="rounded-full border border-orange-300 bg-orange-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-lg">
                +{source.forecast[fcStep].label}
              </div>
            </Marker>
          </>
        )}
        {sourceMode && plumeLine && (
          <Source id="plume-line" type="geojson" data={plumeLine}>
            <Layer
              id="plume-line-layer"
              type="line"
              paint={{
                "line-color": "#f87171",
                "line-width": 3,
                "line-opacity": 0.7,
                "line-dasharray": [2, 1.5],
              }}
            />
          </Source>
        )}
        {sourceMode &&
          source?.detected &&
          source.plume.map((p) => (
            <Marker key={`plume-${p.name}`} latitude={p.lat} longitude={p.lng}>
              <div
                className="rounded-full border border-red-300/60 bg-red-500/70"
                style={{ width: 10 + p.relConc * 22, height: 10 + p.relConc * 22 }}
                title={`${p.name} — ${Math.round(p.relConc * 100)}%`}
              />
            </Marker>
          ))}
        {/* Нақты жердегі стансалар (Qazhydromet) — жасыл, AQI-мен */}
        {sourceMode &&
          source?.stations?.map((st, i) => (
            <Marker key={`st-${i}`} latitude={st.lat} longitude={st.lng}>
              <div
                className="flex items-center gap-1 rounded border border-emerald-400/60 bg-emerald-600/85 px-1 py-px text-[9px] font-bold text-white shadow"
                title={`${st.name ?? "Станса"} · нақты датчик · AQI ${st.aqi}`}
              >
                <Radio className="h-2.5 w-2.5" /> {st.aqi}
              </div>
            </Marker>
          ))}
        {sourceMode &&
          source?.candidates.map((c) => {
            const isTop = source.top?.id === c.id;
            return (
              <Marker
                key={`fac-${c.id}`}
                latitude={c.lat}
                longitude={c.lng}
                onClick={(e) => { e.originalEvent.stopPropagation(); openFacilityAir(c); }}
              >
                {/* Дәл нүкте: дот координатада тұрады, жапсырма қалқып тұр (anchor ауыспайды) */}
                <div className="relative cursor-pointer" title={`${c.name}${c.approx ? " (жуық координата)" : ""} — ауа сапасын көру`}>
                  <div
                    className={`h-2.5 w-2.5 rounded-full border-2 shadow transition-transform hover:scale-150 ${
                      isTop ? "border-white bg-red-500" : "border-white/70 bg-neutral-600"
                    }`}
                  />
                  <div
                    className={`pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-lg ${
                      isTop
                        ? "border-red-400 bg-red-500/90 text-white"
                        : "border-white/30 bg-neutral-900/85 text-neutral-300"
                    }`}
                  >
                    <Factory className="h-3 w-3" /> {c.short}{c.approx ? "~" : ""}
                    {isTop && <span className="ml-0.5">{c.confidence}%</span>}
                  </div>
                </div>
              </Marker>
            );
          })}

        {/* Зауыт басылғанда — сол координатаның тірі ауа сапасы */}
        {sourceMode && facAir && (
          <Popup
            latitude={facAir.fac.lat}
            longitude={facAir.fac.lng}
            anchor="bottom"
            offset={14}
            closeOnClick={false}
            onClose={() => setFacAir(null)}
            className="pollution-air-popup"
          >
            <div className="min-w-[180px] text-neutral-100">
              <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold">
                <Factory className="h-3 w-3 text-red-300" /> {facAir.fac.name}
              </div>

              {/* Нақты ЖЕРДЕГІ станса (Qazhydromet/WAQI) — датчик дәлдігі */}
              {facAir.station?.found && (
                <div className="mb-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[9px] font-semibold text-emerald-300">
                      <Radio className="h-2.5 w-2.5" /> {tr("Жердегі станса")}
                    </span>
                    {facAir.station.aqi != null && (
                      <span className="text-sm font-bold" style={{ color: usAqiColor(facAir.station.aqi) }}>
                        {facAir.station.aqi} US AQI
                      </span>
                    )}
                  </div>
                  <div className="text-[9px] text-neutral-300">
                    {facAir.station.station}
                    {facAir.station.distanceKm != null && ` · ${facAir.station.distanceKm} ${tr("км")}`}
                  </div>
                  {(facAir.station.iaqi?.so2 != null || facAir.station.iaqi?.no2 != null || facAir.station.iaqi?.pm25 != null) && (
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[9px] text-neutral-300">
                      {facAir.station.iaqi?.so2 != null && <span>SO₂ {facAir.station.iaqi.so2}</span>}
                      {facAir.station.iaqi?.no2 != null && <span>NO₂ {facAir.station.iaqi.no2}</span>}
                      {facAir.station.iaqi?.pm25 != null && <span>PM₂.₅ {facAir.station.iaqi.pm25}</span>}
                      {facAir.station.iaqi?.pm10 != null && <span>PM₁₀ {facAir.station.iaqi.pm10}</span>}
                    </div>
                  )}
                  <p className="mt-0.5 text-[8px] text-emerald-400/70">
                    {tr("AQI индексі · нақты датчик")} · {facAir.station.source}
                    {facAir.station.time ? ` · ${facAir.station.time.slice(11, 16)}` : ""}
                  </p>
                </div>
              )}

              {facAir.error ? (
                <p className="text-[10px] text-neutral-400">
                  {tr("Тірі ауа деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
                </p>
              ) : !facAir.data ? (
                <p className="text-[10px] text-neutral-400">{tr("Ауа сапасы жүктелуде…")}</p>
              ) : (
                <>
                  {facAir.station?.found && (
                    <div className="mb-1 text-[9px] font-semibold text-sky-300">{tr("Модель (CAMS · 11км орташа)")}</div>
                  )}
                  {facAir.data.aqi != null && (
                    <div
                      className="mb-1.5 flex items-center justify-between rounded px-2 py-1"
                      style={{ backgroundColor: aqiCategory(facAir.data.aqi).color + "26" }}
                    >
                      <span className="text-[10px] text-neutral-300">EU AQI</span>
                      <span className="text-sm font-bold" style={{ color: aqiCategory(facAir.data.aqi).color }}>
                        {Math.round(facAir.data.aqi)} · {tr(aqiCategory(facAir.data.aqi).name)}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                    {facAir.data.so2 != null && <div className="flex justify-between"><span className="text-neutral-400">SO₂</span><span>{facAir.data.so2.toFixed(1)}</span></div>}
                    {facAir.data.no2 != null && <div className="flex justify-between"><span className="text-neutral-400">NO₂</span><span>{facAir.data.no2.toFixed(1)}</span></div>}
                    {facAir.data.pm2_5 != null && <div className="flex justify-between"><span className="text-neutral-400">PM₂.₅</span><span>{facAir.data.pm2_5.toFixed(1)}</span></div>}
                    {facAir.data.pm10 != null && <div className="flex justify-between"><span className="text-neutral-400">PM₁₀</span><span>{facAir.data.pm10.toFixed(1)}</span></div>}
                  </div>
                  <p className="mt-1 text-[8px] text-neutral-500">µg/m³ · Copernicus CAMS</p>
                </>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Оң жақ — NASA спутник қабаттары панелі */}
      {gibsPanelOpen ? (
        <div className="absolute right-4 top-4 z-10 w-52 rounded-lg border border-white/10 bg-neutral-900/90 p-2 backdrop-blur">
          <div className="mb-1.5 flex items-center justify-between px-1">
            <span className="text-[10px] uppercase tracking-wide text-neutral-500">{tr("Спутник")} · {SAT_PROVIDER}</span>
            <button
              onClick={() => setGibsPanelOpen(false)}
              aria-label="Жасыру"
              className="rounded p-0.5 text-neutral-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex max-h-[calc(100dvh-9rem)] flex-col gap-1 overflow-y-auto pr-0.5">
            {GIBS_LAYERS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                title={g.descKz}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  gibsKey === g.key
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                    : "border-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                <Satellite className="h-3.5 w-3.5 flex-shrink-0" /> <span className="text-left leading-tight">{tr(g.labelKz)}</span>
              </button>
            ))}

            {/* Радар — Sentinel-1 (кілт болса) */}
            {RADAR_SAT_LAYERS.length > 0 && (
              <>
                <div className="mb-0.5 mt-2 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
                  {tr("Радар")} · Sentinel-1
                </div>
                {RADAR_SAT_LAYERS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                    title={g.descKz}
                    className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                      gibsKey === g.key
                        ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                        : "border-transparent text-neutral-300 hover:bg-white/5"
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5 flex-shrink-0" /> <span className="text-left leading-tight">{tr(g.labelKz)}</span>
                  </button>
                ))}
              </>
            )}

            {/* Атмосфералық газдар */}
            <div className="mb-0.5 mt-2 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
              {tr("Атмосфера")} · {ATMOS_PROVIDER}
            </div>
            {ATMOS_LAYERS.map((g) => (
              <div key={g.key}>
                <button
                  onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                  title={g.descKz}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    gibsKey === g.key
                      ? "border-fuchsia-500/50 bg-fuchsia-500/15 text-fuchsia-200"
                      : "border-transparent text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  <Wind className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-left leading-tight">{tr(g.labelKz)}</span>
                </button>
                {gibsKey === g.key && atmosLevel && (
                  <div className="mx-1 mb-1 rounded-md bg-fuchsia-950/50 px-2.5 py-1.5 text-[10px]">
                    <div className="flex justify-between text-neutral-400">
                      <span>Орташа · Атырау</span>
                      <span className="font-medium text-fuchsia-200">{atmosLevel.avg} {atmosLevel.unit}</span>
                    </div>
                    <div className="flex justify-between text-neutral-400">
                      <span>Максимум</span>
                      <span className="font-medium text-orange-300">{atmosLevel.max} {atmosLevel.unit}</span>
                    </div>
                  </div>
                )}
                {gibsKey === g.key && atmosGasActive && !atmosLevel && (
                  <div className="mx-1 mb-1 rounded-md bg-fuchsia-950/30 px-2.5 py-1 text-[10px] text-neutral-500">
                    Деңгей жүктелуде…
                  </div>
                )}
              </div>
            ))}


            {gibsKey && (
              <button
                onClick={() => setGibsKey(null)}
                className="mt-0.5 rounded-md border border-transparent px-2.5 py-1 text-[10px] text-neutral-500 hover:bg-white/5 hover:text-white"
              >
                Қабатты өшіру
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setGibsPanelOpen(true)}
          className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-xs text-white backdrop-blur hover:bg-neutral-800"
        >
          <Satellite className="h-4 w-4" /> {tr("Спутник")}
        </button>
      )}

      {/* Жиналған кездегі ашу батырмасы */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-xs text-white backdrop-blur hover:bg-neutral-800"
        >
          <Layers className="h-4 w-4" /> {tr("Қабаттар")}
        </button>
      )}

      {/* Layer panel */}
      <div
        className={`absolute left-4 top-4 bottom-4 flex max-h-[calc(100dvh-7rem)] flex-col gap-2 overflow-y-auto pr-1 ${
          panelOpen ? "flex" : "hidden"
        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapStyle((s) => (s === "satellite" ? "streets" : "satellite"))}
            className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-xs text-white backdrop-blur hover:bg-neutral-800"
          >
            <Layers className="h-4 w-4" />
            {mapStyle === "satellite" ? tr("Қала картасы") : tr("Спутник")}
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            aria-label="Қабаттарды жасыру"
            className="flex items-center justify-center rounded-lg border border-white/10 bg-neutral-900/90 p-2 text-white backdrop-blur hover:bg-neutral-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="rounded-lg border border-white/10 bg-neutral-900/90 p-2 backdrop-blur">
          <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
            {tr("Эко қабаттар")}
          </div>
          <div className="flex flex-col gap-1">
            {/* Негізгі мүмкіндік — ең басында, көрнекті */}
            <button
              onClick={() => setSourceMode((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-semibold transition-colors ${
                sourceMode
                  ? "border-red-500/60 bg-red-500/25 text-red-100"
                  : "border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20"
              }`}
            >
              <Factory className="h-4 w-4" /> {tr("Ластану көзі")}
              <span className="ml-auto rounded bg-emerald-500/20 px-1 py-px text-[8px] uppercase text-emerald-300">
                live
              </span>
            </button>
            <div className="my-0.5 h-px bg-white/10" />
            {LAYERS.map((l) => {
              const Icon = LAYER_ICONS[l.key];
              return (
                <button
                  key={l.key}
                  onClick={() => setActiveLayer((cur) => (cur === l.key ? null : l.key))}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    activeLayer === l.key
                      ? l.activeCls
                      : "border-transparent text-neutral-300 hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {tr(l.label)}
                  {l.key !== "waste" && (
                    <span className="ml-auto rounded bg-emerald-500/15 px-1 py-px text-[8px] uppercase text-emerald-300">
                      live
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-0.5 h-px bg-white/10" />
            <button
              onClick={() => { setAiOn((v) => !v); setAiTool("point"); setDrawPoints([]); setAnalyzedArea(null); }}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                aiOn
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-transparent text-neutral-300 hover:bg-white/5"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> {tr("AI талдау")}
              <span className={`ml-auto rounded px-1 py-px text-[8px] uppercase ${aiOn ? "bg-violet-500/20 text-violet-300" : "bg-white/10 text-neutral-400"}`}>
                {aiOn ? tr("қосулы") : tr("өшулі")}
              </span>
            </button>
            <button
              onClick={() => setShowReports((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                showReports
                  ? "border-pink-500/50 bg-pink-500/15 text-pink-200"
                  : "border-transparent text-neutral-300 hover:bg-white/5"
              }`}
            >
              <Camera className="h-3.5 w-3.5" /> {tr("Хабарламалар")}
              <span className="ml-auto rounded bg-white/10 px-1 py-px text-[9px] text-neutral-300">
                {photoReports.length}
              </span>
            </button>
          </div>
        </div>

        {/* Өрт қаупі панелі — FWI (Канада жүйесі) */}
        {activeLayer === "fire" && (
          <div className="w-56 rounded-lg border border-red-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-300">
              <Flame className="h-3 w-3" /> {tr("Дала/орман өрті қаупі — тірі")}
            </div>
            {fireError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !fireData ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: fireData.dangerColor }}>
                      {fireData.fwi}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: fireData.dangerColor }}>
                      {fireData.dangerLabel}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-neutral-500">FWI индексі</div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (fireData.fwi / 60) * 100)}%`, backgroundColor: fireData.dangerColor }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-sm font-bold text-white">{fireData.isi}</div>
                    <div className="text-[9px] text-neutral-500">ISI</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-sm font-bold text-white">{fireData.bui}</div>
                    <div className="text-[9px] text-neutral-500">BUI</div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="text-sm font-bold text-white">{fireData.dc}</div>
                    <div className="text-[9px] text-neutral-500">DC</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                  💡 {tr(fireAdvice(fireData.fwi))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  Канада FWI жүйесі (EFFIS) · Open-Meteo {fireData.spinupDays} күндік нақты ауа райынан.
                  Қызыл реңк — қауіп деңгейі.
                </p>
              </>
            )}
          </div>
        )}

        {/* Құрғақшылық панелі — SPI-3 (McKee 1993) */}
        {activeLayer === "drought" && (
          <div className="w-56 rounded-lg border border-amber-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-300">
              <Droplets className="h-3 w-3" /> {tr("Құрғақшылық индексі — SPI-3")}
            </div>
            {droughtError ? (
              <p className="text-[11px] text-neutral-400">
                {tr("Архив деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
              </p>
            ) : !droughtData ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: droughtData.droughtColor }}>
                      {droughtData.spi > 0 ? "+" : ""}{droughtData.spi}
                    </div>
                    <div className="text-[11px] font-medium" style={{ color: droughtData.droughtColor }}>
                      {droughtData.droughtLabel}
                    </div>
                  </div>
                  <div className="text-right text-[10px] text-neutral-500">SPI-3</div>
                </div>
                <div
                  className="relative mt-2 h-2 w-full overflow-hidden rounded-full"
                  style={{ background: "linear-gradient(90deg,#dc2626,#f97316,#eab308,#22c55e,#60a5fa,#1d4ed8)" }}
                >
                  <div
                    className="absolute top-1/2 h-3.5 w-1 -translate-y-1/2 rounded-full bg-white"
                    style={{ left: `${Math.min(100, Math.max(0, ((droughtData.spi + 3) / 6) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[8px] text-neutral-500">
                  <span>{tr("Құрғақ")}</span><span>{tr("Қалыпты")}</span><span>{tr("Ылғалды")}</span>
                </div>
                <div className="mt-2 rounded bg-white/5 p-1.5 text-center">
                  <div className="text-sm font-bold text-white">{droughtData.precip3m} мм</div>
                  <div className="text-[9px] text-neutral-500">{tr("3-айлық жауын")} ({droughtData.period})</div>
                </div>
                <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                  💡 {tr(droughtAdvice(droughtData.spi))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  McKee 1993 (WMO) · Open-Meteo ERA5 архиві, {droughtData.yearsOfRecord} жылдық климатология.
                </p>
              </>
            )}
          </div>
        )}

        {/* Жел бағыты панелі */}
        {activeLayer === "wind" && (
          <div className="w-56 rounded-lg border border-cyan-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-cyan-300">
              <Wind className="h-3 w-3" /> {tr("Жел бағыты — тірі")}
            </div>
            {windError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !windData ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-cyan-300">{windData.avgSpeed}</div>
                    <div className="text-[10px] text-neutral-400">км/сағ · {tr("орташа")}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: `rotate(${windData.dominantDir + 180}deg)` }}>
                      <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#67e8f9" stroke="#0e7490" strokeWidth="1" />
                    </svg>
                    <div className="text-[9px] text-neutral-400">{tr(compassKz(windData.dominantDir))}</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                  💡 {tr(windAdvice(windData.maxSpeed))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("Стрелка — желдің кететін бағыты. Дереккөз: Open-Meteo (ECMWF).")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Ластану көзін анықтау панелі */}
        {sourceMode && (
          <div className="w-64 rounded-lg border border-red-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-red-300">
              <Factory className="h-3 w-3" /> {tr("Ластану көзін анықтау — тірі")}
            </div>
            {sourceError ? (
              <p className="text-[11px] text-neutral-400">
                {tr("Тірі ауа/жел деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
              </p>
            ) : !source ? (
              <p className="text-[11px] text-neutral-500">{tr("Талданып жатыр…")}</p>
            ) : !source.detected ? (
              <div className="text-[11px] text-neutral-400">
                <div className="mb-1 flex items-center gap-1 text-emerald-300">
                  <Wind className="h-3 w-3" /> {tr("Ластану деңгейі төмен")}
                </div>
                {tr("Қазір елеулі ластану байқалмайды — көз сенімді анықталмайды.")}
                <div className="mt-1 text-[9px] text-neutral-500">
                  {tr("Жел")}: {source.wind.fromLabel} ({source.wind.fromBearing}°) · {source.wind.speed} {tr("км/сағ")}
                </div>
              </div>
            ) : (
              <>
                {source.top && (
                  <div className="mb-2 rounded-md bg-red-500/10 p-2">
                    <div className="text-[9px] uppercase tracking-wide text-neutral-500">
                      {tr("Ықтимал ластану көзі")}
                    </div>
                    <div className="text-sm font-bold text-white">{source.top.name}</div>
                    <div className="mt-1 flex items-center gap-1.5">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-red-400" style={{ width: `${source.top.confidence}%` }} />
                      </div>
                      <span className="text-xs font-bold text-red-300">{source.top.confidence}%</span>
                    </div>
                    <div className="mt-0.5 text-[9px] text-neutral-500">
                      {tr("сенімділік")} · {source.top.distanceKm} {tr("км қашықтықта")}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="flex items-center gap-1 text-neutral-500">
                      <Navigation className="h-2.5 w-2.5" /> {tr("Жел")}
                    </div>
                    <div className="font-semibold text-white">
                      {source.wind.fromLabel} · {source.wind.speed} {tr("км/сағ")}
                    </div>
                  </div>
                  <div className="rounded bg-white/5 p-1.5">
                    <div className="flex items-center gap-1 text-neutral-500">
                      <AlertTriangle className="h-2.5 w-2.5" /> {tr("Ластаушы")}
                    </div>
                    <div className="font-semibold text-white">{source.pollutantLabel}</div>
                  </div>
                </div>

                {source.plume.length > 0 && (
                  <div className="mt-1.5 rounded bg-red-500/10 p-1.5 text-[10px] text-red-200">
                    <div className="mb-0.5 text-[9px] text-neutral-500">{tr("Ластаушы бұлттың таралуы")}</div>
                    {source.plume.map((p) => p.name).join(" → ")}
                  </div>
                )}

                {sourceCorroboration > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded bg-amber-500/10 p-1.5 text-[10px] text-amber-200">
                    <Camera className="h-3 w-3 shrink-0" />
                    <span>
                      {sourceCorroboration} {tr("азаматтық хабарлама осы бұлт аймағында — дәлел күшейеді")}
                    </span>
                  </div>
                )}

                {/* Уақыт-анимация басқаруы (соңғы 24 сағат желі) */}
                {source.frames.length > 1 && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <button
                      onClick={() => setSourcePlaying((v) => !v)}
                      className="flex items-center gap-1 rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] text-red-200 hover:bg-red-500/20"
                    >
                      {sourcePlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {sourcePlaying ? tr("Тоқтату") : tr("24 сағ анимация")}
                    </button>
                    {activeFrame && (
                      <span className="text-[10px] font-mono text-neutral-400">
                        {activeFrame.hour} · {activeFrame.fromLabel} {activeFrame.speed}
                      </span>
                    )}
                  </div>
                )}

                {/* Дисперсия БОЛЖАМЫ — бұлт қайда жетеді (болжам желі) */}
                {(source.forecast?.length ?? 0) > 0 && (
                  <div className="mt-1.5 rounded bg-orange-500/10 p-1.5">
                    <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold text-orange-300">
                      <Navigation className="h-2.5 w-2.5" /> {tr("Болжам: бұлт қайда жетеді")}
                    </div>
                    <div className="flex gap-1">
                      {(source.forecast ?? []).map((f, i) => (
                        <button
                          key={f.label}
                          onClick={() => setFcStep((cur) => (cur === i ? null : i))}
                          className={`flex-1 rounded border px-1 py-1 text-[10px] transition-colors ${
                            fcStep === i
                              ? "border-orange-400 bg-orange-500/25 text-orange-100"
                              : "border-white/10 text-neutral-300 hover:bg-white/5"
                          }`}
                        >
                          +{f.label}
                        </button>
                      ))}
                    </div>
                    {fcStep != null && source.forecast[fcStep] && (
                      <div className="mt-1 text-[10px] text-orange-200">
                        {source.forecast[fcStep].reached.length > 0
                          ? `${tr("Жетеді")}: ${source.forecast[fcStep].reached.join(", ")}`
                          : tr("Қала сыртына шығады — елді мекен ілінбейді")}
                      </div>
                    )}
                  </div>
                )}

                {/* Әрекет батырмалары: метан қабаты + ескерту */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {topEmitsMethane && (
                    <button
                      onClick={() => { setGibsKey("ch4"); toast.info(tr("Sentinel-5P метан (CH₄) қабаты қосылды")); }}
                      className="flex items-center gap-1 rounded border border-sky-500/40 bg-sky-500/10 px-2 py-1 text-[10px] text-sky-200 hover:bg-sky-500/20"
                    >
                      <Satellite className="h-3 w-3" /> {tr("Метан қабаты (CH₄)")}
                    </button>
                  )}
                  <button
                    onClick={sendSourceAlert}
                    className="flex items-center gap-1 rounded border border-orange-500/40 bg-orange-500/10 px-2 py-1 text-[10px] text-orange-200 hover:bg-orange-500/20"
                  >
                    <AlertTriangle className="h-3 w-3" /> {tr("Жауапты органға жіберу")}
                  </button>
                </div>

                {source.candidates.length > 1 && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-[9px] text-neutral-500">{tr("Басқа кандидаттар")}</div>
                    {source.candidates.slice(1, 4).map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
                        <span className="text-neutral-400">{c.short}</span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-neutral-500" style={{ width: `${c.confidence}%` }} />
                        </div>
                        <span className="w-7 text-right text-neutral-400">{c.confidence}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {source.groundStations > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded bg-emerald-500/10 p-1.5 text-[10px] text-emerald-200">
                    <Radio className="h-3 w-3 shrink-0" />
                    <span>
                      {source.groundStations} {tr("нақты жердегі датчик ескерілді — дәлдік модельден жоғары")}
                    </span>
                  </div>
                )}

                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr(source.note)} {tr("Әдіс: жеңілдетілген CWT + көп-қабылдағыш триангуляция. Дереккөз: CAMS + Open-Meteo.")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Live mosquito-suitability panel */}
        {activeLayer === "mosquito" && (
          <div className="w-56 rounded-lg border border-purple-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
              <Radio className="h-3 w-3 animate-pulse" /> {tr("Маса қолайлылығы — тірі")}
            </div>
            {mosError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !mosGrid ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                {mosStats && (
                  <>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-white/5 p-1.5">
                        <div className="text-sm font-bold text-emerald-300">{mosStats.min}</div>
                        <div className="text-[9px] text-neutral-500">{tr("мин")}</div>
                      </div>
                      <div className="rounded bg-white/5 p-1.5">
                        <div className="text-sm font-bold text-white">{mosStats.avg}</div>
                        <div className="text-[9px] text-neutral-500">{tr("орташа")}</div>
                      </div>
                      <div className="rounded bg-white/5 p-1.5">
                        <div className={`text-sm font-bold ${mosStats.max > 60 ? "text-red-300" : "text-yellow-300"}`}>
                          {mosStats.max}
                        </div>
                        <div className="text-[9px] text-neutral-500">{tr("макс")}</div>
                      </div>
                    </div>
                    <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                      💡 {tr(mosquitoAdvice(mosStats.avg))}
                    </div>
                  </>
                )}

                {/* 7-day forecast animation */}
                {mosDays && mosDays.length > 1 && (
                  <div className="mt-2 rounded-lg bg-purple-500/10 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-purple-200">
                        {mosDay === 0 ? tr("Бүгін") : `+${mosDay} ${tr("күн")}`} ·{" "}
                        {mosDays[mosDay]?.date?.slice(5) ?? ""}
                      </span>
                      <button
                        onClick={() => setMosPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-purple-500/25 px-1.5 py-0.5 text-[10px] text-purple-100 hover:bg-purple-500/40"
                      >
                        {mosPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {mosPlaying ? tr("Тоқтату") : tr("Ойнату")}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={6}
                      step={1}
                      value={mosDay}
                      onChange={(e) => {
                        setMosPlaying(false);
                        setMosDay(Number(e.target.value));
                      }}
                      className="w-full accent-purple-400"
                    />
                    <div className="mt-0.5 flex justify-between text-[8px] text-neutral-500">
                      {mosDays.map((d, i) => (
                        <span key={i} className={i === mosDay ? "text-purple-300" : ""}>
                          {d.date?.slice(8) ?? i}
                        </span>
                      ))}
                    </div>
                    <p className="mt-1 text-[9px] text-neutral-400">
                      {mosDays[mosDay]?.temp}°C · апта жаңбыры {mosDays[mosDay]?.rainMm}мм — нақты Open-Meteo болжамы
                    </p>
                  </div>
                )}

                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("🦟 иконкалар индекс бойынша шоғырланады. Слайдермен 7 күндік болжамды көріңіз. Басты фактор —")}{" "}
                  <b className="text-purple-300">{tr("Жайық жайылмасы мен атырауы")}</b>{" "}
                  {tr("(қамыс, тұрған су) + температура + жаңбыр + қала. Әдістеме: Mordecai 2017 (WHO/ECDC) + гидрология. Дереккөз: Open-Meteo.")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Live gas-flare panel — oil layer */}
        {activeLayer === "oil" && (
          <div className="w-52 rounded-lg border border-orange-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-orange-300">
              <Flame className="h-3 w-3" /> {tr("Газ факелдері — тірі")}
            </div>
            {flaresError ? (
              <p className="text-[11px] text-neutral-400">
                {flaresError === "FIRMS кілті бапталмаған"
                  ? tr("NASA FIRMS кілті қажет (тегін). Қосылғанша факелдер көрсетілмейді.")
                  : `${tr("Тірі деректер қолжетімсіз")}: ${flaresError}. ${tr("Жалған дерек көрсетілмейді.")}`}
              </p>
            ) : !flares ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : flares.length === 0 ? (
              <p className="text-[11px] text-neutral-400">{tr("Соңғы 2 күнде жану нүктесі анықталмады.")}</p>
            ) : (
              <>
                <div className="rounded-lg bg-orange-500/10 p-2 text-center">
                  <div className="text-2xl font-bold text-orange-300">{flares.length}</div>
                  <div className="text-[10px] text-neutral-400">{tr("анықталған жану нүктесі (2 күн)")}</div>
                </div>
                <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                  💡 {tr(flaresAdvice(flares.length))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("🔥 иконка өлшемі — жану қуатына (FRP) сай. Мұнай-газ кен орындарының факелдері спутниктен жылулық аномалия ретінде көрінеді. Дереккөз: NASA FIRMS (VIIRS 375м).")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Waste panel — crowdsourced (AI + citizen reports) */}
        {activeLayer === "waste" && (
          <div className="w-56 rounded-lg border border-orange-600/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-orange-300">
              <Trash2 className="h-3 w-3" /> {tr("Қоқыс нүктелері")}
            </div>
            {(() => {
              const confirmed = wasteSites.filter(
                (s) => s.analysis.verificationStatus === "confirmed"
              ).length;
              const fromCitizens = wasteSites.filter((s) => s.photoThumb).length;
              return wasteSites.length === 0 ? (
                <p className="text-[11px] text-neutral-400">
                  {tr("Әзірге қоқыс нүктесі жоқ. Картаны басып AI талдаңыз немесе фото-хабарлама жіберіңіз.")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="rounded bg-white/5 p-1.5">
                      <div className="text-sm font-bold text-white">{wasteSites.length}</div>
                      <div className="text-[9px] text-neutral-500">{tr("барлығы")}</div>
                    </div>
                    <div className="rounded bg-white/5 p-1.5">
                      <div className="text-sm font-bold text-emerald-300">{confirmed}</div>
                      <div className="text-[9px] text-neutral-500">{tr("расталған")}</div>
                    </div>
                    <div className="rounded bg-white/5 p-1.5">
                      <div className="text-sm font-bold text-pink-300">{fromCitizens}</div>
                      <div className="text-[9px] text-neutral-500">{tr("азаматтан")}</div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                    {tr("Қоқыс — жергілікті мәселе, спутник API-ы жоқ. Сондықтан ол AI спутник талдауы мен азаматтық фото-хабарламалардан жинақталады (краудсорсинг).")}
                  </p>
                </>
              );
            })()}
            <a
              href="/report"
              className="mt-2 flex items-center justify-center gap-1 rounded-md bg-orange-600 py-1.5 text-[11px] font-medium text-white hover:bg-orange-500"
            >
              <Camera className="h-3.5 w-3.5" /> {tr("Қоқыс туралы хабарлау")}
            </a>
          </div>
        )}

        {/* Live soil panel — soil layer */}
        {activeLayer === "soil" && (
          <div className="w-56 rounded-lg border border-yellow-600/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-yellow-300">
              <Radio className="h-3 w-3 animate-pulse" /> {tr("Топырақ жағдайы — тірі")}
            </div>
            {soilError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !soilGrid || !soilMeta ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-white/5 p-2 text-center">
                    <div className="text-lg font-bold text-sky-300">{soilMeta.avgMoisture}</div>
                    <div className="text-[9px] text-neutral-400">{tr("орташа ылғал м³/м³")}</div>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 text-center">
                    <div
                      className={`text-lg font-bold ${soilMeta.avgStress > 60 ? "text-red-300" : soilMeta.avgStress > 40 ? "text-orange-300" : "text-emerald-300"}`}
                    >
                      {soilMeta.avgStress}
                    </div>
                    <div className="text-[9px] text-neutral-400">{tr("деградация стрессі")}</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-white/5 p-2 text-[10px] leading-snug text-neutral-200">
                  💡 {tr(soilAdvice(soilMeta.avgStress))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("Сары/қызыл аймақ — құрғақ топырақ, жоғары деградация/тұздану стрессі. Көк — ылғалды, сау. Есеп: түбір қабатының ылғалы + температура + 30 күндік жаңбыр. Дереккөз: Open-Meteo (ECMWF).")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Live water/flood panel — water layer */}
        {activeLayer === "water" && (
          <div className="w-56 rounded-lg border border-teal-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-teal-300">
              <Radio className="h-3 w-3 animate-pulse" /> {tr("Жайық өзені — тірі ағын")}
            </div>
            {floodError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !flood ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : flood.length === 0 ? (
              <p className="text-[11px] text-neutral-400">{tr("Өзен деректері қолжетімсіз.")}</p>
            ) : (
              <>
                {(() => {
                  const aty = flood.find((p) => p.name.includes("Атырау")) ?? flood[0];
                  return (
                    <div
                      className="rounded-lg p-2 text-center"
                      style={{ backgroundColor: `${aty.color}22`, border: `1px solid ${aty.color}55` }}
                    >
                      <div className="text-xl font-bold" style={{ color: aty.color }}>
                        {aty.discharge} <span className="text-xs font-normal">м³/с</span>
                      </div>
                      <div className="text-[11px] font-semibold" style={{ color: aty.color }}>
                        {aty.level}
                      </div>
                      <div className="text-[9px] text-neutral-400">
                        {tr("Атырау тұсы · тренд")}: {aty.trend}
                      </div>
                      <div className="mt-1.5 rounded-md bg-white/10 p-1.5 text-[10px] leading-snug text-neutral-100">
                        💡 {tr(waterAdvice(aty.level))}
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-1.5 space-y-0.5">
                  {flood.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-[10px]">
                      <span className="text-neutral-300">{p.name}</span>
                      <span className="font-semibold" style={{ color: p.color }}>
                        {p.discharge} м³/с
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("Нақты өзен ағыны мен тасқын қаупі. Жоғары ағын → жайылма су басу → маса ошақтары. Дереккөз: Copernicus GloFAS (Open-Meteo).")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Live air quality panel — shown while the air layer is active */}
        {activeLayer === "air" && (
          <div className="w-52 rounded-lg border border-sky-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
              <Radio className="h-3 w-3 animate-pulse" /> {tr("Ауа сапасы — тірі")}
            </div>
            {airError ? (
              <p className="text-[11px] text-neutral-400">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !airGrid ? (
              <p className="text-[11px] text-neutral-500">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                {airStats && (() => {
                  const cat = aqiCategory(airStats.avg);
                  return (
                    <>
                      {/* Category badge (IQAir-style) */}
                      <div
                        className="mb-2 rounded-lg p-2 text-center"
                        style={{ backgroundColor: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
                      >
                        <div className="text-2xl font-bold" style={{ color: cat.color }}>
                          {airStats.avg}
                        </div>
                        <div className="text-[11px] font-semibold" style={{ color: cat.color }}>
                          {cat.name}
                        </div>
                        <div className="text-[9px] text-neutral-400">{tr("облыс бойынша орташа EU AQI")}</div>
                      </div>

                      {/* Color scale bar */}
                      <div className="mb-2 flex h-1.5 overflow-hidden rounded-full">
                        {AQI_CATEGORIES.slice(0, 6).map((c) => (
                          <div
                            key={c.name}
                            className="flex-1"
                            style={{ backgroundColor: c.color, opacity: c.name === cat.name ? 1 : 0.35 }}
                            title={`${c.name} (${c.range[0]}+)`}
                          />
                        ))}
                      </div>

                      {/* Health advice */}
                      <div className="rounded-lg bg-white/5 p-2 text-[10px] leading-snug text-neutral-300">
                        <div className="mb-1 font-semibold" style={{ color: cat.color }}>
                          {tr("🩺 Денсаулық кеңесі")}
                        </div>
                        <p>{cat.advice}</p>
                        <p className="mt-1 text-neutral-400">
                          <b>{tr("Сезімтал топтар:")}</b> {cat.sensitiveAdvice}
                        </p>
                      </div>

                      <div className="mt-1.5 flex justify-between text-[9px] text-neutral-500">
                        <span>мин {airStats.min}</span>
                        <span>макс {airStats.max}</span>
                      </div>
                    </>
                  );
                })()}

                {/* Dominant pollutant + source */}
                {airDominant && (
                  <div className="mt-2 rounded-lg bg-white/5 p-2 text-[10px]">
                    <div className="font-semibold text-sky-300">{tr("Басты ластаушы")}</div>
                    <div className="text-white">
                      {airDominant.label} · {airDominant.value.toFixed(1)} µg/m³
                    </div>
                    <div className="text-neutral-400">Көзі: {airDominant.source}</div>
                  </div>
                )}

                {/* 24h forecast animation */}
                {airHours && airHours.length > 1 && (
                  <div className="mt-2 rounded-lg bg-sky-500/10 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-sky-200">
                        {airHour === 0 ? tr("Қазір") : `+${airHour} ${tr("сағ")}`} ·{" "}
                        {airHours[airHour]?.time?.slice(11, 16) ?? ""}
                      </span>
                      <button
                        onClick={() => setAirPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-sky-500/25 px-1.5 py-0.5 text-[10px] text-sky-100 hover:bg-sky-500/40"
                      >
                        {airPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {airPlaying ? tr("Тоқтату") : tr("Ойнату")}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={23}
                      step={1}
                      value={airHour}
                      onChange={(e) => {
                        setAirPlaying(false);
                        setAirHour(Number(e.target.value));
                      }}
                      className="w-full accent-sky-400"
                    />
                    <p className="mt-0.5 text-[9px] text-neutral-500">{tr("Алдағы 24 сағат — нақты CAMS болжамы")}</p>
                  </div>
                )}

                {/* City districts ranking */}
                {airStats?.districts && airStats.districts.length > 0 && (
                  <div className="mt-2 rounded-lg bg-white/5 p-2">
                    <div className="mb-1 text-[10px] font-semibold text-sky-300">{tr("Қала аудандары")}</div>
                    <div className="space-y-0.5">
                      {airStats.districts.map((dd) => {
                        const c = aqiCategory(dd.aqi);
                        return (
                          <div key={dd.name} className="flex items-center justify-between text-[10px]">
                            <span className="text-neutral-300">{dd.name}</span>
                            <span className="font-semibold" style={{ color: c.color }}>
                              {dd.aqi} · {c.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  {tr("EU AQI (EAQI), Copernicus CAMS — сағат сайын. Аудандар CAMS ажыратымдылығымен (~10км) бағаланады.")}
                </p>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => setAddOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur transition-colors ${
            addOpen
              ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-200"
              : "border-white/10 bg-neutral-900/90 text-white hover:bg-neutral-800"
          }`}
        >
          <MapPinPlus className="h-4 w-4" />
          {tr("Нүкте қосу")}
        </button>

        {addOpen && (
          <div className="w-48 rounded-lg border border-emerald-500/30 bg-neutral-900/95 p-2.5 backdrop-blur">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
              {tr("Координат бойынша")}
            </div>
            <input
              value={addLat}
              onChange={(e) => setAddLat(e.target.value)}
              placeholder="Ендік: 47.1167"
              className="mb-1.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <input
              value={addLng}
              onChange={(e) => setAddLng(e.target.value)}
              placeholder="Бойлық: 51.9014"
              onKeyDown={(e) => e.key === "Enter" && addByCoords()}
              className="mb-2 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white placeholder:text-neutral-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <button
              onClick={addByCoords}
              disabled={analyzing}
              className="w-full rounded-md bg-emerald-600 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {tr("Талдау жасау")}
            </button>
          </div>
        )}

        <button
          onClick={() => {
            setHistoryMode((v) => !v);
            if (!historyMode) setYearIdx(0); // start from 2016 to show the contrast
          }}
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs backdrop-blur transition-colors ${
            historyMode
              ? "border-amber-500/50 bg-amber-500/20 text-amber-200"
              : "border-white/10 bg-neutral-900/90 text-white hover:bg-neutral-800"
          }`}
        >
          <History className="h-4 w-4" />
          {tr("Тарихи режим")}
        </button>
      </div>

      {/* History timeline — real Sentinel-2 yearly mosaics */}
      {historyMode && (
        <div className="absolute bottom-20 left-1/2 w-[min(620px,90%)] -translate-x-1/2 rounded-xl border border-amber-500/30 bg-neutral-900/95 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <History className="h-3.5 w-3.5" />
              {tr("Атыраудың нақты спутник тарихы (1984–2025)")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (yearIdx >= HISTORY_YEARS.length) setYearIdx(0);
                  setTimelapsePlaying((v) => !v);
                }}
                className="flex items-center gap-1 rounded bg-amber-500/25 px-2 py-1 text-[11px] text-amber-200 hover:bg-amber-500/40"
              >
                {timelapsePlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {timelapsePlaying ? tr("Тоқтату") : tr("Тайм-лапс")}
              </button>
              <button onClick={() => { setHistoryMode(false); setTimelapsePlaying(false); }} className="text-neutral-500 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={HISTORY_YEARS.length}
              step={1}
              value={yearIdx}
              onChange={(e) => { setTimelapsePlaying(false); setYearIdx(Number(e.target.value)); }}
              className="flex-1 accent-amber-400"
            />
            <span className="w-16 text-right text-lg font-bold text-amber-300">
              {year ?? tr("Қазір")}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            {HISTORY_YEARS.map((y) => (
              <span key={y}>{String(y).slice(2)}</span>
            ))}
            <span>{tr("Қазір")}</span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            {year
              ? LANDSAT_YEARS.has(year)
                ? `${year} ${tr("жыл — NASA Landsat нақты суреті (30м). Атырау мұнай өнеркәсібі дамуының ерте кезеңі.")}`
                : year < 2016
                  ? `${year} ${tr("жыл — NASA MODIS нақты суреті (250м, шолу деңгейі). Sentinel-2 спутнигі 2015 жылы ұшырылғандықтан, бұдан ескі жоғары сапалы сурет жоқ.")}`
                  : `${year} ${tr("жыл — бұлтсыз Sentinel-2 мозаикасы (10м), дәл сол жылғы Атыраудың шынайы көрінісі. Картаны бассаңыз, AI сол жылғы суретті талдайды.")}`
              : tr("Қазіргі Mapbox спутник суреті. Слайдерді жылжытып, өткен жылдармен салыстырыңыз.")}
            <span className="ml-1 text-amber-300/80">{tr("Бұл жылдың нүктелері")}: {allSites.length}</span>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <MapSearch
          onSelect={(lng, lat) =>
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1200 })
          }
        />
      </div>

      {/* Zoom controls — Google Maps style */}
      <div className="absolute bottom-8 right-4 flex flex-col items-center gap-3">
        <button
          onClick={() =>
            mapRef.current?.flyTo({ center: [51.8833, 47.1167], zoom: 12.5, duration: 1400 })
          }
          title={tr("Атырау қаласына жақындау")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/95 text-neutral-300 shadow-xl backdrop-blur transition-colors hover:bg-neutral-800 hover:text-white"
        >
          <Locate className="h-5 w-5" />
        </button>
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur">
          <button
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            title={tr("Жақындату")}
            className="flex h-11 w-11 items-center justify-center text-neutral-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="mx-2 h-px bg-white/10" />
          <button
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            title={tr("Алыстату")}
            className="flex h-11 w-11 items-center justify-center text-neutral-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
          >
            <Minus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Hint / loading */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2">
        {analyzing ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-neutral-900/90 px-4 py-2 text-sm text-emerald-300 backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("AI талдап жатыр…")}
          </div>
        ) : aiOn ? (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-violet-500/40 bg-neutral-900/95 px-3 py-2 text-xs text-violet-100 backdrop-blur">
            {/* Нүкте / Аумақ ауыстырғыш */}
            <div className="flex items-center overflow-hidden rounded-full border border-white/10">
              <button
                onClick={() => { setAiTool("point"); setDrawPoints([]); }}
                className={`px-3 py-1 text-[11px] font-medium transition-colors ${aiTool === "point" ? "bg-violet-500/30 text-violet-200" : "text-neutral-400 hover:bg-white/5"}`}
              >
                {tr("📍 Нүкте")}
              </button>
              <button
                onClick={() => setAiTool("area")}
                className={`px-3 py-1 text-[11px] font-medium transition-colors ${aiTool === "area" ? "bg-sky-500/30 text-sky-200" : "text-neutral-400 hover:bg-white/5"}`}
              >
                {tr("⬡ Аумақ")}
              </button>
            </div>

            {aiTool === "point" ? (
              <span className="text-neutral-300">{tr("Картадан нүкте басыңыз — спутник + тірі деректер талданады")}</span>
            ) : (
              <>
                <span className="text-neutral-300">{tr("Төбе қосыңыз")} ({drawPoints.length})</span>
                <button
                  onClick={finishAreaAnalysis}
                  disabled={drawPoints.length < 3}
                  className="rounded-full bg-sky-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-sky-400 disabled:opacity-40"
                >
                  {tr("Талдау")}
                </button>
                <button
                  onClick={() => setDrawPoints([])}
                  disabled={drawPoints.length === 0}
                  className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-neutral-300 hover:bg-white/10 disabled:opacity-40"
                >
                  {tr("Тазалау")}
                </button>
              </>
            )}

            <button
              onClick={() => { setAiOn(false); setDrawPoints([]); setAnalyzedArea(null); }}
              className="rounded-full px-2 py-1 text-[11px] text-neutral-400 hover:text-white"
              aria-label={tr("Жабу")}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-400 backdrop-blur">
            {tr("Талдау үшін сол жақтан «AI талдау» қосыңыз")}
          </div>
        )}
      </div>

      <AnalysisDrawer site={selected} onClose={() => setSelected(null)} onUpdate={setSelected} />
    </div>
  );
}
