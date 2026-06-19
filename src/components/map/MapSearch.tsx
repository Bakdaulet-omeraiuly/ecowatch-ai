"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Search, X, MapPin, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

interface Feature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
}

interface Props {
  onSelect: (lng: number, lat: number, label: string) => void;
}

export function MapSearch({ onSelect }: Props) {
  const { tr } = useLang();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&language=kk,ru,en&limit=5&proximity=51.8833,47.1167`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.features ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(query), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [query, search]);

  const pick = (f: Feature) => {
    const [lng, lat] = f.center;
    onSelect(lng, lat, f.place_name);
    setQuery(f.place_name.split(",")[0]);
    setOpen(false);
    setExpanded(false);
  };

  const clear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!expanded) {
    return (
      <button
        onClick={() => { setExpanded(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-neutral-900/95 text-neutral-300 shadow-xl backdrop-blur transition-colors hover:bg-neutral-800 hover:text-white"
        title={tr("Іздеу")}
      >
        <Search className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex h-10 items-center gap-2 rounded-full border border-white/15 bg-neutral-900/95 px-3 shadow-xl backdrop-blur">
        {loading ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-neutral-400" /> : <Search className="h-4 w-4 shrink-0 text-neutral-400" />}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Орын іздеу…")}
          className="w-48 bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
          onKeyDown={(e) => { if (e.key === "Escape") { setExpanded(false); setOpen(false); } }}
        />
        {query ? (
          <button onClick={clear} className="shrink-0 text-neutral-500 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button onClick={() => setExpanded(false)} className="shrink-0 text-neutral-500 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-0 top-12 z-50 w-72 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/98 shadow-2xl backdrop-blur">
          {results.map((f) => (
            <button
              key={f.id}
              onClick={() => pick(f)}
              className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/8"
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              <span className="text-sm leading-snug text-neutral-200">{f.place_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
