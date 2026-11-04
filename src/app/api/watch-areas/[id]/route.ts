// PATCH { seen: true } — «қарадым» (жаңа оқиғалар саны нөлденеді); DELETE — аймақты алып тастау.
import { NextResponse } from "next/server";
import { requireRole, ROLES } from "@/lib/auth";

const noStore = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: noStore });
type Ctx = { params: Promise<{ id: string }> };
const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail("ID жарамсыз", 400);
  const { data, error } = await auth.client.from("watch_areas").update({ last_seen_at: new Date().toISOString() }).eq("id", id).select("id, last_seen_at");
  if (error) return fail("Аймақтар кестесі қолжетімсіз", 503);
  if (!data?.length) return fail("Аймақ табылмады", 404);
  return NextResponse.json({ area: data[0] }, { headers: noStore });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!UUID.test(id)) return fail("ID жарамсыз", 400);
  const { data, error } = await auth.client.from("watch_areas").delete().eq("id", id).select("id");
  if (error) return fail("Аймақтар кестесі қолжетімсіз", 503);
  if (!data?.length) return fail("Аймақ табылмады", 404);
  return NextResponse.json({ deleted: id }, { headers: noStore });
}
