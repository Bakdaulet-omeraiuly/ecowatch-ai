import { describe, it, expect } from "vitest";
import { ringAreaKm2, validateRing, parseGeoJsonRing, parseKmlRing, selfIntersects, sampleRing, openRing } from "./areaGeo";

// ~1 км × 1 км Атырау орталығында
const lat = 47.11, lng = 51.92;
const dLat = 1 / 111.32, dLng = 1 / (111.32 * Math.cos((lat * Math.PI) / 180));
const sq: [number, number][] = [[lng, lat], [lng + dLng, lat], [lng + dLng, lat + dLat], [lng, lat + dLat]];

describe("areaGeo", () => {
  it("аудан ~1 км²", () => {
    expect(ringAreaKm2(sq)).toBeGreaterThan(0.99);
    expect(ringAreaKm2(sq)).toBeLessThan(1.01);
  });
  it("жабық сақинаны ашады", () => {
    expect(openRing([...sq, sq[0]])).toHaveLength(4);
  });
  it("жарамды полигонды қабылдайды", () => {
    const r = validateRing(sq);
    expect(r.ok).toBe(true);
  });
  it("облыстан тыс полигонды қабылдамайды", () => {
    const r = validateRing(sq.map(([x, y]) => [x + 20, y]));
    expect(r.ok).toBe(false);
  });
  it("өзін-өзі қиятын полигонды табады", () => {
    expect(selfIntersects([sq[0], sq[2], sq[1], sq[3]])).toBe(true);
    expect(selfIntersects(sq)).toBe(false);
  });
  it("GeoJSON мен KML оқиды", () => {
    const fc = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[...sq, sq[0]]] } }] });
    expect(parseGeoJsonRing(fc)).toHaveLength(4);
    const kml = `<kml><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>${[...sq, sq[0]].map((p) => p.join(",") + ",0").join(" ")}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>`;
    expect(parseKmlRing(kml)).toHaveLength(4);
    expect(parseGeoJsonRing("not json")).toBeNull();
  });
  it("тор-сынама ауданы полигон ауданына жақын", () => {
    const { points, cellKm2 } = sampleRing(sq, 10_000);
    expect(points.length * cellKm2).toBeGreaterThan(0.95);
    expect(points.length * cellKm2).toBeLessThan(1.05);
  });
});
