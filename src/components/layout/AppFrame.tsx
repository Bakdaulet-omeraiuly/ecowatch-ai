"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Терезені толық пайдаланатын беттер (карта). Мұнда тақырып (Navbar) мен
// дисклеймер ағында қалады, ал карта қалған биіктікті `flex-1 min-h-0` арқылы
// алады: бекітілген пиксель санына (3.5rem т.б.) тәуелділік жоқ, сондықтан
// тақырып қанша биік болса да (дисклеймер ашық/жабық) карта экраннан шықпайды.
// Бұл беттерде футер жасырылады (Footer.tsx осы тізімді оқиды).
export const FULL_VIEWPORT_ROUTES: ReadonlySet<string> = new Set<string>(["/map"]);

// Басқа беттерде қалыпты ағын: футер беттің төменгі жиегіне түседі.
export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const full = FULL_VIEWPORT_ROUTES.has(pathname);
  return (
    <div className={cn("flex flex-col", full ? "h-dvh overflow-hidden" : "flex-1")}>
      {children}
    </div>
  );
}
