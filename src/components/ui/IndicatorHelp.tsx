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
  tone?: "light" | "dark";
}

/**
 * ҚЫСҚА АНЫҚТАМА — ӘРҚАШАН КӨРІНІП ТҰРАДЫ.
 *
 * Толық мәлімет (формула, аспап, норма, шектеу) ⓘ батырмасының астында
 * қалады, ал «бұл сан не?» деген сұраққа жауап жасырылмайды.
 */
export function IndicatorSummary({ id, className = "", tone = "dark" }: { id: string; className?: string; tone?: "light" | "dark" }) {
  const { tr } = useLang();
  const ind = INDICATORS.find((i) => i.id === id);
  const extra = EXTRA[id];
  const text = ind?.what ?? extra?.what;
  if (!text) return null;
  return (
    <p className={`text-[12px] leading-snug ${tone === "light" ? "text-neutral-600" : "text-neutral-400"} ${className}`}>{tr(text)}</p>
  );
}

/** Көрсеткіштің аты — тізілімнен (UI-дегі қысқа жазумен сәйкессіздік болмауы үшін) */
export function indicatorName(id: string): string | null {
  return INDICATORS.find((i) => i.id === id)?.name ?? EXTRA[id]?.name ?? null;
}

export function IndicatorHelp({ id, inline, tone = "dark" }: Props) {
  const { tr } = useLang();
  const [open, setOpen] = useState(false);
  const ind = INDICATORS.find((i) => i.id === id);
  const extra = EXTRA[id];

  if (!ind && !extra) return null;

  const body = ind ? (
    <div className="space-y-1.5">
      <p className="text-[13px] leading-relaxed text-neutral-300">{tr(ind.what)}</p>
      {ind.formula && (
        <p className="font-mono text-[12px] leading-relaxed text-neutral-400">{tr(ind.formula)}</p>
      )}
      <p className="text-[12px] leading-relaxed text-neutral-400">
        <span className="text-neutral-400">{tr("Аспап/көзі")}:</span> {tr(ind.instrument)} ·{" "}
        <span className="text-neutral-400">{tr("қадам")}:</span> {tr(ind.spatial)} ·{" "}
        <span className="text-neutral-400">{tr("жиілік")}:</span> {tr(ind.temporal)}
      </p>
      {ind.norms && ind.norms.length > 0 && (
        <p className="text-[12px] leading-relaxed text-neutral-400">
          <span className="text-neutral-400">{tr("Норма")}:</span>{" "}
          {ind.norms
            .map((n) => `${tr(n.label)} — ${n.value} ${tr(ind.unit)}`)
            .join(" · ")}
        </p>
      )}
      {ind.limits.length > 0 && (
        <p className="text-[12px] leading-relaxed text-amber-200/70">
          ⚠ {tr(ind.limits[0])}
        </p>
      )}
      {!ind.validated && (
        <p className="text-[12px] leading-relaxed text-amber-200/70">
          {tr("Валидацияланбаған")}: {tr(ind.validationNote)}
        </p>
      )}
      <a
        href="/methodology"
        className="inline-flex items-center gap-1 text-[12px] text-sky-300 underline-offset-2 hover:underline"
      >
        {tr("Толық әдістеме")} <ExternalLink className="h-2.5 w-2.5" />
      </a>
    </div>
  ) : (
    <p className="text-[13px] leading-relaxed text-neutral-300">{tr(extra!.what)}</p>
  );

  if (inline) {
    return <div data-tone={tone} className="rounded-lg bg-white/[0.02] p-2.5">{body}</div>;
  }

  return (
    <div className="contents" data-tone={tone}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={tr("Бұл көрсеткіш нені білдіреді?")}
        aria-label={tr("Бұл көрсеткіш нені білдіреді?")}
        aria-expanded={open}
        className={`shrink-0 rounded p-0.5 transition ${
          open ? "text-sky-300" : "text-neutral-400 hover:text-neutral-200"
        }`}
      >
        <Info className="h-3 w-3" />
      </button>
      {open && (
        <div className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 p-2.5">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="text-[13px] font-medium text-white">
              {tr(ind?.name ?? extra!.name)}
            </span>
            {ind && <TierBadge tier={ind.tier} tone={tone} />}
          </div>
          {body}
        </div>
      )}
    </div>
  );
}
