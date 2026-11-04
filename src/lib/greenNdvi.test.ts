import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cityCells, summerSeasons, fetchGreenWeekly, seasonStat, cellChange, type GreenWeek } from "./greenNdvi";
import { GREEN_CITY_BBOX } from "@/data/greenery";
import { MIN_COVERAGE } from "./floodSar";

// Синтетикалық апталар және Statistical API жауаптары — тек тест үшін.
const week = (value: number, date = "2026-06-01", coverage = 0.9): GreenWeek => ({ date, meanNdvi: value, vegFraction: value, denseFraction: value / 2, waterFraction: value / 10, coverage });
const stat = (value: number) => seasonStat([week(value), week(value, "2026-06-08")])!;
const statsJson = () => ({ data: ["2026-06-01T00:00:00Z", "2026-06-08T00:00:00Z"].map((from) => ({
  interval: { from }, outputs: Object.fromEntries(["ndvi", "veg", "dense", "water"].map((key) => [key, { bands: { B0: { stats: { mean: 0.2, sampleCount: 100, noDataCount: 20 } } } } ])),
})) });

beforeEach(() => vi.resetModules());
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("P4.1 Sentinel-2 greenery change", () => {
  it("compares complete summers five years apart in UTC", () => {
    expect(summerSeasons(new Date("2026-11-03T00:00:00Z"))).toEqual({ baseline: { year: 2021, from: "2021-06-01", to: "2021-08-31" }, recent: { year: 2026, from: "2026-06-01", to: "2026-08-31" } });
    expect(summerSeasons(new Date("2026-07-01T00:00:00Z")).recent.year).toBe(2025);
    expect(summerSeasons(new Date("2026-08-31T23:59:59Z")).recent.year).toBe(2025);
    expect(summerSeasons(new Date("2026-09-01T00:00:00Z")).recent.year).toBe(2026);
  });
  it("tiles the city window with nine touching cells, north first", () => {
    const cells = cityCells(GREEN_CITY_BBOX.atyrau, 3, 3);
    expect(cells).toHaveLength(9);
    expect(cells[0]).toMatchObject({ id: "r0c0", pos: "nw" });
    expect(cells[0].bbox[0]).toBe(51.72);
    expect(cells[0].bbox[3]).toBe(47.3);
    expect(cells[8].bbox[1]).toBe(47);
    expect(cells[8].bbox[2]).toBe(52.12);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      const cell = cells[r * 3 + c];
      if (c < 2) expect(cell.bbox[2]).toBe(cells[r * 3 + c + 1].bbox[0]);
      if (r < 2) expect(cell.bbox[1]).toBe(cells[(r + 1) * 3 + c].bbox[3]);
    }
    const area = cells.reduce((a, c) => a + (c.bbox[2] - c.bbox[0]) * (c.bbox[3] - c.bbox[1]), 0);
    expect(area).toBeCloseTo(0.4 * 0.3, 10);
  });
  it("requires two covered weeks and computes medians, never zero-fills", () => {
    expect(seasonStat([])).toBeNull();
    expect(seasonStat([week(0.2), week(0.4, "2026-06-08", MIN_COVERAGE - 0.01)])).toBeNull();
    const result = seasonStat([week(0.8, "2026-06-15"), week(0.1, "2026-06-01", MIN_COVERAGE), week(0.3, "2026-06-08"), week(1, "2026-06-22", 0.1)]);
    expect(result).toMatchObject({ meanNdvi: 0.3, vegFraction: 0.3, denseFraction: 0.15, waterFraction: 0.03, usableWeeks: 3, firstDate: "2026-06-01", lastDate: "2026-06-15" });
    expect(seasonStat([week(0.1), week(0.5, "2026-06-08")])?.vegFraction).toBe(0.3);
    expect(seasonStat([week(NaN), week(0.1)])).toBeNull();
  });
  it("uses vegetated share and inclusive ±5 percentage-point thresholds", () => {
    expect(cellChange(null, stat(0.2))).toBeNull();
    expect(cellChange(stat(0.2), null)).toBeNull();
    expect(cellChange(stat(0.2), stat(0.25))?.trend).toBe("up");
    expect(cellChange(stat(0.2), stat(0.15))?.trend).toBe("down");
    expect(cellChange(stat(0.2), stat(0.249))?.trend).toBe("stable");
    expect(cellChange(stat(0.2), { ...stat(0.2), meanNdvi: -0.5 })?.trend).toBe("stable");
  });
  it("requests actual S2 bands, cloud mask, 60 m Mercator and weekly statistics", async () => {
    const data = statsJson();
    data.data.push({ interval: { from: "2026-06-15T00:00:00Z" }, outputs: {} });
    const fetcher = vi.fn().mockResolvedValue(Response.json(data));
    vi.stubGlobal("fetch", fetcher);
    const weeks = await fetchGreenWeekly("test-token", GREEN_CITY_BBOX.atyrau, "2026-06-01", "2026-08-31");
    expect(weeks).toHaveLength(2);
    expect(weeks[0]).toMatchObject({ meanNdvi: 0.2, waterFraction: 0.2, coverage: 0.8 });
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.input.bounds.properties.crs).toContain("3857");
    expect(body.input.bounds.bbox[0]).toBeGreaterThan(5_000_000);
    expect(body.aggregation).toMatchObject({ resx: 60, resy: 60, aggregationInterval: { of: "P7D" } });
    expect(body.aggregation.evalscript).toContain('"B04", "B08", "SCL", "dataMask"');
    expect(body.aggregation.evalscript).toContain("s.SCL === 11");
    expect(body.aggregation.evalscript).toContain("s.SCL === 6");
  });
  it("propagates Statistical API failure instead of inventing a series", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
    await expect(fetchGreenWeekly("test", GREEN_CITY_BBOX.atyrau, "2026-06-01", "2026-08-31")).rejects.toThrow("503");
  });
  it("returns the exact 503 message when CDSE keys are absent", async () => {
    vi.stubEnv("SENTINELHUB_CLIENT_ID", "");
    vi.stubEnv("SENTINELHUB_CLIENT_SECRET", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/green-change/route");
    const res = await GET(new Request("http://localhost/api/green-change"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("limits 18 season requests to four, preserves partial cells, and does not cache a partial result", async () => {
    const cdse = await import("./cdse");
    vi.spyOn(cdse, "hasCdseKeys").mockReturnValue(true);
    vi.spyOn(cdse, "cdseToken").mockResolvedValue("test-token");
    let active = 0, maxActive = 0, calls = 0;
    const fetcher = vi.fn().mockImplementation(async () => {
      const index = calls++;
      maxActive = Math.max(maxActive, ++active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return index === 0 ? new Response("", { status: 503 }) : Response.json(statsJson());
    });
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/green-change/route");
    const req = () => new Request("http://localhost/api/green-change");
    const res = await GET(req());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.cells).toHaveLength(9);
    expect(data.cells[0]).toMatchObject({ baseline: null, change: null, status: "partial", recent: { vegFraction: 0.2 } });
    expect(data.summary).toEqual({ up: 0, down: 0, stable: 8, noData: 1 });
    expect(maxActive).toBe(4);
    expect(calls).toBe(18);
    // One request failed → the result is partial → it must be re-fetched, not cached for 24 h.
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await GET(req());
    expect(calls).toBe(36);
  });
  it.each([
    { name: "all season requests fail", failedJobs: Array.from({ length: 18 }, (_, i) => i), reason: "Sentinel Hub Statistical API қатесі" },
    { name: "one recent request fails and the others have no observations", failedJobs: [1], reason: "Sentinel Hub Statistical API қатесі" },
    { name: "only baseline requests fail and recent requests have no observations", failedJobs: Array.from({ length: 9 }, (_, i) => i * 2), reason: "бұлтсыз, қамтуы жеткілікті Sentinel-2 өтуі табылмады" },
  ])("returns the correct 503 reason when $name", async ({ failedJobs, reason }) => {
    const cdse = await import("./cdse");
    vi.spyOn(cdse, "hasCdseKeys").mockReturnValue(true);
    vi.spyOn(cdse, "cdseToken").mockResolvedValue("test-token");
    let calls = 0;
    const fetcher = vi.fn().mockImplementation(async () => failedJobs.includes(calls++)
      ? new Response("", { status: 503 })
      : Response.json({ data: [] }));
    vi.stubGlobal("fetch", fetcher);
    const { GET } = await import("@/app/api/green-change/route");
    const res = await GET(new Request("http://localhost/api/green-change"));
    expect(fetcher).toHaveBeenCalledTimes(18);
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({
      error: "Sentinel-2 NDVI деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді",
      reason,
    });
  });
  it("returns 503 with fixed reasons if all observations or token acquisition fail", async () => {
    const cdse = await import("./cdse");
    vi.spyOn(cdse, "hasCdseKeys").mockReturnValue(true);
    const token = vi.spyOn(cdse, "cdseToken").mockResolvedValue("test-token");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => Promise.resolve(Response.json({ data: [] }))));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/green-change/route");
    const first = await GET(new Request("http://localhost/api/green-change"));
    expect(first.status).toBe(503);
    expect((await first.json()).reason).toBe("бұлтсыз, қамтуы жеткілікті Sentinel-2 өтуі табылмады");
    token.mockRejectedValue(new Error("private upstream detail"));
    const second = await GET(new Request("http://localhost/api/green-change"));
    expect(second.status).toBe(503);
    expect((await second.json()).reason).toBe("Sentinel Hub Statistical API қатесі");
  });
});
