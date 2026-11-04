"use client";

import { useMemo, useState, useCallback, useRef, useEffect, useSyncExternalStore } from "react";
import Map, { Marker, Layer, Source, Popup, AttributionControl, type MapRef } from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import { toast } from "sonner";
import {
  Loader2, Layers, Satellite, History, X, MapPinPlus, Plus, Minus, Locate,
  Bug, Wind, Mountain, Fuel, Trash2, Waves, Radio, Camera, Sparkles, Play, Pause, Flame, Droplets,
  Factory, AlertTriangle, Navigation, BarChart3, FileText, Scale, BookOpen, Trees,
  Map as MapIcon, Bird,
} from "lucide-react";
import { useSitesStore } from "@/store/useSitesStore";
import { RISK_COLORS } from "@/lib/risk";
import { plumeCone } from "@/lib/pollutionSource";
import { FacilityCardView } from "@/components/object/FacilityCardView";
import { buildFacilityCard } from "@/lib/facilityCard";
import { FACILITIES } from "@/data/facilities";
import { MIN_VISUAL_HALF_ANGLE, bearingStdDev } from "@/lib/dispersion";
import {
  reedPolygons, reedFireAnomalies, reedAnomalyKey, smokeCone, noWindRing,
  type SmokeCone, type ReedFireAnomaly,
} from "@/lib/reedFire";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import { LAYERS, type LayerKey } from "@/data/historyFactors";
import { ATMOS_ELEMENTS, ATMOS_CATEGORIES, type AtmosElement } from "@/data/atmosElements";
import { KzhPanel } from "@/components/map/KzhPanel";
import { Badge } from "@/components/air/SourceBadge";
import { ModelCaption } from "@/components/air/ModelCaption";
import { SatColumnNote } from "@/components/air/SatColumnNote";
import { satNoteGasFor, type SatGas } from "@/data/satelliteColumns";
import { GIBS_LAYERS, RADAR_SAT_LAYERS, ATMOS_LAYERS, gibsTiles, findSatLayer, SAT_PROVIDER, ATMOS_PROVIDER } from "@/data/gibsLayers";
import { useLang } from "@/lib/i18n";
import { MapSearch } from "./MapSearch";
import { ToolsPanel } from "@/components/tools/ToolsPanel";
import { ToolsMapLayers } from "@/components/tools/ToolsMapLayers";
import { useMapToolsStore } from "@/store/useMapToolsStore";

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
import { Stat } from "@/components/ui/Stat";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import styles from "./MapWorkspace.module.css";
import { AnalysisDrawer } from "@/components/analysis/AnalysisDrawer";
import { MosquitoIcon } from "./MosquitoIcon";
import { PollutionTimeline } from "./PollutionTimeline";
import { DispersionFrame } from "./DispersionFrame";
import { isDispersionWindMissing, type WindHourlySeries } from "@/lib/windGrid";
import { aqiCategory, AQI_CATEGORIES } from "@/lib/airQuality";
import {
  useSharedReports, useAirGrid, useMosquitoGrid, useSoilGrid, useFlood, useFlares, useFireArchive,
  usePollutionSource, useReedHabitat, useGreenery, useGreenChange, useLanduse, useFauna,
  type AirGridPoint, type MosquitoGridPoint, type PollutionSourceCandidate,
} from "@/hooks/useEcoData";
import type { Site, AnalysisResult } from "@/types/site";
import { LayerDrawer } from "@/components/map/LayerDrawer";
import { TierBadge } from "@/components/ui/TierBadge";
import type { LayerKey as DrawerKey } from "@/data/ecoLayers";
import { useRegion } from "@/store/useRegionStore";
import { ModuleMissing } from "@/components/ui/ModuleMissing";
import { LayerIndexNote } from "@/components/map/LayerIndexNote";
import { hasModule, MODULE_REASON, type ModuleKey } from "@/data/regions";
import { GreeneryPanel } from "./GreeneryPanel";
import { SourceErrorBox } from "./SourceErrorBox";
import { FacilityBar } from "./FacilityBar";
import { facilityNo2Signal } from "@/lib/facilityS5p";
import { LandusePanel, LANDUSE_COLOR } from "./LandusePanel";
import { NaturePanel, reserveGeo } from "./NaturePanel";

const ATYRAU = { latitude: 47.1167, longitude: 51.9014, zoom: 7.5 };
/** Қамыс өрті: карта белгілері мен панель тізімі шектеледі — карта толып кетпеуі үшін */
const REED_MARKER_CAP = 20;

const LAYER_ICONS: Record<LayerKey, React.ElementType> = {
  landuse: MapIcon,
  nature: Bird,
  green: Trees,
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
  if (count <= 3) return "Бірнеше жылу аномалиясы — расталған өрт емес, тек спутниктің жылу сигналы.";
  if (count <= 10) return "Жылу аномалиялары орташа — факел, өрт немесе жалынды спутник ажыратпайды.";
  return "Жылу аномалиялары көп — бұл расталған өрт емес; себебін жердегі тексеру анықтайды.";
}
/** lib/floodPulse joins its measured parts with " · " and appends one fixed
 *  sentence; each part has its own dictionary entry or template. */
