"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n";
import { AtyrauMap } from "@/components/home/AtyrauMap";
import { AtyrauAirPanel } from "@/components/home/AtyrauAirPanel";

// Басты бет — Атырау (SPEC-2026-11-ATYRAU, 1-кезең).
// Мемлекеттік портал стилі: тақырып, қысқа түсіндірме, карта + 7 көрсеткіш
// панелі, бөлімдер тізімі. Анимация, маркетинг мәтіні, эмодзи жоқ.
// Барлық мән /api/atyrau-air арқылы нақты дереккөзден (AtyrauAirPanel).
export default function HomePage() {
  const { t } = useLang();

  const sections = [
    { href: "/map", title: t("nav.map"), desc: t("home.sec.map.d") },
    { href: "/dashboard", title: t("nav.dashboard"), desc: t("home.sec.dashboard.d") },
    { href: "/report", title: t("nav.report"), desc: t("home.sec.report.d") },
    { href: "/alerts", title: t("nav.alerts"), desc: t("home.sec.alerts.d") },
    { href: "/methodology", title: t("nav.methodology"), desc: t("home.sec.methodology.d") },
    { href: "/legislation", title: t("nav.legislation"), desc: t("home.sec.legislation.d") },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-neutral-900 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold leading-tight text-[#0b3a6b] sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-3 text-base text-neutral-700 sm:text-lg">{t("home.intro")}</p>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section aria-labelledby="map-title" className="lg:sticky lg:top-32 lg:self-start">
          <h2 id="map-title" className="mb-3 text-xl font-bold text-neutral-900">
            {t("home.mapTitle")}
          </h2>
          <AtyrauMap />
          <Link
            href="/map"
            className="mt-3 inline-flex min-h-[44px] items-center rounded border border-[#0b3a6b] px-4 font-bold text-[#0b3a6b] hover:bg-[#0b3a6b] hover:text-white"
          >
            {t("home.mapOpen")}
          </Link>
        </section>

        <section aria-labelledby="air-title">
          <h2 id="air-title" className="mb-3 text-xl font-bold text-neutral-900">
            {t("home.airTitle")}
          </h2>
          <AtyrauAirPanel />
        </section>
      </div>

      <section aria-labelledby="modules-title" className="mt-12 border-t border-neutral-300 pt-8">
        <h2 id="modules-title" className="text-xl font-bold text-neutral-900">
          {t("home.modules")}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="group flex h-full min-h-[44px] flex-col rounded-md border border-neutral-300 bg-white p-4 hover:border-[#0b3a6b] hover:bg-neutral-50"
              >
                <span className="font-bold text-[#0b3a6b] underline-offset-2 group-hover:underline">{s.title}</span>
                <span className="mt-1 text-sm text-neutral-700">{s.desc}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
