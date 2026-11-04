import { NextResponse } from "next/server";
import { z } from "zod";
import { GRANTABLE_ROLES, requireRole } from "@/lib/auth";

const roleSchema = z.object({
  userId: z.string().uuid().transform((value) => value.toLowerCase()),
  role: z.enum(GRANTABLE_ROLES),
});

export async function POST(req: Request) {
  const auth = await requireRole(req, ["admin"]);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  const { userId, role } = parsed.data;
  if (userId === auth.user.id.toLowerCase()) {
    return NextResponse.json({ error: "Өз рөліңізді өзгертуге болмайды" }, { status: 403 });
  }

  const { error } = await auth.client.from("user_roles").upsert({
    user_id: userId, role, granted_by: auth.user.id, granted_at: new Date().toISOString(),
  }, { onConflict: "user_id" }).select("user_id, role").single();
  if (error) {
    console.error("Admin role grant error:", error);
    return NextResponse.json({ error: "Дерекқор қатесі" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, userId, role });
}
