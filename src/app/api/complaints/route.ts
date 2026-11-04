import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, ROLES } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { allow } from "@/lib/ratelimit";
import { getRegion } from "@/data/regions";
import {
  COMPLAINT_CATEGORIES, COMPLAINT_ERRORS, COMPLAINT_RATE_LIMIT, DUPLICATE_WINDOW_MS,
  MAX_EVENT_AGE_DAYS, MAX_MEDIA_BYTES, PUBLIC_COMPLAINT_FIELDS, groupComplaints, toPublicComplaint,
} from "@/lib/complaints";
import { sniffMedia, stripMetadata } from "@/lib/mediaSanitize";

const unavailable = () => NextResponse.json({ error: COMPLAINT_ERRORS.unavailable, complaints: null }, { status: 503 });
const failure = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function GET() {
  if (!supabase) return unavailable();
  try {
    const { data, error } = await supabase.from("complaints_public").select(PUBLIC_COMPLAINT_FIELDS)
      .order("event_at", { ascending: false }).limit(500);
    if (error || !data) return unavailable();
    const complaints = data.map(toPublicComplaint);
    return NextResponse.json({ complaints, groups: groupComplaints(complaints),
      kind: "resident-complaint", measurement: false, fetchedAt: new Date().toISOString() });
  } catch { return unavailable(); }
}

const schema = z.object({
  category: z.enum(COMPLAINT_CATEGORIES),
  lat: z.coerce.number().finite(), lng: z.coerce.number().finite(),
  event_at: z.iso.datetime({ offset: true }),
  description: z.string().trim().min(1).max(1000),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  try {
    if (!(await allow(req, "complaints"))) return failure(COMPLAINT_ERRORS.rateLimit, 429);
    let form: FormData;
    try { form = await req.formData(); } catch { return failure("Жарамсыз сұраныс", 400); }
    const parsed = schema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return failure("Жарамсыз сұраныс", 400);
    const { category, lat, lng, event_at, description } = parsed.data;
    const [west, south, east, north] = getRegion("atyrau").bbox;
    if (lat < south || lat > north || lng < west || lng > east) return failure(COMPLAINT_ERRORS.outsideRegion, 400);
    const eventTime = Date.parse(event_at);
    const now = Date.now();
    if (eventTime > now + 10 * 60e3 || eventTime < now - MAX_EVENT_AGE_DAYS * 86400e3) {
      return failure(COMPLAINT_ERRORS.badEventTime, 400);
    }
    const { count, error: countError } = await auth.client.from("complaints")
      .select("id", { count: "exact", head: true }).eq("user_id", auth.user.id)
      .gte("created_at", new Date(now - 3600e3).toISOString());
    if (countError || count === null) return unavailable();
    if (count >= COMPLAINT_RATE_LIMIT.perHour) return failure(COMPLAINT_ERRORS.rateLimit, 429);

    let media_path: string | null = null;
    let media_type: string | null = null;
    const media = form.get("media");
    if (media !== null && !(media instanceof File)) return failure(COMPLAINT_ERRORS.badMedia, 400);
    if (media instanceof File) {
      if (media.size > MAX_MEDIA_BYTES) return failure(COMPLAINT_ERRORS.tooLarge, 413);
      const bytes = new Uint8Array(await media.arrayBuffer());
      const type = sniffMedia(bytes);
      if (!type) return failure(COMPLAINT_ERRORS.badMedia, 400);
      let clean: Uint8Array;
      try { clean = stripMetadata(bytes, type); } catch { return failure(COMPLAINT_ERRORS.badMedia, 400); }
      const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov" }[type];
      media_path = `${auth.user.id}/${crypto.randomUUID()}.${extension}`;
      media_type = type;
      const { error } = await auth.client.storage.from("complaint-media")
        .upload(media_path, clean, { contentType: type, upsert: false });
      if (error) return unavailable();
    }
    const { data, error } = await auth.client.from("complaints")
      .insert({ user_id: auth.user.id, category, lat, lng, event_at, description, media_path, media_type })
      .select("id, status, created_at").single();
    if (error) {
      if (error.message.includes("complaint_rate_limit")) return failure(COMPLAINT_ERRORS.rateLimit, 429);
      console.error("Complaints insert error:", error);
      return unavailable();
    }
    if (!data) return unavailable();
    let duplicates: number | null = null;
    try {
      const nearby = await auth.client.from("complaints_public").select(PUBLIC_COMPLAINT_FIELDS)
        .eq("category", category).gte("lat", lat - 0.01).lte("lat", lat + 0.01)
        .gte("lng", lng - 0.01).lte("lng", lng + 0.01)
        .gte("event_at", new Date(eventTime - DUPLICATE_WINDOW_MS).toISOString())
        .lte("event_at", new Date(eventTime + DUPLICATE_WINDOW_MS).toISOString());
      if (!nearby.error && nearby.data) {
        // Include only rows actually returned by the view; no invented zero if it omitted the insert.
        const group = groupComplaints(nearby.data.map(toPublicComplaint)).find((g) => g.members.includes(data.id));
        duplicates = group ? group.count - 1 : null;
      }
    } catch { /* Best effort: the saved complaint still succeeds. */ }
    return NextResponse.json({ complaint: { id: data.id, status: data.status, created_at: data.created_at }, duplicates });
  } catch { return unavailable(); }
}
