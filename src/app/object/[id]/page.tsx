"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  Factory, Loader2, MapPin, Scale, Satellite, FileText, Printer, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge, type Tier } from "@/components/ui/TierBadge";
import { LEVEL_COLOR, LEVEL_KZ, type ComplianceLevel } from "@/lib/compliance";

// ОБЪЕКТ КАРТАСЫ — бір өнеркәсіп нысанының толық құжаты.
//
// Бөлімдер (сен айтқан құрылым):
//   Жалпы ақпарат · Экологиялық көрсеткіштер · Заңға сәйкестік ·
//   Спутник суреттері (Timeline) · Дәлелдер · Есеп құру
//
// AI мұнда ЖОҚ — бәрі өлшем немесе ресми модель.

interface ComplianceItem {
  indicatorId: string; name: string; unit: string;
  value: number | null; worst: ComplianceLevel; kzViolation: boolean; summary: string;
  checks: {
    norm: { limit: number; unit: string; status: string; statusNote: string };
    act: { jurisdiction: string; number: string; title: string; url?: string };
    averagingKz: string; ratio: number; level: ComplianceLevel;
  }[];
  disclaimer: string;
}

interface ObjData {
  id: string; name: string; short: string; kind: string;
  coords: { lat: number; lng: number; approx: boolean };
  fetchedAt: string;
  general: { emissionProfile: Record<string, number>; profileNote: string; coordsNote: string };
  air: Record<string, number | string | null> & { error?: string; source?: string };
  compliance: { results: ComplianceItem[]; kzViolations: number; checked: number };
  evidence: { kind: string; instrument: string; resolution: string; time: string; values: string; note: string; tier: Tier }[];
  timeline: { year: number; imageUrl: string; source: string }[];
  nearbyFlares: { lat: number; lng: number; frp: number; acqDate: string; confidence: string; distanceKm: number }[];
  disclaimer: string;
  causalityWarning: string;
}

const PROFILE_KZ: Record<string, string> = {
  so2: "SO₂ — күкірт диоксиді",
  no2: "NO₂ — азот диоксиді",
  pm: "Қатты бөлшектер",
  voc: "Ұшпа органикалық қосылыстар",
};

