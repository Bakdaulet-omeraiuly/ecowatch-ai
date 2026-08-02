"use client";

import { CircleSlash } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { MODULE_KZ, MODULE_REASON, type ModuleKey, type Region } from "@/data/regions";

// «БҰЛ АЙМАҚТА ЖОҚ» БЛОГЫ.
//
// Ең маңызды ережеміз: жоқ дерек — жалған санмен толтырылмайды.
// Бірақ БОС орын да дұрыс емес: пайдаланушы «бәрі тыныш» деп ойлап
// қалуы мүмкін. Сондықтан модуль жоқ болса, НЕГЕ жоқ екені ашық жазылады.
//
// Түсі — сұр (мәлімет), қызыл емес: бұл қате емес, әлі жасалмаған дүние.

interface Props {
  module: ModuleKey;
  region: Region;
  /** Сервер қайтарған себеп (болса) — тізілімдегі мәтіннен басым */
  reason?: string;
  /** Панельдерге арналған ықшам нұсқа */
  compact?: boolean;
}

export function ModuleMissing({ module: key, region, reason, compact }: Props) {
  const { tr } = useLang();
  const why = reason || MODULE_REASON[key];

  if (compact) {
    return (
      <div className="space-y-1">
        <p className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-300">
          <CircleSlash className="h-3 w-3 shrink-0 text-neutral-500" />
          {region.name}: {tr("бұл модуль жоқ")}
        </p>
        <p className="text-[10px] leading-snug text-neutral-500">{why}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-start gap-2">
        <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-neutral-200">
            «{MODULE_KZ[key]}» — {region.name} {tr("үшін әлі қолжетімсіз")}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-400">{why}</p>
        </div>
      </div>
      <p className="border-t border-white/5 pt-2 text-[10px] leading-relaxed text-neutral-500">
        {tr(
          "Басқа қаланың деректері мұнда көрсетілмейді — ол жалған дерек болар еді. " +
            "Тізілім толықтырылған соң модуль автоматты қосылады."
        )}
      </p>
    </div>
  );
}

/** Аймақта жоқ модульдерді бір жолда тізетін ықшам белгі */
export function MissingModulesNote({
  region, modules,
}: { region: Region; modules: ModuleKey[] }) {
  const { tr } = useLang();
  if (!modules.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <p className="text-[11px] leading-relaxed text-neutral-400">
        <span className="text-neutral-300">{region.name}</span>{" "}
        {tr("үшін әзірге жоқ модульдер:")}{" "}
        <span className="text-neutral-300">
          {modules.map((m) => MODULE_KZ[m]).join(" · ")}
        </span>
      </p>
      <p className="mt-1 text-[10px] text-neutral-500">
        {tr("Олар аймақтық тізілімді (кәсіпорындар, өзен нүктелері, бақылау терезелері) талап етеді. Жалған дерек орнына «жоқ» деп көрсетіледі.")}
      </p>
    </div>
  );
}