const FLOOD_NOTE_TAIL = "Су басу жұмыртқа банкінің жарылуын іске қосады — импульс жоғары болса жайылмадағы индекс те көтеріледі.";
function trFloodNote(note: string, tr: (s: string) => string): string {
  const tail = `. ${FLOOD_NOTE_TAIL}`;
  if (!note.endsWith(tail)) return tr(note);
  const parts = note.slice(0, -tail.length).split(" · ").map(tr).join(" · ");
  return `${parts}. ${tr(FLOOD_NOTE_TAIL)}`;
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

// Нүктені желмен алға жылжыту (advection) — болжам footprint орталығы үшін
function advect(lat: number, lng: number, toBearing: number, speedKmh: number, hours: number): [number, number] {
  const dist = speedKmh * hours; // км
  const b = (toBearing * Math.PI) / 180;
  const dLat = (dist / 111) * Math.cos(b);
  const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(b);
  return [lat + dLat, lng + dLng];
}

// Панельдің екінші бөлімі — қабат емес, бөлек беттер.
const SERVICES: { href: string; label: string; icon: React.ElementType }[] = [
  { href: "/dashboard", label: "Аналитика", icon: BarChart3 },
  { href: "/eco-passport", label: "Эко-паспорт", icon: FileText },
  { href: "/legislation", label: "Заңнама", icon: Scale },
  { href: "/methodology", label: "Әдістеме", icon: BookOpen },
];

// Карта қабатының кілті → эко-қабат тізіліміндегі кілт (src/data/ecoLayers.ts).
// "waste" тізілімде жоқ: азаматтық хабарламалар өшірулі, өз алдына дереккөзі жоқ.
const DRAWER_KEYS: Partial<Record<LayerKey, DrawerKey>> = {
  air: "air",
  water: "water",
  soil: "soil",
  oil: "oil",
  fire: "fire",
  drought: "drought",
  wind: "wind",
  mosquito: "mosquito",
};

// Қабат → аймақтық ТІЗІЛІМ қажет ететін модуль.
// Мұнда жоқ қабаттар жаһандық дереккөзге сүйенеді (CAMS, ERA5, VIIRS) әрі
// кез келген қалада жұмыс істейді. Ал «Су» қабаты GloFAS арна нүктелерін
// талап етеді — тізілімсіз аймақта «жоқ» деп көрсетіледі.
// МАСА ИНДЕКСІНІҢ ДЕҢГЕЙЛЕРІ — картадағы түс пен аңызда БІР ЖЕРДЕН оқылады,
// сондықтан екеуі ешқашан алшақтамайды.
//
// Шкала: JAIYQ-MRI 0–100 (климаттық ҚОЛАЙЛЫЛЫҚ, маса САНЫ емес).
const MOS_LEVELS: { max: number; color: string; label: string }[] = [
  { max: 25, color: "#60a5fa", label: "өте төмен" },
  { max: 45, color: "#4ade80", label: "төмен" },
  { max: 62, color: "#facc15", label: "орташа" },
  { max: 78, color: "#fb923c", label: "жоғары" },
  { max: 101, color: "#ef4444", label: "өте жоғары" },
];

function mosLevel(idx: number): { color: string; label: string } {
  const l = MOS_LEVELS.find((x) => idx < x.max) ?? MOS_LEVELS[MOS_LEVELS.length - 1];
  return { color: l.color, label: l.label };
}

const LAYER_MODULE: Partial<Record<LayerKey, ModuleKey>> = {
  green: "greenery",
  landuse: "greenery",
  nature: "greenery",
  water: "riverFlow",
  mosquito: "mosquito",
};

// FIRMS архиві — уақыт пресеттері (күн) және категория түстері.
// Түстер легендамен бірдей: өндірістік алау — қызыл, расталмаған аномалия — сары.
const FIRE_PRESETS = [30, 90, 180, 365] as const;
const FIRE_CATEGORY_COLOR = { industrial_flare: "#ef4444", unconfirmed_anomaly: "#facc15" } as const;

/** YYYY-MM-DD датасынан `days` күн шегеру (UTC) — туынды мән үшін таза функция */
function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function MapView() {
  const { lang, tr, t } = useLang();
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const leftToggleRef = useRef<HTMLButtonElement>(null);
  const rightToggleRef = useRef<HTMLButtonElement>(null);
  const desktop = useSyncExternalStore(subscribeDesktop, () => window.matchMedia("(min-width: 1024px)").matches, () => false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobileSheet, setMobileSheet] = useState<"left" | "right" | null>(null);
  const [rightView, setRightView] = useState("eco");
  const openRightView = useCallback((view: string) => {
    setRightView(view);
    setRightOpen(true);
    setMobileSheet("right");
  }, []);

  // Grid columns and the mobile sheet never remount the map or its data panels.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(stage);
    // Attribution belongs to the stage, above the separate action row. Its
    // expanded height also varies with language and available map width.
    const attributionObserver = new ResizeObserver(([entry]) => {
      workspaceRef.current?.style.setProperty("--map-attribution-height", `${Math.max(64, entry.target.getBoundingClientRect().height + 16)}px`);
    });
    const watchAttribution = () => {
      const attribution = stage.querySelector(".mapboxgl-ctrl-bottom-right");
      if (attribution) {
        attributionObserver.observe(attribution);
        controlsObserver.disconnect();
      }
    };
    const controlsObserver = new MutationObserver(watchAttribution);
    controlsObserver.observe(stage, { childList: true, subtree: true });
    watchAttribution();
    return () => {
      observer.disconnect();
      attributionObserver.disconnect();
      controlsObserver.disconnect();
    };
  }, []);
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
  // Қабат Drawer — 4 қойынды: нақты деректер / заңнама / AI / тарих
  const [drawerLayer, setDrawerLayer] = useState<DrawerKey | null>(null);
  // Таңдалған аймақ — карта да, барлық қабат та осыған қарай ауысады
  const region = useRegion();

  // Аймақ ауысқанда карта сол қалаға ұшады. Қабаттардың деректері де
  // жаңа координатаға қайта сұралады (LayerDrawer `key` арқылы қайта құрылады).
  useEffect(() => {
    mapRef.current?.flyTo({
      center: [region.lng, region.lat],
      zoom: region.zoom,
      duration: 1600,
    });
  }, [region.id, region.lat, region.lng, region.zoom]);
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
  const { airGrid, airDominant, airError, airFetchedAt } = useAirGrid(activeLayer === "air");
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
  // Атмосфера элементі — қай нақты газ/бөлшек көрсетілсін (әдепкі: AQI)
  const [airElem, setAirElem] = useState<AtmosElement>(ATMOS_ELEMENTS[0]);
  const elemVal = (p: AirGridPoint): number | null =>
    airElem.noModel
      ? null // CAMS/спутник бұл затты бермейді — картаға ештеңе салынбайды
      : airElem.key === "aqi"
        ? airHourAqi(p)
        : ((p[airElem.key as keyof AirGridPoint] as number | null | undefined) ?? null);

  const { soilGrid, soilMeta, soilError } = useSoilGrid(activeLayer === "soil");

  const { flood, river, floodError, floodMissing } = useFlood(activeLayer === "water");

  // FIRMS NRT + архив: «oil» қабатында көрсетіледі, «fire» қабатында қамыс өрті
  // тәуекелі (P4.5) үшін де қажет
  const firmsWanted = activeLayer === "oil" || activeLayer === "fire";
  const { flares, flaresError, flaresReason } = useFlares(firmsWanted);

  // FIRMS архиві — 365 күн жүктеледі; пресет уақыт сүзгісі туынды мән ретінде есептеледі
  const { archive: fireArchive, archiveError: fireArchiveError } = useFireArchive(firmsWanted);

  // Қамыс мекені (Sentinel-2 NDVI проксиі) — тек «fire» қабатында
  const { reed, reedError } = useReedHabitat(activeLayer === "fire");
  const { osm, osmError } = useGreenery(activeLayer === "green");
  const { landuse, landuseError } = useLanduse(activeLayer === "landuse");
  const { fauna, faunaError } = useFauna(activeLayer === "nature");
  const { change: greenChange, changeError: greenChangeError } = useGreenChange(activeLayer === "green");
  const greenCellsGeo = useMemo(() => ({
    type: "FeatureCollection" as const,
    features: (greenChangeError ? [] : greenChange?.cells ?? []).map((cell) => {
      const [w, s, e, n] = cell.bbox;
      return {
        type: "Feature" as const,
        properties: { trend: cell.change?.trend ?? "no-data" },
        geometry: { type: "Polygon" as const, coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
      };
    }),
  }), [greenChange, greenChangeError]);
  const [firePreset, setFirePreset] = useState<number>(365);
  const fireAnomalies = useMemo(() => {
    if (!fireArchive) return [];
    const to = fireArchive.window.to;
    const from = shiftIsoDate(to, -(firePreset - 1));
    return fireArchive.anomalies.filter((a) => a.acqDate >= from && a.acqDate <= to);
  }, [fireArchive, firePreset]);
  const fireCounts = useMemo(
    () => ({
      industrial_flare: fireAnomalies.filter((a) => a.category === "industrial_flare").length,
      unconfirmed_anomaly: fireAnomalies.filter((a) => a.category === "unconfirmed_anomaly").length,
    }),
    [fireAnomalies]
  );
  const fireGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: fireAnomalies.map((a) => ({
        type: "Feature" as const,
        properties: { category: a.category, frp: a.frp, date: a.acqDate },
        geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
      })),
    }),
    [fireAnomalies]
  );

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
  // Дерек жоқ нүкте/жиынтық — null (P1.10): 0 м/с деп көрсетілмейді
  const [windData, setWindData] = useState<{
    grid: { lat: number; lng: number; speed: number | null; dir: number | null }[];
    avgSpeed: number | null; maxSpeed: number | null; dominantDir: number | null;
    /** P2.3: өткен 24 сағ / алдағы 24 сағ (kind белгісімен). Ескі жауапта жоқ. */
    hourly?: WindHourlySeries;
  } | null>(null);
  const [windError, setWindError] = useState(false);
  // Жел қабаты белсенді болғанда ЖӘНE таралу панелі ашылғанда (P2.4 слайдері жел
  // деректеріне тәуелді — сұрланатынын шешу үшін) жүктеледі
  // «fire» қабатында да: қамыс өрті түтінінің бағыты (P4.5) желге тәуелді
  useEffect(() => {
    if (activeLayer !== "wind" && activeLayer !== "fire" && !sourceMode) return;
    setWindError(false);
    fetch("/api/windgrid")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setWindData)
      .catch(() => setWindError(true));
  }, [activeLayer, sourceMode]);

  // ҚАМЫС ӨРТІ ТӘУЕКЕЛІ (P4.5) — 📊 модель (src/lib/reedFire.ts).
  // Қамыс «полигоны» — NDVI проксиі бар бақылау терезесі. Өндірістік алау
  // ЕШҚАШАН саналмайды. Конус — тек соңғы 2 тәуліктегі (NRT) аномалияға:
  // бүгінгі желмен бірнеше ай бұрынғы өрттің түтінін сызу жаңылыстырады.
  const reedPolys = useMemo(() => reedPolygons(reed ?? []), [reed]);
  const reedAnoms = useMemo(
    () => reedFireAnomalies([...(fireArchive?.anomalies ?? []), ...(flares ?? [])], reedPolys),
    [fireArchive, flares, reedPolys]
  );
  const reedRecent = useMemo(() => {
    const recentKeys = new Set((flares ?? []).map(reedAnomalyKey));
    return reedAnoms.filter((a) => recentKeys.has(reedAnomalyKey(a)));
  }, [reedAnoms, flares]);
  // Жел әлі жүктелуде — конус та, «жел жоқ» белгісі де салынбайды
  const reedWindLoading = !windData && !windError;
  const reedCones = useMemo((): { a: ReedFireAnomaly; cone: SmokeCone }[] => {
    if (reedWindLoading) return [];
    const dirSigmaDeg = bearingStdDev(
      (windData?.hourly?.past ?? [])
        .slice(-12)
        .map((h) => h.dominantDir)
        .filter((n): n is number => n != null)
    );
    const grid = windError ? null : windData?.grid;
    return reedRecent.map((a) => ({ a, cone: smokeCone(a, grid, { dirSigmaDeg }) }));
  }, [reedRecent, reedWindLoading, windData, windError]);
  const reedZonesGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reedPolys.map((p) => ({
        type: "Feature" as const,
        properties: { id: p.id, denseFraction: p.denseFraction },
        geometry: { type: "Polygon" as const, coordinates: [p.ring] },
      })),
    }),
    [reedPolys]
  );
  const reedAnomGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reedAnoms.map((a) => ({
        type: "Feature" as const,
        properties: { frp: a.frp, date: a.acqDate },
        geometry: { type: "Point" as const, coordinates: [a.lng, a.lat] },
      })),
    }),
    [reedAnoms]
  );
  const reedConeGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reedCones.flatMap(({ cone }) =>
        cone.status === "ok"
          ? [{
              type: "Feature" as const,
              properties: {},
              geometry: { type: "Polygon" as const, coordinates: [cone.ring] },
            }]
          : []
      ),
    }),
    [reedCones]
  );
  const reedNoWindGeo = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: reedCones.flatMap(({ a, cone }) =>
        cone.status === "no-wind"
          ? [{
              type: "Feature" as const,
              properties: {},
              geometry: { type: "LineString" as const, coordinates: noWindRing(a) },
            }]
          : []
      ),
    }),
    [reedCones]
  );
  const reedNoWind = reedCones.length > 0 && reedCones.every((c) => c.cone.status === "no-wind");

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

  const { mosGrid, mosFlood, mosDyn, mosError, mosMissing } = useMosquitoGrid(activeLayer === "mosquito");

  // Ластану көзін анықтау — тірі CAMS + жел → ықтимал өнеркәсіп көзі
  // Архив режимі: таңдалған нақты сағат (null — тірі)
  const [srcAt, setSrcAt] = useState<string | null>(null);
  const { source, sourceError, sourceMissing, sourceLoading } = usePollutionSource(sourceMode, srcAt);
  // Анимациялар БАСЫЛҒАН зауыт(тар) үшін — БІРНЕШЕ зауытты қатар таңдауға болады
  const [selectedFacs, setSelectedFacs] = useState<PollutionSourceCandidate[]>([]);
  // Жақын орналасқан шағын нысандардың жазуы алыстан бір-бірін жабады — тек жақындағанда
  const [mapZoom, setMapZoom] = useState(ATYRAU.zoom);
  const MINOR_LABEL_ZOOM = 10;
  const MINOR_FACILITIES = new Set(["tets", "karabatan_gtes", "przhto", "wwtp", "abz"]);
  const isSel = (id: string) => selectedFacs.some((f) => f.id === id);
  const toggleFac = (c: PollutionSourceCandidate) =>
    setSelectedFacs((p) => (p.some((f) => f.id === c.id) ? p.filter((f) => f.id !== c.id) : [...p, c]));
  const isTopSelected = !!source?.top && isSel(source.top.id);
  const plumeLine = useMemo(() => {
    // Елді мекен жолы — тек анықталған көз (top) таңдалғанда
    if (!isTopSelected || !source?.top || !source.plume.length) return null;
    const coords: [number, number][] = [
      [source.top.lng, source.top.lat],
      ...source.plume.map((p) => [p.lng, p.lat] as [number, number]),
    ];
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: coords } }],
    };
  }, [source, isTopSelected]);
  // УАҚЫТ БАСҚАРУЫ — бір ғана біріктірілген желі.
  //
  // Бұрын екі бөлек батырма болатын («Өткен 24сағ» / «Алдағы 24сағ»),
  // әрқайсысы автоойнататын, тоқтатуға да, нақты сағатты таңдауға да
  // болмайтын. Енді бір слайдер: барлық сағат бір қатарда, қолмен
  // таңдалады, тоқтайды. Ақпарат шашырамайды.
  //
  // ⚠️ Күй ИНДЕКС емес, УАҚЫТ болып сақталады. Индекс болса, дерек
  // ауысқанда (аймақ/архив сағаты) ол ескі орында қалып, мүлдем басқа
  // сағатты көрсетер еді — сондықтан оны effect-пен қалпына келтіруге
  // тура келетін. Уақытпен ондай қажеттілік жоқ: жаңа деректе ол уақыт
  // табылмаса, тірек сағатқа өзі оралады.
  const [tlTime, setTlTime] = useState<string | null>(null);
  const [tlPlaying, setTlPlaying] = useState(false);
  const timeline = useMemo(() => source?.timeline ?? [], [source]);
  const pivotIdx = useMemo(() => {
    const p = timeline.findIndex((r) => r.pivot);
    return p >= 0 ? p : Math.max(0, timeline.length - 1);
  }, [timeline]);
  const tlIdx = useMemo(() => {
    if (!tlTime) return pivotIdx;
    const i = timeline.findIndex((r) => r.time === tlTime);
    return i >= 0 ? i : pivotIdx;
  }, [tlTime, timeline, pivotIdx]);
  useEffect(() => {
    if (!tlPlaying || timeline.length < 2) return;
    const t = setInterval(() => {
      setTlTime((cur) => {
        const i = cur ? timeline.findIndex((r) => r.time === cur) : -1;
        return timeline[(Math.max(0, i) + 1) % timeline.length].time;
      });
    }, 450);
    return () => clearInterval(t);
  }, [tlPlaying, timeline]);
  // Кадрдың геометриясы: хронологиядағы сағатқа сәйкес конус
  const activeFrame = useMemo(() => {
    const row = timeline[tlIdx];
    if (!row || !source) return null;
    const all = [...(source.frames ?? []), ...(source.forecastFrames ?? [])];
    return all.find((f) => f.time === row.time) ?? null;
  }, [timeline, tlIdx, source]);
  // Белсенді конустар — БАРЛЫҚ таңдалған зауыттар үшін (MultiPolygon)
  const plumeConeGeo = useMemo(() => {
    if (!selectedFacs.length || !source) return null;
    const toB = activeFrame ? activeFrame.toBearing : source.wind.toBearing;
    const spd = activeFrame ? activeFrame.speed : source.wind.speed;
    // Геометрия серверден: орнықтылық класы мен жел бағытының ауытқуы.
    // Клиентте қайта есептелмейді — әйтпесе конус сервердегіден өзгеше болады.
    const geo = {
      stability: source.stability.cls,
      windMs: source.wind.speed / 3.6,
      dirSigma: source.stability.windDirSigma,
    };
    // Сызбада кемінде MIN_VISUAL_HALF_ANGLE — түнгі орнықты қабатта
    // нақты бұрыш 2–3°-қа түсіп, конус экранда көрінбей қалады.
    // Панельде НАҚТЫ бұрыш жазылады, есептеу де нақтысымен жүреді.
    const polys = selectedFacs.map((f) => [
      plumeCone({ lat: f.lat, lng: f.lng }, toB, spd, geo, MIN_VISUAL_HALF_ANGLE),
    ]);
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "MultiPolygon" as const, coordinates: polys } }],
    };
  }, [selectedFacs, source, activeFrame]);
  // Дисперсия болжамы: таңдалған көкжиек (30мин/1сағ/3сағ) — барлық таңдалған зауытқа
  const [fcStep, setFcStep] = useState<number | null>(null);
  const forecastGeo = useMemo(() => {
    if (fcStep == null || !selectedFacs.length || !source?.forecast?.[fcStep]) return null;
    const f = source.forecast[fcStep];
    // ⚠️ Сервер бұлтты САҒАТТЫҚ БОЛЖАМ желімен жылжытады (жел бұрылуын
    // ескереді) әрі «Жетеді: …» тізімін сол орынға қарап жасайды.
    // Бұрын клиент оны елемей, ағымдағы желмен тұрақты деп қайта
    // есептейтін — жел бұрылғанда карта мен мәтін 20 км-ге дейін
    // алшақтайтын, ал шеңбер радиусы небәрі 7 км. Енді сервердің
    // координатасы тікелей қолданылады.
    const polys = selectedFacs.map((fac) => {
      // Топ көзден басқа зауыт таңдалса — сервердің ЫҒЫСУЫН сол зауытқа
      // қолданамыз (бағыт пен жол бірдей, тек бастауы басқа)
      const dLat = f.lat - (source.top?.lat ?? fac.lat);
      const dLng = f.lng - (source.top?.lng ?? fac.lng);
      return [fcCircle(fac.lat + dLat, fac.lng + dLng, f.radiusKm)];
    });
    return {
      type: "FeatureCollection" as const,
      features: [{ type: "Feature" as const, properties: {}, geometry: { type: "MultiPolygon" as const, coordinates: polys } }],
    };
  }, [fcStep, selectedFacs, source]);
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
      siteName: `${tr("Ластану көзі")}: ${tr(source.top.name)}`,
      lat: source.top.lat,
      lng: source.top.lng,
      riskScore: conf,
      riskLevel,
      recipient: tr("Атырау облысының экология департаменті"),
      reason: `${tr("Ауа ластану көзі анықталды (")}${tr(source.pollutantLabel)}, ${tr("сенімділік")} ${conf}%) — ${tr("өнеркәсіптік эмиссия тексерілуі қажет")}`,
      createdAt: new Date().toISOString(),
      status: "sent",
    });
    toast.success(tr("Ескерту жіберілді — «Ескертулер» бөлімінен қараңыз"));
  };
  // Зауыт басылғанда сол координатаның тірі ауа сапасын көрсету
  interface FacAir { aqi: number | null; pm2_5: number | null; pm10: number | null; so2: number | null; no2: number | null }
  const [facAir, setFacAir] = useState<
    { fac: PollutionSourceCandidate; data: FacAir | null; error: boolean } | null
  >(null);
  const [facFlares, setFacFlares] = useState<{ byFacility: Record<string, number>; days: number; fetchedAt: string } | null>(null);
  const [facFlaresError, setFacFlaresError] = useState(false);
  useEffect(() => {
    if (!sourceMode || facFlares) return;
    const controller = new AbortController();
    fetch("/api/fire-archive?days=365", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { anomalies?: { facilityId: string | null }[]; days: number; fetchedAt: string }) => {
        if (controller.signal.aborted) return;
        const byFacility: Record<string, number> = {};
        for (const a of d.anomalies ?? []) if (a.facilityId) byFacility[a.facilityId] = (byFacility[a.facilityId] ?? 0) + 1;
        setFacFlares({ byFacility, days: d.days, fetchedAt: d.fetchedAt });
        setFacFlaresError(false);
      })
      .catch(() => { if (!controller.signal.aborted) setFacFlaresError(true); });
    return () => controller.abort();
  }, [sourceMode, facFlares]);
  const openFacilityAir = useCallback((fac: PollutionSourceCandidate) => {
    setFacAir({ fac, data: null, error: false });
    // CAMS нүктелік моделі (жердегі станса нысаннан 25 км-ден алыс — жолақта көрсетілмейді)
    fetch(`/api/point-air?lat=${fac.lat}&lng=${fac.lng}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setFacAir((cur) => (cur && cur.fac.id === fac.id ? (d.error ? { ...cur, error: true } : { ...cur, data: d }) : cur)))
      .catch(() => setFacAir((cur) => (cur && cur.fac.id === fac.id ? { ...cur, error: true } : cur)));
  }, []);

  // Мұнай дағын сканерлеу (AI) — картаның ортасындағы аймақты Sentinel-1 SAR-мен
  interface OilScan {
    available?: boolean; reason?: string; error?: string; suspected?: boolean;
    confidence?: number | null; description?: string; caveat?: string; imageUrl?: string;
  }
  const [oilScan, setOilScan] = useState<{ loading: boolean; data: OilScan | null } | null>(null);
  const scanOil = useCallback(() => {
    const c = mapRef.current?.getCenter();
    if (!c) return;
    openRightView("sar");
    setOilScan({ loading: true, data: null });
    fetch(`/api/oil-scan?lat=${c.lat.toFixed(4)}&lng=${c.lng.toFixed(4)}`)
      .then((r) => r.json())
      .then((d) => setOilScan({ loading: false, data: d }))
      .catch(() => setOilScan({ loading: false, data: { error: "Сканер қолжетімсіз" } }));
  }, [openRightView]);
  // Азаматтық растау: plume конусы ішіндегі ластану хабарламаларын санау
  const sourceCorroboration = useMemo(() => {
    if (!source?.top || !source.cone?.length) return 0;
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
  // Мобильде панельдер әдепкіде ЖИНАЛҒАН (картаны жаппау үшін); десктопта ашық

  const [gibsKey, setGibsKey] = useState<string | null>(null);



  // Сағаттық режим: 0..23 (әдепкі — қазіргі сағат). Иконкалар сағат сайын
  // координата бойынша қайта шоғырланады.
  // Сағаттық терезе: өткен 24 + алдағы 24 = 48 нүкте, ортасы «қазір».
  // `null` — пайдаланушы әлі жылжытпаған, сондықтан «қазірде» тұрады.
  const [mosHour, setMosHour] = useState<number | null>(null);
  const [mosPlaying, setMosPlaying] = useState(false);
  // Нақты уақыт өткен сайын әдепкі көрсетілетін сағат жаңарады (ойнатпаса).
  // `null` — «қазірде тұр» дегені, ол деректен есептеледі.
  useEffect(() => {
    if (mosPlaying || activeLayer !== "mosquito") return;
    const t = setInterval(() => setMosHour(null), 60_000);
    return () => clearInterval(t);
  }, [mosPlaying, activeLayer]);

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

  // Анимация: 24 сағатты сағат сайын айналдыру

  // Таңдалған сағаттың индексі (болмаса — ағымдағы)
  const mosHours = mosGrid?.[0]?.hours;
  const mosNowIdx = mosGrid?.[0]?.nowIndex ?? 24;
  // Деректер жүктелгенше де дұрыс жұмыс істеуі үшін — туынды шама
  const mosIdx = Math.min(mosHour ?? mosNowIdx, Math.max(0, (mosHours?.length ?? 1) - 1));
  const mosHourIndex = (p: MosquitoGridPoint) => p.hours?.[mosIdx]?.index ?? p.index;

  // Сағаттық анимация — 48 сағаттық терезе бойымен айналады
  useEffect(() => {
    if (!mosPlaying || activeLayer !== "mosquito") return;
    const len = Math.max(1, mosHours?.length ?? 48);
    const t = setInterval(() => setMosHour((h) => ((h ?? mosNowIdx) + 1) % len), 450);
    return () => clearInterval(t);
  }, [mosPlaying, activeLayer, mosHours?.length, mosNowIdx]);


  const mosStats = useMemo(() => {
    if (!mosGrid?.length) return null;
    const vals = mosGrid.map(mosHourIndex);
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
      hottest: mosGrid.reduce((a, b) => (mosHourIndex(b) > mosHourIndex(a) ? b : a)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosGrid, mosIdx]);

  // Қала аудандары бойынша рейтинг — осы сағаттағы FPEB индексі, ретімен
  const mosDistricts = useMemo(() => {
    if (!mosGrid?.length) return [];
    return mosGrid
      .filter((p) => p.dense && p.name)
      .map((p) => ({ name: p.name as string, index: mosHourIndex(p) }))
      .sort((a, b) => b.index - a.index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mosGrid, mosIdx]);

  const airStats = useMemo(() => {
    const vals = (airGrid ?? []).map(elemVal).filter((v): v is number => v != null);
    if (!vals.length) return null;
    const rnd = (v: number) => (airElem.maxRef >= 500 ? Math.round(v) : +v.toFixed(airElem.maxRef <= 2 ? 2 : 1));
    // city districts ranked by the selected element (best → worst)
    const districts = (airGrid ?? [])
      .filter((p) => p.dense && elemVal(p) != null)
      .map((p) => ({ name: p.name ?? "?", aqi: rnd(elemVal(p)!) }))
      .sort((a, b) => a.aqi - b.aqi);
    return {
      min: rnd(Math.min(...vals)),
      max: rnd(Math.max(...vals)),
      avg: rnd(vals.reduce((a, b) => a + b, 0) / vals.length),
      districts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airGrid, airHour, airElem]);

  const heatmapData = useMemo(() => {
    if (!activeLayer) return null;
    if (activeLayer === "green") return null;
    // Air layer: real live AQI grid; other layers: platform analyses
    if (activeLayer === "air") {
      if (!airGrid) return null;
      return {
        type: "FeatureCollection" as const,
        features: airGrid
          .filter((p) => elemVal(p) != null)
          .map((p) => ({
            type: "Feature" as const,
            geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
            properties: { weight: Math.min(1, (elemVal(p) ?? 0) / airElem.maxRef) },
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
          properties: { weight: Math.min(1, mosHourIndex(p) / 100) },
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
  }, [allSites, activeLayer, airGrid, mosGrid, mosIdx, airHour, airElem, soilGrid, wasteSites]);

  // Grid layers need a wide radius — sparse regional points
  const isGridLayer = activeLayer === "air" || activeLayer === "mosquito" || activeLayer === "soil";

  // МАСА ИКОНКАЛАРЫ.
  //
  // Ереже: БІР ЕСЕПТЕЛГЕН КООРДИНАТА = БІР ИКОНКА. Иконкалар ойдан
  // шашыратылмайды әрі көбейтілмейді — картадағы әр маса нақты есептелген
  // нүктені білдіреді (Атырауда 90: облыстық тор 25 + қала тізілімі 65).
  //
  // Бұрын индексі 12-ден төмен нүктелер жасырылатын. Ол қате еді: иконканың
  // жоқтығы «дерек жоқ» деп оқылатын. Енді бәрі көрінеді, тек ТҮСІ мен
  // ӨЛШЕМІ деңгейге қарай өзгереді.
  const mosquitoSwarm = useMemo(() => {
    if (activeLayer !== "mosquito" || !mosGrid) return [];
    return mosGrid.map((p) => {
      const idx = mosHourIndex(p);
      const { color, label } = mosLevel(idx);
      return {
        id: `${p.lat},${p.lng}`,
        lat: p.lat,
        lng: p.lng,
        // 13..28 px — төмен индексте де көрінетіндей
        size: Math.round(13 + (idx / 100) * 15),
        color,
        idx,
        label,
        name: p.name,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, mosGrid, mosIdx]);

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
          const data = await res.json();
          if (!res.ok) {
            // Жалған дерек көрсетілмейді — себебін нақты айтамыз
            toast.error(tr(data.error ?? "AI агент қолжетімсіз"), {
              description: data.detail ? tr(data.detail) : undefined,
              duration: 8000,
            });
            return;
          }
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
          setSelected(site); openRightView("analysis");
          toast.success(tr("AI агент көп дереккөзді бағалауы дайын!"));
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
          const data = await res.json();
          if (!res.ok) {
            toast.error(tr(data.error ?? "AI талдауы қолжетімсіз"), {
              description: data.detail ? tr(data.detail) : undefined,
              duration: 8000,
            });
            return;
          }
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
          setSelected(site); openRightView("analysis");
          toast.success(tr("AI талдауы дайын!"));
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
    [analyzing, addSite, viewYear, lang, openRightView, tr]
  );

  const toolsPick = useMapToolsStore((st) => st.pick);
  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => {
      // Құралдар (ToolsPanel) картаны басуды бірінші алады
      const tools = useMapToolsStore.getState();
      if (rightView === "tools" && tools.pick === "polygon") { tools.addVertex([e.lngLat.lng, e.lngLat.lat]); return; }
      if (rightView === "tools" && tools.pick === "point") { tools.setPoint([e.lngLat.lng, e.lngLat.lat]); tools.setPick("none"); return; }
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
    [analyzeAt, aiOn, aiTool, rightView]
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
      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <Panel className="max-w-md">
          <PanelHeader title={tr("Карта уақытша қолжетімсіз")} description={tr("Карта қызметі бапталмаған. Деректер көрсетілмейді.")} />
        </Panel>
      </div>
    );
  }

  return (
    <div ref={workspaceRef} className={`portal-map ${styles.workspace}`} data-left={panelOpen} data-right={rightOpen} data-sheet={mobileSheet ?? "none"} onKeyDown={(e) => { if (e.key === "Escape" && mobileSheet) { (mobileSheet === "left" ? leftToggleRef : rightToggleRef).current?.focus(); setMobileSheet(null); } }}>
      <div className={styles.toolbar}>
        <Button variant="portal-outline" size="portal" ref={leftToggleRef} aria-controls="map-layers" aria-expanded={desktop ? panelOpen : mobileSheet === "left"} onClick={() => { if (desktop) setPanelOpen((v) => !v); else setMobileSheet((v) => v === "left" ? null : "left"); }}>
          <Layers className="h-4 w-4" aria-hidden /><span className="sr-only sm:not-sr-only">{tr("Қабаттар")}</span>
        </Button>
        <div className="static min-w-0 flex-1 lg:relative">        <MapSearch
          onOpen={() => setMobileSheet(null)}
          onSelect={(lng, lat, _label, zoom) =>
            mapRef.current?.flyTo({ center: [lng, lat], zoom: zoom ?? 14, duration: 1200 })
          }
        />
</div>
        <Button variant="portal-outline" size="portal" ref={rightToggleRef} aria-controls="map-data" aria-expanded={desktop ? rightOpen : mobileSheet === "right"} onClick={() => { if (desktop) setRightOpen((v) => !v); else setMobileSheet((v) => v === "right" ? null : "right"); }}>
          <Wind className="h-4 w-4" aria-hidden /><span className="sr-only sm:not-sr-only">{tr("Деректер")}</span>
        </Button>
      </div>
      <div className={styles.canvas}>
      <div ref={stageRef} className={styles.stage}>
      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={ATYRAU}
        mapStyle={
          mapStyle === "satellite"
            ? "mapbox://styles/mapbox/satellite-streets-v12"
            : "mapbox://styles/mapbox/streets-v12"
        }
        onClick={handleClick}
        onZoomEnd={(e) => setMapZoom(e.viewState.zoom)}
        cursor={analyzing ? "wait" : aiOn || (rightView === "tools" && toolsPick !== "none") ? "crosshair" : "grab"}
        attributionControl={false}
      >
        {/* Атрибуция — compact (кішкентай ⓘ). Лицензия бойынша міндетті, бірақ жинақы. */}
        <AttributionControl compact position="bottom-right" />
        {activeLayer === "green" && greenChange && !greenChangeError && (
          <Source id="green-cells" type="geojson" data={greenCellsGeo} attribution="Copernicus Sentinel-2 L2A">
            <Layer id="green-change-fill" type="fill" filter={["!=", ["get", "trend"], "no-data"]} paint={{
              "fill-color": ["match", ["get", "trend"], "up", "#22c55e", "down", "#ef4444", "#a3a3a3"],
              "fill-opacity": 0.18,
            }} />
            <Layer id="green-change-outline" type="line" filter={["!=", ["get", "trend"], "no-data"]} paint={{ "line-color": "#a3a3a3", "line-width": 1 }} />
            <Layer id="green-change-missing" type="line" filter={["==", ["get", "trend"], "no-data"]} paint={{ "line-color": "#a3a3a3", "line-width": 1.5, "line-dasharray": [3, 3] }} />
          </Source>
        )}
        {sourceMode && (
          <Source id="facility-footprints" type="geojson" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL'
            data={{ type: "FeatureCollection", features: FACILITIES.filter((f) => f.footprint).flatMap((f) => {
              const fp = f.footprint!;
              const rings = (Array.isArray(fp[0][0]) ? fp : [fp]) as [number, number][][];
              return rings.map((ring) => ({ type: "Feature" as const, properties: { id: f.id }, geometry: { type: "Polygon" as const, coordinates: [ring] } }));
            }) }}>
            <Layer id="facility-footprint-fill" type="fill" paint={{ "fill-color": "#b91c1c", "fill-opacity": 0.12 }} />
            <Layer id="facility-footprint-line" type="line" paint={{ "line-color": "#b91c1c", "line-width": 1.5 }} />
          </Source>
        )}
        {activeLayer === "nature" && (
          <Source id="akzhaiyk" type="geojson" data={reserveGeo} attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL'>
            <Layer id="akzhaiyk-fill" type="fill" paint={{ "fill-color": "#0e7490", "fill-opacity": 0.15 }} />
            <Layer id="akzhaiyk-line" type="line" paint={{ "line-color": "#0e7490", "line-width": 2, "line-dasharray": [2, 1] }} />
          </Source>
        )}
        {activeLayer === "nature" && fauna && !faunaError && (
          <Source id="gbif-fauna" type="geojson" attribution="GBIF.org" data={{ type: "FeatureCollection", features: fauna.points.map((p) => ({ type: "Feature" as const, properties: { species: p.species, km: p.precisionKm }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] } })) }}>
            <Layer id="gbif-fauna-pt" type="circle" paint={{ "circle-color": ["case", [">", ["get", "km"], 1], "#f59e0b", "#0e7490"], "circle-radius": ["case", [">", ["get", "km"], 1], 7, 3.5], "circle-opacity": 0.75, "circle-stroke-color": "#fff", "circle-stroke-width": 1 }} />
          </Source>
        )}
        {activeLayer === "landuse" && landuse && !landuseError && (
          <Source id="osm-landuse" type="geojson" data={landuse.features} attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL'>
            <Layer id="osm-landuse-fill" type="fill" paint={{
              "fill-color": ["match", ["get", "category"], ...Object.entries(LANDUSE_COLOR).flat(), "#a3a3a3"] as unknown as string,
              "fill-opacity": 0.28,
            }} />
            <Layer id="osm-landuse-outline" type="line" paint={{ "line-color": ["match", ["get", "category"], ...Object.entries(LANDUSE_COLOR).flat(), "#a3a3a3"] as unknown as string, "line-width": 1 }} />
          </Source>
        )}
        {activeLayer === "green" && osm && !osmError && (
          <Source id="osm-green" type="geojson" data={osm.features} attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ODbL'>
            <Layer id="osm-green-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "fill-color": "#22c55e", "fill-opacity": 0.3 }} />
            <Layer id="osm-green-outline" type="line" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "line-color": "#86efac", "line-width": 1 }} />
            <Layer id="osm-green-row" type="line" filter={["==", ["get", "category"], "tree_row"]} paint={{ "line-color": "#4ade80", "line-width": 3 }} />
            <Layer id="osm-green-tree" type="circle" minzoom={12} filter={["==", ["get", "category"], "tree"]} paint={{ "circle-color": "#86efac", "circle-radius": 3, "circle-stroke-color": "#166534", "circle-stroke-width": 1 }} />
          </Source>
        )}
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


        <ToolsMapLayers visible={rightView === "tools"} />

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
        {/* Дерек жоқ нүктеге стрелка салынбайды (P1.10) */}
        {activeLayer === "wind" && windData?.grid.map((w, i) =>
          w.speed == null || w.dir == null ? null : (
            <Marker key={`wind-${i}`} latitude={w.lat} longitude={w.lng}>
              <div
                title={`${Math.round(w.speed)} ${tr("км/сағ")}`}
                style={{ transform: `rotate(${w.dir + 180}deg)`, opacity: Math.min(1, 0.45 + w.speed / 30) }}
              >
                <svg width={14 + Math.min(14, w.speed / 2)} height={14 + Math.min(14, w.speed / 2)} viewBox="0 0 24 24" className="drop-shadow">
                  <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#67e8f9" stroke="#0e7490" strokeWidth="1" />
                </svg>
              </div>
            </Marker>
          )
        )}

        {/* Тірі маса swarm — тығыздық FPEB индексіне сай, әр иконка дірілдеп қозғалады */}
        {mosquitoSwarm.map((m, i) => (
          <Marker key={m.id} latitude={m.lat} longitude={m.lng}>
            <span
              className="mos-flit"
              title={`${m.name ?? tr("тор нүктесі")} · MRI ${m.idx}/100 — ${tr(m.label)}`}
              style={{ animationDelay: `${(i % 12) * 0.18}s`, animationDuration: `${2.2 + (i % 5) * 0.35}s` }}
            >
              {/* Деңгей түсіндегі жұмсақ гало — спутник фонында да көрінеді */}
              <span
                className="relative flex items-center justify-center"
                style={{ width: m.size * 1.9, height: m.size * 1.9 }}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `radial-gradient(circle, ${m.color}66 0%, ${m.color}22 55%, transparent 72%)`,
                  }}
                />
                <MosquitoIcon
                  size={m.size}
                  style={{ color: m.color, filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.75))" }}
                />
              </span>
            </span>
          </Marker>
        ))}

        {/* Live Zhaiyk river discharge points (GloFAS) — water layer */}
        {activeLayer === "water" &&
          flood?.map((p) => (
            <Marker key={`flood-${p.name}`} latitude={p.lat} longitude={p.lng}>
              <div
                title={`${p.name}: ${p.discharge} м³/с · ${tr(p.level)} · ${tr("тренд")} ${tr(p.trend)}`}
                className="flex flex-col items-center"
              >
                <div
                  className="rounded-full border-2 border-neutral-300 px-1.5 py-0.5 text-[12px] font-bold text-neutral-900 shadow-md"
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
                setSelected(s); openRightView("analysis");
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-neutral-300 shadow-md transition-transform hover:scale-125"
                style={{ backgroundColor: RISK_COLORS[s.analysis.riskLevel] }}
                title={`${s.name ?? tr("Қоқыс нүктесі")} · ${tr("тәуекел")} ${s.analysis.riskScore}`}
              >
                <Trash2 className="h-3 w-3 text-neutral-900" />
              </div>
            </Marker>
          ))}

        {/* Live gas flares (NASA FIRMS) — oil layer */}
        {activeLayer === "oil" &&
          flares?.map((f, i) => (
            <Marker key={`flare-${i}`} latitude={f.lat} longitude={f.lng}>
              <div
                title={`${tr("Жылу аномалиясы (расталмаған)")} · FRP ${f.frp}МВт · ${f.acqDate} · ${tr("сенімділік")} ${f.confidence}`}
                className="flex items-center justify-center"
              >
                <Flame
                  className="text-orange-800 drop-shadow"
                  style={{ width: 12 + Math.min(14, f.frp / 3), height: 12 + Math.min(14, f.frp / 3) }}
                  fill="#fb923c"
                />
              </div>
            </Marker>
          ))}

        {/* FIRMS архиві — категория бойынша түсті шеңбер (расталған өрт емес) */}
        {activeLayer === "oil" && fireAnomalies.length > 0 && (
          <Source id="fire-archive" type="geojson" data={fireGeo}>
            <Layer
              id="fire-archive-circle"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 4, 50, 8, 200, 14],
                "circle-color": [
                  "match",
                  ["get", "category"],
                  "industrial_flare",
                  FIRE_CATEGORY_COLOR.industrial_flare,
                  FIRE_CATEGORY_COLOR.unconfirmed_anomaly,
                ],
                "circle-opacity": 0.75,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#111827",
              }}
            />
          </Source>
        )}

        {/* ҚАМЫС ӨРТІ ТӘУЕКЕЛІ (P4.5): қамыс терезелері (NDVI проксиі) */}
        {activeLayer === "fire" && reedPolys.length > 0 && (
          <Source id="reed-zones" type="geojson" data={reedZonesGeo}>
            <Layer id="reed-zones-fill" type="fill" paint={{ "fill-color": "#22c55e", "fill-opacity": 0.12 }} />
            <Layer id="reed-zones-outline" type="line" paint={{ "line-color": "#22c55e", "line-width": 1.5, "line-opacity": 0.7 }} />
          </Source>
        )}
        {/* Түтін конусы — 📊 модель нәтижесі (тек соңғы 2 тәулік) */}
        {activeLayer === "fire" && reedConeGeo.features.length > 0 && (
          <Source id="reed-smoke-cones" type="geojson" data={reedConeGeo}>
            <Layer id="reed-smoke-cones-fill" type="fill" paint={{ "fill-color": "#7dd3fc", "fill-opacity": 0.15 }} />
            <Layer
              id="reed-smoke-cones-outline"
              type="line"
              paint={{ "line-color": "#7dd3fc", "line-width": 2, "line-opacity": 0.55, "line-dasharray": [3, 2] }}
            />
          </Source>
        )}
        {/* Жел жоқ — бағыт есептелмеді: сұр үзік шеңбер (конус сызылмайды) */}
        {activeLayer === "fire" && reedNoWindGeo.features.length > 0 && (
          <Source id="reed-no-wind" type="geojson" data={reedNoWindGeo}>
            <Layer
              id="reed-no-wind-ring"
              type="line"
              paint={{ "line-color": "#9ca3af", "line-width": 1.5, "line-dasharray": [2, 2] }}
            />
          </Source>
        )}
        {/* Қамыс аймағындағы жылу аномалиялары (өндірістік алаусыз) */}
        {activeLayer === "fire" && reedAnoms.length > 0 && (
          <Source id="reed-anomalies" type="geojson" data={reedAnomGeo}>
            <Layer
              id="reed-anomalies-circle"
              type="circle"
              paint={{
                "circle-radius": ["interpolate", ["linear"], ["get", "frp"], 0, 4, 50, 8, 200, 14],
                "circle-color": "#fb923c",
                "circle-opacity": 0.85,
                "circle-stroke-width": 1,
                "circle-stroke-color": "#111827",
              }}
            />
          </Source>
        )}
        {activeLayer === "fire" &&
          reedCones.slice(0, REED_MARKER_CAP).map(({ a, cone }) => (
            <Marker
              key={`reed-lbl-${reedAnomalyKey(a)}`}
              latitude={a.lat}
              longitude={a.lng}
              anchor="bottom"
              offset={[0, -10]}
            >
              {cone.status === "ok" ? (
                <div className="flex items-center gap-1 rounded-md border border-sky-400/40 bg-white px-1.5 py-0.5 text-[11px] text-sky-800 shadow">
                  <TierBadge tone="light" tier="model" />
                  <span>{tr("Модель нәтижесі")}</span>
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-neutral-500 bg-white px-1.5 py-0.5 text-[11px] text-neutral-800 shadow">
                  {tr("жел деректері жоқ — бағыт есептелмеді")}
                </div>
              )}
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
                setSelected(s); openRightView("analysis");
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-neutral-300 text-[12px] shadow-lg transition-transform hover:scale-125"
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
                setSelected(s); openRightView("analysis");
              }}
            >
              <div
                className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border-2 border-neutral-300 text-neutral-900 shadow-md transition-transform hover:scale-125"
                style={{ backgroundColor: RISK_COLORS[s.analysis.riskLevel] }}
                title={s.name}
              >
                <Camera className="h-3 w-3" />
              </div>
            </Marker>
          ))}

        {/* Ластану көзі режимі: дисперсия конусы + plume сызығы + маркерлер */}
        {/* Конус түсі оқиғаның бар-жоғын білдіреді:
            ҚЫЗЫЛ — ластану анықталды (detected)
            СҰР   — ластану жоқ, бұл тек «жел осылай тұрса» деген БАҒЫТ.
            Бұрын екеуі де қызыл болатын: аты аталған зауыттан қызыл шлейф
            сызу оқиға жоқ кезде де беделдік/құқықтық тәуекел тудыратын. */}
        {sourceMode && plumeConeGeo && (
          <Source id="plume-cone" type="geojson" data={plumeConeGeo}>
            <Layer
              id="plume-cone-fill"
              type="fill"
              paint={{
                "fill-color": source?.detected ? "#ef4444" : "#7dd3fc",
                "fill-opacity": source?.detected ? 0.18 : 0.13,
              }}
            />
            <Layer
              id="plume-cone-outline"
              type="line"
              paint={{
                // Жіңішке конустың контуры толтырудан гөрі жақсы көрінеді
                "line-color": source?.detected ? "#f87171" : "#7dd3fc",
                "line-width": 2,
                "line-opacity": source?.detected ? 0.65 : 0.55,
                "line-dasharray": source?.detected ? [1, 0] : [3, 2],
              }}
            />
          </Source>
        )}
        {/* Жел стрелкалары — әр таңдалған зауытта */}
        {sourceMode && source && selectedFacs.map((fac) => (
          <Marker key={`arw-${fac.id}`} latitude={fac.lat} longitude={fac.lng}>
            <div
              className="transition-transform duration-300"
              style={{ transform: `rotate(${activeFrame ? activeFrame.toBearing : source.wind.toBearing}deg)` }}
              title={tr("Жел бағыты")}
            >
              <Navigation className="h-5 w-5 fill-red-400 text-red-800 drop-shadow" />
            </div>
          </Marker>
        ))}
        {/* Ағып тұратын «түтін» бөлшектері — әр таңдалған зауыттан желмен */}
        {sourceMode && source && selectedFacs.map((fac) => {
          const b = ((activeFrame ? activeFrame.toBearing : source.wind.toBearing) * Math.PI) / 180;
          const D = 48;
          const style = { "--dx": `${Math.sin(b) * D}px`, "--dy": `${-Math.cos(b) * D}px` } as React.CSSProperties;
          return (
            <Marker key={`prt-${fac.id}`} latitude={fac.lat} longitude={fac.lng}>
              <div className="pointer-events-none relative" style={style}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="plume-particle" style={{ animationDelay: `${i * 0.5}s` }} />
                ))}
              </div>
            </Marker>
          );
        })}
        {/* Дисперсия болжамы: болашақ орны (footprint + әр зауыт орталығы) */}
        {sourceMode && forecastGeo && fcStep != null && selectedFacs.length > 0 && source?.forecast?.[fcStep] && (
          <>
            <Source id="fc-footprint" type="geojson" data={forecastGeo}>
              <Layer id="fc-fill" type="fill" paint={{ "fill-color": "#fb923c", "fill-opacity": 0.2 }} />
              <Layer id="fc-outline" type="line" paint={{ "line-color": "#fb923c", "line-width": 2, "line-dasharray": [2, 1.5] }} />
            </Source>
            {selectedFacs.map((fac) => {
              const f = source.forecast[fcStep];
              // Сервердің есептеген орны (сағаттық болжам желімен)
              const la = fac.lat + (f.lat - (source.top?.lat ?? fac.lat));
              const ln = fac.lng + (f.lng - (source.top?.lng ?? fac.lng));
              return (
                <Marker key={`fc-${fac.id}`} latitude={la} longitude={ln}>
                  <div className="rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0.5 text-[12px] font-bold text-neutral-900 shadow-lg">
                    +{f.label}
                  </div>
                </Marker>
              );
            })}
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
          isTopSelected &&
          source?.plume.map((p) => (
            <Marker key={`plume-${p.name}`} latitude={p.lat} longitude={p.lng}>
              <div
                className="rounded-full border border-red-300/60 bg-red-50"
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
                className="flex items-center gap-1 rounded border border-neutral-300 bg-brand px-1 py-px text-[12px] font-bold text-white shadow"
                title={`${st.name ?? tr("Станса")} · ${tr("AQI индексі · нақты датчик")} ${st.aqi}`}
              >
                <Radio className="h-2.5 w-2.5" /> {st.aqi}
              </div>
            </Marker>
          ))}
        {sourceMode &&
          source?.candidates.map((c) => {
            const isTop = source.top?.id === c.id;
            const sel = isSel(c.id);
            return (
              <Marker
                key={`fac-${c.id}`}
                latitude={c.lat}
                longitude={c.lng}
                onClick={(e) => { e.originalEvent.stopPropagation(); openFacilityAir(c); toggleFac(c); }}
              >
                {/* Дәл нүкте: дот координатада тұрады, жапсырма қалқып тұр (anchor ауыспайды) */}
                <div className="relative cursor-pointer" title={`${c.name}${c.approx ? ` (${tr("координата жуық")})` : ""} — ${tr("басу: таралу анимациясы + нысан туралы қысқаша")}`}>
                  <div
                    className={`h-2.5 w-2.5 rounded-full border-2 shadow transition-transform hover:scale-150 ${
                      sel ? "border-amber-300 bg-amber-400 scale-125" : isTop ? "border-white bg-red-500" : "border-neutral-300 bg-neutral-600"
                    }`}
                  />
                  {(sel || isTop || !MINOR_FACILITIES.has(c.id) || mapZoom >= MINOR_LABEL_ZOOM) && <div
                    className={`pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[12px] font-semibold shadow-lg ${
                      sel
                        ? "border-amber-400 bg-amber-50 text-neutral-900"
                        : isTop
                        ? "border-red-400 bg-red-50 text-neutral-900"
                        : "border-neutral-300 bg-white text-neutral-800"
                    }`}
                  >
                    <Factory className="h-3 w-3" /> {c.short}{c.approx ? "~" : ""}
                    {isTop && <span className="ml-0.5" title={tr("Салыстырмалы үлес — 📊 модель, ықтималдық емес")}>{c.confidence}% 📊</span>}
                  </div>}
                </div>
              </Marker>
            );
          })}

      </Map>

      {/* Зауыт басылғанда — картаның үстінде мөлдір ықшам жолақ (толығы /object/[id]) */}
      {sourceMode && facAir && (
        <FacilityBar
          facility={FACILITIES.find((f) => f.id === facAir.fac.id)}
          name={facAir.fac.name}
          no2={facilityNo2Signal(facAir.fac.id)}
          share={facAir.fac.confidence ?? null}
          wind={source?.wind ?? null}
          air={facAir.data}
          airError={facAir.error}
          flares={facFlares ? { count: facFlares.byFacility[facAir.fac.id] ?? 0, days: facFlares.days } : null}
          flaresError={facFlaresError}
          animating={isSel(facAir.fac.id)}
          onToggle={() => toggleFac(facAir.fac)}
          onClose={() => setFacAir(null)}
        />
      )}

      {/* Zoom controls — Google Maps style */}
      <div className={styles.navigation}>
        <button
          onClick={() =>
            mapRef.current?.flyTo({ center: [51.8833, 47.1167], zoom: 12.5, duration: 1400 })
          }
          title={tr("Атырау қаласына жақындау")}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-800   transition-colors hover:bg-white hover:text-neutral-900"
        >
          <Locate className="h-5 w-5" />
        </button>
        <div className="flex flex-col overflow-hidden rounded-md border border-neutral-300 bg-white  ">
          <button
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            title={tr("Жақындату")}
            className="flex h-11 w-11 items-center justify-center text-neutral-800 transition-colors hover:bg-neutral-50 hover:text-neutral-900 active:bg-neutral-50"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="mx-2 h-px bg-neutral-50" />
          <button
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            title={tr("Алыстату")}
            className="flex h-11 w-11 items-center justify-center text-neutral-800 transition-colors hover:bg-neutral-50 hover:text-neutral-900 active:bg-neutral-50"
          >
            <Minus className="h-5 w-5" />
          </button>
        </div>
      </div>

      </div>
      {/* Hint / loading */}
      <div className={styles.actions}>
        {analyzing ? (
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-white px-4 py-2 text-sm text-emerald-800 ">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("AI талдап жатыр…")}
          </div>
        ) : aiOn ? (
          <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs text-violet-800 ">
            {/* Нүкте / Аумақ ауыстырғыш */}
            <div className="flex items-center overflow-hidden rounded-full border border-neutral-300">
              <Button variant="portal-outline" size="portal"
                onClick={() => { setAiTool("point"); setDrawPoints([]); }}
                aria-pressed={aiTool === "point"}
                className={`px-3 py-1 text-[13px] font-medium transition-colors ${aiTool === "point" ? "bg-violet-50 text-violet-800" : "text-neutral-600 hover:bg-neutral-50"}`}
              >
                {tr("Нүкте")}
              </Button>
              <Button variant="portal-outline" size="portal"
                onClick={() => setAiTool("area")}
                aria-pressed={aiTool === "area"}
                className={`px-3 py-1 text-[13px] font-medium transition-colors ${aiTool === "area" ? "bg-sky-50 text-sky-800" : "text-neutral-600 hover:bg-neutral-50"}`}
              >
                {tr("Аумақ")}
              </Button>
            </div>

            {aiTool === "point" ? (
              <span className="text-neutral-800">{tr("Картадан нүкте басыңыз — спутник + тірі деректер талданады")}</span>
            ) : (
              <>
                <span className="text-neutral-800">{tr("Төбе қосыңыз")} ({drawPoints.length})</span>
                <Button variant="portal" size="portal"
                  onClick={finishAreaAnalysis}
                  disabled={drawPoints.length < 3}
                  className="rounded-full bg-brand px-3 py-1 text-[13px] font-medium text-white hover:bg-brand/90 disabled:opacity-40"
                >
                  {tr("Талдау")}
                </Button>
                <Button variant="portal-outline" size="portal"
                  onClick={() => setDrawPoints([])}
                  disabled={drawPoints.length === 0}
                  className="rounded-full border border-neutral-300 px-2.5 py-1 text-[13px] text-neutral-800 hover:bg-neutral-50 disabled:opacity-40"
                >
                  {tr("Тазалау")}
                </Button>
              </>
            )}

            <Button variant="portal-outline" size="portal-icon"
              onClick={() => { setAiOn(false); setDrawPoints([]); setAnalyzedArea(null); }}
              className="rounded-full px-2 py-1 text-[13px] text-neutral-600 hover:text-neutral-900"
              aria-label={tr("Жабу")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs text-neutral-600 ">
            {tr("Талдау үшін сол жақтан «AI талдау» қосыңыз")}
          </div>
        )}
      </div>

      </div>
      <Panel id="map-layers" aria-label={tr("Қабаттар")} className={styles.left} data-mobile-visible={mobileSheet === "left"}>
        <PanelHeader title={tr("Қабаттар")} actions={<Button variant="portal-outline" size="portal-icon" aria-label={tr("Жасыру")} onClick={() => { setPanelOpen(false); setMobileSheet(null); leftToggleRef.current?.focus(); }}><X className="h-4 w-4" /></Button>} />
        <div className={styles.scroll} hidden={!!drawerLayer}>
          <Button variant="portal-outline" size="portal" className="mb-4 w-full" onClick={() => setMapStyle((v) => v === "satellite" ? "streets" : "satellite")}><Layers />{mapStyle === "satellite" ? tr("Қала картасы") : tr("Спутник")}</Button>
        <div className="space-y-3">
          <div className="mb-1.5 px-1 text-[12px] uppercase tracking-wide text-neutral-600">
            {tr("Эко қабаттар")}
          </div>
          <div className="flex w-full flex-col gap-2">
            <div className="flex items-stretch gap-1">
              <Button variant="portal-outline" size="portal" className="min-w-0 flex-1 justify-start" aria-pressed={sourceMode} onClick={() => {
                const next = !sourceMode;
                setSourceMode(next);
                openRightView("eco");
                if (!next) { setSelectedFacs([]); setFacAir(null); setTlPlaying(false); setFcStep(null); }
              }}>
                <Factory /><span className="min-w-0 flex-1"><span className="block">{tr("Ластану көзі")}</span></span>
              </Button>
              <Button variant="portal-outline" size="portal-icon" aria-label={tr("Ластану көзі — толық мәлімет")} onClick={() => setDrawerLayer("source")}><BookOpen /></Button>
            </div>
            <div className="my-0.5 h-px bg-neutral-200" />
            {LAYERS.map((l) => {
              const Icon = LAYER_ICONS[l.key];
              const needsRegistry = LAYER_MODULE[l.key];
              const off = needsRegistry ? !hasModule(region, needsRegistry) : false;
              return (
                <div key={l.key} className="flex items-stretch gap-1">
                  <Button variant="portal-outline" size="portal" aria-pressed={activeLayer === l.key}
                    className={`min-w-0 flex-1 justify-start ${activeLayer === l.key ? "border-brand bg-neutral-100 text-brand" : ""}`}
                    onClick={() => { setActiveLayer((cur) => cur === l.key ? null : l.key); openRightView("eco"); }}>
                    <Icon /><span className="min-w-0 flex-1"><span className="block">{tr(l.label)}</span>
                      {off ? <UiBadge variant="portal" className="mt-1" title={tr(MODULE_REASON[needsRegistry!])}>{tr("жоқ")}</UiBadge>
                        : null}
                    </span>
                  </Button>
                  {DRAWER_KEYS[l.key] && <Button variant="portal-outline" size="portal-icon" aria-label={`${tr(l.label)}: ${tr("Толық мәлімет: деректер, заңнама, AI талдауы")}`} onClick={() => setDrawerLayer(DRAWER_KEYS[l.key]!)}><BookOpen /></Button>}
                </div>
              );
            })}
            <div className="my-0.5 h-px bg-neutral-200" />
            <Button variant="portal-outline" size="portal"
              onClick={() => { setAiOn((v) => !v); setAiTool("point"); setDrawPoints([]); setAnalyzedArea(null); }}
              aria-pressed={aiOn}
              className={`flex items-center justify-start gap-1.5 rounded-md border px-2 py-1.5 text-[13px] transition-colors ${
                aiOn
                  ? "border-violet-500/50 bg-violet-50 text-violet-800"
                  : "border-transparent text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> {tr("AI талдау")}
              <span className={`rounded px-1 py-px text-[12px] uppercase ${aiOn ? "bg-violet-50 text-violet-800" : "bg-neutral-50 text-neutral-600"}`}>
                {aiOn ? tr("қосулы") : tr("өшулі")}
              </span>
            </Button>
            <Button variant="portal-outline" size="portal"
              onClick={() => setShowReports((v) => !v)}
              aria-pressed={showReports}
              className={`flex items-center justify-start gap-1.5 rounded-md border px-2 py-1.5 text-[13px] transition-colors ${
                showReports
                  ? "border-rose-500/50 bg-rose-50 text-rose-800"
                  : "border-transparent text-neutral-800 hover:bg-neutral-50"
              }`}
            >
              <Camera className="h-3.5 w-3.5" /> {tr("Хабарламалар")}
              <span className="rounded bg-neutral-50 px-1 py-px text-[12px] text-neutral-800">
                {photoReports.length}
              </span>
            </Button>

            {/* ───────────── ҚЫЗМЕТТЕР ───────────── */}
            <div className="mt-1.5 border-t border-neutral-300 pt-1.5">
              <div className="px-1 pb-1 text-[12px] font-semibold uppercase tracking-wider text-neutral-600">
                {tr("Қызметтер")}
              </div>
              {SERVICES.map((sv) => (
                <a
                  key={sv.href}
                  href={sv.href}
                  className="flex min-h-11 min-w-11 items-center gap-1.5 rounded-md border border-transparent px-2 py-1.5 text-[13px] text-neutral-800 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <sv.icon className="h-3.5 w-3.5 text-neutral-600" /> {tr(sv.label)}
                </a>
              ))}
            </div>
          </div>
        </div>

        <Button variant="portal-outline" size="portal"
          onClick={() => setAddOpen((v) => !v)}
          aria-expanded={addOpen}
          className={`flex items-center justify-start gap-2 rounded-lg border px-3 py-2 text-xs  transition-colors ${
            addOpen
              ? "border-emerald-500/50 bg-emerald-50 text-emerald-800"
              : "border-neutral-300 bg-white text-neutral-900 hover:bg-white"
          }`}
        >
          <MapPinPlus className="h-4 w-4" />
          {tr("Нүкте қосу")}
        </Button>

        {addOpen && (
          <div className="w-full rounded-lg border border-emerald-500/30 bg-white p-2.5 ">
            <div className="mb-1.5 text-[12px] uppercase tracking-wide text-neutral-600">
              {tr("Координат бойынша")}
            </div>
            <input
              value={addLat}
              onChange={(e) => setAddLat(e.target.value)}
              placeholder={tr("Ендік: 47.1167")}
              className="mb-1.5 min-h-11 w-full rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-600 focus:border-emerald-500/50 "
            />
            <input
              value={addLng}
              onChange={(e) => setAddLng(e.target.value)}
              placeholder={tr("Бойлық: 51.9014")}
              onKeyDown={(e) => e.key === "Enter" && addByCoords()}
              className="mb-2 min-h-11 w-full rounded-md border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-xs text-neutral-900 placeholder:text-neutral-600 focus:border-emerald-500/50 "
            />
            <Button variant="portal" size="portal"
              onClick={addByCoords}
              disabled={analyzing}
              className="w-full rounded-md bg-brand py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {tr("Талдау жасау")}
            </Button>
          </div>
        )}

        <Button variant="portal-outline" size="portal"
          onClick={() => {
            setHistoryMode((v) => !v);
            if (!historyMode) { setYearIdx(0); openRightView("history"); } // start from 2016 to show the contrast
          }}
          aria-pressed={historyMode}
          className={`flex items-center justify-start gap-2 rounded-lg border px-3 py-2 text-xs  transition-colors ${
            historyMode
              ? "border-amber-500/50 bg-amber-50 text-amber-800"
              : "border-neutral-300 bg-white text-neutral-900 hover:bg-white"
          }`}
        >
          <History className="h-4 w-4" />
          {tr("Тарихи режим")}
        </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto" hidden={!drawerLayer}>
      {/* Қабат Drawer — 4 қойынды: деректер / заңнама / AI / тарих */}
      {drawerLayer && (
        <LayerDrawer
          key={`${drawerLayer}:${region.id}`}
          layerKey={drawerLayer}
          regionId={region.id}
          onClose={() => setDrawerLayer(null)}
        />
      )}
        </div>
      </Panel>
      <Panel id="map-data" aria-label={tr("Экологиялық деректер")} className={styles.right} data-mobile-visible={mobileSheet === "right"}>
        <PanelHeader title={tr("Экологиялық деректер")} actions={<Button variant="portal-outline" size="portal-icon" aria-label={tr("Жасыру")} onClick={() => { setRightOpen(false); setMobileSheet(null); rightToggleRef.current?.focus(); }}><X className="h-4 w-4" /></Button>} />
        <Tabs value={rightView} onValueChange={setRightView} className="min-h-0 flex-1 gap-0">
          <TabsList variant="portal" className="grid grid-cols-3" aria-label={tr("Деректер көрінісі")}>
            <TabsTrigger value="eco">{tr("Эко қабаттар")}</TabsTrigger>
            <TabsTrigger value="satellite">{tr("Спутник")}</TabsTrigger>
            <TabsTrigger value="analysis">{tr("AI талдау")}</TabsTrigger>
            <TabsTrigger value="history">{tr("Тарих")}</TabsTrigger>
            <TabsTrigger value="sar">SAR</TabsTrigger>
            <TabsTrigger value="tools">{tr("Құралдар")}</TabsTrigger>
          </TabsList>
        <div className={styles.scroll}>
          <TabsContent value="tools" aria-label={tr("Құралдар")} hidden={rightView !== "tools"}>
            <ToolsPanel />
          </TabsContent>
          <TabsContent forceMount value="eco" aria-label={tr("Эко қабаттар")} hidden={rightView !== "eco"} className="space-y-4">
            {!activeLayer && !sourceMode && <p className="text-sm text-neutral-600">{tr("Деректерді көру үшін қабатты таңдаңыз.")}</p>}
        {/* Өрт қаупі панелі — FWI (Канада жүйесі) */}
        {activeLayer === "fire" && (
          <div className="w-full rounded-lg border border-red-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <Flame className="h-3 w-3" /> {tr("Дала/орман өрті қаупі — тірі")}
            </div>
            {fireError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !fireData ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: "var(--color-brand)" }}>
                      {fireData.fwi}
                    </div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--color-brand)" }}>
                      {tr(fireData.dangerLabel)}
                    </div>
                  </div>
                  <div className="text-right text-[12px] text-neutral-600">{tr("FWI индексі")}</div>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-50">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, (fireData.fwi / 60) * 100)}%`, backgroundColor: fireData.dangerColor }}
                  />
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <div className="rounded bg-neutral-50 p-1.5">
                    <div className="text-sm font-bold text-neutral-900">{fireData.isi}</div>
                    <div className="text-[12px] text-neutral-600">ISI</div>
                  </div>
                  <div className="rounded bg-neutral-50 p-1.5">
                    <div className="text-sm font-bold text-neutral-900">{fireData.bui}</div>
                    <div className="text-[12px] text-neutral-600">BUI</div>
                  </div>
                  <div className="rounded bg-neutral-50 p-1.5">
                    <div className="text-sm font-bold text-neutral-900">{fireData.dc}</div>
                    <div className="text-[12px] text-neutral-600">DC</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                  {tr(fireAdvice(fireData.fwi))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("Канада FWI жүйесі (EFFIS)")} · Open-Meteo · {fireData.spinupDays} {tr("күндік нақты ауа райынан. Қызыл реңк — қауіп деңгейі.")}
                </p>
              </>
            )}
            <LayerIndexNote layer="fire" />
          </div>
        )}

        {activeLayer === "nature" && <NaturePanel fauna={fauna} error={faunaError} />}
        {activeLayer === "landuse" && <LandusePanel data={landuse} error={landuseError} />}
        {activeLayer === "green" && <GreeneryPanel osm={osm} osmError={osmError} change={greenChange} changeError={greenChangeError} />}

        {/* Қамыс өрті — түтін бағыты (P4.5) — 📊 модель */}
        {activeLayer === "fire" && (
          <div className="w-full rounded-lg border border-neutral-300 bg-white p-4 ">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-neutral-900">{tr("Қамыс өрті — түтін бағыты")}</span>
              <span className="flex items-center gap-1 text-[11px] text-neutral-600">
                <TierBadge tone="light" tier="model" /> {tr("Модель нәтижесі")}
              </span>
            </div>
            <div className="mb-2 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px] leading-snug">
              <div className="font-semibold text-neutral-900">{tr("Жылу аномалиясы расталған өрт емес")}</div>
              <div className="text-neutral-600">{tr("Өндірістік алаулар қамыс өртіне саналмайды.")}</div>
            </div>

            {reedError && (
              <SourceErrorBox title={tr("Қамыс мекені деректері қолжетімсіз")} err={reedError} tr={tr} />
            )}
            {fireArchiveError && (
              <SourceErrorBox title={tr("FIRMS архиві қолжетімсіз")} err={fireArchiveError} tr={tr} />
            )}
            {flaresError && (
              <SourceErrorBox
                title={tr("FIRMS NRT (соңғы 2 тәулік) қолжетімсіз")}
                err={{ error: flaresError, reason: flaresReason ?? undefined }}
                tr={tr}
              />
            )}

            {!reedError && (!reed || (!fireArchive && !fireArchiveError) || (!flares && !flaresError)) ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : reed ? (
              <>
                {fireArchive && !fireArchive.complete && (
                  <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-[12px] leading-snug text-amber-800">
                    ⚠️ {tr("Архив толық емес")}: {fireArchive.failedWindows.length} {tr("терезе сәтсіз аяқталды — кейбір күндер көрсетілмеген.")}
                  </div>
                )}
                {/* Әр тақта ӨЗ дереккөзіне тәуелді: дереккөз сәтсіз болса — «—»,
                    ешқашан 0 немесе басқа дереккөздің саны емес */}
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <Stat label={tr("қамыс терезесі (NDVI)")} value={reedError ? "—" : reedPolys.length} />
                  <Stat label={tr("қамыс аймағындағы аномалия (365 күн)")} value={fireArchiveError ? "—" : reedAnoms.length} />
                  <Stat label={tr("соңғы 2 тәулік")} value={flaresError ? "—" : reedRecent.length} />
                </div>

                {flaresError ? null : reedRecent.length === 0 ? (
                  <p className="text-[12px] text-neutral-600">
                    {tr("Соңғы 2 тәулікте қамыс аймағында аномалия жоқ — конус сызылмайды.")}
                  </p>
                ) : reedWindLoading ? (
                  <p className="text-[12px] text-neutral-600">{tr("Жүктелуде…")}</p>
                ) : windError || reedNoWind ? (
                  <div className="flex items-center gap-2 text-[12px] text-neutral-800">
                    <span className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-[#9ca3af]" />
                    {tr("жел деректері жоқ — бағыт есептелмеді")}
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {reedCones.slice(0, REED_MARKER_CAP).map(({ a, cone }) => (
                      <li key={reedAnomalyKey(a)} className="rounded-md bg-neutral-50 p-2 text-[12px] leading-snug">
                        <div className="text-neutral-600">
                          {a.acqDate} · {a.zoneName} · FRP {a.frp} MW
                        </div>
                        {cone.status === "ok" ? (
                          <>
                            <div className="text-neutral-900">
                              → {tr(compassKz(cone.downwind))} ({Math.round(cone.downwind)}°) · {cone.lengthKm} км · ±{cone.halfAngleDeg}°
                            </div>
                            <div className="mt-0.5 text-neutral-800">
                              {cone.settlements.length > 0
                                ? `${tr("Конус ішіндегі елді мекендер")}: ${cone.settlements
                                    .map((s) => `${s.name} (${s.distanceKm} км)`)
                                    .join(", ")}`
                                : tr("Конус ішінде елді мекен жоқ")}
                            </div>
                          </>
                        ) : (
                          <div className="text-neutral-800">{tr("жел деректері жоқ — бағыт есептелмеді")}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}

            <p className="mt-2 text-[11px] leading-snug text-neutral-600">
              {tr("Қамыс аймағы — Sentinel-2 NDVI проксиі (бақылау терезесі), қамыс картасы емес. Конус: Pasquill D класы + жел бағытының ауытқуы. Жел: Open-Meteo, ағымдағы жел — өрт кезіндегі жел емес.")}
            </p>
          </div>
        )}

        {/* Құрғақшылық панелі — SPI-3 (McKee 1993) */}
        {activeLayer === "drought" && (
          <div className="w-full rounded-lg border border-amber-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
              <Droplets className="h-3 w-3" /> {tr("Құрғақшылық индексі — SPI-3")}
            </div>
            {droughtError ? (
              <p className="text-[13px] text-neutral-600">
                {tr("Архив деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
              </p>
            ) : !droughtData ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold" style={{ color: "var(--color-brand)" }}>
                      {droughtData.spi > 0 ? "+" : ""}{droughtData.spi}
                    </div>
                    <div className="text-[13px] font-medium" style={{ color: "var(--color-brand)" }}>
                      {droughtData.droughtLabel}
                    </div>
                  </div>
                  <div className="text-right text-[12px] text-neutral-600">SPI-3</div>
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
                <div className="mt-1 flex justify-between text-[12px] text-neutral-600">
                  <span>{tr("Құрғақ")}</span><span>{tr("Қалыпты")}</span><span>{tr("Ылғалды")}</span>
                </div>
                <div className="mt-2 rounded bg-neutral-50 p-1.5 text-center">
                  <div className="text-sm font-bold text-neutral-900">{droughtData.precip3m} мм</div>
                  <div className="text-[12px] text-neutral-600">{tr("3-айлық жауын")} ({droughtData.period})</div>
                </div>
                <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                  {tr(droughtAdvice(droughtData.spi))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("McKee 1993 (WMO) · Open-Meteo ERA5 архиві,")}{" "}{droughtData.yearsOfRecord} {tr("жылдық климатология.")}{" "}</p>
              </>
            )}
            <LayerIndexNote layer="drought" />
          </div>
        )}

        {/* Жел бағыты панелі */}
        {activeLayer === "wind" && (
          <div className="w-full rounded-lg border border-sky-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <Wind className="h-3 w-3" /> {tr("Жел бағыты — тірі")}
            </div>
            {windError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !windData ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : windData.avgSpeed == null ? (
              // Бірде-бір жарамды жылдамдық жоқ — «0» көрсетпейміз (P1.10)
              <p className="text-[13px] text-neutral-600">
                <b className="text-neutral-800">{tr("Дерек жоқ")}</b> — {tr("желдің жылдамдығы келмеді, нөл деп есептелмейді.")}
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-sky-800">{windData.avgSpeed}</div>
                    <div className="text-[12px] text-neutral-600">{tr("км/сағ ·")}{" "}{tr("орташа")}</div>
                  </div>
                  <div className="flex flex-col items-center">
                    {windData.dominantDir != null ? (
                      <>
                        <svg width="34" height="34" viewBox="0 0 24 24" style={{ transform: `rotate(${windData.dominantDir + 180}deg)` }}>
                          <path d="M12 2 L18 20 L12 16 L6 20 Z" fill="#67e8f9" stroke="#0e7490" strokeWidth="1" />
                        </svg>
                        <div className="text-[12px] text-neutral-600">{tr(compassKz(windData.dominantDir))}</div>
                      </>
                    ) : (
                      <div className="text-[12px] text-neutral-600">{tr("Дерек жоқ")}</div>
                    )}
                  </div>
                </div>
                {windData.maxSpeed != null && (
                  <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                    {tr(windAdvice(windData.maxSpeed))}
                  </div>
                )}
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("Стрелка — желдің кететін бағыты. Дереккөз: Open-Meteo (ECMWF).")}
                </p>
              </>
            )}
            <LayerIndexNote layer="wind" />
          </div>
        )}

        {/* Ластану көзін анықтау панелі */}
        {sourceMode && (
          <div className="w-full rounded-lg border border-red-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-red-800">
              <Factory className="h-3 w-3" /> {tr("Ластану көзін анықтау — тірі")}
            </div>
            {sourceMissing ? (
              <ModuleMissing tone="light" module="pollutionSource" region={region} compact />
            ) : sourceError ? (
              <div className="space-y-1.5">
                <p className="text-[13px] text-amber-800">⚠ {tr(sourceError.error)}</p>
                {sourceError.detail && (
                  <p className="text-[12px] leading-relaxed text-neutral-600">{tr(sourceError.detail)}</p>
                )}
                {srcAt && (
                  <button
                    onClick={() => setSrcAt(null)}
                    className="rounded border border-neutral-300 bg-neutral-50 px-2 py-1 text-[12px] text-neutral-800 hover:bg-neutral-50"
                  >
                    {tr("Тірі режимге қайту")}
                  </button>
                )}
              </div>
            ) : !source ? (
              <p className="text-[13px] text-neutral-600">{tr("Талданып жатыр…")}</p>
            ) : (
              <>
                {!source.detected && (
                  <div className="mb-2 rounded-md bg-neutral-50 p-1.5 text-[12px] leading-snug text-neutral-800">
                    <span className="text-emerald-800">●</span>{" "}
                    {tr("Ластану төмен — төмендегісі ағымдағы жел бойынша ЫҚТИМАЛ таралу (белсенді оқиға емес). Картадағы конус СҰР үзік сызықпен салынған.")}{" "}
                    {tr("Сигнал нөл болғанда «ең ықтимал көз» тек кәсіпорын профилінен шығады — нақты дәлел емес.")}
                  </div>
                )}
                {source.top && (
                  <div className="mb-2 rounded-md bg-red-50 p-2">
                    <div className="text-[12px] uppercase tracking-wide text-neutral-600">
                      {source.detected ? tr("Ықтимал ластану көзі") : tr("Жел бойынша ықтимал бағыт")}
                    </div>
                    <div className="text-sm font-bold text-neutral-900">{source.top.name}</div>
                    {source.detected && (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-50">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${source.top.confidence}%` }} />
                        </div>
                        <span className="text-xs font-bold text-red-800">{source.top.confidence}%</span>
                      </div>
                    )}
                    <div className="mt-0.5 text-[12px] text-neutral-600">
                      {source.detected ? `${tr("сенімділік")} · ` : ""}{source.top.distanceKm} {tr("км қашықтықта")}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                  <div className="rounded bg-neutral-50 p-1.5">
                    <div className="flex items-center gap-1 text-neutral-600">
                      <Navigation className="h-2.5 w-2.5" /> {tr("Жел")}
                    </div>
                    <div className="font-semibold text-neutral-900">
                      {source.wind.fromLabel} · {source.wind.speed} {tr("км/сағ")}
                    </div>
                  </div>
                  <div className="rounded bg-neutral-50 p-1.5">
                    <div className="flex items-center gap-1 text-neutral-600">
                      <AlertTriangle className="h-2.5 w-2.5" /> {tr("Ластаушы")}
                    </div>
                    <div className="font-semibold text-neutral-900">{source.pollutantLabel}</div>
                  </div>
                </div>

                {source.plume.length > 0 && (
                  <div className="mt-1.5 rounded bg-red-50 p-1.5 text-[12px] text-red-800">
                    <div className="mb-0.5 text-[12px] text-neutral-600">{tr("Ластаушы бұлттың таралуы")}</div>
                    {source.plume.map((p) => p.name).join(" → ")}
                  </div>
                )}

                {sourceCorroboration > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded bg-amber-50 p-1.5 text-[12px] text-amber-800">
                    <Camera className="h-3 w-3 shrink-0" />
                    <span>
                      {sourceCorroboration} {tr("азаматтық хабарлама осы бұлт аймағында — дәлел күшейеді")}
                    </span>
                  </div>
                )}

                {/* Екі уақыт-анимация: өткен 24сағ (нақты жел) + алдағы 24сағ (болжам жел) */}
                {((source.frames?.length ?? 0) > 1 || (source.forecastFrames?.length ?? 0) > 1) && (
                  <div className="mt-1.5 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[12px] text-neutral-600">
                        {selectedFacs.length
                          ? <><Factory className="mb-0.5 inline h-2.5 w-2.5 text-amber-800" /> {selectedFacs.length} {tr("зауыт таңдалды")}</>
                          : tr("Зауыт(тар)ды басып таңдаңыз")}
                      </span>
                      <span className="flex gap-1">
                        <button
                          onClick={() => setSelectedFacs(source.candidates)}
                          className="rounded border border-amber-500/40 bg-amber-50 px-1.5 py-px text-[12px] text-amber-800 hover:bg-amber-50"
                        >{tr("Барлығы")}</button>
                        {selectedFacs.length > 0 && (
                          <button
                            onClick={() => setSelectedFacs([])}
                            className="rounded border border-neutral-300 px-1.5 py-px text-[12px] text-neutral-800 hover:bg-neutral-50"
                          >{tr("Тазалау")}</button>
                        )}
                      </span>
                    </div>
                    {/* Анимация — траектория ЕМЕС. Әр кадр сол сағаттағы
                        желмен есептелген тұрақты күй конусы. */}
                    <p className="text-[12px] leading-snug text-neutral-600">
                      ⚠ {tr("Әр кадр — сол сағаттағы желмен есептелген конус, бұлттың жүрген жолы ЕМЕС.")}
                    </p>
                  </div>
                )}

                {/* УАҚЫТ БАСҚАРУЫ · ХРОНОЛОГИЯ · ҚҰЖАТ */}
                {/* P2.4: таралу слайдері — МОДЕЛЬ нәтижесі. Жел деректері жоқ болса сұрланады */}
                {(() => {
                  const windMissing = isDispersionWindMissing({
                    sourceSpeed: source.wind?.speed,
                    windState: windError ? "error" : windData ? "ok" : "loading",
                    hourly: windData?.hourly,
                  });
                  return (
                    <DispersionFrame windMissing={windMissing}>
                      <PollutionTimeline
                    source={source}
                    frameIdx={tlIdx}
                    onFrame={(i) => { setTlTime(timeline[i]?.time ?? null); setTlPlaying(false); }}
                    playing={tlPlaying}
                    onPlayToggle={() => setTlPlaying((p) => !p)}
                    at={srcAt}
                    onAt={(v) => { setSrcAt(v); setTlTime(null); setTlPlaying(false); }}
                    loading={sourceLoading}
                    regionId={region.id}
                      />
                    </DispersionFrame>
                  );
                })()}

                {/* АТМОСФЕРАЛЫҚ ОРНЫҚТЫЛЫҚ — конустың пішінін БЕЛГІЛЕЙТІН фактор.
                    Бұрын мүлдем ескерілмейтін: конус ені тек жел жылдамдығынан
                    шығатын, сондықтан физикалық шлейфтен 3–5 есе кең болатын. */}
                {source.stability && (
                  <div className="mt-1.5 rounded bg-neutral-50 p-1.5">
                    <div className="mb-0.5 flex items-center gap-1">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-neutral-600">
                        {tr("Атмосфера орнықтылығы")}
                      </span>
                      <span className="ml-auto rounded bg-sky-50 px-1 py-px font-mono text-[12px] font-bold text-sky-800">
                        {source.stability.cls}
                      </span>
                    </div>
                    <div className="text-[12px] text-neutral-800">{tr(source.stability.label)}</div>
                    <p className="mt-0.5 text-[12px] leading-snug text-neutral-600">
                      {tr(source.stability.note)}
                    </p>
                    <div className="mt-1 border-t border-neutral-300 pt-1 text-[12px] leading-snug text-neutral-600">
                      {tr("Конустың жарты бұрышы")}:{" "}
                      <span className="text-neutral-800">{source.stability.coneAngle.total.toFixed(1)}°</span>{" "}
                      = {source.stability.coneAngle.physical}° {tr("физикалық жайылу")} +{" "}
                      {source.stability.coneAngle.wind}° {tr("жел бағытының ауытқуы")}
                      <br />
                      {tr("Ұзындығы")}: {source.stability.plumeLengthKm} {tr("км")}
                      {source.stability.coneAngle.total < 3 && (
                        <>
                          <br />
                          <span className="text-amber-800">
                            ⚠ {tr("Сызбада көрнекілік үшін 3° етіп салынған — нақты бұрыш жоғарыда.")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ЖЕЛ ӨРІСІ — тор бойынша бір нүктелік пе, әлде жергілікті ме */}
                {source.windField && (
                  <p className="mt-1 rounded bg-neutral-50 p-1.5 text-[12px] leading-snug text-neutral-600">
                    🌬 {tr(source.windField.note)}
                  </p>
                )}

                {/* Дисперсия БОЛЖАМЫ — бұлт қайда жетеді (болжам желі) */}
                {(source.forecast?.length ?? 0) > 0 && (
                  <div className="mt-1.5 rounded bg-orange-50 p-1.5">
                    <div className="mb-1 flex items-center gap-1 text-[12px] font-semibold text-orange-800">
                      <Navigation className="h-2.5 w-2.5" /> {tr("Болжам: бұлт қайда жетеді")}
                    </div>
                    <div className="flex gap-1">
                      {(source.forecast ?? []).map((f, i) => (
                        <button
                          key={f.label}
                          onClick={() => setFcStep((cur) => (cur === i ? null : i))}
                          className={`flex-1 rounded border px-1 py-1 text-[12px] transition-colors ${
                            fcStep === i
                              ? "border-orange-400 bg-orange-50 text-orange-800"
                              : "border-neutral-300 text-neutral-800 hover:bg-neutral-50"
                          }`}
                        >
                          +{f.label}
                        </button>
                      ))}
                    </div>
                    {fcStep != null && source.forecast[fcStep] && (
                      <div className="mt-1 text-[12px] text-orange-800">
                        {source.forecast[fcStep].reached.length > 0
                          ? `${tr("Жетеді")}: ${source.forecast[fcStep].reached.join(", ")}`
                          : tr("Қала сыртына шығады — елді мекен ілінбейді")}
                      </div>
                    )}
                    {/* ЕКІ МОДЕЛЬДІҢ АЙЫРМАСЫ — бұрын түсіндірілмейтін,
                        сондықтан конус пен шеңбер әртүрлі бағыт көрсеткенде
                        қайсысы дұрыс екені белгісіз болатын */}
                    <p className="mt-1 border-t border-neutral-300 pt-1 text-[12px] leading-snug text-neutral-600">
                      {tr("Конус пен шеңбер — ЕКІ ТҮРЛІ модель.")}{" "}
                      <span className="text-neutral-600">{tr("Конус")}</span>:{" "}
                      {tr("«жел осылай тұрса, бұлт мына секторға кетеді» (тұрақты күй).")}{" "}
                      <span className="text-neutral-600">{tr("Шеңбер")}</span>:{" "}
                      {tr("«дәл қазір шыққан ауа N сағаттан кейін мына жерде» (сағаттық болжам желімен жылжытылған).")}{" "}
                      {tr("Жел бұрылса екеуі әртүрлі бағыт көрсетеді — бұл қате емес.")}
                    </p>
                  </div>
                )}

                {/* Әрекет батырмалары: метан қабаты + ескерту */}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {topEmitsMethane && (
                    <button
                      onClick={() => { setGibsKey("ch4"); toast.info(tr("Sentinel-5P метан (CH₄) қабаты қосылды")); }}
                      className="flex items-center gap-1 rounded border border-sky-500/40 bg-sky-50 px-2 py-1 text-[12px] text-sky-800 hover:bg-sky-50"
                    >
                      <Satellite className="h-3 w-3" /> {tr("Метан қабаты (CH₄)")}
                    </button>
                  )}
                  <button
                    onClick={sendSourceAlert}
                    className="flex items-center gap-1 rounded border border-orange-500/40 bg-orange-50 px-2 py-1 text-[12px] text-orange-800 hover:bg-orange-50"
                  >
                    <AlertTriangle className="h-3 w-3" /> {tr("Жауапты органға жіберу")}
                  </button>
                </div>

                {source.candidates.length > 1 && (
                  <div className="mt-1.5 space-y-0.5">
                    <div className="text-[12px] text-neutral-600">{tr("Басқа кандидаттар")}</div>
                    {source.candidates.slice(1, 4).map((c) => (
                      <div key={c.id} className="flex items-center gap-1.5 text-[12px]">
                        <span className="text-neutral-600">{c.short}</span>
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-50">
                          <div className="h-full rounded-full bg-neutral-500" style={{ width: `${c.confidence}%` }} />
                        </div>
                        <span className="w-7 text-right text-neutral-600">{c.confidence}%</span>
                      </div>
                    ))}
                  </div>
                )}

                {source.groundStations > 0 && (
                  <div className="mt-1.5 flex items-center gap-1.5 rounded bg-emerald-50 p-1.5 text-[12px] text-emerald-800">
                    <Radio className="h-3 w-3 shrink-0" />
                    <span>
                      {source.groundStations} {tr("нақты жердегі датчик ескерілді — дәлдік модельден жоғары")}
                    </span>
                  </div>
                )}

                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr(source.note)} {tr("Әдіс: жеңілдетілген CWT + көп-қабылдағыш триангуляция. Дереккөз: CAMS + Open-Meteo.")}
                </p>
              </>
            )}
          </div>
        )}

        {/* Live mosquito-suitability panel */}
        {activeLayer === "mosquito" && (
          <div className="w-full rounded-lg border border-violet-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-violet-800">
              {!mosMissing && <Radio className="h-3 w-3 " />}
              {tr("Маса қолайлылығы")} {!mosMissing && `— ${tr("тірі")}`}
            </div>
            {mosMissing ? (
              <ModuleMissing tone="light" module="mosquito" region={region} compact />
            ) : mosError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !mosGrid ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                {mosStats && (
                  <>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-neutral-50 p-1.5">
                        <div className="text-sm font-bold text-emerald-800">{mosStats.min}</div>
                        <div className="text-[12px] text-neutral-600">{tr("мин")}</div>
                      </div>
                      <div className="rounded bg-neutral-50 p-1.5">
                        <div className="text-sm font-bold text-neutral-900">{mosStats.avg}</div>
                        <div className="text-[12px] text-neutral-600">{tr("орташа")}</div>
                      </div>
                      <div className="rounded bg-neutral-50 p-1.5">
                        <div className={`text-sm font-bold ${mosStats.max > 60 ? "text-red-800" : "text-amber-800"}`}>
                          {mosStats.max}
                        </div>
                        <div className="text-[12px] text-neutral-600">{tr("макс")}</div>
                      </div>
                    </div>
                    <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                      {tr(mosquitoAdvice(mosStats.avg))}
                    </div>

                    {/* L2 — МАССАЛЫҚ ШЫҒУ БОЛЖАМЫ.
                        Модельдің ең пайдалы шығысы: дезинсекция мен
                        халыққа ескерту осы күнге жоспарланады */}
                    {mosDyn?.emergencePeak && (
                      <div className="mt-2 rounded-md border border-violet-400/30 bg-neutral-50 p-2">
                        <div className="flex items-center gap-1.5">
                          <Bug className="h-3 w-3 text-violet-800" />
                          <span className="text-[12px] font-semibold text-neutral-800">
                            {tr("Күтілетін шығу шыңы")}
                          </span>
                          <span className="ml-auto text-[13px] font-bold text-violet-800">
                            {mosDyn.emergencePeak.date.slice(5).replace("-", ".")}
                          </span>
                        </div>
                        <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                          {tr("Су басудан кейінгі кідіріс есептелген: жұмыртқа жарылады → дернәсіл дамиды → ересек шығады.")}
                        </p>
                      </div>
                    )}

                    {/* L1 — ТАСҚЫН ИМПУЛЬСІ: модельдің ажыратқышы.
                        Су басу оқиғасы өлшенді ме, әлде тек география ма —
                        пайдаланушы соны бірден көруі керек */}
                    {mosFlood && (
                      <div
                        className={`mt-2 rounded-md border p-2 ${
                          mosFlood.available
                            ? "border-sky-400/25 bg-neutral-50"
                            : "border-amber-400/25 bg-neutral-50"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Waves className={`h-3 w-3 ${mosFlood.available ? "text-sky-800" : "text-amber-800"}`} />
                          <span className="text-[12px] font-semibold text-neutral-800">
                            {tr("Тасқын импульсі")}
                          </span>
                          {mosFlood.available && mosFlood.value != null && (
                            <span className="ml-auto text-[13px] font-bold text-sky-800">
                              {Math.round(mosFlood.value * 100)}%
                            </span>
                          )}
                        </div>
                        {mosFlood.available && mosFlood.value != null && (
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-50">
                            <div
                              className="h-full rounded-full bg-sky-400"
                              style={{ width: `${Math.round(mosFlood.value * 100)}%` }}
                            />
                          </div>
                        )}
                        {mosFlood.hydroperiodDaysMax != null && (
                          <div className="mt-1.5 flex items-center gap-1.5 rounded bg-neutral-50 px-1.5 py-1">
                            <span className="text-[12px] text-neutral-600">
                              {tr("Гидропериод")}:
                            </span>
                            <span className="text-[12px] font-semibold text-sky-800">
                              ≥ {mosFlood.hydroperiodDaysMax} {tr("күн")}
                            </span>
                            <span className="ml-auto text-[12px] text-neutral-600">
                              {tr("дернәсіл ~7–14 күн керек")}
                            </span>
                          </div>
                        )}
                        {mosFlood.reedMax != null && (
                          <div className="mt-1 flex items-center gap-1.5 rounded bg-neutral-50 px-1.5 py-1">
                            <span className="text-[12px] text-neutral-600">{tr("Қамыс мекені")}:</span>
                            <span className="text-[12px] font-semibold text-emerald-800">
                              {Math.round(mosFlood.reedMax * 100)}%
                            </span>
                            <span className="ml-auto text-[12px] text-neutral-600">
                              Culex · S2 NDVI
                            </span>
                          </div>
                        )}
                        <p className="mt-1 text-[12px] leading-snug text-neutral-600">{trFloodNote(mosFlood.note, tr)}</p>
                      </div>
                    )}

                    {/* Түстердің мағынасы — картадағы иконка түсімен БІР
                        тізілімнен оқылады (MOS_LEVELS), сондықтан алшақтамайды */}
                    <div className="mt-2 rounded-md bg-neutral-50 p-2">
                      <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-neutral-600">
                        {tr("Иконка түсі нені білдіреді")}
                      </div>
                      <div className="space-y-0.5">
                        {MOS_LEVELS.map((l, i) => (
                          <div key={l.label} className="flex items-center gap-1.5 text-[12px]">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: l.color }}
                            />
                            <span className="text-neutral-800">{tr(l.label)}</span>
                            <span className="ml-auto text-neutral-600">
                              {i === 0 ? 0 : MOS_LEVELS[i - 1].max}–{Math.min(100, l.max)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-1 border-t border-neutral-300 pt-1 text-[12px] leading-snug text-neutral-600">
                        {tr("Картадағы әр маса — бір есептелген координата")} ({mosquitoSwarm.length}).{" "}
                        {tr("Индекс — климаттық ҚОЛАЙЛЫЛЫҚ, маса САНЫ емес.")}
                      </p>
                    </div>
                  </>
                )}

                {/* Қала аудандары бойынша рейтинг — осы сағаттағы FPEB индексі */}
                {mosDistricts.length > 0 && (
                  <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-violet-800">
                        {tr("Аудандар бойынша")} · {(mosHours?.[mosIdx]?.time ?? "").slice(11, 16) || "—"}
                      </span>
                      <span className="text-[12px] text-neutral-600">{mosDistricts.length} {tr("аудан")}</span>
                    </div>
                    <div className="max-h-40 space-y-0.5 overflow-y-auto pr-0.5">
                      {mosDistricts.slice(0, 12).map((d, i) => {
                        const c = mosLevel(d.index).color;
                        return (
                          <div key={d.name} className="flex items-center gap-1.5 text-[12px]">
                            <span className="w-3 text-right text-neutral-600">{i + 1}</span>
                            <span className="flex-1 truncate text-neutral-800">{d.name}</span>
                            <div className="h-1 w-10 overflow-hidden rounded-full bg-neutral-50">
                              <div className="h-full rounded-full" style={{ width: `${d.index}%`, background: c }} />
                            </div>
                            <span className="w-5 text-right font-mono font-bold" style={{ color: "var(--color-brand)" }}>{d.index}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Сағаттық анимация — иконкалар сағат сайын қайта шоғырланады */}
                {mosHours && mosHours.length > 1 && (
                  <div className="mt-2 rounded-lg bg-violet-50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-violet-800">
                        {(() => {
                          const h = mosHours[mosIdx];
                          if (!h?.time) return "—";
                          const [dt, tm] = h.time.split("T");
                          const hhmm = (tm ?? "").slice(0, 5);
                          return mosIdx === mosNowIdx
                            ? `${hhmm} (${tr("қазір")})`
                            : `${dt.slice(5).replace("-", ".")} ${hhmm}`;
                        })()}
                      </span>
                      <button
                        onClick={() => setMosPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-violet-50 px-1.5 py-0.5 text-[12px] text-violet-800 hover:bg-violet-50"
                      >
                        {mosPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {mosPlaying ? tr("Тоқтату") : tr("48 сағат")}
                      </button>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={Math.max(0, mosHours.length - 1)}
                      step={1}
                      value={mosIdx}
                      onChange={(e) => {
                        setMosPlaying(false);
                        setMosHour(Number(e.target.value));
                      }}
                      className="w-full accent-violet-400"
                    />
                    <div className="mt-0.5 flex justify-between text-[12px] text-neutral-600">
                      <span>−24{tr("сағ")}</span>
                      <span className="text-violet-800">{tr("қазір")}</span>
                      <span>+24{tr("сағ")}</span>
                    </div>
                    <p className="mt-1 text-[12px] leading-snug text-neutral-600">
                      {mosHours[mosIdx]?.temp}°C ·{" "}
                      <span className={mosHours[mosIdx]?.past ? "text-neutral-800" : "text-sky-800"}>
                        {mosHours[mosIdx]?.past ? tr("өткен") : tr("болжам")}
                      </span>{" "}
                      — {tr("иконкалар осы сағаттың нақты жағдайымен шоғырланады (Open-Meteo)")}
                    </p>
                  </div>
                )}

                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("🦟 иконкалар индекс бойынша шоғырланады. Слайдермен 7 күндік болжамды көріңіз. Басты фактор —")}{" "}
                  <b className="text-violet-800">{tr("Жайық жайылмасы мен атырауы")}</b>{" "}
                  {tr("(қамыс, тұрған су) + температура + жаңбыр + қала. Әдістеме: Mordecai 2017 (WHO/ECDC) + гидрология. Дереккөз: Open-Meteo.")}
                </p>
              </>
            )}
          </div>
        )}

        {/* FIRMS архиві — жылу аномалиялары (расталған өрт емес) */}
        {activeLayer === "oil" && (
          <div className="w-full rounded-lg border border-neutral-300 bg-white p-4 ">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold text-neutral-900">{tr("Жылу аномалиялары — архив")}</span>
              <TierBadge tone="light" tier="measurement" />
            </div>
            <div className="mb-2 rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-[12px] leading-snug">
              <div className="font-semibold text-neutral-900">{tr("Жылу аномалиясы расталған өрт емес")}</div>
            </div>

            {fireArchiveError ? (
              <div className="rounded-md border border-red-500/40 bg-red-50 p-2 text-[12px] leading-snug text-red-800">
                <div>{tr("FIRMS архиві қолжетімсіз")}: {tr(fireArchiveError.error)}</div>
                {fireArchiveError.reason && <div className="mt-1 text-red-800">{tr("Себебі")}: {tr(fireArchiveError.reason)}</div>}
                <div className="mt-1 text-neutral-600">{tr("Жалған дерек көрсетілмейді.")}</div>
              </div>
            ) : !fireArchive ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                {!fireArchive.complete && (
                  <div className="mb-2 rounded-md border border-amber-500/40 bg-amber-50 p-2 text-[12px] leading-snug text-amber-800">
                    ⚠️ {tr("Архив толық емес")}: {fireArchive.failedWindows.length} {tr("терезе сәтсіз аяқталды — кейбір күндер көрсетілмеген.")}
                  </div>
                )}

                <div role="group" aria-label={tr("Уақыт аралығы")} className="mb-2 grid grid-cols-4 gap-1">
                  {FIRE_PRESETS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={firePreset === d}
                      onClick={() => setFirePreset(d)}
                      className={`rounded-md border px-1 py-1 text-[12px] font-medium transition ${
                        firePreset === d
                          ? "border-brand bg-brand text-white"
                          : "border-neutral-300 bg-white text-neutral-800 hover:bg-white"
                      }`}
                    >
                      {d} {tr("күн")}
                    </button>
                  ))}
                </div>

                <div className="mb-2 grid grid-cols-2 gap-1.5 text-center">
                  <div className="rounded-md border border-neutral-300 bg-white p-1.5">
                    <div className="text-xl font-bold text-red-800">{fireCounts.industrial_flare}</div>
                    <div className="text-[11px] text-neutral-600">{tr("өндірістік алау (контур ішінде)")}</div>
                  </div>
                  <div className="rounded-md border border-neutral-300 bg-white p-1.5">
                    <div className="text-xl font-bold text-yellow-800">{fireCounts.unconfirmed_anomaly}</div>
                    <div className="text-[11px] text-neutral-600">{tr("жылу аномалиясы (расталмаған)")}</div>
                  </div>
                </div>

                {fireAnomalies.length === 0 && (
                  <p className="mb-2 text-[12px] text-neutral-600">{tr("Таңдалған кезеңде жылу аномалиясы табылмады.")}</p>
                )}

                <div className="space-y-1 text-[12px] text-neutral-800" aria-label={tr("Легенда")}>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border border-neutral-900" style={{ background: FIRE_CATEGORY_COLOR.industrial_flare }} />
                    {tr("өндірістік алау (контур ішінде)")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border border-neutral-900" style={{ background: FIRE_CATEGORY_COLOR.unconfirmed_anomaly }} />
                    {tr("жылу аномалиясы (расталмаған)")}
                  </div>
                  <p className="pt-1 text-[11px] leading-snug text-neutral-600">
                    {tr("Шеңбер өлшемі — жылу қуатына (FRP) сай. Дереккөз: NASA FIRMS (VIIRS 375м), архив.")}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Live gas-flare panel — oil layer */}
        {activeLayer === "oil" && (
          <div className="w-full rounded-lg border border-orange-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <Flame className="h-3 w-3" /> {tr("Жылу аномалиялары — тірі")}
            </div>
            {flaresError ? (
              <p className="text-[13px] text-neutral-600">
                {flaresError === "FIRMS кілті бапталмаған"
                  ? tr("NASA FIRMS кілті қажет (тегін). Қосылғанша жылу аномалиялары көрсетілмейді.")
                  : `${tr("Тірі деректер қолжетімсіз")}: ${flaresError}. ${tr("Жалған дерек көрсетілмейді.")}`}
              </p>
            ) : !flares ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : flares.length === 0 ? (
              <p className="text-[13px] text-neutral-600">{tr("Соңғы 2 күнде жылу аномалиясы анықталмады.")}</p>
            ) : (
              <>
                <div className="rounded-lg bg-orange-50 p-2 text-center">
                  <div className="text-2xl font-bold text-orange-800">{flares.length}</div>
                  <div className="text-[12px] text-neutral-600">{tr("жылу аномалиясы (2 күн, расталмаған)")}</div>
                </div>
                <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                  {tr(flaresAdvice(flares.length))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("🔥 иконка өлшемі — жылу қуатына (FRP) сай. Жылу аномалиясы — спутниктің жылу сигналы, расталған өрт емес: өндірістік факел, далалық өрт немесе жалын болуы мүмкін. Дереккөз: NASA FIRMS (VIIRS 375м).")}
                </p>
              </>
            )}
            <div className="my-1.5 h-px bg-neutral-50" />
            <button
              onClick={scanOil}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-amber-500/40 bg-amber-50 px-2 py-1.5 text-[13px] font-semibold text-amber-800 hover:bg-amber-50"
              title={tr("Картаның ортасындағы аймақты Sentinel-1 радарымен мұнай дағына тексеру")}
            >
              {oilScan?.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fuel className="h-3.5 w-3.5" />}
              {tr("Мұнай дағын сканерлеу (AI)")}
            </button>
            <LayerIndexNote layer="oil" />
          </div>
        )}

        {/* Waste panel — crowdsourced (AI + citizen reports) */}
        {activeLayer === "waste" && (
          <div className="w-full rounded-lg border border-orange-600/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-orange-800">
              <Trash2 className="h-3 w-3" /> {tr("Қоқыс нүктелері")}
            </div>
            {(() => {
              const confirmed = wasteSites.filter(
                (s) => s.analysis.verificationStatus === "confirmed"
              ).length;
              const fromCitizens = wasteSites.filter((s) => s.photoThumb).length;
              return wasteSites.length === 0 ? (
                <p className="text-[13px] text-neutral-600">
                  {tr("Әзірге қоқыс нүктесі жоқ. Картаны басып AI талдаңыз немесе фото-хабарлама жіберіңіз.")}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div className="rounded bg-neutral-50 p-1.5">
                      <div className="text-sm font-bold text-neutral-900">{wasteSites.length}</div>
                      <div className="text-[12px] text-neutral-600">{tr("барлығы")}</div>
                    </div>
                    <div className="rounded bg-neutral-50 p-1.5">
                      <div className="text-sm font-bold text-emerald-800">{confirmed}</div>
                      <div className="text-[12px] text-neutral-600">{tr("расталған")}</div>
                    </div>
                    <div className="rounded bg-neutral-50 p-1.5">
                      <div className="text-sm font-bold text-rose-800">{fromCitizens}</div>
                      <div className="text-[12px] text-neutral-600">{tr("азаматтан")}</div>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                    {tr("Қоқыс — жергілікті мәселе, спутник API-ы жоқ. Сондықтан ол AI спутник талдауы мен азаматтық фото-хабарламалардан жинақталады (краудсорсинг).")}
                  </p>
                </>
              );
            })()}
            <a
              href="/report"
              className="mt-2 flex items-center justify-center gap-1 rounded-md bg-brand py-1.5 text-[13px] font-medium text-white hover:bg-brand/90"
            >
              <Camera className="h-3.5 w-3.5" /> {tr("Қоқыс туралы хабарлау")}
            </a>
          </div>
        )}

        {/* Live soil panel — soil layer */}
        {activeLayer === "soil" && (
          <div className="w-full rounded-lg border border-amber-600/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-amber-800">
              <Radio className="h-3 w-3 " /> {tr("Топырақ жағдайы — тірі")}
            </div>
            {soilError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !soilGrid || !soilMeta ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="rounded-lg bg-neutral-50 p-2 text-center">
                    <div className="text-lg font-bold text-sky-800">{soilMeta.avgMoisture}</div>
                    <div className="text-[12px] text-neutral-600">{tr("орташа ылғал м³/м³")}</div>
                  </div>
                  <div className="rounded-lg bg-neutral-50 p-2 text-center">
                    <div
                      className={`text-lg font-bold ${soilMeta.avgStress > 60 ? "text-red-800" : soilMeta.avgStress > 40 ? "text-orange-800" : "text-emerald-800"}`}
                    >
                      {soilMeta.avgStress}
                    </div>
                    <div className="text-[12px] text-neutral-600">{tr("деградация стрессі")}</div>
                  </div>
                </div>
                <div className="mt-2 rounded-md bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                  {tr(soilAdvice(soilMeta.avgStress))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("Сары/қызыл аймақ — құрғақ топырақ, жоғары деградация/тұздану стрессі. Көк — ылғалды, сау. Есеп: түбір қабатының ылғалы + температура + 30 күндік жаңбыр. Дереккөз: Open-Meteo (ECMWF).")}
                </p>
              </>
            )}
            <LayerIndexNote layer="soil" />
          </div>
        )}

        {/* Live water/flood panel — water layer */}
        {activeLayer === "water" && (
          <div className="w-full rounded-lg border border-emerald-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-800">
              {!floodMissing && <Radio className="h-3 w-3 " />}
              {river ? `${tr(river)} — ${tr("тірі ағын")}` : tr("Өзен ағыны")}
            </div>
            {floodMissing ? (
              <ModuleMissing tone="light" module="riverFlow" region={region} compact />
            ) : floodError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !flood ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : flood.length === 0 ? (
              <p className="text-[13px] text-neutral-600">{tr("Өзен деректері қолжетімсіз.")}</p>
            ) : (
              <>
                {(() => {
                  // Қала тұсындағы нүкте — тізілімде қала атымен белгіленген
                  const aty = flood.find((p) => p.name.includes(region.name)) ?? flood[0];
                  return (
                    <div
                      className="rounded-lg p-2 text-center"
                      style={{ backgroundColor: `${aty.color}22`, border: `1px solid ${aty.color}55` }}
                    >
                      <div className="text-xl font-bold" style={{ color: "var(--color-brand)" }}>
                        {aty.discharge} <span className="text-xs font-normal">м³/с</span>
                      </div>
                      <div className="text-[13px] font-semibold" style={{ color: "var(--color-brand)" }}>
                        {tr(aty.level)}
                      </div>
                      <div className="text-[12px] text-neutral-600">
                        {aty.name} · {tr("тренд")}: {tr(aty.trend)}
                      </div>
                      <div className="mt-1.5 rounded-md bg-neutral-50 p-1.5 text-[12px] leading-snug text-neutral-900">
                        {tr(waterAdvice(aty.level))}
                      </div>
                    </div>
                  );
                })()}
                <div className="mt-1.5 space-y-0.5">
                  {flood.map((p) => (
                    <div key={p.name} className="flex items-center justify-between text-[12px]">
                      <span className="text-neutral-800">{p.name}</span>
                      <span className="font-semibold" style={{ color: "var(--color-brand)" }}>
                        {p.discharge} м³/с
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("Нақты өзен ағыны мен тасқын қаупі. Жоғары ағын → жайылма су басу → маса ошақтары. Дереккөз: Copernicus GloFAS (Open-Meteo).")}
                </p>
              </>
            )}
            <LayerIndexNote layer="water" />
          </div>
        )}

        {/* Live air quality panel — shown while the air layer is active */}
        {activeLayer === "air" && (
          <div className="w-full rounded-lg border border-sky-500/30 bg-white p-4 ">
            <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-sky-800">
              <Radio className="h-3 w-3 " /> {tr("Ауа сапасы · дерек түрлері бөлек")}
            </div>
            {airError ? (
              <p className="text-[13px] text-neutral-600">{tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
            ) : !airGrid ? (
              <p className="text-[13px] text-neutral-600">{tr("Жүктелуде…")}</p>
            ) : (
              <>
                {/* Атмосфера элементі таңдағышы — айналдырылатын, категорияға бөлінген */}
                <div className="mb-2 max-h-28 space-y-1 overflow-y-auto rounded-md bg-neutral-50 p-1.5">
                  {ATMOS_CATEGORIES.map((cat) => (
                    <div key={cat}>
                      <div className="mb-0.5 text-[12px] uppercase tracking-wide text-neutral-600">{tr(cat)}</div>
                      <div className="flex flex-wrap gap-1">
                        {ATMOS_ELEMENTS.filter((e) => e.category === cat).map((e) => (
                          <button
                            key={e.key}
                            onClick={() => setAirElem(e)}
                            title={tr(e.label)}
                            className={`rounded px-1.5 py-0.5 text-[12px] font-semibold transition-colors ${
                              airElem.key === e.key
                                ? "border border-sky-400 bg-sky-50 text-sky-800"
                                : "border border-transparent bg-neutral-50 text-neutral-800 hover:bg-neutral-50"
                            }`}
                          >
                            {e.short}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mb-1.5 text-[12px] font-medium text-neutral-800">{tr(airElem.label)}</div>
                {/* МОДЕЛЬ тобы: Copernicus CAMS — өлшем емес */}
                <div className="mb-1 flex items-center gap-1.5">
                  <Badge kind="model">{t("air.type.model")}</Badge>
                </div>
                {airStats && airElem.key !== "aqi" && (
                  <>
                    <div className="mb-2 rounded-lg bg-neutral-50 p-2 text-center">
                      <div className="text-2xl font-bold text-sky-800">{airStats.avg}</div>
                      <div className="text-[12px] text-neutral-600">
                        {tr("облыс бойынша орташа")} {airElem.unit}
                      </div>
                    </div>
                    <div className="flex justify-between text-[12px] text-neutral-600">
                      <span>{tr("мин")} {airStats.min}</span>
                      <span>{tr("макс")} {airStats.max}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                      {tr("Дерек: Copernicus CAMS · Open-Meteo · тор бойынша (модель, өлшем емес)")}
                    </p>
                  </>
                )}

                {airStats && airElem.key === "aqi" && (() => {
                  const cat = aqiCategory(airStats.avg);
                  return (
                    <>
                      {/* Category badge (IQAir-style) */}
                      <div
                        className="mb-2 rounded-lg p-2 text-center"
                        style={{ backgroundColor: `${cat.color}22`, border: `1px solid ${cat.color}55` }}
                      >
                        <div className="text-2xl font-bold" style={{ color: "var(--color-brand)" }}>
                          {airStats.avg}
                        </div>
                        <div className="text-[13px] font-semibold" style={{ color: "var(--color-brand)" }}>
                          {cat.name}
                        </div>
                        <div className="text-[12px] text-neutral-600">{tr("облыс бойынша орташа EU AQI")}</div>
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
                      <div className="rounded-lg bg-neutral-50 p-2 text-[12px] leading-snug text-neutral-800">
                        <div className="mb-1 font-semibold" style={{ color: "var(--color-brand)" }}>
                          {tr("🩺 Денсаулық кеңесі")}
                        </div>
                        <p>{cat.advice}</p>
                        <p className="mt-1 text-neutral-600">
                          <b>{tr("Сезімтал топтар:")}</b> {cat.sensitiveAdvice}
                        </p>
                      </div>

                      <div className="mt-1.5 flex justify-between text-[12px] text-neutral-600">
                        <span>{tr("мин")} {airStats.min}</span>
                        <span>{tr("макс")} {airStats.max}</span>
                      </div>
                    </>
                  );
                })()}

                {/* Dominant pollutant + source */}
                {airDominant && (
                  <div className="mt-2 rounded-lg bg-neutral-50 p-2 text-[12px]">
                    <div className="font-semibold text-sky-800">{tr("Басты ластаушы")}</div>
                    <div className="text-neutral-900">
                      {tr(airDominant.label)} · {airDominant.value.toFixed(1)} µg/m³
                    </div>
                    <div className="text-neutral-600">{tr("Дереккөз")}: {airDominant.source}</div>
                  </div>
                )}

                {/* 24 сағаттық анимация — тек AQI-де (сағаттық дерек сол үшін) */}
                {airElem.key === "aqi" && airHours && airHours.length > 1 && (
                  <div className="mt-2 rounded-lg bg-sky-50 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[12px] font-semibold text-sky-800">
                        {airHour === 0 ? tr("Қазір") : `+${airHour} ${tr("сағ")}`} ·{" "}
                        {airHours[airHour]?.time?.slice(11, 16) ?? ""}
                      </span>
                      <button
                        onClick={() => setAirPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-sky-50 px-1.5 py-0.5 text-[12px] text-sky-800 hover:bg-sky-50"
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
                    <p className="mt-0.5 text-[12px] text-neutral-600">{tr("Алдағы 24 сағат — CAMS модельдік болжамы")}</p>
                  </div>
                )}

                {/* City districts ranking */}
                {airStats?.districts && airStats.districts.length > 0 && (
                  <div className="mt-2 rounded-lg bg-neutral-50 p-2">
                    <div className="mb-1 text-[12px] font-semibold text-sky-800">{tr("Қала аудандары")}</div>
                    <div className="space-y-0.5">
                      {airStats.districts.map((dd) => {
                        const c = aqiCategory(dd.aqi);
                        return (
                          <div key={dd.name} className="flex items-center justify-between text-[12px]">
                            <span className="text-neutral-800">{dd.name}</span>
                            <span className="font-semibold" style={{ color: "var(--color-brand)" }}>
                              {dd.aqi} · {c.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <p className="mt-1.5 text-[12px] leading-snug text-neutral-600">
                  {tr("EU AQI (EAQI), Copernicus CAMS — сағат сайын. Аудандар CAMS ажыратымдылығымен (~10км) бағаланады.")}
                </p>
                <div className="mt-2 rounded-lg bg-sky-50 p-2">
                  <ModelCaption fetchedAt={airFetchedAt} unit={airElem.unit || null} tone="light" />
                </div>

                {/* ЖЕРҮСТІ СТАНСА тобы: Қазгидромет (тірі емес) */}
                <div className="mt-3 mb-1 flex items-center gap-1.5">
                  <Badge kind="ground">{t("air.type.ground")}</Badge>
                  <span className="text-[12px] font-semibold text-emerald-800">{t("air.group.ground")}</span>
                </div>
                {airElem.kzh || airElem.noModel ? (
                  <KzhPanel elem={airElem} regionId={region.id} />
                ) : (
                  <p className="text-[12px] text-neutral-600">{t("air.ground.noLink")}</p>
                )}

                {/* СПУТНИК БАҒАН тобы: Sentinel-5P (тек спутниктік қабаты бар газ үшін) */}
                {airElem.s5p && (
                  <div className="mt-3 rounded-lg border border-violet-500/30 bg-violet-50 p-2">
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <Badge kind="satellite">{t("air.type.satellite")}</Badge>
                        <span className="text-[12px] font-semibold text-violet-800">{t("air.group.sat")}</span>
                      </div>
                      <button
                        onClick={() => setGibsKey((k) => (k === airElem.s5p ? null : airElem.s5p!))}
                        title={tr("Sentinel-5P спутник растрын қосу/өшіру")}
                        className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-[12px] font-semibold transition-colors ${
                          gibsKey === airElem.s5p
                            ? "border-sky-400 bg-sky-50 text-sky-800"
                            : "border-sky-500/40 bg-sky-50 text-sky-800 hover:bg-sky-50"
                        }`}
                      >
                        <Satellite className="h-2.5 w-2.5" /> {gibsKey === airElem.s5p ? tr("Спутник қосулы") : tr("Спутник")}
                      </button>
                    </div>
                    <SatColumnNote gas={airElem.s5p as SatGas} tone="light" />
                  </div>
                )}
              </>
            )}
            <LayerIndexNote layer="air" />
          </div>
        )}

          </TabsContent>
          <TabsContent forceMount value="satellite" aria-label={tr("Спутник")} hidden={rightView !== "satellite"} className="space-y-2">
            <p className="text-xs text-neutral-600">{tr("Дереккөз")}: {SAT_PROVIDER}</p>
            {GIBS_LAYERS.map((g) => (
              <button
                key={g.key}
                onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                title={tr(g.descKz)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-[13px] transition-colors ${
                  gibsKey === g.key
                    ? "border-emerald-500/50 bg-emerald-50 text-emerald-800"
                    : "border-transparent text-neutral-800 hover:bg-neutral-50"
                }`}
              >
                <Satellite className="h-3.5 w-3.5 flex-shrink-0" /> <span className="text-left leading-tight">{tr(g.labelKz)}</span>
              </button>
            ))}

            {/* Радар — Sentinel-1 (кілт болса) */}
            {RADAR_SAT_LAYERS.length > 0 && (
              <>
                <div className="mb-0.5 mt-2 px-1 text-[12px] uppercase tracking-wide text-neutral-600">
                  {tr("Радар")} · Sentinel-1
                </div>
                {RADAR_SAT_LAYERS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                    title={tr(g.descKz)}
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-[13px] transition-colors ${
                      gibsKey === g.key
                        ? "border-amber-500/50 bg-amber-50 text-amber-800"
                        : "border-transparent text-neutral-800 hover:bg-neutral-50"
                    }`}
                  >
                    <Radio className="h-3.5 w-3.5 flex-shrink-0" /> <span className="text-left leading-tight">{tr(g.labelKz)}</span>
                  </button>
                ))}
              </>
            )}

            {/* Атмосфералық газдар */}
            <div className="mb-0.5 mt-2 px-1 text-[12px] uppercase tracking-wide text-neutral-600">
              {tr("Атмосфера")} · {ATMOS_PROVIDER}
            </div>
            {ATMOS_LAYERS.map((g) => (
              <div key={g.key}>
                <button
                  onClick={() => setGibsKey((cur) => (cur === g.key ? null : g.key))}
                  title={tr(g.descKz)}
                  className={`flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    gibsKey === g.key
                      ? "border-fuchsia-500/50 bg-fuchsia-50 text-fuchsia-800"
                      : "border-transparent text-neutral-800 hover:bg-neutral-50"
                  }`}
                >
                  <Wind className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="text-left leading-tight">{tr(g.labelKz)}</span>
                </button>
                {/* Тек Sentinel-5P қабаттары: MODIS snow / GIBS қабаттарына S5P метадерегі берілмейді */}
                {gibsKey === g.key && satNoteGasFor(g) !== null && (
                  <SatColumnNote gas={g.key} tone="light" />
                )}
              </div>
            ))}


            {gibsKey && (
              <button
                onClick={() => setGibsKey(null)}
                className="mt-0.5 rounded-md border border-transparent px-2.5 py-1 text-[12px] text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              >
                {tr("Қабатты өшіру")}
              </button>
            )}          </TabsContent>
          <TabsContent forceMount value="analysis" aria-label={tr("AI талдау")} hidden={rightView !== "analysis"}>
            {!selected && <p className="text-sm text-neutral-600">{tr("Талдау үшін сол жақтан «AI талдау» қосыңыз")}</p>}
      <AnalysisDrawer site={selected} onClose={() => setSelected(null)} onUpdate={setSelected} />

          </TabsContent>
          <TabsContent forceMount value="history" aria-label={tr("Тарих")} hidden={rightView !== "history"}>
            {!historyMode && <p className="text-sm text-neutral-600">{tr("Сол жақтан тарихи режимді қосыңыз.")}</p>}
      {/* History timeline — real Sentinel-2 yearly mosaics */}
      {historyMode && (
        <div className="space-y-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-amber-800">
              <History className="h-3.5 w-3.5" />
              {tr("Атыраудың нақты спутник тарихы (1984–2025)")}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (yearIdx >= HISTORY_YEARS.length) setYearIdx(0);
                  setTimelapsePlaying((v) => !v);
                }}
                className="flex items-center gap-1 rounded bg-amber-50 px-2 py-1 text-[13px] text-amber-800 hover:bg-amber-50"
              >
                {timelapsePlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {timelapsePlaying ? tr("Тоқтату") : tr("Тайм-лапс")}
              </button>
              <button aria-label={tr("Жабу")} onClick={() => { setHistoryMode(false); setTimelapsePlaying(false); }} className="text-neutral-600 hover:text-neutral-900">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label={tr("Спутник тарихы — жыл")}
              min={0}
              max={HISTORY_YEARS.length}
              step={1}
              value={yearIdx}
              onChange={(e) => { setTimelapsePlaying(false); setYearIdx(Number(e.target.value)); }}
              className="flex-1 accent-amber-400"
            />
            <span className="w-16 text-right text-lg font-bold text-amber-800">
              {year ?? tr("Қазір")}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2 text-xs text-neutral-600">
            {HISTORY_YEARS.map((y) => (
              <span key={y}>{y}</span>
            ))}
            <span>{tr("Қазір")}</span>
          </div>
          <p className="mt-2 text-[13px] text-neutral-600">
            {year
              ? LANDSAT_YEARS.has(year)
                ? `${year} ${tr("жыл — NASA Landsat нақты суреті (30м). Атырау мұнай өнеркәсібі дамуының ерте кезеңі.")}`
                : year < 2016
                  ? `${year} ${tr("жыл — NASA MODIS нақты суреті (250м, шолу деңгейі). Sentinel-2 спутнигі 2015 жылы ұшырылғандықтан, бұдан ескі жоғары сапалы сурет жоқ.")}`
                  : `${year} ${tr("жыл — бұлтсыз Sentinel-2 мозаикасы (10м), дәл сол жылғы Атыраудың шынайы көрінісі. Картаны бассаңыз, AI сол жылғы суретті талдайды.")}`
              : tr("Қазіргі Mapbox спутник суреті. Слайдерді жылжытып, өткен жылдармен салыстырыңыз.")}
            <span className="ml-1 text-amber-800">{tr("Бұл жылдың нүктелері")}: {allSites.length}</span>
          </p>
        </div>
      )}

          </TabsContent>
          <TabsContent forceMount value="sar" aria-label="SAR" hidden={rightView !== "sar"}>
            {oilScan?.loading && <p role="status">{tr("Жүктелуде…")}</p>}
            {!oilScan && <p className="text-sm text-neutral-600">{tr("Сканерді «Мұнай» қабатынан іске қосыңыз.")}</p>}
      {/* Мұнай дағы SAR нәтижесі (батырма «Мұнай» қабатының ішінде) */}
      {oilScan && !oilScan.loading && oilScan.data && (
        <div className="space-y-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-brand">
              <Fuel className="h-3.5 w-3.5" /> {tr("Мұнай дағы — SAR сканері")}
            </span>
            <button aria-label={tr("Жабу")} onClick={() => setOilScan(null)} className="text-neutral-600 hover:text-neutral-900"><X className="h-3.5 w-3.5" /></button>
          </div>
          {oilScan.data.available === false ? (
            <p className="text-[13px] text-neutral-600">{tr(oilScan.data.reason ?? "Қолжетімсіз")}</p>
          ) : oilScan.data.error ? (
            <p className="text-[13px] text-neutral-600">{tr(oilScan.data.error)}</p>
          ) : (
            <>
              {oilScan.data.imageUrl && (
                <img src={oilScan.data.imageUrl} alt="Sentinel-1 SAR" className="mb-2 w-full rounded border border-neutral-300" />
              )}
              <div className={`mb-1 flex items-center gap-2 text-sm font-bold ${oilScan.data.suspected ? "text-red-800" : "text-emerald-800"}`}>
                {oilScan.data.suspected ? tr("Күдікті дақ табылды") : tr("Айқын дақ жоқ")}
                {oilScan.data.confidence != null && (
                  <span className="text-[13px] font-normal text-neutral-600">· {oilScan.data.confidence}%</span>
                )}
              </div>
              {oilScan.data.description && <p className="text-[13px] text-neutral-800">{oilScan.data.description}</p>}
              {oilScan.data.caveat && (
                <p className="mt-1 rounded bg-amber-50 p-1.5 text-[12px] text-amber-800">⚠️ {tr(oilScan.data.caveat)}</p>
              )}
              <p className="mt-1 text-[12px] text-neutral-600">Sentinel-1 SAR · GPT-4o vision · {tr("расталған детекция емес")}</p>
            </>
          )}
        </div>
      )}

          </TabsContent>
        </div>
        </Tabs>
      </Panel>
    </div>
  );
}
