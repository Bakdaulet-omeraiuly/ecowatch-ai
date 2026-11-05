"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { authHeaders, buildSignUp } from "@/lib/authClient";
import type { Role } from "@/lib/auth";

const roleLabels = {
  resident: "auth.role.resident", scientist: "auth.role.scientist",
  officer: "auth.role.officer", admin: "auth.role.admin",
} as const;

export default function AuthPage() {
  const { t } = useLang();
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<{ token: string; role: Role } | null>(null);

  useEffect(() => {
    if (!supabase) return;
    // INITIAL_SESSION және келесі оқиғалар бір жазылымнан келеді.
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const token = session.access_token;
    authHeaders()
      .then((headers) => fetch("/api/auth/me", { headers, signal: controller.signal, cache: "no-store" }))
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (!Object.hasOwn(roleLabels, body.role)) throw new Error();
        if (!controller.signal.aborted) setProfile({ token, role: body.role });
      })
      .catch(() => { if (!controller.signal.aborted) setProfile(null); });
    return () => controller.abort();
  }, [session]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    setCheckEmail(false);
    try {
      if (mode === "signIn") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp(buildSignUp(email, password, `${location.origin}/auth`));
        if (error) throw error;
        setCheckEmail(!data.session);
      }
      setPassword("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
    } finally {
      setBusy(false);
    }
  };

  const role = profile?.token === session?.access_token ? profile?.role : null;

  return (
    <main className="mx-auto max-w-md px-4 py-8 text-neutral-900 sm:py-12">
      <h1 className="mb-6 text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{t("auth.title")}</h1>
      <Card className="border-neutral-300 bg-neutral-50 text-neutral-900">
        <CardContent className="space-y-5 p-5">
          {!supabase ? <p role="status">{t("auth.unavailable")}</p> : session === undefined ? (
            <p role="status">{t("auth.loading")}</p>
          ) : session ? (
            <div className="space-y-4">
              <p className="break-words">{t("auth.email")}: {session.user.email}</p>
              <p role="status">{t("auth.role")}: {role ? t(roleLabels[role]) : t("auth.noData")}</p>
              {(role === "officer" || role === "admin") && (
                <Button asChild className="min-h-[44px] w-full bg-[#0b3a6b] text-neutral-900 hover:bg-[#0b3a6b]/90">
                  <Link href="/moderation" className="min-h-[44px]">{t("auth.toModeration")}</Link>
                </Button>
              )}
              <Button variant="outline" onClick={signOut} disabled={busy} className="min-h-[44px] w-full">
                {t("auth.signOut")}
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {(["signIn", "signUp"] as const).map((value) => (
                  <Button key={value} type="button" aria-pressed={mode === value} disabled={busy}
                    variant={mode === value ? "default" : "outline"}
                    className={`min-h-[44px] ${mode === value ? "bg-[#0b3a6b] text-neutral-900 hover:bg-[#0b3a6b]/90" : ""}`}
                    onClick={() => { setMode(value); setError(null); setCheckEmail(false); }}>
                    {t(value === "signIn" ? "auth.signIn" : "auth.signUp")}
                  </Button>
                ))}
              </div>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required disabled={busy}
                    value={email} onChange={(event) => setEmail(event.target.value)} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input id="password" name="password" type="password" minLength={8} required disabled={busy}
                    autoComplete={mode === "signUp" ? "new-password" : "current-password"}
                    value={password} onChange={(event) => setPassword(event.target.value)} className="h-11" />
                </div>
                <Button type="submit" disabled={busy} className="min-h-[44px] w-full bg-[#0b3a6b] text-neutral-900 hover:bg-[#0b3a6b]/90">
                  {t("auth.submit")}
                </Button>
              </form>
            </>
          )}
          {error !== null && <p role="alert" className="text-sm text-red-800">{t("auth.error")} {error}</p>}
          {checkEmail && <p role="status" className="text-sm">{t("auth.checkEmail")}</p>}
          <p className="text-sm text-neutral-600">{t("auth.roleNote")}</p>
        </CardContent>
      </Card>
    </main>
  );
}
