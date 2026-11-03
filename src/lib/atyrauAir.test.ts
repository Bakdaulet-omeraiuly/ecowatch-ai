import { describe, expect, it } from "vitest";
import {
  assessRisk, buildGroundReadings, buildModelReadings, type CamsCurrent, type GroundValue,
} from "@/lib/atyrauAir";
import type { AirReading, Pollutant } from "@/lib/airReading";

const FETCHED = "2026-11-03T06:10:00Z";
const FRESH_AT = "2026-11-03T05:30:00Z"; // 40 мин — жаңа
const STALE_AT = "2026-11-03T01:00:00Z"; // ~9 сағат — ескі

const CAMS_FULL: CamsCurrent = {
  time: "2026-11-03T11:00",
  pm2_5: 12, pm10: 20, sulphur_dioxide: 3, nitrogen_dioxide: 9, carbon_monoxide: 250,
};

const byPollutant = (rs: AirReading[], p: Pollutant) => {
  const r = rs.find((x) => x.pollutant === p);
  if (!r) throw new Error(`no reading for ${p}`);
  return r;
};

describe("P1.3: H₂S және NO — ешбір бұтақта басқа газдан сан шықпайды", () => {
  it("CAMS толық болғанда да h2s/no → value null, kind none, себеп: no-model-field", () => {
    const rs = buildModelReadings(CAMS_FULL, FETCHED, true);
    for (const p of ["h2s", "no"] as const) {
      const r = byPollutant(rs, p);
      expect(r.value).toBeNull();
      expect(r.kind).toBe("none");
      expect(r.missingReason).toBe("no-model-field");
    }
  });

  it("CAMS-тың NO₂ мәні NO-ға көшірілмейді (NO value ≠ NO₂ value)", () => {
    const rs = buildModelReadings({ ...CAMS_FULL, nitrogen_dioxide: 77 }, FETCHED, true);
    expect(byPollutant(rs, "no2").value).toBe(77);
    expect(byPollutant(rs, "no").value).toBeNull();
  });

  it("жерүсті деректе тек no2/so2/co бар → h2s және no мәні null", () => {
    const values: GroundValue[] = [
      { parameter: "no2", value: 15, unit: "µg/m³", atUtc: FRESH_AT, stationName: "A", distanceKm: 1 },
      { parameter: "so2", value: 6, unit: "µg/m³", atUtc: FRESH_AT, stationName: "A", distanceKm: 1 },
      { parameter: "co", value: 300, unit: "µg/m³", atUtc: FRESH_AT, stationName: "A", distanceKm: 1 },
    ];
    const rs = buildGroundReadings(values, FETCHED, "ok");
    expect(byPollutant(rs, "h2s").value).toBeNull();
    expect(byPollutant(rs, "no").value).toBeNull();
    expect(byPollutant(rs, "h2s").missingReason).toBe("no-verified-source");
  });

  it("жаңа жерүсті h2s мәні тек h2s жолына түседі, kind = ground, басқа газға таралмайды", () => {
    const values: GroundValue[] = [
      { parameter: "h2s", value: 2.5, unit: "µg/m³", atUtc: FRESH_AT, stationName: "Пост", distanceKm: 2 },
    ];
    const rs = buildGroundReadings(values, FETCHED, "ok");
    const h2s = byPollutant(rs, "h2s");
    expect(h2s.kind).toBe("ground");
    expect(h2s.value).toBe(2.5);
    expect(byPollutant(rs, "no").value).toBeNull();
    expect(byPollutant(rs, "no2").value).toBeNull();
    expect(byPollutant(rs, "so2").value).toBeNull();
  });

  it("жаңа жерүсті no мәні тек no жолына түседі, no2-ге көшпейді", () => {
    const values: GroundValue[] = [
      { parameter: "no", value: 4, unit: "µg/m³", atUtc: FRESH_AT, stationName: "Пост", distanceKm: 2 },
    ];
    const rs = buildGroundReadings(values, FETCHED, "ok");
    expect(byPollutant(rs, "no").value).toBe(4);
    expect(byPollutant(rs, "no2").value).toBeNull();
  });

  it("ескі жерүсті h2s → мән null, себеп: stale-ground (ескі мән ағымдағы болып көрсетілмейді)", () => {
    const values: GroundValue[] = [
      { parameter: "h2s", value: 9, unit: "µg/m³", atUtc: STALE_AT, stationName: "Пост", distanceKm: 2 },
    ];
    const h2s = byPollutant(buildGroundReadings(values, FETCHED, "ok"), "h2s");
    expect(h2s.value).toBeNull();
    expect(h2s.missingReason).toBe("stale-ground");
  });

  it("станса қолжетімсіз → h2s/no null, себеп: source-unavailable", () => {
    const rs = buildGroundReadings(null, FETCHED, "unavailable");
    expect(byPollutant(rs, "h2s").missingReason).toBe("source-unavailable");
    expect(byPollutant(rs, "no").value).toBeNull();
  });

  it("қауіп бағасында h2s және no әрқашан «салыстырылмады» тізімінде (ешқашан low-ға санамайды)", () => {
    const rs = [...buildModelReadings(CAMS_FULL, FETCHED, true)];
    const risk = assessRisk(rs);
    expect(risk.missing).toEqual(expect.arrayContaining(["h2s", "no"]));
    expect(risk.level).not.toBe("low");
  });
});
