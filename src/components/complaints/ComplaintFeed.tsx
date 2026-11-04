"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";
import { authHeaders } from "@/lib/authClient";
import { supabase } from "@/lib/supabase";
import { COMPLAINT_STATUSES, STATUS_TRANSITIONS, type PublicComplaint, type ComplaintGroup } from "@/lib/complaints";
import { ComplaintBadge, ComplaintStatusBadge } from "@/components/ui/ComplaintBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface PrivateComplaint extends PublicComplaint {
  description: string;
  status_changed_at: string | null;
  flagged?: boolean;
  flag_reason?: string | null;
  media_type?: string | null;
  mediaUrl?: string | null;
}
type Feed = { complaints: PrivateComplaint[]; groups?: ComplaintGroup[]; fetchedAt?: string };

export function ComplaintFeed({ mode }: { mode: "public" | "mine" | "review" }) {
  const { t, tr, lang } = useLang();
  const [data, setData] = useState<Feed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [staff, setStaff] = useState(false);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supabase) return;
    const { data: subscription } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        setData(null); setStaff(false); setLoading(true); setVersion((v) => v + 1);
      }
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const headers = await authHeaders();
        const response = await fetch(`/api/complaints${mode === "public" ? "" : `/${mode}`}`,
          { headers: mode === "public" ? {} : headers, signal: controller.signal, cache: "no-store" });
        const body = await response.json();
        if (controller.signal.aborted) return;
        setNeedsLogin(response.status === 401);
        if (!response.ok) { setData(null); setError(body.error ?? ""); }
        else { setData(body); setError(null); }
        if (mode === "public" && headers.Authorization) {
          const profile = await fetch("/api/auth/me", { headers, signal: controller.signal, cache: "no-store" });
          const account = await profile.json();
          if (!controller.signal.aborted) setStaff(profile.ok && ["officer", "admin"].includes(account.role));
        }
      } catch {
        if (!controller.signal.aborted) { setData(null); setError(""); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [mode, version]);

  const refresh = () => { setLoading(true); setError(null); setVersion((v) => v + 1); };
  const change = async (id: string, patch: object) => {
    setBusy(id); setError(null);
    try {
      const response = await fetch(`/api/complaints/${id}`, { method: "PATCH",
        headers: { ...await authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? ""); return; }
      refresh();
    } catch { setError(""); } finally { setBusy(null); }
  };
  const time = (value: string) => new Date(value).toLocaleString(lang === "kk" ? "kk-KZ" : lang === "ru" ? "ru-RU" : "en-GB");

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-neutral-900 sm:py-12">
      <h1 className="text-2xl font-semibold">{t(mode === "public" ? "complaints.title" : mode === "mine" ? "complaints.mine" : "complaints.review")}</h1>
      <p className="border-l-4 border-brand bg-neutral-50 p-4 text-sm leading-relaxed">{t("complaints.explanation")}</p>
      <nav className="flex flex-wrap gap-2">
        <Button asChild className="min-h-[44px] bg-brand text-white hover:bg-brand/90"><Link className="min-h-[44px]" href="/complaints/new">{t("complaints.new")}</Link></Button>
        <Button asChild variant="outline" className="min-h-[44px]"><Link className="min-h-[44px]" href={mode === "public" ? "/complaints/mine" : "/complaints"}>{t(mode === "public" ? "complaints.mine" : "complaints.back")}</Link></Button>
        {staff && <Button asChild variant="outline" className="min-h-[44px]"><Link className="min-h-[44px]" href="/complaints/review">{t("complaints.review")}</Link></Button>}
        <Button variant="outline" className="min-h-[44px]" disabled={loading || busy !== null} onClick={refresh}>{t("complaints.refresh")}</Button>
      </nav>
      {loading && <p role="status">{t("complaints.loading")}</p>}
      {error !== null && <p role="alert">{error ? tr(error) : t("complaints.noData")}</p>}
      {needsLogin && <Link href="/auth" className="inline-flex min-h-[44px] items-center text-brand underline">{t("complaints.signIn")}</Link>}
      {!loading && !data && !needsLogin && <p role="status">{t("complaints.noData")}</p>}
      {data && <p className="text-sm text-neutral-600">{t("complaints.source")}{data.fetchedAt && <> · {t("complaints.fetchedAt")}: {time(data.fetchedAt)}</>}</p>}
      {data?.complaints.length === 0 && <p>{t("complaints.empty")}</p>}
      {mode === "public" && data && <>
        <p className="text-sm text-neutral-600">{t("complaints.groupNote")}</p>
        {data.groups?.map((group) => (
          <Card key={group.id} className="border-t border-neutral-200 pt-5 text-neutral-900">
            <CardContent className="space-y-3">
              <ComplaintBadge />
              <h2 className="text-lg font-semibold">{t(`complaints.category.${group.category}`)} · {group.count} {t("complaints.count")}</h2>
              <div className="flex flex-wrap gap-2">{COMPLAINT_STATUSES.map((status) => {
                const count = data.complaints.filter((c) => group.members.includes(c.id) && c.status === status).length;
                return count > 0 ? <span key={status} className="inline-flex items-center gap-1"><ComplaintStatusBadge status={status} /> × {count}</span> : null;
              })}</div>
              <p className="text-sm">{t("complaints.eventAt")}: {time(group.firstAt)}{group.lastAt !== group.firstAt && <> – {time(group.lastAt)}</>}</p>
              <p className="text-sm text-neutral-600">{t("complaints.roundedLocation")}: {group.lat.toFixed(3)}, {group.lng.toFixed(3)}</p>
            </CardContent>
          </Card>
        ))}
      </>}
      {mode !== "public" && data?.complaints.map((complaint) => (
        <Card key={complaint.id} className="border-t border-neutral-200 pt-5 text-neutral-900">
          <CardContent className="space-y-4">
            <ComplaintBadge />
            <h2 className="text-lg font-semibold">{t(`complaints.category.${complaint.category}`)}</h2>
            <ComplaintStatusBadge status={complaint.status} />
            <p className="whitespace-pre-wrap break-words">{complaint.description}</p>
            <dl className="space-y-1 text-sm text-neutral-600">
              <div><dt className="inline">{t("complaints.eventAt")}: </dt><dd className="inline">{time(complaint.event_at)}</dd></div>
              <div><dt className="inline">{t("complaints.createdAt")}: </dt><dd className="inline">{time(complaint.created_at)}</dd></div>
              <div><dt className="inline">{t("complaints.location")}: </dt><dd className="inline">{complaint.lat}, {complaint.lng}</dd></div>
              {complaint.status_changed_at && <div><dt className="inline">{t("complaints.changedAt")}: </dt><dd className="inline">{time(complaint.status_changed_at)}</dd></div>}
            </dl>
            {mode === "mine" && <>
              <ol aria-label={t("complaints.progress")} className="grid gap-2 border-l-2 border-neutral-200 pl-3 sm:grid-cols-5 sm:border-l-0 sm:border-t-2 sm:pl-0 sm:pt-3">
                {COMPLAINT_STATUSES.map((status) => <li key={status} aria-current={complaint.status === status ? "step" : undefined}
                  className={complaint.status === status ? "font-semibold text-brand" : "text-neutral-600"}>{t(`complaints.status.${status}`)}</li>)}
              </ol>
              <p className="text-xs text-neutral-600">{t("complaints.progressHint")}</p>
            </>}
            {mode === "review" && <>
              {complaint.mediaUrl && (complaint.media_type?.startsWith("video/")
                ? <video className="max-h-96 w-full rounded" controls preload="metadata" src={complaint.mediaUrl} />
                // Private short-lived URLs must not pass through the public image optimizer.
                // eslint-disable-next-line @next/next/no-img-element
                : <img className="max-h-96 w-full rounded object-contain" src={complaint.mediaUrl} alt={t("complaints.mediaAlt")} />)}
              {complaint.media_type && !complaint.mediaUrl && <p>{t("complaints.mediaUnavailable")}</p>}
              <div className="flex flex-wrap gap-2">{STATUS_TRANSITIONS[complaint.status].map((status) => <Button key={status} className="min-h-[44px] bg-brand text-white hover:bg-brand/90" disabled={busy !== null || loading}
                onClick={() => void change(complaint.id, { status })}>{t(`complaints.status.${status}`)}</Button>)}</div>
              {complaint.status === "resolved" && <p className="text-sm">{t("complaints.terminal")}</p>}
              {complaint.flagged ? <p className="break-words text-sm text-amber-900">{t("complaints.flagged")}: {complaint.flag_reason}</p> : <div className="space-y-2">
                <Label htmlFor={`reason-${complaint.id}`}>{t("complaints.flagReason")}</Label>
                <Input className="min-h-[44px]" id={`reason-${complaint.id}`} maxLength={200} value={reasons[complaint.id] ?? ""}
                  onChange={(event) => setReasons({ ...reasons, [complaint.id]: event.target.value })} />
              </div>}
              <Button variant="outline" className="min-h-[44px]" disabled={busy !== null || loading || (!complaint.flagged && !reasons[complaint.id]?.trim())}
                onClick={() => void change(complaint.id, { flagged: !complaint.flagged, ...(!complaint.flagged ? { flag_reason: reasons[complaint.id].trim() } : {}) })}>
                {t(complaint.flagged ? "complaints.unflag" : "complaints.flag")}
              </Button>
            </>}
          </CardContent>
        </Card>
      ))}
    </main>
  );
}
