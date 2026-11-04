"use client";

import { useEffect, useState } from "react";
import { authHeaders } from "@/lib/authClient";
import type { Role } from "@/lib/auth";

/** Ағымдағы пайдаланушы рөлі: null = кірмеген, "loading" = тексерілуде */
export function useMyRole(): { role: Role | null | "loading"; userId: string | null } {
  const [state, setState] = useState<{ role: Role | null | "loading"; userId: string | null }>({ role: "loading", userId: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      const h = await authHeaders();
      if (!h.Authorization) { if (alive) setState({ role: null, userId: null }); return; }
      try {
        const r = await fetch("/api/auth/me", { headers: h });
        const j = r.ok ? await r.json() : null;
        if (alive) setState({ role: j?.role ?? null, userId: j?.userId ?? null });
      } catch { if (alive) setState({ role: null, userId: null }); }
    })();
    return () => { alive = false; };
  }, []);
  return state;
}

export async function authedJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}), ...(await authHeaders()) } });
  let body: unknown = null;
  try { body = await res.json(); } catch { /* бос жауап */ }
  return { ok: res.ok, status: res.status, body: body as Record<string, unknown> & { error?: string } };
}
