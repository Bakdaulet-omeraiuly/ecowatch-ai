"use client";

import { useEffect, useState } from "react";
import type { Site, AnalysisResult } from "@/types/site";
import { useSitesStore } from "@/store/useSitesStore";
import { useRegion } from "@/store/useRegionStore";
import { hasModule } from "@/data/regions";

// Data types for the live eco-layers
export interface AirGridPoint {
  lat: number;
  lng: number;
  aqi: number | null;
  pm2_5: number | null;
  pm10: number | null;
  no2?: number | null;
  so2?: number | null;
  ozone?: number | null;
  dust?: number | null;
  ch4?: number | null;
  co?: number | null;
  nh3?: number | null;
  aod?: number | null;
  uv?: number | null;
  dense?: boolean;
  name?: string;
  hourly?: { time: string; aqi: number | null }[];
}
export interface Dominant {
  key: string;
  label: string;
  source: string;
  value: number;
}
export interface Flare {
  lat: number;
  lng: number;
  brightness: number;
  frp: number;
  confidence: string;
  acqDate: string;
  dayNight: string;
}
export interface FloodPoint {
  lat: number;
  lng: number;
  name: string;
  discharge: number;
  ratio: number;
  level: string;
  color: string;
  trend: string;
}
export interface SoilPoint {
  lat: number;
  lng: number;
  soilMoisture: number;
  soilTemp: number;
  rain30: number;
  stress: number;
}
export interface MosquitoDay {
  date: string;
  index: number;
  temp: number;
  rainMm: number;
}
export interface FloodSignal {
  available: boolean;
  value: number | null;
  source: "sar+glofas" | "sar" | "glofas" | null;
  sarZonesOk: number;
  sarPctMax: number | null;
  glofasRatio: number | null;
  /** Су кемінде қанша күн тұрды — ең ұзағы (SAR өлшемі) */
  hydroperiodDaysMax: number | null;
  /** Қамыс мекені өлшенген терезелер саны және ең тығызы (S2 NDVI) */
  reedZonesOk: number;
  reedMax: number | null;
  note: string;
}
export interface MosquitoDynamics {
  available: boolean;
  pointsWithOde: number;
  pointsTotal: number;
  emergencePeak: { date: string; value: number } | null;
  note: string;
}
export interface MosquitoGridPoint {
  lat: number;
  lng: number;
  index: number;
  /** Су басуға бейімділік (география) — тұрақты */
  floodSusceptibility?: number;
  /** Өлшенген тасқын импульсі (Sentinel-1 + GloFAS) — уақытпен өзгереді */
  floodPulse?: number | null;
  /** Су кемінде қанша күн тұрды (SAR). null — өлшенбеген */
  hydroperiodDays?: number | null;
  /** Қамыс мекені 0..1 (S2 NDVI). null — өлшенбеген */
  reedHabitat?: number | null;
  temperature: number;
  humidity: number;
  weekRainMm: number;
  days?: MosquitoDay[];
  hours?: { time: string; index: number; temp: number; past?: boolean }[];
  /** `hours` ішіндегі «қазір» индексі — өткен/алдағы шекарасы */
  nowIndex?: number;
  dense?: boolean;
  name?: string;
}

