import { NextResponse } from "next/server";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { getRiver, type RiverPoint } from "@/data/riverPoints";

// Live river discharge + flood risk along the river course.
// Source: Open-Meteo Flood API = Copernicus GloFAS global flood model.
// Free, no key. Flood/standing water also drives the mosquito problem.
//
// ⚠️ Аймақтың өзен нүктелері тізілімде болмаса — БАСҚА қаланың ағыны
// көрсетілмейді. «Бұл аймақта жоқ» деп ашық қайтарылады (жалған дерек жоқ).

export const revalidate = 3600;

const SRC_URL = (river: RiverPoint[]) =>
  `https://flood-api.open-meteo.com/v1/flood` +
  `?latitude=${river.map((p) => p.lat).join(",")}` +
  `&longitude=${river.map((p) => p.lng).join(",")}` +
  `&daily=river_discharge&past_days=30&forecast_days=14`;

function riskLevel(ratio: number): { level: string; color: string } {
  if (ratio >= 0.85) return { level: "Жоғары тасқын қаупі", color: "#ef4444" };
  if (ratio >= 0.65) return { level: "Орташа қауіп", color: "#f97316" };
  if (ratio >= 0.4) return { level: "Бақылауда", color: "#eab308" };
  return { level: "Қалыпты", color: "#22c55e" };
}

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  const river = getRiver(region.id);
  if (!hasModule(region, "riverFlow") || !river) {
    return NextResponse.json(moduleUnavailable(region, "riverFlow"));
  }

  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) {
    return NextResponse.json(hit.data);
  }
  try {
    const res = await fetch(SRC_URL(river.points), { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];

    const points = list.map((d: { latitude: number; longitude: number; daily?: { time?: string[]; river_discharge?: (number | null)[] } }, idx: number) => {
      const meta = river.points[idx] ?? { name: "?" };
      const times = d.daily?.time ?? [];
      const disc = (d.daily?.river_discharge ?? []).map((v) => v ?? 0);
      const todayIdx = 30; // past_days=30 puts today at offset 30
      const current = disc[todayIdx] ?? disc[disc.length - 1] ?? 0;
      const windowMax = Math.max(1, ...disc);
      const ratio = current / windowMax;
      // 14-day forecast from today
      const forecast = times.slice(todayIdx).map((t, i) => ({
        date: t,
        discharge: +(disc[todayIdx + i] ?? 0).toFixed(1),
      })).slice(0, 14);
      // trend over next week
      const wk = forecast[Math.min(7, forecast.length - 1)]?.discharge ?? current;
      const trend = wk > current * 1.1 ? "өсуде" : wk < current * 0.9 ? "төмендеуде" : "тұрақты";
      return {
        lat: d.latitude,
        lng: d.longitude,
        name: meta.name,
        discharge: +current.toFixed(1),
        windowMax: +windowMax.toFixed(1),
        ratio: +ratio.toFixed(2),
        ...riskLevel(ratio),
        trend,
        forecast,
      };
    });

    // КҮНДІК ТАСҚЫН ҚАТАРЫ — JAIYQ-MRI моделінің L2 динамикасы үшін.
    //
    // Модель жұмыртқа банкінің жарылуы мен дернәсілдің дамуын УАҚЫТ БОЙЫНША
    // интегралдайды, сондықтан оған бір сан емес, күндік драйвер қатары
    // керек: қай күні су көтерілді, қай күні қайтты.
    //
    // Аймақ бойынша ең жоғары ағын нүктесі алынады — жайылманы басатын
    // импульс сол арнадан келеді.
    const dailyPulse: { date: string; ratio: number }[] = [];
    {
      const first = list[0] as { daily?: { time?: string[] } } | undefined;
      const times: string[] = first?.daily?.time ?? [];
      const series = list.map((d: { daily?: { river_discharge?: (number | null)[] } }) =>
        (d.daily?.river_discharge ?? []).map((v) => v ?? 0)
      );
      const maxima = series.map((arr: number[]) => Math.max(1, ...arr));
      for (let i = 0; i < times.length; i++) {
        // Әр нүктенің өз терезесіне қатысты үлесі, солардың ең жоғарысы
        const r = Math.max(...series.map((arr: number[], k: number) => (arr[i] ?? 0) / maxima[k]));
        dailyPulse.push({ date: times[i], ratio: +Math.min(1, r).toFixed(3) });
      }
    }

    const data = {
      available: true as const,
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo Flood API — Copernicus GloFAS",
      region: { id: region.id, name: region.name },
      river: river.river,
      /** Күндік тасқын импульсі (0..1) — 30 күн өткен + 14 күн болжам */
      dailyPulse,
      points: points.filter((p) => p.discharge > 0.5), // only real river cells
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Flood error:", err);
    return NextResponse.json({ error: "Тірі тасқын деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
