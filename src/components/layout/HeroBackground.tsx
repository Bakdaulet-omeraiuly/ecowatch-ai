"use client";

import { useRegion } from "@/store/useRegionStore";

// Басты беттің фоны.
//
// Жүйе енді тек Атырауға арналмағандықтан, фон таңдалған аймаққа қарай
// өзгереді. Сурет табылмаса — градиент қалады (сынбайды).
//
// ⚠️ Фон — көркемдік элемент, ол дерек емес. Сондықтан онда ешқандай
// көрсеткіш немесе «нақты көрініс» деген мәтін болмайды.

const BG_BY_REGION: Record<string, string> = {
  atyrau: "/atyrau-hero.jpg",
};

const DEFAULT_BG = "/atyrau-hero.jpg";

export function HeroBackground() {
  const region = useRegion();
  const src = BG_BY_REGION[region.id] ?? DEFAULT_BG;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
      {/* Негізгі фон суреті */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-105 object-cover object-center opacity-90"
      />

      {/* Түс қабаты — бренд реңкін беру үшін */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/40 via-transparent to-sky-950/40" />

      {/* Мәтін оқылуы үшін қою градиент */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/55 via-neutral-950/65 to-neutral-950" />

      {/* Жеңіл жарық — жоғарғы ортадан */}
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(16,185,129,0.10),transparent_70%)]" />
    </div>
  );
}
