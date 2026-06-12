"use client";

import { useMemo, useState, useCallback, useRef } from "react";
import Map, { Marker, Layer, Source, type MapRef } from "react-map-gl/mapbox";
import type { MapLayerMouseEvent } from "mapbox-gl";
import { toast } from "sonner";
import { Loader2, Layers, Satellite, History, X, MapPinPlus, Plus, Minus, Locate } from "lucide-react";
import { useSitesStore } from "@/store/useSitesStore";
import { RISK_COLORS } from "@/lib/risk";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import { LAYERS, type LayerKey } from "@/data/historyFactors";

// Real yearly satellite mosaics: Sentinel-2 Cloudless by EOX (ESA Copernicus data).
// Each year is an actual cloud-free mosaic captured that year — no simulation.
const HISTORY_YEARS: number[] = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
function s2TileUrl(year: number): string {
  const layer = year === 2016 ? "s2cloudless_3857" : `s2cloudless-${year}_3857`;
  return `https://tiles.maps.eox.at/wmts/1.0.0/${layer}/default/g/{z}/{y}/{x}.jpg`;
}
import { AnalysisDrawer } from "@/components/analysis/AnalysisDrawer";
import type { Site } from "@/types/site";

const ATYRAU = { latitude: 47.1167, longitude: 51.9014, zoom: 7.5 };

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
  const layerDef = LAYERS.find((l) => l.key === activeLayer);

  const heatmapData = useMemo(() => {
    if (!activeLayer) return null;
    return {
      type: "FeatureCollection" as const,
      features: allSites.map((s) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
        properties: { weight: layerWeight(s, activeLayer) },
      })),
    };
  }, [allSites, activeLayer]);

  const analyzeAt = useCallback(
    async (lat: number, lng: number) => {
      if (analyzing) return;
      setAnalyzing(true);
      toast.info(
        viewYear
          ? `AI ${viewYear} жылғы Sentinel-2 суретін талдап жатыр…`
          : "AI спутник суретін талдап жатыр…"
      );
      try {
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
      } catch {
        toast.error("Талдау сәтсіз аяқталды. Қайталап көріңіз.");
      } finally {
        setAnalyzing(false);
      }
    },
    [analyzing, addSite, viewYear]
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
            key={`s2-${year}`}
            id="s2-history"
            type="raster"
            tiles={[s2TileUrl(year)]}
            tileSize={256}
            attribution="Sentinel-2 cloudless by EOX — ESA Copernicus data"
          >
            <Layer id="s2-history-layer" type="raster" paint={{ "raster-opacity": 1 }} />
          </Source>
        )}
        {heatmapData && layerDef && (
          <Source id="eco-layer" type="geojson" data={heatmapData}>
            <Layer
              id="eco-heat"
              type="heatmap"
              paint={{
                "heatmap-weight": ["get", "weight"],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 40, 10, 90],
                "heatmap-intensity": 2,
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

        {allSites.map((s) => (
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
              {s.mode === "photo" || s.mode === "combined" ? "📸" : ""}
              {s.analysis.verificationStatus === "confirmed" ? "✓" : ""}
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
            {LAYERS.map((l) => (
              <button
                key={l.key}
                onClick={() => setActiveLayer((cur) => (cur === l.key ? null : l.key))}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                  activeLayer === l.key
                    ? l.activeCls
                    : "border-transparent text-neutral-300 hover:bg-white/5"
                }`}
              >
                <span>{l.emoji}</span> {l.label}
              </button>
            ))}
          </div>
        </div>

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
              Атыраудың нақты спутник тарихы — Sentinel-2 (ESA Copernicus)
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
              ? `${year} жылы түсірілген бұлтсыз Sentinel-2 мозаикасы — дәл сол жылғы Атыраудың шынайы көрінісі. Картаны бассаңыз, AI ${year} жылғы суретті талдайды.`
              : "Қазіргі Mapbox спутник суреті. Слайдерді жылжытып, өткен жылдармен салыстырыңыз."}
            <span className="ml-1 text-amber-300/80">
              Бұл жылдың нүктелері: {allSites.length}
            </span>
          </p>
        </div>
      )}

      {/* Zoom controls — Google Maps style */}
      <div className="absolute bottom-8 right-4 flex flex-col items-center gap-3">
        <button
          onClick={() =>
            mapRef.current?.flyTo({ center: [ATYRAU.longitude, ATYRAU.latitude], zoom: ATYRAU.zoom, duration: 1200 })
          }
          title="Атырауға оралу"
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
