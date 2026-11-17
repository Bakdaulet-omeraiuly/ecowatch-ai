import { describe, expect, it } from "vitest";
import { computeSPI, lastCompleteMonth } from "./spi";

describe("lastCompleteMonth", () => {
  it("drops a month that has not ended", () => {
    expect(lastCompleteMonth("2026-11-10")).toBe("2026-10");
    expect(lastCompleteMonth("2026-01-15")).toBe("2025-12");
  });
  it("keeps a month whose last day is present", () => {
    expect(lastCompleteMonth("2026-11-30")).toBe("2026-11");
    expect(lastCompleteMonth("2024-02-29")).toBe("2024-02");
    expect(lastCompleteMonth("2026-02-28")).toBe("2026-02");
  });
  it("treats 28 February of a leap year as incomplete", () => {
    expect(lastCompleteMonth("2024-02-28")).toBe("2024-01");
  });
});

describe("computeSPI", () => {
  const history = [20, 35, 28, 44, 31, 52, 26, 39, 33, 47, 30, 41, 24, 36, 29];
  it("is near zero at the median and signed correctly around it", () => {
    expect(Math.abs(computeSPI(history, 33)!)).toBeLessThan(0.3);
    expect(computeSPI(history, 12)!).toBeLessThan(-1.5);
    expect(computeSPI(history, 70)!).toBeGreaterThan(1.5);
  });
  it("a partial-month total reads drier than the same season's full total", () => {
    expect(computeSPI(history, 33 * 0.6)!).toBeLessThan(computeSPI(history, 33)! - 0.8);
  });
  it("needs at least 10 years", () => {
    expect(computeSPI([1, 2, 3], 2)).toBeNull();
  });
});
