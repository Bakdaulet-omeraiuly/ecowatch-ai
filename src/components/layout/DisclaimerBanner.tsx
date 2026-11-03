"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

// Жария disclaimer: сайт ресми емес, қорытындылар — болжам.
// Бір рет жабуға болады (localStorage).
export function DisclaimerBanner() {
  const { tr, t } = useLang();
  const [show, setShow] = useState(false);
  useEffect(() => {
    setShow(localStorage.getItem("jaiyq-disclaimer") !== "1");
  }, []);
  if (!show) return null;
  return (
    <div className="border-b border-neutral-300 bg-neutral-100">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-1 text-sm leading-snug text-neutral-800">
        <Info aria-hidden="true" className="h-4 w-4 shrink-0 text-[#0b3a6b]" />
        <span className="flex-1">
          {tr(
            "Jaiyq — тәуелсіз жоба, ресми мемлекеттік дереккөз емес. Барлық қорытынды ашық деректерге негізделген болжам; ресми шешім үшін жауапты органдарға жүгініңіз."
          )}
        </span>
        <button
          onClick={() => { localStorage.setItem("jaiyq-disclaimer", "1"); setShow(false); }}
          aria-label={t("site.close")}
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center text-neutral-700 hover:text-neutral-900"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
