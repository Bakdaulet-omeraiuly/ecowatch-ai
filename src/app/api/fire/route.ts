import { NextResponse } from "next/server";
import {
  computeFwiSeries,
  fireDangerClass,
  FIRE_DANGER_KZ,
  FIRE_DANGER_COLOR,
  type DayWeather,
} from "@/lib/fwi";

// Атырау бойынша нақты Fire Weather Index (Канада FWI жүйесі, EFFIS әдістемесі).
// Дереккөз: Open-Meteo (тегін, кілтсіз) — соңғы ~21 күннің түскі ауа райы.
// Жалған дерек жоқ: API қолжетімсіз болса, қате қайтарылады.

export const revalidate = 3600;

const LAT = 47.1167;
const LNG = 51.8833; // Атырау қаласы

// Spin-up үшін 21 күн тарих + түскі (12:00) мәндерді алу
const URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
  `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
  `&past_days=21&forecast_days=1&timezone=auto`;

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const j = await res.json();

    const time: string[] = j.hourly?.time ?? [];
    const temp: number[] = j.hourly?.temperature_2m ?? [];
    const rh: number[] = j.hourly?.relative_humidity_2m ?? [];
    const wind: number[] = j.hourly?.wind_speed_10m ?? [];
    const precip: number[] = j.hourly?.precipitation ?? [];
    if (!time.length) throw new Error("деректер бос");

    // Күндерге топтап, түскі (12:00) мәнді + тәуліктік жауын-шашынды жинаймыз
    const byDay = new Map<string, { noon?: number; rainSum: number; month: number }>();
    time.forEach((t, i) => {
      const day = t.slice(0, 10);
      const hour = Number(t.slice(11, 13));
      if (!byDay.has(day)) byDay.set(day, { rainSum: 0, month: new Date(t).getMonth() });
      const b = byDay.get(day)!;
      b.rainSum += precip[i] ?? 0;
      if (hour === 12) b.noon = i;
    });

    const days: DayWeather[] = [];
    for (const [, b] of byDay) {
      if (b.noon == null) continue; // түскі мән жоқ күнді өткіземіз
      days.push({
        temp: temp[b.noon] ?? 15,
        rh: Math.min(100, Math.max(1, rh[b.noon] ?? 50)),
        wind: wind[b.noon] ?? 5,
        rain: +b.rainSum.toFixed(1),
        month: b.month,
      });
    }
    if (days.length < 2) throw new Error("жеткіліксіз күн");

    const result = computeFwiSeries(days);
    const danger = fireDangerClass(result.fwi);

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo · Канада FWI жүйесі (EFFIS әдістемесі)",
      lat: LAT,
      lng: LNG,
      spinupDays: days.length,
      fwi: +result.fwi.toFixed(1),
      isi: +result.isi.toFixed(1),
      bui: +result.bui.toFixed(1),
      ffmc: +result.ffmc.toFixed(1),
      dmc: +result.dmc.toFixed(1),
      dc: +result.dc.toFixed(1),
      danger,
      dangerLabel: FIRE_DANGER_KZ[danger],
      dangerColor: FIRE_DANGER_COLOR[danger],
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fire FWI error:", err);
    return NextResponse.json(
      { error: "Өрт қаупі деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo." },
      { status: 503 }
    );
  }
}
