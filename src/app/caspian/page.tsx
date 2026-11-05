"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Printer, ExternalLink, AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { COUNTRY_FLAG, CASPIAN_FACTS, type CountryCode } from "@/data/regions";
import { LEVEL_KZ, type ComplianceLevel } from "@/lib/compliance";
import { LEVEL_COLOR_LIGHT as LEVEL_COLOR } from "@/components/ui/compliancePresentation";

// КАСПИЙ ТЕҢІЗІ — анықтама беті.
//
// 2026-11: жүйе тек Атырау мен Каспий теңізіне шектелді. Бет Каспий туралы
// ортақ мәтінді (CASPIAN_FACTS) және жағалаудағы Атырау қаласының тірі
// ауа сапасын көрсетеді. Теңіз деңгейі мен су сапасы дереккөзі әлі
// жалғанбаған — олар үшін ешқандай мән көрсетілмейді.

interface Compliance {
  value: number | null; worst: ComplianceLevel; summary: string;
  checks: { act: { jurisdiction: string; number: string }; averagingKz: string; norm: { limit: number; unit: string }; ratio: number | null; level: ComplianceLevel }[];
}

interface City {
  id: string; name: string; country: CountryCode; countryName: string;
  lat: number; lng: number; context: string; pressure: string;
  values: { aqi: number | null; pm25: number | null; pm10: number | null; no2: number | null; so2: number | null; ozone: number | null; co: number | null };
  compliance: { pm25: Compliance; pm10: Compliance; no2: Compliance; so2: Compliance };
  jurisdiction: "KZ" | "OTHER";
}

interface Data {
  fetchedAt: string; source: string; method: string;
  littoralStates: number;
  city: City;
  legalNote: string; caveats: string[];
}

const fmt = (v: number | null, d = 1) =>
  v == null ? "—" : v.toLocaleString("kk-KZ", { minimumFractionDigits: d, maximumFractionDigits: d });

function aqiColor(aqi: number | null): string {
  if (aqi == null) return "text-neutral-600";
  if (aqi > 80) return "text-red-800";
  if (aqi > 50) return "text-orange-800";
  if (aqi > 25) return "text-amber-800";
  return "text-emerald-800";
}

export default function CaspianPage() {
  const { tr } = useLang();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/caspian")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j) => !cancelled && setD(j))
      .catch(() => !cancelled && setErr(true))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 print:max-w-none print:py-0">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">
            {tr("Каспий жағалауы")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-600">
            {tr(
              "Каспий — бес мемлекеттің ортақ су айдыны. Жағалаудағы Атырау " +
              "қаласының ауа сапасы — тірі дерек."
            )}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 transition hover:bg-sky-100 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> {tr("PDF")}
        </button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-neutral-600">
          <Loader2 className="h-4 w-4 animate-spin" /> {tr("Атырау деректері жүктелуде…")}
        </div>
      ) : err || !d ? (
        <p className="py-8 text-sm text-neutral-600">
          {tr("Каспий деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді")}
        </p>
      ) : (
        <>
          {/* Әдістеме — форумда ең жиі сұралатын нәрсе */}
          <div className="mb-6 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <TierBadge tone="light" tier="model" />
              <span className="text-sm font-semibold text-sky-800">{tr("Дереккөз мен әдіс")}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-sky-800">{tr(d.method)}</p>
            <p className="mt-1.5 text-[13px] text-neutral-600">{tr(d.source)}</p>
          </div>

          {/* Атырау */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              {tr("Атырау — ауа сапасы")}
            </h2>
            <div className="space-y-1.5">
              {[d.city].map((c) => (
                <div key={c.id} className="rounded-lg bg-neutral-50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">{COUNTRY_FLAG[c.country]}</span>
                    <span className="text-[14px] font-medium text-neutral-900">{tr(c.name)}</span>
                    <span className="text-[12px] text-neutral-600">{tr(c.countryName)}</span>
                    {c.jurisdiction === "KZ" && (
                      <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[12px] text-emerald-800">
                        {tr("ҚР нормасы да тексерілді")}
                      </span>
                    )}
                    <span className={`ml-auto text-xl font-bold ${aqiColor(c.values.aqi)}`}>
                      {c.values.aqi ?? "—"}
                      <span className="ml-1 text-[12px] font-normal text-neutral-600">AQI</span>
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <Pol label="PM₂.₅" v={c.values.pm25} c={c.compliance.pm25} tr={tr} />
                    <Pol label="PM₁₀" v={c.values.pm10} c={c.compliance.pm10} tr={tr} />
                    <Pol label="NO₂" v={c.values.no2} c={c.compliance.no2} tr={tr} />
                    <Pol label="SO₂" v={c.values.so2} c={c.compliance.so2} tr={tr} />
                  </div>

                  <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-600">
                    {tr(c.context)} · <span className="text-neutral-600">{tr("Қысым")}:</span> {tr(c.pressure)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Заңнама */}
          <section className="mb-6 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-800">
              <AlertTriangle className="h-4 w-4" /> {tr("Заңнама туралы")}
            </div>
            <p className="text-[13px] leading-relaxed text-amber-800">{tr(d.legalNote)}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-800">
              {tr(CASPIAN_FACTS.legalNote)}
            </p>
          </section>

          {/* Шектеулер */}
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-neutral-900">{tr("Шектеулер")}</h2>
            <ul className="space-y-1 text-[13px] leading-relaxed text-neutral-600">
              {d.caveats.map((c, i) => (
                <li key={i}>{tr(c)}</li>
              ))}
              <li>
                {" "}
                {tr(
                  "Каспий теңізінің деңгейі мен су сапасы бойынша дереккөз әлі " +
                  "жалғанбаған — жалған дерек көрсетілмейді."
                )}
              </li>
            </ul>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
              {tr(CASPIAN_FACTS.note)}
            </p>
          </section>

          <footer className="border-t border-neutral-300 pt-3 text-[12px] text-neutral-600">
            {tr("Жүктелген")}: {d.fetchedAt.replace("T", " ").slice(0, 16)} UTC · Jaiyq ·
            ecojaiyq.com ·{" "}
            <Link href="/methodology" className="text-sky-800 hover:underline">
              {tr("Әдістеме")} <ExternalLink className="inline h-2 w-2" />
            </Link>
          </footer>
        </>
      )}

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: #fff !important; color: #000 !important; }
          .print\\:hidden { display: none !important; }
          section { break-inside: avoid-page; }
        }
      `}</style>
    </main>
  );
}

function Pol({
  label, v, c, tr,
}: { label: string; v: number | null; c: Compliance; tr: (s: string) => string }) {
  // Тек салыстырылатын WHO нормасы (ratio != null). not-comparable WHO-ны «0%» деп көрсетпейміз.
  const who = c.checks.find((x) => x.act.jurisdiction === "WHO" && x.ratio != null);
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-neutral-600">{label}</span>
      <span className="font-medium text-neutral-900">{fmt(v)}</span>
      {who && who.ratio != null && (
        <span
          className={`rounded border px-1 py-px text-[12px] ${LEVEL_COLOR[c.worst]}`}
          title={`${tr("WHO шегі")}: ${who.norm.limit} ${who.norm.unit} · ${tr(c.summary)}`}
        >
          {Math.round(who.ratio * 100)}% {tr("WHO")}
        </span>
      )}
      {!who && c.worst !== "unknown" && (
        <span className={`rounded border px-1 py-px text-[12px] ${LEVEL_COLOR[c.worst]}`}>
          {tr(LEVEL_KZ[c.worst])}
        </span>
      )}
    </span>
  );
}
