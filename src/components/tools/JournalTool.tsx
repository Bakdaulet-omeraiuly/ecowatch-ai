"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Loader2, Save, Satellite, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { JOURNAL_LAYERS, LAYER_LABELS, kindSpec, kindsFor, validateEntry, type Geom, type JournalKind, type JournalLayer, type JournalStatus } from "@/lib/fieldJournal";
import { AreaPicker } from "./AreaPicker";
import { authedJson, useMyRole } from "./useMyRole";

interface Entry {
  id: string; user_id: string; layer: JournalLayer; kind: JournalKind; geom: Geom; lat: number; lng: number;
  area_km2: number | null; event_date: string; status: JournalStatus; fields: Record<string, string | number>; note: string | null;
}
interface Verify {
  status: "ok" | "too_early" | "no_data";
  seasons: { baseline: { year: number }; recent: { year: number } };
  baseline?: { medianNdvi: number; passes: number } | null; recent?: { medianNdvi: number; passes: number } | null;
  dNdvi?: number; trend?: "up" | "down" | "stable"; caveats: string[];
}

const STATUS_COLOR: Record<JournalStatus, string> = { planned: "#64748b", open: "#2563eb", done: "#16a34a", failed: "#dc2626", cancelled: "#a3a3a3" };
const today = () => new Date().toISOString().slice(0, 10);

