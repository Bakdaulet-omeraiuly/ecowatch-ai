import { NextResponse } from "next/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { COMPLAINT_ERRORS, groupComplaints, toPublicComplaint } from "@/lib/complaints";

export async function GET(req: Request) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;
  try {
    const { data, error } = await auth.client.from("complaints")
      .select("id, category, status, event_at, created_at, status_changed_at, description, lat, lng, media_path, media_type, flagged, flag_reason")
      .order("created_at", { ascending: false }).limit(500);
    if (error || !data) throw new Error("Complaints unavailable");
    const complaints = await Promise.all(data.map(async (row) => {
      let mediaUrl: string | null = null;
      if (row.media_path) {
        try {
          const signed = await auth.client.storage.from("complaint-media").createSignedUrl(row.media_path, 600);
          if (!signed.error) mediaUrl = signed.data?.signedUrl ?? null;
        } catch { /* The description remains reviewable when signing fails. */ }
      }
      return { ...toPublicComplaint(row), lat: row.lat, lng: row.lng,
        description: row.description, status_changed_at: row.status_changed_at,
        media_type: row.media_type, flagged: row.flagged, flag_reason: row.flag_reason, mediaUrl };
    }));
    return NextResponse.json({ complaints, groups: groupComplaints(complaints) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: COMPLAINT_ERRORS.unavailable, complaints: null },
      { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
