"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeftRight, Loader2, ZoomIn } from "lucide-react";

const HISTORY_YEARS = [
  2000, 2003, 2006, 2009, 2012, 2015,
  2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
];

const ATYRAU_SPOTS = [
  { label: "Атырау қаласы", lat: 47.1167, lng: 51.8833 },
  { label: "Жайық өзені жайылмасы", lat: 47.05, lng: 51.92 },
  { label: "Мұнай зауыты маңы", lat: 47.14, lng: 51.96 },
  { label: "Теңіз кен орны", lat: 46.2, lng: 53.3 },
  { label: "Солтүстік аймақ", lat: 47.5, lng: 51.85 },
];

function imageUrl(lat: number, lng: number, year: number): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  if (year < 2016) {
    const d = 0.12;
    const bbox = `${lat - d},${lng - d},${lat + d},${lng + d}`;
    return (
      `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap` +
      `&VERSION=1.3.0&LAYERS=MODIS_Terra_CorrectedReflectance_TrueColor&CRS=EPSG:4326` +
      `&TIME=${year}-07-15&BBOX=${bbox}&WIDTH=800&HEIGHT=800&FORMAT=image/jpeg`
    );
  }
  const layer = year === 2016 ? "s2cloudless" : `s2cloudless-${year}`;
  const dLat = 0.035, dLng = 0.05;
  const bbox = `${lng - dLng},${lat - dLat},${lng + dLng},${lat + dLat}`;
  return `https://tiles.maps.eox.at/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${layer}&SRS=EPSG:4326&BBOX=${bbox}&WIDTH=800&HEIGHT=800&FORMAT=image/jpeg`;
}

// Fallback Mapbox static satellite image
function mapboxUrl(lat: number, lng: number): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${lng},${lat},12,0/800x800?access_token=${token}`;
}

export default function ComparePage() {
  const [spotIdx, setSpotIdx] = useState(0);
  const [leftYear, setLeftYear] = useState(2000);
  const [rightYear, setRightYear] = useState(2025);
  const [sliderX, setSliderX] = useState(50);
  const [dragging, setDragging] = useState(false);
  const [leftErr, setLeftErr] = useState(false);
  const [rightErr, setRightErr] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const spot = ATYRAU_SPOTS[spotIdx];

  useEffect(() => { setLeftErr(false); setRightErr(false); }, [spotIdx, leftYear, rightYear]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (!dragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - rect.left) / rect.width) * 100));
    setSliderX(x);
  }, [dragging]);

  const onPointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const lUrl = leftErr ? mapboxUrl(spot.lat, spot.lng) : imageUrl(spot.lat, spot.lng, leftYear);
  const rUrl = rightErr ? mapboxUrl(spot.lat, spot.lng) : imageUrl(spot.lat, spot.lng, rightYear);

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
          <ArrowLeftRight className="h-6 w-6 text-amber-400" /> Жыл салыстыру
        </h1>
        <p className="text-sm text-neutral-400">
          Нақты спутник суреттері: Sentinel-2 (2016–2025) · NASA MODIS (2000–2015)
        </p>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-1.5 text-xs text-neutral-400">Орын</div>
          <select
            value={spotIdx}
            onChange={(e) => setSpotIdx(Number(e.target.value))}
            className="w-full rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white focus:outline-none"
          >
            {ATYRAU_SPOTS.map((s, i) => (
              <option key={i} value={i} className="bg-neutral-900">{s.label}</option>
            ))}
          </select>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <div className="mb-1.5 text-xs text-amber-400">Сол жыл</div>
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
          <div className="mb-1.5 text-xs text-sky-400">Оң жыл</div>
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
        className="relative select-none overflow-hidden rounded-xl border border-white/10"
        style={{ aspectRatio: "1 / 1", maxHeight: "70vh" }}
      >
        {/* Right image (full width) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={rUrl}
          alt={`${rightYear} жыл`}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setRightErr(true)}
        />

        {/* Left image clipped to left side */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderX}%` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lUrl}
            alt={`${leftYear} жыл`}
            className="absolute inset-0 h-full object-cover"
            style={{ width: `${10000 / sliderX}%`, maxWidth: "none" }}
            onError={() => setLeftErr(true)}
          />
        </div>

        {/* Divider */}
        <div
          className="absolute inset-y-0 z-10 w-0.5 cursor-ew-resize bg-white/80 shadow-lg"
          style={{ left: `${sliderX}%` }}
          onPointerDown={(e) => { e.preventDefault(); setDragging(true); }}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 cursor-ew-resize items-center justify-center rounded-full border-2 border-white/80 bg-neutral-900/95 shadow-xl">
            <ArrowLeftRight className="h-4 w-4 text-white" />
          </div>
        </div>

        {/* Year labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-amber-500/80 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {leftYear} · {leftErr ? "Mapbox" : leftYear < 2016 ? "NASA MODIS" : "Sentinel-2"}
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-sky-500/80 px-2 py-1 text-xs font-bold text-white backdrop-blur">
          {rightYear} · {rightErr ? "Mapbox" : rightYear < 2016 ? "NASA MODIS" : "Sentinel-2"}
        </div>

        {/* Hint */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-neutral-300 backdrop-blur">
          <ZoomIn className="mr-1 inline h-3 w-3" />
          Слайдерді сүйреп жылжытыңыз
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-400">
        <p>
          <span className="font-semibold text-amber-300">2000–2015:</span> NASA MODIS Terra (250 м ажыратымдылық) —
          Sentinel-2 спутнигі 2015 жылға дейін болмаған, сондықтан осы дәуірдің жалғыз нақты дереккөзі.
        </p>
        <p className="mt-1">
          <span className="font-semibold text-sky-300">2016–2025:</span> Sentinel-2 Cloudless (EOX, ESA Copernicus, 10 м) —
          жыл сайынғы жазғы мозаика, бұлтсыз.
        </p>
      </div>
    </div>
  );
}
