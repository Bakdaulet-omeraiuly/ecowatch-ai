import { describe, expect, it } from "vitest";
import { AIRGRID_UNAVAILABLE, airgridValues } from "@/lib/airgridPoint";

describe("P1.3: /api/airgrid — H₂S және NO басқа газдан шықпайды", () => {
  it("CAMS NO мәні бар болса да, `no` = null (NO₂-ден көшірілмейді)", () => {
    const v = airgridValues({ nitrogen_monoxide: 5, nitrogen_dioxide: 10 });
    expect(v.no).toBeNull();
    expect(v.no2).toBe(10);
  });

  it("жауапта `h2s` кілті жоқ", () => {
    const v = airgridValues({ nitrogen_monoxide: 5, sulphur_dioxide: 3, carbon_monoxide: 7 });
    expect("h2s" in v).toBe(false);
  });

  it("H₂S және NO үшін себеп көрсетіледі (AIRGRID_UNAVAILABLE)", () => {
    expect(AIRGRID_UNAVAILABLE.h2s).toBe("no-model-field");
    expect(AIRGRID_UNAVAILABLE.no).toBe("no-model-field");
  });

  it("бос `current` → барлық мән null, нөл емес", () => {
    const v = airgridValues(undefined);
    expect(v.no).toBeNull();
    expect(v.no2).toBeNull();
    expect(v.so2).toBeNull();
    expect(v.co).toBeNull();
  });

  it("жарамсыз (NaN/жол) сан null болады, 0-ге айналмайды", () => {
    const v = airgridValues({ pm2_5: Number.NaN, ozone: "12" as unknown as number, carbon_monoxide: 0 });
    expect(v.pm2_5).toBeNull();
    expect(v.ozone).toBeNull();
    expect(v.co).toBe(0);
  });
});
