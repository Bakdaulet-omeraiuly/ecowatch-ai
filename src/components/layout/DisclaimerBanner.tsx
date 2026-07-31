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
    <div className="flex items-start gap-2 border-b border-yellow-500/20 bg-yellow-500/[0.06] px-3 py-1.5 text-[11px] leading-snug text-yellow-200/90">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        {tr(
          "Jaiyq — тәуелсіз жоба, ресми мемлекеттік дереккөз емес. Барлық қорытынды ашық деректерге негізделген болжам; ресми шешім үшін жауапты органдарға жүгініңіз."
        )}
      </span>
      <button
        onClick={() => { localStorage.setItem("jaiyq-disclaimer", "1"); setShow(false); }}
        aria-label="Жабу"
        className="shrink-0 text-yellow-300/70 hover:text-yellow-200"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
