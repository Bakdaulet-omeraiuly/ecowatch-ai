import { NextResponse } from "next/server";
import { GREEN_CITY_BBOX, GRID_ROWS, GRID_COLS, CHANGE_PP, VEG_NDVI, NDVI_CAVEATS } from "@/data/greenery";
import { getRegion, hasModule, moduleUnavailable } from "@/data/regions";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";
import { MIN_COVERAGE } from "@/lib/floodSar";
import { NDVI_DENSE, REED_RES_M } from "@/lib/reedHabitat";
import { summerSeasons, cityCells, fetchGreenWeekly, seasonStat, cellChange, type GreenChangeData, type GreenChangeCell, type GreenSeasonStat } from "@/lib/greenNdvi";

export const revalidate = 86400;
export const maxDuration = 60;
const cache = new Map<string, { at: number; data: GreenChangeData }>();

export async function GET(req: Request) {
  const region = getRegion(new URL(req.url).searchParams.get("region"));
  if (!hasModule(region, "greenery")) return NextResponse.json(moduleUnavailable(region, "greenery"));
  if (!hasCdseKeys()) return NextResponse.json({
    error: "Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді",
  }, { status: 503, headers: { "Cache-Control": "no-store" } });
  const seasons = summerSeasons(new Date());
  const cacheKey = `${region.id}/${seasons.recent.year}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < revalidate * 1000) return NextResponse.json(hit.data);
  try {
    const token = await cdseToken();
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(48000)]);
    const cells = cityCells(GREEN_CITY_BBOX[region.id], GRID_ROWS, GRID_COLS);
    const jobs = cells.flatMap((cell) => ["baseline", "recent"].map((key) => ({ cell, key: key as "baseline" | "recent" })));
    const results = new Map<string, GreenSeasonStat | null>();
    let recentRequestsFailed = false;
    let anyRequestFailed = false;
    let next = 0;
    // Бір мезетте төрттен артық Statistical API сұранысы жіберілмейді.
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (next < jobs.length) {
        const { cell, key } = jobs[next++];
        const season = seasons[key];
        try {
          const weeks = await fetchGreenWeekly(token, cell.bbox, season.from, season.to, signal);
          results.set(`${cell.id}/${key}`, seasonStat(weeks));
        } catch {
          anyRequestFailed = true;
          if (key === "recent") recentRequestsFailed = true;
          results.set(`${cell.id}/${key}`, null);
        }
      }
    }));
    const output: GreenChangeCell[] = cells.map((cell) => {
      const baseline = results.get(`${cell.id}/baseline`) ?? null;
      const recent = results.get(`${cell.id}/recent`) ?? null;
      return { ...cell, baseline, recent, change: cellChange(baseline, recent), status: baseline && recent ? "ok" : baseline || recent ? "partial" : "no-data" };
    });
    if (!output.some((cell) => cell.recent)) return NextResponse.json({
      error: "Sentinel-2 NDVI деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді",
      reason: recentRequestsFailed
        ? "Sentinel Hub Statistical API қатесі"
        : "бұлтсыз, қамтуы жеткілікті Sentinel-2 өтуі табылмады",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const summary = { up: 0, down: 0, stable: 0, noData: 0 };
    for (const cell of output) {
      if (cell.change) summary[cell.change.trend]++;
      else summary.noData++;
    }
    const data: GreenChangeData = {
      fetchedAt: new Date().toISOString(), source: "Copernicus Sentinel-2 L2A · Sentinel Hub Statistical API",
      tier: "measurement", label: "Спутник индексі (NDVI) — жердегі шындық емес", seasons,
      thresholds: { VEG_NDVI, NDVI_DENSE, CHANGE_PP, MIN_COVERAGE }, resolutionM: REED_RES_M,
      cells: output, summary, caveats: NDVI_CAVEATS,
    };
    // A partial result (some requests failed, e.g. rate limit) is served but not cached:
    // otherwise failed cells would look like "no cloud-free pass" for 24 hours.
    if (!anyRequestFailed) cache.set(cacheKey, { at: Date.now(), data });
    return NextResponse.json(data, anyRequestFailed ? { headers: { "Cache-Control": "no-store" } } : undefined);
  } catch (err) {
    console.error("green-change:", err);
    return NextResponse.json({
      error: "Sentinel-2 NDVI деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді",
      reason: "Sentinel Hub Statistical API қатесі",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
