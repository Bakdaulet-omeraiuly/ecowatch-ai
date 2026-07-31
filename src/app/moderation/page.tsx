"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, CheckCircle2, XCircle, Clock, Trash2, MapPin, RefreshCw, Filter } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { useSitesStore } from "@/store/useSitesStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { REPORTS_ENABLED } from "@/lib/features";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";

interface Report {
  id: string;
  lat: number;
  lng: number;
  name: string | null;
  risk_score: number;
  risk_level: string;
  verification_status: string | null;
  photo_thumb: string | null;
  analysis: {
    summary?: string;
    recommendation?: string;
    detectedFeatures?: string[];
    oilPollution?: boolean;
    illegalDumping?: boolean;
    landDegradation?: boolean;
    standingWater?: boolean;
  } | null;
  created_at: string;
}

type FilterType = "all" | "pending" | "confirmed" | "contradicted";

const STATUS_CFG = {
  confirmed:    { label: "Расталды",     cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  unconfirmed:  { label: "Тексеруде",    cls: "bg-yellow-500/15  text-yellow-300  border-yellow-500/30"  },
  contradicted: { label: "Өшірілген",    cls: "bg-red-500/15     text-red-300     border-red-500/30"     },
  pending:      { label: "Күтілуде",     cls: "bg-neutral-500/15 text-neutral-300 border-neutral-500/30" },
};

const RISK_COLOR: Record<string, string> = {
  low:      "#22c55e",
  medium:   "#eab308",
  high:     "#f97316",
  critical: "#ef4444",
};

function statusKey(s: string | null): keyof typeof STATUS_CFG {
  if (s === "confirmed")    return "confirmed";
  if (s === "contradicted") return "contradicted";
  if (s === "unconfirmed")  return "unconfirmed";
  return "pending";
}

export default function ModerationPage() {
  if (!REPORTS_ENABLED) return <FeatureUnavailable title="Модерация" />;
  return <ModerationPageInner />;
}

function ModerationPageInner() {
  const { tr } = useLang();
  const hideReport = useSitesStore((s) => s.hideReport);
  const [reports, setReports]   = useState<Report[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<FilterType>("all");
  const [busy, setBusy]         = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setReports(d.reports ?? []))
      .catch(() => toast.error(tr("Хабарламаларды жүктеу мүмкін болмады")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (id: string, status: string) => {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/moderation/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_status: status }),
      });
      if (!res.ok) throw new Error();
      setReports((prev) => prev.map((r) => r.id === id ? { ...r, verification_status: status } : r));
      toast.success(status === "confirmed" ? tr("Расталды ✅") : status === "contradicted" ? tr("Өшірілді ❌") : tr("Тексеруге жіберілді 🔍"));
    } catch {
      toast.error(tr("Өзгерту мүмкін болмады"));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const remove = async (id: string) => {
    if (!confirm(tr("Хабарламаны толығымен жоясыз ба?"))) return;
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/moderation/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReports((prev) => prev.filter((r) => r.id !== id));
      hideReport(id);
      toast.success(tr("Хабарлама жойылды"));
    } catch {
      toast.error(tr("Жою мүмкін болмады"));
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  };

  const filtered = reports.filter((r) => {
    if (filter === "pending")    return !r.verification_status || r.verification_status === "unconfirmed";
    if (filter === "confirmed")  return r.verification_status === "confirmed";
    if (filter === "contradicted") return r.verification_status === "contradicted";
    return true;
  });

  const counts = {
    all:          reports.length,
    pending:      reports.filter((r) => !r.verification_status || r.verification_status === "unconfirmed").length,
    confirmed:    reports.filter((r) => r.verification_status === "confirmed").length,
    contradicted: reports.filter((r) => r.verification_status === "contradicted").length,
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Shield className="h-6 w-6 text-violet-400" />
            {tr("Модерация панелі")}
          </h1>
          <p className="text-sm text-neutral-400">{tr("Азаматтардың фото-хабарламаларын қарап, растаңыз немесе өшіріңіз")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {tr("Жаңарту")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(["all", "pending", "confirmed", "contradicted"] as FilterType[]).map((f) => {
          const labels: Record<FilterType, string> = { all: "Барлығы", pending: "Күтілуде", confirmed: "Расталған", contradicted: "Өшірілген" };
          const colors: Record<FilterType, string> = { all: "text-white", pending: "text-yellow-300", confirmed: "text-emerald-300", contradicted: "text-red-300" };
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg border p-3 text-center transition-colors ${
                filter === f ? "border-violet-500/50 bg-violet-500/15" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <div className={`text-2xl font-bold ${colors[f]}`}>{counts[f]}</div>
              <div className="text-xs text-neutral-400">{tr(labels[f])}</div>
            </button>
          );
        })}
      </div>

      {/* Filter info */}
      {filter !== "all" && (
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Filter className="h-4 w-4" />
          {tr("Сүзгі")}: <span className="text-white">{filter === "pending" ? "Күтілуде" : filter === "confirmed" ? "Расталған" : "Өшірілген"}</span>
          <button onClick={() => setFilter("all")} className="ml-2 text-xs text-violet-400 hover:underline">{tr("Барлығын көру")}</button>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-neutral-500">{tr("Жүктелуде…")}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-neutral-400">
          {tr("Хабарламалар жоқ")}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const sk = statusKey(r.verification_status);
            const sc = STATUS_CFG[sk];
            const isBusy = !!busy[r.id];
            return (
              <Card key={r.id} className="border-white/10 bg-white/[0.03]">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {/* Photo */}
                    {r.photo_thumb && r.photo_thumb.startsWith("http") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo_thumb}
                        alt="Хабарлама фотосы"
                        className="h-24 w-24 flex-shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs text-neutral-500">
                        {tr("Фото жоқ")}
                      </div>
                    )}

                    {/* Info */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold"
                          style={{ backgroundColor: `${RISK_COLOR[r.risk_level]}22`, color: RISK_COLOR[r.risk_level] }}
                        >
                          {tr("Тәуекел")} {r.risk_score}/100
                        </span>
                        <Badge variant="outline" className={`text-[11px] ${sc.cls}`}>
                          {tr(sc.label)}
                        </Badge>
                        <span className="ml-auto text-[11px] text-neutral-500">
                          {new Date(r.created_at).toLocaleString("kk-KZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>

                      {r.analysis?.summary && (
                        <p className="text-sm text-neutral-300">{r.analysis.summary}</p>
                      )}

                      {r.analysis?.detectedFeatures?.length ? (
                        <p className="text-xs text-neutral-500">{r.analysis.detectedFeatures.slice(0, 3).join(" · ")}</p>
                      ) : null}

                      <a
                        href={`https://maps.google.com/?q=${r.lat},${r.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
                      >
                        <MapPin className="h-3 w-3" />
                        {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                      </a>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button
                          onClick={() => update(r.id, "confirmed")}
                          disabled={isBusy || r.verification_status === "confirmed"}
                          className="flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> {tr("Растау")}
                        </button>
                        <button
                          onClick={() => update(r.id, "unconfirmed")}
                          disabled={isBusy || r.verification_status === "unconfirmed"}
                          className="flex items-center gap-1 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs text-yellow-300 hover:bg-yellow-500/20 disabled:opacity-40"
                        >
                          <Clock className="h-3.5 w-3.5" /> {tr("Тексеруде")}
                        </button>
                        <button
                          onClick={() => update(r.id, "contradicted")}
                          disabled={isBusy || r.verification_status === "contradicted"}
                          className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-40"
                        >
                          <XCircle className="h-3.5 w-3.5" /> {tr("Қабылдамау")}
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          disabled={isBusy}
                          className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1 text-xs text-neutral-500 hover:border-red-500/30 hover:text-red-400 disabled:opacity-40"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> {tr("Жою")}
                        </button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
