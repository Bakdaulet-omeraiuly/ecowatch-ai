// АЙМАҚҚА ЖАЗЫЛУ: GET — өз аймақтарым + соңғы қараудан бергі жаңа FIRMS аномалиялары
// (соңғы 7 күн, сұраныс кезінде есептеледі — cron қажет емес). POST — жаңа аймақ.
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, ROLES } from "@/lib/auth";
import { validateRing, pointInRing, type LngLat } from "@/lib/areaGeo";
import { loadFireArchive } from "@/lib/firmsArchive";
import { classifyAnomaly } from "@/lib/fireClassify";
import { fireKey } from "@/lib/detectionReview";
import { getRegion } from "@/data/regions";
import { supabase } from "@/lib/supabase";
import { PUBLIC_COMPLAINT_FIELDS, toPublicComplaint, type PublicComplaint } from "@/lib/complaints";

export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number, extra?: object) => NextResponse.json({ error, ...extra }, { status, headers: noStore });
const UNAVAILABLE = "Аймақтар кестесі қолжетімсіз — миграция қолданылмаған болуы мүмкін";

export async function GET(req: Request) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  const { data: areas, error } = await auth.client.from("watch_areas")
    .select("id, name, ring, area_km2, layers, last_seen_at, created_at").order("created_at");
  if (error || !areas) return fail(UNAVAILABLE, 503);

  let fires: { available: boolean; reason?: string; detections: { lat: number; lng: number; acqDate: string; dayNight: string; frp: number }[] } = { available: false, detections: [] };
  if (areas.some((a) => a.layers.includes("fire"))) {
    const key = process.env.FIRMS_MAP_KEY;
    if (!key) fires = { available: false, reason: "FIRMS_MAP_KEY жоқ", detections: [] };
    else {
      try {
        const region = getRegion("atyrau");
        const arch = await loadFireArchive({ key, regionId: `${region.id}-watch`, bbox: region.bbox, days: 7 });
        fires = { available: true, detections: arch.detections };
      } catch (e) {
        fires = { available: false, reason: e instanceof Error ? e.message.slice(0, 120) : "FIRMS қатесі", detections: [] };
      }
    }
  }
  // Жария шағымдар (соңғы 7 күн) — аймақ ішіндегілер; көз қолжетімсіз болса available:false
  let complaints: { available: boolean; rows: PublicComplaint[] } = { available: false, rows: [] };
  if (supabase) {
    try {
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const { data, error: cErr } = await supabase.from("complaints_public").select(PUBLIC_COMPLAINT_FIELDS).gte("event_at", since).limit(1000);
      if (!cErr && data) complaints = { available: true, rows: (data as PublicComplaint[]).map(toPublicComplaint) };
    } catch { /* available:false */ }
  }
  const out = areas.map((a) => {
    const ring = a.ring as LngLat[];
    const seen = a.last_seen_at.slice(0, 10);
    const inArea = a.layers.includes("fire") && fires.available
      ? fires.detections.filter((d) => pointInRing(d.lng, d.lat, ring)).map((d) => {
          const c = classifyAnomaly(d.lat, d.lng);
          return { key: fireKey(d), lat: d.lat, lng: d.lng, acqDate: d.acqDate, frp: d.frp, category: c.category, facility: c.facilityName, isNew: d.acqDate >= seen };
        })
      : [];
    const cIn = complaints.rows.filter((c) => pointInRing(c.lng, c.lat, ring));
    return {
      ...a,
      fire: { available: fires.available, reason: fires.reason, last7d: inArea.length, newSinceSeen: inArea.filter((x) => x.isNew).length, detections: inArea },
      complaints: { available: complaints.available, last7d: cIn.length, newSinceSeen: cIn.filter((c) => c.event_at >= a.last_seen_at).length,
        items: cIn.map((c) => ({ category: c.category, event_at: c.event_at, lat: c.lat, lng: c.lng })) },
    };
  });
  return NextResponse.json({ areas: out }, { headers: noStore });
}

const body = z.object({
  name: z.string().trim().min(1).max(100),
  ring: z.array(z.array(z.number()).min(2).max(3)),
  layers: z.array(z.enum(["fire", "no2", "ndvi"])).min(1).max(3).default(["fire"]),
}).strict();

export async function POST(req: Request) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  let parsed;
  try { parsed = body.safeParse(await req.json()); } catch { return fail("JSON жарамсыз", 400); }
  if (!parsed.success) return fail("Сұраныс жарамсыз", 400);
  const c = validateRing(parsed.data.ring);
  if (!c.ok) return fail(c.error, 400);
  const { data, error } = await auth.client.from("watch_areas")
    .insert({ user_id: auth.user.id, name: parsed.data.name, ring: c.ring, area_km2: c.areaKm2, layers: [...new Set(parsed.data.layers)] })
    .select("id, name, area_km2, layers, created_at").single();
  if (error) return error.message?.includes("limit 10") ? fail("Ең көбі 10 аймақ", 409) : fail(UNAVAILABLE, 503);
  return NextResponse.json({ area: data }, { status: 201, headers: noStore });
}
