// АЙМАҚ ЕСЕБІ — полигон бойынша нақты көрсеткіштер (GFW «Analyze» үлгісі).
// POST { ring: [lng,lat][], metric: ndvi|no2|fires|overlay, months?: 1..24, format?: "json"|"csv" }
// CSV тек EXPORT_ROLES (scientist/officer/admin) — /api/export сияқты.
// Көз қолжетімсіз → 503 + себебі. Жоқ ай → null. Мок жоқ.

import { NextResponse } from "next/server";
import { z } from "zod";
import { validateRing } from "@/lib/areaGeo";
import { AREA_METRICS, ndviMonthly, no2Monthly, firesInArea, overlayInArea, type MonthRow } from "@/lib/areaStats";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";
import { FirmsKeyError } from "@/lib/firms";
import { getRegion } from "@/data/regions";
import { allow } from "@/lib/ratelimit";
import { EXPORT_ROLES, requireRole } from "@/lib/auth";
import { toCsv, withProvenance, csvHeaders, type Cell } from "@/lib/csv";
import { AREA_CAVEATS, AREA_SOURCES } from "@/data/areaReport";

export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };
// Copernicus квотасын үнемдеу: бірдей полигон+метрика+кезең 6 сағат кэште (тек сәтті JSON жауап)
const CACHE_TTL_MS = 6 * 3600_000;
const cache = new Map<string, { at: number; body: unknown }>();
const QUOTA_RE = /Insufficient processing units|ACCESS_INSUFFICIENT|429/;

const body = z.object({
  ring: z.array(z.array(z.number()).min(2).max(3)),
  metric: z.enum(AREA_METRICS),
  months: z.number().int().min(1).max(24).optional(),
  format: z.enum(["json", "csv"]).optional(),
});

