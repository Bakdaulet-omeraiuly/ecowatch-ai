"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search, X, MapPin, Loader2, Factory, Building2, Waves, Crosshair, Globe,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { KIND_KZ, searchPlaces, type Place, type PlaceKind } from "@/data/places";

// КАРТА ІЗДЕУІ — екі көзден:
//
//   1. ЖОБАНЫҢ ӨЗ ТІЗІЛІМІ (жоғарыда тұрады) — өнеркәсіп нысандары,
//      аудандар, су нысандары. Координаталары тексерілген, объект картасы
//      бар нысандар бірден белгіленеді.
//   2. Mapbox Geocoding — кез келген басқа орын үшін.
//
// Координатаны тікелей енгізуге болады: «47.11, 51.88».
//
// Неге тізілім бірінші: «АМӨЗ» деп іздегенде геокодер оны таппайды немесе
// басқа жерді ұсынады. Ал бізге дәл сол зауыттың тексерілген координатасы
// керек — прокуратура құжаты соған сүйенеді.

interface GeoFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface Props {
  /** Картаны жылжыту */
  onSelect: (lng: number, lat: number, label: string, zoom?: number) => void;
  /** Тізілімдегі нысан таңдалса — объект картасына өту үшін */
  onPickPlace?: (p: Place) => void;
}

const ICONS: Record<PlaceKind, React.ElementType> = {
  facility: Factory,
  city: Building2,
  district: MapPin,
  water: Waves,
  coords: Crosshair,
};

export function MapSearch({ onSelect, onPickPlace }: Props) {
  const { tr } = useLang();
  // Телефонда іздеу картаны жаппауы үшін әдепкіде тек ИКОНКА болады.
  // Басқанда ғана ашылады. Үлкен экранда әрқашан ашық тұрады.
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [geo, setGeo] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  // 1. Жергілікті тізілім — бірден, кідіріссіз
  const local = useMemo(() => searchPlaces(query, 6), [query]);

  // 2. Геокодер — кідіріспен
  const runGeo = useCallback(
    async (q: string) => {
      if (!token || q.trim().length < 2) { setGeo([]); return; }
      setLoading(true);
      try {
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json` +
          `?access_token=${token}&language=kk,ru,en&limit=4&proximity=51.8833,47.1167`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setGeo((data.features ?? []) as GeoFeature[]);
      } catch {
        setGeo([]); // геокодер қолжетімсіз — жергілікті нәтижелер қала береді
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => runGeo(query), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, runGeo]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const total = local.length + geo.length;

  const pickLocal = (p: Place) => {
    onSelect(p.lng, p.lat, p.name, p.zoom);
    onPickPlace?.(p);
    setQuery(p.name);
    setOpen(false);
  };
  const pickGeo = (f: GeoFeature) => {
    onSelect(f.center[0], f.center[1], f.place_name, 14);
    setQuery(f.place_name.split(",")[0]);
    setOpen(false);
  };
  const pickIndex = (i: number) => {
    if (i < local.length) pickLocal(local[i]);
    else pickGeo(geo[i - local.length]);
  };

  // Жиналған күй — тек дөңгелек иконка
  if (!expanded) {
    return (
      <button
        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        title={tr("Іздеу")}
        aria-label={tr("Іздеу")}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-neutral-900/95 text-neutral-300 shadow-xl backdrop-blur transition hover:bg-neutral-800 hover:text-white"
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="w-[min(88vw,26rem)]">
      <div className="relative">
        {loading ? (
          <Loader2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-neutral-400" />
        ) : (
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        )}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setExpanded(false); return; }
            if (!open || !total) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => (i + 1) % total); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => (i - 1 + total) % total); }
            else if (e.key === "Enter") { e.preventDefault(); pickIndex(active); }
          }}
          placeholder={tr("Кез келген жерді, кәсіпорынды немесе координатаны іздеу…")}
          className="w-full rounded-xl border border-white/15 bg-neutral-900/95 py-2.5 pl-10 pr-9 text-sm text-white shadow-xl outline-none backdrop-blur transition placeholder:text-neutral-500 focus:border-emerald-400/50"
          aria-label={tr("Іздеу")}
        />
        <button
          onClick={() => { setQuery(""); setGeo([]); setOpen(false); setExpanded(false); }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 transition hover:bg-white/10 hover:text-white"
          aria-label={tr("Жабу")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute bottom-full left-0 mb-1.5 max-h-[55vh] w-full overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/97 shadow-2xl backdrop-blur sm:relative sm:bottom-auto sm:mb-0 sm:mt-1.5">
          {total === 0 && !loading ? (
            <div className="px-3 py-3 text-[12px] leading-relaxed text-neutral-400">
              {tr("Табылмады.")}{" "}
              {tr("Координатаны тікелей енгізіп көріңіз, мысалы: 47.11, 51.88")}
            </div>
          ) : (
            <>
              {local.length > 0 && (
                <>
                  <div className="px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                    {tr("Жүйе тізілімінен")}
                  </div>
                  <ul>
                    {local.map((p, i) => {
                      const Icon = ICONS[p.kind];
                      return (
                        <li key={p.id}>
                          <button
                            onMouseEnter={() => setActive(i)}
                            onClick={() => pickLocal(p)}
                            className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                              i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <Icon className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[12px] text-neutral-100">{p.name}</span>
                              <span className="block truncate text-[10px] text-neutral-500">
                                {KIND_KZ[p.kind]}
                                {p.hint && ` · ${p.hint}`}
                                {p.approx && ` · ${tr("координата жуық")}`}
                              </span>
                            </span>
                            {p.objectId && (
                              <span className="shrink-0 rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] text-sky-200">
                                {tr("объект картасы")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {geo.length > 0 && (
                <>
                  <div className="border-t border-white/5 px-3 pb-1 pt-2 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
                    {tr("Mapbox геокодері")}
                  </div>
                  <ul>
                    {geo.map((f, gi) => {
                      const i = local.length + gi;
                      return (
                        <li key={f.id}>
                          <button
                            onMouseEnter={() => setActive(i)}
                            onClick={() => pickGeo(f)}
                            className={`flex w-full items-start gap-2.5 px-3 py-2 text-left transition ${
                              i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                            }`}
                          >
                            <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" />
                            <span className="text-[12px] leading-snug text-neutral-300">
                              {f.place_name}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
