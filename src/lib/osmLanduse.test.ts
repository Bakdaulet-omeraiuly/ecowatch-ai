import { describe, expect, it } from "vitest";
import { buildLanduseQuery, landuseCategory, parseLanduse, ringAreaKm2 } from "./osmLanduse";

const sq = (lat: number, lon: number, d = 0.01) => [
  { lat, lon }, { lat, lon: lon + d }, { lat: lat + d, lon: lon + d }, { lat: lat + d, lon }, { lat, lon },
];

describe("P4.3 OSM land use", () => {
  it("query covers land use, water and possibly contaminated sites in the bbox", () => {
    const q = buildLanduseQuery([51.72, 47.0, 52.12, 47.3]);
    expect(q).toContain("47,51.72,47.3,52.12");
    expect(q).toMatch(/landfill\|brownfield/);
    expect(q).toContain('"natural"="water"');
  });
  it("landfill/brownfield are 'possibly contaminated', never 'confirmed'", () => {
    expect(landuseCategory({ landuse: "landfill" })).toBe("possibly_contaminated");
    expect(landuseCategory({ landuse: "brownfield" })).toBe("possibly_contaminated");
    expect(landuseCategory({ landuse: "industrial" })).toBe("industrial");
    expect(landuseCategory({ landuse: "forest" })).toBeNull();
  });
  it("parses closed rings, skips open ones, dedupes, counts area", () => {
    const r = parseLanduse({ elements: [
      { type: "way", id: 1, tags: { landuse: "residential", name: "A" }, geometry: sq(47.1, 51.9) },
      { type: "way", id: 1, tags: { landuse: "residential" }, geometry: sq(47.1, 51.9) },
      { type: "way", id: 2, tags: { landuse: "industrial" }, geometry: sq(47.1, 51.9).slice(0, 4) },
      { type: "relation", id: 3, tags: { natural: "water" }, members: [{ role: "outer", geometry: sq(47.2, 51.9) }, { role: "inner", geometry: sq(47.2, 51.9, 0.001) }] },
    ] });
    expect(r.counts.residential).toBe(1);
    expect(r.counts.industrial).toBe(0);
    expect(r.skipped.openRings).toBe(1);
    expect(r.counts.water).toBe(1);
    expect(r.features.features).toHaveLength(2);
    expect(r.areaKm2.residential).toBeCloseTo(ringAreaKm2(sq(47.1, 51.9).map((p) => [p.lon, p.lat])), 3);
  });
  it("an Overpass timeout remark is an error, not an empty map", () => {
    expect(() => parseLanduse({ elements: [], remark: "runtime error: timeout" })).toThrow(/Overpass/);
  });
  it("1 km × ~1.1 km square ≈ 0.84 km² at 47°N", () => {
    expect(ringAreaKm2([[0, 47], [0.01, 47], [0.01, 47.01], [0, 47.01], [0, 47]])).toBeCloseTo(0.0084 * 100, 1);
  });
});
