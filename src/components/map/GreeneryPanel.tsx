"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TierBadge } from "@/components/ui/TierBadge";
import { GREEN_CITY_BBOX, GRID_ROWS, GRID_COLS, OSM_CAVEATS, NDVI_CAVEATS } from "@/data/greenery";
import { cityCells, type CellPosition, type GreenChangeData, type GreenChangeCell } from "@/lib/greenNdvi";
import type { GreeneryData } from "@/lib/osmGreen";
import { assignToCells, greeningAdvice, ADVICE_TEXT, ADVICE_FOOTER } from "@/lib/greeningAdvice";
import { SourceErrorBox } from "./SourceErrorBox";

export const GREEN_POSITIONS: Record<CellPosition, string> = {
  nw: "Солтүстік-батыс ұяшық", n: "Солтүстік ұяшық", ne: "Солтүстік-шығыс ұяшық",
  w: "Батыс ұяшық", c: "Орталық ұяшық", e: "Шығыс ұяшық",
  sw: "Оңтүстік-батыс ұяшық", s: "Оңтүстік ұяшық", se: "Оңтүстік-шығыс ұяшық",
};
type SourceError = { error: string; reason?: string } | null;
interface Props { osm: GreeneryData | null; osmError: SourceError; change: GreenChangeData | null; changeError: SourceError }