// Shared citizen reports from Supabase — fetched once, visible to everyone
export function useSharedReports(): Site[] {
  const [reports, setReports] = useState<Site[]>([]);
  const deletedReportIds = useSitesStore((s) => s.deletedReportIds);
  useEffect(() => {
    fetch("/api/reports")
      .then((r) => r.json())
      .then((d) => {
        const rows = (d.reports ?? []) as Array<{
          id: string; lat: number; lng: number; name: string | null; district: string | null;
          risk_score: number; mosquito_index: number; analysis: AnalysisResult;
          image_url: string | null; photo_thumb: string | null; created_at: string;
        }>;
        setReports(
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
  return reports.filter((r) => !deletedReportIds.includes(r.id));
}

// Air quality grid (Copernicus CAMS) — fetched on first activation
export function useAirGrid(enabled: boolean) {
  const region = useRegion();
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [airGrid, setAirGrid] = useState<AirGridPoint[] | null>(null);
  const [airDominant, setAirDominant] = useState<Dominant | null>(null);
  const [airError, setAirError] = useState(false);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/airgrid?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setAirGrid(d.grid);
        setAirDominant(d.dominant ?? null);
      })
      .catch(() => setAirError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { airGrid, airDominant, airError };
}

// Mosquito climate-suitability grid (Open-Meteo)
export function useMosquitoGrid(enabled: boolean) {
  const region = useRegion();
  // JAIYQ-MRI тізілімі жоқ аймақта — сұраныс жіберілмейді
  const missing = !hasModule(region, "mosquito");
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [mosGrid, setMosGrid] = useState<MosquitoGridPoint[] | null>(null);
  const [mosFlood, setMosFlood] = useState<FloodSignal | null>(null);
  const [mosDyn, setMosDyn] = useState<MosquitoDynamics | null>(null);
  const [mosError, setMosError] = useState(false);
  useEffect(() => {
    if (!enabled || missing || loadedFor === region.id) return;
    fetch(`/api/mosquitogrid?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setMosGrid(d.grid);
        setMosFlood(d.floodSignal ?? null);
        setMosDyn(d.dynamics ?? null);
      })
      .catch(() => setMosError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, missing, loadedFor, region.id]);
  return { mosGrid, mosFlood, mosDyn, mosError, mosMissing: missing };
}

// Pollution Source Detection (CAMS + жел → ықтимал өнеркәсіп көзі)
export interface PollutionSourceCandidate {
  id: string; name: string; short: string; lat: number; lng: number;
  confidence: number; distanceKm: number; bearingFromCity: number; approx?: boolean;
}
export interface PollutionFrame {
  time: string; hour: string; fromLabel: string; toBearing: number;
  speed: number; cone: [number, number][];
}
export interface PollutionSourceData {
  detected: boolean;
  pollutant: string;
  pollutantLabel: string;
  signalStrength: number;
  wind: { fromBearing: number; fromLabel: string; speed: number; toBearing: number };
  candidates: PollutionSourceCandidate[];
  top: PollutionSourceCandidate | null;
  plume: { name: string; lat: number; lng: number; relConc: number }[];
  cone: [number, number][];
  frames: PollutionFrame[];
  forecastFrames: PollutionFrame[];
  forecast: { label: string; hoursAhead: number; lat: number; lng: number; radiusKm: number; reached: string[] }[];
  stations: { lat: number; lng: number; aqi: number; name?: string }[];
  groundStations: number;
  note: string;
}
export function usePollutionSource(enabled: boolean) {
  const region = useRegion();
  // Тізілімсіз аймақта модуль мүлдем жоқ — сұраныс та жіберілмейді
  const missing = !hasModule(region, "pollutionSource");
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [source, setSource] = useState<PollutionSourceData | null>(null);
  const [sourceError, setSourceError] = useState(false);
  useEffect(() => {
    if (!enabled || missing || loadedFor === region.id) return;
    fetch(`/api/pollution-source?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => (d.error ? setSourceError(true) : setSource(d)))
      .catch(() => setSourceError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, missing, loadedFor, region.id]);
  return { source, sourceError, sourceMissing: missing };
}

// Soil dryness / land-degradation grid (Open-Meteo ECMWF)
export function useSoilGrid(enabled: boolean) {
  const region = useRegion();
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [soilGrid, setSoilGrid] = useState<SoilPoint[] | null>(null);
  const [soilMeta, setSoilMeta] = useState<{ avgStress: number; avgMoisture: number } | null>(null);
  const [soilError, setSoilError] = useState(false);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/soilgrid?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setSoilGrid(d.grid);
        setSoilMeta({ avgStress: d.avgStress, avgMoisture: d.avgMoisture });
      })
      .catch(() => setSoilError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { soilGrid, soilMeta, soilError };
}

// Zhaiyk river discharge / flood risk (GloFAS)
export function useFlood(enabled: boolean) {
  const region = useRegion();
  // Өзен нүктелерінің тізілімі жоқ аймақта — сұраныс жіберілмейді
  const missing = !hasModule(region, "riverFlow");
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [flood, setFlood] = useState<FloodPoint[] | null>(null);
  const [river, setRiver] = useState<string | null>(null);
  const [floodError, setFloodError] = useState(false);
  useEffect(() => {
    if (!enabled || missing || loadedFor === region.id) return;
    fetch(`/api/flood?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setFlood(d.points ?? []);
        setRiver(d.river ?? null);
      })
      .catch(() => setFloodError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, missing, loadedFor, region.id]);
  return { flood, river, floodError, floodMissing: missing };
}

// Gas-flare detections (NASA FIRMS)
export function useFlares(enabled: boolean) {
  const region = useRegion();
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [flares, setFlares] = useState<Flare[] | null>(null);
  const [flaresError, setFlaresError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/flares?region=${region.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setFlares(d.flares ?? []);
        else setFlaresError(d.error ?? "Қолжетімсіз");
      })
      .catch(() => setFlaresError("Қолжетімсіз"))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { flares, flaresError };
}
