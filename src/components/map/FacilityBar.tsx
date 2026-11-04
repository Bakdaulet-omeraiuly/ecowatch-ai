"use client";

import { Factory, Flame, Wind, X, ExternalLink, Pause, Play } from "lucide-react";
import { useLang } from "@/lib/i18n";
import type { Facility } from "@/data/facilities";

export interface FacilityBarAir { so2: number | null; no2: number | null }
export interface FacilityBarWind { fromLabel: string; speed: number; toBearing: number }

const fmt = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

/**
 * Pollution-source layer: compact translucent bar at the top of the map. Shows only the few
 * values a reader needs at a glance; the full registry card lives on /object/[id].
 * Each value carries its tier icon (📊 model / 🛰 measurement).
 */
export function FacilityBar({ facility, name, share, wind, air, airError, flares, flaresError, animating, onToggle, onClose }: {
  facility: Facility | undefined; name: string; share: number | null; wind: FacilityBarWind | null;
  air: FacilityBarAir | null; airError: boolean; flares: { count: number; days: number } | null; flaresError: boolean;
  animating: boolean; onToggle: () => void; onClose: () => void;
}) {
  const { tr } = useLang();
  const sep = <span className="hidden h-4 w-px bg-neutral-400/60 sm:block" aria-hidden />;
  return (
    <div
      role="region"
      aria-label={tr("Нысан туралы қысқаша")}
      className="pointer-events-auto absolute left-3 right-[68px] top-3 z-20 max-w-[760px] rounded-xl border border-white/60 bg-white/70 px-3 py-2 text-[12px] text-neutral-900 shadow-lg backdrop-blur-md"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold">
          <Factory className="h-4 w-4 shrink-0 text-red-800" aria-hidden />
          <span className="truncate">{name}</span>
        </span>

        {share != null && (<>{sep}
          <span title={tr("Тізілімдегі нысандар арасындағы бөлінген үлес (жел + CAMS). Салмақтары тексерілмеген — бұл ықтималдық немесе кінә дәлелі ЕМЕС.")}>
            {tr("Үлес")} <strong className="tabular-nums">{share}%</strong> 📊
          </span>
        </>)}

        {wind && (<>{sep}
          <span className="flex items-center gap-1" title={tr("Желдің кететін бағыты — таралу анимациясы осы бойынша")}>
            <Wind className="h-3.5 w-3.5" aria-hidden />
            {tr(wind.fromLabel)} · <span className="tabular-nums">{wind.speed.toFixed(1)}</span> {tr("км/сағ")}
            <span className="inline-block" style={{ transform: `rotate(${wind.toBearing}deg)` }} aria-hidden>↑</span>
          </span>
        </>)}

        {sep}
        <span className="tabular-nums" title={tr("Copernicus CAMS · ~11 км торкөз орташасы, өлшем емес")}>
          {airError ? tr("Ауа: дерек жоқ") : !air ? tr("Ауа…") : <>SO₂ {fmt(air.so2)} · NO₂ {fmt(air.no2)} <span className="text-neutral-600">µg/m³</span> 📊</>}
        </span>

        {facility?.footprint && (<>{sep}
          <span className="flex items-center gap-1" title={tr("NASA FIRMS VIIRS · нысан контуры +375 м")}>
            <Flame className="h-3.5 w-3.5 text-red-800" aria-hidden />
            {flaresError ? tr("дерек жоқ") : !flares ? "…" : <><strong className="tabular-nums">{flares.count}</strong> {tr("жылу нүктесі")} / {flares.days} {tr("күн")}</>} 🛰
          </span>
        </>)}

        <span className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onToggle} aria-pressed={animating}
            className="flex h-8 items-center gap-1 rounded-md border border-neutral-400/70 bg-white/60 px-2 font-medium hover:bg-white"
            title={animating ? tr("Таралу анимациясынан алып тастау") : tr("Таралу анимациясына қосу (📊 модель)")}>
            {animating ? <Pause className="h-3.5 w-3.5" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            <span className="hidden sm:inline">{tr("Таралу")}</span>
          </button>
          <a href={`/object/${facility?.id ?? ""}`}
            className="flex h-8 items-center gap-1 rounded-md border border-neutral-400/70 bg-white/60 px-2 font-medium text-brand hover:bg-white">
            <span className="hidden sm:inline">{tr("Толығырақ")}</span> <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
          <button type="button" onClick={onClose} aria-label={tr("Жабу")}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/80">
            <X className="h-4 w-4" aria-hidden />
          </button>
        </span>
      </div>
    </div>
  );
}
