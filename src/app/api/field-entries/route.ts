// ДАЛАЛЫҚ ЖУРНАЛ: GET ?layer= (тізім), POST (жаңа жазба). Тек scientist/officer/admin.
// RLS дерекқорда да тексереді (20261105_map_tools.sql); кесте жоқ → 503.
import { NextResponse } from "next/server";
import { JOURNAL_ROLES, requireRole } from "@/lib/auth";
import { JOURNAL_LAYERS, JOURNAL_UNAVAILABLE, validateEntry, type JournalLayer } from "@/lib/fieldJournal";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
const COLS = "id, user_id, layer, kind, geom, lat, lng, area_km2, event_date, status, fields, note, created_at, updated_at";

export async function GET(req: Request) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  const layer = new URL(req.url).searchParams.get("layer");
  if (layer && !JOURNAL_LAYERS.includes(layer as JournalLayer)) return fail("Қабат белгісіз", 400);
  try {
    let q = auth.client.from("field_entries").select(COLS);
    if (layer) q = q.eq("layer", layer);
    const { data, error } = await q.order("event_date", { ascending: false }).limit(500);
    if (error || !data) return fail(JOURNAL_UNAVAILABLE, 503);
    return NextResponse.json({ entries: data, me: auth.user.id, role: auth.role }, { headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}

export async function POST(req: Request) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try { body = await req.json(); } catch { return fail("JSON жарамсыз", 400); }
  const check = validateEntry(body);
  if (!check.ok) return fail(check.error, 400);
  try {
    const { data, error } = await auth.client.from("field_entries")
      .insert({ ...check.row, user_id: auth.user.id }).select(COLS).single();
    if (error || !data) return fail(JOURNAL_UNAVAILABLE, 503);
    return NextResponse.json({ entry: data }, { status: 201, headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}
