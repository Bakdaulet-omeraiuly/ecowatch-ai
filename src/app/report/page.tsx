"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, MapPin, Loader2, Image as ImageIcon, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";
import { useSitesStore } from "@/store/useSitesStore";
import type { Site } from "@/types/site";
import { REPORTS_ENABLED } from "@/lib/features";
import { FeatureUnavailable } from "@/components/FeatureUnavailable";

export default function ReportPage() {
  if (!REPORTS_ENABLED) return <FeatureUnavailable title="Азаматтық хабарлау" />;
  return <ReportPageInner />;
}

const LocationPicker = dynamic(
  () => import("@/components/report/LocationPicker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-white/5" /> }
);

const WasteDetector = dynamic(
  () => import("@/components/report/WasteDetector").then((m) => m.WasteDetector),
  { ssr: false }
);

// Resize photo client-side so the base64 payload stays small
function resizeImage(file: File, maxDim = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function ReportPageInner() {
  const { tr } = useLang();
  const router = useRouter();
  const addSite = useSitesStore((s) => s.addSite);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      setPhoto(await resizeImage(f));
    } catch {
      toast.error(tr("Фотоны оқу мүмкін болмады"));
    }
  };

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setLocating(false);
        toast.success(tr("Орналасу анықталды"));
      },
      () => {
        setLocating(false);
        toast.error(tr("GPS қолжетімсіз — координатты қолмен енгізіңіз"));
      }
    );
  };

  const submit = async () => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!photo) return toast.error(tr("Фото жүктеңіз"));
    if (isNaN(la) || isNaN(ln)) return toast.error(tr("Координаттарды енгізіңіз"));
    setBusy(true);
    toast.info(tr("AI фотоны тексеріп, спутникпен салыстырып жатыр…"));
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: la, lng: ln, photo, description: desc || undefined }),
      });
      const data = await res.json();

      // AI moderation rejected the photo
      if (res.status === 422) {
        toast.error(tr("Фото қабылданбады"), { description: data.reason });
        setBusy(false);
        return;
      }
      if (!res.ok) throw new Error(data.error || "");

      // Mirror to local store for instant display, then go to map
      const r = data.report;
      const site: Site = {
        id: r.id,
        lat: r.lat,
        lng: r.lng,
        name: r.name,
        district: r.district,
        mode: "combined",
        analysis: r.analysis,
        mosquitoRiskIndex: r.mosquito_index,
        imageUrl: r.image_url,
        photoThumb: r.photo_thumb,
        createdAt: r.created_at,
        flagged: r.risk_score >= 80,
      };
      addSite(site);
      toast.success(
        r.analysis?.verificationStatus === "confirmed"
          ? tr("✅ Хабарлама расталды және бәріне көрінеді!")
          : tr("Хабарлама қабылданды — бәріне көрінеді")
      );
      router.push("/map");
    } catch {
      toast.error(tr("Жіберу сәтсіз. Қайталап көріңіз."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{tr("Экологиялық мәселе туралы хабарлау")}</h1>
        <p className="text-sm text-neutral-400">
          {tr("Фото түсіріңіз — AI оны талдап, сол нүктенің спутник суретімен салыстырып растайды")}
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📸 {tr("Фото")}</CardTitle></CardHeader>
        <CardContent>
          {/* Gallery: no capture attr → opens photo library / file picker */}
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {/* Camera: capture attr → opens the camera directly on mobile */}
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {photo ? (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={tr("Жүктелген фото")} className="max-h-64 w-full rounded-lg object-cover" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                  <ImageIcon className="mr-1 h-3.5 w-3.5" /> {tr("Галереядан")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                  <Camera className="mr-1 h-3.5 w-3.5" /> {tr("Камера")}
                </Button>
              </div>
              <WasteDetector photo={photo} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/15 p-6 text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <ImageIcon className="h-7 w-7" />
                <span className="text-xs">{tr("Галереядан таңдау")}</span>
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/15 p-6 text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <Camera className="h-7 w-7" />
                <span className="text-xs">{tr("Камерадан түсіру")}</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📍 {tr("Орналасу — картадан белгілеңіз")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <LocationPicker
            lat={parseFloat(lat) || null}
            lng={parseFloat(lng) || null}
            onPick={(la, ln) => {
              setLat(la.toFixed(5));
              setLng(ln.toFixed(5));
            }}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" size="sm" onClick={locate} disabled={locating}>
              {locating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MapPin className="mr-1 h-4 w-4" />}
              {tr("GPS арқылы анықтау")}
            </Button>
            <div className="flex-1 space-y-1">
              <Label htmlFor="lat" className="text-xs text-neutral-400">{tr("Ендік (lat)")}</Label>
              <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="47.1167" />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="lng" className="text-xs text-neutral-400">{tr("Бойлық (lng)")}</Label>
              <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="51.9014" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📝 {tr("Сипаттама (міндетті емес)")}</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder={tr("Мысалы: өзен жағасында қоқыс үйіндісі, жанында тұрған су бар…")}
            rows={3}
          />
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        {busy ? tr("AI талдап жатыр…") : tr("Жіберу және AI талдауын алу")}
      </Button>

      <Leaderboard />
    </div>
  );
}

interface ReportRow {
  id: string;
  name: string;
  risk_score: number;
  verification_status: string | null;
  created_at: string;
}

function Leaderboard() {
  const { tr } = useLang();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setReports(d.reports ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (reports.length === 0) return null;

  // Leaderboard: count reports per submitter name, sum confirmed
  const byName = new Map<string, { count: number; confirmed: number; maxRisk: number }>();
  reports.forEach((r) => {
    const n = r.name || "Атымыз белгісіз";
    if (!byName.has(n)) byName.set(n, { count: 0, confirmed: 0, maxRisk: 0 });
    const e = byName.get(n)!;
    e.count++;
    if (r.verification_status === "confirmed") e.confirmed++;
    if (r.risk_score > e.maxRisk) e.maxRisk = r.risk_score;
  });
  const ranked = [...byName.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.confirmed * 2 + b.count - (a.confirmed * 2 + a.count))
    .slice(0, 10);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <Card className="border-amber-500/20 bg-amber-500/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <Trophy className="h-4 w-4 text-amber-400" />
          {tr("Азамат белсенділерінің лидерборды")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {ranked.map((r, i) => (
            <div key={r.name} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
              <span className="text-base">{medals[i] ?? `${i + 1}.`}</span>
              <div className="flex-1 truncate">
                <div className="truncate text-sm text-white">{r.name.slice(0, 50)}</div>
                <div className="text-[13px] text-neutral-400">
                  {r.count} {tr("хабарлама")} · {r.confirmed} {tr("расталған")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-amber-300">+{r.confirmed * 10 + r.count * 2} XP</div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13px] text-neutral-400">
          {tr("XP = расталған хабарлама × 10 + барлық хабарлама × 2. Лидерборд нақты уақытта жаңарады.")}
        </p>
      </CardContent>
    </Card>
  );
}
