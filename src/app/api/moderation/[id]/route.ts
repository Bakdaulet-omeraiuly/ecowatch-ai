import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { z } from "zod";

// PATCH /api/moderation/:id  — update verification_status
// DELETE /api/moderation/:id — permanently remove a report

const patchSchema = z.object({
  verification_status: z.enum(["confirmed", "unconfirmed", "contradicted"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "Дерекқор бапталмаған" }, { status: 503 });

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Жарамсыз сұраныс" }, { status: 400 });

  const { error } = await supabase
    .from("reports")
    .update({ verification_status: parsed.data.verification_status })
    .eq("id", id);

  if (error) {
    console.error("Moderation PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabase) return NextResponse.json({ error: "Дерекқор бапталмаған" }, { status: 503 });

  const { id } = await params;
  const { error } = await supabase.from("reports").delete().eq("id", id);

  if (error) {
    console.error("Moderation DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
