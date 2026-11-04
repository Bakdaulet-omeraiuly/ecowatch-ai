"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { FULL_VIEWPORT_ROUTES } from "@/components/layout/AppFrame";

// Бейтарап түс шкаласының аймағы.
// Басты бет (жаңа дизайн) — Tailwind-тің стандарт neutral шкаласы
// (`text-neutral-900` = қараңғы мәтін, ақ фон). Қалған беттер бұрын тек
// қараңғы тақырыпқа жазылған (`text-white` тақырып, `text-emerald-400`
// акцент), сондықтан оларға `.legacy-scale` беріледі: онда HEAD-тегі
// қараңғы шкала, қараңғы фон мен ашық мәтін дәл қалпында (globals.css) —
// бет өнімдегідей оқылады. Орам `flex-1`: қысқа бетте де қараңғы фон
// футерге дейін созылады (ақ жолақ қалмайды), әрі flex элементі болғандықтан
// ішкі `mt-*` шегінісі орамнан сыртқа «ағып» шықпайды.
// Бет жаңа дизайнға қолмен көшірілгенде — оның жолын NEW_DESIGN тізіміне қос.
const NEW_DESIGN = new Set<string>(["/", "/validation", "/complaints", "/complaints/new", "/complaints/mine", "/complaints/review"]);

export function ScaleScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const full = FULL_VIEWPORT_ROUTES.has(pathname);
  return (
    <div
      className={cn(
        "flex-1",
        !NEW_DESIGN.has(pathname) && "legacy-scale",
        // Толық экран (карта): балалары қалған биіктікті толтыруы үшін flex-колонна
        full && "flex min-h-0 flex-col"
      )}
    >
      {children}
    </div>
  );
}
