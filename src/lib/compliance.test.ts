import { describe, expect, it } from "vitest";
import { AVERAGING_KZ, type Averaging } from "@/data/legalNorms";
import { checkCompliance, HOURLY_BASIS, type ComparisonBasis } from "@/lib/compliance";

const DAILY_BASIS: ComparisonBasis = { averaging: "daily", windowHours: 24 };
const ANNUAL_BASIS: ComparisonBasis = { averaging: "annual", windowHours: 8760 };

describe("P1.2 (а): сағаттық PM₂.₅ тәуліктік нормамен салыстырылмайды", () => {
  const r = checkCompliance("pm25", 40, "KZ", HOURLY_BASIS);

  it("ҚР асу туралы тұжырым жоқ (kzViolation = false)", () => {
    expect(r.kzViolation).toBe(false);
  });

  it("тәуліктік және жылдық нормалар not-comparable, ratio = null", () => {
    const daily = r.checks.filter((c) => c.norm.averaging === "daily");
    const annual = r.checks.filter((c) => c.norm.averaging === "annual");
    expect(daily.length).toBeGreaterThan(0);
    expect(annual.length).toBeGreaterThan(0);
    for (const c of [...daily, ...annual]) {
      expect(c.level).toBe("not-comparable");
      expect(c.ratio).toBeNull();
      expect(c.timesOver).toBeNull();
    }
  });

  it("жиынтық күй асу емес (exceeded жоқ), сағаттық база үшін not-comparable", () => {
    expect(r.worst).not.toBe("exceeded");
    expect(r.worst).not.toBe("exceeded-unverified");
    expect(r.worst).toBe("not-comparable");
  });
});

describe("P1.2 (б): 24 сағаттық орта = 40 → ҚР тәуліктік 35 бойынша асу", () => {
  it("норма расталған (verified), сондықтан kzViolation = true", () => {
    const r = checkCompliance("pm25", 40, "KZ", DAILY_BASIS);
    const kzDaily = r.checks.find((c) => c.norm.averaging === "daily" && c.norm.limit === 35);
    expect(kzDaily?.norm.status).toBe("verified");
    expect(kzDaily?.level).toBe("exceeded");
    expect(r.kzViolation).toBe(true);
  });

  it("сағаттық және жылдық нормалар бұл базаға салыстырылмайды", () => {
    const r = checkCompliance("pm25", 40, "KZ", DAILY_BASIS);
    const annual = r.checks.filter((c) => c.norm.averaging === "annual");
    expect(annual.every((c) => c.level === "not-comparable")).toBe(true);
  });
});

describe("P1.2 (в): жылдық норма тек жылдық базада бағаланады", () => {
  const averagings: Averaging[] = ["max-single", "daily", "annual", "8h", "hourly"];

  for (const a of averagings) {
    it(`базасы «${AVERAGING_KZ[a]}» болғанда annual норма бағаланбайды (жылдық база болмаса)`, () => {
      const basis: ComparisonBasis = { averaging: a, windowHours: 1 };
      const r = checkCompliance("pm25", 40, "KZ", basis);
      const annual = r.checks.filter((c) => c.norm.averaging === "annual");
      expect(annual.length).toBeGreaterThan(0);
      for (const c of annual) {
        if (a === "annual") continue;
        expect(c.level).toBe("not-comparable");
        expect(c.ratio).toBeNull();
      }
    });
  }

  it("жылдық базада annual норма шынымен бағаланады (40 > 5 WHO жылдық)", () => {
    const r = checkCompliance("pm25", 40, "KZ", ANNUAL_BASIS);
    const who = r.checks.find((c) => c.norm.averaging === "annual");
    expect(who?.level).toBe("exceeded");
    expect(who?.ratio).toBe(8);
  });
});

describe("P1.2: сәйкес базасы жоқ индикатор — «асу жоқ», «ok» емес", () => {
  it("сағаттық базада тек сағаттық норма бар индикатор (NO₂ EU 200) — бағаланады, ал PM₂.₅ — not-comparable", () => {
    const no2 = checkCompliance("no2", 250, "KZ", HOURLY_BASIS);
    expect(no2.checks.some((c) => c.norm.averaging === "hourly" && c.level === "exceeded")).toBe(true);
    const pm = checkCompliance("pm25", 10, "KZ", HOURLY_BASIS);
    expect(pm.worst).toBe("not-comparable");
    expect(pm.worst).not.toBe("ok");
  });

  it("мән null → worst = unknown (not-comparable емес)", () => {
    expect(checkCompliance("pm25", null, "KZ", HOURLY_BASIS).worst).toBe("unknown");
  });
});
