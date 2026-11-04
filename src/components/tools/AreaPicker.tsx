"use client";

import { useRef } from "react";
import { Pencil, Upload, Trash2, Check, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { useMapToolsStore } from "@/store/useMapToolsStore";
import { parseAreaFile, ringBbox, ringToFeature, validateRing } from "@/lib/areaGeo";

// Полигон таңдау: картада сызу немесе GeoJSON/KML жүктеу (GFW үлгісі).
// Тексеру сервермен бірдей (validateRing).
export function AreaPicker() {
  const { tr } = useLang();
  const { ring, pick, setPick, setRing, focusOn } = useMapToolsStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const drawing = pick === "polygon";
  const check = ring.length >= 3 ? validateRing(ring) : null;

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) { toast.error(tr("Файл 2 МБ-тан аспауы керек")); return; }
    const r = parseAreaFile(f.name, await f.text());
    if (!r) { toast.error(tr("Файлдан полигон табылмады (GeoJSON немесе KML керек)")); return; }
    setPick("none");
    setRing(r);
    focusOn({ bbox: ringBbox(r) });
  };

  const downloadGeoJson = () => {
    if (!check?.ok) return;
    const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: [ringToFeature(check.ring, { areaKm2: +check.areaKm2.toFixed(4), source: "ecojaiyq.com" })] })], { type: "application/geo+json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jaiyq-area-${new Date().toISOString().slice(0, 10)}.geojson`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-2 rounded-lg border border-neutral-200 p-3">
      <div className="flex flex-wrap gap-1.5">
        <Button variant="portal-outline" size="portal" aria-pressed={drawing}
          onClick={() => { if (!drawing) setRing([]); setPick(drawing ? "none" : "polygon"); }}>
          {drawing ? <Check className="h-4 w-4" aria-hidden /> : <Pencil className="h-4 w-4" aria-hidden />}
          {drawing ? tr("Сызуды аяқтау") : tr("Картада сызу")}
        </Button>
        <Button variant="portal-outline" size="portal" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden />{tr("GeoJSON/KML жүктеу")}
        </Button>
        <input ref={fileRef} type="file" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" className="hidden"
          onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        {ring.length > 0 && (
          <Button variant="portal-outline" size="portal" onClick={() => { setRing([]); setPick("none"); }}>
            <Trash2 className="h-4 w-4" aria-hidden />{tr("Тазалау")}
          </Button>
        )}
        {check?.ok && (
          <Button variant="portal-outline" size="portal" onClick={downloadGeoJson}>
            <Download className="h-4 w-4" aria-hidden />GeoJSON
          </Button>
        )}
      </div>
      <p className="text-xs text-neutral-600" aria-live="polite">
        {drawing && ring.length < 3 && tr("Картаны басып, төбелерді қосыңыз (кемінде 3).")}
        {ring.length > 0 && <> {tr("Төбелер")}: {ring.length}</>}
        {check?.ok && <> · {tr("Аудан")}: {check.areaKm2 < 1 ? `${(check.areaKm2 * 100).toFixed(2)} ${tr("га")}` : `${check.areaKm2.toFixed(2)} км²`}</>}
        {check && !check.ok && <span className="text-red-700"> · {tr(check.error)}</span>}
      </p>
    </div>
  );
}

/** Ағымдағы жарамды полигон немесе null */
export function useValidRing() {
  const ring = useMapToolsStore((s) => s.ring);
  if (ring.length < 3) return null;
  const c = validateRing(ring);
  return c.ok ? c : null;
}
