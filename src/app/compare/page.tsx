"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeftRight, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { useLang } from "@/lib/i18n";

const HISTORY_YEARS = [
  1984, 1985, 1986, 1989, 1990, 1991,
  1999, 2000, 2001,
  2003, 2006, 2009, 2012, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];
const LANDSAT_YEARS = new Set([1984, 1985, 1986, 1989, 1990, 1991, 1999, 2000, 2001]);

const ATYRAU_SPOTS = [
  { label: "Атырау қаласы", lat: 47.1167, lng: 51.8833 },
  { label: "Жайық өзені жайылмасы", lat: 47.05, lng: 51.92 },
  { label: "Мұнай зауыты маңы", lat: 47.14, lng: 51.96 },
  { label: "Теңіз кен орны", lat: 46.2, lng: 53.3 },
  { label: "Солтүстік аймақ", lat: 47.5, lng: 51.85 },
];

const DEFAULT_RADIUS = 0.12; // degrees (~13 km)

function imageUrl(lat: number, lng: number, year: number, r: number): string {
  if (LANDSAT_YEARS.has(year)) {
    const bbox = `${lat - r},${lng - r},${lat + r},${lng + r}`;
    return (
      `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap` +
      `&VERSION=1.3.0&LAYERS=Landsat_WELD_CorrectedReflectance_TrueColor_Global_Annual&CRS=EPSG:4326` +
      `&TIME=${year}-07-15&BBOX=${bbox}&WIDTH=800&HEIGHT=800&FORMAT=image/jpeg`
    );
  }
  if (year < 2016) {
    const bbox = `${lat - r},${lng - r},${lat + r},${lng + r}`;
    return (
      `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap` +
      `&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326` +
      `&TIME=${year}-07-15&BBOX=${bbox}&WIDTH=800&HEIGHT=800&FORMAT=image/jpeg`
    );
  }
  const layer = year === 2016 ? "s2cloudless" : `s2cloudless-${year}`;
  // EOX uses lng,lat order
  const bbox = `${lng - r},${lat - r},${lng + r},${lat + r}`;
  return `https://tiles.maps.eox.at/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=800&HEIGHT=800&FORMAT=image/jpeg`;
}

