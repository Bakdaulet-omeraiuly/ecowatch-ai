import { NextResponse } from "next/server";
import { GREEN_CITY_BBOX, OSM_CAVEATS } from "@/data/greenery";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { buildGreenQuery, fetchOverpass, parseGreen, OSM_ATTRIBUTION, OSM_LICENSE, OSM_LICENSE_URL, type GreeneryData } from "@/lib/osmGreen";

export const revalidate = 86400;
export const maxDuration = 60;
const cache = new Map<string, { at: number; data: GreeneryData }>();
const headers = { "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "greenery")) return NextResponse.json(moduleUnavailable(region, "greenery"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < revalidate * 1000) return NextResponse.json(hit.data, { headers });
  try {
    const { json, endpoint } = await fetchOverpass(buildGreenQuery(GREEN_CITY_BBOX[region.id]));
    const data: GreeneryData = {
      ...parseGreen(json), fetchedAt: new Date().toISOString(), endpoint, stale: false,
      source: "OpenStreetMap · Overpass API", attribution: OSM_ATTRIBUTION,
      license: OSM_LICENSE, licenseUrl: OSM_LICENSE_URL, // ODbL 1.0
      label: "OSM картографиясы", quality: "толықтығы тексерілмеген", caveats: OSM_CAVEATS,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data, { headers });
  } catch (err) {
    console.error("greenery:", err);
    if (hit) return NextResponse.json({ ...hit.data, stale: true, ageHours: (Date.now() - hit.at) / 3600_000 }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({
      error: "OSM көгалдандыру деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді",
      reason: "Overpass серверлері жауап бермеді",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
