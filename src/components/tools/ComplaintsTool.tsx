"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Wind } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import type { ComplaintGroup } from "@/lib/complaints";

// Тұрғындар шағымдары картада: жария, координаты ~100 м-ге дөңгелектелген, 2 сағ / 500 м ішіндегі
// қайталанғандар бір топ. Шағым — өлшем емес. Иіс/түтін/шаң → «ауа қайдан келді» траекториясы.
const CAT_COLOR: Record<string, string> = { smell: "#7c3aed", smoke: "#374151", dust: "#b45309", fire: "#dc2626", water: "#0369a1", soil: "#65a30d" };
const AIRBORNE = new Set(["smell", "smoke", "dust"]);

export function ComplaintsTool() {
  const { t, tr, lang } = useLang();
  const { setOverlay, focusOn } = useMapToolsStore();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ groups: ComplaintGroup[] } | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/complaints").then(async (r) => ({ ok: r.ok, j: await r.json() })).then(({ ok, j }) => {
      if (!alive) return;
      setData(ok && Array.isArray(j.groups) ? { groups: j.groups } : { error: j.error ?? "Шағымдар дерекқоры қолжетімсіз — дерек жоқ" });
    }).catch(() => alive && setData({ error: "Шағымдар дерекқоры қолжетімсіз — дерек жоқ" }));
    return () => { alive = false; };
  }, []);

  const shown = useMemo(() => {
    if (!data || "error" in data) return [];
    const from = Date.now() - days * 86400_000; // eslint-disable-line react-hooks/purity
    return data.groups.filter((g) => Date.parse(g.lastAt) >= from).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
  }, [data, days]);

  useEffect(() => {
    setOverlay({
      type: "FeatureCollection",
      features: shown.map((g) => ({
        type: "Feature", properties: { kind: "point", color: CAT_COLOR[g.category] ?? "#0b3a6b", label: `${t(`complaints.category.${g.category}` as never)} × ${g.count}` },
        geometry: { type: "Point", coordinates: [g.lng, g.lat] },
      })),
    });
  }, [shown, setOverlay, t]);

  const locale = lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "kk-KZ";
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { timeZone: "Asia/Atyrau", dateStyle: "short", timeStyle: "short" });
  const byCat = shown.reduce<Record<string, number>>((a, g) => ({ ...a, [g.category]: (a[g.category] ?? 0) + g.count }), {});

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Тұрғындар шағымдары: координаты ~100 м-ге дөңгелектелген, бір жердегі 2 сағат ішіндегі қайталанған шағымдар бір топ. Шағым — өлшем емес, бірақ тексеруге белгі.")}</p>
      <label className="flex items-center gap-1.5 text-sm text-neutral-700">{tr("Кезең")}:
        <select value={days} onChange={(e) => setDays(+e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
          {[7, 30, 90, 365].map((d) => <option key={d} value={d}>{d} {tr("күн")}</option>)}
        </select>
      </label>
      {!data && <p className="text-sm text-neutral-600"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}</p>}
      {data && "error" in data && <p role="alert" className="text-sm text-amber-800">{tr(data.error)}</p>}
      {data && !("error" in data) && (
        <>
          <p className="text-sm text-neutral-800">
            {shown.length} {tr("топ")} · {shown.reduce((a, g) => a + g.count, 0)} {tr("шағым")}
            {Object.entries(byCat).map(([c, n]) => <span key={c} className="ml-2 inline-flex items-center gap-1"><span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: CAT_COLOR[c] }} />{t(`complaints.category.${c}` as never)} {n}</span>)}
          </p>
          {shown.length === 0 && <p className="text-sm text-neutral-600">{tr("Бұл кезеңде жария шағым жоқ.")}</p>}
          <ul className="max-h-[50vh] space-y-1.5 overflow-auto">
            {shown.slice(0, 200).map((g) => (
              <li key={g.id} className="rounded-md border border-neutral-200 p-2 text-sm">
                <button type="button" className="flex items-center gap-1.5 text-left" onClick={() => focusOn({ center: [g.lng, g.lat] })}>
                  <MapPin className="h-3.5 w-3.5" style={{ color: CAT_COLOR[g.category] }} aria-hidden />
                  <span className="font-medium">{t(`complaints.category.${g.category}` as never)}</span>
                  {g.count > 1 && <span className="text-neutral-600">× {g.count}</span>}
                  <span className="text-xs text-neutral-600">· {fmt(g.lastAt)}</span>
                </button>
                {AIRBORNE.has(g.category) && (
                  <Link href={`/map?tool=trajectory&lat=${g.lat}&lng=${g.lng}&at=${encodeURIComponent(g.firstAt)}`} onClick={(e) => {
                      // Сол картада қаламыз: URL-ді ауыстырып, траектория құралын ашамыз (ол нүкте мен уақытты URL-ден оқиды)
                      e.preventDefault();
                      window.history.replaceState(null, "", e.currentTarget.getAttribute("href"));
                      useMapToolsStore.getState().setTool("trajectory");
                    }}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-[#0b3a6b] underline underline-offset-2">
                    <Wind className="h-3 w-3" aria-hidden />{tr("Ауа қайдан келді (кері траектория)")}
                  </Link>
                )}
              </li>
            ))}
          </ul>
          <Link href="/complaints/new" className="inline-flex min-h-[44px] items-center rounded border border-neutral-300 px-3 text-sm font-medium text-[#0b3a6b] hover:border-[#0b3a6b]">{tr("Шағым жіберу (иіс, түтін, шаң)")}</Link>
        </>
      )}
    </div>
  );
}
