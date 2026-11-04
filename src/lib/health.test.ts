import { describe, expect, it } from "vitest";
import snapshot from "@/data/health/atyrau-mortality.json";
import { correlate, MIN_CORRELATION_N, per100k, rateSeries } from "./health";

describe("P5.2 health statistics (aggregated, official)", () => {
  it("per 100 000 formula", () => {
    expect(per100k(331, 426927)).toBe(77.5);
    expect(() => per100k(1, 0)).toThrow();
  });
  it("computed crude death rate matches the official Taldau value (2025, Atyrau city: 4.57‰)", () => {
    const [row] = rateSeries("atyrau_city", "all").filter((r) => r.year === 2025);
    expect(+(row.per100k / 100).toFixed(2)).toBe(4.57);
  });
  it("snapshot holds only aggregated fields — no individual-level data", () => {
    const keys = new Set<string>();
    const walk = (o: unknown) => { if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) { keys.add(k); walk(v); } };
    walk(snapshot);
    for (const bad of ["name_person", "iin", "address", "diagnosis", "patient", "birthDate", "lat", "lng"]) expect(keys.has(bad)).toBe(false);
  });
  it("rate series exist for both causes and areas, 2021–2025", () => {
    for (const area of ["atyrau_city", "atyrau_oblast"] as const)
      for (const cause of ["respiratory", "circulatory"] as const)
        expect(rateSeries(area, cause).map((r) => r.year)).toEqual([2021, 2022, 2023, 2024, 2025]);
  });
});

describe("P5.3 correlation tool", () => {
  it(`refuses below n=${MIN_CORRELATION_N}`, () => {
    const r = correlate([[1, 2], [2, 3]]);
    expect(r.ok).toBe(false);
    expect(r.n).toBe(2);
  });
  it("perfect positive line → r=1 with CI and the 'not causation' note", () => {
    const r = correlate(Array.from({ length: 10 }, (_, i) => [i, 2 * i + 1] as [number, number]));
    expect(r.ok && r.r).toBe(1);
    expect(r.ok && r.note).toMatch(/себеп-салдар емес/);
  });
  it("CI contains r and widens for small n", () => {
    const pts = (n: number) => Array.from({ length: n }, (_, i) => [i, i + ((i * 7) % 5)] as [number, number]);
    const a = correlate(pts(9)), b = correlate(pts(40));
    if (!a.ok || !b.ok) throw new Error("expected ok");
    expect(a.ci95[0]).toBeLessThanOrEqual(a.r); expect(a.ci95[1]).toBeGreaterThanOrEqual(a.r);
    expect(a.ci95[1] - a.ci95[0]).toBeGreaterThan(b.ci95[1] - b.ci95[0]);
  });
});
