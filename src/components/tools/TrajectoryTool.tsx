"use client";

import { useState } from "react";
import { Crosshair, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";

interface Traj {
  arrival: string; hours: number; truncated: boolean;
  points: { lat: number; lng: number; time: string; hoursBack: number }[];
  nearFacilities: { id: string; name: string; km: number; hoursBack: number }[];
  nearKm: number; source: string; caveats: string[];
}

// Кері траектория: «бұл нүктеге ауа қайдан келді?» (EPA HYSPLIT-тің қарапайым 2D аналогы).
export function TrajectoryTool() {
  const { tr } = useLang();
  const { point, pick, setPick, setPoint, setOverlay } = useMapToolsStore();
  const [hours, setHours] = useState(12);
  const [ago, setAgo] = useState(0);
  const [busy, setBusy] = useState(false);
  const [resRaw, setRes] = useState<Traj | null>(null);
  const [errRaw, setErr] = useState<{ error: string; reason?: string } | null>(null);

  // Нәтиже тек өзі есептелген нүктеге көрсетіледі
  const [forPoint, setForPoint] = useState<string | null>(null);
  const pointKey = point ? point.join(",") : null;
  const res = forPoint === pointKey ? resRaw : null;
  const err = forPoint === pointKey ? errRaw : null;

  const run = async () => {
    if (!point) return;
    setBusy(true); setErr(null); setRes(null); setForPoint(point.join(","));
    const at = new Date(Math.floor(Date.now() / 3600_000) * 3600_000 - ago * 3600_000).toISOString();
    try {
      const r = await fetch(`/api/back-trajectory?lat=${point[1]}&lng=${point[0]}&hours=${hours}&at=${encodeURIComponent(at)}`);
      const j = await r.json();
      if (!r.ok) { setErr(j); return; }
      setRes(j);
      setOverlay({
        type: "FeatureCollection",
        features: [
          { type: "Feature", properties: { kind: "line", color: "#7c3aed" }, geometry: { type: "LineString", coordinates: j.points.map((p: Traj["points"][0]) => [p.lng, p.lat]) } },
          ...j.points.filter((p: Traj["points"][0]) => p.hoursBack > 0 && p.hoursBack % 3 === 0).map((p: Traj["points"][0]) => ({
            type: "Feature" as const, properties: { kind: "point", color: "#7c3aed", label: `−${p.hoursBack} ${tr("сағ")}` }, geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
          })),
        ],
      });
    } catch { setErr({ error: tr("Желі қатесі — қайталап көріңіз") }); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Нүктені таңдаңыз — жел деректері бойынша ауа массасы соңғы сағаттарда қай жақтан келгені есептеледі.")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="portal-outline" size="portal" aria-pressed={pick === "point"} onClick={() => setPick(pick === "point" ? "none" : "point")}>
          <Crosshair className="h-4 w-4" aria-hidden />{pick === "point" ? tr("Картаны басыңыз…") : tr("Нүкте таңдау")}
        </Button>
        {point && <span className="text-xs tabular-nums text-neutral-600">{point[1].toFixed(4)}, {point[0].toFixed(4)}</span>}
        {point && <Button variant="portal-outline" size="portal" onClick={() => { setPoint(null); setOverlay(null); }}>{tr("Тазалау")}</Button>}
      </div>
      <div className="flex flex-wrap gap-3 text-sm text-neutral-700">
        <label className="flex items-center gap-1.5">{tr("Ұзақтығы")}:
          <select value={hours} onChange={(e) => setHours(+e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            {[3, 6, 12, 24].map((h) => <option key={h} value={h}>{h} {tr("сағ")}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">{tr("Келу уақыты")}:
          <select value={ago} onChange={(e) => setAgo(+e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            {[0, 1, 2, 3, 6, 12, 24, 36, 47].map((h) => <option key={h} value={h}>{h === 0 ? tr("қазір") : `${h} ${tr("сағ бұрын")}`}</option>)}
          </select>
        </label>
      </div>
      <Button variant="portal" size="portal" onClick={run} disabled={!point || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}{tr("Есептеу")}
      </Button>
      {err && <div role="alert" className="rounded-md border border-neutral-300 bg-white p-2.5 text-sm text-amber-900 border-l-4 border-l-amber-600">{tr(err.error)}{err.reason && <div className="text-xs opacity-80">{err.reason}</div>}</div>}
      {res && (
        <div className="space-y-2 rounded-lg border border-neutral-200 p-3 text-sm">
          <TierBadge tier="model" tone="light" />
          <p className="text-neutral-800">
            {tr("Келу")}: {new Date(res.arrival).toLocaleString()} · {res.hours} {tr("сағ кері")}
            {res.truncated && <span className="text-amber-800"> · {tr("траектория жел торынан шықты — қысқартылды")}</span>}
          </p>
          <p className="font-medium text-neutral-900">{tr("Маршрутқа жақын нысандар")} (≤ {res.nearKm} км):</p>
          {res.nearFacilities.length === 0
            ? <p className="text-neutral-600">{tr("Тізілімдегі нысандардың ешқайсысы маршрутқа жақын емес.")}</p>
            : <ul className="space-y-0.5">{res.nearFacilities.map((f) => <li key={f.id}>{f.name} — {f.km} км, ~{f.hoursBack} {tr("сағ бұрын")}</li>)}</ul>}
          <p className="text-xs text-neutral-600">{tr("Дереккөз")}: {res.source}</p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-600">{res.caveats.map((c) => <li key={c}>{tr(c)}</li>)}</ul>
        </div>
      )}
    </div>
  );
}
