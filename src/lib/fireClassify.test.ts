import { describe, it, expect } from "vitest";
import { classifyAnomaly, ANOMALY_LABEL } from "./fireClassify";
import type { Facility } from "@/data/facilities";

// Синтетикалық контур (тест фикстурасы): ~1.1 км × 1.1 км шаршы
const SQUARE: [number, number][] = [
  [51.90, 47.00], [51.91, 47.00], [51.91, 47.01], [51.90, 47.01], [51.90, 47.00],
];
const FAC = {
  id: "test-plant",
  name: "Тест зауыты",
  short: "T",
  lat: 47.005,
  lng: 51.905,
  kind: "test",
  footprint: SQUARE,
  profile: { so2: 0, no2: 0, pm: 0, voc: 0 },
} as Facility;
const NO_FOOTPRINT = { ...FAC, id: "no-contour", name: "Контурсыз", footprint: undefined } as Facility;

describe("classifyAnomaly (P4.6)", () => {
  it("контур ішіндегі нүкте → өндірістік алау", () => {
    const r = classifyAnomaly(47.005, 51.905, [FAC]);
    expect(r.category).toBe("industrial_flare");
    expect(r.facilityId).toBe("test-plant");
    expect(r.facilityName).toBe("Тест зауыты");
    expect(r.distanceToFootprintKm).toBe(0);
  });

  it("контурдан 375 м буфер ішіндегі нүкте → өндірістік алау", () => {
    // Шаршының шығыс жиегі lng=51.91; lat 47.005-те 0.003° lng ≈ 0.23 км (<0.375 км)
    const r = classifyAnomaly(47.005, 51.913, [FAC]);
    expect(r.category).toBe("industrial_flare");
  });

  it("буферден тыс нүкте → жылу аномалиясы (расталмаған)", () => {
    // lat 47.005-те 0.02° lng ≈ 1.52 км — буферден тыс
    const r = classifyAnomaly(47.005, 51.93, [FAC]);
    expect(r.category).toBe("unconfirmed_anomaly");
    expect(r.facilityId).toBeNull();
    expect(r.distanceToFootprintKm).toBeNull();
  });

  it("контуры жоқ нысанға ешқашан телінбейді", () => {
    const r = classifyAnomaly(47.005, 51.905, [NO_FOOTPRINT]);
    expect(r.category).toBe("unconfirmed_anomaly");
  });

  it("тізімде нысан жоқ → расталмаған аномалия", () => {
    expect(classifyAnomaly(47.005, 51.905, []).category).toBe("unconfirmed_anomaly");
  });

  it("жапсырмалар: KZ және RU, «өрт» сөзі жоқ", () => {
    expect(ANOMALY_LABEL.industrial_flare).toEqual({ kk: "өндірістік алау", ru: "промышленный факел" });
    expect(ANOMALY_LABEL.unconfirmed_anomaly.kk).toBe("жылу аномалиясы (расталмаған)");
    expect(ANOMALY_LABEL.unconfirmed_anomaly.ru).toBe("тепловая аномалия (не подтверждена)");
    for (const v of Object.values(ANOMALY_LABEL)) {
      expect(`${v.kk} ${v.ru}`.toLowerCase()).not.toMatch(/расталған өрт|подтвержд[её]нн\w* пожар/);
    }
  });
});
