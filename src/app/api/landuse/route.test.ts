import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
const sq = [{ lat: 47.1, lon: 51.9 }, { lat: 47.1, lon: 51.91 }, { lat: 47.11, lon: 51.91 }, { lat: 47.11, lon: 51.9 }, { lat: 47.1, lon: 51.9 }];

describe("/api/landuse", () => {
  it("returns OSM land use with the 'confirmed contamination: no data' flag", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ elements: [{ type: "way", id: 9, tags: { landuse: "landfill" }, geometry: sq }] })));
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/landuse?region=atyrau"));
    expect(res.status).toBe(200);
    const d = await res.json();
    expect(d.counts.possibly_contaminated).toBe(1);
    expect(d.confirmedContamination.available).toBe(false);
    expect(d.attribution).toContain("OpenStreetMap");
  });
  it("all Overpass servers failing → 503, not an empty map", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 504 })));
    const { GET } = await import("./route");
    const res = await GET(new Request("http://localhost/api/landuse?region=atyrau"));
    expect(res.status).toBe(503);
    expect((await res.json()).features).toBeUndefined();
  });
});
