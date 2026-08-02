"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge, TierLegend, type Tier } from "@/components/ui/TierBadge";
import { hasModule, MODULE_REASON, type ModuleKey } from "@/data/regions";
import { useRegion } from "@/store/useRegionStore";

// Эколог есебі үшін CSV экспорт. Әр файлдың соңында дереккөз, әдіс және
// ескертулер тіркеледі — есеп өз бетінше түсінікті болуы үшін.
//
// Барлық сілтемеге таңдалған аймақ беріледі, сондықтан жүктелген файл дәл
// сол қаланікі болады. Аймақта модуль жоқ болса — сілтеме белсенді емес
// әрі «жоқ» деп белгіленеді (бос/жалған файл берілмейді).

const EXPORTS: {
  href: (r: string) => string; label: string; note: string; tier: Tier;
  /** Аймақтық тізілім қажет ететін модуль (болса) */
  module?: ModuleKey;
}[] = [
  {
    href: (r) => `/api/flood-extent?format=csv&region=${r}`,
    label: "Су басқан аумақ",
    note: "Sentinel-1 радары, аймақ бойынша км²",
    tier: "measurement",
    module: "floodExtent",
  },
  {
    href: (r) => `/api/export?dataset=flares&region=${r}`,
    label: "Жылу аномалиялары",
    note: "NASA VIIRS — факел/өрт нүктелері",
    tier: "measurement",
  },
  {
    href: (r) => `/api/export?dataset=air&region=${r}`,
    label: "Ауа сапасы",
    note: "CAMS торы — 12 ластаушы",
    tier: "model",
  },
  {
    href: (r) => `/api/export?dataset=mosquito&region=${r}`,
    label: "Маса индексі",
    note: "JAIYQ-MRI, тор нүктелері",
    tier: "model",
    module: "mosquito",
  },
  {
    href: (r) => `/api/export?dataset=fire&region=${r}`,
    label: "Өрт қаупі",
    note: "Canadian FWI жүйесі",
    tier: "model",
  },
  {
    href: (r) => `/api/export?dataset=drought&region=${r}`,
    label: "Құрғақшылық",
    note: "SPI-3, ERA5 архиві",
    tier: "model",
  },
];

export function ExportPanel() {
  const { tr } = useLang();
  const region = useRegion();
  return (
    <Card className="border-neutral-500/20 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <FileSpreadsheet className="h-4 w-4 text-neutral-300" />
          {tr("Есеп үшін жүктеу (CSV / Excel)")}
        </CardTitle>
        <p className="text-[11px] text-neutral-400">
          {tr("Әр файлда дереккөз, әдіс және ескертулер тіркеледі")} · {region.name}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORTS.map((e) => {
            const off = e.module ? !hasModule(region, e.module) : false;
            const body = (
              <>
                <Download
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    off ? "text-neutral-600" : "text-neutral-400 group-hover:text-white"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[12px] ${off ? "text-neutral-500" : "text-neutral-100"}`}>
                      {tr(e.label)}
                    </span>
                    <TierBadge tier={e.tier} />
                    {off && (
                      <span className="rounded bg-white/10 px-1 py-px text-[8px] uppercase text-neutral-400">
                        {tr("жоқ")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-neutral-500">
                    {off ? MODULE_REASON[e.module!] : tr(e.note)}
                  </div>
                </div>
              </>
            );
            return off ? (
              <div
                key={e.label}
                className="flex cursor-not-allowed items-start gap-2 rounded-lg border border-white/5 bg-black/10 p-2.5 opacity-70"
              >
                {body}
              </div>
            ) : (
              <a
                key={e.label}
                href={e.href(region.id)}
                className="group flex items-start gap-2 rounded-lg border border-white/10 bg-black/20 p-2.5 transition hover:border-white/25 hover:bg-white/5"
              >
                {body}
              </a>
            );
          })}
        </div>

        <div className="mt-3 border-t border-white/10 pt-2.5">
          <TierLegend />
          <p className="mt-2 text-[10px] leading-relaxed text-neutral-500">
            {tr(
              "Дереккөз қолжетімсіз болса файл жасалмайды — бос немесе жалған баған берілмейді."
            )}{" "}
            <a href="/methodology" className="text-sky-300 underline-offset-2 hover:underline">
              {tr("Толық әдістеме мен валидация күйі")}
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
