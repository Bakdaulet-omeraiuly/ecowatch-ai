"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { JaiyqLogo } from "@/components/layout/JaiyqLogo";
import { useLang } from "@/lib/i18n";
import { RegionPicker } from "@/components/layout/RegionPicker";

export function Navbar() {
  const pathname = usePathname();
  const { lang, setLang, t } = useLang();

  // Ұстап сүйреп жылжыту (ролик сияқты) — тінтуір де, саусақ та
  const navRef = useRef<HTMLElement>(null);
  const drag = useRef({ down: false, startX: 0, scroll: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    const el = navRef.current;
    if (!el) return;
    // Тек тінтуірмен сүйреу (саусақ — браузердің өз скроллы; pointer capture жоқ,
    // әйтпесе сілтеме басылмайды)
    if (e.pointerType !== "mouse") return;
    drag.current = { down: true, startX: e.clientX, scroll: el.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const el = navRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.scroll - dx;
  };
  const endDrag = () => { drag.current.down = false; };

  const links = [
    { href: "/map", label: t("nav.map") },
    { href: "/dashboard", label: t("nav.dashboard") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/report", label: t("nav.report") },
    { href: "/moderation", label: t("nav.moderation") },
    { href: "/caspian", label: "Каспий" },
    { href: "/legislation", label: "Заңнама" },
    { href: "/eco-passport", label: t("nav.passport") },
    { href: "/alerts", label: t("nav.alerts") },
  ];
  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-neutral-950/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-1.5 px-2 sm:gap-2 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-white">
          <JaiyqLogo className="h-6 w-6 text-emerald-400" />
          <span className="text-base sm:text-lg">Jaiyq</span>
          <span className="ml-2 hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-normal text-emerald-300 lg:inline">
            {t("nav.tagline")}
          </span>
        </Link>

        {/* Сілтемелер — ұстап сүйреп жылжытуға болады (ролик сияқты) */}
        <nav
          ref={navRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          // Сырғымалы жолақ: соңында ЖҰМСАҚ СӨНУ бар (mask-image).
          // Бұрын скроллбар жасырылған да, сөну де жоқ еді — сондықтан
          // сілтеме экран шетінде кенет кесіліп, «бет бұзылған» деген
          // әсер туатын. Енді ол «әрі қарай да бар» деп өзі көрсетеді.
          className="flex min-w-0 flex-1 cursor-grab items-center gap-1 overflow-x-auto select-none active:cursor-grabbing [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)]"
        >
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              draggable={false}
              onClick={(e) => { if (drag.current.moved) e.preventDefault(); }}
              // Белсенді бет ТОЛТЫРЫЛҒАН таблеткамен емес, астыңғы
              // сызықпен белгіленеді. Себебі навигация — безендіру емес,
              // бағдар: жасыл таблетка экранның ең жоғарысында тұрып,
              // назарды мәліметтен өзіне тартатын.
              className={cn(
                "shrink-0 whitespace-nowrap px-3 py-1.5 text-sm transition-colors",
                pathname === l.href
                  ? "text-neutral-50 shadow-[inset_0_-2px_0_var(--color-neutral-50)]"
                  : "text-neutral-400 hover:text-neutral-100"
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Аймақ таңдағыш — жүйе енді тек Атырауға арналмаған */}
        <div className="shrink-0">
          <RegionPicker compact />
        </div>

        {/* Тіл ауыстырғыш KZ / RU / EN — әрқашан оң жақта */}
        <div className="flex shrink-0 items-center overflow-hidden rounded-md border border-white/10">
          {(["kk", "ru", "en"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "px-1.5 py-1 text-[12px] font-medium uppercase transition-colors sm:px-2 sm:text-xs",
                lang === l
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-neutral-400 hover:bg-white/5 hover:text-white"
              )}
            >
              {l === "kk" ? "KZ" : l === "ru" ? "RU" : "EN"}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
