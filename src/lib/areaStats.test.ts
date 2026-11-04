import { describe, it, expect } from "vitest";
import { parseDaily, toMonthly, monthsBetween, firesByMonth, overlayInArea } from "./areaStats";

const day = (from: string, mean: number, sample = 100, noData = 0) =>
  ({ interval: { from: `${from}T00:00:00Z` }, outputs: { ndvi: { bands: { B0: { stats: { mean, sampleCount: sample, noDataCount: noData } } } } } });

describe("areaStats", () => {
  it("ай тізімі", () => {
    expect(monthsBetween("2025-11-01", "2026-02-10")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("жамылғысы аз күн алынады, жоқ ай null (нөл емес)", () => {
    const days = parseDaily({ data: [day("2026-06-02", 0.3), day("2026-06-12", 0.5), day("2026-06-20", 0.9, 100, 80)] }, "ndvi", 0.6);
    expect(days).toHaveLength(2);
    const rows = toMonthly(days, ["2026-05", "2026-06"], "median");
    expect(rows[0]).toEqual({ month: "2026-05", value: null, n: 0, coverage: null });
    expect(rows[1].value).toBeCloseTo(0.4);
    expect(rows[1].n).toBe(2);
  });
  it("өрт тек полигон ішінде саналады", () => {
    const ring: [number, number][] = [[51, 47], [51.1, 47], [51.1, 47.1], [51, 47.1]];
    const r = firesByMonth([
      { lat: 47.05, lng: 51.05, acqDate: "2026-07-03" },
      { lat: 47.5, lng: 51.05, acqDate: "2026-07-03" },
    ], ring, ["2026-07"]);
    expect(r.points).toHaveLength(1);
    expect(r.rows[0].flare + r.rows[0].unconfirmed).toBe(1);
  });
  it("қабаттасу үлесі", () => {
    const ring: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const half: [number, number][] = [[0, 0], [0.5, 0], [0.5, 1], [0, 1]];
    const r = overlayInArea(ring, [{ category: "landuse:industrial", ring: half, bbox: [0, 0, 0.5, 1] }]);
    expect(r.rows[0].fraction).toBeGreaterThan(0.45);
    expect(r.rows[0].fraction).toBeLessThan(0.55);
  });
});
