import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Тек серверде қолданылатын service-role клиенті. RLS-тен өтеді, сондықтан
// клиент бандлына ЕШҚАШАН импортталмауы керек (NEXT_PUBLIC емес кілт).
// Кілт атауының үш нұсқасы /api/fixate-пен бірдей қабылданады.
const KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_KEY",
] as const;

let cached: SupabaseClient | null | undefined;

export function serviceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const name = KEY_NAMES.find((n) => process.env[n]);
  const key = name ? process.env[name] : undefined;
  cached = url && key
    ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null;
  return cached;
}
