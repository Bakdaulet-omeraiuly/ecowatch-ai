import { describe, expect, it } from "vitest";
import {
  aggregateBuckets, bearingDeg, expectedHours, facilityBearings, fetchChunks, normLines,
  resolveRange, sectorIndex, windSectors, DATA_START, type HourRow,
} from "./sourceAnalytics";

const hours = (day: string, n: number, value: number | null, windFrom = 90, windSpeed = 3): HourRow[] =>
  Array.from({ length: n }, (_, h) => ({ time: `${day}T${String(h).padStart(2, "0")}:00`, value, windFrom, windSpeed }));

describe("aggregateBuckets", () => {
  it("averages a full day and reports its maximum", () => {
    const rows = hours("2024-03-01", 24, 10); rows[5].value = 34;
    const [d] = aggregateBuckets(rows, "day");
    expect(d).toMatchObject({ key: "2024-03-01", mean: 11, max: 34, n: 24, expected: 24, coverage: 1 });
  });
  it("suppresses a day below 75% coverage instead of averaging what is there", () => {
    const [d] = aggregateBuckets([...hours("2024-03-01", 17, 10), ...hours("2024-03-01", 7, null).map((r, i) => ({ ...r, time: `2024-03-01T${17 + i}:00` }))], "day");
    expect(d.mean).toBeNull();
    expect(d.n).toBe(17);
  });
  it("suppresses a partial month and a partial year", () => {
    const rows = hours("2024-03-01", 24, 10);
    expect(aggregateBuckets(rows, "month")[0]).toMatchObject({ mean: null, expected: 31 * 24 });
    expect(aggregateBuckets(rows, "year")[0]).toMatchObject({ mean: null, expected: 366 * 24 });
  });
  it("knows leap years and month lengths", () => {
    expect(expectedHours("2023", "year")).toBe(365 * 24);
    expect(expectedHours("2024-02", "month")).toBe(29 * 24);
  });
});

describe("windSectors", () => {
  it("bins by the direction the wind blows FROM and drops calm hours", () => {
    const rows = [...hours("2024-03-01", 24, 20, 90, 3), ...hours("2024-03-02", 24, 5, 270, 3), ...hours("2024-03-03", 24, 99, 90, 0.4)];
    const w = windSectors(rows);
    expect(w.calmHours).toBe(24);
    expect(w.sectors[sectorIndex(90)]).toMatchObject({ label: "Ш", mean: 20, n: 24 });
    expect(w.sectors[sectorIndex(270)]).toMatchObject({ label: "Б", mean: 5, n: 24 });
    expect(w.overallMean).toBe(12.5);
  });
  it("gives no mean for a sector with fewer than 24 hours", () => {
    expect(windSectors(hours("2024-03-01", 23, 20, 180)).sectors[sectorIndex(180)].mean).toBeNull();
  });
  it("wraps directions near north into one sector", () => {
    expect(sectorIndex(359)).toBe(0);
    expect(sectorIndex(11)).toBe(0);
    expect(sectorIndex(12)).toBe(1);
  });
});

describe("facility bearings", () => {
  it("computes compass bearings", () => {
    expect(Math.round(bearingDeg(47, 52, 48, 52))).toBe(0);
    expect(Math.round(bearingDeg(47, 52, 47, 53))).toBe(90);
  });
  it("lists only nearby facilities, nearest first", () => {
    const f = facilityBearings(47.1167, 51.8833);
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => x.distanceKm <= 60)).toBe(true);
    expect(f.map((x) => x.distanceKm)).toEqual([...f.map((x) => x.distanceKm)].sort((a, b) => a - b));
    expect(f.find((x) => x.id === "tco")).toBeUndefined();
  });
});

describe("normLines", () => {
  const stat = (mean: number | null) => ({ key: "k", mean, max: mean, n: 24, expected: 24, coverage: 1 });
  it("compares daily means only with daily norms", () => {
    const lines = normLines("pm25", "day", [stat(10), stat(400), stat(null)]);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((l) => l.overCount === 1)).toBe(true);
  });
  it("offers no norm for monthly means", () => {
    expect(normLines("pm25", "month", [stat(400)])).toEqual([]);
  });
});

describe("resolveRange / fetchChunks", () => {
  const now = new Date("2026-11-17T00:00:00Z");
  it("clips to the available record", () => {
    expect(resolveRange("2020-01-01", "2026-12-31", "year", now)).toEqual({ ok: true, from: DATA_START, to: "2026-11-10", clipped: true });
  });
  it("rejects hourly ranges longer than a week and malformed dates", () => {
    expect(resolveRange("2024-03-01", "2024-03-20", "hour", now).ok).toBe(false);
    expect(resolveRange("2024-03-01", "2024-03-07", "hour", now).ok).toBe(true);
    expect(resolveRange("x", "2024-03-07", "day", now).ok).toBe(false);
    expect(resolveRange("2021-01-01", "2021-12-31", "month", now).ok).toBe(false);
  });
  it("splits monthly and yearly requests by calendar year", () => {
    expect(fetchChunks(DATA_START, "2024-06-30", "month", now)).toEqual([
      { start: DATA_START, end: "2022-12-31", complete: true },
      { start: "2023-01-01", end: "2023-12-31", complete: true },
      { start: "2024-01-01", end: "2024-12-31", complete: true },
    ]);
    expect(fetchChunks("2026-01-01", "2026-11-10", "year", now)).toEqual([{ start: "2026-01-01", end: "2026-11-10", complete: false }]);
    expect(fetchChunks("2024-03-01", "2024-03-07", "hour", now)).toEqual([{ start: "2024-03-01", end: "2024-03-07", complete: true }]);
  });
});
