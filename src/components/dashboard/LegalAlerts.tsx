"use client";

import { useEffect, useState } from "react";
import { Scale, Loader2, ChevronDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge, type Tier } from "@/components/ui/TierBadge";
import { LEVEL_COLOR, LEVEL_KZ, LEVEL_MEANING, type ComplianceLevel } from "@/lib/compliance";
import { IndicatorHelp } from "@/components/ui/IndicatorHelp";
import { LevelLegend } from "@/components/ui/LevelLegend";
import { useRegion } from "@/store/useRegionStore";

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

interface SummationComponent {
  id: string; name: string; value: number | null; limit: number | null;
  ratio: number | null; normVerified: boolean; missingReason?: string;
}
interface SummationGroupResult {
  groupNo: number; components: SummationComponent[]; complete: boolean;
  sum: number | null; allNormsVerified: boolean; excludedByDominance: boolean;
  dominanceNote?: string; level: ComplianceLevel; summary: string;
}
interface Summation {
  computable: number; violations: number; groups: SummationGroupResult[];
  source: { act: string; amendment: string; registration: string; url: string; formula: string; dominanceRule: string };
  explain: string;
}

interface Data {
  fetchedAt: string;
  checkedCount: number;
  withData: number;
  worst: ComplianceLevel;
  kzViolations: number;
  exceededAny: number;
  preliminary: number;
  approaching: number;
  results: Result[];
  summation: Summation;
}

const ORDER: Record<ComplianceLevel, number> = {
  exceeded: 0, "exceeded-unverified": 1, approaching: 2, ok: 3, unknown: 4,
};

