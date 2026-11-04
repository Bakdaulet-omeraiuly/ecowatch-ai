"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { JaiyqLogo } from "@/components/layout/JaiyqLogo";
import { useLang } from "@/lib/i18n";

// Бүкіл сайттың бірыңғай тақырыбы (layout.tsx арқылы барлық бетте).
// Ойын-сауық элементтері жоқ: атау, логотип, навигация, тіл ауыстырғыш.
export function Navbar() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();

  const links = [
    { href: "/map", label: t("nav.map") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/report", label: t("nav.report") },
    { href: "/complaints", label: t("nav.complaints") },
    { href: "/alerts", label: t("nav.alerts") },
    { href: "/legislation", label: t("nav.legislation") },
    { href: "/methodology", label: t("nav.methodology") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-300 bg-white">
      <div className="bg-[#0b3a6b] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex min-h-[44px] items-center gap-2 font-semibold text-white">
            <JaiyqLogo className="h-7 w-7 text-white" />
            <span className="text-lg">{t("site.name")}</span>
            <span className="hidden text-sm font-normal text-blue-100 sm:inline">· {t("site.subtitle")}</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            <Link href="/auth" className="inline-flex min-h-[44px] items-center px-2 text-sm text-white hover:underline">
              {t("auth.nav")}
            </Link>
            {/* Тіл ауыстырғыш — KZ | RU (EN сақталған, бірақ басты түймеде көрсетілмейді) */}
            <div role="group" aria-label={t("site.lang")} className="flex shrink-0 overflow-hidden rounded border border-blue-300">
              {(["kk", "ru"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={cn(
                    "min-h-[44px] min-w-[44px] px-3 text-sm font-semibold",
                    lang === l ? "bg-white text-[#0b3a6b]" : "text-white hover:bg-white/10"
                  )}
                >
                  {l === "kk" ? "KZ" : "RU"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <nav aria-label={t("site.navMain")} className="mx-auto max-w-6xl px-2">
        <ul className="flex snap-x gap-1 overflow-x-auto [scrollbar-width:thin]">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <li key={l.href} className="shrink-0 snap-start">
                <Link
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-[44px] items-center whitespace-nowrap border-b-4 px-3 text-sm font-medium",
                    active
                      ? "border-[#0b3a6b] text-[#0b3a6b]"
                      : "border-transparent text-neutral-800 hover:text-[#0b3a6b]"
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
