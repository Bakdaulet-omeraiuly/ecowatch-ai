"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { ringBbox, ringToFeature, type LngLat } from "@/lib/areaGeo";
import { AreaPicker, useValidRing } from "./AreaPicker";
import { authedJson, useMyRole } from "./useMyRole";

interface Area {
  id: string; name: string; ring: LngLat[]; area_km2: number; layers: string[]; last_seen_at: string;
  fire: { available: boolean; reason?: string; last7d: number; newSinceSeen: number; detections: { key: string; lat: number; lng: number; acqDate: string; frp: number; category: string; isNew: boolean }[] };
  complaints?: { available: boolean; last7d: number; newSinceSeen: number; items: { category: string; event_at: string; lat: number; lng: number }[] };
}

// Аймаққа жазылу (Global Forest Watch «Subscribe» үлгісі): сайтқа кірген сайын
// аймақтағы жаңа жылу аномалиялары көрсетіледі. Хабарлама (Telegram/email) — кейін.
export function WatchTool() {
  const { tr } = useLang();
  const { role } = useMyRole();
  const valid = useValidRing();
  const { setOverlay, setRing, focusOn } = useMapToolsStore();
  const [areas, setAreas] = useState<Area[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const [tick, setTick] = useState(0);
  const load = useCallback(() => setTick((t) => t + 1), []);
  useEffect(() => {
    if (!role || role === "loading") return;
    let alive = true;
    authedJson("/api/watch-areas").then((r) => {
      if (!alive) return;
      if (!r.ok) { setErr(r.body?.error ?? "Аймақтар жүктелмеді"); return; }
      setErr(null);
      const list = r.body.areas as Area[];
      setAreas(list);
      setOverlay({
        type: "FeatureCollection",
        features: list.flatMap((a) => [
          { ...ringToFeature(a.ring, { kind: "polygon", color: "#0ea5e9", label: a.name }) },
          ...a.fire.detections.map((d) => ({ type: "Feature" as const, properties: { kind: "point", color: d.isNew ? "#dc2626" : "#f59e0b", label: `${d.acqDate} · FRP ${d.frp}` }, geometry: { type: "Point" as const, coordinates: [d.lng, d.lat] } })),
          ...(a.complaints?.items ?? []).map((c) => ({ type: "Feature" as const, properties: { kind: "point", color: "#7c3aed", label: c.event_at.slice(0, 10) }, geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] } })),
        ]),
      });
    });
    return () => { alive = false; };
  }, [role, tick, setOverlay]);

  const create = async () => {
    if (!valid || !name.trim()) return;
    setBusy(true);
    const r = await authedJson("/api/watch-areas", { method: "POST", body: JSON.stringify({ name: name.trim(), ring: valid.ring, layers: ["fire"] }) });
    setBusy(false);
    if (!r.ok) { toast.error(tr(r.body?.error ?? "Сақталмады")); return; }
    toast.success(tr("Аймақ бақылауға алынды"));
    setName(""); setRing([]); load();
  };
  const seen = async (a: Area) => { await authedJson(`/api/watch-areas/${a.id}`, { method: "PATCH", body: "{}" }); load(); };
  const remove = async (a: Area) => {
    const r = await authedJson(`/api/watch-areas/${a.id}`, { method: "DELETE" });
    if (!r.ok) toast.error(tr(r.body?.error ?? "Өшірілмеді")); else load();
  };

  if (role === "loading") return <p className="text-sm text-neutral-600"><Loader2 className="inline h-4 w-4 animate-spin" /> {tr("Рөл тексерілуде…")}</p>;
  if (!role) return <p className="text-sm text-neutral-700">{tr("Аймақты бақылау үшін кіріңіз.")} <Link href="/auth" className="text-brand underline">{tr("Кіру")}</Link></p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-600">{tr("Аймақ сызып, бақылауға алыңыз: соңғы 7 күндегі жаңа жылу аномалиялары мен тұрғын шағымдары осында көрсетіледі (ең көбі 10 аймақ).")}</p>
      <AreaPicker />
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} placeholder={tr("Аймақ атауы")} className="min-w-0 flex-1 rounded border border-neutral-300 px-2 py-1 text-sm" />
        <Button variant="portal" size="portal" onClick={create} disabled={!valid || !name.trim() || busy}><Bell className="h-4 w-4" aria-hidden />{tr("Бақылау")}</Button>
      </div>
      {err && <p role="alert" className="text-sm text-amber-800">{tr(err)}</p>}
      {areas?.length === 0 && <p className="text-sm text-neutral-600">{tr("Бақылаудағы аймақ жоқ.")}</p>}
      <ul className="space-y-2">
        {areas?.map((a) => (
          <li key={a.id} className="rounded-md border border-neutral-200 p-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <button type="button" className="text-left font-medium" onClick={() => focusOn({ bbox: ringBbox(a.ring) })}>{a.name}</button>
              <span className="text-xs text-neutral-600">{a.area_km2.toFixed(2)} км²</span>
            </div>
            {!a.fire.available
              ? <p className="text-xs text-amber-800">{tr("FIRMS қолжетімсіз — жалған дерек көрсетілмейді.")} {a.fire.reason}</p>
              : <p className={a.fire.newSinceSeen ? "font-medium text-red-700" : "text-neutral-700"}>
                  {a.fire.newSinceSeen} {tr("жаңа")} · {a.fire.last7d} {tr("жылу нүктесі 7 күнде")}
                </p>}
            {a.complaints?.available && (
              <p className={a.complaints.newSinceSeen ? "font-medium text-[#5b21b6]" : "text-neutral-700"}>
                {a.complaints.newSinceSeen} {tr("жаңа")} · {a.complaints.last7d} {tr("тұрғын шағымы 7 күнде")}
              </p>
            )}
            <div className="mt-1 flex gap-1.5">
              <Button variant="portal-outline" size="portal" onClick={() => seen(a)}><Eye className="h-3.5 w-3.5" />{tr("Қарадым")}</Button>
              <Button variant="portal-outline" size="portal" onClick={() => remove(a)} aria-label={tr("Өшіру")}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
