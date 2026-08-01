"use client";

import { useState } from "react";
import { Sparkles, Loader2, Wind, Thermometer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";

interface Factor { label: string; detail: string; severity: "ok" | "warn" | "bad" }
interface WhyData { verdict: string; aqi: number | null; summary: string; factors: Factor[] }

const SEV = {
  ok: { cls: "text-emerald-300 border-emerald-500/30 bg-emerald-500/[0.06]", Icon: CheckCircle2 },
  warn: { cls: "text-yellow-300 border-yellow-500/30 bg-yellow-500/[0.06]", Icon: Wind },
  bad: { cls: "text-red-300 border-red-500/30 bg-red-500/[0.06]", Icon: AlertTriangle },
};

export function WhyButton() {
  const { tr } = useLang();
  const [data, setData] = useState<WhyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(false);

  const ask = () => {
    setOpen(true);
    if (data || loading) return;
    setLoading(true);
    fetch("/api/why")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => (d.error ? setError(true) : setData(d)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  return (
    <Card className="border-violet-500/25 bg-violet-500/[0.05]">
      <CardContent className="pt-4">
        {!open ? (
          <button
            onClick={ask}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-violet-500/40 bg-violet-500/15 px-4 py-3 text-sm font-semibold text-violet-100 transition-colors hover:bg-violet-500/25"
          >
            <Sparkles className="h-4 w-4" /> {tr("Неге бүгін ауа осындай? — AI түсіндірмесі")}
          </button>
        ) : (
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-200">
              <Sparkles className="h-4 w-4" /> {tr("AI түсіндірмесі")}
            </div>
            {loading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-neutral-400">
                <Loader2 className="h-4 w-4 animate-spin" /> {tr("Талдануда…")}
              </div>
            ) : error ? (
              <p className="text-sm text-neutral-400">
                {tr("Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}
              </p>
            ) : data ? (
              <>
                <p className="mb-3 text-sm leading-relaxed text-neutral-200">{data.summary}</p>
                <div className="space-y-1.5">
                  {data.factors.map((f, i) => {
                    const s = SEV[f.severity];
                    return (
                      <div key={i} className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-xs ${s.cls}`}>
                        <s.Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span><span className="font-semibold">{f.label}</span> — <span className="text-neutral-300">{f.detail}</span></span>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-[10px] text-neutral-500">
                  {tr("Барлық сан нақты өлшенген (Open-Meteo + CAMS). AI тек түсіндіреді, дерек ойлап таппайды.")}
                </p>
              </>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