export default function ObjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { tr } = useLang();
  const [d, setD] = useState<ObjData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/object/${id}`)
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (ok) { setD(j); setYear(j.timeline[j.timeline.length - 1]?.year ?? null); }
        else setErr(j.error ?? "Қолжетімсіз");
      })
      .catch(() => !cancelled && setErr("Қолжетімсіз"))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="flex items-center gap-2 text-sm text-neutral-400">
          <Loader2 className="h-4 w-4 animate-spin" /> {tr("Нысан деректері жиналуда…")}
        </div>
      </main>
    );
  }
  if (err || !d) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-16 text-neutral-300">
        <p>{tr(err ?? "Қолжетімсіз")}</p>
        <Link href="/map" className="mt-3 inline-block text-sky-300 hover:underline">
          ← {tr("Картаға оралу")}
        </Link>
      </main>
    );
  }

  const shot = d.timeline.find((t) => t.year === year) ?? d.timeline[d.timeline.length - 1];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 print:max-w-none print:py-0">
      {/* Тақырып */}
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Factory className="h-5 w-5 text-neutral-300" />
            <h1 className="text-2xl font-bold text-white">{d.name}</h1>
            {d.compliance.kzViolations > 0 ? (
              <span className="rounded-full border border-red-400/40 bg-red-500/15 px-2 py-0.5 text-[12px] font-semibold text-red-200">
                ⚖ LAW ALERT — {d.compliance.kzViolations}
              </span>
            ) : (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-[12px] text-emerald-200">
                ✓ VERIFIED — {tr("расталған асу жоқ")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            {d.kind} · <MapPin className="inline h-3 w-3" /> {d.coords.lat.toFixed(4)},{" "}
            {d.coords.lng.toFixed(4)}
            {d.coords.approx && <span className="ml-1 text-amber-300">({tr("жуық")})</span>}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 transition hover:bg-emerald-500/20 print:hidden"
        >
          <Printer className="h-3.5 w-3.5" /> {tr("Есеп құру (PDF)")}
        </button>
      </header>

      {/* Себептілік ескертуі — ең маңыздысы, жоғарыда */}
      <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-amber-200">
          <AlertTriangle className="h-4 w-4" /> {tr("Себептілік туралы")}
        </div>
        <p className="text-[13px] leading-relaxed text-amber-100/90">{d.causalityWarning}</p>
      </div>

      {/* 1. Экологиялық көрсеткіштер + заңға сәйкестік */}
      <Section n={1} title={tr("Экологиялық көрсеткіштер және заңға сәйкестік")} icon={Scale}>
        <div className="mb-2 flex items-center gap-2">
          <TierBadge tier="model" />
          <span className="text-[12px] text-neutral-400">
            {d.air.source ?? "Copernicus CAMS"} · {tr("осы координатада")}
          </span>
        </div>
        {d.air.error ? (
          <p className="text-sm text-neutral-400">{d.air.error}</p>
        ) : (
          <div className="space-y-1.5">
            {d.compliance.results.map((r) => (
              <div key={r.indicatorId} className="rounded-lg bg-white/[0.02] p-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[12px] ${LEVEL_COLOR[r.worst]}`}>
                    {tr(LEVEL_KZ[r.worst])}
                  </span>
                  <span className="text-[13px] text-neutral-100">{r.name}</span>
                  <span className="ml-auto text-[14px] font-semibold text-white">
                    {r.value == null ? "—" : `${r.value} ${r.unit}`}
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-neutral-400">{r.summary}</p>
                {r.checks.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 border-t border-white/5 pt-1.5 text-[12px] text-neutral-400">
                    {r.checks.map((c, i) => (
                      <span key={i}>
                        {c.act.jurisdiction === "KZ" ? "ҚР" : c.act.jurisdiction} {c.averagingKz}:{" "}
                        {c.norm.limit} {c.norm.unit} —{" "}
                        <span className={c.ratio > 1 ? "text-red-300" : c.ratio >= 0.8 ? "text-amber-300" : "text-emerald-300"}>
                          {Math.round(c.ratio * 100)}%
                        </span>
                        {c.norm.status !== "verified" && (
                          <span className="ml-0.5 text-amber-300/80" title={c.norm.statusNote}>⚠</span>
                        )}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-[12px] leading-relaxed text-amber-200/70">⚖ {d.disclaimer}</p>
      </Section>

      {/* 2. Спутник суреттері — Timeline */}
      <Section n={2} title={tr("Спутник суреттері — уақыт шкаласы")} icon={Satellite}>
        <div className="mb-2 flex flex-wrap gap-1.5 print:hidden">
          {d.timeline.map((t) => (
            <button
              key={t.year}
              onClick={() => setYear(t.year)}
              className={`rounded-md border px-2.5 py-1 text-[13px] transition ${
                year === t.year
                  ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                  : "border-white/15 bg-white/5 text-neutral-300 hover:bg-white/10"
              }`}
            >
              {t.year}
            </button>
          ))}
        </div>
        {shot && (
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shot.imageUrl}
              alt={`${d.name} — ${shot.year}`}
              className="w-full rounded-lg border border-white/10"
              loading="lazy"
            />
            <figcaption className="mt-1 text-[12px] text-neutral-400">
              {shot.year} · {shot.source} ·{" "}
              {d.coords.lat.toFixed(4)}, {d.coords.lng.toFixed(4)}
              <TierBadge tier="measurement" className="ml-1.5" />
            </figcaption>
          </figure>
        )}
      </Section>

      {/* 3. Маңайдағы жылу аномалиялары */}
      {d.nearbyFlares.length > 0 && (
        <Section n={3} title={tr("Маңайдағы жылу аномалиялары (10 км)")} icon={Satellite}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-left text-[13px]">
              <thead className="text-neutral-400">
                <tr className="border-b border-white/10">
                  <th className="py-1.5 pr-3 font-medium">{tr("Қашықтық")}</th>
                  <th className="py-1.5 pr-3 font-medium">FRP</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Сенімділік")}</th>
                  <th className="py-1.5 pr-3 font-medium">{tr("Күні")}</th>
                  <th className="py-1.5 font-medium">{tr("Координата")}</th>
                </tr>
              </thead>
              <tbody>
                {d.nearbyFlares.map((f, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-1.5 pr-3 text-neutral-200">{f.distanceKm} км</td>
                    <td className="py-1.5 pr-3 text-neutral-300">{Math.round(f.frp)} МВт</td>
                    <td className="py-1.5 pr-3 text-neutral-400">{f.confidence}</td>
                    <td className="py-1.5 pr-3 text-neutral-400">{f.acqDate}</td>
                    <td className="py-1.5 font-mono text-[12px] text-neutral-400">
                      {f.lat.toFixed(4)}, {f.lng.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[12px] text-amber-200/70">
            ⚠ {tr("VIIRS газ факелін дала өртінен ажыратпайды — жердегі тексеру қажет.")}
          </p>
        </Section>
      )}

      {/* 4. Дәлелдер тізбегі */}
      <Section n={d.nearbyFlares.length > 0 ? 4 : 3} title={tr("Дәлелдер тізбегі")} icon={FileText}>
        <div className="space-y-2">
          {d.evidence.map((e, i) => (
            <div key={i} className="rounded-lg bg-white/[0.02] p-2.5 text-[13px]">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <TierBadge tier={e.tier} />
                <span className="font-medium text-neutral-100">{e.kind}</span>
                <span className="ml-auto text-[12px] text-neutral-400">
                  {e.time?.replace("T", " ").slice(0, 16)} UTC
                </span>
              </div>
              <div className="text-neutral-200">{e.values}</div>
              <div className="mt-1 text-[12px] text-neutral-400">
                {tr("Аспап")}: {e.instrument} · {tr("ажыратымдылық")}: {e.resolution}
              </div>
              <div className="mt-0.5 text-[12px] text-amber-200/70">⚠ {e.note}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 5. Жалпы ақпарат */}
      <Section n={d.nearbyFlares.length > 0 ? 5 : 4} title={tr("Жалпы ақпарат")} icon={Factory}>
        <dl className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-[max-content_1fr]">
          <dt className="text-neutral-400">{tr("Түрі")}</dt>
          <dd className="text-neutral-200">{d.kind}</dd>
          <dt className="text-neutral-400">{tr("Координата")}</dt>
          <dd className="text-neutral-200">
            {d.coords.lat.toFixed(5)}, {d.coords.lng.toFixed(5)}
          </dd>
          <dt className="text-neutral-400">{tr("Координата дәлдігі")}</dt>
          <dd className="text-neutral-300">{d.general.coordsNote}</dd>
        </dl>

        <div className="mt-3">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">
            {tr("Эмиссия профилі")}
          </div>
          <div className="mt-1 space-y-1">
            {Object.entries(d.general.emissionProfile).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-44 shrink-0 text-[13px] text-neutral-300">
                  {PROFILE_KZ[k] ?? k}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full bg-neutral-400" style={{ width: `${v * 100}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-[12px] text-neutral-400">
                  {Math.round(v * 100)}%
                </span>
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-amber-200/70">
            ⚠ {d.general.profileNote}
          </p>
        </div>
      </Section>

      <footer className="mt-6 border-t border-white/10 pt-4 text-[12px] leading-relaxed text-neutral-400">
        <p>
          {tr("Құжат жасалған уақыт")}: {d.fetchedAt.replace("T", " ").slice(0, 16)} UTC ·
          Jaiyq · ecojaiyq.com
        </p>
        <p className="mt-1">
          <Link href="/legislation" className="text-sky-300 hover:underline">
            {tr("Заңнама")} <ExternalLink className="inline h-2 w-2" />
          </Link>{" "}
          ·{" "}
          <Link href="/methodology" className="text-sky-300 hover:underline">
            {tr("Әдістеме")}
          </Link>{" "}
          ·{" "}
          <Link href="/map" className="text-sky-300 hover:underline print:hidden">
            {tr("Картаға оралу")}
          </Link>
        </p>
      </footer>

      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; color: #000 !important; }
          .print\\:hidden { display: none !important; }
          section { break-inside: avoid-page; }
        }
      `}</style>
    </main>
  );
}

function Section({
  n, title, icon: Icon, children,
}: { n: number; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <Icon className="h-4 w-4 text-neutral-400" />
        {n}. {title}
      </h2>
      {children}
    </section>
  );
}
