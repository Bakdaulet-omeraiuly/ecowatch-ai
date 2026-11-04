import { describe, it, expect } from "vitest";
import { classifyAnomaly, ANOMALY_LABEL } from "./fireClassify";
import { FACILITIES, type Facility } from "@/data/facilities";
import { distanceToFootprintKm } from "./footprint";

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
const TWO_AREAS: Facility = {
  ...FAC,
  footprint: [SQUARE, SQUARE.map(([lng, lat]): [number, number] => [lng + 0.04, lat])],
};

describe("classifyAnomaly (P4.6)", () => {
  it("Теңіз OSM контурындағы архив нүктесі → tco өндірістік алауы", () => {
    const tengiz = FACILITIES.find((fac) => fac.id === "tco");
    if (!tengiz?.footprint) throw new Error("Теңіз контуры жоқ");
    // 2025-11-04 FIRMS архив нүктесі; OSM way 227670100 ішінде, буферде емес.
    const lat = 46.15759;
    const lng = 53.41;
    expect(distanceToFootprintKm(lat, lng, tengiz.footprint)).toBe(0);
    const r = classifyAnomaly(lat, lng);
    expect(r.category).toBe("industrial_flare");
    expect(r.facilityId).toBe("tco");
  });

  it.each([
    ["tco", 46.13017, 53.37053], // 3GP, OSM way 670170686
    ["bolashak", 47.2514, 52.46911], // OSM way 183394772
  ])("%s OSM контурының ішкі нүктесі → өндірістік алау (әдепкі тізілім)", (id, lat, lng) => {
    const fac = FACILITIES.find((f) => f.id === id);
    if (!fac?.footprint) throw new Error(`${id} контуры жоқ`);
    expect(distanceToFootprintKm(lat, lng, fac.footprint)).toBe(0);
    const r = classifyAnomaly(lat, lng);
    expect(r.category).toBe("industrial_flare");
    expect(r.facilityId).toBe(id);
  });

  it.each([
    [47.335, 52.2585], // way 1525330128
    [47.3403, 52.2681], // ways 1039563367 + 1067761757
  ])("KPI OSM контурының ішкі нүктесі (%s, %s) → kpi өндірістік алауы", (lat, lng) => {
    const kpi = FACILITIES.find((fac) => fac.id === "kpi");
    if (!kpi?.footprint) throw new Error("KPI контуры жоқ");
    expect(distanceToFootprintKm(lat, lng, kpi.footprint)).toBe(0);
    const r = classifyAnomaly(lat, lng);
    expect(r.category).toBe("industrial_flare");
    expect(r.facilityId).toBe("kpi");
    expect(r.distanceToFootprintKm).toBe(0);
  });

  it("бөлек контурдың 375 м буфері де ескеріледі", () => {
    // Екінші шаршының шығыс жиегі lng=51.95; нүкте одан ~0.23 км.
    const r = classifyAnomaly(47.005, 51.953, [TWO_AREAS]);
    expect(r.category).toBe("industrial_flare");
    expect(r.facilityId).toBe("test-plant");
    expect(r.distanceToFootprintKm).toBeGreaterThan(0);
  });

  it.each([51.93, 51.957])("бөлек контурлар аралығы не буферден тыс нүкте (%s) телінбейді", (lng) => {
    // 51.93 екі шаршы арасында; 51.957 екінші шаршыдан ~0.53 км шығысқа.
    const r = classifyAnomaly(47.005, lng, [TWO_AREAS]);
    expect(r.category).toBe("unconfirmed_anomaly");
    expect(r.facilityId).toBeNull();
  });

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
