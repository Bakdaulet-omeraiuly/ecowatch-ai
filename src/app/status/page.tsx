"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";
import { useLang } from "@/lib/i18n";

// ДЕРЕККӨЗДЕР КҮЙІ — әр көз қазір жауап бере ме және деректің уақыты қандай.
// Тек жеңіл сұраныстар (кэштелген API мен статикалық көшірмелер); Sentinel Hub
// сияқты квоталы қызметтер мұнда шақырылмайды — олардың соңғы есебінің күні көшірмеден алынады.

type Check = {
  key: string;
  name: string;
  powers: string;
  url: string;
  /** жауаптан деректің уақытын алу */
  time: (j: Record<string, unknown>) => string | null;
  /** жауап «жұмыс істейді» ме */
  ok?: (j: Record<string, unknown>) => boolean;
  /** уақыты осыдан ескі болса — ескерту (сағат) */
  staleH: number;
};

const get = (o: unknown, path: string): unknown => path.split(".").reduce<unknown>((a, k) => (a && typeof a === "object" ? (a as Record<string, unknown>)[k] : undefined), o);
const str = (v: unknown) => (typeof v === "string" ? v : null);

const CHECKS: Check[] = [
  { key: "cams", name: "Copernicus CAMS · Open-Meteo", powers: "Ауа сапасы (модель), басты бет, аналитика", url: "/api/atyrau-air", time: (j) => str(get(j, "cams.time")), ok: (j) => get(j, "cams.ok") === true, staleH: 3 },
  { key: "openaq", name: "OpenAQ (жерүсті стансалар)", powers: "Жерүсті өлшемдер", url: "/api/atyrau-air", time: (j) => str(j.fetchedAt), ok: (j) => get(j, "ground.state") !== "unavailable", staleH: 3 },
  { key: "wind", name: "Open-Meteo жел торы", powers: "Таралу анимациясы, жел қабаты, кері траектория", url: "/api/windgrid?region=atyrau", time: (j) => str(j.fetchedAt), staleH: 3 },
  { key: "firms", name: "NASA FIRMS (VIIRS)", powers: "Жылу аномалиялары, растау, аймаққа жазылу", url: "/api/flares?region=atyrau", time: (j) => str(j.fetchedAt), staleH: 6 },
  { key: "fixate", name: "Норма асуын фиксациялау (Supabase)", powers: "Асу журналы", url: "/api/exceedances?region=atyrau", time: () => null, ok: (j) => j.available !== false, staleH: 9999 },
  { key: "reviews", name: "Растау кестесі (Supabase)", powers: "Детекцияны растау", url: "/api/detection-reviews?layer=fire", time: () => null, ok: (j) => Array.isArray(j.verdicts), staleH: 9999 },
  { key: "landuse", name: "OSM жер пайдалану (көшірме)", powers: "Жер пайдалану қабаты, аймақ есебі", url: "/data/layers/landuse-atyrau.json", time: (j) => str(j.fetchedAt), staleH: 24 * 10 },
  { key: "greenery", name: "OSM жасыл аймақтар (көшірме)", powers: "Көгалдандыру қабаты", url: "/data/layers/greenery-atyrau.json", time: (j) => str(j.fetchedAt), staleH: 24 * 10 },
  { key: "ndvi", name: "Sentinel-2 NDVI өзгерісі (көшірме)", powers: "Көгалдандыру өзгерісі", url: "/data/layers/green-change-atyrau.json", time: (j) => str(j.fetchedAt), staleH: 24 * 10 },
  { key: "priority", name: "Басымдық торы (Sentinel-2 + OSM)", powers: "Көгалдандыру басымдығы", url: "/data/layers/priority-grid-atyrau.json", time: (j) => str(j.fetchedAt), staleH: 24 * 10 },
  { key: "worldpop", name: "WorldPop 2020 халық торы", powers: "Басымдықтағы халық критерийі", url: "/data/layers/population-grid-atyrau.json", time: (j) => str(j.fetchedAt), staleH: 24 * 400 },
];

type Result = { state: "loading" } | { state: "ok" | "stale" | "down"; ms: number; time: string | null; reason?: string };

