"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Printer, Loader2, ChevronDown, ExternalLink, Download, ShieldCheck, ShieldAlert } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge, TierLegend } from "@/components/ui/TierBadge";
import { useRegion } from "@/store/useRegionStore";
import {
  INDICATORS, SECTIONS, requiredEndpoints, resolvePath,
  type Indicator, type Norm,
} from "@/data/indicatorRegistry";

// ЭКО-ПАСПОРТ — таңдалған аймақтың экологиялық жағдайының құжаты.
//
// Мақсаты: әр санның ЖАНЫНДА оның қайдан келгені, қалай есептелгені және
// қандай шектеуі бары тұруы. Тексеруге келетін құжат жасау.
//
// Ешбір сан ойдан жасалмайды: дереккөз қолжетімсіз болса «өлшенбеді» деп
// жазылады. Жалпы «эко-балл» да қойылмайды — түрлі бірліктегі, түрлі
// сенімділіктегі көрсеткіштерді бір санға қосу ғылыми негізсіз болар еді.

type Values = Record<string, number | null>;
type Meta = Record<string, { fetchedAt?: string; source?: string; ok: boolean; missingReason?: string | null }>;

const nowStamp = () =>
  new Date().toLocaleString("kk-KZ", { dateStyle: "long", timeStyle: "short" });