function mapboxUrl(lat: number, lng: number): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},12,0/800x800?access_token=${token}`;
}

export default function ComparePage() {
  const { tr } = useLang();
  const [spotIdx, setSpotIdx] = useState(0);
  const [leftYear, setLeftYear] = useState(2000);
  const [rightYear, setRightYear] = useState(2025);
  const [sliderX, setSliderX] = useState(50);
  const [sliderDragging, setSliderDragging] = useState(false);
  const [leftErr, setLeftErr] = useState(false);
  const [rightErr, setRightErr] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Map-like zoom/pan state
  const [center, setCenter] = useState({ lat: 47.1167, lng: 51.8833 });
  const [radius, setRadius] = useState(DEFAULT_RADIUS);
  const dragRef = useRef<{ startX: number; startY: number; startLat: number; startLng: number; startRadius: number } | null>(null);
  const [mapDragging, setMapDragging] = useState(false);

  const resetView = useCallback((lat: number, lng: number) => {
    setCenter({ lat, lng });
    setRadius(DEFAULT_RADIUS);
  }, []);

  // AI талдаудан келген координат
  const [customSpot, setCustomSpot] = useState<{ label: string; lat: number; lng: number } | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const lat = parseFloat(p.get("lat") ?? ""), lng = parseFloat(p.get("lng") ?? "");
    if (isFinite(lat) && isFinite(lng)) {
      setCustomSpot({ label: "Таңдалған нүкте (AI талдау)", lat, lng });
      setSpotIdx(0);
    }
  }, []);

  const spots = customSpot ? [customSpot, ...ATYRAU_SPOTS] : ATYRAU_SPOTS;
  const spot = spots[spotIdx] ?? spots[0];

  // Reset view when spot changes
  useEffect(() => {
    resetView(spot.lat, spot.lng);
    setCenter({ lat: spot.lat, lng: spot.lng });
    setRadius(DEFAULT_RADIUS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spotIdx]);

  useEffect(() => { setLeftErr(false); setRightErr(false); }, [spotIdx, leftYear, rightYear, center, radius]);

  // Pointer move: slider drag OR map pan
  const onPointerMove = useCallback((e: PointerEvent) => {
    if (sliderDragging && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
      setSliderX(x);
    }
    if (mapDragging && dragRef.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      // 1 pixel = 2*radius / W degrees
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const r = dragRef.current.startRadius;
      const dLng = -(dx / W) * 2 * r;
      const dLat = (dy / H) * 2 * r;
      setCenter({
        lat: dragRef.current.startLat + dLat,
        lng: dragRef.current.startLng + dLng,
      });
    }
  }, [sliderDragging, mapDragging]);

  const onPointerUp = useCallback(() => {
    setSliderDragging(false);
    setMapDragging(false);
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  // Wheel zoom: shrink/grow radius around cursor position
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      // Cursor position as fraction of container (0–1)
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;
      const factor = e.deltaY < 0 ? 0.7 : 1 / 0.7;
      setRadius(prev => {
        const next = Math.min(0.5, Math.max(0.003, prev * factor));
        // Shift center so point under cursor stays fixed
        const dLng = (fx - 0.5) * 2 * prev;
        const dLat = -(fy - 0.5) * 2 * prev;
        const newDLng = (fx - 0.5) * 2 * next;
        const newDLat = -(fy - 0.5) * 2 * next;
        setCenter(c => ({
          lat: c.lat + dLat - newDLat,
          lng: c.lng + dLng - newDLng,
        }));
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const zoomLevel = Math.round(Math.log2(DEFAULT_RADIUS / radius) + 1);

  const lUrl = leftErr ? mapboxUrl(center.lat, center.lng) : imageUrl(center.lat, center.lng, leftYear, radius);
  const rUrl = rightErr ? mapboxUrl(center.lat, center.lng) : imageUrl(center.lat, center.lng, rightYear, radius);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <ArrowLeftRight className="h-6 w-6 text-amber-400" /> {tr("Жыл салыстыру")}
        </h1>
        <p className="text-sm text-neutral-400">
          {tr("Нақты спутник суреттері: Sentinel-2 (2016–2025) · NASA MODIS (2002–2015) · NASA Landsat WELD (1984–2001)")}
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-white/[0.03] p-3">
          <div className="mb-1.5 text-xs text-neutral-400">{tr("Орын")}</div>
          <select
            value={spotIdx}
            onChange={(e) => setSpotIdx(Number(e.target.value))}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            {spots.map((s, i) => (
              <option key={i} value={i} className="bg-neutral-900">{tr(s.label)}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-1.5 text-xs text-amber-400">{tr("Сол жыл")}</div>
          <select
            value={leftYear}
            onChange={(e) => setLeftYear(Number(e.target.value))}
            className="w-full rounded-md border border-amber-500/20 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            {HISTORY_YEARS.map((y) => (
              <option key={y} value={y} className="bg-neutral-900">{y}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="mb-1.5 text-xs text-sky-400">{tr("Оң жыл")}</div>
          <select
            value={rightYear}
            onChange={(e) => setRightYear(Number(e.target.value))}
            className="w-full rounded-md border border-sky-500/20 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            {HISTORY_YEARS.map((y) => (
              <option key={y} value={y} className="bg-neutral-900">{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Split image viewer */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-xl border border-white/10 bg-black"
        style={{ aspectRatio: "1 / 1", maxHeight: "70vh", cursor: mapDragging ? "grabbing" : "grab" }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest("[data-slider]")) return;
          e.preventDefault();
          setMapDragging(true);
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            startLat: center.lat,
            startLng: center.lng,
            startRadius: radius,
          };
        }}
      >
        {/* Right image (full) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rUrl}
          alt={`${rightYear} жыл`}
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          onError={() => setRightErr(true)}
        />

        {/* Left image clipped */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderX}%` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lUrl}
            alt={`${leftYear} жыл`}
            className="absolute inset-0 h-full object-cover"
            style={{ width: `${10000 / sliderX}%`, maxWidth: "none" }}
            draggable={false}
            onError={() => setLeftErr(true)}
          />
        </div>

        {/* Slider divider */}
        <div
          data-slider
          className="absolute inset-y-0 z-10 w-0.5 cursor-ew-resize bg-white/80 shadow-lg"
          style={{ left: `${sliderX}%` }}
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); setSliderDragging(true); }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 cursor-ew-resize items-center justify-center rounded-full border-2 border-white/80 bg-neutral-900/95 shadow-xl">
            <ArrowLeftRight className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Year labels */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md bg-amber-500/80 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {leftYear} · {leftErr ? "Mapbox" : LANDSAT_YEARS.has(leftYear) ? "NASA Landsat" : leftYear < 2016 ? "NASA MODIS" : "Sentinel-2"}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 z-20 rounded-md bg-sky-500/80 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {rightYear} · {rightErr ? "Mapbox" : LANDSAT_YEARS.has(rightYear) ? "NASA Landsat" : rightYear < 2016 ? "NASA MODIS" : "Sentinel-2"}
        </div>

        {/* Zoom controls */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1">
          <button
            onClick={() => setRadius(r => Math.max(0.003, r * 0.7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur hover:bg-black/90"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={() => setRadius(r => Math.min(0.5, r / 0.7))}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur hover:bg-black/90"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          {(radius !== DEFAULT_RADIUS || center.lat !== spot.lat || center.lng !== spot.lng) && (
            <button
              onClick={() => resetView(spot.lat, spot.lng)}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur hover:bg-black/90"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Zoom level badge */}
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-full bg-black/60 px-2 py-1 text-xs text-white backdrop-blur">
          {zoomLevel > 0 ? `+${zoomLevel}` : zoomLevel}× zoom
        </div>

        {/* Hint */}
        <div className="pointer-events-none absolute bottom-12 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/60 px-3 py-1 text-xs text-neutral-300 backdrop-blur whitespace-nowrap">
          {tr("Дөңгелекпен зумдаңыз · сүйреп жылжытыңыз")}
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-400">
        <p>
          <span className="font-semibold text-amber-300">2002–2015:</span> {tr("NASA MODIS Terra (250 м ажыратымдылық) — Sentinel-2 спутнигі 2015 жылға дейін болмаған, сондықтан осы дәуірдің жалғыз нақты дереккөзі.")}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-sky-300">2016–2025:</span> {tr("Sentinel-2 Cloudless (EOX, ESA Copernicus, 10 м) — жыл сайынғы жазғы мозаика, бұлтсыз.")}
        </p>
      </div>
    </div>
  );
}
