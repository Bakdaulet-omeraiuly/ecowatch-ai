import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGreenQuery, parseGreen, fetchOverpass, OVERPASS_ENDPOINTS, OSM_LICENSE } from "./osmGreen";
import { GREEN_CITY_BBOX } from "@/data/greenery";

// Тек тестке арналған синтетикалық OSM JSON; өнімде ешқандай фикстура жоқ.
const ring = [
  { lon: 51.8, lat: 47.1 }, { lon: 51.81, lat: 47.1 },
  { lon: 51.81, lat: 47.11 }, { lon: 51.8, lat: 47.1 },
];

beforeEach(() => vi.resetModules());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("P4.1 OSM greenery", () => {
  it("queries greenery geometry and land/water context in s,w,n,e order", () => {
    const q = buildGreenQuery(GREEN_CITY_BBOX.atyrau);
    expect(q).toContain("47,51.72,47.3,52.12");
    expect(q).toContain("out geom");
    expect(q).toContain('node["natural"="tree"]');
    expect(q).toContain('relation["leisure"');
    expect(q).toContain("residential|industrial|commercial|retail|farmland");
  });
  it("parses polygons, rows, trees, context and source timestamp; counts skips", () => {
    const parsed = parseGreen({ osm3s: { timestamp_osm_base: "2026-11-01T00:00:00Z" }, elements: [
      { type: "way", id: 1, tags: { leisure: "park" }, geometry: ring },
      { type: "way", id: 2, tags: { landuse: "grass" }, geometry: ring.slice(0, 3) },
      { type: "way", id: 3, tags: { natural: "tree_row" }, geometry: ring.slice(0, 2) },
      { type: "node", id: 4, tags: { natural: "tree" }, lat: 47.1234567, lon: 51.8765432 },
      { type: "way", id: 5, tags: { landuse: "residential" }, center: { lat: 47.1, lon: 51.8 } },
      { type: "way", id: 6, tags: { waterway: "canal" }, center: { lat: 47.1, lon: 51.9 } },
    ] });
    expect(parsed.features.features.map((f) => f.geometry.type)).toEqual(["Polygon", "LineString", "Point"]);
    expect(parsed.features.features[0].properties.category).toBe("park");
    expect(parsed.features.features[2].geometry).toEqual({ type: "Point", coordinates: [51.87654, 47.12346] });
    expect(parsed.counts).toEqual({ park: 1, wood: 0, grass: 0, tree_row: 1, tree: 1 });
    expect(parsed.skipped.openRings).toBe(1);
    expect(parsed.context.landuse).toEqual([{ kind: "residential", lat: 47.1, lng: 51.8 }]);
    expect(parsed.context.water).toEqual([{ kind: "canal", lat: 47.1, lng: 51.9 }]);
    expect(parsed.osmBase).toBe("2026-11-01T00:00:00Z");
  });
  it("keeps closed outer relation rings separately and reports unassembled relations", () => {
    const parsed = parseGreen({ elements: [
      { type: "relation", id: 1, tags: { leisure: "garden" }, members: [
        { role: "outer", geometry: ring }, { role: "outer", geometry: ring },
        { role: "outer", geometry: ring.slice(0, 3) },
      ] },
      { type: "relation", id: 2, tags: { leisure: "park" }, members: [] },
    ] });
    expect(parsed.counts.park).toBe(2);
    expect(parsed.skipped).toMatchObject({ openRings: 1, relations: 2 });
    expect(parseGreen({ elements: [] }).osmBase).toBeNull();
  });
  it("computes approximately one square kilometre with the local projection", () => {
    const lon = 51.8, lat = 47.1;
    const dx = 1 / (111.32 * Math.cos(lat * Math.PI / 180));
    const dy = 1 / 110.574;
    const geometry = [[lon, lat], [lon + dx, lat], [lon + dx, lat + dy], [lon, lat + dy], [lon, lat]]
      .map(([lon, lat]) => ({ lon, lat }));
    const data = parseGreen({ elements: [{ type: "way", id: 1, tags: { landuse: "forest" }, geometry }] });
    expect(data.areaKm2.wood).toBeGreaterThan(0.95);
    expect(data.areaKm2.wood).toBeLessThan(1.05);
  });
  it("rejects malformed or Overpass partial-error payloads", () => {
    expect(() => parseGreen({})).toThrow();
    expect(() => parseGreen({ elements: [], remark: "runtime error: timeout" })).toThrow("timeout");
  });
  it("falls back from HTTP 502 to the next mirror with POST and a User-Agent", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("Bad gateway", { status: 502 }))
      .mockResolvedValueOnce(Response.json({ elements: [] }));
    vi.stubGlobal("fetch", fetcher);
    expect((await fetchOverpass("query")).endpoint).toBe(OVERPASS_ENDPOINTS[1]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", cache: "no-store", body: "data=query", headers: { "User-Agent": "Jaiyq/1.0 (+https://ecojaiyq.com)" } });
  });
  it("reports every failed mirror and rejects a 200 timeout payload", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ elements: [], remark: "timeout" }))
      .mockImplementation(() => Promise.resolve(new Response("", { status: 504 })));
    vi.stubGlobal("fetch", fetcher);
    await expect(fetchOverpass("query")).rejects.toThrow(OVERPASS_ENDPOINTS[2]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it("returns 503 on a cold-cache failure instead of a fabricated empty layer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("test offline")));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/greenery/route");
    const res = await GET(new Request("http://localhost/api/greenery"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "OSM көгалдандыру деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", reason: "Overpass серверлері жауап бермеді" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
  it("caches successful data and labels an old cache when refresh fails", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T00:00:00Z"));
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ elements: [
      { type: "node", id: 1, tags: { natural: "tree" }, lat: 47.1, lon: 51.8 },
    ] })));
    vi.stubGlobal("fetch", fetcher);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/greenery/route");
    const req = () => new Request("http://localhost/api/greenery");
    const first = await GET(req());
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toContain("s-maxage=86400");
    const body = await first.json();
    expect(body).toMatchObject({ attribution: "© OpenStreetMap contributors", license: OSM_LICENSE, stale: false, counts: { tree: 1 } });
    await GET(req());
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-11-04T01:00:00Z"));
    fetcher.mockRejectedValue(new Error("test offline"));
    const stale = await GET(req());
    expect(await stale.json()).toMatchObject({ stale: true, ageHours: 25, counts: { tree: 1 }, fetchedAt: body.fetchedAt });
    expect(stale.headers.get("Cache-Control")).toBe("no-store");
  });
});
