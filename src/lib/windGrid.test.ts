import { describe, expect, it } from "vitest";
import { buildWindGrid } from "@/lib/windGrid";

const PTS = [
  { lat: 47.1, lng: 51.9 },
  { lat: 47.2, lng: 52.0 },
  { lat: 47.3, lng: 52.1 },
];

describe("P1.10: windgrid — дерек жоқта null, нөл емес", () => {
  it("бос `current` → speed: null, dir: null, avgSpeed: null (0 емес)", () => {
    const r = buildWindGrid([{}, { current: {} }, { current: null }], PTS);
    expect(r.grid.every((g) => g.speed === null && g.dir === null)).toBe(true);
    expect(r.avgSpeed).toBeNull();
    expect(r.maxSpeed).toBeNull();
    expect(r.dominantDir).toBeNull();
    expect(r.validCount).toBe(0);
    expect(r.missingCount).toBe(3);
  });

  it("aralас тор: орташа/максимум тек жарамды нүктелер бойынша, бос нүкте 0 болып кірмейді", () => {
    const r = buildWindGrid(
      [
        { current: { wind_speed_10m: 10, wind_direction_10m: 90 } },
        { current: {} },
        { current: { wind_speed_10m: 20, wind_direction_10m: 90 } },
      ],
      PTS
    );
    expect(r.avgSpeed).toBe(15); // (10+20)/2, не (10+0+20)/3
    expect(r.maxSpeed).toBe(20);
    expect(r.validCount).toBe(2);
    expect(r.missingCount).toBe(1);
    expect(r.grid[1].speed).toBeNull();
    expect(r.dominantDir).toBe(90);
  });

  it("нақты нөлдік жел (0 м/с) — 0, бұл null-дан өзгеше", () => {
    const r = buildWindGrid([{ current: { wind_speed_10m: 0, wind_direction_10m: 180 } }], [PTS[0]]);
    expect(r.grid[0].speed).toBe(0);
    expect(r.avgSpeed).toBe(0);
    expect(r.maxSpeed).toBe(0);
    expect(r.validCount).toBe(1);
  });

  it("жылдамдық бар, бағыт жоқ → жылдамдық есепке кіреді, басым бағыт null", () => {
    const r = buildWindGrid([{ current: { wind_speed_10m: 7 } }], [PTS[0]]);
    expect(r.avgSpeed).toBe(7);
    expect(r.grid[0].dir).toBeNull();
    expect(r.dominantDir).toBeNull();
  });

  it("жарамсыз (NaN/жол) мән null болады, 0 емес", () => {
    const r = buildWindGrid(
      [{ current: { wind_speed_10m: Number.NaN, wind_direction_10m: "270" as unknown as number } }],
      [PTS[0]]
    );
    expect(r.grid[0].speed).toBeNull();
    expect(r.grid[0].dir).toBeNull();
    expect(r.maxSpeed).toBeNull();
  });
});