// Далалық журнал (FieldSeeker үлгісі): отырғызу, қоқыс, маса, сынама, инспекция.
export function JournalTool() {
  const { tr } = useLang();
  const { role, userId } = useMyRole();
  const { ring, point, pick, setPick, setPoint, setRing, setOverlay } = useMapToolsStore();
  const [layer, setLayer] = useState<JournalLayer>("green");
  const [kind, setKind] = useState<JournalKind>("planting");
  const [geomMode, setGeomMode] = useState<"point" | "polygon">("polygon");
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState<JournalStatus>("planned");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [listErr, setListErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verify, setVerify] = useState<Record<string, Verify | { error: string } | "loading">>({});
  const spec = kindSpec(kind)!;
  const canUse = role === "scientist" || role === "officer" || role === "admin";

  // Қабат/түр ауысқанда — сай әдепкі мәндер (effect емес, оқиға өңдеушіде)
  const applyKind = (k: JournalKind) => {
    const sp = kindSpec(k)!;
    setKind(k); setStatus(sp.statuses[0]); setFields({});
    setGeomMode(sp.geometry === "point" ? "point" : "polygon");
  };
  const applyLayer = (l: JournalLayer) => { setLayer(l); applyKind(kindsFor(l)[0].kind); };

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!canUse) return;
    let alive = true;
    authedJson(`/api/field-entries?layer=${layer}`).then((r) => {
      if (!alive) return;
      if (!r.ok) { setListErr(r.body?.error ?? "Журнал жүктелмеді"); setEntries(null); return; }
      setListErr(null); setEntries(r.body.entries as Entry[]);
    });
    return () => { alive = false; };
  }, [canUse, layer, tick]);

  // Жазбаларды картаға салу
  useEffect(() => {
    if (!entries) return;
    setOverlay({
      type: "FeatureCollection",
      features: entries.map((e) => ({
        type: "Feature", properties: { kind: e.geom.type === "Point" ? "point" : "polygon", color: STATUS_COLOR[e.status], label: `${tr(kindSpec(e.kind)?.label ?? e.kind)} · ${e.event_date}` },
        geometry: e.geom,
      })),
    });
  }, [entries, setOverlay, tr]);

  const geom: Geom | null = useMemo(() => {
    if (geomMode === "point") return point ? { type: "Point", coordinates: point } : null;
    return ring.length >= 3 ? { type: "Polygon", coordinates: [[...ring, ring[0]]] } : null;
  }, [geomMode, point, ring]);
  const draft = { layer, kind, geom, event_date: date, status, fields, note };
  const check = geom ? validateEntry(draft) : null;

  const save = async () => {
    if (!check?.ok) return;
    setSaving(true);
    const r = await authedJson("/api/field-entries", { method: "POST", body: JSON.stringify(draft) });
    setSaving(false);
    if (!r.ok) { toast.error(tr(r.body?.error ?? "Сақталмады")); return; }
    toast.success(tr("Жазба сақталды"));
    setFields({}); setNote(""); setRing([]); setPoint(null);
    load();
  };

  const changeStatus = async (e: Entry, s: JournalStatus) => {
    const r = await authedJson(`/api/field-entries/${e.id}`, { method: "PATCH", body: JSON.stringify({ status: s }) });
    if (!r.ok) { toast.error(tr(r.body?.error ?? "Өзгертілмеді")); return; }
    load();
  };
  const remove = async (e: Entry) => {
    const r = await authedJson(`/api/field-entries/${e.id}`, { method: "DELETE" });
    if (!r.ok) { toast.error(tr(r.body?.error ?? "Өшірілмеді")); return; }
    load();
  };
  const runVerify = async (e: Entry) => {
    setVerify((v) => ({ ...v, [e.id]: "loading" }));
    const r = await authedJson(`/api/field-entries/${e.id}/verify`);
    setVerify((v) => ({ ...v, [e.id]: r.ok ? (r.body as unknown as Verify) : { error: r.body?.error ?? "Тексерілмеді" } }));
  };

  if (role === "loading") return <p className="text-sm text-neutral-500"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr("Рөл тексерілуде…")}</p>;
  if (!canUse) return (
    <div className="rounded-md border border-neutral-200 p-3 text-sm text-neutral-700">
      {tr("Далалық журнал тек ғалым мен қызметкерге арналған. Рөлді сайт иесі береді.")}{" "}
      {!role && <Link href="/auth" className="text-brand underline">{tr("Кіру")}</Link>}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="space-y-0.5"><span className="text-xs text-neutral-600">{tr("Қабат")}</span>
          <select value={layer} onChange={(e) => applyLayer(e.target.value as JournalLayer)} className="w-full rounded border border-neutral-300 px-2 py-1">
            {JOURNAL_LAYERS.map((l) => <option key={l} value={l}>{tr(LAYER_LABELS[l])}</option>)}
          </select>
        </label>
        <label className="space-y-0.5"><span className="text-xs text-neutral-600">{tr("Жазба түрі")}</span>
          <select value={kind} onChange={(e) => applyKind(e.target.value as JournalKind)} className="w-full rounded border border-neutral-300 px-2 py-1">
            {kindsFor(layer).map((k) => <option key={k.kind} value={k.kind}>{tr(k.label)}</option>)}
          </select>
        </label>
      </div>

      {spec.geometry === "either" && (
        <div className="flex gap-1 text-sm">
          {(["polygon", "point"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setGeomMode(m)} aria-pressed={geomMode === m}
              className={`rounded-full border px-3 py-1 ${geomMode === m ? "border-brand bg-brand/5 text-brand" : "border-neutral-300 text-neutral-700"}`}>
              {m === "polygon" ? tr("Аумақ") : tr("Нүкте")}
            </button>
          ))}
        </div>
      )}
      {geomMode === "polygon" ? <AreaPicker /> : (
        <div className="flex items-center gap-2">
          <Button variant="portal-outline" size="portal" aria-pressed={pick === "point"} onClick={() => setPick(pick === "point" ? "none" : "point")}>
            <Crosshair className="h-4 w-4" aria-hidden />{pick === "point" ? tr("Картаны басыңыз…") : tr("Нүкте таңдау")}
          </Button>
          {point && <span className="text-xs tabular-nums text-neutral-600">{point[1].toFixed(5)}, {point[0].toFixed(5)}</span>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="space-y-0.5"><span className="text-xs text-neutral-600">{tr("Күні")}</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded border border-neutral-300 px-2 py-1" />
        </label>
        <label className="space-y-0.5"><span className="text-xs text-neutral-600">{tr("Мәртебе")}</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as JournalStatus)} className="w-full rounded border border-neutral-300 px-2 py-1">
            {spec.statuses.map((s) => <option key={s} value={s}>{tr(spec.statusLabels[s] ?? s)}</option>)}
          </select>
        </label>
        {spec.fields.map((f) => (
          <label key={f.key} className="space-y-0.5">
            <span className="text-xs text-neutral-600">{tr(f.label)}{f.unit ? `, ${tr(f.unit)}` : ""}{f.required ? " *" : ""}</span>
            {f.type === "select" ? (
              <select value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1">
                <option value="">—</option>
                {f.options!.map((o) => <option key={o} value={o}>{tr(o)}</option>)}
              </select>
            ) : (
              <input type={f.type === "number" ? "number" : "text"} value={fields[f.key] ?? ""} min={f.min} max={f.max}
                onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} className="w-full rounded border border-neutral-300 px-2 py-1" />
            )}
          </label>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder={tr("Ескерту (міндетті емес)")} className="w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
      {check && !check.ok && <p className="text-xs text-red-700">{tr(check.error)}</p>}
      <Button variant="portal" size="portal" onClick={save} disabled={!check?.ok || saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}{tr("Сақтау")}
      </Button>

      <div className="border-t border-neutral-200 pt-3">
        <p className="mb-1.5 text-sm font-semibold text-neutral-900">{tr("Жазбалар")}: {tr(LAYER_LABELS[layer])} {entries && `(${entries.length})`}</p>
        {listErr && <p role="alert" className="text-sm text-amber-800">{tr(listErr)}</p>}
        {entries?.length === 0 && <p className="text-sm text-neutral-600">{tr("Әзірге жазба жоқ.")}</p>}
        <ul className="space-y-2">
          {entries?.map((e) => {
            const s = kindSpec(e.kind);
            const v = verify[e.id];
            return (
              <li key={e.id} className="rounded-md border border-neutral-200 p-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-medium">{tr(s?.label ?? e.kind)}</span> · {e.event_date}
                    {e.area_km2 != null && <> · {(e.area_km2 * 100).toFixed(2)} {tr("га")}</>}
                    <div className="text-xs text-neutral-600">{Object.entries(e.fields).map(([k, val]) => `${tr(s?.fields.find((f) => f.key === k)?.label ?? k)}: ${tr(String(val))}`).join(" · ")}</div>
                    {e.note && <div className="text-xs text-neutral-500">{e.note}</div>}
                  </div>
                  <select value={e.status} onChange={(ev) => changeStatus(e, ev.target.value as JournalStatus)} className="rounded border border-neutral-300 px-1 py-0.5 text-xs" style={{ color: STATUS_COLOR[e.status] }}>
                    {(s?.statuses ?? [e.status]).map((st) => <option key={st} value={st}>{tr(s?.statusLabels[st] ?? st)}</option>)}
                  </select>
                </div>
                <div className="mt-1 flex gap-1.5">
                  {e.kind === "planting" && e.geom.type === "Polygon" && (
                    <Button variant="portal-outline" size="portal" onClick={() => runVerify(e)} disabled={v === "loading"}>
                      {v === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Satellite className="h-3.5 w-3.5" />}{tr("Спутникпен тексеру")}
                    </Button>
                  )}
                  {(e.user_id === userId || role === "admin") && (
                    <Button variant="portal-outline" size="portal" onClick={() => remove(e)} aria-label={tr("Өшіру")}><Trash2 className="h-3.5 w-3.5" /></Button>
                  )}
                </div>
                {v && v !== "loading" && <VerifyView v={v} />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function VerifyView({ v }: { v: Verify | { error: string } }) {
  const { tr } = useLang();
  if ("error" in v) return <p className="mt-1 text-xs text-amber-800">{tr(v.error)}</p>;
  if (v.status === "too_early") return <p className="mt-1 text-xs text-neutral-600">{tr("Әлі ерте: отырғызудан кейінгі толық жаз өтпеді.")} ({v.seasons.recent.year})</p>;
  if (v.status === "no_data") return <p className="mt-1 text-xs text-neutral-600">{tr("Бұлтсыз Sentinel-2 өтуі жеткіліксіз — тексеру мүмкін емес.")}</p>;
  const label = v.trend === "up" ? "NDVI өсті" : v.trend === "down" ? "NDVI төмендеді" : "Өзгеріс шектен аз";
  return (
    <div className="mt-1 space-y-0.5 rounded bg-neutral-50 p-2 text-xs">
      <TierBadge tier="measurement" tone="light" />
      <div>{v.seasons.baseline.year}: {v.baseline?.medianNdvi} → {v.seasons.recent.year}: {v.recent?.medianNdvi} · Δ {v.dNdvi! > 0 ? "+" : ""}{v.dNdvi} · <b>{tr(label)}</b></div>
      <ul className="list-disc pl-4 text-neutral-600">{v.caveats.map((c) => <li key={c}>{tr(c)}</li>)}</ul>
    </div>
  );
}
