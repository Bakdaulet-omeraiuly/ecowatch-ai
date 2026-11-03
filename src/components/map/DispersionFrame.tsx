"use client";

import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";

// P2.4: таралу слайдерінің қоршауы. Таралу — МОДЕЛЬ нәтижесі, өлшем емес,
// сондықтан «Модель нәтижесі» белгісі ешқашан жойылмайды (сұрланған күйде де).
// Жел деректері жоқ болса — қоршау сұрланады, басқару элементтері бұғатталады:
//   · pointer-events-none — тінтуір әрекеті жоқ;
//   · inert — пернетақта фокусы мен экран оқушысы жоқ (PollutionTimeline-да disabled проп жоқ);
//   · aria-disabled — экран оқушысына күйді хабарлайды.

/** «Модель нәтижесі» белгісі. Тест үшін data-testid бар. */
export function ModelBadge() {
  const { tr } = useLang();
  return (
    <span
      data-testid="model-badge"
      className="rounded bg-sky-500/20 px-1.5 py-0.5 font-semibold text-sky-200"
    >
      {tr("Модель нәтижесі")}
    </span>
  );
}

export function DispersionFrame({ windMissing, children }: { windMissing: boolean; children?: ReactNode }) {
  const { tr } = useLang();
  const stateCls = windMissing ? "pointer-events-none opacity-50 grayscale" : "";
  return (
    <div
      className={`mt-2 rounded-lg border p-2.5 ${stateCls}`.trim()}
      aria-disabled={windMissing}
      inert={windMissing}
      data-testid="dispersion-slider"
      data-wind-missing={windMissing ? "true" : "false"}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
        <ModelBadge />
        <span className="text-neutral-400">{tr("Ластанудың таралуы — уақыт бойынша (есептелген)")}</span>
      </div>
      {windMissing && (
        <p className="mb-1.5 text-[12px] text-amber-200">{tr("Жел деректері жоқ — таралу слайдері қолжетімсіз.")}</p>
      )}
      {children}
    </div>
  );
}
