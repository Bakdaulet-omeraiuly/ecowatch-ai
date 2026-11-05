"use client";

import Link from "next/link";
import { ArrowRight, BarChart3, ClipboardList, FileWarning, FlaskConical, Grid3x3, HeartPulse, Map as MapIcon, MessageSquareWarning, ShieldCheck, Wind } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { AtyrauMap } from "@/components/home/AtyrauMap";
import { AtyrauAirPanel } from "@/components/home/AtyrauAirPanel";

// Басты бет — Атырау. Мемлекеттік портал стилі: алдымен «қазір қалай?» деген
// сұраққа жауап (AtyrauAirPanel), сосын әр пайдаланушыға (тұрғын / қызметкер /
// ғалым) арналған жылдам жолдар. Анимация, маркетинг мәтіні жоқ.
// Барлық мән /api/atyrau-air арқылы нақты дереккөзден.
export default function HomePage() {
  const { t, tr } = useLang();

  const roles: { title: string; desc: string; links: { href: string; label: string; icon: typeof MapIcon }[] }[] = [
    {
      title: "Тұрғынға", desc: "Ауа сапасы, ескертулер және шағым жіберу.",
      links: [
        { href: "/complaints/new", label: "Шағым жіберу (иіс, түтін, шаң)", icon: MessageSquareWarning },
        { href: "/dashboard", label: "Ауа сапасы мен болжам", icon: BarChart3 },
        { href: "/alerts", label: t("nav.alerts"), icon: FileWarning },
        { href: "/health", label: t("nav.health"), icon: HeartPulse },
      ],
    },
    {
      title: "Мемлекеттік қызметкерге", desc: "Далалық жұмысты тіркеу, спутник детекцияларын растау, шағымдарды қарау.",
      links: [
        { href: "/map?tool=journal", label: "Далалық журнал", icon: ClipboardList },
        { href: "/map?tool=review", label: "Детекцияны растау", icon: ShieldCheck },
        { href: "/map?tool=priority", label: "Көгалдандыру басымдығы", icon: Grid3x3 },
        { href: "/map?tool=complaints", label: "Шағымдар картада", icon: MessageSquareWarning },
        { href: "/complaints/review", label: "Шағымдарды қарау", icon: MessageSquareWarning },
      ],
    },
    {
      title: "Ғалымға", desc: "Аймақ бойынша спутник статистикасы, кері траектория, CSV және валидация.",
      links: [
        { href: "/map?tool=area", label: "Аймақ есебі (NDVI, NO₂, өрт)", icon: BarChart3 },
        { href: "/map?tool=trajectory", label: "Ауа қайдан келді", icon: Wind },
        { href: "/validation", label: "Спутник валидациясы", icon: FlaskConical },
        { href: "/methodology", label: t("nav.methodology"), icon: FileWarning },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 text-neutral-900 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-4xl">{t("home.title")}</h1>
        <p className="mt-2 text-sm text-neutral-700 sm:mt-3 sm:text-lg">{t("home.intro")}</p>
      </header>

      <div className="mt-6 grid gap-6 lg:mt-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-8">
        <section aria-labelledby="air-title">
          <h2 id="air-title" className="mb-3 text-lg font-bold text-neutral-900 sm:text-xl">{t("home.airTitle")}</h2>
          <AtyrauAirPanel />
        </section>

        <section aria-labelledby="map-title" className="lg:sticky lg:top-32 lg:self-start">
          <h2 id="map-title" className="mb-3 text-lg font-bold text-neutral-900 sm:text-xl">{t("home.mapTitle")}</h2>
          <AtyrauMap />
          <Link href="/map" className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded border border-[#0b3a6b] px-4 font-bold text-[#0b3a6b] hover:bg-[#0b3a6b] hover:text-white">
            <MapIcon className="h-4 w-4" aria-hidden />{t("home.mapOpen")}
          </Link>
        </section>
      </div>

      <section aria-labelledby="roles-title" className="mt-10 border-t border-neutral-300 pt-8">
        <h2 id="roles-title" className="text-lg font-bold text-neutral-900 sm:text-xl">{tr("Сізге не керек?")}</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-3">
          {roles.map((r) => (
            <li key={r.title} className="flex flex-col rounded-lg border border-neutral-300 bg-white p-4">
              <h3 className="font-bold text-[#0b3a6b]">{tr(r.title)}</h3>
              <p className="mt-1 text-sm text-neutral-700">{tr(r.desc)}</p>
              <ul className="mt-3 space-y-1">
                {r.links.map((l) => {
                  const Icon = l.icon;
                  return (
                    <li key={l.href}>
                      <Link href={l.href} className="group flex min-h-[44px] items-center gap-2 rounded px-2 text-sm font-medium text-neutral-900 hover:bg-neutral-50 hover:text-[#0b3a6b]">
                        <Icon className="h-4 w-4 shrink-0 text-[#0b3a6b]" aria-hidden />
                        <span className="flex-1">{tr(l.label)}</span>
                        <ArrowRight className="h-4 w-4 text-neutral-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-neutral-600">{tr("Журнал мен растау құралдарына рөл керек — рөлді сайт иесі береді.")}</p>
      </section>
    </div>
  );
}