const fail = (error: string, status: number, reason?: string) =>
  NextResponse.json({ error, ...(reason ? { reason } : {}) }, { status, headers: noStore });

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function POST(req: Request) {
  let parsed;
  try { parsed = body.safeParse(await req.json()); } catch { return fail("JSON жарамсыз", 400); }
  if (!parsed.success) return fail("Сұраныс жарамсыз", 400);
  const { metric, format = "json" } = parsed.data;
  const check = validateRing(parsed.data.ring);
  if (!check.ok) return fail(check.error, 400);
  const { ring, areaKm2 } = check;

  if (format === "csv") {
    const auth = await requireRole(req, EXPORT_ROLES);
    if (!auth.ok) return auth.response;
  }
  if (!(await allow(req, "area"))) return fail("Сұраныс шегі асты — бір сағаттан кейін қайталаңыз", 429);

  const months = parsed.data.months ?? 12;
  const cacheKey = `${metric}|${months}|${ring.map(([x, y]) => `${x.toFixed(5)},${y.toFixed(5)}`).join(";")}`;
  const hit = cache.get(cacheKey);
  if (hit && format === "json" && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json(hit.body, { headers: { ...noStore, "X-Area-Cache": "hit" } });
  const now = new Date();
  const fromD = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const from = iso(fromD), to = iso(now);
  const fetchedAt = now.toISOString();
  const region = getRegion("atyrau");
  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(50_000)]);

  try {
    if (metric === "ndvi" || metric === "no2") {
      if (!hasCdseKeys()) return fail("Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді", 503, "SENTINELHUB_CLIENT_ID/SECRET жоқ");
      const token = await cdseToken();
      const r = metric === "ndvi" ? await ndviMonthly(token, ring, from, to, signal) : await no2Monthly(token, ring, from, to, signal);
      if (!r.days.length) return fail("Бұл кезеңде жарамды спутник өтуі табылмады — жалған дерек көрсетілмейді", 503, "бұлт/qa сүзгісінен өткен өту жоқ");
      const unit = metric === "ndvi" ? "NDVI" : "µmol/m²";
      const result = { metric, unit, tier: "measurement" as const, areaKm2, window: { from, to }, resolutionM: r.resolutionM, rows: r.rows, validDays: r.days.length, fetchedAt, source: AREA_SOURCES[metric], caveats: AREA_CAVEATS[metric] };
      if (format === "csv") return csv(result.rows.map((m: MonthRow) => [m.month, m.value == null ? null : +m.value.toFixed(metric === "ndvi" ? 3 : 2), m.n, m.coverage == null ? null : +m.coverage.toFixed(2)]),
        ["Ай", metric === "ndvi" ? "NDVI (медиана)" : "NO₂ баған, µmol/m² (орташа)", "Жарамды өту саны", "Пиксель жамылғысы"], metric, result.source, fetchedAt, ring, areaKm2);
      cache.set(cacheKey, { at: Date.now(), body: result });
      return NextResponse.json(result, { headers: noStore });
    }
    if (metric === "fires") {
      const key = process.env.FIRMS_MAP_KEY;
      if (!key) return fail("FIRMS кілті бапталмаған — жалған дерек көрсетілмейді", 503, "FIRMS_MAP_KEY жоқ");
      const r = await firesInArea(key, ring, region.id, region.bbox);
      const result = { metric, tier: "measurement" as const, areaKm2, window: r.window, rows: r.rows, points: r.points, complete: r.complete, failedWindows: r.failedWindows, fetchedAt, source: AREA_SOURCES.fires, caveats: AREA_CAVEATS.fires };
      if (format === "csv") return csv(r.points.map((p) => [p.acqDate, p.lat, p.lng, p.frp, p.confidence, p.category === "industrial_flare" ? "өндірістік алау" : "жылу аномалиясы (расталмаған)", p.facility]),
        ["Күні", "Ендік", "Бойлық", "FRP, МВт", "Сенімділік", "Жіктеу", "Нысан"], metric, result.source, fetchedAt, ring, areaKm2);
      cache.set(cacheKey, { at: Date.now(), body: result });
      return NextResponse.json(result, { headers: noStore });
    }
    const r = overlayInArea(ring);
    const result = { metric, tier: "measurement" as const, areaKm2, ...r, fetchedAt, source: AREA_SOURCES.overlay, caveats: AREA_CAVEATS.overlay };
    if (format === "csv") return csv(r.rows.map((x) => [x.category, +x.areaKm2.toFixed(4), +(x.fraction * 100).toFixed(1)]),
      ["Санат", "Аудан, км²", "Аймақтың %"], metric, result.source, fetchedAt, ring, areaKm2);
    cache.set(cacheKey, { at: Date.now(), body: result });
    return NextResponse.json(result, { headers: noStore });
  } catch (e) {
    console.error("area-report:", e);
    if (e instanceof FirmsKeyError) return fail("FIRMS кілті жарамсыз — жалған дерек көрсетілмейді", 503, e.message);
    if (e instanceof Error && QUOTA_RE.test(e.message)) return fail("Copernicus тегін есептеу квотасы уақытша бітті — жалған дерек көрсетілмейді. Квота жаңарғанда қайталаңыз.", 503, "Sentinel Hub processing units");
    return fail("Дереккөз уақытша қолжетімсіз — жалған дерек көрсетілмейді", 503, e instanceof Error ? e.message.slice(0, 200) : undefined);
  }
}

function csv(rows: Cell[][], header: string[], metric: string, source: string, fetchedAt: string, ring: [number, number][], areaKm2: number) {
  const body = withProvenance([header, ...rows], {
    dataset: `Аймақ есебі: ${metric}, ${areaKm2.toFixed(3)} км²`,
    tier: "Өлшем", source, fetchedAt,
    method: `Полигон (lng lat): ${ring.map(([x, y]) => `${x.toFixed(5)} ${y.toFixed(5)}`).join(", ")}`,
    caveats: AREA_CAVEATS[metric as keyof typeof AREA_CAVEATS],
  });
  return new NextResponse(toCsv(body), { headers: csvHeaders(`jaiyq-area-${metric}-${fetchedAt.slice(0, 10)}.csv`) });
}