export default function StatusPage() {
  const { tr, lang } = useLang();
  const [res, setRes] = useState<Record<string, Result>>(() => Object.fromEntries(CHECKS.map((c) => [c.key, { state: "loading" } as Result])));
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const cache = new Map<string, Promise<{ ok: boolean; j: Record<string, unknown>; ms: number; status: number }>>();
    const load = (url: string) => {
      if (!cache.has(url)) {
        const t0 = performance.now();
        cache.set(url, fetch(url, { signal: AbortSignal.timeout(30_000) })
          .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})), ms: Math.round(performance.now() - t0) }))
          .catch(() => ({ ok: false, status: 0, j: {}, ms: Math.round(performance.now() - t0) })));
      }
      return cache.get(url)!;
    };
    CHECKS.forEach((c) => {
      load(c.url).then(({ ok, j, ms, status }) => {
        if (!alive) return;
        const good = ok && !j.error && (c.ok ? c.ok(j) : true);
        const time = good ? c.time(j) : null;
        const age = time ? (Date.now() - Date.parse(time.length === 16 ? `${time}:00+05:00` : time)) / 3600_000 : null;
        const state = !good ? "down" : age != null && age > c.staleH ? "stale" : "ok";
        setRes((r) => ({ ...r, [c.key]: { state, ms, time, reason: good ? undefined : String(j.error ?? (ok ? "дереккөз дерек бермеді" : status ? `HTTP ${status}` : "желі қатесі")) } }));
      });
    });
    setCheckedAt(new Date().toISOString()); // eslint-disable-line react-hooks/set-state-in-effect
    return () => { alive = false; };
  }, []);

  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "kk-KZ";
  const fmt = (t: string | null) => {
    if (!t) return "—";
    const d = new Date(t.length === 16 ? `${t}:00+05:00` : t);
    return Number.isNaN(d.getTime()) ? t : d.toLocaleString(locale, { timeZone: "Asia/Atyrau", dateStyle: "short", timeStyle: "short" });
  };
  const counts = Object.values(res).reduce((a, r) => ({ ...a, [r.state]: (a[r.state] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <h1 className="text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{tr("Дереккөздер күйі")}</h1>
      <p className="mt-2 max-w-3xl text-sm text-neutral-700">
        {tr("Әр дереккөз қазір жауап бере ме және деректің соңғы уақыты қандай. Көз істемесе, сайт жалған дерек көрсетпейді — тиісті бөлімде «дерек жоқ» жазылады.")}
      </p>
      <p className="mt-2 text-sm text-neutral-700">
        {tr("Жұмыс істейді")}: <b>{counts.ok ?? 0}</b> · {tr("Ескірген")}: <b>{counts.stale ?? 0}</b> · {tr("Қолжетімсіз")}: <b>{counts.down ?? 0}</b>
        {checkedAt && <> · {tr("Тексерілді")}: {fmt(checkedAt)}</>}
      </p>
      <div className="mt-5 overflow-x-auto rounded-lg border border-neutral-300 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
            <tr>
              <th className="px-3 py-2 font-semibold">{tr("Дереккөз")}</th>
              <th className="px-3 py-2 font-semibold">{tr("Күйі")}</th>
              <th className="px-3 py-2 font-semibold">{tr("Деректің уақыты (Атырау)")}</th>
              <th className="px-3 py-2 font-semibold">{tr("Не қолданады")}</th>
            </tr>
          </thead>
          <tbody>
            {CHECKS.map((c) => {
              const r = res[c.key];
              return (
                <tr key={c.key} className="border-t border-neutral-200 align-top">
                  <td className="px-3 py-2 font-medium text-neutral-900">{tr(c.name)}</td>
                  <td className="px-3 py-2">
                    {r.state === "loading" ? <span className="inline-flex items-center gap-1 text-neutral-600"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />{tr("тексерілуде")}</span>
                      : r.state === "ok" ? <span className="inline-flex items-center gap-1 text-emerald-800"><CheckCircle2 className="h-4 w-4" aria-hidden />{tr("жұмыс істейді")} <span className="text-xs text-neutral-600">({r.ms} мс)</span></span>
                      : r.state === "stale" ? <span className="inline-flex items-center gap-1 text-amber-800"><CircleAlert className="h-4 w-4" aria-hidden />{tr("ескірген")}</span>
                      : <span className="inline-flex items-center gap-1 text-red-800"><CircleAlert className="h-4 w-4" aria-hidden />{tr("қолжетімсіз")}<span className="block text-xs text-neutral-600">{tr(r.reason ?? "")}</span></span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-neutral-800">{r.state === "loading" ? "…" : fmt(r.time)}</td>
                  <td className="px-3 py-2 text-neutral-700">{tr(c.powers)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-600">
        {tr("Sentinel-2 / Sentinel-5P (Copernicus) есептері сұраныс кезінде жүреді, мұнда квотаны үнемдеу үшін тікелей шақырылмайды.")}{" "}
        <Link href="/methodology" className="text-[#0b3a6b] underline underline-offset-2">{tr("Әдістеме")}</Link>
      </p>
    </div>
  );
}
