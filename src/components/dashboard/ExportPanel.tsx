"use client";

import { Download, FileSpreadsheet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge, TierLegend, type Tier } from "@/components/ui/TierBadge";
import { hasModule, MODULE_REASON, type ModuleKey } from "@/data/regions";
import { useRegion } from "@/store/useRegionStore";
import { useState, type MouseEvent } from "react";
import { authHeaders } from "@/lib/authClient";

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
  const [notice, setNotice] = useState<string | null>(null);

  // /api/export is role-gated on the server (P3.9): send the session token and
  // explain 401/403 instead of letting the browser open a JSON error page.
  async function download(e: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!href.startsWith("/api/export")) return;
    e.preventDefault();
    setNotice(null);
    try {
      const res = await fetch(href, { headers: await authHeaders() });
      if (res.status === 401) return setNotice(tr("Жүктеу үшін кіріңіз: экспорт ғалым, қызметкер немесе әкімші рөліне ғана ашық."));
      if (res.status === 403) return setNotice(tr("Экспорт тек ғалым, қызметкер немесе әкімші рөліне ашық. Рөлді әкімші береді."));
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        return setNotice(`${tr("Файл жасалмады")}: ${body?.error ?? res.status}`);
      }
      const name = res.headers.get("Content-Disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "jaiyq.csv";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);
    } catch {
      setNotice(tr("Желі қатесі — файл жасалмады"));
    }
  }
  return (
    <Card className="border-neutral-300 bg-neutral-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-neutral-900">
          <FileSpreadsheet className="h-4 w-4 text-neutral-700" />
          {tr("Есеп үшін жүктеу (CSV / Excel)")}
        </CardTitle>
        <p className="text-[13px] text-neutral-600">
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
                    off ? "text-neutral-600" : "text-neutral-600 group-hover:text-brand"
                  }`}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[13px] ${off ? "text-neutral-600" : "text-neutral-900"}`}>
                      {tr(e.label)}
                    </span>
                    <TierBadge tone="light" tier={e.tier} />
                    {off && (
                      <span className="rounded bg-neutral-100 px-1 py-px text-[12px] uppercase text-neutral-600">
                        {tr("жоқ")}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-tight text-neutral-600">
                    {off ? MODULE_REASON[e.module!] : tr(e.note)}
                  </div>
                </div>
              </>
            );
            return off ? (
              <div
                key={e.label}
                className="flex cursor-not-allowed items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 opacity-70"
              >
                {body}
              </div>
            ) : (
              <a
                key={e.label}
                href={e.href(region.id)}
                onClick={(ev) => download(ev, e.href(region.id))}
                className="group flex items-start gap-2 rounded-lg border border-neutral-300 bg-neutral-50 p-2.5 transition hover:border-neutral-400 hover:bg-neutral-100"
              >
                {body}
              </a>
            );
          })}
        </div>

        {notice && (
          <p role="status" className="mt-2 rounded-md border border-neutral-300 bg-white p-2 text-[13px] text-amber-900 border-l-4 border-l-amber-600">
            {notice} <a href="/auth" className="font-semibold underline">{tr("Кіру")}</a>
          </p>
        )}
        <div className="mt-3 border-t border-neutral-300 pt-2.5">
          <TierLegend tone="light" />
          <p className="mt-2 text-[12px] leading-relaxed text-neutral-600">
            {tr(
              "Дереккөз қолжетімсіз болса файл жасалмайды — бос немесе жалған баған берілмейді."
            )}{" "}
            <a href="/methodology" className="text-sky-800 underline underline-offset-2">
              {tr("Толық әдістеме мен валидация күйі")}
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