function CountTile({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded bg-neutral-50 p-2 text-center"><div className="text-base font-semibold text-neutral-900">{value}</div><div className="text-[12px] text-neutral-600">{label}</div></div>;
}

export function GreeneryPanel({ osm, osmError, change, changeError }: Props) {
  const { tr } = useLang();
  const [expanded, setExpanded] = useState<string | null>(null);
  const osmOk = osm && !osmError ? osm : null;
  const ndviOk = change && !changeError ? change : null;
  const cells: GreenChangeCell[] = ndviOk?.cells ?? cityCells(GREEN_CITY_BBOX.atyrau, GRID_ROWS, GRID_COLS)
    .map((cell) => ({ ...cell, baseline: null, recent: null, change: null, status: "no-data" }));
  const context = osmOk ? assignToCells(cells, osmOk.context) : null;
  const panelCls = "w-full rounded-lg border border-neutral-300 bg-white p-3 text-[12px] leading-snug text-neutral-800";

  return (
    <div className="w-full space-y-2">
      <section className={panelCls} aria-label={tr("OSM картографиясы")}>
        <span className="text-[13px] font-semibold text-green-800">🗺 {tr("OSM картографиясы")}</span>
        <p className="my-2 text-neutral-600">OpenStreetMap · Overpass API · {tr("толықтығы тексерілмеген")}</p>
        {osmError && <SourceErrorBox title={tr("OSM деректері қолжетімсіз")} err={osmError} tr={tr} />}
        {!osm && !osmError && <p role="status">{tr("Жүктелуде…")}</p>}
        <div className="grid grid-cols-2 gap-1">
          <CountTile label={tr("Саябақтар мен бақтар")} value={osmOk?.counts.park ?? "—"} />
          <CountTile label={tr("Жасыл полигон ауданы (км²)")} value={osmOk ? (osmOk.areaKm2.park + osmOk.areaKm2.wood + osmOk.areaKm2.grass).toFixed(2) : "—"} />
          <CountTile label={tr("Ағаш қатарлары")} value={osmOk?.counts.tree_row ?? "—"} />
          <CountTile label={tr("Жеке ағаштар")} value={osmOk?.counts.tree ?? "—"} />
        </div>
        {osmOk && <div className="mt-2 space-y-1 break-words text-neutral-600">
          <p>{tr("OSM база уақыты")}: {osmOk.osmBase ?? tr("Дерек жоқ")}</p>
          <p>{tr("Алынған уақыты")}: {osmOk.fetchedAt}</p>
          <p>{tr("Өткізілген ашық контурлар / қатынастар")}: {osmOk.skipped.openRings} / {osmOk.skipped.relations}</p>
          {osmOk.stale && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-800">{tr("Ескірген OSM кэші")}: {osmOk.ageHours?.toFixed(1) ?? "—"} {tr("сағат")}</p>}
        </div>}
        {OSM_CAVEATS.map((text) => <p key={text} className="mt-2 text-neutral-600">{tr(text)}</p>)}
        <a className="mt-1 inline-flex min-h-11 items-center text-green-800 underline" href={osmOk?.licenseUrl ?? "https://www.openstreetmap.org/copyright"} target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>
      </section>

      <section className={panelCls} aria-label={tr("NDVI өзгерісі")}>
        <div className="flex flex-wrap items-center gap-1"><TierBadge tone="light" tier="measurement" /><span>{tr("Спутник индексі — жердегі шындық емес")}</span></div>
        <h3 className="my-2 text-[13px] font-semibold">{tr("NDVI өзгерісі")}</h3>
        {changeError && <SourceErrorBox title={tr("NDVI деректері қолжетімсіз")} err={changeError} tr={tr} />}
        {!change && !changeError && <p role="status">{tr("Жүктелуде…")}</p>}
        {ndviOk && <div className="mb-2 space-y-1 text-neutral-600"><p>{ndviOk.seasons.baseline.year} → {ndviOk.seasons.recent.year} · {tr("Маусым–тамыз")}</p><p>{ndviOk.source}</p><p>{tr("Алынған уақыты")}: {ndviOk.fetchedAt}</p><p>{tr("Ажыратымдылық (м)")}: {ndviOk.resolutionM}</p></div>}
        <div className="grid grid-cols-2 gap-1">
          <CountTile label={tr("Өскен")} value={ndviOk?.summary.up ?? "—"} />
          <CountTile label={tr("Азайған")} value={ndviOk?.summary.down ?? "—"} />
          <CountTile label={tr("Тұрақты")} value={ndviOk?.summary.stable ?? "—"} />
          <CountTile label={tr("Дерек жоқ")} value={ndviOk?.summary.noData ?? "—"} />
        </div>
        <div className="my-2 flex flex-wrap gap-2"><span className="text-green-800">● {tr("Өскен")}</span><span className="text-red-800">● {tr("Азайған")}</span><span className="text-neutral-600">● {tr("Тұрақты")}</span><span>{tr("Үзік контур — салыстыру дерегі жоқ")}</span></div>
        {NDVI_CAVEATS.map((text) => <p key={text} className="mt-2 text-neutral-600">{tr(text)}</p>)}
      </section>

      <section className={panelCls} aria-label={tr("Көгалдандыру ұсыныстары")}>
        <div className="mb-2 flex flex-wrap items-center gap-1"><TierBadge tone="light" tier="model" /><span>{tr("Ереже негізінде · AI қолданылмаған")}</span></div>
        <h3 className="mb-2 text-[13px] font-semibold">{tr("Көгалдандыру ұсыныстары")}</h3>
        {(ndviOk || changeError) && cells.map((cell) => {
          const advice = greeningAdvice(cell, context?.[cell.id] ?? null);
          const open = expanded === cell.id;
          return <article key={cell.id} className="mb-2 rounded-md border border-neutral-800">
            <Button type="button" variant="ghost" className="min-h-11 h-auto w-full justify-between whitespace-normal px-2 py-2 text-left text-[12px]" aria-expanded={open} aria-controls={`green-advice-${cell.id}`} onClick={() => setExpanded(open ? null : cell.id)}>{tr(GREEN_POSITIONS[cell.pos])}{open ? <ChevronUp /> : <ChevronDown />}</Button>
            {open && <div id={`green-advice-${cell.id}`} className="space-y-2 p-2 pt-0">
              <dl className="space-y-2">{advice.inputs.map((input) => <div key={input.key}>
                <dt className="text-neutral-600">{tr(input.label)}</dt>
                <dd className="flex flex-wrap items-center gap-1"><span>{input.value == null ? tr("Дерек жоқ") : tr(input.value)}</span><Badge variant="outline" title={input.source} className="border-neutral-700 text-[11px] text-neutral-600">{input.kind === "satellite" ? "🛰 Sentinel-2" : input.kind === "osm" ? "🗺 OSM" : "—"}</Badge></dd>
              </div>)}</dl>
              {cell.recent && <p className="text-neutral-600">{tr("Жарамды апталар / қамту")}: {cell.recent.usableWeeks} / {(cell.recent.coverage * 100).toFixed(0)}% · {cell.recent.firstDate} – {cell.recent.lastDate}</p>}
              <ul className="list-disc space-y-2 pl-4">{advice.codes.map((code) => <li key={code}>{tr(ADVICE_TEXT[code])}</li>)}</ul>
            </div>}
          </article>;
        })}
        {!change && !changeError && <p role="status">{tr("Жүктелуде…")}</p>}
        <p className="mt-2 text-neutral-600">{tr(ADVICE_FOOTER)}</p>
      </section>
    </div>
  );
}
