"use client";

import { useState } from "react";
import { HelpCircle, ChevronDown } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { LEVEL_COLOR, LEVEL_MEANING, type ComplianceLevel } from "@/lib/compliance";

// ДЕҢГЕЙЛЕРДІҢ ТҮСІНДІРМЕСІ.
//
// Түсті белгі («сары», «қызыл») өз алдына ақпарат емес — оны әркім
// өзінше түсінеді. Сондықтан әр деңгейдің НАҚТЫ анықтамасы және одан
// шығатын ӘРЕКЕТ жазылады.
//
// Ең маңыздысы — «расталмаған» деңгейді ажырату: ол заңдық тұжырым емес.

const ORDER: ComplianceLevel[] = [
  "ok", "approaching", "exceeded", "exceeded-unverified", "unknown",
];

export function LevelLegend({
  compact, defaultOpen,
}: { compact?: boolean; defaultOpen?: boolean }) {
  const { tr } = useLang();
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left transition hover:bg-white/[0.03]"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
        <span className="flex-1 text-[11px] text-neutral-300">
          {tr("Деңгейлер нені білдіреді?")}
        </span>
        <ChevronDown
          className={`h-3 w-3 shrink-0 text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/5 px-2.5 py-2">
          {ORDER.map((lv) => {
            const m = LEVEL_MEANING[lv];
            return (
              <div key={lv}>
                <span className={`inline-block rounded border px-1.5 py-0.5 text-[9px] ${LEVEL_COLOR[lv]}`}>
                  {tr(m.short)}
                </span>
                <p className="mt-1 text-[10px] leading-relaxed text-neutral-400">{m.full}</p>
                {!compact && (
                  <p className="mt-0.5 text-[10px] leading-relaxed text-neutral-500">
                    → {m.action}
                  </p>
                )}
              </div>
            );
          })}
          <p className="border-t border-white/5 pt-1.5 text-[9px] leading-relaxed text-neutral-500">
            {tr(
              "Спутник пен модель дерегі тексеру тағайындауға негіз болады, " +
                "бірақ өз алдына сот дәлелі емес — жердегі аспаптық өлшем қажет."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
