"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";
import { useLang } from "@/lib/i18n";

// Жария disclaimer: сайт ресми емес, қорытындылар — болжам.
// Бір рет жабуға болады (localStorage).
export function DisclaimerBanner() {
  const { tr, t } = useLang();
  // Әдепкі — КӨРІНЕДІ (серверде де): кейін пайда болып мазмұнды итермеуі үшін (CLS).
  // Жабылған болса, бірінші кадрдан кейін жасырылады.
  const [show, setShow] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("jaiyq-disclaimer") === "1") setShow(false); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);
  if (!show) return null;
  return (
    <div className="border-b border-neutral-200 bg-neutral-50">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 text-xs leading-snug text-neutral-700">
        <Info aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#0b3a6b]" />
        {/* Телефонда — қысқа нұсқа, кең экранда — толық мәтін */}
        <span className="flex-1 py-1 sm:hidden">
          {tr("Тәуелсіз жоба, ресми дереккөз емес.")}{" "}
          <Link href="/terms" className="underline underline-offset-2">{tr("Толығырақ")}</Link>
        </span>
        <span className="hidden flex-1 py-1 sm:inline">
          {tr(
            "Jaiyq — тәуелсіз жоба, ресми мемлекеттік дереккөз емес. Барлық қорытынды ашық деректерге негізделген болжам; ресми шешім үшін жауапты органдарға жүгініңіз."
          )}
        </span>
        <button
          onClick={() => { localStorage.setItem("jaiyq-disclaimer", "1"); setShow(false); }}
          aria-label={t("site.close")}
          className="flex min-h-[36px] min-w-[44px] shrink-0 items-center justify-center text-neutral-600 hover:text-neutral-900"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
