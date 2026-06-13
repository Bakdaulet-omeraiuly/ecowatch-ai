import { NextResponse } from "next/server";

// Live Zhaiyk (Ural) river discharge + flood risk along its course.
// Source: Open-Meteo Flood API = Copernicus GloFAS global flood model.
// Free, no key. Flood/standing water also drives the mosquito problem.

export const revalidate = 3600;

// Points snapped to actual GloFAS river cells along the Zhaiyk (north→south)
const RIVER: { lat: number; lng: number; name: string }[] = [
  { lat: 47.70, lng: 51.50, name: "Жоғары ағыс (Махамбет)" },
  { lat: 47.65, lng: 51.52, name: "Сарайшық маңы" },
  { lat: 47.50, lng: 51.60, name: "Орта ағыс" },
  { lat: 47.1167, lng: 51.8833, name: "Атырау қаласы" },
];

const URL =
  `https://flood-api.open-meteo.com/v1/flood` +
  `?latitude=${RIVER.map((p) => p.lat).join(",")}` +
  `&longitude=${RIVER.map((p) => p.lng).join(",")}` +
  `&daily=river_discharge&past_days=30&forecast_days=14`;

function riskLevel(ratio: number): { level: string; color: string } {
  if (ratio >= 0.85) return { level: "Жоғары тасқын қаупі", color: "#ef4444" };
  if (ratio >= 0.65) return { level: "Орташа қауіп", color: "#f97316" };
  if (ratio >= 0.4) return { level: "Бақылауда", color: "#eab308" };
  return { level: "Қалыпты", color: "#22c55e" };
}

let cache: { at: number; data: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 3600_000) {
    return NextResponse.json(cache.data);
  }
  try {
    const res = await fetch(URL, { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.json();
    const list = Array.isArray(arr) ? arr : [arr];

    const points = list.map((d: { latitude: number; longitude: number; daily?: { time?: string[]; river_discharge?: (number | null)[] } }, idx: number) => {
      const meta = RIVER[idx] ?? { name: "?" };
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

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo Flood API — Copernicus GloFAS",
      points: points.filter((p) => p.discharge > 0.5), // only real river cells
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (err) {
    console.error("Flood error:", err);
    return NextResponse.json({ error: "Тірі тасқын деректері уақытша қолжетімсіз" }, { status: 503 });
  }
}
