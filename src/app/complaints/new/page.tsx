"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLang } from "@/lib/i18n";
import { supabase } from "@/lib/supabase";
import { authHeaders } from "@/lib/authClient";
import { COMPLAINT_CATEGORIES, COMPLAINT_ERRORS, MAX_MEDIA_BYTES, type ComplaintCategory } from "@/lib/complaints";
import { ComplaintBadge, ComplaintStatusBadge } from "@/components/ui/ComplaintBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const LocationPicker = dynamic(() => import("@/components/report/LocationPicker").then((mod) => mod.LocationPicker), { ssr: false });

function localNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

async function photoBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image encoding failed")), "image/jpeg", 0.85));
  } finally { URL.revokeObjectURL(url); }
}

export default function Page() {
  const { t, tr } = useLang();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [category, setCategory] = useState<ComplaintCategory>("smell");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [eventAt, setEventAt] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<Blob | null>(null);
  const [mediaName, setMediaName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<"complaints.gpsError" | "complaints.mediaError" | "complaints.noData" | null>(null);
  const [result, setResult] = useState<{ duplicates: number | null } | null>(null);
  const mediaVersion = useRef(0);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setEventAt((value) => value || localNow());
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const pick = (latitude: number, longitude: number) => { setLat(String(latitude)); setLng(String(longitude)); };
  const gps = () => {
    setLocalError(null);
    if (!navigator.geolocation) { setLocalError("complaints.gpsError"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => { pick(coords.latitude, coords.longitude); setLocating(false); },
      () => { setLocalError("complaints.gpsError"); setLocating(false); }, { timeout: 15000 });
  };

  const selectMedia = async (file: File | undefined, photo: boolean) => {
    if (!file) return;
    const version = ++mediaVersion.current;
    setMedia(null); setMediaName(""); setError(null); setLocalError(null); setProcessing(true);
    try {
      if (!photo && file.size > MAX_MEDIA_BYTES) { setError(COMPLAINT_ERRORS.tooLarge); return; }
      const blob = photo ? await photoBlob(file) : file;
      if (version !== mediaVersion.current) return;
      if (blob.size > MAX_MEDIA_BYTES) { setError(COMPLAINT_ERRORS.tooLarge); return; }
      setMedia(blob); setMediaName(photo ? "photo.jpg" : file.name);
    } catch { if (version === mediaVersion.current) setLocalError("complaints.mediaError"); }
    finally { if (version === mediaVersion.current) setProcessing(false); }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(null); setLocalError(null);
    try {
      const form = new FormData();
      for (const [key, value] of Object.entries({ category, lat, lng, event_at: new Date(eventAt).toISOString(), description })) form.set(key, value);
      if (media) form.set("media", media, mediaName);
      const response = await fetch("/api/complaints", { method: "POST", headers: await authHeaders(), body: form });
      const body = await response.json();
      if (!response.ok) { setError(body.error ?? ""); if (response.status === 401) setSignedIn(false); return; }
      setResult({ duplicates: typeof body.duplicates === "number" ? body.duplicates : null });
    } catch { setLocalError("complaints.noData"); } finally { setBusy(false); }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 text-neutral-900 sm:py-12">
      <Link className="inline-flex min-h-[44px] items-center text-brand underline" href="/complaints">{t("complaints.back")}</Link>
      <h1 className="text-2xl font-semibold">{t("complaints.new")}</h1>
      <ComplaintBadge />
      <p className="text-sm text-neutral-600">{t("complaints.privacy")}</p>
      {error !== null && <p role="alert">{error ? tr(error) : t("complaints.noData")}</p>}
      {localError && <p role="alert">{t(localError)}</p>}
      {!supabase ? <p role="status">{t("complaints.noData")}</p> : signedIn === null ? <p role="status">{t("complaints.loading")}</p> : !signedIn ? (
        <Link className="inline-flex min-h-[44px] items-center text-brand underline" href="/auth">{t("complaints.signIn")}</Link>
      ) : result ? (
        <div className="space-y-4" role="status">
          <ComplaintStatusBadge status="submitted" />
          <p>{t("complaints.success")}</p>
          {result.duplicates === null ? <p>{t("complaints.duplicatesUnknown")}</p> : result.duplicates > 0 && <p>{t("complaints.duplicates")} {result.duplicates}</p>}
          <Link className="inline-flex min-h-[44px] items-center text-brand underline" href="/complaints/mine">{t("complaints.mine")}</Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={submit}>
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="mb-2 font-medium">{t("complaints.category")}</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{COMPLAINT_CATEGORIES.map((value) => (
              <Button key={value} type="button" aria-pressed={category === value} variant="outline"
                className={`min-h-[44px] whitespace-normal ${category === value ? "border-brand bg-brand text-white hover:bg-brand/90 hover:text-white" : "border-neutral-300"}`}
                onClick={() => setCategory(value)}>{t(`complaints.category.${value}`)}</Button>
            ))}</div>
          </fieldset>
          <fieldset className="space-y-3" disabled={busy}>
            <legend className="mb-2 font-medium">{t("complaints.location")}</legend>
            {process.env.NEXT_PUBLIC_MAPBOX_TOKEN ? <LocationPicker lat={lat && Number.isFinite(Number(lat)) ? Number(lat) : null} lng={lng && Number.isFinite(Number(lng)) ? Number(lng) : null} onPick={pick}
              labels={{ unavailable: t("complaints.mapUnavailable"), pick: t("complaints.pickLocation"), selected: t("complaints.selectedLocation") }} /> : <p className="text-sm text-neutral-600">{t("complaints.mapUnavailable")}</p>}
            <Button className="min-h-[44px]" type="button" variant="outline" disabled={locating} onClick={gps}>{t(locating ? "complaints.loading" : "complaints.gps")}</Button>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="lat">{t("complaints.latitude")}</Label><Input className="min-h-[44px]" id="lat" type="number" step="any" min={46} max={49} required value={lat} onChange={(event) => setLat(event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="lng">{t("complaints.longitude")}</Label><Input className="min-h-[44px]" id="lng" type="number" step="any" min={49} max={54.5} required value={lng} onChange={(event) => setLng(event.target.value)} /></div>
            </div>
          </fieldset>
          <div className="space-y-2"><Label htmlFor="eventAt">{t("complaints.eventAt")}</Label><Input className="min-h-[44px]" id="eventAt" type="datetime-local" required value={eventAt} onChange={(event) => setEventAt(event.target.value)} /><p className="text-sm text-neutral-600">{t("complaints.localTime")}</p></div>
          <div className="space-y-2"><Label htmlFor="description">{t("complaints.description")}</Label><Textarea className="min-h-32" id="description" required maxLength={1000} value={description} onChange={(event) => setDescription(event.target.value)} /><p className="text-sm text-neutral-600">{t("complaints.descriptionHint")}</p></div>
          <fieldset className="space-y-3" disabled={busy || processing}>
            <legend className="mb-2 font-medium">{t("complaints.media")}</legend>
            <div className="space-y-2"><Label htmlFor="photo">{t("complaints.photo")}</Label><Input className="min-h-[44px] max-w-full" id="photo" type="file" accept="image/*" onChange={(event) => { void selectMedia(event.target.files?.[0], true); event.target.value = ""; }} /></div>
            <div className="space-y-2"><Label htmlFor="video">{t("complaints.video")}</Label><Input className="min-h-[44px] max-w-full" id="video" type="file" accept="video/mp4,video/quicktime" onChange={(event) => { void selectMedia(event.target.files?.[0], false); event.target.value = ""; }} /></div>
            <p className="text-sm text-neutral-600">{t("complaints.mediaHint")}</p>
          </fieldset>
          {processing && <p role="status">{t("complaints.loading")}</p>}
          {media && <div className="flex flex-wrap items-center gap-2"><span className="break-all text-sm">{mediaName}</span><Button className="min-h-[44px]" type="button" variant="outline" onClick={() => { mediaVersion.current++; setMedia(null); setMediaName(""); }}>{t("complaints.removeMedia")}</Button></div>}
          <Button className="min-h-[44px] w-full bg-brand text-white hover:bg-brand/90" type="submit" disabled={busy || processing || !description.trim()}>{t(busy ? "complaints.sending" : "complaints.new")}</Button>
        </form>
      )}
    </main>
  );
}
