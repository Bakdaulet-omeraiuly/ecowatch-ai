"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import {
  X, Loader2, Scale, Database, Sparkles, History, ExternalLink, AlertTriangle, CircleSlash,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { LEVEL_COLOR, LEVEL_KZ, LEVEL_MEANING, type ComplianceLevel } from "@/lib/compliance";
import { IndicatorHelp, IndicatorSummary } from "@/components/ui/IndicatorHelp";
import { LevelLegend } from "@/components/ui/LevelLegend";
import type { LayerKey, SeriesVar } from "@/data/ecoLayers";

// ЭКО ҚАБАТ DRAWER — оң жақтан ашылатын 4 қойындылы панель.
//
//   📊 Нақты деректер — өлшем + өткен/алдағы 24 сағат. AI ЖОҚ.
//   ⚖ Заңнама      — ҚР/WHO/EU нормаларымен салыстыру
//   ✨ AI талдауы   — бөлек батырмамен шақырылады, анық белгіленеді
//   🕘 Тарих        — уақыт қатарының толық көрінісі
//
// Ең маңызды принцип: пайдаланушы қай сан ӨЛШЕМ, қайсысы AI БАҒАЛАУЫ
// екенін бір қарағанда ажыратуы керек.

type Tab = "data" | "legal" | "ai" | "history";

interface HourPoint { time: string; past: boolean; values: Record<string, number | null> }

interface ComplianceItem {
  indicatorId: string; name: string; unit: string;
  value: number | null; worst: ComplianceLevel; kzViolation: boolean; summary: string;
  checks: {
    norm: { limit: number; unit: string; status: string; statusNote: string };
    act: { jurisdiction: string; number: string; title: string; url?: string };
    averagingKz: string; ratio: number; level: ComplianceLevel; timesOver: number | null;
  }[];
  disclaimer: string;
}

interface LayerData {
  key: string; name: string; emoji: string; what: string;
  fetchedAt: string;
  current: Record<string, unknown> | null;
  currentError: string | null;
  /** Модуль осы аймақта жоқ болса — себебі (жалған дерек орнына) */
  moduleMissing: { error: string; reason: string } | null;
  series:
    | { available: true; vars: SeriesVar[]; past24: HourPoint[]; next24: HourPoint[]; note: string | null }
    | { available: false; reason: string };
  compliance: { results: ComplianceItem[]; worst: ComplianceLevel; kzViolations: number; checked: number };
  sources: string[];
  note: string;
}

interface AiOut {
  situation: string;
  drivers: { factor: string; evidence: string }[];
  trend24h: string;
  forecast24h: string;
  recommendations: { priority: string; audience: string; action: string; basis: string }[];
  uncertainty: string;
}

const hh = (t: string) => (t.length > 10 ? t.slice(11, 16) : t.slice(5));

const PRIORITY_CLS: Record<string, string> = {
  жоғары: "border-red-400/40 bg-red-500/15 text-red-200",
  орташа: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  төмен: "border-white/15 bg-white/5 text-neutral-300",
};

