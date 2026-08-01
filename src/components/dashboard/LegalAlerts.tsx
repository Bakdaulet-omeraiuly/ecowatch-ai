"use client";

import { useEffect, useState } from "react";
import { Scale, Loader2, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge, type Tier } from "@/components/ui/TierBadge";
import { LEVEL_COLOR, LEVEL_KZ, type ComplianceLevel } from "@/lib/compliance";

// Заңнамалық ескертулер — ҚР/WHO/EU нормаларынан асу.
//
// Түс кодтары жобаның ережесіне сай:
//   жасыл  — норма шегінде
//   сары   — нормаға жақындады
//   қызыл  — РАСТАЛҒАН заңнамалық шек асқан
//   қызғылт сары — асқан, бірақ шек бастапқы актіден расталмаған

interface Check {
  norm: { limit: number; unit: string; status: string; statusNote: string; allowedExceedances?: number };
  act: { jurisdiction: string; title: string; number: string; date: string; authority: string; url?: string; note?: string };
  averagingKz: string;
  ratio: number;
  level: ComplianceLevel;
  timesOver: number | null;
}

interface Result {
  indicatorId: string;
  name: string;
  unit: string;
  section: string;
  tier: Tier;
  value: number | null;
  checks: Check[];
  worst: ComplianceLevel;
  kzViolation: boolean;
  summary: string;
  disclaimer: string;
  fetchedAt?: string;
}

interface Data {
  fetchedAt: string;
  checkedCount: number;
  withData: number;
  worst: ComplianceLevel;
  kzViolations: number;
  preliminary: number;
  approaching: number;
  results: Result[];
}

const ORDER: Record<ComplianceLevel, number> = {
  exceeded: 0, "exceeded-unverified": 1, approaching: 2, ok: 3, unknown: 4,
};

export function LegalAlerts() {
  const { tr } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/compliance")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const sorted = data?.results.slice().sort((a, b) => ORDER[a.worst] - ORDER[b.worst]) ?? [];

  return (
    <Card
      className={
        data?.kzViolations
          ? "border-red-500/40 bg-red-500/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
          <Scale className="h-4 w-4 text-neutral-300" />
          {tr("Заңнамалық сәйкестік")}
          {data ? (
            data.kzViolations > 0 ? (
              <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                {data.kzViolations} {tr("норма асқан")}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-200">
                {tr("расталған асу жоқ")}
              </span>
            )
          ) : null}
        </CardTitle>
        <p className="text-[11px] text-neutral-400">
          {tr("ҚР гигиеналық нормативтері · WHO 2021 · EU 2008/50/EC")}
        </p>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Нормалармен салыстырылуда…")}
          </div>
        ) : error || !data ? (
          <p className="py-4 text-sm text-neutral-400">
            {tr("Тірі дерек қолжетімсіз — салыстыру жүргізілмеді")}
          </p>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Mini label={tr("Тексерілді")} value={`${data.withData}/${data.checkedCount}`} />
              <Mini label={tr("Норма асқан")} value={String(data.kzViolations)} bad={data.kzViolations > 0} />
              <Mini label={tr("Алдын ала белгі")} value={String(data.preliminary)} warn={data.preliminary > 0} />
              <Mini label={tr("Нормаға жақын")} value={String(data.approaching)} warn={data.approaching > 0} />
            </div>

            <div className="space-y-1.5">
              {sorted.map((r) => (
                <div key={r.indicatorId} className="rounded-lg border border-white/10 bg-black/20">
                  <button
                    onClick={() => setOpen(open === r.indicatorId ? null : r.indicatorId)}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left transition hover:bg-white/[0.03]"
                  >
                    <span
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium ${LEVEL_COLOR[r.worst]}`}
                    >
                      {tr(LEVEL_KZ[r.worst])}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px] text-neutral-100">
                      {r.name}
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold text-white">
                      {r.value == null ? "—" : r.value}
                      <span className="ml-0.5 text-[9px] font-normal text-neutral-400">{r.unit}</span>
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 text-neutral-500 transition-transform ${
                        open === r.indicatorId ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {open === r.indicatorId && (
                    <div className="space-y-2 border-t border-white/10 px-2.5 py-2 text-[11px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <TierBadge tier={r.tier} />
                        <span className="text-neutral-300">{r.summary}</span>
                      </div>

                      <table className="w-full text-left">
                        <thead className="text-neutral-500">
                          <tr>
                            <th className="py-1 pr-2 font-medium">{tr("Норма")}</th>
                            <th className="py-1 pr-2 font-medium">{tr("Орташалау")}</th>
                            <th className="py-1 pr-2 text-right font-medium">{tr("Шек")}</th>
                            <th className="py-1 text-right font-medium">{tr("Қатынас")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.checks.map((c, i) => (
                            <tr key={i} className="border-t border-white/5">
                              <td className="py-1 pr-2">
                                <span className="text-neutral-200">
                                  {c.act.jurisdiction === "KZ" ? "ҚР" : c.act.jurisdiction}
                                </span>
                                {c.norm.status !== "verified" && (
                                  <span className="ml-1 text-amber-300/80" title={c.norm.statusNote}>
                                    ⚠
                                  </span>
                                )}
                              </td>
                              <td className="py-1 pr-2 text-neutral-400">{c.averagingKz}</td>
                              <td className="py-1 pr-2 text-right text-neutral-300">
                                {c.norm.limit} {c.norm.unit}
                              </td>
                              <td
                                className={`py-1 text-right font-medium ${
                                  c.ratio > 1 ? "text-red-300" : c.ratio >= 0.8 ? "text-amber-300" : "text-emerald-300"
                                }`}
                              >
                                {Math.round(c.ratio * 100)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      <div className="space-y-0.5 border-t border-white/10 pt-1.5 text-[10px] text-neutral-500">
                        {[...new Map(r.checks.map((c) => [c.act.number, c.act])).values()].map((a) => (
                          <div key={a.number}>
                            {a.url ? (
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sky-300/80 underline-offset-2 hover:underline"
                              >
                                {a.number} — {a.title} <ExternalLink className="inline h-2 w-2" />
                              </a>
                            ) : (
                              <span>{a.number} — {a.title}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-amber-200/70">
              ⚖ {data.results[0]?.disclaimer}
            </p>
            <a
              href="/legislation"
              className="mt-1.5 inline-block text-[10px] text-sky-300 underline-offset-2 hover:underline"
            >
              {tr("Заңнама және норма тізілімі")} →
            </a>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Mini({ label, value, bad, warn }: { label: string; value: string; bad?: boolean; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`text-base font-bold ${
          bad ? "text-red-300" : warn ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
