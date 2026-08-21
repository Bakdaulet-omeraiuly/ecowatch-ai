"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

// Жария disclaimer: сайт ресми емес, қорытындылар — болжам.
// Бір рет жабуға болады (localStorage).
export function DisclaimerBanner() {
  const { tr } = useLang();
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem("jaiyq-disclaimer") !== "1");
  }, []);
  if (!show) return null;
  return (
    <div className="flex items-start gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] leading-snug text-neutral-400 shadow-[inset_3px_0_0_var(--color-neutral-600)]">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        {tr(
          "Jaiyq — тәуелсіз жоба, ресми мемлекеттік дереккөз емес. Барлық қорытынды ашық деректерге негізделген болжам; ресми шешім үшін жауапты органдарға жүгініңіз."
        )}
      </span>
      <button
        onClick={() => { localStorage.setItem("jaiyq-disclaimer", "1"); setShow(false); }}
        aria-label="Жабу"
        className="shrink-0 text-neutral-500 hover:text-neutral-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
