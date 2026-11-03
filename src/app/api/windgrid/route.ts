import { NextResponse } from "next/server";
import { regionPoints } from "@/lib/regionGrid";
import { buildWindGrid, type WindCurrent } from "@/lib/windGrid";

// Атырау бойынша жел бағыты мен жылдамдығы торы — карта «Жел» қабаты үшін.
// Дереккөз: Open-Meteo (тегін, кілтсіз) — нақты ауа райы моделі.
//
// ⚠️ Дерек жоқ нүкте — `speed: null`, НӨЛ ЕМЕС (P1.10). Бірде-бір жарамды
// жылдамдық болмаса — 503 және кэшке салынбайды (келесі сұраныс қайта көреді).

export const revalidate = 3600;

const SRC_URL = (points: { lat: number; lng: number }[]) => `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=wind_speed_10m,wind_direction_10m&timezone=auto`;

const cache = new Map<string, { at: number; data: unknown }>();

export async function GET(req: Request) {
  const { region, points } = regionPoints(new URL(req.url).searchParams.get("region"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);
  try {
    const res = await fetch(SRC_URL(points), { next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const arr = await res.json();
    const list = (Array.isArray(arr) ? arr : [arr]) as { current?: WindCurrent | null }[];
    // Дерек жоқ нүкте — null; жиынтық тек жарамды нүктелер бойынша (P1.10)
    const summary = buildWindGrid(list, points);
    if (summary.validCount === 0) {
      // Бірде-бір жарамды жылдамдық жоқ — жалған «0 м/с» көрсетпейміз, кэштемейміз
      throw new Error("no valid wind speed in upstream response");
    }

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (ECMWF) — нақты жел моделі",
      ...summary,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Windgrid error:", err);
    return NextResponse.json({ error: "Жел деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo." }, { status: 503 });
  }
}
