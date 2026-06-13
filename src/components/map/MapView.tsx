"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
import Map, { Marker, Layer, Source, type MapRef } from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import { toast } from "sonner";
import {
  Loader2, Layers, Satellite, History, X, MapPinPlus, Plus, Minus, Locate,
  Bug, Wind, Mountain, Fuel, Trash2, Waves, Radio, Camera, Sparkles, Play, Pause, Flame,
} from "lucide-react";
import { useSitesStore } from "@/store/useSitesStore";
import { RISK_COLORS } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import { LAYERS, type LayerKey } from "@/data/historyFactors";

// Real yearly satellite mosaics: Sentinel-2 Cloudless by EOX (ESA Copernicus data).
// All imagery is real, no simulation:
//  • 2000–2015 → NASA MODIS Terra True Color (250 m) — only real source pre-Sentinel-2
//  • 2016–2025 → Sentinel-2 Cloudless yearly mosaic by EOX (10 m, ESA Copernicus)
const HISTORY_YEARS: number[] = [
  2000, 2003, 2006, 2009, 2012, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

function isModisYear(year: number): boolean {
  return year < 2016;
}

// Raster tile config for the selected year's map layer
function yearTileConfig(year: number): { tiles: string[]; maxzoom: number; attribution: string } {
  if (isModisYear(year)) {
    return {
      tiles: [
        `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${year}-07-15/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
      ],
      maxzoom: 9, // MODIS native resolution cap
      attribution: "NASA EOSDIS GIBS — MODIS Terra",
    };
  }
  const layer = year === 2016 ? "s2cloudless_3857" : `s2cloudless-${year}_3857`;
  return {
    tiles: [`https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/{z}/{y}/{x}.jpg`],
    maxzoom: 16,
    attribution: "Sentinel-2 cloudless by EOX — ESA Copernicus",
  };
}
import { AnalysisDrawer } from "@/components/analysis/AnalysisDrawer";
import { MosquitoIcon } from "./MosquitoIcon";
import { aqiCategory, AQI_CATEGORIES } from "@/lib/airQuality";
import type { Site, AnalysisResult } from "@/types/site";

const ATYRAU = { latitude: 47.1167, longitude: 51.9014, zoom: 7.5 };

const LAYER_ICONS: Record<LayerKey, React.ElementType> = {
  mosquito: Bug,
  air: Wind,
  soil: Mountain,
  oil: Fuel,
  waste: Trash2,
  water: Waves,
};

interface AirGridPoint {
  lat: number;
  lng: number;
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2?: number | null;
  so2?: number | null;
  ozone?: number | null;
  dust?: number | null;
  dense?: boolean;
  name?: string;
  hourly?: { time: string; aqi: number | null }[];
}
interface Dominant {
  key: string;
  label: string;
  source: string;
  value: number;
}
interface Flare {
  lat: number;
  lng: number;
  brightness: number;
  frp: number;
  confidence: string;
  acqDate: string;
  dayNight: string;
}
interface FloodPoint {
  lat: number;
  lng: number;
  name: string;
  discharge: number;
  ratio: number;
  level: string;
  color: string;
  trend: string;
}

interface MosquitoDay {
  date: string;
  index: number;
  temp: number;
  rainMm: number;
}
interface MosquitoGridPoint {
  lat: number;
  lng: number;
  index: number;
  temperature: number;
  humidity: number;
  weekRainMm: number;
  days?: MosquitoDay[];
  dense?: boolean; // true = city district (tight icon cluster)
  name?: string;
}

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
  }
}

export function MapView() {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const mapRef = useRef<MapRef>(null);
  const userSites = useSitesStore((s) => s.userSites);
  const addSite = useSitesStore((s) => s.addSite);
  const [addOpen, setAddOpen] = useState(false);
  const [addLat, setAddLat] = useState("");
  const [addLng, setAddLng] = useState("");
  const [selected, setSelected] = useState<Site | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [mapStyle, setMapStyle] = useState<"satellite" | "streets">("satellite");
  const [activeLayer, setActiveLayer] = useState<LayerKey | null>(null);
  const [historyMode, setHistoryMode] = useState(false);
  const [showReports, setShowReports] = useState(true);
  const [agentMode, setAgentMode] = useState(false);
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
  // Shared citizen reports loaded from Supabase (visible to everyone)
  const [sharedReports, setSharedReports] = useState<Site[]>([]);
  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.reports ?? []) as Array<{
          id: string; lat: number; lng: number; name: string | null; district: string | null;
          risk_score: number; mosquito_index: number; analysis: AnalysisResult;
          image_url: string | null; photo_thumb: string | null; created_at: string;
        }>;
        setSharedReports(
          rows.map((r) => ({
            id: r.id,
            lat: r.lat,
            lng: r.lng,
            name: r.name ?? "Азаматтық хабарлама",
            district: r.district ?? "Атырау облысы",
            mode: "combined" as const,
            analysis: r.analysis,
            mosquitoRiskIndex: r.mosquito_index,
            imageUrl: r.image_url ?? undefined,
            photoThumb: r.photo_thumb ?? undefined,
            createdAt: r.created_at,
            flagged: r.risk_score >= 80,
          }))
        );
      })
      .catch(() => {});
  }, []);

  // Citizen photo reports: shared (Supabase) + any local ones not yet synced
  const photoReports = useMemo(() => {
    const localPhotos = userSites.filter((s) => !!s.photoThumb && !s.imageryYear);
    const sharedIds = new Set(sharedReports.map((s) => s.id));
    return [...sharedReports, ...localPhotos.filter((s) => !sharedIds.has(s.id))];
  }, [userSites, sharedReports]);
  const layerDef = LAYERS.find((l) => l.key === activeLayer);
  const [airGrid, setAirGrid] = useState<AirGridPoint[] | null>(null);
  const [airDominant, setAirDominant] = useState<Dominant | null>(null);
  const [airError, setAirError] = useState(false);
  const [airHour, setAirHour] = useState(0); // 0 = now … 23 = +23h
  const [airPlaying, setAirPlaying] = useState(false);

  // Air layer uses LIVE regional data (Copernicus CAMS), fetched on first open
  useEffect(() => {
    if (activeLayer !== "air" || airGrid || airError) return;
    fetch("/api/airgrid")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setAirGrid(d.grid);
        setAirDominant(d.dominant ?? null);
      })
      .catch(() => setAirError(true));
  }, [activeLayer, airGrid, airError]);

  // 24h forecast animation
  useEffect(() => {
    if (!airPlaying || activeLayer !== "air") return;
    const t = setInterval(() => setAirHour((h) => (h + 1) % 24), 700);
    return () => clearInterval(t);
  }, [airPlaying, activeLayer]);

  const airHourAqi = (p: AirGridPoint) => p.hourly?.[airHour]?.aqi ?? p.aqi;
  const airHours = airGrid?.[0]?.hourly;

  // Water layer: live Zhaiyk river discharge + flood risk (GloFAS)
  const [flood, setFlood] = useState<FloodPoint[] | null>(null);
  const [floodError, setFloodError] = useState(false);
  useEffect(() => {
    if (activeLayer !== "water" || flood || floodError) return;
    fetch("/api/flood")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setFlood(d.points ?? []))
      .catch(() => setFloodError(true));
  }, [activeLayer, flood, floodError]);

  // Oil layer: live gas-flare detections from NASA FIRMS
  const [flares, setFlares] = useState<Flare[] | null>(null);
  const [flaresError, setFlaresError] = useState<string | null>(null);
  useEffect(() => {
    if (activeLayer !== "oil" || flares || flaresError) return;
    fetch("/api/flares")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setFlares(d.flares ?? []);
        else setFlaresError(d.error ?? "Қолжетімсіз");
      })
      .catch(() => setFlaresError("Қолжетімсіз"));
  }, [activeLayer, flares, flaresError]);

  // Mosquito layer uses LIVE climate-suitability grid (real weather + published methodology)
  const [mosGrid, setMosGrid] = useState<MosquitoGridPoint[] | null>(null);
  const [mosError, setMosError] = useState(false);
  const [mosDay, setMosDay] = useState(0); // 0 = today … 6 = +6 days
  const [mosPlaying, setMosPlaying] = useState(false);
  useEffect(() => {
    if (activeLayer !== "mosquito" || mosGrid || mosError) return;
    fetch("/api/mosquitogrid")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setMosGrid(d.grid))
      .catch(() => setMosError(true));
  }, [activeLayer, mosGrid, mosError]);

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
    return {
      type: "FeatureCollection" as const,
      features: allSites.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { weight: layerWeight(s, activeLayer) },
      })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSites, activeLayer, airGrid, mosGrid, mosDay, airHour]);

  // Grid layers (air, mosquito) need a wide radius — sparse regional points
  const isGridLayer = activeLayer === "air" || activeLayer === "mosquito";

  // Scatter mosquito icons around each grid point — count scales with the live index
  const mosquitoSwarm = useMemo(() => {
    if (activeLayer !== "mosquito" || !mosGrid) return [];
    const swarm: { id: string; lat: number; lng: number; size: number }[] = [];
    for (const p of mosGrid) {
      const count = Math.round(mosDayIndex(p) / 10); // 0 (cold) … ~10 icons (peak)
      // City districts cluster tightly (~1.5 km); regional cells spread wide
      const spreadLat = p.dense ? 0.012 : 0.13;
      const spreadLng = p.dense ? 0.016 : 0.18;
      for (let i = 0; i < count; i++) {
        // deterministic pseudo-random spread so icons don't jump each render
        const a = Math.sin(p.lat * 91 + p.lng * 47 + i * 13);
        const b = Math.cos(p.lat * 53 + p.lng * 71 + i * 29);
        swarm.push({
          id: `${p.lat},${p.lng},${i}`,
          lat: p.lat + a * spreadLat,
          lng: p.lng + b * spreadLng,
          size: 14 + (Math.abs(a) > 0.6 ? 6 : 0),
        });
      }
    }
    return swarm;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLayer, mosGrid, mosDay]);

  const analyzeAt = useCallback(
    async (lat: number, lng: number) => {
      if (analyzing) return;
      setAnalyzing(true);
      try {
        if (agentMode) {
          // AI agent: zoom the map to the point itself, then synthesise
          // satellite imagery + live official data (CAMS, weather)
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1400 });
          toast.info("🤖 AI агент картаны жақындатып, спутник + тірі ресми деректерді талдап жатыр…");
          const res = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });
          if (!res.ok) throw new Error();
          const data = await res.json();
          const site: Site = {
            id: `agent-${Date.now()}`,
            lat,
            lng,
            name: "AI агент бағалауы",
            district: "Атырау облысы",
            mode: "satellite",
            analysis: data.analysis,
            mosquitoRiskIndex: data.mri,
            imageUrl: data.imageUrl,
            createdAt: new Date().toISOString(),
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
              ? `AI ${viewYear} жылғы Sentinel-2 суретін талдап жатыр…`
              : "AI спутник суретін талдап жатыр…"
          );
          const res = await fetch("/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "satellite", lat, lng, imageryYear: viewYear }),
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
            imageUrl: data.imageUrl,
            createdAt: new Date().toISOString(),
            flagged: false,
          };
          addSite(site);
          setSelected(site);
          toast.success(data.mock ? "Талдау дайын (демо режимі — API кілті жоқ)" : "AI талдауы дайын!");
          if (data.analysis.riskScore >= 55) {
            toast.warning("⚠️ Жоғары тәуекел! Жауапты органға хабарлама автоматты жіберілді", {
              description: "Толығырақ: «Ескертулер» бөлімінде",
            });
          }
        }
      } catch {
        toast.error("Талдау сәтсіз аяқталды. Қайталап көріңіз.");
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing, addSite, viewYear, agentMode]
  );

  const handleClick = useCallback(
    (e: MapLayerMouseEvent) => analyzeAt(e.lngLat.lat, e.lngLat.lng),
    [analyzeAt]
  );

  const addByCoords = () => {
    const la = parseFloat(addLat), ln = parseFloat(addLng);
    if (isNaN(la) || isNaN(ln) || la < -90 || la > 90 || ln < -180 || ln > 180) {
      toast.error("Координаттар жарамсыз");
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
    <div className="relative h-[calc(100vh-3.5rem)]">
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
        cursor={analyzing ? "wait" : "crosshair"}
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

        {/* Live mosquito swarm — icon density follows the real suitability index */}
        {mosquitoSwarm.map((m) => (
          <Marker key={m.id} latitude={m.lat} longitude={m.lng}>
            <MosquitoIcon size={m.size} className="text-purple-200/85 drop-shadow" />
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
      </Map>

      {/* Layer panel */}
      <div className="absolute left-4 top-4 flex flex-col gap-2">
        <button
          onClick={() => setMapStyle((s) => (s === "satellite" ? "streets" : "satellite"))}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-neutral-900/90 px-3 py-2 text-xs text-white backdrop-blur hover:bg-neutral-800"
        >
          <Layers className="h-4 w-4" />
          {mapStyle === "satellite" ? "Қала картасы" : "Спутник"}
        </button>

        <div className="rounded-lg border border-white/10 bg-neutral-900/90 p-2 backdrop-blur">
          <div className="mb-1.5 px-1 text-[10px] uppercase tracking-wide text-neutral-500">
            Эко қабаттар
          </div>
          <div className="flex flex-col gap-1">
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
                  <Icon className="h-3.5 w-3.5" /> {l.label}
                  {(l.key === "air" || l.key === "mosquito" || l.key === "oil" || l.key === "water") && (
                    <span className="ml-auto rounded bg-emerald-500/15 px-1 py-px text-[8px] uppercase text-emerald-300">
                      live
                    </span>
                  )}
                </button>
              );
            })}
            <div className="my-0.5 h-px bg-white/10" />
            <button
              onClick={() => setAgentMode((v) => !v)}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                agentMode
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-200"
                  : "border-transparent text-neutral-300 hover:bg-white/5"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" /> AI агент
              <span className="ml-auto rounded bg-violet-500/15 px-1 py-px text-[8px] uppercase text-violet-300">
                көп дереккөз
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
              <Camera className="h-3.5 w-3.5" /> Хабарламалар
              <span className="ml-auto rounded bg-white/10 px-1 py-px text-[9px] text-neutral-300">
                {photoReports.length}
              </span>
            </button>
          </div>
        </div>

        {/* Live mosquito-suitability panel */}
        {activeLayer === "mosquito" && (
          <div className="w-56 rounded-lg border border-purple-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-purple-300">
              <Radio className="h-3 w-3 animate-pulse" /> Маса қолайлылығы — тірі
            </div>
            {mosError ? (
              <p className="text-[11px] text-neutral-400">
                Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.
              </p>
            ) : !mosGrid ? (
              <p className="text-[11px] text-neutral-500">Жүктелуде…</p>
            ) : (
              <>
                {mosStats && (
                  <>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-white/5 p-1.5">
                        <div className="text-sm font-bold text-emerald-300">{mosStats.min}</div>
                        <div className="text-[9px] text-neutral-500">мин</div>
                      </div>
                      <div className="rounded bg-white/5 p-1.5">
                        <div className="text-sm font-bold text-white">{mosStats.avg}</div>
                        <div className="text-[9px] text-neutral-500">орташа</div>
                      </div>
                      <div className="rounded bg-white/5 p-1.5">
                        <div className={`text-sm font-bold ${mosStats.max > 60 ? "text-red-300" : "text-yellow-300"}`}>
                          {mosStats.max}
                        </div>
                        <div className="text-[9px] text-neutral-500">макс</div>
                      </div>
                    </div>
                  </>
                )}

                {/* 7-day forecast animation */}
                {mosDays && mosDays.length > 1 && (
                  <div className="mt-2 rounded-lg bg-purple-500/10 p-2">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-purple-200">
                        {mosDay === 0 ? "Бүгін" : `+${mosDay} күн`} ·{" "}
                        {mosDays[mosDay]?.date?.slice(5) ?? ""}
                      </span>
                      <button
                        onClick={() => setMosPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-purple-500/25 px-1.5 py-0.5 text-[10px] text-purple-100 hover:bg-purple-500/40"
                      >
                        {mosPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {mosPlaying ? "Тоқтату" : "Ойнату"}
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
                  🦟 иконкалар индекс бойынша шоғырланады. Слайдермен 7 күндік болжамды көріңіз.
                  Басты фактор — <b className="text-purple-300">Жайық жайылмасы мен атырауы</b> (қамыс,
                  тұрған су) + температура + жаңбыр + қала. Әдістеме: Mordecai 2017 (WHO/ECDC) +
                  гидрология. Дереккөз: Open-Meteo.
                </p>
              </>
            )}
          </div>
        )}

        {/* Live gas-flare panel — oil layer */}
        {activeLayer === "oil" && (
          <div className="w-52 rounded-lg border border-orange-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-orange-300">
              <Flame className="h-3 w-3" /> Газ факелдері — тірі
            </div>
            {flaresError ? (
              <p className="text-[11px] text-neutral-400">
                {flaresError === "FIRMS кілті бапталмаған"
                  ? "NASA FIRMS кілті қажет (тегін). Қосылғанша факелдер көрсетілмейді."
                  : `Тірі деректер қолжетімсіз: ${flaresError}. Жалған дерек көрсетілмейді.`}
              </p>
            ) : !flares ? (
              <p className="text-[11px] text-neutral-500">Жүктелуде…</p>
            ) : flares.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Соңғы 2 күнде жану нүктесі анықталмады.</p>
            ) : (
              <>
                <div className="rounded-lg bg-orange-500/10 p-2 text-center">
                  <div className="text-2xl font-bold text-orange-300">{flares.length}</div>
                  <div className="text-[10px] text-neutral-400">анықталған жану нүктесі (2 күн)</div>
                </div>
                <p className="mt-1.5 text-[9px] leading-snug text-neutral-500">
                  🔥 иконка өлшемі — жану қуатына (FRP) сай. Мұнай-газ кен орындарының факелдері
                  спутниктен жылулық аномалия ретінде көрінеді. Дереккөз: NASA FIRMS (VIIRS 375м).
                </p>
              </>
            )}
          </div>
        )}

        {/* Live water/flood panel — water layer */}
        {activeLayer === "water" && (
          <div className="w-56 rounded-lg border border-teal-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-teal-300">
              <Radio className="h-3 w-3 animate-pulse" /> Жайық өзені — тірі ағын
            </div>
            {floodError ? (
              <p className="text-[11px] text-neutral-400">
                Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.
              </p>
            ) : !flood ? (
              <p className="text-[11px] text-neutral-500">Жүктелуде…</p>
            ) : flood.length === 0 ? (
              <p className="text-[11px] text-neutral-400">Өзен деректері қолжетімсіз.</p>
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
                        Атырау тұсы · тренд: {aty.trend}
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
                  Нақты өзен ағыны мен тасқын қаупі. Жоғары ағын → жайылма су басу → маса ошақтары.
                  Дереккөз: Copernicus GloFAS (Open-Meteo).
                </p>
              </>
            )}
          </div>
        )}

        {/* Live air quality panel — shown while the air layer is active */}
        {activeLayer === "air" && (
          <div className="w-52 rounded-lg border border-sky-500/30 bg-neutral-900/95 p-3 backdrop-blur">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-sky-300">
              <Radio className="h-3 w-3 animate-pulse" /> Ауа сапасы — тірі
            </div>
            {airError ? (
              <p className="text-[11px] text-neutral-400">
                Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.
              </p>
            ) : !airGrid ? (
              <p className="text-[11px] text-neutral-500">Жүктелуде…</p>
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
                        <div className="text-[9px] text-neutral-400">облыс бойынша орташа EU AQI</div>
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
                          🩺 Денсаулық кеңесі
                        </div>
                        <p>{cat.advice}</p>
                        <p className="mt-1 text-neutral-400">
                          <b>Сезімтал топтар:</b> {cat.sensitiveAdvice}
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
                    <div className="font-semibold text-sky-300">Басты ластаушы</div>
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
                        {airHour === 0 ? "Қазір" : `+${airHour} сағ`} ·{" "}
                        {airHours[airHour]?.time?.slice(11, 16) ?? ""}
                      </span>
                      <button
                        onClick={() => setAirPlaying((v) => !v)}
                        className="flex items-center gap-1 rounded bg-sky-500/25 px-1.5 py-0.5 text-[10px] text-sky-100 hover:bg-sky-500/40"
                      >
                        {airPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        {airPlaying ? "Тоқтату" : "Ойнату"}
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
                    <p className="mt-0.5 text-[9px] text-neutral-500">Алдағы 24 сағат — нақты CAMS болжамы</p>
                  </div>
                )}

                {/* City districts ranking */}
                {airStats?.districts && airStats.districts.length > 0 && (
                  <div className="mt-2 rounded-lg bg-white/5 p-2">
                    <div className="mb-1 text-[10px] font-semibold text-sky-300">Қала аудандары</div>
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
                  EU AQI (EAQI), Copernicus CAMS — сағат сайын. Аудандар CAMS ажыратымдылығымен (~10км)
                  бағаланады.
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
          Нүкте қосу
        </button>

        {addOpen && (
          <div className="w-48 rounded-lg border border-emerald-500/30 bg-neutral-900/95 p-2.5 backdrop-blur">
            <div className="mb-1.5 text-[10px] uppercase tracking-wide text-neutral-500">
              Координат бойынша
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
              Талдау жасау
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
          Тарихи режим
        </button>
      </div>

      {/* History timeline — real Sentinel-2 yearly mosaics */}
      {historyMode && (
        <div className="absolute bottom-20 left-1/2 w-[min(620px,90%)] -translate-x-1/2 rounded-xl border border-amber-500/30 bg-neutral-900/95 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs text-amber-300">
              <History className="h-3.5 w-3.5" />
              Атыраудың нақты спутник тарихы (2000–2025)
            </span>
            <button onClick={() => setHistoryMode(false)} className="text-neutral-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={HISTORY_YEARS.length}
              step={1}
              value={yearIdx}
              onChange={(e) => setYearIdx(Number(e.target.value))}
              className="flex-1 accent-amber-400"
            />
            <span className="w-16 text-right text-lg font-bold text-amber-300">
              {year ?? "Қазір"}
            </span>
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
            {HISTORY_YEARS.map((y) => (
              <span key={y}>{String(y).slice(2)}</span>
            ))}
            <span>Қазір</span>
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">
            {year
              ? isModisYear(year)
                ? `${year} жыл — NASA MODIS нақты суреті (250м, шолу деңгейі). Sentinel-2 спутнигі 2015 жылы ұшырылғандықтан, бұдан ескі жоғары сапалы сурет жоқ.`
                : `${year} жыл — бұлтсыз Sentinel-2 мозаикасы (10м), дәл сол жылғы Атыраудың шынайы көрінісі. Картаны бассаңыз, AI ${year} жылғы суретті талдайды.`
              : "Қазіргі Mapbox спутник суреті. Слайдерді жылжытып, өткен жылдармен салыстырыңыз."}
            <span className="ml-1 text-amber-300/80">Бұл жылдың нүктелері: {allSites.length}</span>
          </p>
        </div>
      )}

      {/* Zoom controls — Google Maps style */}
      <div className="absolute bottom-8 right-4 flex flex-col items-center gap-3">
        <button
          onClick={() =>
            mapRef.current?.flyTo({ center: [51.8833, 47.1167], zoom: 12.5, duration: 1400 })
          }
          title="Атырау қаласына жақындау"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/95 text-neutral-300 shadow-xl backdrop-blur transition-colors hover:bg-neutral-800 hover:text-white"
        >
          <Locate className="h-5 w-5" />
        </button>
        <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur">
          <button
            onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
            title="Жақындату"
            className="flex h-11 w-11 items-center justify-center text-neutral-200 transition-colors hover:bg-white/10 hover:text-white active:bg-white/20"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="mx-2 h-px bg-white/10" />
          <button
            onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
            title="Алыстату"
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
            <Loader2 className="h-4 w-4 animate-spin" /> AI талдап жатыр…
          </div>
        ) : agentMode ? (
          <div className="flex items-center gap-2 rounded-full border border-violet-500/40 bg-neutral-900/90 px-4 py-2 text-xs text-violet-200 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" /> AI агент режимі: нүктені басыңыз — карта жақындап, спутник + тірі ресми деректер біріктіріледі
          </div>
        ) : (
          <div className="rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs text-neutral-300 backdrop-blur">
            Кез келген жерді басыңыз — AI сол аумақты талдайды
          </div>
        )}
      </div>

      <AnalysisDrawer site={selected} onClose={() => setSelected(null)} onUpdate={setSelected} />
    </div>
  );
}
