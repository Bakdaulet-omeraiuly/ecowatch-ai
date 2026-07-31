"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Camera } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { REPORTS_ENABLED } from "@/lib/features";

/* Кез келген беттен бір рет басып мәселе хабарлауға арналған
   тұрақты (floating) батырма. Хабарлау мен карта бетінде жасырылады
   (карта басқару түймелерімен қабаттаспас үшін). */
const HIDE_ON = ["/report", "/map"];

export function FloatingReportButton() {
  const pathname = usePathname();
  const { t } = useLang();

  if (!REPORTS_ENABLED) return null;
  if (HIDE_ON.includes(pathname)) return null;

  return (
    <Link
      href="/report"
      aria-label={t("float.report")}
      className="group fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-500/30 transition-all hover:bg-emerald-500 hover:shadow-emerald-500/50 sm:bottom-6 sm:right-6"
    >
      <Camera className="h-5 w-5" />
      <span className="hidden max-w-0 overflow-hidden whitespace-nowrap transition-all duration-300 group-hover:max-w-[120px] sm:inline">
        {t("float.report")}
      </span>
    </Link>
  );
}
