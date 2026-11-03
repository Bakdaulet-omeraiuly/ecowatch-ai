"use client";

import { useLang } from "@/lib/i18n";
import { SAT_COLUMN_META, SAT_COMMON, isSatColumnKey } from "@/data/satelliteColumns";
import { MetaList } from "@/components/air/SourceBadge";

// Спутник бағаны (Sentinel-5P): ТЕК метадерек, сан жоқ. Бірлік — mol/m² немесе ppb
// (баған), жерүсті концентрациясы ЕМЕС. Концентрация бірлігі осы жерде ешқашан көрсетілмейді.
// Метадерегі жоқ кілт (мысалы MODIS snow) үшін ештеңе көрсетпейді — бұзылмайды.
export function SatColumnNote({ gas, tone = "light" }: { gas: string; tone?: "light" | "dark" }) {
  const { t } = useLang();
  if (!isSatColumnKey(gas)) return null;
  const meta = SAT_COLUMN_META[gas];
  const unitText = meta.unit ? `${meta.unit} · ${t("air.unit.column")}` : t("air.unit.unitless");
  const textClass = tone === "dark" ? "text-neutral-300" : "text-neutral-800";
  return (
    <div className={`mt-1 text-[12px] leading-snug ${textClass}`}>
      <p>{t("air.sat.noValues")}</p>
      <MetaList
        tone={tone}
        rows={[
          {
            k: t("air.source"),
            v: (
              <a
                href={SAT_COMMON.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-[#0b3a6b]"
              >
                {SAT_COMMON.sourceName}
                <span className="sr-only"> ({t("foot.newTab")})</span>
              </a>
            ),
          },
          { k: t("air.unit"), v: unitText },
          { k: t("air.time"), v: t(SAT_COMMON.windowKey as never) },
          { k: t("air.freq"), v: t(SAT_COMMON.cadenceKey as never) },
          { k: t("air.quality"), v: t(SAT_COMMON.qualityKey as never) },
          { k: t("air.uncertainty"), v: t(SAT_COMMON.uncertaintyKey as never) },
        ]}
      />
    </div>
  );
}
