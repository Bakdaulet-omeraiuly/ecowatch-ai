import { NextResponse } from "next/server";
import { GREEN_CITY_BBOX } from "@/data/greenery";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { fetchOverpass, OSM_ATTRIBUTION, OSM_LICENSE, OSM_LICENSE_URL } from "@/lib/osmGreen";
import { buildLanduseQuery, LANDUSE_CAVEATS, parseLanduse } from "@/lib/osmLanduse";

// P4.3 land use (OSM). Only complete Overpass answers are cached; on failure a
// previous copy is served marked stale, otherwise 503 — never an empty "nothing here" map.
export const revalidate = 86400;
export const maxDuration = 60;
type Data = ReturnType<typeof parseLanduse> & Record<string, unknown>;
const cache = new Map<string, { at: number; data: Data }>();
const headers = { "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800" };

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "greenery")) return NextResponse.json(moduleUnavailable(region, "greenery"));
  const hit = cache.get(region.id);
  if (hit && Date.now() - hit.at < revalidate * 1000) return NextResponse.json(hit.data, { headers });
  try {
    const { json, endpoint } = await fetchOverpass(buildLanduseQuery(GREEN_CITY_BBOX[region.id]));
    const data: Data = {
      ...parseLanduse(json), fetchedAt: new Date().toISOString(), endpoint, stale: false,
      source: "OpenStreetMap · Overpass API", attribution: OSM_ATTRIBUTION,
      license: OSM_LICENSE, licenseUrl: OSM_LICENSE_URL,
      label: "OSM картографиясы", quality: "толықтығы тексерілмеген",
      confirmedContamination: { available: false, reason: "Ресми ластанған жерлер тізілімі жалғанбаған — дерек жоқ" },
      caveats: LANDUSE_CAVEATS,
    };
    cache.set(region.id, { at: Date.now(), data });
    return NextResponse.json(data, { headers });
  } catch (err) {
    console.error("landuse:", err);
    if (hit) return NextResponse.json({ ...hit.data, stale: true, ageHours: (Date.now() - hit.at) / 3600_000 }, { headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({
      error: "OSM жер пайдалану деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді",
      reason: "Overpass серверлері жауап бермеді",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
