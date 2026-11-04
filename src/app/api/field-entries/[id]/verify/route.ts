// Көгалдандыру тексеруі: отырғызу аймағы бойынша Sentinel-2 NDVI —
// отырғызуға дейінгі жаз vs соңғы толық жаз. 🛰 өлшем (индекс), шешім — жоба шегі.
import { NextResponse } from "next/server";
import { JOURNAL_ROLES, requireRole } from "@/lib/auth";
import { cdseToken, hasCdseKeys } from "@/lib/cdse";
import { validateRing, type LngLat } from "@/lib/areaGeo";
import { ndviMonthly } from "@/lib/areaStats";
import { plantingSeasons, PLANTING_CAVEATS, PLANTING_DNDVI } from "@/lib/fieldJournal";
import { JOURNAL_UNAVAILABLE } from "@/lib/fieldJournal";

export const maxDuration = 60;
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, reason?: string) => NextResponse.json({ error, ...(reason ? { reason } : {}) }, { status, headers: noStore });

const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const { data: e, error } = await auth.client.from("field_entries").select("kind, geom, event_date").eq("id", id).maybeSingle();
  if (error) return fail(JOURNAL_UNAVAILABLE, 503);
  if (!e) return fail("Жазба табылмады", 404);
  if (e.kind !== "planting") return fail("Тексеру тек отырғызу жазбасына", 400);
  if (e.geom?.type !== "Polygon") return fail("Тексеру үшін отырғызу АЙМАҒЫ керек (нүкте емес)", 400);
  const ring = validateRing((e.geom.coordinates as LngLat[][])[0]);
  if (!ring.ok) return fail(ring.error, 400);
  const seasons = plantingSeasons(e.event_date);
  if (seasons.tooEarly) return NextResponse.json({ status: "too_early", seasons, caveats: PLANTING_CAVEATS }, { headers: noStore });
  if (!hasCdseKeys()) return fail("Copernicus кілттері бапталмаған — жалған дерек көрсетілмейді", 503);
  try {
    const token = await cdseToken();
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(50_000)]);
    const [b, r] = await Promise.all([seasons.baseline, seasons.recent].map((s) => ndviMonthly(token, ring.ring, s.from, s.to, signal)));
    const stat = (d: typeof b.days) => d.length >= 2 ? { medianNdvi: +median(d.map((x) => x.value)).toFixed(3), passes: d.length } : null;
    const baseline = stat(b.days), recent = stat(r.days);
    if (!baseline || !recent) return NextResponse.json({ status: "no_data", seasons, baseline, recent, caveats: PLANTING_CAVEATS }, { headers: noStore });
    const dNdvi = +(recent.medianNdvi - baseline.medianNdvi).toFixed(3);
    const trend = dNdvi >= PLANTING_DNDVI ? "up" : dNdvi <= -PLANTING_DNDVI ? "down" : "stable";
    return NextResponse.json({
      status: "ok", tier: "measurement", seasons, baseline, recent, dNdvi, trend, threshold: PLANTING_DNDVI,
      resolutionM: b.resolutionM, areaKm2: ring.areaKm2, source: "Copernicus Sentinel-2 L2A · Sentinel Hub Statistical API", caveats: PLANTING_CAVEATS,
    }, { headers: noStore });
  } catch (err) {
    return fail("Sentinel-2 деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді", 503, err instanceof Error ? err.message.slice(0, 200) : undefined);
  }
}
