// Кері траектория: GET ?lat&lng&hours=1..24&at=ISO (2022-01-01 бастап; ескі уақыт — тарихи мұрағат).
// Open-Meteo қолжетімсіз → 503. 📊 модель, әдіс: src/lib/backTrajectory.ts.

import { NextResponse } from "next/server";
import { FACILITIES } from "@/data/facilities";
import { pointInPolygon, ATYRAU_OBLAST } from "@/lib/firms";
import { GRID_N, gridAxes, integrateBack, nearestOnPath, toUV, TRAJECTORY_CAVEATS, type WindField } from "@/lib/backTrajectory";

export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, reason?: string) => NextResponse.json({ error, ...(reason ? { reason } : {}) }, { status, headers: noStore });
const NEAR_KM = 5;
const HISTORY_FROM = Date.UTC(2022, 0, 1);

interface Loc { hourly?: { time?: number[]; wind_speed_10m?: (number | null)[]; wind_direction_10m?: (number | null)[] } }

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const lat = Number(sp.get("lat")), lng = Number(sp.get("lng"));
  const hours = Math.round(Number(sp.get("hours") ?? 12));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !pointInPolygon(lng, lat, ATYRAU_OBLAST)) return fail("Нүкте Атырау облысының ішінде болуы керек", 400);
  if (!(hours >= 1 && hours <= 24)) return fail("Сағат саны 1–24 болуы керек", 400);
  const now = Date.now();
  const atRaw = sp.get("at");
  const arrival = atRaw ? Date.parse(atRaw) : Math.floor(now / 3600_000) * 3600_000;
  if (!Number.isFinite(arrival) || arrival > now || arrival < HISTORY_FROM) return fail("Келу уақыты 2022-01-01 мен қазіргі сәт аралығында болуы керек", 400);

  const { lats, lngs } = gridAxes(lat, lng);
  const pts = lats.flatMap((la) => lngs.map((ln) => [la, ln]));
  // Соңғы 48 сағат — жедел болжам API (past_days); одан ескі — тарихи болжам мұрағаты
  // (historical-forecast-api, сол модельдер, 2022 жылдан). Екеуі де Open-Meteo, кілтсіз.
  const recent = arrival >= now - 48 * 3600_000;
  const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const base = recent ? "https://api.open-meteo.com/v1/forecast" : "https://historical-forecast-api.open-meteo.com/v1/forecast";
  const span = recent ? "&past_days=3&forecast_days=1" : `&start_date=${day(arrival - (hours + 1) * 3600_000)}&end_date=${day(arrival)}`;
  const url = `${base}?latitude=${pts.map((p) => p[0]).join(",")}&longitude=${pts.map((p) => p[1]).join(",")}` +
    `&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timeformat=unixtime&timezone=GMT${span}`;
  let locs: Loc[];
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), next: { revalidate: 1800 } });
    if (!res.ok) return fail("Жел деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", 503, `Open-Meteo ${res.status}`);
    const j = await res.json();
    locs = Array.isArray(j) ? j : [j];
  } catch (e) {
    return fail("Жел деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", 503, e instanceof Error ? e.message : undefined);
  }
  if (locs.length !== GRID_N * GRID_N) return fail("Жел торы толық емес — жалған дерек көрсетілмейді", 503);
  const times = (locs[0].hourly?.time ?? []).map((s) => s * 1000);
  if (!times.length) return fail("Сағаттық жел дерегі жоқ", 503);
  const u: number[][][] = times.map(() => lats.map(() => new Array(GRID_N).fill(NaN)));
  const v: number[][][] = times.map(() => lats.map(() => new Array(GRID_N).fill(NaN)));
  locs.forEach((loc, idx) => {
    const i = Math.floor(idx / GRID_N), jx = idx % GRID_N;
    const sp10 = loc.hourly?.wind_speed_10m ?? [], dir = loc.hourly?.wind_direction_10m ?? [];
    times.forEach((_, k) => {
      if (sp10[k] == null || dir[k] == null) return;
      const [uu, vv] = toUV(sp10[k]!, dir[k]!);
      u[k][i][jx] = uu; v[k][i][jx] = vv;
    });
  });
  const field: WindField = { lats, lngs, times, u, v };
  const { points, truncated } = integrateBack(field, lat, lng, arrival, hours);
  if (points.length < 2) return fail("Жел дерегі жетіспейді — траектория есептелмеді", 503);

  const near = FACILITIES.map((f) => ({ id: f.id, name: f.name, lat: f.lat, lng: f.lng, ...nearestOnPath(points, f.lat, f.lng) }))
    .filter((f) => f.km <= NEAR_KM)
    .sort((a, b) => a.hoursBack - b.hoursBack)
    .map((f) => ({ ...f, km: +f.km.toFixed(1), hoursBack: +f.hoursBack.toFixed(1) }));

  return NextResponse.json({
    tier: "model",
    arrival: new Date(arrival).toISOString(),
    hours, truncated,
    points: points.map((p) => ({ lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), time: new Date(p.t).toISOString(), hoursBack: p.hoursBack })),
    nearFacilities: near, nearKm: NEAR_KM,
    source: recent ? "Open-Meteo Forecast API (10 м жел, best_match модельдер), 9×9 тор ±2°" : "Open-Meteo Historical Forecast API (10 м жел, мұрағатталған best_match болжамдары), 9×9 тор ±2°",
    caveats: TRAJECTORY_CAVEATS,
    fetchedAt: new Date().toISOString(),
  }, { headers: noStore });
}
