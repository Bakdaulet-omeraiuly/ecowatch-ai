"use client";

import reserve from "@/data/protected/akzhaiyk.json";
import { useLang } from "@/lib/i18n";
import { SourceErrorBox } from "./SourceErrorBox";
import { CLASS_LABEL } from "@/lib/fauna";
import { ringAreaKm2 } from "@/lib/osmLanduse";

export interface FaunaData {
  fetchedAt: string; total: number; label: string;
  byClass: { classKey: string; label: string; records: number }[];
  byMonth: { month: number; records: number }[];
  topSpecies: { key: string; name: string; records: number }[];
  points: { lat: number; lng: number; precisionKm: number; species: string; classKey: string; iucn: string | null }[];
  dieOffEvents: { available: false; reason: string };
  caveats: string[]; license: string;
}

/** WDPA (Protected Planet 342650) reported area, read from protectedplanet.net on 2026-11-04. */
export const WDPA_REPORTED_KM2 = 1115;
export const OSM_RESERVE_KM2 = +reserve.rings.reduce((s, r) => s + ringAreaKm2(r.ring as [number, number][]), 0).toFixed(1);

export const reserveGeo = {
  type: "FeatureCollection" as const,
  features: reserve.rings.map((r) => ({ type: "Feature" as const, properties: { way: r.way }, geometry: { type: "Polygon" as const, coordinates: [r.ring] } })),
};

// P5.4 + P5.5: Ақжайық boundary (OSM, compared with WDPA area) and GBIF observation records.
export function NaturePanel({ fauna, error }: { fauna: FaunaData | null; error: { error: string; reason?: string } | null }) {
  const { tr } = useLang();
  const share = Math.round((OSM_RESERVE_KM2 / WDPA_REPORTED_KM2) * 100);
  const maxMonth = Math.max(1, ...(fauna?.byMonth.map((m) => m.records) ?? [1]));
  const fishRecords = fauna?.byClass.find((c) => c.classKey === "204")?.records ?? 0;
  return (
    <div className="w-full space-y-2 rounded-lg border border-neutral-300 bg-white p-3 text-[12px] leading-snug text-neutral-800">
      <div className="font-semibold text-[13px] text-neutral-900">{tr("«Ақжайық» резерваты")}</div>
      <p>{tr("Шекара")}: <a className="underline" href={reserve.url} target="_blank" rel="noreferrer">{reserve.source}</a> (v{reserve.osmVersion}, {reserve.osmTimestamp.slice(0, 10)}) · {OSM_RESERVE_KM2} км²</p>
      <p className="rounded border border-neutral-300 bg-white p-2 text-amber-900 border-l-4 border-l-amber-600">
        {tr("OSM контуры WDPA-дағы ресми ауданның")} ({WDPA_REPORTED_KM2} км², Protected Planet 342650) {tr("шамамен")} {share}% {tr("ғана қамтиды. Ресми шекара (Үкімет қаулысы) мен WDPA геометриясы салыстырылмады — WDPA API кілт талап етеді. Картадағы контур толық емес болуы мүмкін.")}
      </p>

      <div className="border-t border-neutral-200 pt-2 font-semibold text-[13px] text-neutral-900">{tr("Жануарлар: бақылау жазбалары")}</div>
      {error ? <SourceErrorBox title="GBIF" err={error} tr={tr} />
        : !fauna ? <p role="status">{tr("Жүктелуде…")}</p>
        : (
          <>
            <p className="font-semibold">{tr("Бақылау жазбалары — популяция саны емес")}: {fauna.total.toLocaleString("ru-RU")}</p>
            <table className="w-full"><tbody>
              {fauna.byClass.map((c) => <tr key={c.classKey} className="border-t border-neutral-200"><td className="py-0.5">{tr(CLASS_LABEL[c.classKey] ?? c.label)}</td><td className="text-right tabular-nums">{c.records}</td></tr>)}
              {fishRecords === 0 && <tr className="border-t border-neutral-200"><td className="py-0.5">{tr("Сәулеқанатты балықтар")}</td><td className="text-right">{tr("GBIF-те жазба жоқ — ресми балық қоры есебі қажет")}</td></tr>}
            </tbody></table>
            <div>
              <div className="mb-0.5 text-neutral-600">{tr("Маусымдық өзгеріс (айлар бойынша жазба саны)")}</div>
              <div className="flex h-12 items-end gap-0.5" aria-label={tr("Маусымдық өзгеріс (айлар бойынша жазба саны)")}>
                {fauna.byMonth.map((m) => <div key={m.month} title={`${m.month}: ${m.records}`} className="flex-1 bg-brand/70" style={{ height: `${(m.records / maxMonth) * 100}%` }} />)}
              </div>
              <div className="flex justify-between text-[11px] text-neutral-600"><span>1</span><span>6</span><span>12</span></div>
            </div>
            <div>
              <div className="text-neutral-600">{tr("Ең жиі тіркелген түрлер")}</div>
              <ol className="list-decimal pl-5">{fauna.topSpecies.slice(0, 8).map((s) => <li key={s.key}><i>{s.name}</i> — {s.records}</li>)}</ol>
            </div>
            <p className="rounded border border-neutral-300 bg-neutral-50 p-2">{tr("Расталған қырылу оқиғалары")}: {tr("дерек жоқ")} — {tr(fauna.dieOffEvents.reason)}</p>
            {fauna.caveats.map((c) => <p key={c} className="text-neutral-700">{tr(c)}</p>)}
            <p className="text-neutral-600">GBIF.org · {fauna.fetchedAt.slice(0, 10)} · {tr(fauna.license)}</p>
          </>
        )}
    </div>
  );
}
