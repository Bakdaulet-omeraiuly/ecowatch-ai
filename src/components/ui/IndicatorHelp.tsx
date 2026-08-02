"use client";

import { useState } from "react";
import { Info, ExternalLink } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { INDICATORS } from "@/data/indicatorRegistry";

// ИНДИКАТОР НЕНІ БІЛДІРЕДІ.
//
// «PM₂.₅ = 34» деген сан өз алдына ештеңе айтпайды: ол не екенін, қалай
// өлшенгенін және неге маңызды екенін білу керек. Барлық мәтін
// `src/data/indicatorRegistry.ts` тізілімінен алынады — жаңа көрсеткіш
// қосқанда тек сол файлға жазылады, мұнда өзгеріс керек емес.
//
// Мұнда AI ЖОҚ: бәрі алдын ала жазылған тізілім мәтіні.

/** Тізілімде жоқ, бірақ UI-де жиі кездесетін көрсеткіштердің қысқа анықтамасы */
const EXTRA: Record<string, { name: string; what: string; unit?: string }> = {
  temperature: { name: "Температура", what: "Ауаның 2 метр биіктіктегі температурасы.", unit: "°C" },
  humidity: {
    name: "Ылғалдылық",
    what: "Салыстырмалы ылғалдылық. Маса тірі қалуы мен шаңның шөгуіне әсер етеді.",
    unit: "%",
  },
  wind: {
    name: "Жел жылдамдығы",
    what:
      "10 м биіктіктегі жел. Әлсіз жел (< 8 км/сағ) ластаушыларды жинақтайды, " +
      "күшті жел шашыратады — сондықтан ауа сапасын түсіндіруде негізгі фактор.",
    unit: "км/сағ",
  },
  pressure: {
    name: "Атмосфералық қысым",
    what:
      "Жоғары қысым (> 1018 гПа) әлсіз желмен қосылса — температуралық инверсия " +
      "ықтимал: ластану жер бетіне жақын қалады.",
    unit: "гПа",
  },
};

interface Props {
  /** indicatorRegistry идентификаторы немесе EXTRA кілті */
  id: string;
  /** Тек мәтін — ашылмалы батырмасыз */
  inline?: boolean;
}

export function IndicatorHelp({ id, inline }: Props) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const ind = INDICATORS.find((i) => i.id === id);
  const extra = EXTRA[id];

  if (!ind && !extra) return null;

  const body = ind ? (
    <div className="space-y-1.5">
      <p className="text-[11px] leading-relaxed text-neutral-300">{ind.what}</p>
      {ind.formula && (
        <p className="font-mono text-[10px] leading-relaxed text-neutral-400">{ind.formula}</p>
      )}
      <p className="text-[10px] leading-relaxed text-neutral-500">
        <span className="text-neutral-400">{tr("Аспап/көзі")}:</span> {ind.instrument} ·{" "}
        <span className="text-neutral-400">{tr("қадам")}:</span> {ind.spatial} ·{" "}
        <span className="text-neutral-400">{tr("жиілік")}:</span> {ind.temporal}
      </p>
      {ind.norms && ind.norms.length > 0 && (
        <p className="text-[10px] leading-relaxed text-neutral-400">
          <span className="text-neutral-500">{tr("Норма")}:</span>{" "}
          {ind.norms
            .map((n) => `${n.label} — ${n.value} ${ind.unit}`)
            .join(" · ")}
        </p>
      )}
      {ind.limits.length > 0 && (
        <p className="text-[10px] leading-relaxed text-amber-200/70">
          ⚠ {ind.limits[0]}
        </p>
      )}
      {!ind.validated && (
        <p className="text-[10px] leading-relaxed text-amber-200/70">
          {tr("Валидацияланбаған")}: {ind.validationNote}
        </p>
      )}
      <a
        href="/methodology"
        className="inline-flex items-center gap-1 text-[10px] text-sky-300 underline-offset-2 hover:underline"
      >
        {tr("Толық әдістеме")} <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  ) : (
    <p className="text-[11px] leading-relaxed text-neutral-300">{extra!.what}</p>
  );

  if (inline) {
    return <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">{body}</div>;
  }

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={tr("Бұл көрсеткіш нені білдіреді?")}
        aria-label={tr("Бұл көрсеткіш нені білдіреді?")}
        className={`shrink-0 rounded p-0.5 transition ${
          open ? "text-sky-300" : "text-neutral-500 hover:text-neutral-200"
        }`}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-white">
              {ind?.name ?? extra!.name}
            </span>
            {ind && <TierBadge tier={ind.tier} />}
          </div>
          {body}
        </div>
      )}
    </>
  );
}
