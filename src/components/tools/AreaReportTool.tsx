"use client";

import { useState } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { toast } from "sonner";
import { FileDown, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { authHeaders } from "@/lib/authClient";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { AreaPicker, useValidRing } from "./AreaPicker";
import type { AreaMetric, MonthRow, FireRow, OverlayRow } from "@/lib/areaStats";

const METRICS: { key: AreaMetric; label: string; hint: string }[] = [
  { key: "ndvi", label: "Өсімдік (NDVI)", hint: "Sentinel-2 · 10 м · айлық медиана" },
  { key: "no2", label: "NO₂ бағаны", hint: "Sentinel-5P · ~5.5 км · айлық орташа" },
  { key: "fires", label: "Жылу аномалиялары", hint: "NASA FIRMS VIIRS · соңғы 365 күн" },
  { key: "overlay", label: "Жер пайдалану мен табиғат", hint: "OSM + Ақжайық · аумақ үлесі" },
];

const CATEGORY_KK: Record<string, string> = {
  "landuse:residential": "Тұрғын үй", "landuse:industrial": "Өнеркәсіп", "landuse:commercial": "Сауда",
  "landuse:farmland": "Егістік", "landuse:water": "Су", "landuse:possibly_contaminated": "Ықтимал ластанған (OSM белгісі)",
  "landuse:extraction": "Өндіру (карьер, кен орны)", "green:wood": "Ағаш алқабы", "green:grass": "Шөп/газон",
  "green:park": "Саябақ", "nature:akzhaiyk": "Ақжайық резерваты",
};

type Result =
  | { metric: "ndvi" | "no2"; unit: string; rows: MonthRow[]; validDays: number; resolutionM: number; areaKm2: number; source: string; caveats: string[]; window: { from: string; to: string } }
  | { metric: "fires"; rows: FireRow[]; points: { lat: number; lng: number; acqDate: string; frp: number; category: string; facility: string | null }[]; complete: boolean; areaKm2: number; source: string; caveats: string[]; window: { from: string; to: string } }
  | { metric: "overlay"; rows: OverlayRow[]; samples: number; stepM: number; areaKm2: number; source: string; caveats: string[] };

export function AreaReportTool() {
  const { tr } = useLang();
  const valid = useValidRing();
  const setOverlay = useMapToolsStore((s) => s.setOverlay);
  const [metric, setMetric] = useState<AreaMetric>("ndvi");
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<{ error: string; reason?: string } | null>(null);
  const monthsFor = metric === "no2" ? Math.min(months, 12) : months;

  const run = async () => {
    if (!valid) return;
    setBusy(true); setError(null); setResult(null); setOverlay(null);
    try {
      const res = await fetch("/api/area-report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ring: valid.ring, metric, months: monthsFor }),
      });
      const j = await res.json();
      if (!res.ok) { setError(j); return; }
      setResult(j as Result);
      if (j.metric === "fires") setOverlay({
        type: "FeatureCollection",
        features: (j.points as { lat: number; lng: number; acqDate: string; category: string }[]).map((p) => ({
          type: "Feature", properties: { kind: "point", category: p.category, color: p.category === "industrial_flare" ? "#f59e0b" : "#dc2626", label: p.acqDate },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
      });
    } catch {
      setError({ error: tr("Желі қатесі — қайталап көріңіз") });
    } finally { setBusy(false); }
  };

  const downloadCsv = async () => {
    if (!valid) return;
    const res = await fetch("/api/area-report", {
      method: "POST", headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ ring: valid.ring, metric, months: monthsFor, format: "csv" }),
    });
    if (res.status === 401 || res.status === 403) { toast.error(tr("CSV тек ғалым мен қызметкерге — кіріңіз немесе рөл сұраңыз")); return; }
    if (!res.ok) { toast.error(tr("CSV жасалмады — дереккөз қолжетімсіз")); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await res.blob());
    a.download = `jaiyq-area-${metric}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Аймақ сызыңыз немесе жүктеңіз → нақты спутник және карта деректері бойынша есеп.")}</p>
      <AreaPicker />
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-xs font-semibold text-neutral-700">{tr("Көрсеткіш")}</legend>
        {METRICS.map((m) => (
          <label key={m.key} className={`flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-1.5 text-sm ${metric === m.key ? "border-brand bg-brand/5" : "border-neutral-200"}`}>
            <input type="radio" name="area-metric" className="mt-1" checked={metric === m.key} onChange={() => { setMetric(m.key); setResult(null); setError(null); }} />
            <span><span className="font-medium text-neutral-900">{tr(m.label)}</span><br /><span className="text-xs text-neutral-500">{tr(m.hint)}</span></span>
          </label>
        ))}
      </fieldset>
      {(metric === "ndvi" || metric === "no2") && (
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          {tr("Кезең")}:
          <select value={months} onChange={(e) => setMonths(+e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            {[6, 12, 24].map((m) => <option key={m} value={m} disabled={metric === "no2" && m > 12}>{m} {tr("ай")}</option>)}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <Button variant="portal" size="portal" onClick={run} disabled={!valid || busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
          {busy ? tr("Есептелуде…") : tr("Есеп шығару")}
        </Button>
        {result && (
          <Button variant="portal-outline" size="portal" onClick={downloadCsv}>
            <FileDown className="h-4 w-4" aria-hidden />CSV
          </Button>
        )}
      </div>
      {busy && metric !== "overlay" && <p className="text-xs text-neutral-500">{tr("Спутник деректері 10–40 секунд ішінде есептеледі.")}</p>}
      {error && (
        <div role="alert" className="rounded-md border border-neutral-300 bg-white p-2.5 text-sm text-amber-900 border-l-4 border-l-amber-600">
          {tr(error.error)}{error.reason && <div className="text-xs opacity-80">{error.reason}</div>}
        </div>
      )}
      {result && <ResultView r={result} />}
    </div>
  );
}

function ResultView({ r }: { r: Result }) {
  const { tr } = useLang();
  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <TierBadge tier="measurement" tone="light" />
        <span className="text-xs text-neutral-500">{r.areaKm2.toFixed(2)} км²</span>
      </div>
      {(r.metric === "ndvi" || r.metric === "no2") && <SeriesView r={r} />}
      {r.metric === "fires" && <FiresView r={r} />}
      {r.metric === "overlay" && (
        <ul className="space-y-1 text-sm">
          {r.rows.length === 0 && <li className="text-neutral-600">{tr("Аймақта OSM-да белгіленген санат жоқ (бұл «жоқ» дегенді білдірмейді).")}</li>}
          {r.rows.map((x) => (
            <li key={x.category}>
              <div className="flex justify-between"><span>{tr(CATEGORY_KK[x.category] ?? x.category)}</span><span className="tabular-nums">{(x.fraction * 100).toFixed(1)}% · {x.areaKm2 < 1 ? `${(x.areaKm2 * 100).toFixed(1)} ${tr("га")}` : `${x.areaKm2.toFixed(2)} км²`}</span></div>
              <div className="h-1.5 rounded bg-neutral-100"><div className="h-1.5 rounded bg-brand" style={{ width: `${Math.min(100, x.fraction * 100)}%` }} /></div>
            </li>
          ))}
          <li className="pt-1 text-xs text-neutral-500">{tr("Тор-сынама қадамы")}: {r.stepM} м · {r.samples} {tr("нүкте")}</li>
        </ul>
      )}
      <p className="text-xs text-neutral-500">{tr("Дереккөз")}: {r.source}</p>
      <ul className="list-disc space-y-0.5 pl-4 text-xs text-neutral-600">
        {r.caveats.map((c) => <li key={c}>{tr(c)}</li>)}
      </ul>
    </div>
  );
}

function SeriesView({ r }: { r: Extract<Result, { metric: "ndvi" | "no2" }> }) {
  const { tr } = useLang();
  const data = r.rows.map((m) => ({ month: m.month.slice(2), value: m.value == null ? null : +m.value.toFixed(r.metric === "ndvi" ? 3 : 1), n: m.n }));
  const vals = r.rows.filter((m) => m.value != null);
  return (
    <>
      <p className="text-sm font-medium text-neutral-900">{r.metric === "ndvi" ? tr("Айлық NDVI медианасы") : tr("Айлық тропосфералық NO₂, µmol/m²")}</p>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
            <Tooltip formatter={(v) => [v ?? tr("дерек жоқ"), r.unit]} />
            <Line type="monotone" dataKey="value" stroke={r.metric === "ndvi" ? "#16a34a" : "#b45309"} strokeWidth={2} dot={{ r: 2 }} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-neutral-600">
        {tr("Жарамды өту")}: {r.validDays} · {tr("деректі ай")}: {vals.length}/{r.rows.length} · {tr("есептеу қадамы")} {r.resolutionM} м
      </p>
    </>
  );
}

function FiresView({ r }: { r: Extract<Result, { metric: "fires" }> }) {
  const { tr } = useLang();
  const flares = r.points.filter((p) => p.category === "industrial_flare").length;
  return (
    <>
      <p className="text-sm font-medium text-neutral-900">
        {r.points.length} {tr("жылу нүктесі")} · {flares} {tr("алау")} · {r.points.length - flares} {tr("расталмаған")}
      </p>
      {!r.complete && <p className="text-xs text-amber-800">{tr("FIRMS терезелерінің бір бөлігі жүктелмеді — сан толық емес.")}</p>}
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={r.rows.map((x) => ({ ...x, month: x.month.slice(2) }))} margin={{ top: 4, right: 8, left: -22, bottom: 0 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="flare" stackId="a" fill="#f59e0b" name={tr("алау")} />
            <Bar dataKey="unconfirmed" stackId="a" fill="#dc2626" name={tr("расталмаған")} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
