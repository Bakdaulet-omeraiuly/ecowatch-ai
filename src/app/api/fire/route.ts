import { NextResponse } from "next/server";
import { getRegion } from "@/data/regions";
import {
  computeFwiSeries,
  fireDangerClass,
  FIRE_DANGER_KZ,
  FIRE_DANGER_COLOR,
  type DayWeather,
} from "@/lib/fwi";

// Атырау бойынша нақты Fire Weather Index (Канада FWI жүйесі, EFFIS әдістемесі).
// Дереккөз: Open-Meteo (тегін, кілтсіз) — соңғы 92 күннің түскі ауа райы.
// Жалған дерек жоқ: API қолжетімсіз болса, қате қайтарылады.

export const revalidate = 3600;


// Spin-up: 92 күн тарих (Open-Meteo forecast API-ының шегі) + түскі (12:00) мәндер.
// Неге 21 емес: құрғақшылық коды (DC) өте баяу өзгереді (уақыт тұрақтысы
// ~52 күн). 21 күндік жүгірісте DC бастапқы шартты мәннен (15) алыстап
// үлгермейді, сондықтан ұзақ құрғақ жазда BUI мен FWI кем бағаланатын.
const SRC_URL = (LAT: number, LNG: number) => `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
  `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation` +
  `&past_days=92&forecast_days=1&timezone=auto`;

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  const LAT = region.lat;
  const LNG = region.lng;
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) {
    return NextResponse.json(hit.data);
  }
  try {
    const res = await fetch(SRC_URL(LAT, LNG), { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const j = await res.json();

    const time: string[] = j.hourly?.time ?? [];
    const temp: (number | null)[] = j.hourly?.temperature_2m ?? [];
    const rh: (number | null)[] = j.hourly?.relative_humidity_2m ?? [];
    const wind: (number | null)[] = j.hourly?.wind_speed_10m ?? [];
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
    let skippedDays = 0;
    for (const [, b] of byDay) {
      if (b.noon == null) continue; // түскі мән жоқ күнді өткіземіз
      const t = temp[b.noon], h = rh[b.noon], w = wind[b.noon];
      // Мәні жоқ күнге «орташа» ауа райы ойдан қойылмайды — күн өткізіледі.
      if (t == null || h == null || w == null) { skippedDays += 1; continue; }
      days.push({
        temp: t,
        rh: Math.min(100, Math.max(1, h)),
        wind: w,
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
      skippedDays,
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
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Fire FWI error:", err);
    return NextResponse.json(
      { error: "Өрт қаупі деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo." },
      { status: 503 }
    );
  }
}
