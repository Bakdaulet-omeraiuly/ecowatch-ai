// GET ?layer=fire — әр детекцияның соңғы шешімі (жария, тексерушісіз).
// GET ?layer=fire&key=… + Bearer (officer/admin) — толық тарих.
// POST { layer, key, verdict, note? } — officer/admin. Тарих өзгермейді (append-only).
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, STAFF_ROLES, bearerToken } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { KEY_RE, REVIEW_LAYERS, VERDICTS, type ReviewLayer } from "@/lib/detectionReview";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
const UNAVAILABLE = "Растау кестесі қолжетімсіз — миграция қолданылмаған болуы мүмкін";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const layer = sp.get("layer") as ReviewLayer;
  if (!REVIEW_LAYERS.includes(layer)) return fail("Қабат белгісіз", 400);
  const key = sp.get("key");
  if (key && bearerToken(req)) {
    if (!KEY_RE.test(key)) return fail("Кілт жарамсыз", 400);
    const auth = await requireRole(req, STAFF_ROLES);
    if (!auth.ok) return auth.response;
    const { data, error } = await auth.client.from("detection_reviews")
      .select("id, verdict, note, reviewer, created_at").eq("layer", layer).eq("detection_key", key)
      .order("created_at", { ascending: false }).limit(50);
    if (error || !data) return fail(UNAVAILABLE, 503);
    return NextResponse.json({ history: data }, { headers: noStore });
  }
  if (!supabase) return fail("Supabase бапталмаған", 503);
  try {
    const { data, error } = await supabase.rpc("detection_verdicts", { p_layer: layer });
    if (error || !Array.isArray(data)) return fail(UNAVAILABLE, 503);
    return NextResponse.json({ verdicts: data }, { headers: { "Cache-Control": "s-maxage=60" } });
  } catch {
    return fail(UNAVAILABLE, 503);
  }
}

const body = z.object({
  layer: z.enum(REVIEW_LAYERS),
  key: z.string().regex(KEY_RE),
  verdict: z.enum(VERDICTS),
  note: z.string().trim().max(1000).optional(),
}).strict();

export async function POST(req: Request) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;
  let parsed;
  try { parsed = body.safeParse(await req.json()); } catch { return fail("JSON жарамсыз", 400); }
  if (!parsed.success) return fail("Сұраныс жарамсыз", 400);
  const { layer, key, verdict, note } = parsed.data;
  try {
    const { data, error } = await auth.client.from("detection_reviews")
      .insert({ layer, detection_key: key, verdict, note: note || null, reviewer: auth.user.id })
      .select("id, verdict, created_at").single();
    if (error || !data) return fail(UNAVAILABLE, 503);
    return NextResponse.json({ review: data }, { status: 201, headers: noStore });
  } catch {
    return fail(UNAVAILABLE, 503);
  }
}
