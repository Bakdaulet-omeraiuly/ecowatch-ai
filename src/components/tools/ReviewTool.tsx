"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { fireKey, VERDICT_LABEL, VERDICTS, type Verdict } from "@/lib/detectionReview";
import { authedJson, useMyRole } from "./useMyRole";

interface Anomaly { lat: number; lng: number; frp: number; confidence: string; acqDate: string; dayNight: string; category: string; facilityName: string | null }
const VERDICT_COLOR: Record<Verdict | "none", string> = { confirmed: "#dc2626", false_positive: "#16a34a", unverified: "#f59e0b", none: "#737373" };

// Детекцияны растау (EMSA CleanSeaNet үлгісі): спутник тапқан жылу аномалиясы
// қызметкер тексергенге дейін «тексерілмеген». Шешім мен күні жария.
export function ReviewTool() {
  const { tr } = useLang();
  const { role } = useMyRole();
  const { setOverlay, focusOn } = useMapToolsStore();
  const [days, setDays] = useState(30);
  const [onlyUnconfirmed, setOnlyUnconfirmed] = useState(true);
  const [loaded, setLoaded] = useState<{ days: number; items: Anomaly[] | null; err: string | null }>({ days: -1, items: null, err: null });
  const [verdicts, setVerdicts] = useState<Map<string, { verdict: Verdict; reviewed_at: string }>>(new Map());
  const [verdictsOk, setVerdictsOk] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const staff = role === "officer" || role === "admin";

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/fire-archive?region=atyrau&days=${days}`).then(async (r) => ({ ok: r.ok, j: await r.json() })).catch(() => ({ ok: false, j: {} })),
      fetch("/api/detection-reviews?layer=fire").then(async (r) => ({ ok: r.ok, j: await r.json() })).catch(() => ({ ok: false, j: {} })),
    ]).then(([a, v]) => {
      if (!alive) return;
      if (!a.ok) { setLoaded({ days, items: null, err: a.j.error ?? "FIRMS мұрағаты уақытша қолжетімсіз — жалған дерек көрсетілмейді." }); return; }
      setLoaded({ days, items: a.j.anomalies, err: null });
      setVerdictsOk(v.ok);
      if (v.ok) setVerdicts(new Map((v.j.verdicts as { detection_key: string; verdict: Verdict; reviewed_at: string }[]).map((x) => [x.detection_key, x])));
    });
    return () => { alive = false; };
  }, [days]);
  const items = loaded.days === days ? loaded.items : null;
  const err = loaded.days === days ? loaded.err : null;

  const shown = useMemo(() => (items ?? [])
    .filter((a) => !onlyUnconfirmed || a.category === "unconfirmed_anomaly")
    .sort((a, b) => b.acqDate.localeCompare(a.acqDate)), [items, onlyUnconfirmed]);

  useEffect(() => {
    setOverlay({
      type: "FeatureCollection",
      features: shown.map((a) => {
        const v = verdicts.get(fireKey(a))?.verdict;
        return { type: "Feature", properties: { kind: "point", color: VERDICT_COLOR[v ?? "none"], label: `${a.acqDate} · ${tr(v ? VERDICT_LABEL[v] : "тексерілмеген")}` }, geometry: { type: "Point", coordinates: [a.lng, a.lat] } };
      }),
    });
  }, [shown, verdicts, setOverlay, tr]);

  const submit = async (a: Anomaly, verdict: Verdict) => {
    const key = fireKey(a);
    const r = await authedJson("/api/detection-reviews", { method: "POST", body: JSON.stringify({ layer: "fire", key, verdict, note: notes[key] || undefined }) });
    if (!r.ok) { toast.error(tr(r.body?.error ?? "Сақталмады")); return; }
    toast.success(tr("Шешім сақталды"));
    setVerdicts((m) => new Map(m).set(key, { verdict, reviewed_at: new Date().toISOString() }));
  };

  const reviewed = shown.filter((a) => verdicts.has(fireKey(a))).length;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Спутник тапқан жылу аномалиялары. Қызметкер әрқайсысын «расталды / жалған дабыл» деп белгілейді — шешім мен күні жария болады.")}</p>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">{tr("Кезең")}:
          <select value={days} onChange={(e) => setDays(+e.target.value)} className="rounded border border-neutral-300 px-2 py-1">
            {[7, 30, 90].map((d) => <option key={d} value={d}>{d} {tr("күн")}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={onlyUnconfirmed} onChange={(e) => setOnlyUnconfirmed(e.target.checked)} />{tr("Алауларды жасыру")}</label>
      </div>
      {!staff && role !== "loading" && <p className="text-xs text-neutral-500">{tr("Шешімді тек қызметкер (officer) қоя алады; сіз нәтижені көресіз.")}</p>}
      {!verdictsOk && <p className="text-xs text-amber-800">{tr("Растау кестесі әлі қосылмаған — шешімдер көрсетілмейді.")}</p>}
      {err && <p role="alert" className="text-sm text-amber-800">{tr(err)}</p>}
      {!items && !err && <p className="text-sm text-neutral-500"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}</p>}
      {items && <p className="text-sm text-neutral-800">{shown.length} {tr("детекция")} · {reviewed} {tr("тексерілді")}</p>}
      <ul className="max-h-[50vh] space-y-1.5 overflow-auto">
        {shown.slice(0, 200).map((a) => {
          const key = fireKey(a);
          const v = verdicts.get(key);
          return (
            <li key={key} className="rounded-md border border-neutral-200 p-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <button type="button" className="flex items-center gap-1 text-left" onClick={() => focusOn({ center: [a.lng, a.lat] })}>
                  <MapPin className="h-3.5 w-3.5" style={{ color: VERDICT_COLOR[v?.verdict ?? "none"] }} aria-hidden />
                  {a.acqDate} {a.dayNight === "N" ? tr("түнде") : tr("күндіз")} · FRP {a.frp} MW
                </button>
                <span className="text-xs" style={{ color: VERDICT_COLOR[v?.verdict ?? "none"] }}>{tr(v ? VERDICT_LABEL[v.verdict] : "тексерілмеген")}</span>
              </div>
              {a.facilityName && <div className="text-xs text-neutral-500">{tr("алау")}: {a.facilityName}</div>}
              {staff && (
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <input value={notes[key] ?? ""} onChange={(e) => setNotes({ ...notes, [key]: e.target.value })} maxLength={1000} placeholder={tr("Ескерту")} className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-0.5 text-xs" />
                  {VERDICTS.map((vd) => (
                    <Button key={vd} variant="portal-outline" size="portal" onClick={() => submit(a, vd)} aria-pressed={v?.verdict === vd}>{tr(VERDICT_LABEL[vd])}</Button>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
