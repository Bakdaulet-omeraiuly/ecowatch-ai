import { NextResponse } from "next/server";
import { requireRole, STAFF_ROLES } from "@/lib/auth";
import { z } from "zod";

// Қызметкер ғана хабарламаның мәртебесін өзгертеді немесе оны жояды.

const patchSchema = z.object({
  verification_status: z.enum(["confirmed", "unconfirmed", "contradicted"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });

  const { data, error } = await auth.client
    .from("reports")
    .update({ verification_status: parsed.data.verification_status })
    .eq("id", id).select("id");

  if (error) {
    console.error("Moderation PATCH error:", error);
    return NextResponse.json({ error: "Дерекқор қатесі" }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Хабарлама табылмады немесе өзгертуге рұқсат жоқ" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(req, STAFF_ROLES);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const { data, error } = await auth.client.from("reports").delete().eq("id", id).select("id");

  if (error) {
    console.error("Moderation DELETE error:", error);
    return NextResponse.json({ error: "Дерекқор қатесі" }, { status: 500 });
  }
  if (!data?.length) return NextResponse.json({ error: "Хабарлама табылмады немесе өзгертуге рұқсат жоқ" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
