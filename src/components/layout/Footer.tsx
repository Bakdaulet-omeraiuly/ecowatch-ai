"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Send, Satellite, Wind, BookOpen } from "lucide-react";
import { JaiyqLogo } from "@/components/layout/JaiyqLogo";
import { useLang } from "@/lib/i18n";

const TELEGRAM_BOT = "https://t.me/jaiyq_atyrau_bot";

// Толық экранды беттерде (карта) футер көрсетілмейді
const HIDE_ON = ["/map"];

export function Footer() {
  const { t } = useLang();
  const pathname = usePathname();
  if (HIDE_ON.includes(pathname)) return null;

  const nav = [
    { href: "/map", label: t("nav.map") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/report", label: t("nav.report") },
    { href: "/alerts", label: t("nav.alerts") },
  ];

  const sources = [
    { icon: Wind, label: "Open-Meteo + Copernicus CAMS", href: "https://open-meteo.com" },
    { icon: Satellite, label: "Sentinel-2 · NASA MODIS", href: "https://dataspace.copernicus.eu" },
    { icon: BookOpen, label: "ScienceDaily · Phys.org", href: "https://www.sciencedaily.com" },
  ];

  return (
    <footer className="relative mt-8 border-t border-white/10 bg-neutral-950">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 font-semibold text-white">
              <JaiyqLogo className="h-6 w-6 text-emerald-400" />
              <span className="text-lg">Jaiyq</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-neutral-400">{t("foot.tagline")}</p>
          </div>

          {/* Nav */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t("foot.nav")}
            </h3>
            <ul className="space-y-2">
              {nav.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className="text-sm text-neutral-400 transition-colors hover:text-emerald-300">
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sources */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t("foot.sources")}
            </h3>
            <ul className="space-y-2.5">
              {sources.map((s) => (
                <li key={s.label}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-neutral-400 transition-colors hover:text-emerald-300"
                  >
                    <s.icon className="h-3.5 w-3.5 flex-shrink-0 text-neutral-500" />
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              {t("foot.contact")}
            </h3>
            <a
              href={TELEGRAM_BOT}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl border border-white/10 bg-sky-500/10 p-3 transition-colors hover:bg-sky-500/15"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-sky-300">
                <Send className="h-4 w-4" /> {t("foot.tg")}
              </div>
              <p className="mt-1 text-[13px] text-neutral-400">{t("foot.tgDesc")}</p>
            </a>
          </div>
        </div>

        <div className="mt-10 border-t border-white/5 pt-6 text-center text-xs text-neutral-500 space-y-2">
          <p>© Copernicus Service Information · Contains modified Copernicus Climate Change Service information · NASA Public Domain · ESA Sentinel-2 Open Access</p>
          <p>
            © {new Date().getFullYear()} Jaiyq · {t("foot.rights")} ·{" "}
            <Link href="/legislation" className="hover:text-neutral-400 underline underline-offset-2">Заңнама</Link>{" "}·{" "}
            <Link href="/methodology" className="hover:text-neutral-400 underline underline-offset-2">Әдістеме және валидация</Link>{" "}·{" "}
            <Link href="/privacy" className="hover:text-neutral-400 underline underline-offset-2">Құпиялық саясаты</Link>{" "}·{" "}
            <Link href="/terms" className="hover:text-neutral-400 underline underline-offset-2">Пайдалану шарттары</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
