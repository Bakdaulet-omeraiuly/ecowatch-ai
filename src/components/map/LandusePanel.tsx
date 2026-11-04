"use client";

import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { SourceErrorBox } from "./SourceErrorBox";
import { LANDUSE_CATEGORIES, type LanduseCategory } from "@/lib/osmLanduse";
import type { LanduseData } from "@/hooks/useEcoData";

export const LANDUSE_COLOR: Record<LanduseCategory, string> = {
  residential: "#f59e0b", industrial: "#7c3aed", commercial: "#ec4899",
  farmland: "#84cc16", water: "#0ea5e9", extraction: "#57534e", possibly_contaminated: "#b91c1c",
};
const LABEL: Record<LanduseCategory, string> = {
  residential: "Тұрғын аумақ", industrial: "Өнеркәсіп аумағы", commercial: "Сауда / коммерциялық",
  farmland: "Ауыл шаруашылығы жері", water: "Су нысандары", extraction: "Өндіру аумағы (OSM)", possibly_contaminated: "Ықтимал ластанған жер (OSM)",
};

// P4.3: land use is OSM cartography; "possibly contaminated" (OSM landfill/brownfield)
// and "confirmed contamination" (official register — not connected) are shown apart.
export function LandusePanel({ data, error }: { data: LanduseData | null; error: { error: string; reason?: string } | null }) {
  const { tr } = useLang();
  return (
    <div className="w-full rounded-lg border border-neutral-300 bg-white p-3 text-[12px] leading-snug text-neutral-800">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-neutral-900">{tr("Жер пайдалану")}</span>
        <span className="rounded border border-neutral-400 px-1.5 py-0.5 text-[12px] text-neutral-800">🗺 {tr("OSM картографиясы")}</span>
      </div>
      {error ? <SourceErrorBox title={tr("Жер пайдалану")} err={error} tr={tr} />
        : !data ? <p role="status">{tr("Жүктелуде…")}</p>
        : (
          <>
            {data.stale && <p className="mb-2 rounded border border-amber-300 bg-amber-50 p-1.5 text-amber-900">{tr("Ескірген дерек")}: {Math.round(data.ageHours ?? 0)} {tr("сағ")}</p>}
            <table className="mb-2 w-full">
              <thead><tr className="text-neutral-600"><th className="text-left font-normal">{tr("Санат")}</th><th className="text-right font-normal">{tr("Нысан")}</th><th className="text-right font-normal">км²</th></tr></thead>
              <tbody>
                {LANDUSE_CATEGORIES.map((c) => (
                  <tr key={c} className="border-t border-neutral-200">
                    <td className="py-1"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-middle" style={{ background: LANDUSE_COLOR[c] }} />{tr(LABEL[c])}</td>
                    <td className="py-1 text-right tabular-nums">{data.counts[c]}</td>
                    <td className="py-1 text-right tabular-nums">{data.areaKm2[c].toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mb-2 rounded border border-neutral-300 bg-neutral-50 p-2">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-neutral-900"><TierBadge tone="light" tier="measurement" /> {tr("Расталған ластану")}</div>
              <p>{tr("Дерек жоқ")}: {tr(data.confirmedContamination.reason)}</p>
            </div>
            <p className="mb-2"><a className="font-semibold text-green-800 underline" href="https://minerals.e-qazyna.kz/en/contracts-map" target="_blank" rel="noreferrer">{tr("Жер қойнауын пайдалану лицензиялары — ресми интерактивті карта")}</a></p>
            {data.caveats.map((c) => <p key={c} className="mb-1 text-neutral-700">{tr(c)}</p>)}
            <p className="mt-1 text-neutral-600">{data.source} · {new Date(data.fetchedAt).toLocaleDateString()} · <a className="text-green-800 underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">{data.attribution} · ODbL</a></p>
          </>
        )}
    </div>
  );
}
