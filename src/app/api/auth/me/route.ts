import { NextResponse } from "next/server";
import { requireRole, ROLES } from "@/lib/auth";

export async function GET(req: Request) {
  const auth = await requireRole(req, ROLES);
  if (!auth.ok) return auth.response;
  return NextResponse.json({ userId: auth.user.id, email: auth.user.email, role: auth.role });
}
