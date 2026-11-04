"use client";

import { Factory, Flame, Radio, ExternalLink } from "lucide-react";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import type { Facility } from "@/data/facilities";

export interface FacilityPopupAir { aqi: number | null; pm2_5: number | null; pm10: number | null; so2: number | null; no2: number | null }
export interface FacilityPopupStation {
  found: boolean; source?: string; station?: string; distanceKm?: number | null; time?: string | null; aqi?: number | null;
  reason?: string; maxKm?: number; nearest?: { station: string | null; distanceKm: number | null };
}
export interface FacilityFlares { count: number; days: number; fetchedAt: string }

const fmt = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(1));

/**
 * Compact facility popup (pollution-source layer). Shows only what is known; the full
 * registry card with every "Дерек жоқ" field lives on /object/[id], not in the popup.
 */
export function FacilityPopup({ facility, name, share, air, airError, station, flares, flaresError, selected, onToggle }: {
  facility: Facility | undefined; name: string; share: number | null;
  air: FacilityPopupAir | null; airError: boolean; station: FacilityPopupStation | null;
  flares: FacilityFlares | null; flaresError: boolean; selected: boolean; onToggle: () => void;
}) {
  const { tr } = useLang();
  return (
    <div className="w-[min(300px,80vw)] space-y-2 text-[12px] leading-snug text-neutral-900">
      <div>
        <div className="flex items-start gap-1.5 text-[14px] font-semibold">
          <Factory className="mt-0.5 h-4 w-4 shrink-0 text-red-800" aria-hidden /> {name}
        </div>
        {facility && (
          <p className="mt-0.5 text-neutral-700">
            {tr(facility.kind)} · {facility.approx ? tr("координата жуық") : tr("координата расталған")}
          </p>
        )}
      </div>

      {share != null && (
        <div className="rounded border border-neutral-300 bg-neutral-50 p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">{tr("Салыстырмалы үлес")}: {share}%</span>
            <TierBadge tone="light" tier="model" />
          </div>
          <p className="mt-0.5 text-neutral-700">
            {tr("Тізілімдегі нысандар арасындағы бөлінген үлес (жел + CAMS). Салмақтары тексерілмеген — бұл ықтималдық немесе кінә дәлелі ЕМЕС.")}
          </p>
        </div>
      )}

      <div className="rounded border border-neutral-300 p-2">
        <div className="mb-0.5 flex items-center justify-between gap-2 font-semibold">
          <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-red-800" aria-hidden /> {tr("Спутник: жылу аномалиялары")}</span>
          <TierBadge tone="light" tier="measurement" />
        </div>
        {!facility?.footprint ? (
          <p className="text-neutral-700">{tr("Нысан контуры тізілімде жоқ — аномалиялар нысанға телінбейді.")}</p>
        ) : flaresError ? (
          <p className="text-neutral-700">{tr("FIRMS мұрағаты уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
        ) : !flares ? (
          <p role="status">{tr("Жүктелуде…")}</p>
        ) : (
          <p><strong className="tabular-nums">{flares.count}</strong> {tr("детекция соңғы")} {flares.days} {tr("күнде нысан контурында (+375 м)")} · NASA FIRMS VIIRS</p>
        )}
      </div>

      <div className="rounded border border-neutral-300 p-2">
        <div className="mb-0.5 flex items-center justify-between gap-2 font-semibold">
          <span>{tr("Ауа: нүктедегі модель")}</span>
          <TierBadge tone="light" tier="model" />
        </div>
        {airError ? <p className="text-neutral-700">{tr("Тірі ауа деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.")}</p>
          : !air ? <p role="status">{tr("Ауа сапасы жүктелуде…")}</p>
          : (
            <>
              <div className="grid grid-cols-2 gap-x-3 tabular-nums">
                <span>SO₂ {fmt(air.so2)}</span><span>NO₂ {fmt(air.no2)}</span>
                <span>PM₂.₅ {fmt(air.pm2_5)}</span><span>PM₁₀ {fmt(air.pm10)}</span>
              </div>
              <p className="mt-0.5 text-neutral-600">µg/m³ · Copernicus CAMS · {tr("~11 км торкөз орташасы, өлшем емес")}</p>
            </>
          )}
      </div>

      <div className="rounded border border-neutral-300 p-2">
        <div className="mb-0.5 flex items-center gap-1 font-semibold"><Radio className="h-3.5 w-3.5" aria-hidden /> {tr("Жердегі станса")}</div>
        {station?.found ? (
          <p>{station.station} · {station.distanceKm} {tr("км")} · {station.aqi ?? "—"} US AQI · {station.source}</p>
        ) : station?.reason === "no_station_nearby" ? (
          <p className="text-neutral-700">{tr("Нысаннан")} {station.maxKm} {tr("км ішінде ашық онлайн станса жоқ. Қазгидромет посттарының айлық бюллетені — «Ауа» қабатында.")}</p>
        ) : station ? (
          <p className="text-neutral-700">{tr("Дерек жоқ")}</p>
        ) : <p role="status">{tr("Жүктелуде…")}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <button type="button" onClick={onToggle} aria-pressed={selected}
          className={`min-h-[44px] rounded-md border px-3 font-medium ${selected ? "border-brand bg-brand text-white" : "border-neutral-400 bg-white text-neutral-900 hover:bg-neutral-100"}`}>
          {selected ? tr("Таралу анимациясынан алып тастау") : tr("Таралу анимациясына қосу (📊 модель)")}
        </button>
        <a href={`/object/${facility?.id ?? ""}`} className="flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-neutral-400 px-3 font-medium text-brand hover:bg-neutral-100">
          {tr("Толық нысан карточкасы")} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>
    </div>
  );
}
