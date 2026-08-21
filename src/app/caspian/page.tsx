"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Waves, Loader2, Printer, ExternalLink, AlertTriangle } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { COUNTRY_FLAG, CASPIAN_FACTS, type CountryCode } from "@/data/regions";
import { LEVEL_COLOR, LEVEL_KZ, type ComplianceLevel } from "@/lib/compliance";

// КАСПИЙ ЖАҒАЛАУЫ — бес мемлекеттің қалаларын салыстыру.
//
// Бұл бет форум/презентация үшін жасалған: бір экранда бүкіл Каспий
// жағалауының ауа сапасы, бір дереккөзден, бір уақытта.
//
// Ең маңызды әдістемелік нүкте: салыстыру ТЕҢ болуы керек. Барлық қала
// бір сұраныспен, бір модельден алынған — сондықтан айырма нақты
// жағдайдан туындайды, өлшеу әдісінен емес.

interface Compliance {
  value: number | null; worst: ComplianceLevel; summary: string;
  checks: { act: { jurisdiction: string; number: string }; averagingKz: string; norm: { limit: number; unit: string }; ratio: number; level: ComplianceLevel }[];
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
  littoralStates: number; citiesTotal: number; citiesWithData: number;
  worst: string | null; best: string | null;
  cities: City[];
  legalNote: string; caveats: string[];
}

const fmt = (v: number | null, d = 1) =>
  v == null ? "—" : v.toLocaleString("kk-KZ", { minimumFractionDigits: d, maximumFractionDigits: d });

function aqiColor(aqi: number | null): string {
  if (aqi == null) return "text-neutral-400";
  if (aqi > 80) return "text-red-300";
  if (aqi > 50) return "text-orange-300";
  if (aqi > 25) return "text-amber-300";
  return "text-emerald-300";
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

  const sorted = d?.cities.slice().sort((a, b) => (b.values.aqi ?? -1) - (a.values.aqi ?? -1)) ?? [];
  const maxAqi = Math.max(...sorted.map((c) => c.values.aqi ?? 0), 1);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 print:max-w-none print:py-0">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold text-sky-300">
            <Waves className="h-7 w-7" /> {tr("Каспий жағалауы")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-neutral-400">
            {tr(
              "Бес мемлекеттің жағалау қалаларының ауа сапасы — бір дереккөзден, " +
              "бір уақытта, бір әдіспен."
            )}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-medium text-sky-200 transition hover:bg-sky-500/20 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> {tr("PDF")}
        </button>
      </header>

      {loading ? (
        <div className="flex items-center gap-2 py-10 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {tr("Бес елдің деректері жиналуда…")}
        </div>
      ) : err || !d ? (
        <p className="py-8 text-sm text-neutral-400">
          {tr("Каспий деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді")}
        </p>
      ) : (
        <>
          {/* Жиынтық */}
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label={tr("Жағалау мемлекеті")} value={String(d.littoralStates)} />
            <Stat label={tr("Қала салыстырылды")} value={`${d.citiesWithData}/${d.citiesTotal}`} />
            <Stat label={tr("Ең жоғары AQI")} value={d.worst ?? "—"} warn />
            <Stat label={tr("Ең төмен AQI")} value={d.best ?? "—"} good />
          </div>

          {/* Әдістеме — форумда ең жиі сұралатын нәрсе */}
          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2">
              <TierBadge tier="model" />
              <span className="text-sm font-semibold text-sky-100">{tr("Салыстыру неге тең")}</span>
            </div>
            <p className="text-[13px] leading-relaxed text-sky-100/85">{d.method}</p>
            <p className="mt-1.5 text-[13px] text-neutral-400">{d.source}</p>
          </div>

          {/* Рейтинг */}
          <section className="mb-8">
            <h2 className="mb-3 text-lg font-semibold text-white">
              {tr("Ауа сапасы индексі бойынша")}
            </h2>
            <div className="space-y-1.5">
              {sorted.map((c) => (
                <div key={c.id} className="rounded-lg bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base">{COUNTRY_FLAG[c.country]}</span>
                    <span className="text-[14px] font-medium text-neutral-100">{c.name}</span>
                    <span className="text-[12px] text-neutral-400">{c.countryName}</span>
                    {c.jurisdiction === "KZ" && (
                      <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[12px] text-emerald-200">
                        {tr("ҚР нормасы да тексерілді")}
                      </span>
                    )}
                    <span className={`ml-auto text-xl font-bold ${aqiColor(c.values.aqi)}`}>
                      {c.values.aqi ?? "—"}
                      <span className="ml-1 text-[12px] font-normal text-neutral-400">AQI</span>
                    </span>
                  </div>

                  {/* Салыстырмалы жолақ */}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className={`h-full ${
                        (c.values.aqi ?? 0) > 80 ? "bg-red-500"
                        : (c.values.aqi ?? 0) > 50 ? "bg-orange-500"
                        : (c.values.aqi ?? 0) > 25 ? "bg-amber-400" : "bg-emerald-500"
                      }`}
                      style={{ width: `${((c.values.aqi ?? 0) / maxAqi) * 100}%` }}
                    />
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                    <Pol label="PM₂.₅" v={c.values.pm25} c={c.compliance.pm25} tr={tr} />
                    <Pol label="PM₁₀" v={c.values.pm10} c={c.compliance.pm10} tr={tr} />
                    <Pol label="NO₂" v={c.values.no2} c={c.compliance.no2} tr={tr} />
                    <Pol label="SO₂" v={c.values.so2} c={c.compliance.so2} tr={tr} />
                  </div>

                  <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-400">
                    {c.context} · <span className="text-neutral-400">{tr("Қысым")}:</span> {c.pressure}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Заңнама */}
          <section className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-200">
              <AlertTriangle className="h-4 w-4" /> {tr("Заңнама туралы")}
            </div>
            <p className="text-[13px] leading-relaxed text-amber-100/90">{d.legalNote}</p>
            <p className="mt-2 text-[13px] leading-relaxed text-amber-100/80">
              {CASPIAN_FACTS.legalNote}
            </p>
          </section>

          {/* Шектеулер */}
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-white">{tr("Шектеулер")}</h2>
            <ul className="space-y-1 text-[13px] leading-relaxed text-neutral-400">
              {d.caveats.map((c, i) => (
                <li key={i}>⚠ {c}</li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">
              {CASPIAN_FACTS.note}
            </p>
          </section>

          <footer className="border-t border-white/10 pt-3 text-[12px] text-neutral-400">
            {tr("Жүктелген")}: {d.fetchedAt.replace("T", " ").slice(0, 16)} UTC · Jaiyq ·
            ecojaiyq.com ·{" "}
            <Link href="/methodology" className="text-sky-300 hover:underline">
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

function Stat({ label, value, warn, good }: { label: string; value: string; warn?: boolean; good?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[12px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`truncate text-base font-bold ${warn ? "text-orange-300" : good ? "text-emerald-300" : "text-white"}`}>
        {value}
      </div>
    </div>
  );
}

function Pol({
  label, v, c, tr,
}: { label: string; v: number | null; c: Compliance; tr: (s: string) => string }) {
  const who = c.checks.find((x) => x.act.jurisdiction === "WHO");
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-100">{fmt(v)}</span>
      {who && (
        <span
          className={`rounded border px-1 py-px text-[12px] ${LEVEL_COLOR[c.worst]}`}
          title={`${tr("WHO шегі")}: ${who.norm.limit} ${who.norm.unit} · ${c.summary}`}
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
