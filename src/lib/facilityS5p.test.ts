import { describe, expect, it } from "vitest";
import { facilityNo2Signal, signalFrom } from "./facilityS5p";

describe("facilityNo2Signal", () => {
  it("АМӨЗ мен ЖЭО бір кластер, нәтижесі validation/s5p/results.json-нан", () => {
    const a = facilityNo2Signal("anpz");
    const t = facilityNo2Signal("tets");
    expect(a.status).toBe("detected");
    expect(a.relativePct).toBe(70); // 1.083e-5 / 1.556e-5
    expect(a.ciLowPct).toBe(65);
    expect(t).toEqual(a);
    expect(a.clusterKey).not.toBeNull();
  });
  it("нәтижесі жоқ нысан «тексерілмеген», 0% емес", () => {
    const s = facilityNo2Signal("no-such-facility");
    expect(s.status).toBe("untested");
    expect(s.relativePct).toBeNull();
  });
  it("өтпеген тест — not-detected, сан сақталады", () => {
    const s = signalFrom({ valid_days: 300, mean_delta_mol_m2: 1e-7, ci95: [-1e-6, 1e-6], mean_upwind_mol_m2: 1e-5, pass: false }, [], null);
    expect(s.status).toBe("not-detected");
    expect(s.relativePct).toBe(1);
    expect(s.ciLowPct).toBe(-10);
  });
});
