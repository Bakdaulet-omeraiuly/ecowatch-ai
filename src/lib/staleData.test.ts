import { describe, expect, it } from "vitest";
import { oldest, staleAge } from "./staleData";

describe("P3.6 stale data age", () => {
  const now = Date.UTC(2026, 10, 4, 12);
  it("minutes, hours, days", () => {
    expect(staleAge(now - 5 * 60e3, now)).toEqual({ value: 5, unit: "min" });
    expect(staleAge(now - 3 * 3600e3, now)).toEqual({ value: 3, unit: "h" });
    expect(staleAge(now - 3 * 86400e3, now)).toEqual({ value: 3, unit: "d" });
  });
  it("never negative", () => { expect(staleAge(now + 60e3, now).value).toBe(0); });
  it("keeps the oldest timestamp", () => {
    expect(oldest(null, 5)).toBe(5);
    expect(oldest(5, 9)).toBe(5);
    expect(oldest(9, 5)).toBe(5);
  });
});
