"use client";

import { useEffect, useState } from "react";
import type { Site, AnalysisResult } from "@/types/site";
import { useSitesStore } from "@/store/useSitesStore";
import { useRegion } from "@/store/useRegionStore";
import { hasModule } from "@/data/regions";
import type { GreeneryData } from "@/lib/osmGreen";
import type { GreenChangeData } from "@/lib/greenNdvi";

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
  no?: number | null;
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
/** NRT жылу аномалиясы. ⚠️ Расталған өрт емес — `category` арқылы жіктеледі. */
export interface Flare {
  lat: number;
  lng: number;
  brightness: number;
  frp: number;
  confidence: string;
  acqDate: string;
  dayNight: string;
  category: "industrial_flare" | "unconfirmed_anomaly";
  label: { kk: string; ru: string };
  facilityId: string | null;
  facilityName: string | null;
  distanceToFootprintKm: number | null;
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
  // Модель деректі қашан жүктегені (CAMS сервері fetchedAt қайтарады)
  const [airFetchedAt, setAirFetchedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/airgrid?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setAirGrid(d.grid);
        setAirDominant(d.dominant ?? null);
        setAirFetchedAt(d.fetchedAt ?? null);
      })
      .catch(() => setAirError(true))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { airGrid, airDominant, airError, airFetchedAt };
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
  /** Атмосфералық орнықтылық — конустың пішінін белгілейді */
  stability: {
    cls: "A" | "B" | "C" | "D" | "E" | "F";
    label: string;
    note: string;
    windDirSigma: number;
    coneAngle: { total: number; physical: number; wind: number };
    plumeLengthKm: number;
  };
  /** Жел өрісі тор бойынша қаншалық жергілікті */
  windField: { localPoints: number; totalReceptors: number; note: string };
  /** ⚠️ Режим: тірі ме, әлде архивтен алынған өткен сағат па.
   *  Архивте «алдағы 24 сағат» — БОЛЖАМ ЕМЕС, өлшенген дерек. */
  mode: "live" | "archive";
  at: string | null;
  atLabel: string | null;
  daysAgo: number;
  maxDaysBack: number;
  archiveNote: string | null;
  /** Сағаттық хронология — оқиға желісі */
  timeline: PollutionTimelineHour[];
  sources: string[];
  method: string;
  note: string;
}

export type ComplianceLevelLite =
  | "ok" | "approaching" | "exceeded" | "exceeded-unverified" | "not-comparable" | "unknown";

export interface PollutionTimelineHour {
  time: string;
  hour: string;
  past: boolean;
  pivot: boolean;
  wind: { fromLabel: string; toBearing: number; speed: number };
  /** Сол сағаттағы конус ішіндегі елді мекендер (өлшем емес — бағыт) */
  downwind: string[];
  so2: number | null;
  no2: number | null;
  pm: number | null;
  pm25: number | null;
  ozone: number | null;
  co: number | null;
  /** Гигиеналық нормасы ЖОҚ — тек өлшем (PM₁₀ асуын ажыратуға көмектеседі) */
  dust: number | null;
  /** Гигиеналық нормасы ЖОҚ — мұнай-газ ағуының белгісі */
  ch4: number | null;
  levels: {
    so2: ComplianceLevelLite; no2: ComplianceLevelLite; pm: ComplianceLevelLite;
    pm25: ComplianceLevelLite; ozone: ComplianceLevelLite; co: ComplianceLevelLite;
  };
  kzViolation: boolean;
}
/**
 * Ластану көзі.
 *
 * `at` берілсе — АРХИВ режимі (өткен нақты сағат, «2026-08-14T15:00»).
 * Берілмесе — тірі режим. Кілт `region + at` болғандықтан, уақыт
 * ауысқанда дерек қайта сұралады, ал бір уақыт екі рет сұралмайды.
 */
