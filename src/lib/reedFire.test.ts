import { describe, it, expect } from "vitest";
import {
  reedPolygons,
  reedFireAnomalies,
  downwindBearing,
  smokeCone,
  noWindRing,
  reedAnomalyKey,
  REED_FIRE_SETTLEMENTS,
  type ReedZoneInput,
  type FireAnomalyInput,
  type WindSample,
  type Settlement,
} from "./reedFire";

// Синтетикалық фикстуралар (тест үшін ғана, өнімде қолданылмайды)
const ZONE_OK: ReedZoneInput = {
  id: "delta",
  name: "Тест атырауы",
  bbox: [51.0, 46.0, 51.2, 46.2],
  denseFraction: 0.2,
  status: "ok",
};

const anom = (lat: number, lng: number, extra: Partial<FireAnomalyInput> = {}): FireAnomalyInput => ({
  lat,
  lng,
  acqDate: "2026-11-01",
  dayNight: "D",
  frp: 5,
  category: "unconfirmed_anomaly",
  ...extra,
});

describe("reedPolygons", () => {
  it("ok зона → жабық 5 нүктелі сақина [lng, lat]", () => {
    const [p] = reedPolygons([ZONE_OK]);
    expect(p.id).toBe("delta");
    expect(p.denseFraction).toBe(0.2);
    expect(p.ring).toEqual([
      [51.0, 46.0], [51.2, 46.0], [51.2, 46.2], [51.0, 46.2], [51.0, 46.0],
    ]);
  });

  it("no-data, null және 0 үлесті зоналар алынып тасталады", () => {
    const polys = reedPolygons([
      { ...ZONE_OK, id: "a", status: "no-data", denseFraction: null },
      { ...ZONE_OK, id: "b", denseFraction: null },
      { ...ZONE_OK, id: "c", denseFraction: 0 },
      ZONE_OK,
    ]);
    expect(polys.map((p) => p.id)).toEqual(["delta"]);
  });
});

describe("reedFireAnomalies", () => {
  const polys = reedPolygons([ZONE_OK]);

  it("қамыс полигонының ІШІНДЕГІ аномалия қайтарылады (zoneId-мен)", () => {
    const r = reedFireAnomalies([anom(46.1, 51.1)], polys);
    expect(r).toHaveLength(1);
    expect(r[0].zoneId).toBe("delta");
    expect(r[0].zoneName).toBe("Тест атырауы");
  });

  it("полигоннан ТЫС аномалия қайтарылмайды", () => {
    expect(reedFireAnomalies([anom(46.5, 51.1), anom(46.1, 51.5)], polys)).toHaveLength(0);
  });

  it("полигон ішіндегі өндірістік алау ЕШҚАШАН қамыс өрті болмайды", () => {
    const r = reedFireAnomalies([anom(46.1, 51.1, { category: "industrial_flare" })], polys);
    expect(r).toHaveLength(0);
  });

  it("архив + NRT қайталанған аномалия бір рет қайтарылады", () => {
    const a = anom(46.10001, 51.10001);
    const b = anom(46.10002, 51.10002, { frp: 9 });
    const c = anom(46.1, 51.1, { dayNight: "N" });
    expect(reedFireAnomalies([a, b, c], polys)).toHaveLength(2);
    expect(reedAnomalyKey(a)).toBe(reedAnomalyKey(b));
  });
});

describe("downwindBearing (жел КЕЛЕТІН бағыт + 180°)", () => {
  it.each([
    [0, 180], [90, 270], [270, 90], [200, 20], [360, 180], [-90, 90], [180, 0],
  ])("%d° → %d°", (from, to) => {
    const r = downwindBearing(from);
    expect(r).toBeCloseTo(to, 9);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
  });
});