export function LayerDrawer({
  layerKey, regionId, onClose,
}: {
  layerKey: LayerKey;
  /** Таңдалған аймақ — барлық дерек сол қала үшін сұралады */
  regionId?: string;
  onClose: () => void;
}) {
  const { tr } = useLang();
  const [tab, setTab] = useState<Tab>("data");
  const [data, setData] = useState<LayerData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [ai, setAi] = useState<AiOut | null>(null);
  const [aiMeta, setAiMeta] = useState<{ generatedAt: string; disclaimer: string } | null>(null);
  const [aiErr, setAiErr] = useState<{ msg: string; detail?: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Қабат ауысқанда компонент `key` арқылы қайта құрылады (төмендегі
  // MapView-дегі шақыруды қара), сондықтан күйді эффект ішінде қолмен
  // тазалаудың қажеті жоқ — бастапқы мәндер сол күйінде дұрыс.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/layer/${layerKey}${regionId ? `?region=${regionId}` : ""}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok) setData(d);
        else setErr(d.error ?? "Қолжетімсіз");
      })
      .catch(() => !cancelled && setErr("Қолжетімсіз"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [layerKey, regionId]);

  const runAi = useCallback(() => {
    setAiLoading(true); setAiErr(null);
    fetch("/api/layer-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: layerKey, region: regionId }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setAi(d.analysis);
          setAiMeta({ generatedAt: d.generatedAt, disclaimer: d.disclaimer });
        } else {
          setAiErr({ msg: d.error ?? "Қолжетімсіз", detail: d.detail });
        }
      })
      .catch(() => setAiErr({ msg: "AI қызметіне қосылу мүмкін болмады" }))
      .finally(() => setAiLoading(false));
  }, [layerKey, regionId]);

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "data", label: "Нақты деректер", icon: Database },
    { id: "legal", label: "Заңнама", icon: Scale },
    { id: "ai", label: "AI талдауы", icon: Sparkles },
    { id: "history", label: "Тарих", icon: History },
  ];

  return (
    <div
      className="
        absolute inset-x-0 bottom-0 z-30 flex max-h-[85dvh] flex-col rounded-t-2xl
        border-t border-white/10 bg-neutral-950/97 backdrop-blur-md
        sm:inset-x-auto sm:right-0 sm:top-0 sm:h-full sm:max-h-none sm:w-[27rem]
        sm:rounded-none sm:border-l sm:border-t-0
      "
    >
      {/* Телефонда сүйреу тұтқасы — панель екенін көрсетеді */}
      <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-white/20 sm:hidden" />
      {/* Тақырып */}
      <div className="flex items-start gap-2 border-b border-white/10 px-4 py-3">
        <span className="text-xl leading-none">{data?.emoji ?? "🌍"}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-white">{data?.name ?? tr("Қабат")}</h2>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-neutral-400">
            {data?.what ?? ""}
          </p>
        </div>
        {data && data.compliance.kzViolations > 0 && (
          <span className="shrink-0 rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[12px] font-semibold text-red-200">
            ⚖ {data.compliance.kzViolations}
          </span>
        )}
        <button
          onClick={onClose}
          className="shrink-0 rounded p-1 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label={tr("Жабу")}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Қойындылар */}
      <div className="flex border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-1 px-1 py-2.5 text-[12px] font-medium transition ${
              tab === t.id
                ? t.id === "ai"
                  ? "border-b-2 border-sky-400 text-sky-300"
                  : "border-b-2 border-emerald-400 text-emerald-300"
                : "border-b-2 border-transparent text-neutral-400 hover:text-neutral-300"
            }`}
          >
            <t.icon className="h-3 w-3" />
            <span className="truncate">{tr(t.label)}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}
          </div>
        ) : err || !data ? (
          <p className="py-6 text-sm text-neutral-400">{tr(err ?? "Қолжетімсіз")}</p>
        ) : (
          <>
            {tab === "data" && <DataTab data={data} tr={tr} />}
            {tab === "legal" && <LegalTab data={data} tr={tr} />}
            {tab === "ai" && (
              <AiTab
                ai={ai} meta={aiMeta} err={aiErr} loading={aiLoading} onRun={runAi} tr={tr}
              />
            )}
            {tab === "history" && <HistoryTab data={data} tr={tr} />}
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------- Нақты деректер -----------------------------

function DataTab({ data, tr }: { data: LayerData; tr: (s: string) => string }) {
  const s = data.series;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TierBadge tier="measurement" />
        <span className="text-[12px] text-neutral-400">{tr("AI қолданылмаған")}</span>
      </div>

      {/* ҚАБАТ НЕНІ БІЛДІРЕДІ — тақырыптағы жазу екі жолға қиылады,
          сондықтан толық мәтін осында тұрады */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
        <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-neutral-400">
          {tr("Бұл қабат нені көрсетеді")}
        </div>
        <p className="text-[13px] leading-relaxed text-neutral-300">{data.what}</p>
        {data.sources.length > 0 && (
          <p className="mt-1.5 border-t border-white/5 pt-1.5 text-[12px] leading-snug text-neutral-400">
            {tr("Дереккөз")}: {data.sources.join(" · ")}
          </p>
        )}
      </div>

      {/* Модуль бұл аймақта жоқ — БОС қалдырмаймыз, себебін жазамыз */}
      {data.moduleMissing && (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-200">
            <CircleSlash className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
            {data.moduleMissing.error}
          </p>
          <p className="text-[12px] leading-relaxed text-neutral-400">{data.moduleMissing.reason}</p>
          <p className="border-t border-white/5 pt-1.5 text-[12px] leading-relaxed text-neutral-400">
            {tr("Басқа қаланың деректері мұнда көрсетілмейді — ол жалған дерек болар еді.")}
          </p>
        </div>
      )}

      {/* Ағымдағы көрсеткіштер.
          Әр жолда ⓘ — сол көрсеткіш НЕНІ БІЛДІРЕТІНІ (тізілім мәтіні),
          астында деңгейлердің мағынасы. Сан жалғыз тұрса түсініксіз. */}
      {data.compliance.results.length > 0 && (
        <div className="space-y-1">
          {data.compliance.results.map((r) => (
            <div
              key={r.indicatorId}
              className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5"
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-300">{r.name}</span>
                <span className="text-[14px] font-semibold text-white">
                  {r.value == null ? "—" : r.value}
                  <span className="ml-0.5 text-[12px] font-normal text-neutral-400">{r.unit}</span>
                </span>
                <span className={`shrink-0 rounded border px-1 py-0.5 text-[12px] ${LEVEL_COLOR[r.worst]}`}>
                  {tr(LEVEL_KZ[r.worst])}
                </span>
                <IndicatorHelp id={r.indicatorId} />
              </div>
              {/* Көрсеткіштің мағынасы — жасырылмайды */}
              <IndicatorSummary id={r.indicatorId} className="mt-0.5" />
              {/* Осы деңгей нақты нені білдіреді */}
              <p className="mt-1 border-t border-white/5 pt-1 text-[12px] leading-snug text-neutral-400">
                <span className="text-neutral-400">{tr(LEVEL_KZ[r.worst])}</span> —{" "}
                {LEVEL_MEANING[r.worst].full}
              </p>
            </div>
          ))}
          <LevelLegend defaultOpen />
        </div>
      )}

      {/* Уақыт қатары */}
      {s.available ? (
        <>
          <SeriesChart title={tr("Өткен 24 сағат")} points={s.past24} vars={s.vars} past />
          <SeriesChart title={tr("Алдағы 24 сағат (ресми болжам)")} points={s.next24} vars={s.vars} />
          {s.note && <p className="text-[12px] leading-relaxed text-neutral-400">{s.note}</p>}
        </>
      ) : (
        <div className="rounded-lg border border-amber-400/25 bg-white/[0.02] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[13px] font-medium text-amber-200">
            <AlertTriangle className="h-3 w-3" /> {tr("24 сағаттық қатар жоқ")}
          </div>
          <p className="text-[13px] leading-relaxed text-amber-100/80">{s.reason}</p>
        </div>
      )}

      <div className="border-t border-white/10 pt-2 text-[12px] leading-relaxed text-neutral-400">
        <div className="mb-1">
          {tr("Дереккөздер")}: {data.sources.join(" · ")}
        </div>
        <div>
          {tr("Жүктелген")}: {data.fetchedAt.replace("T", " ").slice(0, 16)} UTC
        </div>
        <div className="mt-1 text-emerald-300/70">{data.note}</div>
      </div>
    </div>
  );
}

function SeriesChart({
  title, points, vars, past,
}: { title: string; points: HourPoint[]; vars: SeriesVar[]; past?: boolean }) {
  if (!points.length) return null;
  // Бірінші айнымалыны негізгі етіп саламыз (қалғаны Тарих қойындысында)
  const v = vars[0];
  const rows = points.map((p) => ({ t: hh(p.time), val: p.values[v.api] }));
  const color = past ? "#34d399" : "#38bdf8";

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-neutral-300">{title}</span>
        <span className="text-[12px] text-neutral-400">
          {v.label} {v.unit && `(${v.unit})`}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={110}>
        <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
          <defs>
            <linearGradient id={`g-${past ? "p" : "f"}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.5} />
              <stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#a3a3a3" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 9, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={38} />
          <Tooltip
            contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#fff" }}
          />
          <Area type="monotone" dataKey="val" stroke={color} strokeWidth={1.8} fill={`url(#g-${past ? "p" : "f"})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// --------------------------------- Заңнама ----------------------------------

function LegalTab({ data, tr }: { data: LayerData; tr: (s: string) => string }) {
  const items = data.compliance.results;
  if (!items.length) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-neutral-400">
        {tr(
          "Бұл қабат үшін заңнамалық норма тізілімде әлі жоқ. Норма қосылғанда " +
          "салыстыру автоматты іске қосылады."
        )}
        <a href="/legislation" className="mt-1.5 block text-sky-300 underline-offset-2 hover:underline">
          {tr("Норма тізілімі")} →
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-lg border p-2.5 text-[13px] ${
          data.compliance.kzViolations > 0
            ? "border-red-400/40 bg-red-500/10 text-red-100"
            : "border-emerald-400/25 bg-white/[0.02] text-emerald-100"
        }`}
      >
        {data.compliance.kzViolations > 0
          ? `⚖ ${data.compliance.kzViolations} ${tr("көрсеткіш бойынша ҚР нормасы асқан")}`
          : tr("Расталған норма асуы жоқ")}
      </div>

      {items.map((r) => (
        <div key={r.indicatorId} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={`rounded border px-1.5 py-0.5 text-[12px] ${LEVEL_COLOR[r.worst]}`}>
              {tr(LEVEL_KZ[r.worst])}
            </span>
            <span className="text-[13px] font-medium text-neutral-100">{r.name}</span>
            <span className="ml-auto text-[13px] font-semibold text-white">
              {r.value == null ? "—" : `${r.value} ${r.unit}`}
            </span>
          </div>
          <p className="mb-1.5 text-[12px] leading-relaxed text-neutral-400">{r.summary}</p>

          {r.checks.length > 0 && (
            <table className="w-full text-left text-[12px]">
              <tbody>
                {r.checks.map((c, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="py-1 pr-2 text-neutral-300">
                      {c.act.jurisdiction === "KZ" ? "ҚР" : c.act.jurisdiction}
                      {c.norm.status !== "verified" && (
                        <span className="ml-1 text-amber-300/80" title={c.norm.statusNote}>⚠</span>
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
          )}
        </div>
      ))}

      <p className="border-t border-white/10 pt-2 text-[12px] leading-relaxed text-amber-200/70">
        ⚖ {items[0]?.disclaimer}
      </p>
      <a href="/legislation" className="block text-[12px] text-sky-300 underline-offset-2 hover:underline">
        {tr("Заңнама және норма тізілімі")} →
      </a>
    </div>
  );
}

// -------------------------------- AI талдауы --------------------------------

function AiTab({
  ai, meta, err, loading, onRun, tr,
}: {
  ai: AiOut | null;
  meta: { generatedAt: string; disclaimer: string } | null;
  err: { msg: string; detail?: string } | null;
  loading: boolean;
  onRun: () => void;
  tr: (s: string) => string;
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-sky-400/25 bg-white/[0.02] p-2.5">
        <div className="mb-1 flex items-center gap-1.5">
          <TierBadge tier="ai" />
          <span className="text-[12px] text-sky-100/90">{tr("Бөлек, валидацияланбаған қабат")}</span>
        </div>
        <p className="text-[12px] leading-relaxed text-sky-100/70">
          {tr(
            "AI жоғарыдағы нақты сандарды түсіндіреді және ұсыныс береді. Ол жаңа " +
            "дерек жасамайды — тек жүйедегі өлшемдерге сүйенеді."
          )}
        </p>
      </div>

      {!ai && !err && (
        <button
          onClick={onRun}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-sky-500/15 px-3 py-2.5 text-[13px] font-medium text-sky-100 transition hover:bg-sky-500/25 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? tr("Талдау жүргізілуде…") : tr("AI талдауын бастау")}
        </button>
      )}

      {err && (
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[13px] text-neutral-200">{tr(err.msg)}</p>
          {err.detail && <p className="text-[12px] leading-relaxed text-neutral-400">{err.detail}</p>}
          <button
            onClick={onRun}
            className="mt-1 rounded border border-white/15 bg-white/5 px-2 py-1 text-[12px] text-neutral-300 hover:bg-white/10"
          >
            {tr("Қайталау")}
          </button>
        </div>
      )}

      {ai && (
        <div className="space-y-3 text-[13px] leading-relaxed">
          <Block title={tr("Жағдай")}>{ai.situation}</Block>

          <div>
            <BlockLabel>{tr("Негізгі факторлар")}</BlockLabel>
            <ul className="mt-1 space-y-1">
              {ai.drivers.map((d, i) => (
                <li key={i} className="rounded border border-white/10 bg-white/[0.02] px-2 py-1.5">
                  <span className="text-neutral-100">{d.factor}</span>
                  <span className="mt-0.5 block text-[12px] text-sky-200/70">{d.evidence}</span>
                </li>
              ))}
            </ul>
          </div>

          <Block title={tr("Өткен 24 сағат")}>{ai.trend24h}</Block>
          <Block title={tr("Алдағы 24 сағат")}>{ai.forecast24h}</Block>

          <div>
            <BlockLabel>{tr("Ұсыныстар")}</BlockLabel>
            <ul className="mt-1 space-y-1.5">
              {ai.recommendations.map((r, i) => (
                <li key={i} className="rounded-lg border border-white/10 bg-white/[0.02] p-2">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded border px-1.5 py-0.5 text-[12px] ${
                        PRIORITY_CLS[r.priority] ?? PRIORITY_CLS["төмен"]
                      }`}
                    >
                      {r.priority}
                    </span>
                    <span className="text-[12px] text-neutral-400">{r.audience}</span>
                  </div>
                  <div className="text-neutral-100">{r.action}</div>
                  <div className="mt-0.5 text-[12px] text-neutral-400">{tr("Негізі")}: {r.basis}</div>
                </li>
              ))}
            </ul>
          </div>

          <Block title={tr("Белгісіздік")}>{ai.uncertainty}</Block>

          {meta && (
            <div className="border-t border-white/10 pt-2 text-[12px] leading-relaxed text-amber-200/70">
              ⚠ {meta.disclaimer}
              <div className="mt-1 text-neutral-400">
                {tr("Жасалған")}: {meta.generatedAt.replace("T", " ").slice(0, 16)} UTC · gpt-4o
              </div>
            </div>
          )}

          <button
            onClick={onRun}
            disabled={loading}
            className="w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[13px] text-neutral-300 transition hover:bg-white/10 disabled:opacity-60"
          >
            {loading ? tr("Жаңартылуда…") : tr("Талдауды жаңарту")}
          </button>
        </div>
      )}
    </div>
  );
}

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">{children}</div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <BlockLabel>{title}</BlockLabel>
      <p className="mt-0.5 text-neutral-200">{children}</p>
    </div>
  );
}

// ---------------------------------- Тарих -----------------------------------

function HistoryTab({ data, tr }: { data: LayerData; tr: (s: string) => string }) {
  const s = data.series;
  if (!s.available) {
    return (
      <div className="rounded-lg border border-amber-400/25 bg-white/[0.02] p-3 text-[13px] leading-relaxed text-amber-100/80">
        {s.reason}
      </div>
    );
  }
  const all = [...s.past24, ...s.next24];
  const nowIdx = s.past24.length;

  return (
    <div className="space-y-4">
      <p className="text-[12px] text-neutral-400">
        {tr("Тік сызық — қазіргі сәт. Сол жағы өлшем/талдау, оң жағы ресми болжам.")}
      </p>
      {s.vars.map((v) => {
        const rows = all.map((p) => ({ t: hh(p.time), val: p.values[v.api] }));
        return (
          <div key={v.api}>
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-[13px] font-medium text-neutral-300">{v.label}</span>
              <span className="text-[12px] text-neutral-400">{v.unit}</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#a3a3a3" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 9, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={38} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                  labelStyle={{ color: "#fff" }}
                />
                {rows[nowIdx] && (
                  <ReferenceLine x={rows[nowIdx].t} stroke="#fbbf24" strokeDasharray="3 3" />
                )}
                <Area type="monotone" dataKey="val" stroke="#a3a3a3" strokeWidth={1.5} fill="rgba(163,163,163,0.12)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        );
      })}
      <div className="border-t border-white/10 pt-2 text-[12px] text-neutral-400">
        {tr("Дереккөздер")}: {data.sources.join(" · ")}
        <a
          href="/methodology"
          className="ml-1 text-sky-300 underline-offset-2 hover:underline"
        >
          {tr("әдістеме")} <ExternalLink className="inline h-2 w-2" />
        </a>
      </div>
    </div>
  );
}
