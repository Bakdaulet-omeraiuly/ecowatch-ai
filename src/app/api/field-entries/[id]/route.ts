// Журнал жазбасын жаңарту (мәртебе/өрістер/ескерту/күні) немесе өшіру.
// Кімнің не істей алатынын RLS шешеді: иесі өзінікін, officer/admin кез келгенін.
import { NextResponse } from "next/server";
import { JOURNAL_ROLES, requireRole } from "@/lib/auth";
import { kindSpec, validateEntry, type Geom } from "@/lib/fieldJournal";
import { JOURNAL_UNAVAILABLE } from "@/lib/fieldJournal";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail("ID жарамсыз", 400);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("JSON жарамсыз", 400); }
  try {
    const { data: cur, error } = await auth.client.from("field_entries")
      .select("layer, kind, geom, event_date, status, fields, note").eq("id", id).maybeSingle();
    if (error) return fail(JOURNAL_UNAVAILABLE, 503);
    if (!cur) return fail("Жазба табылмады", 404);
    if (!kindSpec(cur.kind)) return fail("Жазба түрі белгісіз", 409);
    // Толық жазбаны қайта тексереміз — өрістер мен мәртебе түрге сай болуы үшін
    const merged = {
      layer: cur.layer, kind: cur.kind, geom: cur.geom as Geom,
      event_date: body.event_date ?? cur.event_date, status: body.status ?? cur.status,
      fields: body.fields ?? cur.fields, note: body.note ?? cur.note ?? undefined,
    };
    const check = validateEntry(merged);
    if (!check.ok) return fail(check.error, 400);
    const patch = { event_date: check.row.event_date, status: check.row.status, fields: check.row.fields, note: check.row.note ?? null };
    const { data, error: upErr } = await auth.client.from("field_entries").update(patch).eq("id", id).select("id, status, fields, note, event_date, updated_at");
    if (upErr) return fail(JOURNAL_UNAVAILABLE, 503);
    if (!data?.length) return fail("Рұқсат жоқ: бұл жазбаны өзгерте алмайсыз", 403);
    return NextResponse.json({ entry: data[0] }, { headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireRole(req, JOURNAL_ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail("ID жарамсыз", 400);
  try {
    const { data, error } = await auth.client.from("field_entries").delete().eq("id", id).select("id");
    if (error) return fail(JOURNAL_UNAVAILABLE, 503);
    if (!data?.length) return fail("Рұқсат жоқ немесе жазба табылмады", 403);
    return NextResponse.json({ deleted: id }, { headers: noStore });
  } catch {
    return fail(JOURNAL_UNAVAILABLE, 503);
  }
}
