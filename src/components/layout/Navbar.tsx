"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { JaiyqLogo } from "@/components/layout/JaiyqLogo";
import { useLang } from "@/lib/i18n";

export function Navbar() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();

  const links = [
    { href: "/map", label: t("nav.map") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/report", label: t("nav.report") },
    { href: "/moderation", label: t("nav.moderation") },
    { href: "/eco-passport", label: t("nav.passport") },
    { href: "/alerts", label: t("nav.alerts") },
  ];
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <JaiyqLogo className="h-6 w-6 text-emerald-400" />
          <span className="text-lg">Jaiyq</span>
          <span className="ml-2 hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-normal text-emerald-300 sm:inline">
            {t("nav.tagline")}
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                pathname === l.href
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {l.label}
            </Link>
          ))}

          {/* Тіл ауыстырғыш KZ / RU / EN */}
          <div className="ml-2 flex items-center overflow-hidden rounded-md border border-white/10">
            {(["kk", "ru", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={cn(
                  "px-2 py-1 text-xs font-medium uppercase transition-colors",
                  lang === l
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "text-neutral-500 hover:bg-white/5 hover:text-white"
                )}
              >
                {l === "kk" ? "KZ" : l === "ru" ? "RU" : "EN"}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
