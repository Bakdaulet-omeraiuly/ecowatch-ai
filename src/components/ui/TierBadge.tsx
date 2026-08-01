"use client";

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

export function TierBadge({ tier, className = "" }: { tier: Tier; className?: string }) {
  const t = TIERS[tier];
  return (
    <span
      title={t.title}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none ${t.cls} ${className}`}
    >
      <span aria-hidden>{t.icon}</span>
      {t.label}
    </span>
  );
}

/** Үш деңгейді бірден түсіндіретін шартты белгі (легенда). */
export function TierLegend({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-neutral-400 ${className}`}>
      {(Object.keys(TIERS) as Tier[]).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <TierBadge tier={k} />
          <span className="hidden sm:inline">{TIERS[k].title.split(".")[0]}</span>
        </span>
      ))}
    </div>
  );
}
