"use client";

import { useLang } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";

// Сенімділік деңгейінің белгісі.
//
// Сайтта үш түрлі сипаттағы дерек бар, олар бірдей көрінбеуі керек:
//
//   🛰 ӨЛШЕМ    — аспап тікелей өлшеген шама (Sentinel-1 су ауданы,
//                 Sentinel-2 индекстері, VIIRS жалыны). Ең сенімдісі.
//   📊 МОДЕЛЬ   — физикалық/статистикалық модель есептеген шама (CAMS ауа,
//                 GloFAS ағын, ERA5, JAIYQ-MRI, JAIYQ-ML). Өлшем емес,
//                 бірақ ғылыми негізі бар әрі тексерілген әдіс.
//   🤖 AI       — тіл моделінің бағалауы (GPT-4o сурет талдауы, «Неге?»).
//                 Валидацияланбаған, есепке негіз бола алмайды.
//
// Эколог үшін бұл айырма шешуші: біріншісін есепке қоюға болады, үшіншісін
// тек бағыт ретінде қарау керек.

export type Tier = "measurement" | "model" | "ai";

const TIERS: Record<Tier, { icon: string; label: string; title: string; cls: string }> = {
  measurement: {
    icon: "🛰",
    label: "Өлшем",
    title: "Аспап тікелей өлшеген шама. Ең жоғары сенімділік — есепке қоюға жарайды.",
    cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  model: {
    icon: "📊",
    label: "Модель",
    title:
      "Физикалық немесе статистикалық модель есептеген шама. Тікелей өлшем емес, " +
      "бірақ ғылыми негізі бар және әдісі ашық.",
    cls: "border-sky-400/30 bg-sky-500/10 text-sky-200",
  },
  ai: {
    icon: "🤖",
    label: "AI бағалауы",
    title:
      "Тіл моделінің бағалауы. Валидацияланбаған — ресми есепке негіз бола алмайды, " +
      "тек назар аудару үшін.",
    cls: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
};

const LIGHT = {
  measurement: "border-emerald-800 bg-emerald-50 text-emerald-900",
  model: "border-sky-800 bg-sky-50 text-sky-900",
  ai: "border-amber-800 bg-amber-50 text-amber-900",
};

export function TierBadge({ tier, className = "", tone = "dark" }: { tier: Tier; className?: string; tone?: "light" | "dark" }) {
  const { tr } = useLang();
  const t = TIERS[tier];
  return (
    <Badge
      variant="portal"
      title={tr(t.title)}
      className={`leading-snug ${tone === "light" ? LIGHT[tier] : t.cls} ${className}`}
    >
      <span aria-hidden>{t.icon}</span>
      {tr(t.label)}
    </Badge>
  );
}

/** Үш деңгейді бірден түсіндіретін шартты белгі (легенда). */
export function TierLegend({ className = "", tone = "dark" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] ${tone === "light" ? "text-neutral-700" : "text-neutral-400"} ${className}`}>
      {(Object.keys(TIERS) as Tier[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <TierBadge tier={k} tone={tone} />
          <span className="hidden sm:inline">{TIERS[k].title.split(".")[0]}</span>
        </span>
      ))}
    </div>
  );
}
