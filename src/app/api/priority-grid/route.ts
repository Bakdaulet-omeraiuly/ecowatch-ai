// БАСЫМДЫҚ ТОРЫ — 1 км ұяшықтар бойынша критерийлер (салмақ клиентте).
// Әдетте статикалық көшірмеден оқылады (public/data/layers/priority-grid-atyrau.json,
// scripts/snapshot-layers.mjs). Кілт жоқ/Sentinel қатесі → 503, мок жоқ.
import { NextResponse } from "next/server";
import { GREEN_CITY_BBOX } from "@/data/greenery";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { FACILITIES } from "@/data/facilities";
import { SH_PROCESS_URL, cdseToken, hasCdseKeys } from "@/lib/cdse";
import { summerSeasons } from "@/lib/greenNdvi";
import { decodeGrayPng } from "@/lib/pngGray";
import { buildCells, cellFraction, kmBetween, NDVI_PNG_EVAL, PRIORITY_CAVEATS, PRIORITY_CELL_KM, rasterCellStats, toPolys, type PriorityCell } from "@/lib/priorityGrid";
import type { Ring } from "@/lib/areaGeo";
import landuseSnap from "../../../../public/data/layers/landuse-atyrau.json" with { type: "json" };
import greenerySnap from "../../../../public/data/layers/greenery-atyrau.json" with { type: "json" };

export const maxDuration = 60;
const RES_M = 50;
const MIN_CELL_COVERAGE = 0.5;
let cache: { at: number; data: unknown } | null = null;

type FC = { features: { features: { properties: { category: string }; geometry: { type: string; coordinates: unknown } }[] } };
const ringsOf = (snap: FC, cats: string[]) => snap.features.features
  .filter((f) => f.geometry.type === "Polygon" && cats.includes(f.properties.category))
  .map((f) => (f.geometry.coordinates as Ring[])[0]);

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "greenery")) return NextResponse.json(moduleUnavailable(region, "greenery"));
  if (cache && Date.now() - cache.at < 7 * 86400_000) return NextResponse.json(cache.data);
  if (!hasCdseKeys()) return NextResponse.json({ error: "Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const bbox = GREEN_CITY_BBOX[region.id] as [number, number, number, number];
  const { recent } = summerSeasons(new Date());
  const lat0 = (bbox[1] + bbox[3]) / 2;
  const width = Math.round(((bbox[2] - bbox[0]) * 111_320 * Math.cos((lat0 * Math.PI) / 180)) / RES_M);
  const height = Math.round(((bbox[3] - bbox[1]) * 111_320) / RES_M);
  try {
    const token = await cdseToken();
    const res = await fetch(SH_PROCESS_URL, {
      method: "POST", cache: "no-store", signal: AbortSignal.any([req.signal, AbortSignal.timeout(55_000)]),
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, Accept: "image/png" },
      body: JSON.stringify({
        input: {
          bounds: { bbox, properties: { crs: "http://www.opengis.net/def/crs/EPSG/0/4326" } },
          data: [{ type: "sentinel-2-l2a", dataFilter: { timeRange: { from: `${recent.from}T00:00:00Z`, to: `${recent.to}T23:59:59Z` }, maxCloudCoverage: 60 } }],
        },
        output: { width, height, responses: [{ identifier: "default", format: { type: "image/png" } }] },
        evalscript: NDVI_PNG_EVAL,
      }),
    });
    if (!res.ok) throw new Error(`Process API ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const img = decodeGrayPng(new Uint8Array(await res.arrayBuffer()));
    const resi = toPolys(ringsOf(landuseSnap as unknown as FC, ["residential"]));
    const green = toPolys(ringsOf(greenerySnap as unknown as FC, ["wood", "grass", "park"]));
    const cells: PriorityCell[] = buildCells(bbox).map((c) => {
      const st = rasterCellStats(img, bbox, c.bbox);
      const center: [number, number] = [(c.bbox[0] + c.bbox[2]) / 2, (c.bbox[1] + c.bbox[3]) / 2];
      return {
        ...c,
        bbox: c.bbox.map((v) => +v.toFixed(5)) as PriorityCell["bbox"],
        ndvi: st.mean != null && st.coverage >= MIN_CELL_COVERAGE ? +st.mean.toFixed(3) : null,
        ndviCoverage: +st.coverage.toFixed(2),
        residential: +cellFraction(c.bbox, resi).toFixed(2),
        green: +cellFraction(c.bbox, green).toFixed(2),
        sourceKm: +Math.min(...FACILITIES.map((f) => kmBetween(center, [f.lng, f.lat]))).toFixed(2),
      };
    });
    if (!cells.some((c) => c.ndvi != null)) throw new Error("NDVI жарамды ұяшық жоқ");
    const data = {
      fetchedAt: new Date().toISOString(), tier: "model", cellKm: PRIORITY_CELL_KM, bbox, season: recent, ndviResolutionM: RES_M,
      sources: ["Copernicus Sentinel-2 L2A · Sentinel Hub Process API", "OpenStreetMap (landuse, greenery көшірмесі)", "Jaiyq нысандар тізілімі"],
      osmSnapshotAt: (landuseSnap as { fetchedAt?: string }).fetchedAt ?? null,
      cells, caveats: PRIORITY_CAVEATS,
    };
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    console.error("priority-grid:", e);
    return NextResponse.json({ error: "Sentinel-2 деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", reason: e instanceof Error ? e.message.slice(0, 200) : undefined }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