describe("smokeCone", () => {
  const origin = { lat: 46.1, lng: 51.1 };
  const kmToLng = (km: number) => km / (111 * Math.cos((46.1 * Math.PI) / 180));
  // Шығыста ~10 км және батыста ~10 км елді мекен (синтетикалық)
  const EAST: Settlement = { name: "Шығыс", lat: 46.1, lng: 51.1 + kmToLng(10) };
  const WEST: Settlement = { name: "Батыс", lat: 46.1, lng: 51.1 - kmToLng(10) };
  const wind: WindSample[] = [{ lat: 46.1, lng: 51.1, speed: 18, dir: 270 }];

  it("жарамды жел → status ok, downwind 90, жабық сақина, шығыс елді мекен конуста", () => {
    const c = smokeCone(origin, wind, { settlements: [EAST, WEST] });
    expect(c.status).toBe("ok");
    if (c.status !== "ok") return;
    expect(c.windFrom).toBe(270);
    expect(c.downwind).toBe(90);
    expect(c.speedKmh).toBe(18);
    expect(c.lengthKm).toBeGreaterThan(0);
    expect(c.halfAngleDeg).toBeGreaterThan(0);
    expect(c.ring.length).toBeGreaterThan(3);
    expect(c.ring[0]).toEqual([origin.lng, origin.lat]);
    expect(c.ring[0]).toEqual(c.ring[c.ring.length - 1]);
    const names = c.settlements.map((s) => s.name);
    expect(names).toContain("Шығыс");
    expect(names).not.toContain("Батыс");
    expect(c.settlements[0].distanceKm).toBeCloseTo(10, 0);
  });

  it("конус ұзындығынан алыс елді мекен кірмейді", () => {
    const FAR: Settlement = { name: "Алыс", lat: 46.1, lng: 53.5 };
    const c = smokeCone(origin, wind, { settlements: [FAR] });
    expect(c.status).toBe("ok");
    expect(c.settlements).toEqual([]);
  });

  it.each<[string, WindSample[] | null | undefined]>([
    ["null", null],
    ["undefined", undefined],
    ["бос массив", []],
    ["бәрінде dir null", [{ lat: 46.1, lng: 51.1, speed: 10, dir: null }]],
    ["бәрінде speed null", [{ lat: 46.1, lng: 51.1, speed: null, dir: 90 }]],
    ["NaN", [{ lat: 46.1, lng: 51.1, speed: NaN, dir: 90 }]],
  ])("жел жоқ (%s) → status no-wind, сақина жоқ", (_label, w) => {
    const c = smokeCone(origin, w, { settlements: [EAST, WEST] });
    expect(c.status).toBe("no-wind");
    expect(c.ring).toBeNull();
    expect(c.settlements).toEqual([]);
  });

  it("тізімде БІРІНШІ емес, ең ЖАҚЫН жарамды нүкте таңдалады", () => {
    // Алыс жарамды нүкте тізімде бірінші тұр — «бірінші жарамды» іске асыру
    // downwind 180 қайтарып, сәтсіз болуы тиіс
    const w: WindSample[] = [
      { lat: 48.0, lng: 53.0, speed: 10, dir: 0 },
      { lat: 46.11, lng: 51.11, speed: 10, dir: 90 },
    ];
    const c = smokeCone(origin, w);
    expect(c.status).toBe("ok");
    if (c.status === "ok") expect(c.downwind).toBe(270);
  });

  it("жақын бірақ dir=null нүкте өткізіліп, жарамды нүкте алынады", () => {
    const w: WindSample[] = [
      { lat: 46.1, lng: 51.1, speed: 10, dir: null },
      { lat: 47.0, lng: 52.0, speed: 10, dir: 0 },
      { lat: 48.0, lng: 53.0, speed: 10, dir: 90 },
    ];
    const c = smokeCone(origin, w);
    expect(c.status).toBe("ok");
    if (c.status === "ok") expect(c.downwind).toBe(180);
  });

  it("бағыт ауытқуы Infinity (бағыттар бір-бірін жойса) → 45°-қа шектеледі, 0-ге емес", () => {
    const inf = smokeCone(origin, wind, { dirSigmaDeg: Infinity, settlements: [] });
    const max = smokeCone(origin, wind, { dirSigmaDeg: 45, settlements: [] });
    const zero = smokeCone(origin, wind, { dirSigmaDeg: 0, settlements: [] });
    const nan = smokeCone(origin, wind, { dirSigmaDeg: NaN, settlements: [] });
    if (inf.status !== "ok" || max.status !== "ok" || zero.status !== "ok" || nan.status !== "ok") {
      throw new Error("жарамды желмен status ok күтілді");
    }
    expect(inf.halfAngleDeg).toBe(max.halfAngleDeg);
    expect(inf.halfAngleDeg).toBeGreaterThan(zero.halfAngleDeg);
    // NaN — ауытқу белгісіз → 0 (тек физикалық бұрыш)
    expect(nan.halfAngleDeg).toBe(zero.halfAngleDeg);
  });

  it("әдепкі елді мекендер — облыстың 8 елді мекені (қала + аудан)", () => {
    expect(REED_FIRE_SETTLEMENTS).toHaveLength(8);
    expect(REED_FIRE_SETTLEMENTS.map((s) => s.name)).toContain("Атырау");
  });
});

describe("noWindRing", () => {
  it("N+1 нүктелі жабық сақина [lng, lat]", () => {
    const origin = { lat: 46.1, lng: 51.1 };
    const ring = noWindRing(origin, 3, 16);
    expect(ring).toHaveLength(17);
    expect(ring[0]).toEqual(ring[16]);
    // Бірінші нүкте солтүстікте: lng өзгермейді, lat ~3/111 артады
    expect(ring[0][0]).toBeCloseTo(51.1, 6);
    expect(ring[0][1]).toBeCloseTo(46.1 + 3 / 111, 6);
  });
});
