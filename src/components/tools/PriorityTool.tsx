"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { DEFAULT_WEIGHTS, scoreCells, type PriorityCell, type Weights } from "@/lib/priorityGrid";

interface Grid { fetchedAt: string; season: { year: number }; cellKm: number; cells: PriorityCell[]; caveats: string[]; sources: string[]; osmSnapshotAt: string | null }

// 0 → ақшыл, 1 → қою қызыл (бір реттік sequential шкала)
const RAMP = ["#fff7ec", "#fdd49e", "#fc8d59", "#d7301f", "#7f0000"];
const colorFor = (s: number) => RAMP[Math.min(RAMP.length - 1, Math.floor(s * RAMP.length))];

// Басымдық картасы (i-Tree Landscape / Tree Equity Score үлгісі): критерийлер
// салмағын пайдаланушы өзі қояды; есептеу браузерде, деректер статикалық көшірмеден.
export function PriorityTool() {
  const { tr } = useLang();
  const setOverlay = useMapToolsStore((s) => s.setOverlay);
  const [grid, setGrid] = useState<Grid | null>(null);
  // WorldPop 2020 — бөлек статикалық көшірме; жоқ болса критерий жай ғана алынбайды
  const [pop, setPop] = useState<{ map: Map<string, number | null>; source: string; total: number; caveats: string[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [w, setW] = useState<Weights>(DEFAULT_WEIGHTS);
  const [onlyResidential, setOnlyResidential] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let r = await fetch("/data/layers/priority-grid-atyrau.json");
        if (!r.ok) r = await fetch("/api/priority-grid?region=atyrau");
        const j = await r.json();
        if (!alive) return;
        if (!r.ok || j.error) setErr(j.error ?? tr("Басымдық торы қолжетімсіз")); else setGrid(j);
      } catch { if (alive) setErr(tr("Басымдық торы қолжетімсіз")); }
    })();
    fetch("/data/layers/population-grid-atyrau.json").then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!alive || !j?.cells) return;
      setPop({ map: new Map((j.cells as { id: string; population: number | null }[]).map((c) => [c.id, c.population])), source: j.source, total: j.totalPopulation, caveats: j.caveats ?? [] });
    }).catch(() => {});
    return () => { alive = false; };
  }, [tr]);

  const scores = useMemo(() => (grid ? scoreCells(grid.cells, w, pop?.map) : []), [grid, w, pop]);
  const ranked = useMemo(() => grid ? grid.cells.map((c, i) => ({ c, s: scores[i] }))
    .filter((x) => x.s != null && (!onlyResidential || x.c.residential >= 0.2))
    .sort((a, b) => b.s! - a.s!) : [], [grid, scores, onlyResidential]);

  useEffect(() => {
    if (!grid) return;
    setOverlay({
      type: "FeatureCollection",
      features: ranked.map(({ c, s }) => {
        const [x0, y0, x1, y1] = c.bbox;
        return {
          type: "Feature", properties: { kind: "polygon", color: colorFor(s!), opacity: 0.55, label: `${tr("Басымдық")} ${(s! * 100).toFixed(0)} · NDVI ${c.ndvi} · ${tr("тұрғын")} ${(c.residential * 100).toFixed(0)}%` },
          geometry: { type: "Polygon", coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
        };
      }),
    });
  }, [ranked, grid, setOverlay, tr]);

  const slider = (key: keyof Weights, label: string) => (
    <label className="block text-sm">
      <span className="flex justify-between text-neutral-700"><span>{tr(label)}</span><span className="tabular-nums">{w[key]}</span></span>
      <input type="range" min={0} max={100} step={5} value={w[key]} onChange={(e) => setW({ ...w, [key]: +e.target.value })} className="w-full" />
    </label>
  );

  if (err) return <p role="alert" className="text-sm text-amber-800">{tr(err)}</p>;
  if (!grid) return <p className="text-sm text-neutral-600"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Көгалдандыру басымдығы: қай ұяшыққа (1 км) ағаш бірінші керек. Критерий салмағын өзіңіз қойыңыз.")}</p>
      <TierBadge tier="model" tone="light" />
      {slider("ndvi", "Өсімдік тапшылығы (Sentinel-2 NDVI)")}
      {pop ? slider("population", "Халық тығыздығы (WorldPop 2020)") : <p className="text-xs text-neutral-600">{tr("WorldPop торы жүктелмеді — халық критерийі есептелмейді.")}</p>}
      {slider("residential", "Тұрғын үй үлесі (OSM)")}
      {slider("source", "Өнеркәсіп нысанына жақындық")}
      <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyResidential} onChange={(e) => setOnlyResidential(e.target.checked)} />{tr("Тек тұрғын ұяшықтар (≥ 20%)")}</label>
      <div className="flex items-center gap-1 text-xs text-neutral-600">{tr("төмен")}{RAMP.map((c) => <span key={c} className="h-3 w-6" style={{ background: c }} />)}{tr("жоғары")}</div>
      <p className="text-sm font-medium text-neutral-900">{tr("Ең жоғары 10 ұяшық")}</p>
      <ol className="list-decimal space-y-0.5 pl-5 text-xs text-neutral-700">
        {ranked.slice(0, 10).map(({ c, s }) => (
          <li key={c.id}>{(s! * 100).toFixed(0)} · NDVI {c.ndvi}{pop?.map.get(c.id) != null && <> · ~{Math.round(pop.map.get(c.id)!).toLocaleString("ru-RU")} {tr("адам")}</>} · {tr("тұрғын")} {(c.residential * 100).toFixed(0)}% · {tr("жасыл (OSM)")} {(c.green * 100).toFixed(0)}% · {c.sourceKm} км</li>
        ))}
      </ol>
      <p className="text-xs text-neutral-600">{tr("NDVI маусымы")}: {grid.season.year} · {tr("Дереккөз")}: {grid.sources.map(tr).join("; ")}</p>
      {pop && <p className="text-xs text-neutral-600">{tr("Халық")}: {pop.source}</p>}
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-600">{[...grid.caveats, ...(pop?.caveats ?? [])].map((c) => <li key={c}>{tr(c)}</li>)}</ul>
    </div>
  );
}
