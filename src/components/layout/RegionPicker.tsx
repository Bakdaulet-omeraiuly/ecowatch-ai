"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, ChevronDown, Check, Waves } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useRegionStore } from "@/store/useRegionStore";
import { COUNTRY_FLAG, REGIONS, getRegion } from "@/data/regions";

// АЙМАҚ ТАҢДАҒЫШ — навигация жолағында.
//
// Аймақтар екі топқа бөлінген:
//   · Қазақстан — толық немесе ішінара қолдау
//   · Каспий жағалауы (басқа елдер) — тек ауа сапасы, ҚР нормативтері
//     ҚОЛДАНЫЛМАЙДЫ (әр елдің өз нормасы бар, бізде олар жоқ)
//
// Қолдау деңгейі әр жолда ашық жазылады — пайдаланушы қандай дерек бар
// екенін алдын ала біледі.

export function RegionPicker({ compact }: { compact?: boolean }) {
  const { tr } = useLang();
  const regionId = useRegionStore((s) => s.regionId);
  const setRegion = useRegionStore((s) => s.setRegion);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = getRegion(regionId);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const kz = REGIONS.filter((r) => r.country === "KZ");
  const caspian = REGIONS.filter((r) => r.country !== "KZ");

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 text-neutral-200 transition hover:bg-white/10 ${
          compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-xs"
        }`}
        aria-label={tr("Аймақты таңдау")}
      >
        <MapPin className="h-3.5 w-3.5 text-emerald-400" />
        <span className="max-w-[6rem] truncate sm:max-w-[9rem]">{current.name}</span>
        {current.country !== "KZ" && <span>{COUNTRY_FLAG[current.country]}</span>}
        <ChevronDown className={`h-3 w-3 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-1.5 max-h-[70vh] w-[min(15rem,86vw)] overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/98 shadow-2xl backdrop-blur sm:w-[17rem]">
          <Group title={tr("Қазақстан")}>
            {kz.map((r) => (
              <Row
                key={r.id} region={r} active={r.id === regionId} tr={tr}
                onPick={() => { setRegion(r.id); setOpen(false); }}
              />
            ))}
          </Group>

          <Group
            title={tr("Каспий жағалауы — басқа елдер")}
            icon={Waves}
            note={tr("ҚР нормативтері қолданылмайды — тек WHO эталоны")}
          >
            {caspian.map((r) => (
              <Row
                key={r.id} region={r} active={r.id === regionId} tr={tr}
                onPick={() => { setRegion(r.id); setOpen(false); }}
              />
            ))}
          </Group>

          <a
            href="/caspian"
            className="block border-t border-white/10 px-3 py-2 text-[11px] text-sky-300 transition hover:bg-white/5"
          >
            🌊 {tr("Каспий бойынша салыстыру бетін ашу")} →
          </a>
        </div>
      )}
    </div>
  );
}

function Group({
  title, note, icon: Icon, children,
}: { title: string; note?: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="border-b border-white/5 last:border-0">
      <div className="px-3 pb-1 pt-2">
        <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
          {Icon && <Icon className="h-2.5 w-2.5" />}
          {title}
        </div>
        {note && <div className="mt-0.5 text-[9px] leading-tight text-amber-200/60">{note}</div>}
      </div>
      {children}
    </div>
  );
}

function Row({
  region, active, onPick, tr,
}: {
  region: (typeof REGIONS)[number];
  active: boolean;
  onPick: () => void;
  tr: (s: string) => string;
}) {
  return (
    <button
      onClick={onPick}
      className={`flex w-full items-start gap-2 px-3 py-1.5 text-left transition ${
        active ? "bg-emerald-500/10" : "hover:bg-white/[0.04]"
      }`}
    >
      <span className="mt-0.5 w-4 shrink-0 text-center text-[11px]">
        {active ? <Check className="h-3 w-3 text-emerald-400" /> : COUNTRY_FLAG[region.country]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-neutral-100">{region.name}</span>
          {region.coverage === "full" ? (
            <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1 py-px text-[8px] text-emerald-200">
              {tr("толық")}
            </span>
          ) : (
            <span className="rounded border border-white/15 bg-white/5 px-1 py-px text-[8px] text-neutral-400">
              {tr("ауа сапасы")}
            </span>
          )}
        </span>
        <span className="mt-0.5 hidden truncate text-[10px] text-neutral-500 sm:block">{region.pressure}</span>
      </span>
    </button>
  );
}