export function usePollutionSource(enabled: boolean, at?: string | null) {
  const region = useRegion();
  // Тізілімсіз аймақта модуль мүлдем жоқ — сұраныс та жіберілмейді
  const missing = !hasModule(region, "pollutionSource");
  const key = `${region.id}:${at ?? "live"}`;
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [source, setSource] = useState<PollutionSourceData | null>(null);
  const [sourceError, setSourceError] = useState<{ error: string; detail?: string } | null>(null);
  const sourceLoading = enabled && !missing && loadedFor !== key;
  useEffect(() => {
    if (!enabled || missing || loadedFor === key) return;
    const q = `region=${region.id}${at ? `&at=${encodeURIComponent(at)}` : ""}`;
    fetch(`/api/pollution-source?${q}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && !d.error) { setSource(d); setSourceError(null); }
        // Жалған дерек көрсетілмейді — себебі сақталады да, UI-де жазылады
        else { setSource(null); setSourceError({ error: d.error ?? "Дерек алынбады", detail: d.detail }); }
      })
      .catch(() => setSourceError({ error: "Тірі ауа/жел деректері уақытша қолжетімсіз" }))
      .finally(() => setLoadedFor(key));
  }, [enabled, missing, loadedFor, key, region.id, at]);
  return { source, sourceError, sourceMissing: missing, sourceLoading };
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

// NRT жылу аномалиялары (NASA FIRMS) — расталған өрт емес
export function useFlares(enabled: boolean) {
  const region = useRegion();
  // Қай аймақ үшін жүктелді — аймақ ауысса қайта сұралады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [flares, setFlares] = useState<Flare[] | null>(null);
  const [flaresError, setFlaresError] = useState<string | null>(null);
  // 503 себебі (`reason`) — бөлек сақталады, `flaresError` жолы өзгермейді
  // (MapView оны нақты мәтінмен салыстырады)
  const [flaresReason, setFlaresReason] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/flares?region=${region.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) setFlares(d.flares ?? []);
        else {
          setFlaresError(d.error ?? "Қолжетімсіз");
          setFlaresReason(typeof d.reason === "string" ? d.reason : null);
        }
      })
      .catch(() => setFlaresError("Қолжетімсіз"))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { flares, flaresError, flaresReason };
}

// FIRMS архиві (P4.4) — Атырау бойынша 365 күн. Уақыт сүзгісі клиентте
// (туынды мән), сондықтан бір сұраныс барлық пресетті қамтиды.
// ⚠️ Жылу аномалиясы — расталған өрт емес. 503 → себебі `error.reason` ішінде.
export interface FireArchiveAnomaly {
  lat: number;
  lng: number;
  frp: number;
  brightness: number;
  confidence: string;
  acqDate: string;
  dayNight: string;
  category: "industrial_flare" | "unconfirmed_anomaly";
  label: { kk: string; ru: string };
  facilityId: string | null;
  facilityName: string | null;
  distanceToFootprintKm: number | null;
}
export interface FireArchive {
  fetchedAt: string;
  source: string;
  days: number;
  window: { from: string; to: string };
  complete: boolean;
  failedWindows: { date: string; reason: string }[];
  windowCount: number;
  count: number;
  byCategory: { industrial_flare: number; unconfirmed_anomaly: number };
  disclaimer: { kk: string; ru: string };
  anomalies: FireArchiveAnomaly[];
}
export interface FireArchiveError {
  error: string;
  reason?: string;
}

export function useFireArchive(enabled: boolean) {
  const region = useRegion();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [archive, setArchive] = useState<FireArchive | null>(null);
  const [archiveError, setArchiveError] = useState<FireArchiveError | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/fire-archive?region=${region.id}&days=365`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setArchive(d as FireArchive);
          setArchiveError(null);
        } else {
          setArchive(null);
          setArchiveError({ error: d.error ?? "Қолжетімсіз", reason: d.reason });
        }
      })
      .catch(() => setArchiveError({ error: "Қолжетімсіз" }))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { archive, archiveError };
}

// Қамыс мекені (Sentinel-2 NDVI проксиі) — бақылау терезелері бойынша.
// ⚠️ Қамыс картасы емес. 503 → себебі (`error` + бар болса `reason`), мок жоқ.
export interface ReedHabitatZone {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  denseFraction: number | null;
  suitability: number | null;
  observedDate: string | null;
  usableDates: number;
  status: "ok" | "no-data";
}
export interface ReedHabitatError {
  error: string;
  reason?: string;
}

export function useReedHabitat(enabled: boolean) {
  const region = useRegion();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [reed, setReed] = useState<ReedHabitatZone[] | null>(null);
  const [reedError, setReedError] = useState<ReedHabitatError | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    fetch(`/api/reed-habitat?region=${region.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok && d.available !== false) {
          setReed((d.zones ?? []) as ReedHabitatZone[]);
          setReedError(null);
        } else {
          setReed(null);
          setReedError({ error: d.error ?? "Қолжетімсіз", reason: d.reason });
        }
      })
      .catch(() => setReedError({ error: "Қолжетімсіз" }))
      .finally(() => setLoadedFor(region.id));
  }, [enabled, loadedFor, region.id]);
  return { reed, reedError };
}

// Әр дереккөздің күйі бөлек; аймақ ауысқаннан кейін ескі дерек көрсетілмейді.
function useGreenSource<T>(enabled: boolean, path: string) {
  const region = useRegion();
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ReedHabitatError | null>(null);
  useEffect(() => {
    if (!enabled || loadedFor === region.id) return;
    const controller = new AbortController();
    fetch(`${path}?region=${region.id}`, { signal: controller.signal })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (controller.signal.aborted) return;
        if (ok && d.available !== false) { setData(d as T); setError(null); }
        else { setData(null); setError({ error: d.error ?? "Қолжетімсіз", reason: d.reason }); }
        setLoadedFor(region.id);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setData(null);
        setError({ error: "Қолжетімсіз" });
        setLoadedFor(region.id);
      });
    return () => controller.abort();
  }, [enabled, loadedFor, region.id, path]);
  return { data: loadedFor === region.id ? data : null, error: loadedFor === region.id ? error : null };
}

export function useGreenery(enabled: boolean) {
  const { data, error } = useGreenSource<GreeneryData>(enabled, "/api/greenery");
  return { osm: data, osmError: error };
}

export function useGreenChange(enabled: boolean) {
  const { data, error } = useGreenSource<GreenChangeData>(enabled, "/api/green-change");
  return { change: data, changeError: error };
}

export type LanduseData = import("@/lib/osmLanduse").LanduseSummary & {
  features: GeoJSON.FeatureCollection<GeoJSON.Geometry, { category: import("@/lib/osmLanduse").LanduseCategory; name: string | null }>;
  fetchedAt: string; stale: boolean; ageHours?: number; source: string; attribution: string;
  label: string; quality: string; caveats: string[];
  confirmedContamination: { available: false; reason: string };
};

export function useLanduse(enabled: boolean) {
  const { data, error } = useGreenSource<LanduseData>(enabled, "/api/landuse");
  return { landuse: data, landuseError: error };
}

export function useFauna(enabled: boolean) {
  const { data, error } = useGreenSource<import("@/components/map/NaturePanel").FaunaData>(enabled, "/api/fauna");
  return { fauna: data, faunaError: error };
}