export function LegalAlerts() {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/compliance?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [region.id]);

  const sorted = data?.results.slice().sort((a, b) => ORDER[a.worst] - ORDER[b.worst]) ?? [];

  return (
    <Card
      className={
        data?.kzViolations
          ? "border-red-500/40 bg-white/[0.02]"
          : "border-white/10 bg-white/[0.02]"
      }
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
          <Scale className="h-4 w-4 text-neutral-300" />
          {tr("Заңнамалық сәйкестік")}
          {data ? (
            data.kzViolations > 0 ? (
              <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[12px] font-semibold text-red-200">
                {data.kzViolations} {tr("норма асқан")}
              </span>
            ) : (data.exceededAny ?? 0) > 0 ? (
              // ҚР нормасы асқан жоқ, бірақ WHO/EU эталонынан асу бар.
              // Бұрын мұнда жасыл «расталған асу жоқ» деп тұратын, ал
              // төменде PM₂.₅ қызыл «НОРМА АСҚАН» болып, қайшы шығатын.
              <span className="rounded-full border border-amber-400/35 bg-amber-500/12 px-2 py-0.5 text-[12px] text-amber-200">
                {tr("ҚР нормасы асқан жоқ")} · {data.exceededAny} {tr("WHO/EU эталонынан асу")}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[12px] text-emerald-200">
                {tr("расталған асу жоқ")}
              </span>
            )
          ) : null}
        </CardTitle>
        <p className="text-[13px] text-neutral-400">
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
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Mini label={tr("Тексерілді")} value={`${data.withData}/${data.checkedCount}`} />
              <Mini label={tr("ҚР нормасы асқан")} value={String(data.kzViolations)} bad={data.kzViolations > 0} />
              <Mini
                label={tr("WHO/EU эталонынан асқан")}
                value={String(Math.max(0, (data.exceededAny ?? 0) - data.kzViolations))}
                warn={(data.exceededAny ?? 0) > data.kzViolations}
              />
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
                      className={`shrink-0 rounded border px-1.5 py-0.5 text-[12px] font-medium ${LEVEL_COLOR[r.worst]}`}
                    >
                      {tr(LEVEL_KZ[r.worst])}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-100">
                      {r.name}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-white">
                      {r.value == null ? "—" : r.value}
                      <span className="ml-0.5 text-[12px] font-normal text-neutral-400">{r.unit}</span>
                    </span>
                    <ChevronDown
                      className={`h-3 w-3 shrink-0 text-neutral-400 transition-transform ${
                        open === r.indicatorId ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {open === r.indicatorId && (
                    <div className="space-y-2 border-t border-white/10 px-2.5 py-2 text-[13px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <TierBadge tier={r.tier} />
                        <span className="text-neutral-300">{r.summary}</span>
                      </div>

                      {/* Деңгейдің НАҚТЫ мағынасы және одан шығатын әрекет */}
                      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                        <p className="text-[12px] leading-relaxed text-neutral-300">
                          {LEVEL_MEANING[r.worst].full}
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-neutral-400">
                          → {LEVEL_MEANING[r.worst].action}
                        </p>
                      </div>

                      {/* Көрсеткіш нені білдіреді — тізілім мәтіні */}
                      <IndicatorHelp id={r.indicatorId} inline />

                      <table className="w-full text-left">
                        <thead className="text-neutral-400">
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

                      <div className="space-y-0.5 border-t border-white/10 pt-1.5 text-[12px] text-neutral-400">
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

            {/* ЖИНАҚТАЛУ ӘСЕРІ — ҚР ДСМ-70, 3-кесте */}
            {data.summation && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-2.5">
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-neutral-100">
                    {tr("Жинақталу әсері")}
                  </span>
                  <code className="rounded bg-white/5 px-1 py-px text-[12px] text-emerald-200">
                    {data.summation.source.formula}
                  </code>
                  {data.summation.violations > 0 && (
                    <span className="rounded-full border border-red-400/40 bg-red-500/15 px-1.5 py-0.5 text-[12px] font-semibold text-red-200">
                      {data.summation.violations} {tr("бұзушылық")}
                    </span>
                  )}
                </div>
                <p className="mb-1.5 text-[12px] leading-relaxed text-neutral-400">
                  {data.summation.explain}
                </p>

                <div className="space-y-1">
                  {data.summation.groups
                    .filter((g) => g.complete)
                    .map((g) => (
                      <div key={g.groupNo} className="rounded border border-white/10 bg-white/[0.02] px-2 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`rounded border px-1 py-px text-[12px] ${LEVEL_COLOR[g.level]}`}>
                            {tr(LEVEL_KZ[g.level])}
                          </span>
                          <span className="text-[12px] text-neutral-400">
                            {tr("топ")} №{g.groupNo}
                          </span>
                          <span className="ml-auto text-[13px] font-bold text-white">
                            Σ = {g.sum}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-neutral-400">
                          {g.components.map((c) => (
                            <span key={c.id}>
                              {c.name.split(" ")[0]}{" "}
                              <span className="text-neutral-200">
                                {c.ratio != null ? c.ratio.toFixed(2) : "—"}
                              </span>
                              {!c.normVerified && <span className="text-amber-300/80"> ⚠</span>}
                            </span>
                          ))}
                        </div>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-neutral-400">{g.summary}</p>
                        {g.dominanceNote && (
                          <p className="mt-0.5 text-[12px] leading-relaxed text-sky-200/70">
                            ℹ {g.dominanceNote}
                          </p>
                        )}
                      </div>
                    ))}
                </div>

                {data.summation.computable === 0 && (
                  <p className="text-[12px] leading-relaxed text-neutral-400">
                    {tr(
                      "Толық есептелетін топ жоқ — кестедегі топтардың көбі жүйеде " +
                      "өлшенбейтін заттарды қамтиды (күкіртсутек, фенол, формальдегид). " +
                      "Олар үшін жер бетіндегі зертханалық өлшем қажет."
                    )}
                  </p>
                )}

                <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[12px] leading-relaxed text-neutral-400">
                  {data.summation.source.act} · {data.summation.source.amendment} ·{" "}
                  <a
                    href={data.summation.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300/80 underline-offset-2 hover:underline"
                  >
                    {data.summation.source.registration}
                  </a>
                </p>
              </div>
            )}

            {/* Түсті белгілердің мағынасы — «сары» мен «қызылды» болжап
                отырмауы үшін */}
            <div className="mt-3">
              <LevelLegend />
            </div>

            <p className="mt-3 border-t border-white/10 pt-2 text-[12px] leading-relaxed text-amber-200/70">
              ⚖ {data.results[0]?.disclaimer}
            </p>
            <a
              href="/legislation"
              className="mt-1.5 inline-block text-[12px] text-sky-300 underline-offset-2 hover:underline"
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
      <div className="text-[12px] uppercase tracking-wide text-neutral-400">{label}</div>
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
