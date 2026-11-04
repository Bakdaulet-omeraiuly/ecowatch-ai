import type { FeatureCollection, Geometry } from "geojson";
import type { GreenBbox } from "@/data/greenery";

export const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
export const OSM_LICENSE = "ODbL 1.0";
export const OSM_LICENSE_URL = "https://www.openstreetmap.org/copyright";
export const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

export type GreenCategory = "park" | "wood" | "grass" | "tree_row" | "tree";
export interface ContextObject { kind: string; lat: number; lng: number }
export interface GreenContext { landuse: ContextObject[]; water: ContextObject[] }
interface OsmCoord { lat: number; lon: number }
interface OsmElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
  lat?: number;
  lon?: number;
  center?: OsmCoord;
  geometry?: OsmCoord[];
  members?: { role?: string; geometry?: OsmCoord[] }[];
}
interface OverpassJson {
  elements: OsmElement[];
  osm3s?: { timestamp_osm_base?: string };
  remark?: string;
}

export function buildGreenQuery([w, s, e, n]: GreenBbox): string {
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:45];
(way["leisure"~"^(park|garden)$"](${b}); relation["leisure"~"^(park|garden)$"](${b});
way["landuse"~"^(forest|grass|meadow|orchard|recreation_ground|village_green|allotments)$"](${b});
way["natural"~"^(wood|scrub|tree_row)$"](${b}); node["natural"="tree"](${b});)->.g; .g out geom qt;
(way["landuse"~"^(residential|industrial|commercial|retail|farmland)$"](${b});
way["natural"="water"](${b}); way["waterway"~"^(river|canal|ditch|drain|stream)$"](${b});)->.c; .c out tags center qt;`;
}

function readOverpass(json: unknown): OverpassJson {
  if (!json || typeof json !== "object" || !("elements" in json) || !Array.isArray(json.elements)) {
    throw new Error("Invalid Overpass response");
  }
  const data = json as OverpassJson;
  // Overpass кейде HTTP 200 ішінде timeout қатесін береді; толық емес деректі кэштемейміз.
  if (data.remark) throw new Error(`Overpass: ${data.remark}`);
  return data;
}

export async function fetchOverpass(query: string): Promise<{ json: unknown; endpoint: string }> {
  const failures: string[] = [];
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Jaiyq/1.0 (+https://ecojaiyq.com)",
        },
        body: `data=${encodeURIComponent(query)}`,
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: unknown = await res.json();
      readOverpass(json);
      return { json, endpoint };
    } catch (err) {
      failures.push(`${endpoint}: ${err instanceof Error ? err.message : "fetch failed"}`);
    }
  }
  throw new Error(failures.join("; "));
}

function category(tags: Record<string, string>): GreenCategory | null {
  if (/^(park|garden)$/.test(tags.leisure ?? "")) return "park";
  if (tags.natural === "tree") return "tree";
  if (tags.natural === "tree_row") return "tree_row";
  if (/^(wood|scrub)$/.test(tags.natural ?? "") || tags.landuse === "forest") return "wood";
  if (/^(grass|meadow|orchard|recreation_ground|village_green|allotments)$/.test(tags.landuse ?? "")) return "grass";
  return null;
}

const finiteCoord = (p: OsmCoord) => Number.isFinite(p.lat) && Number.isFinite(p.lon);
const roundCoord = (p: OsmCoord): [number, number] => [+p.lon.toFixed(5), +p.lat.toFixed(5)];
function closedRing(points?: OsmCoord[]): points is OsmCoord[] {
  return !!points && points.length >= 4 && points.every(finiteCoord)
    && points[0].lat === points[points.length - 1].lat && points[0].lon === points[points.length - 1].lon;
}

function ringArea(ring: [number, number][]): number {
  // footprint.ts жергілікті тең-аралық проекциясының тұрақтылары; км².
  const [lng0, lat0] = ring[0];
  const kx = 111.32 * Math.cos(lat0 * Math.PI / 180);
  const xy = ring.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * 110.574]);
  let sum = 0;
  for (let i = 1; i < xy.length; i++) sum += xy[i - 1][0] * xy[i][1] - xy[i][0] * xy[i - 1][1];
  return Math.abs(sum) / 2;
}

export function parseGreen(json: unknown) {
  const data = readOverpass(json);
  const features: FeatureCollection<Geometry, { category: GreenCategory }> = { type: "FeatureCollection", features: [] };
  const counts: Record<GreenCategory, number> = { park: 0, wood: 0, grass: 0, tree_row: 0, tree: 0 };
  const areaKm2 = { park: 0, wood: 0, grass: 0 };
  const skipped = { openRings: 0, relations: 0, invalidGeometry: 0 };
  const context: GreenContext = { landuse: [], water: [] };
  const seen = new Set<string>();
  function add(cat: GreenCategory, geometry: Geometry) {
    features.features.push({ type: "Feature", properties: { category: cat }, geometry });
    counts[cat]++;
    if (geometry.type === "Polygon" && (cat === "park" || cat === "wood" || cat === "grass")) {
      areaKm2[cat] += ringArea(geometry.coordinates[0] as [number, number][]);
    }
  }
  for (const el of data.elements) {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const tags = el.tags ?? {};
    if (el.center && finiteCoord(el.center)) {
      const point = { lat: el.center.lat, lng: el.center.lon };
      if (/^(residential|industrial|commercial|retail|farmland)$/.test(tags.landuse ?? "")) {
        context.landuse.push({ ...point, kind: tags.landuse });
      }
      if (tags.natural === "water" || /^(river|canal|ditch|drain|stream)$/.test(tags.waterway ?? "")) {
        context.water.push({ ...point, kind: tags.waterway ?? "water" });
      }
    }
    const cat = category(tags);
    if (!cat) continue;
    if (cat === "tree" && el.type === "node") {
      if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) add(cat, { type: "Point", coordinates: roundCoord({ lat: el.lat!, lon: el.lon! }) });
      else skipped.invalidGeometry++;
    } else if (cat === "tree_row") {
      if (el.geometry && el.geometry.length >= 2 && el.geometry.every(finiteCoord)) {
        add(cat, { type: "LineString", coordinates: el.geometry.map(roundCoord) });
      } else skipped.invalidGeometry++;
    } else if (cat === "park" || cat === "wood" || cat === "grass") {
      if (el.type === "relation") {
        const outer = (el.members ?? []).filter((m) => m.role === "outer");
        let incomplete = !outer.length;
        for (const member of outer) {
          if (closedRing(member.geometry)) add(cat, { type: "Polygon", coordinates: [member.geometry.map(roundCoord)] });
          else { skipped.openRings++; incomplete = true; }
        }
        if (incomplete) skipped.relations++;
      } else if (closedRing(el.geometry)) {
        add(cat, { type: "Polygon", coordinates: [el.geometry.map(roundCoord)] });
      } else skipped.openRings++;
    }
  }
  return { features, counts, areaKm2, skipped, context, osmBase: data.osm3s?.timestamp_osm_base ?? null };
}

export interface GreeneryData extends ReturnType<typeof parseGreen> {
  fetchedAt: string;
  endpoint: string;
  stale: boolean;
  ageHours?: number;
  source: string;
  attribution: string;
  license: string;
  licenseUrl: string;
  label: string;
  quality: string;
  caveats: string[];
}
