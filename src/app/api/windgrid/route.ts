import { NextResponse } from "next/server";
import { regionPoints } from "@/lib/regionGrid";
import { buildWindGrid, buildWindHourly, type WindCurrent, type WindHourlyUpstream } from "@/lib/windGrid";

// Атырау бойынша жел бағыты мен жылдамдығы торы — карта «Жел» қабаты үшін.
// Дереккөз: Open-Meteo (тегін, кілтсіз) — нақты ауа райы моделі.
//
// ⚠️ Дерек жоқ нүкте — `speed: null`, НӨЛ ЕМЕС (P1.10). Бірде-бір жарамды
// жылдамдық болмаса — 503 және кэшке салынбайды (келесі сұраныс қайта көреді).
//
// P2.3: `hourly` — өткен 24 сағат (kind "past") және алдағы 24 сағат
// (kind "forecast"). Сағаттық дерек жоқ болса — бүкіл жауап 503 (reason-мен),
// ешқашан нөлмен толтырылмайды.

export const revalidate = 3600;

type Upstream = WindHourlyUpstream & { current?: WindCurrent & { time?: string | null } | null };

const SRC_URL = (points: { lat: number; lng: number }[]) => `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${points.map((p) => p.lat).join(",")}` +
  `&longitude=${points.map((p) => p.lng).join(",")}` +
  `&current=wind_speed_10m,wind_direction_10m&hourly=wind_speed_10m,wind_direction_10m` +
  `&past_days=1&forecast_days=2&timezone=auto`;

const cache = new Map<string, { at: number; data: unknown }>();

function fail(reason: string) {
  console.error("Windgrid error:", reason);
  return NextResponse.json(
    { error: "Жел деректері уақытша қолжетімсіз. Дереккөз: Open-Meteo.", reason },
    { status: 503 }
  );
}

export async function GET(req: Request) {
  const { region, points } = regionPoints(new URL(req.url).searchParams.get("region"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < 3600_000) return NextResponse.json(hit.data);
  try {
    const res = await fetch(SRC_URL(points), { next: { revalidate: 3600 } });
    if (!res.ok) return fail(`upstream ${res.status}`);
    const arr = await res.json();
    const list = (Array.isArray(arr) ? arr : [arr]) as Upstream[];
    // Дерек жоқ нүкте — null; жиынтық тек жарамды нүктелер бойынша (P1.10)
    const summary = buildWindGrid(list, points);
    if (summary.validCount === 0) {
      // Бірде-бір жарамды жылдамдық жоқ — жалған «0 м/с» көрсетпейміз, кэштемейміз
      return fail("no valid wind speed in upstream response");
    }
    const hourly = buildWindHourly(list);
    if (!hourly) return fail("no hourly time reference in upstream response");
    if (hourly.past.length + hourly.forecast.length === 0) return fail("empty hourly series");
    const hasHourlySpeed = [...hourly.past, ...hourly.forecast].some((p) => p.avgSpeed != null);
    if (!hasHourlySpeed) return fail("no valid hourly wind speed");

    const data = {
      fetchedAt: new Date().toISOString(),
      source: "Open-Meteo (ECMWF) — нақты жел моделі",
      ...summary,
      // Әр нүктеде: kind = "past" (өткен) | "forecast" (болжам)
      hourly,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data);
  } catch (err) {
    console.error("Windgrid error:", err);
    return fail(err instanceof Error ? err.message : "fetch failed");
  }
}
