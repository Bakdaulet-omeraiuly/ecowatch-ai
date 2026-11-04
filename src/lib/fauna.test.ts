import { describe, expect, it } from "vitest";
import { generalise, generaliseStep, toPoints } from "./fauna";

describe("P5.5 sensitive-species location generalisation", () => {
  it("threatened species → ~10 km cell, others → ~1 km", () => {
    expect(generaliseStep("EN")).toBe(0.1);
    expect(generaliseStep("VU")).toBe(0.1);
    expect(generaliseStep("LC")).toBe(0.01);
    expect(generaliseStep(null)).toBe(0.01);
  });
  it("exact coordinates are not recoverable", () => {
    const g = generalise(46.98765, 51.61234, "EN");
    expect(g).toEqual({ lat: 46.95, lng: 51.65, precisionKm: 10 });
    const near = generalise(46.91, 51.69, "EN");
    expect(near.lat).toBe(g.lat); // different true points → same published cell
    expect(near.lng).toBe(g.lng);
  });
  it("toPoints drops records without coordinates and dedupes per species per cell", () => {
    const pts = toPoints([
      { decimalLatitude: 47.0001, decimalLongitude: 51.9001, species: "Pelecanus crispus", classKey: 212, iucnRedListCategory: "NT" },
      { decimalLatitude: 47.0402, decimalLongitude: 51.9403, species: "Pelecanus crispus", classKey: 212, iucnRedListCategory: "NT" },
      { species: "No coords", classKey: 212 },
    ]);
    expect(pts).toHaveLength(1);
    expect(pts[0].precisionKm).toBe(10);
  });
});
