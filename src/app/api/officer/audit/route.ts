import { NextResponse } from "next/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";

// P3.8: officer/admin read the append-only action log. Rows are written by a
// database trigger (supabase/migrations/20261104_officer_audit.sql), never by this API.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.client.from("officer_audit_log")
    .select("id, at, actor, actor_role, target_table, target_id, action, changes")
    .order("at", { ascending: false }).limit(200);
  if (error || !data) {
    return NextResponse.json({ error: "Әрекеттер журналы қолжетімсіз — дерек жоқ", entries: null }, { status: 503 });
  }
  return NextResponse.json({ entries: data, fetchedAt: new Date().toISOString() });
}
