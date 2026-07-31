import { NextResponse } from "next/server";
import { attributePollution, type Receptor, type WindHour, type Station } from "@/lib/pollutionSource";

// Нақты жердегі стансалар (Qazhydromet — WAQI/aqicn желісі). Токен болса ғана.
// Атырау облысының шектелген аймағындағы барлық постты тартады.
async function fetchStations(): Promise<Station[]> {
  const token = process.env.WAQI_TOKEN;
  if (!token) return [];
  // Timeout: WAQI баяу болса да негізгі жауапты бөгемейді (3.5с)
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(
      `https://api.waqi.info/map/bounds/?latlng=46.0,49.2,48.8,54.8&token=${token}`,
      { next: { revalidate: 900 }, signal: ctrl.signal }
    );
    if (!res.ok) return [];
    const j = await res.json();
    if (j.status !== "ok" || !Array.isArray(j.data)) return [];
    return j.data
      .map((s: { lat: number; lon: number; aqi: string; station?: { name?: string } }) => ({
        lat: s.lat,
        lng: s.lon,
        aqi: parseInt(s.aqi, 10),
        name: s.station?.name,
      }))
      .filter((s: Station) => Number.isFinite(s.aqi)); // "-" (дерексіз) постты алып тастау
  } catch (err) {
    console.error("WAQI stations error:", err);
    return []; // қате/timeout → станссыз жалғасады (қабат бос қалмайды)
  } finally {
    clearTimeout(timer);
  }
}

// Ластану көзін анықтау (Pollution Source Detection).
// Тірі деректер: Copernicus CAMS (SO₂/NO₂/PM) + Open-Meteo (жел бағыты/жылдамдығы).
// Ешбір дерек ойдан жасалмайды — дереккөз қолжетімсіз болса, қате қайтарамыз.

export const revalidate = 1800; // 30 мин

// CAMS қабылдағыш торы (қаланы қоршаған нүктелер)
const LATS = [46.6, 47.0, 47.11, 47.4, 47.8];
const LNGS = [51.2, 51.6, 51.9, 52.3, 52.8];
const gridPoints: { lat: number; lng: number }[] = [];
for (const lat of LATS) for (const lng of LNGS) gridPoints.push({ lat, lng });

const CITY = { lat: 47.11, lng: 51.9 };

const AIR_GRID_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality` +
  `?latitude=${gridPoints.map((p) => p.lat).join(",")}` +
  `&longitude=${gridPoints.map((p) => p.lng).join(",")}` +
  `&current=sulphur_dioxide,nitrogen_dioxide,pm10`;

const WIND_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lng}` +
  `&current=wind_speed_10m,wind_direction_10m` +
  `&hourly=wind_speed_10m,wind_direction_10m&past_days=2&forecast_days=2&timezone=auto`;

const CITY_AIR_URL =
  `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CITY.lat}&longitude=${CITY.lng}` +
  `&hourly=sulphur_dioxide,nitrogen_dioxide,pm10&past_days=2&forecast_days=0&timezone=auto`;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 1800_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const [gRes, wRes, aRes, stations] = await Promise.all([
      fetch(AIR_GRID_URL, { next: { revalidate: 1800 } }),
      fetch(WIND_URL, { next: { revalidate: 1800 } }),
      fetch(CITY_AIR_URL, { next: { revalidate: 1800 } }),
      fetchStations(), // параллель — негізгі жауапты бөгемейді
    ]);
    if (!gRes.ok || !wRes.ok || !aRes.ok) {
      throw new Error(`upstream ${gRes.status}/${wRes.status}/${aRes.status}`);
    }
    const gArr = await gRes.json();
    const wind = await wRes.json();
    const cityAir = await aRes.json();

    // 1) Қабылдағыш торы
    const gList = Array.isArray(gArr) ? gArr : [gArr];
    const receptors: Receptor[] = gList.map(
      (d: {
        latitude: number;
        longitude: number;
        current?: { sulphur_dioxide?: number; nitrogen_dioxide?: number; pm10?: number };
      }) => ({
        lat: d.latitude,
        lng: d.longitude,
        so2: d.current?.sulphur_dioxide ?? null,
        no2: d.current?.nitrogen_dioxide ?? null,
        pm: d.current?.pm10 ?? null,
      })
    );

    // 2) Ағымдағы жел
    const windNow = {
      fromBearing: wind.current?.wind_direction_10m ?? 0,
      speed: wind.current?.wind_speed_10m ?? 0,
    };

    // 3) Уақыттық тарих (жел + қалалық концентрация сағат бойынша сәйкестендіру)
    const wTimes: string[] = wind.hourly?.time ?? [];
    const wSpeed: (number | null)[] = wind.hourly?.wind_speed_10m ?? [];
    const wDir: (number | null)[] = wind.hourly?.wind_direction_10m ?? [];
    const aTimes: string[] = cityAir.hourly?.time ?? [];
    const aSo2: (number | null)[] = cityAir.hourly?.sulphur_dioxide ?? [];
    const aNo2: (number | null)[] = cityAir.hourly?.nitrogen_dioxide ?? [];
    const aPm: (number | null)[] = cityAir.hourly?.pm10 ?? [];
    const airIdx = new Map<string, number>();
    aTimes.forEach((t, i) => airIdx.set(t, i));

    // Өткен/болжам шекарасы — қазіргі уақыт.
    // Open-Meteo timezone=auto → жергілікті уақыт (офсетсіз). Дұрыс салыстыру
    // үшін «қазірді» сол жергілікті уақытқа ауыстырамыз (utc_offset_seconds).
    const offsetMs = (wind.utc_offset_seconds ?? 0) * 1000;
    const nowLocal = Date.now() + offsetMs;
    const windHistory: WindHour[] = [];
    const forecastWind: { fromBearing: number; speed: number; time: string }[] = [];
    for (let i = 0; i < wTimes.length; i++) {
      if (wDir[i] == null) continue;
      const tMs = new Date(wTimes[i]).getTime();
      if (tMs > nowLocal) {
        // Болжам: алдағы 24 сағат желі (алдағы 24сағ анимация + dispersion forecast)
        if (forecastWind.length < 24) forecastWind.push({ fromBearing: wDir[i]!, speed: wSpeed[i] ?? 0, time: wTimes[i] });
        continue;
      }
      const ai = airIdx.get(wTimes[i]);
      windHistory.push({
        fromBearing: wDir[i]!,
        speed: wSpeed[i] ?? 0,
        so2: ai != null ? aSo2[ai] ?? null : null,
        no2: ai != null ? aNo2[ai] ?? null : null,
        pm: ai != null ? aPm[ai] ?? null : null,
        time: wTimes[i],
      });
    }


    const result = attributePollution(receptors, windNow, windHistory, stations, forecastWind);

    const data = {
      fetchedAt: new Date().toISOString(),
      sources: [
        "Copernicus CAMS (SO₂/NO₂/PM) — Open-Meteo Air Quality API",
        "Open-Meteo (жел бағыты/жылдамдығы)",
        stations.length ? "Qazhydromet жердегі стансалары (WAQI)" : "Ашық өнеркәсіптік координаттар",
      ],
      ...result,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Pollution source error:", err);
    return NextResponse.json(
      { error: "Тірі ауа/жел деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді." },
      { status: 503 }
    );
  }
}
