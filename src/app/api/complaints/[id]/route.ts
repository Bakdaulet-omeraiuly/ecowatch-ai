import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { canTransition, COMPLAINT_ERRORS, COMPLAINT_STATUSES } from "@/lib/complaints";

const schema = z.object({
  status: z.enum(COMPLAINT_STATUSES).optional(), flagged: z.boolean().optional(),
  flag_reason: z.string().trim().max(200).optional(),
}).strict().refine((body) => body.status !== undefined || body.flagged !== undefined)
  .refine((body) => body.flagged !== true || Boolean(body.flag_reason));
const failure = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;
  let body: unknown;
  try { body = await req.json(); } catch { return failure("Жарамсыз сұраныс", 400); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return failure("Жарамсыз сұраныс", 400);
  const { id } = await params;
  const { status, flagged, flag_reason } = parsed.data;
  try {
    let current: typeof status;
    if (status) {
      const { data, error } = await auth.client.from("complaints").select("status").eq("id", id).maybeSingle();
      if (error) return failure("Дерекқор қатесі", 500);
      if (!data) return failure(COMPLAINT_ERRORS.notFound, 404);
      current = data.status;
      if (!current || !canTransition(current, status)) return failure(COMPLAINT_ERRORS.forbiddenTransition, 409);
    }
    // One atomic write when status and flag are both supplied: no partial success.
    const values = {
      ...(status ? { status } : {}),
      ...(flagged !== undefined ? { flagged, flag_reason: flagged ? flag_reason : null,
        flagged_by: flagged ? auth.user.id : null } : {}),
    };
    let query = auth.client.from("complaints").update(values).eq("id", id);
    if (current) query = query.eq("status", current);
    const { data, error } = await query.select("id");
    if (error) {
      if (error.message.includes("complaint_bad_transition")) return failure(COMPLAINT_ERRORS.forbiddenTransition, 409);
      console.error("Complaints PATCH error:", error);
      return failure("Дерекқор қатесі", 500);
    }
    if (!data?.length) return failure(current ? COMPLAINT_ERRORS.forbiddenTransition : COMPLAINT_ERRORS.notFound, current ? 409 : 404);
    return NextResponse.json({ ok: true });
  } catch { return failure("Дерекқор қатесі", 500); }
}
