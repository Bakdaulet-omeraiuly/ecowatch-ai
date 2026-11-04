import { describe, expect, it } from "vitest";
import { assignToCells, greeningAdvice, ADVICE_TEXT, ADVICE_FOOTER, LANDUSE_LABELS } from "./greeningAdvice";
import { cityCells, type GreenChangeCell, type GreenSeasonStat } from "./greenNdvi";
import { GREEN_CITY_BBOX, LOW_VEG, WATER_PRESENT, NDVI_CAVEATS, OSM_CAVEATS } from "@/data/greenery";
import { UI_TR } from "./uiTranslations";

// Синтетикалық ұяшық, тек ережелерді тексеру үшін; өнім дерегі емес.
const season: GreenSeasonStat = { meanNdvi: 0.3, vegFraction: 0.2, denseFraction: 0.1, waterFraction: 0,
  coverage: 0.8, usableWeeks: 3, firstDate: "2026-06-01", lastDate: "2026-08-24" };
const cell = (extra: Partial<GreenChangeCell> = {}): GreenChangeCell => ({
  id: "r0c0", pos: "nw", bbox: [51.72, 47.2, 51.85, 47.3],
  baseline: season, recent: season, change: { dVeg: 0, dNdvi: 0, trend: "stable" }, status: "ok", ...extra,
});
const residential = { landuse: { residential: 3, industrial: 1 }, water: 0 };

describe("P4.2 rule-based greening advice", () => {
  it("always exposes all six inputs, missing salinity, and no AI", () => {
    const advice = greeningAdvice(cell(), residential);
    expect(advice.aiUsed).toBe(false);
    expect(advice.inputs.map((i) => i.key)).toEqual(["recentVeg", "dVeg", "s2Water", "landuse", "osmWater", "soilSalinity"]);
    expect(advice.inputs[5]).toMatchObject({ value: null, kind: "missing" });
    expect(advice.inputs[0]).toMatchObject({ value: "20.0", source: "Sentinel-2", kind: "satellite" });
  });
  it("makes no recommendation without recent NDVI, even with OSM water", () => {
    const advice = greeningAdvice(cell({ recent: null, change: null, status: "partial" }), { landuse: { industrial: 1 }, water: 3 });
    expect(advice.codes).toEqual(["no-ndvi"]);
    expect(advice.inputs[0].value).toBeNull();
    expect(advice.inputs[2].value).toBeNull();
    expect(advice.inputs[4].value).toBe("3");
  });
  it("does not infer land-use or absent water when OSM is unavailable", () => {
    const advice = greeningAdvice(cell({ recent: { ...season, vegFraction: 0.01 } }), null);
    expect(advice.codes).toEqual(["landuse-unknown"]);
    expect(advice.inputs.find((i) => i.key === "landuse")?.value).toBeNull();
    expect(advice.inputs.find((i) => i.key === "osmWater")?.value).toBeNull();
  });
  it("applies residential low vegetation strictly below its threshold", () => {
    expect(greeningAdvice(cell({ recent: { ...season, vegFraction: LOW_VEG - 0.001 } }), residential).codes).toContain("residential-low-veg");
    expect(greeningAdvice(cell({ recent: { ...season, vegFraction: LOW_VEG } }), residential).codes).not.toContain("residential-low-veg");
  });
  it("applies the industrial rule and decline rule in order", () => {
    const advice = greeningAdvice(cell({ change: { dVeg: -0.1, dNdvi: -0.05, trend: "down" } }), { landuse: { industrial: 1 }, water: 0 });
    expect(advice.codes).toEqual(["industrial-buffer", "decline", "water-not-found"]);
  });
  it("handles ≥50% dominance, mixed ties, and unknown land use", () => {
    const half = greeningAdvice(cell({ recent: { ...season, vegFraction: 0.01 } }), { landuse: { residential: 2, industrial: 1, retail: 1 }, water: 0 });
    expect(half.codes).toContain("residential-low-veg");
    const mixed = greeningAdvice(cell(), { landuse: { residential: 1, industrial: 1 }, water: 0 });
    expect(mixed.inputs[3].value).toBe("аралас");
    expect(mixed.codes).not.toContain("industrial-buffer");
    const empty = greeningAdvice(cell(), { landuse: {}, water: 0 });
    expect(empty.inputs[3].value).toBeNull();
    expect(empty.codes).toContain("landuse-unknown");
  });
  it("uses either positive water input, and never turns missing OSM into zero", () => {
    expect(greeningAdvice(cell({ recent: { ...season, waterFraction: WATER_PRESENT } }), residential).codes).toContain("water-available");
    expect(greeningAdvice(cell({ recent: { ...season, waterFraction: WATER_PRESENT - 0.001 } }), residential).codes).toContain("water-not-found");
    expect(greeningAdvice(cell(), { ...residential, water: 1 }).codes).toContain("water-available");
    expect(greeningAdvice(cell({ recent: { ...season, waterFraction: WATER_PRESENT } }), null).codes).toEqual(["landuse-unknown", "water-available"]);
  });
  it("assigns OSM object centers once, without pretending to measure land-use area", () => {
    const cells = cityCells(GREEN_CITY_BBOX.atyrau, 3, 3);
    const [w, s, e, n] = cells[0].bbox;
    const assigned = assignToCells(cells, {
      landuse: [{ kind: "residential", lng: (w + e) / 2, lat: (s + n) / 2 },
        { kind: "industrial", lng: e, lat: s }, { kind: "retail", lng: 0, lat: 0 }],
      water: [{ kind: "river", lng: w, lat: n }],
    });
    expect(assigned.r0c0).toEqual({ landuse: { residential: 1, industrial: 1 }, water: 1 });
    expect(Object.values(assigned).reduce((a, c) => a + Object.values(c.landuse).reduce((a, b) => a + b, 0), 0)).toBe(2);
  });
  it("uses number-free advice text with complete Russian and English translations", () => {
    for (const text of [...Object.values(ADVICE_TEXT), ADVICE_FOOTER]) {
      expect(text).not.toMatch(/\d/);
      expect(UI_TR[text]?.ru, text).toBeTruthy();
      expect(UI_TR[text]?.en, text).toBeTruthy();
    }
    const advice = greeningAdvice(cell(), residential);
    for (const text of [...advice.inputs.map((i) => i.label), ...Object.values(LANDUSE_LABELS), ...NDVI_CAVEATS, ...OSM_CAVEATS]) {
      expect(UI_TR[text]?.ru, text).toBeTruthy();
      expect(UI_TR[text]?.en, text).toBeTruthy();
    }
  });
});
