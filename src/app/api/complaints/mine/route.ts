import { NextResponse } from "next/server";
import { requireRole, ROLES } from "@/lib/auth";
import { COMPLAINT_ERRORS } from "@/lib/complaints";

export async function GET(req: Request) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  try {
    const { data, error } = await auth.client.from("complaints")
      .select("id, category, status, event_at, created_at, status_changed_at, description, lat, lng")
      .eq("user_id", auth.user.id).order("created_at", { ascending: false });
    if (error || !data) throw new Error("Complaints unavailable");
    const complaints = data.map(({ id, category, status, event_at, created_at, status_changed_at, description, lat, lng }) =>
      ({ id, category, status, event_at, created_at, status_changed_at, description, lat, lng }));
    return NextResponse.json({ complaints }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: COMPLAINT_ERRORS.unavailable, complaints: null },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
