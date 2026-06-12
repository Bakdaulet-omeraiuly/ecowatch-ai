"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, MapPin, Loader2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import dynamic from "next/dynamic";
import { useSitesStore } from "@/store/useSitesStore";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { Site } from "@/types/site";

const LocationPicker = dynamic(
  () => import("@/components/report/LocationPicker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <div className="h-64 rounded-lg bg-white/5" /> }
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

export default function ReportPage() {
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
      toast.error("Фотоны оқу мүмкін болмады");
    }
  };

  const locate = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(5));
        setLng(pos.coords.longitude.toFixed(5));
        setLocating(false);
        toast.success("Орналасу анықталды");
      },
      () => {
        setLocating(false);
        toast.error("GPS қолжетімсіз — координатты қолмен енгізіңіз");
      }
    );
  };

  const submit = async () => {
    const la = parseFloat(lat), ln = parseFloat(lng);
    if (!photo) return toast.error("Фото жүктеңіз");
    if (isNaN(la) || isNaN(ln)) return toast.error("Координаттарды енгізіңіз");
    setBusy(true);
    toast.info("AI фото мен спутник суретін салыстырып жатыр…");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "combined", lat: la, lng: ln, photo }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const site: Site = {
        id: `report-${Date.now()}`,
        lat: la,
        lng: ln,
        name: desc ? desc.slice(0, 60) : "Азаматтық хабарлама",
        district: "Атырау облысы",
        mode: "combined",
        analysis: data.analysis,
        mosquitoRiskIndex: mosquitoRiskIndex(la, ln, data.analysis.standingWater),
        imageUrl: data.imageUrl,
        photoThumb: photo,
        createdAt: new Date().toISOString(),
        flagged: data.analysis.riskScore >= 80,
      };
      addSite(site);
      toast.success(
        data.analysis.verificationStatus === "confirmed"
          ? "✅ Хабарлама спутникпен РАСТАЛДЫ!"
          : "Хабарлама қабылданды және талданды"
      );
      router.push("/map");
    } catch {
      toast.error("Жіберу сәтсіз. Қайталап көріңіз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Экологиялық мәселе туралы хабарлау</h1>
        <p className="text-sm text-neutral-400">
          Фото түсіріңіз — AI оны талдап, сол нүктенің спутник суретімен салыстырып растайды
        </p>
      </div>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📸 Фото</CardTitle></CardHeader>
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
              <img src={photo} alt="Жүктелген фото" className="max-h-64 w-full rounded-lg object-cover" />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
                  <ImageIcon className="mr-1 h-3.5 w-3.5" /> Галереядан
                </Button>
                <Button variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                  <Camera className="mr-1 h-3.5 w-3.5" /> Камера
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/15 p-6 text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <ImageIcon className="h-7 w-7" />
                <span className="text-xs">Галереядан таңдау</span>
              </button>
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-white/15 p-6 text-neutral-400 transition-colors hover:border-emerald-500/40 hover:text-emerald-300"
              >
                <Camera className="h-7 w-7" />
                <span className="text-xs">Камерадан түсіру</span>
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📍 Орналасу — картадан белгілеңіз</CardTitle></CardHeader>
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
              GPS арқылы анықтау
            </Button>
            <div className="flex-1 space-y-1">
              <Label htmlFor="lat" className="text-xs text-neutral-400">Ендік (lat)</Label>
              <Input id="lat" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="47.1167" />
            </div>
            <div className="flex-1 space-y-1">
              <Label htmlFor="lng" className="text-xs text-neutral-400">Бойлық (lng)</Label>
              <Input id="lng" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="51.9014" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader><CardTitle className="text-sm text-white">📝 Сипаттама (міндетті емес)</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Мысалы: өзен жағасында қоқыс үйіндісі, жанында тұрған су бар…"
            rows={3}
          />
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" onClick={submit} disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        {busy ? "AI талдап жатыр…" : "Жіберу және AI талдауын алу"}
      </Button>
    </div>
  );
}
