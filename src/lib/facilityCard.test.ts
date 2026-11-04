import { describe, expect, it } from "vitest";
import { FACILITIES, type Facility } from "@/data/facilities";
import { buildFacilityCard, DEREK_JOQ } from "@/lib/facilityCard";

const base: Facility = {
  id: "t", name: "Тест зауыты", short: "Т", lat: 47.1, lng: 51.9,
  kind: "Мұнай өңдеу", profile: { so2: 0.5, no2: 0.5, pm: 0.5, voc: 0.5 },
};

describe("P2.1: нысан карточкасы — дерек жоқ болса 'Дерек жоқ'", () => {
  it("жазба жоқ нысан: көздер саны мен масса null, барлығы missing", () => {
    const c = buildFacilityCard(base);
    expect(c.emissionSources.value).toBeNull();
    expect(c.emissionSources.label).toBe(DEREK_JOQ);
    expect(c.emissionMass.value).toBeNull();
    expect(c.emissionMass.label).toBe(DEREK_JOQ);
    expect(c.substances).toEqual([]);
    expect(c.monitoringPosts).toEqual([]);
    expect(c.verifiedEvents).toEqual([]);
    expect(c.missing).toEqual(expect.arrayContaining(["emissionSources", "emissionMass", "substances", "monitoringPosts", "verifiedEvents", "source"]));
  });

  it("көздер саны мен шығарынды массасы БӨЛЕК: көз саны бар, масса жоқ → масса null", () => {
    const c = buildFacilityCard({
      ...base,
      record: { emissionSources: { count: 12, source: "Реестр", date: "2025-01-01" } },
    });
    expect(c.emissionSources.value?.count).toBe(12);
    expect(c.emissionMass.value).toBeNull();
    expect(c.missing).not.toContain("emissionSources");
    expect(c.missing).toContain("emissionMass");
  });

  it("масса көз санына айналмайды: масса бар, көздер саны жоқ → көз саны null", () => {
    const c = buildFacilityCard({
      ...base,
      record: { emissionMass: { value: 340, unit: "т/жыл", period: "2024", source: "Есеп", date: "2025-03-01" } },
    });
    expect(c.emissionMass.value).toMatchObject({ value: 340, unit: "т/жыл", period: "2024" });
    expect(c.emissionSources.value).toBeNull();
    expect(c.emissionSources.label).toBe(DEREK_JOQ);
  });

  it("масса бірлігі/кезеңі/дереккөзі жоқ болса — көрсетілмейді", () => {
    const c = buildFacilityCard({
      ...base,
      record: { emissionMass: { value: 340, unit: "", period: "2024", source: "Есеп", date: "2025-03-01" } },
    });
    expect(c.emissionMass.value).toBeNull();
  });

  it("зат: дереккөзі/күні жоқ жазба тізімге кірмейді", () => {
    const c = buildFacilityCard({
      ...base,
      record: {
        substances: [
          { name: "SO₂", amount: 10, unit: "т", period: "2024", source: "Есеп", date: "2025-01-01" },
          { name: "NO₂", amount: 5, unit: "т", period: "2024", source: "", date: "2025-01-01" },
          { name: "CO", amount: 1, unit: "т", period: "2024", source: "Есеп", date: "" },
        ],
      },
    });
    expect(c.substances.map((s) => s.name)).toEqual(["SO₂"]);
  });

  it("координата: жуық белгісі approx-пен; дереккөз жоқ болса 'Дерек жоқ'", () => {
    const approx = buildFacilityCard({ ...base, approx: true });
    expect(approx.coords.approx).toBe(true);
    expect(approx.coords.precision.value).toMatch(/жуық/);
    const exact = buildFacilityCard({ ...base, coordSource: "X" });
    expect(exact.coords.precision.value).toMatch(/4 ондық/);
    expect(exact.coords.source.value).toBe("X");
    const nosrc = buildFacilityCard(base);
    expect(nosrc.coords.source.label).toBe(DEREK_JOQ);
  });
});

describe("P2.1: координата дереккөзінің күні — ойдан қосылмайды", () => {
  it("күні жоқ → sourceDate null, missing-те бар", () => {
    const c = buildFacilityCard({ ...base, coordSource: "Global Energy Monitor" });
    expect(c.sourceDate.value).toBeNull();
    expect(c.sourceDate.label).toBe(DEREK_JOQ);
    expect(c.missing).toContain("sourceDate");
  });

  it("күні бар → sourceDate мәні сол күн, missing-те жоқ", () => {
    const c = buildFacilityCard({ ...base, coordSource: "X", coordDate: "2025-06-01" });
    expect(c.sourceDate.value).toBe("2025-06-01");
    expect(c.missing).not.toContain("sourceDate");
  });
});

describe("АМӨЗ: шығарынды есептері — нақты мен лимит бөлек", () => {
  const card = buildFacilityCard(FACILITIES.find((f) => f.id === "anpz")!);
  it("нақты масса — тек 2022, баспасөз қызметінің саны", () => {
    expect(card.emissionMass.value).toMatchObject({ value: 10412, unit: "т", period: "2022" });
  });
  it("лимиттер бөлек өрісте, 2022 лимиті 19 066 т; нақты/лимит ≈ 55% («45% аз» сәйкес)", () => {
    const l2022 = card.emissionLimits.find((l) => l.period === "2022")!;
    expect(l2022.value).toBeCloseTo(19066.316, 3);
    expect(Math.round((10412 / l2022.value) * 100)).toBe(55);
  });
  it("зат бойынша лимиттердің қосындысы НДВ жиынтығына жуық (16 219 т; негізгі 14 заттың үлесі)", () => {
    const sum = card.substanceLimits.reduce((a, s) => a + s.amount, 0);
    expect(sum).toBeLessThanOrEqual(16219.133);
    expect(sum).toBeGreaterThan(15000);
    expect(card.substances).toHaveLength(0); // лимит «заттар» (нақты) тізіміне түспейді
  });
  it("шығарынды көздері 288", () => expect(card.emissionSources.value?.count).toBe(288));
});