function fmt(v: number | null, digits = 0): string {
  if (v == null) return "—";
  return v.toLocaleString("kk-KZ", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Норма бұзылды ма — салыстыру бағытын ескереді. */
function exceeds(v: number | null, n: Norm): boolean {
  if (v == null) return false;
  return n.comparison === "max" ? v > n.value : v < n.value;
}

export default function EcoPassportPage() {
  const { tr } = useLang();
  const region = useRegion();
  const [values, setValues] = useState<Values>({});
  const [meta, setMeta] = useState<Meta>({});
  // Қай аймақ үшін жүктелді — «жүктелуде» күйі осыдан шығарылады,
  // сондықтан эффект ішінде setState синхронды шақырылмайды
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = loadedFor !== region.id;
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [allOpen, setAllOpen] = useState(false);

  useEffect(() => {
    if (loadedFor === region.id) return;
    const eps = requiredEndpoints();
    Promise.all(
      eps.map(async (ep) => {
        try {
          // Аймақ әр эндпоинтке беріледі — паспорт таңдалған қаланікі болады
          const q = ep.includes("?") ? "&" : "?";
          const r = await fetch(`${ep}${q}region=${region.id}`);
          const d = await r.json();
          // Эндпоинт «бұл аймақта модуль жоқ» деп қайтарса — дерек емес
          const missing = d?.available === false;
          return { ep, ok: r.ok && !missing, d, missing: missing ? d : null };
        } catch {
          return { ep, ok: false, d: null, missing: null };
        }
      })
    ).then((res) => {
      const byEp = new Map(res.map((r) => [r.ep, r]));
      const v: Values = {};
      const m: Meta = {};
      for (const r of res) {
        m[r.ep] = {
          ok: r.ok,
          fetchedAt: r.d?.fetchedAt,
          source: r.d?.source,
          missingReason: r.missing?.reason ?? null,
        };
      }
      for (const ind of INDICATORS) {
        const r = byEp.get(ind.endpoint);
        v[ind.id] = r?.ok ? resolvePath(r.d, ind.path) : null;
      }
      setValues(v);
      setMeta(m);
      setLoadedFor(region.id);
    });
  }, [region.id, loadedFor]);

  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setAllOpen((prev) => {
      setOpen(prev ? new Set() : new Set(INDICATORS.map((i) => i.id)));
      return !prev;
    });
  }, []);

  const stats = useMemo(() => {
    const total = INDICATORS.length;
    const measured = INDICATORS.filter((i) => values[i.id] != null).length;
    const validated = INDICATORS.filter((i) => i.validated).length;
    const byTier = {
      measurement: INDICATORS.filter((i) => i.tier === "measurement").length,
      model: INDICATORS.filter((i) => i.tier === "model").length,
      ai: INDICATORS.filter((i) => i.tier === "ai").length,
    };
    const exceeded = INDICATORS.filter(
      (i) => i.norms?.some((n) => exceeds(values[i.id], n))
    ).length;
    return { total, measured, validated, byTier, exceeded };
  }, [values]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
      {/* Басқару жолағы — басып шығаруда жасырылады */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-white">{tr("Экологиялық паспорт")}</h1>
          <p className="text-sm text-neutral-400">
            {tr("Әр көрсеткіштің дереккөзі, формуласы және шектеулері көрсетілген")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleAll}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/10"
          >
            {allOpen ? tr("Әдістемелерді жабу") : tr("Барлық әдістемені ашу")}
          </button>
          <a
            href="/api/export?dataset=air"
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-neutral-200 transition hover:bg-white/10"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20"
          >
            <Printer className="h-3.5 w-3.5" /> PDF / {tr("басып шығару")}
          </button>
        </div>
      </div>

      {/* ===================== ҚҰЖАТ ===================== */}
      <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 print:rounded-none print:border-0 print:bg-white print:p-0 print:text-black sm:p-8">
        {/* Титул */}
        <header className="border-b border-white/10 pb-5 print:border-gray-300">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-400 print:text-green-800">
                Jaiyq · {tr("экологиялық мониторинг")}
              </div>
              <h2 className="mt-1.5 text-2xl font-bold leading-tight text-white print:text-black">
                {region.name} — {tr("экологиялық паспорт")}
              </h2>
              <p className="mt-1 text-xs text-neutral-400 print:text-gray-600">
                {tr("Құжат жасалған уақыт")}: {nowStamp()}
              </p>
            </div>
            <dl className="text-[10px] leading-relaxed text-neutral-500 print:text-gray-600">
              <div className="flex gap-2">
                <dt>{tr("Аумақ")}:</dt>
                <dd className="text-neutral-300 print:text-black">{region.name}, {region.countryName}</dd>
              </div>
              <div className="flex gap-2">
                <dt>{tr("Тірек нүкте")}:</dt>
                <dd className="text-neutral-300 print:text-black">
                  {region.lat.toFixed(4)}° N, {region.lng.toFixed(4)}° E
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>{tr("Көрсеткіш саны")}:</dt>
                <dd className="text-neutral-300 print:text-black">{stats.total}</dd>
              </div>
              <div className="flex gap-2">
                <dt>{tr("Құжат нұсқасы")}:</dt>
                <dd className="text-neutral-300 print:text-black">2.0</dd>
              </div>
            </dl>
          </div>
        </header>

        {/* Қысқаша қорытынды */}
        <section className="border-b border-white/10 py-5 print:border-gray-300">
          <h3 className="mb-3 text-sm font-semibold text-white print:text-black">
            {tr("1. Құжат туралы")}
          </h3>
          <p className="mb-3 max-w-3xl text-[12px] leading-relaxed text-neutral-300 print:text-gray-800">
            {tr(
              "Бұл паспорт ресми, ашық дереккөздерден автоматты жиналады. Әр көрсеткіштің " +
              "жанында оның қалай есептелгені, қандай аспаппен алынғаны, ресми құжатқа " +
              "сілтемесі және шектеулері берілген. Мақсаты — санды жай көрсету емес, оны " +
              "тексеруге мүмкіндік беру."
            )}
          </p>
          <div className="grid gap-2 sm:grid-cols-4">
            <Stat label={tr("Деректері бар")} value={`${stats.measured}/${stats.total}`} />
            <Stat label={tr("Валидацияланған")} value={`${stats.validated}/${stats.total}`} />
            <Stat label={tr("Норма асқан")} value={String(stats.exceeded)} warn={stats.exceeded > 0} />
            <Stat
              label={tr("Өлшем / модель")}
              value={`${stats.byTier.measurement} / ${stats.byTier.model}`}
            />
          </div>
          <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 print:border-gray-300 print:bg-gray-50">
            <TierLegend />
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-amber-200/80 print:text-amber-900">
            ⚠{" "}
            {tr(
              "Бұл құжатта жалпы «эко-балл» ЖОҚ. Түрлі бірліктегі және түрлі сенімділік " +
              "деңгейіндегі көрсеткіштерді бір санға қосу ғылыми негізсіз болар еді — " +
              "мұндай балл нақтылық елесін тудырады. Әр көрсеткіш өз нормасымен бөлек салыстырылады."
            )}
          </p>
        </section>

        {/* Көрсеткіштер */}
        {loading ? (
          <div className="flex items-center gap-2 py-10 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Дереккөздерден жиналуда…")}
          </div>
        ) : (
          SECTIONS.map((section, si) => {
            const items = INDICATORS.filter((i) => i.section === section);
            if (!items.length) return null;
            return (
              <section key={section} className="border-b border-white/10 py-5 print:border-gray-300">
                <h3 className="mb-3 text-sm font-semibold text-white print:text-black">
                  {si + 2}. {tr(section)}
                </h3>
                <div className="space-y-2">
                  {items.map((ind) => (
                    <IndicatorRow
                      key={ind.id}
                      ind={ind}
                      value={values[ind.id] ?? null}
                      meta={meta[ind.endpoint]}
                      open={open.has(ind.id)}
                      onToggle={() => toggle(ind.id)}
                      tr={tr}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}

        {/* Дереккөздер тізімі */}
        <section className="border-b border-white/10 py-5 print:border-gray-300">
          <h3 className="mb-3 text-sm font-semibold text-white print:text-black">
            {SECTIONS.length + 2}. {tr("Дереккөздердің толық тізімі")}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead className="text-neutral-400 print:text-gray-600">
                <tr className="border-b border-white/10 print:border-gray-300">
                  <th className="py-1.5 pr-3 font-medium">{tr("Эндпоинт")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Дереккөз")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Жүктелген")}</th>
                  <th className="py-1.5 font-medium">{tr("Күй")}</th>
                </tr>
              </thead>
              <tbody>
                {requiredEndpoints().map((ep) => (
                  <tr key={ep} className="border-b border-white/5 last:border-0 print:border-gray-200">
                    <td className="py-1.5 pr-3 font-mono text-[10px] text-neutral-400 print:text-gray-700">
                      {ep}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-300 print:text-black">
                      {meta[ep]?.source ?? "—"}
                    </td>
                    <td className="py-1.5 pr-3 text-neutral-500 print:text-gray-600">
                      {meta[ep]?.fetchedAt ? meta[ep]!.fetchedAt!.replace("T", " ").slice(0, 16) : "—"}
                    </td>
                    <td className="py-1.5">
                      <span
                        className={
                          meta[ep]?.ok
                            ? "text-emerald-300 print:text-green-700"
                            : meta[ep]?.missingReason
                              ? "text-neutral-400 print:text-gray-600"
                              : "text-amber-300 print:text-amber-800"
                        }
                      >
                        {meta[ep]?.ok
                          ? tr("алынды")
                          : meta[ep]?.missingReason
                            ? tr("бұл аймақта жоқ")
                            : tr("қолжетімсіз")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Жауапкершілік */}
        <footer className="pt-5 text-[11px] leading-relaxed text-neutral-400 print:text-gray-700">
          <h3 className="mb-2 text-sm font-semibold text-white print:text-black">
            {SECTIONS.length + 3}. {tr("Мәртебесі және шектеулері")}
          </h3>
          <ul className="mb-3 list-inside list-disc space-y-1">
            <li>
              {tr(
                "Бұл құжат ресми мемлекеттік экологиялық қорытынды ЕМЕС. Ол ашық спутник " +
                "және модель деректерінің автоматты жинағы."
              )}
            </li>
            <li>
              {tr(
                "«Валидацияланбаған» деп белгіленген көрсеткіштер жердегі өлшеммен " +
                "салыстырылмаған — оларды сот немесе әкімшілік іс үшін дәлел " +
                "ретінде қолдануға болмайды."
              )}
            </li>
            <li>
              {tr(
                "Дереккөз қолжетімсіз болса, көрсеткіш «өлшенбеді» деп жазылады. Бос орын " +
                "ешқашан болжаммен толтырылмайды."
              )}
            </li>
            <li>
              {tr("Толық әдістеме мен валидация күйі")}:{" "}
              <a href="/methodology" className="text-sky-300 underline underline-offset-2 print:text-blue-700">
                ecojaiyq.com/methodology
              </a>
            </li>
          </ul>
          <p className="border-t border-white/10 pt-3 text-neutral-500 print:border-gray-300 print:text-gray-600">
            Jaiyq · ecojaiyq.com · {tr("Қазақстан мен Каспий жағалауының экологиялық AI мониторинг платформасы")}
          </p>
        </footer>
      </article>

      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; color: #000 !important; }
          .print\\:hidden { display: none !important; }
          details { break-inside: avoid; }
          section { break-inside: avoid-page; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 print:border-gray-300 print:bg-gray-50">
      <div className="text-[10px] uppercase tracking-wide text-neutral-500 print:text-gray-600">{label}</div>
      <div className={`text-lg font-bold ${warn ? "text-amber-300 print:text-amber-800" : "text-white print:text-black"}`}>
        {value}
      </div>
    </div>
  );
}

function IndicatorRow({
  ind, value, meta, open, onToggle, tr,
}: {
  ind: Indicator;
  value: number | null;
  meta?: { fetchedAt?: string; source?: string; ok: boolean; missingReason?: string | null };
  open: boolean;
  onToggle: () => void;
  tr: (s: string) => string;
}) {
  const breached = ind.norms?.filter((n) => exceeds(value, n)) ?? [];

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] print:border-gray-300 print:bg-white">
      {/* Басты жол */}
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-white/[0.03] print:cursor-default print:hover:bg-transparent"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TierBadge tier={ind.tier} />
            <span className="text-[13px] font-medium text-white print:text-black">{ind.name}</span>
            {ind.validated ? (
              <ShieldCheck className="h-3 w-3 text-emerald-400" aria-label={tr("валидацияланған")} />
            ) : (
              <ShieldAlert className="h-3 w-3 text-amber-400" aria-label={tr("валидацияланбаған")} />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-neutral-400 print:line-clamp-none print:text-gray-600">
            {ind.what}
          </p>
          {/* Модуль бұл аймақта жоқ — «өлшенбеді» деп қалдырмай, себебін жазамыз */}
          {meta?.missingReason && (
            <p className="mt-1 text-[10px] leading-snug text-neutral-500 print:text-gray-600">
              ⃠ {tr("Бұл аймақта модуль жоқ")}: {meta.missingReason}
            </p>
          )}
        </div>

        <div className="shrink-0 text-right">
          <div
            className={`text-lg font-bold leading-none ${
              value == null
                ? "text-neutral-500"
                : breached.length
                  ? "text-amber-300 print:text-amber-800"
                  : "text-white print:text-black"
            }`}
          >
            {fmt(value, ind.digits ?? 0)}
            <span className="ml-1 text-[10px] font-normal text-neutral-400 print:text-gray-600">
              {ind.unit}
            </span>
          </div>
          {value == null ? (
            <div className="mt-0.5 text-[10px] text-neutral-500">{tr("өлшенбеді")}</div>
          ) : breached.length > 0 ? (
            <div className="mt-0.5 text-[10px] text-amber-300 print:text-amber-800">
              ⚠ {tr("норма асқан")}
            </div>
          ) : ind.norms?.length ? (
            <div className="mt-0.5 text-[10px] text-emerald-400 print:text-green-700">
              {tr("норма шегінде")}
            </div>
          ) : null}
        </div>

        <ChevronDown
          className={`mt-1 h-3.5 w-3.5 shrink-0 text-neutral-500 transition-transform print:hidden ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Әдістеме — басып шығаруда әрқашан ашық */}
      <div className={`${open ? "block" : "hidden"} print:block`}>
        <div className="space-y-3 border-t border-white/10 px-3 py-3 text-[11px] leading-relaxed print:border-gray-200">
          {/* Формула */}
          {ind.formula && (
            <div>
              <Label>{tr("Формула")}</Label>
              <div className="mt-1 overflow-x-auto rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-emerald-200 print:border-gray-300 print:bg-gray-50 print:text-black">
                {ind.formula}
              </div>
            </div>
          )}

          {/* Есептеу тізбегі */}
          <div>
            <Label>{tr("Есептеу тізбегі")}</Label>
            <ol className="mt-1 space-y-0.5 text-neutral-300 print:text-gray-800">
              {ind.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="shrink-0 text-neutral-500 print:text-gray-500">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Техникалық сипаттама */}
          <div className="grid gap-x-5 gap-y-1 sm:grid-cols-2">
            <Field label={tr("Аспап / модель")} value={ind.instrument} />
            <Field label={tr("Кеңістік ажыратымдылығы")} value={ind.spatial} />
            <Field label={tr("Жаңару жиілігі")} value={ind.temporal} />
            <Field label={tr("Кідіріс")} value={ind.latency} />
            <Field label={tr("Эндпоинт")} value={ind.endpoint} mono />
            <Field
              label={tr("Өлшенген уақыт")}
              value={meta?.fetchedAt ? meta.fetchedAt.replace("T", " ").slice(0, 16) + " UTC" : "—"}
            />
          </div>

          {/* Норма */}
          {ind.norms?.length ? (
            <div>
              <Label>{tr("Салыстыру нормасы")}</Label>
              <ul className="mt-1 space-y-0.5">
                {ind.norms.map((n, i) => {
                  const bad = exceeds(value, n);
                  return (
                    <li key={i} className="flex flex-wrap items-center gap-1.5">
                      <span className={bad ? "text-amber-300 print:text-amber-800" : "text-neutral-300 print:text-gray-800"}>
                        {bad ? "⚠" : "✓"} {n.label}: {n.comparison === "max" ? "≤" : "≥"} {n.value}{" "}
                        {ind.unit}
                      </span>
                      <Doc doc={n.source} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {/* Дереккөз құжаттары */}
          <div>
            <Label>{tr("Дереккөз құжаттары")}</Label>
            <ul className="mt-1 space-y-0.5">
              {ind.sources.map((d, i) => (
                <li key={i}>
                  <Doc doc={d} block />
                </li>
              ))}
            </ul>
          </div>

          {/* Ғылыми негізі */}
          {ind.references.length > 0 && (
            <div>
              <Label>{tr("Ғылыми негізі")}</Label>
              <ul className="mt-1 space-y-0.5">
                {ind.references.map((d, i) => (
                  <li key={i}>
                    <Doc doc={d} block />
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Валидация */}
          <div
            className={`rounded-md border px-2.5 py-1.5 ${
              ind.validated
                ? "border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-100 print:border-green-300 print:bg-green-50 print:text-green-900"
                : "border-amber-400/25 bg-amber-500/[0.07] text-amber-100 print:border-amber-300 print:bg-amber-50 print:text-amber-900"
            }`}
          >
            <span className="font-medium">
              {ind.validated ? tr("Валидацияланған") : tr("Валидацияланбаған")}:
            </span>{" "}
            {ind.validationNote}
          </div>

          {/* Шектеулер */}
          <div>
            <Label>{tr("Шектеулері")}</Label>
            <ul className="mt-1 space-y-0.5 text-neutral-400 print:text-gray-700">
              {ind.limits.map((l, i) => (
                <li key={i}>⚠ {l}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 print:text-gray-600">
      {children}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-neutral-500 print:text-gray-600">{label}:</span>
      <span className={`text-neutral-300 print:text-gray-900 ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function Doc({ doc, block }: { doc: { label: string; url?: string; note?: string }; block?: boolean }) {
  const inner = (
    <>
      {doc.label}
      {doc.url && <ExternalLink className="ml-0.5 inline h-2.5 w-2.5 print:hidden" />}
    </>
  );
  return (
    <span className={block ? "block" : "inline"}>
      {doc.url ? (
        <a
          href={doc.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sky-300 underline-offset-2 hover:underline print:text-blue-800 print:no-underline"
        >
          {inner}
        </a>
      ) : (
        <span className="text-neutral-300 print:text-gray-800">{doc.label}</span>
      )}
      {doc.note && (
        <span className="ml-1 text-neutral-500 print:text-gray-600">— {doc.note}</span>
      )}
      {doc.url && (
        <span className="ml-1 hidden text-[9px] text-gray-500 print:inline">({doc.url})</span>
      )}
    </span>
  );
}
