import { describe, it, expect } from "vitest";
import { toUV, gridAxes, integrateBack, nearestOnPath, GRID_N, type WindField } from "./backTrajectory";

function uniform(lat: number, lng: number, speed: number, dirFrom: number, t0: number): WindField {
  const { lats, lngs } = gridAxes(lat, lng);
  const times = Array.from({ length: 30 }, (_, k) => t0 - (29 - k) * 3600_000);
  const [u, v] = toUV(speed, dirFrom);
  const g = (x: number) => times.map(() => lats.map(() => new Array(GRID_N).fill(x)));
  return { lats, lngs, times, u: g(u), v: g(v) };
}

describe("backTrajectory", () => {
  it("toUV: батыс желі (270°) шығысқа соғады", () => {
    const [u, v] = toUV(10, 270);
    expect(u).toBeCloseTo(10); expect(v).toBeCloseTo(0);
  });
  it("батыс желінде траектория батысқа қарай кері жүреді, 5 м/с × 6 сағ ≈ 108 км", () => {
    const t0 = Date.UTC(2026, 10, 4, 12);
    const f = uniform(47.1, 51.9, 5, 270, t0);
    const { points, truncated } = integrateBack(f, 47.1, 51.9, t0, 6);
    expect(truncated).toBe(false);
    const last = points[points.length - 1];
    expect(last.lng).toBeLessThan(51.9);
    const km = (51.9 - last.lng) * 111.32 * Math.cos((47.1 * Math.PI) / 180);
    expect(km).toBeGreaterThan(105); expect(km).toBeLessThan(111);
    expect(last.lat).toBeCloseTo(47.1, 3);
  });
  it("тордан шыққанда тоқтайды", () => {
    const t0 = Date.UTC(2026, 10, 4, 12);
    const f = uniform(47.1, 51.9, 20, 270, t0); // 72 км/сағ → 24 сағатта тордан шығады
    expect(integrateBack(f, 47.1, 51.9, t0, 24).truncated).toBe(true);
  });
  it("маршрутқа ең жақын қашықтық", () => {
    const pts = [{ lat: 47, lng: 51, t: 0, hoursBack: 0 }, { lat: 47, lng: 50, t: 0, hoursBack: 1 }];
    const r = nearestOnPath(pts, 47.01, 50.5);
    expect(r.km).toBeCloseTo(1.11, 1); expect(r.hoursBack).toBeCloseTo(0.5, 1);
  });
});
