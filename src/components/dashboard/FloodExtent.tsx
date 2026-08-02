"use client";

import { useEffect, useState } from "react";
import { Waves, Loader2, Download, Info, Satellite } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { ModuleMissing } from "@/components/ui/ModuleMissing";
import { hasModule } from "@/data/regions";
import { useRegion } from "@/store/useRegionStore";

interface Zone {
  id: string; name: string; note: string;
  bbox: [number, number, number, number];
  zoneAreaKm2: number;
  latestDate: string | null;
  coverage: number | null;
  observedKm2: number | null;
  waterKm2: number | null;
  baselineKm2: number | null;
  floodedKm2: number | null;
  floodedPctOfZone: number | null;
  baselineDates: number;
  status: "ok" | "no-baseline" | "no-data";
}

interface FloodData {
  fetchedAt: string;
  source: string;
  method: {
    summary: string; thresholdDb: number; resolutionM: number;
    currentWindow: { from: string; to: string };
    baselineWindow: { label: string };
    deltaExplanation: string;
  };
  totals: { waterKm2: number; baselineKm2: number; floodedKm2: number; zonesOk: number; zonesTotal: number };
  zones: Zone[];
  caveats: string[];
}

const fmt = (v: number | null, d = 1) =>
  v == null ? "—" : v.toLocaleString("kk-KZ", { minimumFractionDigits: d, maximumFractionDigits: d });

const STATUS: Record<Zone["status"], { label: string; cls: string }> = {
  ok: { label: "өлшенді", cls: "text-emerald-300" },
  "no-baseline": { label: "тірек кезең жоқ", cls: "text-amber-300" },
  "no-data": { label: "спутник өтуі жоқ", cls: "text-neutral-500" },
};

export function FloodExtent() {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<FloodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  // Бақылау терезелері тізілімде жоқ аймақ — сұраныс та жіберілмейді
  const missing = !hasModule(region, "floodExtent");
  // Қай аймақ үшін жүктелді — «жүктелуде» күйі осыдан шығарылады,
  // сондықтан эффект ішінде setState синхронды шақырылмайды
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !missing && loadedFor !== region.id;

  useEffect(() => {
    if (missing || loadedFor === region.id) return;
    fetch(`/api/flood-extent?region=${region.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        setData(ok ? d : null);
        setError(ok ? null : d.error ?? "Қолжетімсіз");
      })
      .catch(() => { setData(null); setError("Қолжетімсіз"); })
      .finally(() => setLoadedFor(region.id));
  }, [region.id, missing, loadedFor]);

  return (
    <Card className="border-sky-500/20 bg-sky-500/[0.04]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <TierBadge tier="measurement" />
          <Waves className="h-4 w-4 text-sky-400" />
          {tr("Су басқан аумақ — Sentinel-1 радары")}
          <button
            onClick={() => setShowMethod((v) => !v)}
            className="ml-auto rounded p-1 text-neutral-400 transition hover:bg-white/5 hover:text-white"
            aria-label={tr("Әдіс туралы")}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </CardTitle>
        <p className="text-[11px] text-neutral-400">
          {tr("Радар бұлт пен түнді елемейді — тасқынды нақты өлшейді")}
        </p>
      </CardHeader>

      <CardContent>
        {missing ? (
          <ModuleMissing module="floodExtent" region={region} />
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Спутник деректері өңделуде…")}
          </div>
        ) : error || !data ? (
          <p className="py-4 text-sm text-neutral-400">{tr(error ?? "Қолжетімсіз")}</p>
        ) : (
          <>
            {showMethod && (
              <div className="mb-3 space-y-1.5 rounded-lg border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-neutral-300">
                <p>{data.method.summary}</p>
                <p className="text-sky-200/80">{data.method.deltaExplanation}</p>
                <p className="text-neutral-400">
                  {tr("Ажыратымдылық")}: {data.method.resolutionM} м ·{" "}
                  {tr("табалдырық")}: {data.method.thresholdDb} дБ
                </p>
                <p className="text-neutral-400">
                  {tr("Тірек кезең")}: {data.method.baselineWindow.label}
                </p>
                <p className="text-neutral-500">{data.source}</p>
                <ul className="mt-2 space-y-1 border-t border-white/10 pt-2 text-amber-200/70">
                  {data.caveats.map((c, i) => (
                    <li key={i}>⚠ {c}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Басты сан — экологқа ең керегі */}
            <div className="mb-3 flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {tr("Су басқан аумақ")}
                </div>
                <div className="text-2xl font-bold text-sky-300">
                  {fmt(data.totals.floodedKm2)} <span className="text-sm font-normal">км²</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {tr("Жалпы су беті")}
                </div>
                <div className="text-lg font-semibold text-neutral-200">
                  {fmt(data.totals.waterKm2)} <span className="text-xs font-normal">км²</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">
                  {tr("Тұрақты су (тірек)")}
                </div>
                <div className="text-lg font-semibold text-neutral-400">
                  {fmt(data.totals.baselineKm2)} <span className="text-xs font-normal">км²</span>
                </div>
              </div>
            </div>

            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[11px]">
                <thead className="text-neutral-400">
                  <tr className="border-b border-white/10">
                    <th className="px-1 py-1.5 font-medium">{tr("Аймақ")}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{tr("Су басқан")}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{tr("Жалпы су")}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{tr("Тірек")}</th>
                    <th className="px-1 py-1.5 text-right font-medium">{tr("Аймақтан")}</th>
                    <th className="px-1 py-1.5 font-medium">{tr("Өлшеу күні")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.zones.map((z) => (
                    <tr key={z.id} className="border-b border-white/5 last:border-0">
                      <td className="px-1 py-1.5">
                        <div className="text-neutral-200">{z.name}</div>
                        <div className={`text-[10px] ${STATUS[z.status].cls}`}>
                          {tr(STATUS[z.status].label)}
                        </div>
                      </td>
                      <td className="px-1 py-1.5 text-right font-semibold text-sky-300">
                        {fmt(z.floodedKm2)}
                      </td>
                      <td className="px-1 py-1.5 text-right text-neutral-300">{fmt(z.waterKm2)}</td>
                      <td className="px-1 py-1.5 text-right text-neutral-500">{fmt(z.baselineKm2)}</td>
                      <td className="px-1 py-1.5 text-right text-neutral-300">
                        {z.floodedPctOfZone == null ? "—" : `${fmt(z.floodedPctOfZone, 2)}%`}
                      </td>
                      <td className="px-1 py-1.5 text-neutral-400">{z.latestDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <a
                href="/api/flood-extent?format=csv"
                className="inline-flex items-center gap-1.5 rounded-md border border-sky-400/30 bg-sky-500/10 px-2.5 py-1.5 text-[11px] text-sky-200 transition hover:bg-sky-500/20"
              >
                <Download className="h-3.5 w-3.5" />
                {tr("CSV жүктеу (Excel)")}
              </a>
              <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
                <Satellite className="h-3 w-3" />
                {data.totals.zonesOk}/{data.totals.zonesTotal} {tr("аймақ өлшенді")}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
