import { supabase } from "@/lib/supabase";

export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Тіркелуде рөл жіберілмейді: resident рөлін дерекқор триггері береді.
export function buildSignUp(email: string, password: string, redirectTo: string) {
  return { email, password, options: { emailRedirectTo: redirectTo } };
}
