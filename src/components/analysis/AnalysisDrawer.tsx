"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { X, Flag, CheckCircle2, AlertTriangle, XCircle, Bug, RefreshCw, Trash2, Maximize2, Sparkles } from "lucide-react";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { Site } from "@/types/site";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import { RiskGauge } from "./RiskGauge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSitesStore } from "@/store/useSitesStore";

const verificationUi = {
  confirmed: { icon: CheckCircle2, label: "Расталды", cls: "text-emerald-400 bg-emerald-500/10" },
  unconfirmed: { icon: AlertTriangle, label: "Расталмады", cls: "text-yellow-400 bg-yellow-500/10" },
  contradicted: { icon: XCircle, label: "Қайшы келеді", cls: "text-red-400 bg-red-500/10" },
};

export function AnalysisDrawer({
  site,
  onClose,
  onUpdate,
}: {
  site: Site | null;
  onClose: () => void;
  onUpdate?: (site: Site) => void;
}) {
  const toggleFlag = useSitesStore((s) => s.toggleFlag);
  const updateSite = useSitesStore((s) => s.updateSite);
  const removeSite = useSitesStore((s) => s.removeSite);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);

  const remove = () => {
    if (!site) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    removeSite(site);
    toast.success("Нүкте өшірілді");
    onClose();
  };

  const refresh = async () => {
    if (!site || refreshing) return;
    setRefreshing(true);
    toast.info("Соңғы спутник деректері бойынша қайта талданып жатыр…");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "satellite",
          lat: site.lat,
          lng: site.lng,
          imageryYear: site.imageryYear ?? null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const updated: Site = {
        ...site,
        mode: "satellite",
        analysis: data.analysis,
        mosquitoRiskIndex: mosquitoRiskIndex(site.lat, site.lng, data.analysis.standingWater),
        imageUrl: data.imageUrl,
        createdAt: new Date().toISOString(),
        isSeed: false,
      };
      updateSite(updated);
      onUpdate?.(updated);
      toast.success("Деректер жаңартылды!");
    } catch {
      toast.error("Жаңарту сәтсіз аяқталды. Қайталап көріңіз.");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <AnimatePresence>
      {site && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="fixed right-0 top-14 z-40 flex h-[calc(100vh-3.5rem)] w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-neutral-950/95 backdrop-blur"
        >
          <div className="flex items-start justify-between p-4">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                {site.name ?? "Талданған нүкте"}
                {site.imageryYear && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-normal text-amber-300">
                    {site.imageryYear} жыл
                  </span>
                )}
              </h2>
              <p className="text-xs text-neutral-400">
                {site.district} · {site.lat.toFixed(4)}, {site.lng.toFixed(4)}
              </p>
              <p className="text-[10px] text-neutral-500">
                Соңғы талдау: {new Date(site.createdAt).toLocaleString("kk-KZ")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={remove}
                title={confirmDelete ? "Растау үшін тағы басыңыз" : "Нүктені өшіру"}
                className={`rounded-md p-1.5 transition-colors ${
                  confirmDelete
                    ? "bg-red-500/20 text-red-300"
                    : "text-neutral-400 hover:bg-red-500/15 hover:text-red-300"
                }`}
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <button
                onClick={refresh}
                disabled={refreshing}
                title="Соңғы деректермен жаңарту"
                className="rounded-md p-1.5 text-neutral-400 transition-colors hover:bg-emerald-500/15 hover:text-emerald-300 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <button onClick={onClose} className="rounded-md p-1 text-neutral-400 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Citizen photo first (it's the subject of a report), satellite below */}
          {site.photoThumb && (
            <div
              role="button"
              onClick={() => setLightbox({ url: site.photoThumb!, label: "📸 Азамат фотосы" })}
              className="group relative mx-4 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-white/10"
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.photoThumb} alt="Азамат фотосы" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                📸 Азамат фотосы
              </span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" /> Үлкейту
              </span>
            </div>
          )}
          {site.imageUrl && (
            <div
              role="button"
              onClick={() =>
                setLightbox({
                  url: site.imageUrl!,
                  label: site.imageryYear ? `🛰 Sentinel-2, ${site.imageryYear} жыл` : "🛰 Спутник көрінісі",
                })
              }
              className={`group relative mx-4 shrink-0 ${site.photoThumb ? "mt-2" : ""} cursor-pointer overflow-hidden rounded-lg border border-white/10`}
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.imageUrl} alt="Спутник суреті" className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                🛰 {site.imageryYear ? `Sentinel-2, ${site.imageryYear} жыл` : "Спутник көрінісі (қазіргі)"}
              </span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" /> Үлкейту
              </span>
            </div>
          )}

          <div className="flex items-center gap-5 p-4">
            <RiskGauge score={site.analysis.riskScore} />
            <div className="space-y-2">
              <Badge
                style={{ backgroundColor: `${RISK_COLORS[site.analysis.riskLevel]}22`, color: RISK_COLORS[site.analysis.riskLevel] }}
              >
                {RISK_LABELS_KZ[site.analysis.riskLevel]} тәуекел
              </Badge>
              <p className="text-xs text-neutral-400">Сенімділік: {site.analysis.confidence}%</p>
              {site.analysis.verificationStatus && (() => {
                const v = verificationUi[site.analysis.verificationStatus];
                const Icon = v.icon;
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${v.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {v.label}
                  </span>
                );
              })()}
              <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                <Bug className="h-3.5 w-3.5 text-purple-400" />
                Маса индексі: <b>{site.mosquitoRiskIndex}</b>/100
              </div>
            </div>
          </div>

          <Separator className="bg-white/10" />

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Indicator on={site.analysis.oilPollution} label="🛢 Мұнай ластануы" />
              <Indicator on={site.analysis.illegalDumping} label="🗑 Заңсыз қоқыс" />
              <Indicator on={site.analysis.landDegradation} label="🏜 Жер деградациясы" />
              <Indicator on={site.analysis.standingWater} label="💧 Тұрған су" />
            </div>

            <div>
              <h3 className="mb-1.5 text-sm font-medium text-white">Анықталған белгілер</h3>
              <ul className="space-y-1">
                {site.analysis.detectedFeatures.map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs text-neutral-300">
                    <span className="text-emerald-400">•</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg bg-white/5 p-3 text-xs text-neutral-300">{site.analysis.summary}</div>

            {site.analysis.isAgent && site.analysis.agentSources && (
              <div className="space-y-2 rounded-lg border border-violet-500/25 bg-violet-500/5 p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                  <Sparkles className="h-3.5 w-3.5" /> AI агент — көп дереккөзді талдау
                </h3>
                <p className="text-[11px] text-neutral-400">
                  Тек спутникке емес, тірі ресми деректерге де сүйенді:
                </p>
                {site.analysis.agentSources.map((s, i) => (
                  <div key={i} className="rounded-md bg-neutral-900/60 p-2 text-[11px]">
                    <b className="text-violet-200">{s.source}</b>
                    <div className="text-neutral-300">{s.finding}</div>
                  </div>
                ))}
              </div>
            )}

            {site.analysis.science && (
              <div className="space-y-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-sky-300">
                  🔬 Ғылыми сараптама
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-normal text-neutral-400">
                    RGB прокси-бағалау
                  </span>
                </h3>

                {/* Spectral indices */}
                <div className="space-y-1.5">
                  <IndexBar label="NDVI · өсімдік" value={site.analysis.science.ndvi} color="#22c55e" />
                  <IndexBar label="NDBI · техногендік" value={site.analysis.science.ndbi} color="#f97316" />
                  <IndexBar label="NDWI · су" value={site.analysis.science.ndwi} color="#38bdf8" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-neutral-500">Ластанған аумақ</div>
                    <div className="font-semibold text-white">
                      ≈ {site.analysis.science.areaM2.toLocaleString("kk-KZ")} м²
                    </div>
                  </div>
                  <div className="rounded bg-white/5 p-2">
                    <div className="text-neutral-500">Жақын инфрақұрылым</div>
                    <div className="text-neutral-300">
                      {site.analysis.science.nearbyInfrastructure.join(", ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-neutral-400">
                  <b className="text-neutral-300">Динамика:</b> {site.analysis.science.changeDynamics}
                </div>
                <div className="text-[11px] text-neutral-400">
                  <b className="text-neutral-300">Текстура:</b> {site.analysis.science.textureNote}
                </div>

                {/* Evidence-based reasoning */}
                {site.analysis.science.evidence.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold text-white">Себеп-салдар талдауы</h4>
                    {site.analysis.science.evidence.map((e, i) => (
                      <div key={i} className="rounded-md border border-white/10 bg-neutral-900/60 p-2.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <b className="text-white">⚠ {e.sign}</b>
                          <span className="text-neutral-500">сенімділік {e.confidence}%</span>
                        </div>
                        <div className="mt-1 text-neutral-300">
                          <span className="text-sky-400">Дәлел:</span> {e.evidence}
                        </div>
                        <div className="mt-0.5 text-neutral-300">
                          <span className="text-orange-400">Болжам:</span> {e.prediction}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <h3 className="mb-1 text-xs font-medium text-emerald-300">Ұсыныс</h3>
              <p className="text-xs text-neutral-300">{site.analysis.recommendation}</p>
            </div>

            {site.analysis.verificationNotes && (
              <p className="text-xs italic text-neutral-400">{site.analysis.verificationNotes}</p>
            )}

            <div className="flex gap-2 pb-4">
              <Button
                size="sm"
                variant={site.flagged ? "secondary" : "default"}
                className="flex-1"
                onClick={() => toggleFlag(site.id)}
              >
                <Flag className="mr-1 h-3.5 w-3.5" />
                {site.flagged ? "Белгіленген" : "Тексеруге белгілеу"}
              </Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => window.print()}>
                PDF экспорт
              </Button>
            </div>
          </div>
        </motion.aside>
      )}

      {/* Fullscreen image lightbox */}
      {lightbox && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4 backdrop-blur"
        >
          <div className="mb-3 flex w-full max-w-4xl items-center justify-between text-sm text-white">
            <span>{lightbox.label}</span>
            <button onClick={() => setLightbox(null)} className="rounded-md p-1 hover:bg-white/10">
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-4xl rounded-lg object-contain shadow-2xl"
          />
          <p className="mt-3 text-xs text-neutral-500">Жабу үшін кез келген жерді басыңыз</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function IndexBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-[10px] text-neutral-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, backgroundColor: color }} />
      </div>
      <span className="w-8 text-right text-[10px] font-semibold text-white">{value.toFixed(2)}</span>
    </div>
  );
}

function Indicator({ on, label }: { on: boolean; label: string }) {
  return (
    <div
      className={`rounded-md px-2 py-1.5 ${on ? "bg-red-500/10 text-red-300" : "bg-white/5 text-neutral-500"}`}
    >
      {label}: {on ? "Иә" : "Жоқ"}
    </div>
  );
}
