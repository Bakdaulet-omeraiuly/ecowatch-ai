// ЖЕРҮСТІ БЕКЕТТЕР — Атырау аумағындағы барлық бақылау бекеттері (WAQI/aqicn агрегаторы арқылы;
// Қазгидромет және басқа желілер). `map/bounds` + `networks=all` — бір нүктеге «ең жақын» сұрау
// (feed/geo) Атырау үшін Бакуді қайтаратын, ал аумақ бойынша сұрау қала ішіндегі бекеттерді көреді.
//
// ⚠️ БІРЛІК: WAQI `iaqi` мәндері — US EPA AQI ішкі индекстері (0–500), µg/m³ ЕМЕС.
// Сондықтан олар ШРК-мен тікелей салыстырылмайды; UI «индекс» деп көрсетеді.
// Токен жоқ/қате → 503, мок жоқ. Шарт: коммерциялық емес қолдану, атрибуция міндетті.

import { NextResponse } from "next/server";
import { GREEN_CITY_BBOX } from "@/data/greenery";

export const revalidate = 900;
const noStore = { "Cache-Control": "no-store" };
const POLS = ["pm25", "pm10", "no2", "so2", "o3", "co"] as const;

interface BoundsItem { uid: number; lat: number; lon: number; aqi: string; station?: { name?: string; time?: string } }

export async function GET() {
  const token = process.env.WAQI_TOKEN;
  if (!token) return NextResponse.json({ error: "WAQI токені бапталмаған — бекет деректері көрсетілмейді" }, { status: 503, headers: noStore });
  const [w, s, e, n] = GREEN_CITY_BBOX.atyrau;
  try {
    const b = await fetch(`https://api.waqi.info/v2/map/bounds?latlng=${s},${w},${n},${e}&networks=all&token=${token}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(15_000) });
    const bj = await b.json() as { status: string; data?: BoundsItem[] | string };
    if (bj.status !== "ok" || !Array.isArray(bj.data)) {
      return NextResponse.json({ error: "WAQI бекеттер тізімі қолжетімсіз — жалған дерек көрсетілмейді", reason: typeof bj.data === "string" ? bj.data : bj.status }, { status: 503, headers: noStore });
    }
    const list = bj.data.filter((x) => Number.isFinite(x.lat) && Number.isFinite(x.lon));
    const posts = await Promise.all(list.slice(0, 40).map(async (x) => {
      try {
        const f = await fetch(`https://api.waqi.info/feed/@${x.uid}/?token=${token}`, { next: { revalidate: 900 }, signal: AbortSignal.timeout(10_000) });
        const fj = await f.json() as { status: string; data?: { iaqi?: Record<string, { v?: number }>; time?: { iso?: string }; attributions?: { name?: string; url?: string }[]; city?: { name?: string } } };
        const d = fj.status === "ok" ? fj.data : undefined;
        const iaqi = Object.fromEntries(POLS.map((p) => [p, typeof d?.iaqi?.[p]?.v === "number" ? d!.iaqi![p]!.v! : null]));
        return {
          uid: x.uid, name: d?.city?.name ?? x.station?.name ?? null, lat: x.lat, lng: x.lon,
          aqi: Number.isFinite(Number(x.aqi)) ? Number(x.aqi) : null,
          time: d?.time?.iso ?? x.station?.time ?? null,
          iaqi, attributions: (d?.attributions ?? []).map((a) => ({ name: a.name ?? null, url: a.url ?? null })),
        };
      } catch {
        return { uid: x.uid, name: x.station?.name ?? null, lat: x.lat, lng: x.lon, aqi: Number.isFinite(Number(x.aqi)) ? Number(x.aqi) : null, time: x.station?.time ?? null, iaqi: null, attributions: [] };
      }
    }));
    return NextResponse.json({
      fetchedAt: new Date().toISOString(), count: posts.length, posts,
      unit: "US EPA AQI ішкі индексі (0–500), µg/m³ емес",
      source: "World Air Quality Index Project (aqicn.org) — бастапқы деректер: бекет иелері (Қазгидромет және т.б.)",
    }, { headers: { "Cache-Control": "s-maxage=900, stale-while-revalidate=1800" } });
  } catch (err) {
    return NextResponse.json({ error: "WAQI уақытша қолжетімсіз — жалған дерек көрсетілмейді", reason: err instanceof Error ? err.message : undefined }, { status: 503, headers: noStore });
  }
}
