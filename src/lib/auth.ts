import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const ROLES = ["resident", "scientist", "officer", "admin"] as const;
export type Role = typeof ROLES[number];
export const STAFF_ROLES = ["officer", "admin"] as const;
export const GRANTABLE_ROLES = ["resident", "scientist", "officer"] as const;
// P3.9: CSV export is a researcher tool. Anonymous → 401, resident → 403.
export const EXPORT_ROLES = ["scientist", "officer", "admin"] as const;
// Далалық журнал: ғалым мен қызметкер жазады/оқиды (RLS-пен бірдей).
export const JOURNAL_ROLES = ["scientist", "officer", "admin"] as const;

export const AUTH_ERRORS = {
  notConfigured: "Аутентификация бапталмаған",
  noToken: "Кіру қажет",
  badToken: "Сессия жарамсыз немесе мерзімі өткен",
  rolesUnavailable: "Рөл кестесі қолжетімсіз — дерек жоқ",
  forbidden: "Рұқсат жоқ: рөліңіз жеткіліксіз",
} as const;

export function bearerToken(req: Request): string | null {
  return req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1] ?? null;
}

export function createUserClient(token: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

type Authorization = {
  ok: true;
  user: { id: string; email: string | undefined };
  role: Role;
  client: SupabaseClient;
} | { ok: false; response: NextResponse };

function denied(error: string, status: number): Authorization {
  return { ok: false, response: NextResponse.json({ error }, { status }) };
}

// Тек серверде: сессияны Auth сервері, рөлді RLS қорғайтын кесте растайды.
export async function requireRole(req: Request, allowed: readonly Role[]): Promise<Authorization> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return denied(AUTH_ERRORS.notConfigured, 503);
  }
  const token = bearerToken(req);
  if (!token) return denied(AUTH_ERRORS.noToken, 401);
  const client = createUserClient(token)!;

  let user;
  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) return denied(AUTH_ERRORS.badToken, 401);
    user = data.user;
  } catch {
    return denied(AUTH_ERRORS.badToken, 401);
  }

  let storedRole: unknown;
  try {
    const { data, error } = await client.from("user_roles")
      .select("role").eq("user_id", user.id).maybeSingle();
    if (error) return denied(AUTH_ERRORS.rolesUnavailable, 503);
    storedRole = data?.role;
  } catch {
    return denied(AUTH_ERRORS.rolesUnavailable, 503);
  }
  const role: Role = ROLES.includes(storedRole as Role) ? storedRole as Role : "resident";
  if (!allowed.includes(role)) return denied(AUTH_ERRORS.forbidden, 403);
  return { ok: true, user: { id: user.id, email: user.email }, role, client };
}
