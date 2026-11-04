// P4.3: land-use layer from OpenStreetMap (cartography, not measurement).
//
// Two things the spec requires to stay separate are kept separate here:
//  • "confirmed contamination" — needs an official register; none is connected,
//    so the API reports it as "дерек жоқ" instead of inferring it from OSM tags;
//  • "possibly contaminated sites" — OSM-mapped landfills / brownfields / industrial
//    waste sites. These are mapped land uses, NOT evidence of contamination.
import type { FeatureCollection, Geometry } from "geojson";
import type { GreenBbox } from "@/data/greenery";

export type LanduseCategory =
  | "residential" | "industrial" | "commercial" | "farmland" | "water" | "possibly_contaminated" | "extraction";

export const LANDUSE_CATEGORIES: LanduseCategory[] =
  ["residential", "industrial", "commercial", "farmland", "water", "extraction", "possibly_contaminated"];

interface OsmCoord { lat: number; lon: number }
interface OsmElement {
  type: string; id: number; tags?: Record<string, string>;
  geometry?: OsmCoord[]; members?: { role?: string; geometry?: OsmCoord[] }[];
}

export function buildLanduseQuery([w, s, e, n]: GreenBbox): string {
  const b = `${s},${w},${n},${e}`;
  return `[out:json][timeout:45];
(way["landuse"~"^(residential|industrial|commercial|retail|farmland|landfill|brownfield|quarry)$"](${b});
relation["landuse"~"^(residential|industrial|commercial|retail|farmland|landfill|brownfield|quarry)$"](${b});
way["natural"="water"](${b}); relation["natural"="water"](${b});
way["man_made"="wastewater_plant"](${b});)->.l; .l out geom qt;`;
}

export function landuseCategory(tags: Record<string, string>): LanduseCategory | null {
  const lu = tags.landuse ?? "";
  if (lu === "landfill" || lu === "brownfield" || tags.man_made === "wastewater_plant") return "possibly_contaminated";
  if (tags.natural === "water") return "water";
  // P5.6: OSM-mapped extraction (quarries, oil/gas fields). Cartography — NOT a licence area.
  if (lu === "quarry" || (lu === "industrial" && /^(oil|gas|mine)$/.test(tags.industrial ?? ""))) return "extraction";
  if (lu === "residential") return "residential";
  if (lu === "industrial") return "industrial";
  if (lu === "commercial" || lu === "retail") return "commercial";
  if (lu === "farmland") return "farmland";
  return null;
}

const ok = (p: OsmCoord) => Number.isFinite(p.lat) && Number.isFinite(p.lon);
const xy = (p: OsmCoord): [number, number] => [+p.lon.toFixed(5), +p.lat.toFixed(5)];
function closed(points?: OsmCoord[]): points is OsmCoord[] {
  return !!points && points.length >= 4 && points.every(ok)
    && points[0].lat === points.at(-1)!.lat && points[0].lon === points.at(-1)!.lon;
}

/** Polygon area, km² — same local equirectangular projection as lib/footprint.ts. */
export function ringAreaKm2(ring: [number, number][]): number {
  const [lng0, lat0] = ring[0];
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const p = ring.map(([lng, lat]) => [(lng - lng0) * kx, (lat - lat0) * 110.574]);
  let sum = 0;
  for (let i = 1; i < p.length; i++) sum += p[i - 1][0] * p[i][1] - p[i][0] * p[i - 1][1];
  return Math.abs(sum) / 2;
}

export interface LanduseSummary {
  counts: Record<LanduseCategory, number>;
  areaKm2: Record<LanduseCategory, number>;
  skipped: { openRings: number; noGeometry: number };
}

export function parseLanduse(json: unknown): { features: FeatureCollection<Geometry, { category: LanduseCategory; name: string | null }> } & LanduseSummary {
  if (!json || typeof json !== "object" || !Array.isArray((json as { elements?: unknown }).elements)) {
    throw new Error("Invalid Overpass response");
  }
  const data = json as { elements: OsmElement[]; remark?: string };
  if (data.remark) throw new Error(`Overpass: ${data.remark}`); // HTTP 200 with a timeout inside — incomplete
  const zero = () => Object.fromEntries(LANDUSE_CATEGORIES.map((c) => [c, 0])) as Record<LanduseCategory, number>;
  const counts = zero(); const areaKm2 = zero();
  const skipped = { openRings: 0, noGeometry: 0 };
  const features: FeatureCollection<Geometry, { category: LanduseCategory; name: string | null }> = { type: "FeatureCollection", features: [] };
  const seen = new Set<string>();
  for (const el of data.elements) {
    const key = `${el.type}/${el.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const cat = landuseCategory(el.tags ?? {});
    if (!cat) continue;
    const rings = el.type === "relation"
      ? (el.members ?? []).filter((m) => m.role === "outer").map((m) => m.geometry)
      : [el.geometry];
    let added = false;
    for (const r of rings) {
      if (!r) { skipped.noGeometry++; continue; }
      if (!closed(r)) { skipped.openRings++; continue; }
      const ring = r.map(xy);
      features.features.push({ type: "Feature", properties: { category: cat, name: el.tags?.name ?? null },
        geometry: { type: "Polygon", coordinates: [ring] } });
      areaKm2[cat] += ringAreaKm2(ring);
      added = true;
    }
    if (added) counts[cat]++;
  }
  for (const c of LANDUSE_CATEGORIES) areaKm2[c] = +areaKm2[c].toFixed(3);
  return { features, counts, areaKm2, skipped };
}

export const LANDUSE_CAVEATS = [
  "OSM — картография, өлшем емес; толықтығы тексерілмеген: картада жоқ аумақ — ол жерде ештеңе жоқ дегенді білдірмейді.",
  "«Ықтимал ластанған жер» — OSM-да белгіленген полигон, қоқыс алаңы, тастанды өнеркәсіп аумағы немесе тазарту құрылысы. Бұл ластанудың дәлелі ЕМЕС.",
  "Расталған ластану үшін ресми тізілім (зертханалық сынама, экологиялық тексеру актісі) қажет — ол әлі жалғанбаған, сондықтан «дерек жоқ».",
  "«Өндіру аумағы» — OSM-да белгіленген карьер немесе мұнай-газ алаңы. Бұл жер қойнауын пайдалану лицензиясының аумағы емес және ластанудың дәлелі емес. Ресми лицензиялар — minerals.e-qazyna.kz интерактивті картасында (ашық API жоқ, сондықтан мұнда көшірілмейді).",
  "Аудандар қабаттасуы алынбай қосылады; ішкі ойықтар есептелмейді.",
];
