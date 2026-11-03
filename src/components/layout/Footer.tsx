"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { FULL_VIEWPORT_ROUTES } from "@/components/layout/AppFrame";

const TELEGRAM_BOT = "https://t.me/jaiyq_atyrau_bot";

// Бүкіл сайттың футері: деректер көздері, әдістеме, байланыс.
export function Footer() {
  const pathname = usePathname();
  const { t } = useLang();
  // Карта беті: футер жасырылады, карта экранның қалған толық биіктігін алады
  if (FULL_VIEWPORT_ROUTES.has(pathname)) return null;

  const sections = [
    {
      title: t("foot.data"),
      items: [
        { href: "https://open-meteo.com", label: "Open-Meteo · Copernicus CAMS", ext: true },
        { href: "https://openaq.org", label: "OpenAQ", ext: true },
        { href: "https://dataspace.copernicus.eu", label: "Copernicus Data Space", ext: true },
      ],
    },
    {
      title: t("foot.methodology"),
      items: [
        { href: "/methodology", label: t("nav.methodology"), ext: false },
        { href: "/eco-passport", label: t("nav.passport"), ext: false },
        { href: "/legislation", label: t("foot.legislation"), ext: false },
        { href: "/caspian", label: t("foot.caspian"), ext: false },
        { href: "/privacy", label: t("foot.privacy"), ext: false },
        { href: "/terms", label: t("foot.terms"), ext: false },
      ],
    },
    {
      title: t("foot.contacts"),
      items: [{ href: TELEGRAM_BOT, label: "Telegram", ext: true }],
    },
  ];

  return (
    <footer className="mt-auto border-t border-neutral-300 bg-neutral-100 text-neutral-900">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        {sections.map((s) => (
          <nav key={s.title} aria-label={s.title}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[#0b3a6b]">{s.title}</h2>
            <ul className="space-y-1">
              {s.items.map((i) => (
                <li key={i.href}>
                  {i.ext ? (
                    <a
                      href={i.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center text-neutral-900 underline underline-offset-2 hover:text-[#0b3a6b]"
                    >
                      {i.label}
                      <span className="sr-only"> ({t("foot.newTab")})</span>
                    </a>
                  ) : (
                    <Link
                      href={i.href}
                      className="inline-flex min-h-[44px] items-center text-neutral-900 underline underline-offset-2 hover:text-[#0b3a6b]"
                    >
                      {i.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-neutral-300">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-neutral-800">{t("foot.disclaimer")}</p>
      </div>
    </footer>
  );
}
