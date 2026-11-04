"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
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
    <Badge variant="portal"
      data-testid="model-badge"
      className="rounded bg-sky-50 px-1.5 py-0.5 font-semibold text-sky-800"
    >
      <span aria-hidden>📊</span> {tr("Модель нәтижесі")}
    </Badge>
  );
}

export function DispersionFrame({ windMissing, children }: { windMissing: boolean; children?: ReactNode }) {
  const { tr } = useLang();
  const stateCls = windMissing ? "pointer-events-none opacity-50 grayscale" : "";
  return (
    <div
      className="mt-4 rounded-md border border-neutral-300 p-4"
      aria-disabled={windMissing}
      data-testid="dispersion-slider"
      data-wind-missing={windMissing ? "true" : "false"}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-[12px]">
        <ModelBadge />
        <span className="text-neutral-600">{tr("Ластанудың таралуы — уақыт бойынша (есептелген)")}</span>
      </div>
      {windMissing && (
        <p className="mb-1.5 text-[12px] text-amber-800">{tr("Жел деректері жоқ — таралу слайдері қолжетімсіз.")}</p>
      )}
      <div className={stateCls} inert={windMissing}>{children}</div>
    </div>
  );
}
