"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { X, Flag, CheckCircle2, AlertTriangle, XCircle, Bug, RefreshCw, Trash2, Maximize2, Sparkles, Send, MapPin, History } from "lucide-react";
import { mosquitoRiskIndex } from "@/lib/mosquito";
import type { Site } from "@/types/site";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import { RiskGauge } from "./RiskGauge";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSitesStore } from "@/store/useSitesStore";
import { useLang } from "@/lib/i18n";

interface MlIndicesResult {
  ndvi: number; ndwi: number; ndmi: number; ndbi: number;
  from: string; to: string; source: string;
  interpretation: { veg: string; water: string; moist: string; built: string };
}

const verificationUi = {
  confirmed: { icon: CheckCircle2, label: "Расталды", cls: "text-emerald-800 bg-emerald-50" },
  unconfirmed: { icon: AlertTriangle, label: "Расталмады", cls: "text-amber-800 bg-amber-50" },
  contradicted: { icon: XCircle, label: "Қайшы келеді", cls: "text-red-800 bg-red-50" },
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
  const { lang, tr } = useLang();
  const toggleFlag = useSitesStore((s) => s.toggleFlag);
  const updateSite = useSitesStore((s) => s.updateSite);
  const removeSite = useSitesStore((s) => s.removeSite);
  const hideReport = useSitesStore((s) => s.hideReport);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; label: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  // Деректерге негізделген нақты ұсыныстар (ML индекстер + LLM нәтижесіне сүйенеді)
  const [recs, setRecs] = useState<string[] | null>(null);
  const [recsState, setRecsState] = useState<"idle" | "loading" | "error">("idle");
  // Сақталған талдауды таңдалған тілге жедел аудару (тіл ≠ талдау тілі болғанда)
  const [tx, setTx] = useState<{ summary?: string; features?: string[]; changeDynamics?: string; textureNote?: string; agentFindings?: string[] } | null>(null);
  useEffect(() => {
    const src = site?.analysisLang ?? "kk";
    if (!site || lang === src) { setTx(null); return; }
    const a = site.analysis;
    const fLen = a.detectedFeatures.length;
    const texts = [a.summary, ...a.detectedFeatures];
    const sciAt = texts.length;
    if (a.science) texts.push(a.science.changeDynamics, a.science.textureNote);
    const agAt = texts.length;
    const findings = a.agentSources?.map((s) => s.finding) ?? [];
    texts.push(...findings);
    const ctrl = new AbortController();
    fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
      body: JSON.stringify({ texts: texts.slice(0, 40), lang }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const t: string[] = d.texts;
        setTx({
          summary: t[0],
          features: t.slice(1, 1 + fLen),
          changeDynamics: a.science ? t[sciAt] : undefined,
          textureNote: a.science ? t[sciAt + 1] : undefined,
          agentFindings: findings.length ? t.slice(agAt, agAt + findings.length) : undefined,
        });
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [site?.id, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Нақты ML спектрлік индекстер (Sentinel-2 Statistical API)
  const [indices, setIndices] = useState<MlIndicesResult | null>(null);
  const [indicesState, setIndicesState] = useState<"idle" | "loading" | "error">("idle");
  useEffect(() => {
    setSent(false);
    setRecs(null);
    if (!site) { setIndices(null); setIndicesState("idle"); return; }
    setIndices(null);
    setIndicesState("loading");
    const ctrl = new AbortController();
    fetch("/api/indices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: site.lat, lng: site.lng, lang }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setIndices(d); setIndicesState("idle"); })
      .catch(() => { if (!ctrl.signal.aborted) setIndicesState("error"); });
    return () => ctrl.abort();
  }, [site?.id, site?.lat, site?.lng, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // Индекстер шешілгенде (сәтті/қате) деректерге негізделген ұсыныс сұрау
  useEffect(() => {
    if (!site || indicesState === "loading") return;
    setRecsState("loading");
    const ctrl = new AbortController();
    fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        lat: site.lat, lng: site.lng, lang,
        riskScore: site.analysis.riskScore, riskLevel: site.analysis.riskLevel,
        detectedFeatures: site.analysis.detectedFeatures,
        oilPollution: site.analysis.oilPollution,
        illegalDumping: site.analysis.illegalDumping,
        landDegradation: site.analysis.landDegradation,
        standingWater: site.analysis.standingWater,
        mosquitoRiskIndex: site.mosquitoRiskIndex,
        areaKm2: site.areaKm2,
        summary: site.analysis.summary,
        indices: indices ? { ndvi: indices.ndvi, ndwi: indices.ndwi, ndmi: indices.ndmi, ndbi: indices.ndbi } : null,
      }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setRecs(d.recommendations ?? null); setRecsState("idle"); })
      .catch(() => { if (!ctrl.signal.aborted) setRecsState("error"); });
    return () => ctrl.abort();
  }, [site?.id, indicesState, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const sendToAuthority = async () => {
    if (!site || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: site.lat,
          lng: site.lng,
          riskScore: site.analysis.riskScore,
          riskLevel: site.analysis.riskLevel,
          summary: site.analysis.summary,
          features: site.analysis.detectedFeatures,
          areaKm2: site.areaKm2,
        }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
      toast.success(tr("Тиісті органға (модераторға) жіберілді"));
    } catch {
      toast.error(tr("Жіберу мүмкін болмады (Telegram бапталмаған болуы мүмкін)"));
    } finally {
      setSending(false);
    }
  };

  const remove = () => {
    if (!site) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    removeSite(site);
    hideReport(site.id);
    toast.success(tr("Нүкте өшірілді"));
    onClose();
  };

  const refresh = async () => {
    if (!site || refreshing) return;
    setRefreshing(true);
    toast.info(tr("Соңғы спутник деректері бойынша қайта талданып жатыр…"));
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "satellite",
          lat: site.lat,
          lng: site.lng,
          imageryYear: site.imageryYear ?? null,
          lang,
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
        analysisLang: lang,
        isSeed: false,
      };
      updateSite(updated);
      onUpdate?.(updated);
      toast.success(tr("Деректер жаңартылды!"));
    } catch {
      toast.error(tr("Жаңарту сәтсіз аяқталды. Қайталап көріңіз."));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      {site && (
        <Panel className="flex min-w-0 flex-col border-0">
          <PanelHeader
            title={site.areaKm2 ? tr("Талданған аумақ") : site.name ? tr(site.name) : tr("Талданған нүкте")}
            description={<>
              <p>{tr(site.district)} · {site.lat.toFixed(4)}, {site.lng.toFixed(4)}</p>
              {site.imageryYear && <p>{site.imageryYear} {tr("жыл")}</p>}
              {site.areaKm2 != null && <p>{site.areaKm2.toFixed(2)} км²</p>}
              <p>{tr("Соңғы талдау")}: {new Date(site.createdAt).toLocaleString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "kk-KZ")}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button variant="portal-outline" size="portal-icon" onClick={remove} aria-label={tr(confirmDelete ? "Растау үшін тағы басыңыз" : "Нүктені өшіру")}><Trash2 className={confirmDelete ? "text-red-800" : ""} /></Button>
                <Button variant="portal-outline" size="portal-icon" onClick={refresh} disabled={refreshing} aria-label={tr("Соңғы деректермен жаңарту")}><RefreshCw className={refreshing ? "animate-spin" : ""} /></Button>
              </div>
            </>}
            actions={<Button variant="portal-outline" size="portal-icon" onClick={onClose} aria-label={tr("Жабу")}><X /></Button>}
          />

          {/* Citizen photo first (it's the subject of a report), satellite below */}
          {site.photoThumb && (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
              onClick={() => setLightbox({ url: site.photoThumb!, label: `${tr("Азамат фотосы")}` })}
              className="group relative mx-4 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-neutral-300"
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.photoThumb} alt={tr("Азамат фотосы")} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[12px] text-white">
                {tr("Азамат фотосы")}
              </span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" /> {tr("Үлкейту")}
              </span>
            </div>
          )}
          {site.imageUrl && (
            <div
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } }}
              onClick={() =>
                setLightbox({
                  url: site.imageUrl!,
                  label: site.imageryYear ? `Sentinel-2, ${site.imageryYear} ${tr("жыл")}` : `${tr("Спутник көрінісі")}`,
                })
              }
              className={`group relative mx-4 shrink-0 ${site.photoThumb ? "mt-2" : ""} cursor-pointer overflow-hidden rounded-lg border border-neutral-300`}
              style={{ aspectRatio: "16 / 9" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={site.imageUrl} alt={tr("Спутник суреті")} className="absolute inset-0 h-full w-full object-cover" />
              <span className="absolute left-2 top-2 rounded bg-black/75 px-1.5 py-0.5 text-[12px] text-white">
                {site.imageryYear ? `Sentinel-2, ${site.imageryYear} ${tr("жыл")}` : tr("Спутник көрінісі (қазіргі)")}
              </span>
              <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-[12px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <Maximize2 className="h-3 w-3" /> {tr("Үлкейту")}
              </span>
            </div>
          )}

          <div className="flex items-center gap-5 p-4">
            <RiskGauge score={site.analysis.riskScore} />
            <div className="space-y-2">
              <Badge
                style={{ backgroundColor: `${RISK_COLORS[site.analysis.riskLevel]}22`, color: "#1f2933" }}
              >
                {tr(RISK_LABELS_KZ[site.analysis.riskLevel])} {tr("тәуекел")}
              </Badge>
              <p className="text-xs text-neutral-600">{tr("Сенімділік")}: {site.analysis.confidence}%</p>
              {site.analysis.verificationStatus && (() => {
                const v = verificationUi[site.analysis.verificationStatus];
                const Icon = v.icon;
                return (
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${v.cls}`}>
                    <Icon className="h-3.5 w-3.5" /> {tr(v.label)}
                  </span>
                );
              })()}
              <div className="flex items-center gap-1.5 text-xs text-neutral-800">
                <Bug className="h-3.5 w-3.5 text-violet-800" />
                {tr("Маса индексі")}: <b>{site.mosquitoRiskIndex}</b>/100
              </div>
            </div>
          </div>

          <Separator className="bg-neutral-50" />

          <div className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Indicator on={site.analysis.oilPollution} label={tr("Мұнай ластануы")} />
              <Indicator on={site.analysis.illegalDumping} label={tr("Заңсыз қоқыс")} />
              <Indicator on={site.analysis.landDegradation} label={tr("Жер деградациясы")} />
              <Indicator on={site.analysis.standingWater} label={tr("Тұрған су")} />
            </div>

            <div>
              <h3 className="mb-1.5 text-sm font-medium text-neutral-900">{tr("Анықталған белгілер")}</h3>
              <ul className="space-y-1">
                {(tx?.features ?? site.analysis.detectedFeatures).map((f, i) => (
                  <li key={i} className="flex gap-2 text-xs text-neutral-800">
                    <span className="text-emerald-800">•</span> {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* ML спектрлік талдау (Sentinel-2, нақты есептелген) */}
            <div className="rounded-lg border border-neutral-300 bg-white p-3 border-l-4 border-l-sky-700">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-800">
                {tr("ML спектрлік талдау")}
                <span className="rounded bg-sky-50 px-1 py-px text-[12px] uppercase text-sky-800">{tr("Sentinel-2 · 10м")}</span>
              </h3>
              {indicesState === "loading" ? (
                <p className="text-[13px] text-neutral-600">{tr("Спутник деректері есептелуде…")}</p>
              ) : indices ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <MlBar label={tr("NDVI · өсімдік")} value={indices.ndvi} min={-0.2} max={0.9} color="#22c55e" note={indices.interpretation.veg} />
                    <MlBar label={tr("NDWI · су")} value={indices.ndwi} min={-0.5} max={0.6} color="#38bdf8" note={indices.interpretation.water} />
                    <MlBar label={tr("NDMI · ылғал")} value={indices.ndmi} min={-0.5} max={0.6} color="#06b6d4" note={indices.interpretation.moist} />
                    <MlBar label={tr("NDBI · құрылыс")} value={indices.ndbi} min={-0.4} max={0.5} color="#f97316" note={indices.interpretation.built} />
                  </div>
                  <p className="mt-2 text-[12px] text-neutral-600">
                    {indices.source} · {indices.from} — {indices.to} ({tr("соңғы бұлтсыз кадр")})
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-neutral-600">
                  {tr("Спектрлік талдау қолжетімсіз (бұлт болуы мүмкін) — жалған дерек көрсетілмейді.")}
                </p>
              )}
            </div>

            {/* LLM Vision (GPT-4o) — табиғи тілдегі пайымдау */}
            <div className="rounded-lg border border-neutral-300 bg-white p-3 border-l-4 border-l-violet-700">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-800">
                {tr("LLM Vision талдауы")}
                <span className="rounded bg-violet-50 px-1 py-px text-[12px] uppercase text-violet-800">GPT-4o</span>
              </h3>
              <p className="text-xs text-neutral-800">{tx?.summary ?? site.analysis.summary}</p>
            </div>

            {site.analysis.isAgent && site.analysis.agentSources && (
              <div className="space-y-2 rounded-lg border border-neutral-300 bg-white p-3 border-l-4 border-l-violet-700">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-violet-800">
                  <Sparkles className="h-3.5 w-3.5" /> {tr("AI агент — көп дереккөзді талдау")}
                </h3>
                <p className="text-[13px] text-neutral-600">
                  {tr("Тек спутникке емес, тірі ресми деректерге де сүйенді:")}
                </p>
                {site.analysis.agentSources.map((s, i) => (
                  <div key={i} className="rounded-md bg-white p-2 text-[13px]">
                    <b className="text-violet-800">{s.source}</b>
                    <div className="text-neutral-800">{tx?.agentFindings?.[i] ?? s.finding}</div>
                  </div>
                ))}
              </div>
            )}

            {site.analysis.science && (
              <div className="space-y-3 rounded-lg bg-neutral-50 p-3">
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800">
                  {tr("Ғылыми сараптама")}
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[12px] font-normal text-violet-800">
                    {tr("GPT-4o пайымдауы")}
                  </span>
                </h3>
                {/* Спектрлік индекстер жоғарыдағы «ML спектрлік талдауда» (нақты Sentinel-2) */}

                <div className="grid grid-cols-2 gap-2 text-[13px]">
                  <div className="rounded bg-neutral-50 p-2">
                    <div className="text-neutral-600">{tr("Ластанған аумақ")}</div>
                    <div className="font-semibold text-neutral-900">
                      ≈ {site.analysis.science.areaM2.toLocaleString("kk-KZ")} м²
                    </div>
                  </div>
                  <div className="rounded bg-neutral-50 p-2">
                    <div className="text-neutral-600">{tr("Жақын инфрақұрылым")}</div>
                    <div className="text-neutral-800">
                      {site.analysis.science.nearbyInfrastructure.join(", ") || "—"}
                    </div>
                  </div>
                </div>

                <div className="text-[13px] text-neutral-600">
                  <b className="text-neutral-800">{tr("Динамика:")}</b> {tx?.changeDynamics ?? site.analysis.science.changeDynamics}
                </div>
                <div className="text-[13px] text-neutral-600">
                  <b className="text-neutral-800">{tr("Текстура:")}</b> {tx?.textureNote ?? site.analysis.science.textureNote}
                </div>

                {/* Evidence-based reasoning */}
                {site.analysis.science.evidence.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[13px] font-semibold text-neutral-900">{tr("Себеп-салдар талдауы")}</h4>
                    {site.analysis.science.evidence.map((e, i) => (
                      <div key={i} className="rounded-md border border-neutral-300 bg-white p-2.5 text-[13px]">
                        <div className="flex items-center justify-between">
                          <b className="text-neutral-900">{e.sign}</b>
                          <span className="text-neutral-600">{tr("сенімділік")} {e.confidence}%</span>
                        </div>
                        <div className="mt-1 text-neutral-800">
                          <span className="text-sky-800">{tr("Дәлел:")}</span> {e.evidence}
                        </div>
                        <div className="mt-0.5 text-neutral-800">
                          <span className="text-orange-800">{tr("Болжам:")}</span> {e.prediction}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-lg border border-neutral-300 bg-white p-3 border-l-4 border-l-emerald-700">
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-emerald-800">
                {tr("Деректерге негізделген ұсыныс")}
                <span className="rounded bg-emerald-50 px-1 py-px text-[12px] uppercase text-emerald-800">
                  ML + AI
                </span>
              </h3>
              {recsState === "loading" ? (
                <p className="flex items-center gap-1.5 text-[13px] text-neutral-600">
                  <RefreshCw className="h-3 w-3 animate-spin" /> {tr("Талдау деректеріне сай ұсыныс дайындалуда…")}
                </p>
              ) : recs && recs.length > 0 ? (
                <ol className="space-y-1.5">
                  {recs.map((r, i) => (
                    <li key={i} className="flex gap-2 text-xs text-neutral-800">
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[12px] font-bold text-emerald-800">
                        {i + 1}
                      </span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                // Резерв — талдаудың өз ұсынысы
                <p className="text-xs text-neutral-800">{site.analysis.recommendation}</p>
              )}
            </div>

            {site.analysis.verificationNotes && (
              <p className="text-xs italic text-neutral-600">{site.analysis.verificationNotes}</p>
            )}

            <div className="space-y-2 pb-4">
              {/* Басты әрекет — органға жіберу */}
              <Button
                size="sm"
                className="w-full bg-brand text-white hover:bg-brand/90 disabled:opacity-60"
                onClick={sendToAuthority}
                disabled={sending || sent}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                {sent ? tr("Жіберілді ") : sending ? tr("Жіберілуде…") : tr("Тиісті органға жіберу")}
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={site.flagged ? "secondary" : "outline"}
                  onClick={() => toggleFlag(site.id)}
                >
                  <Flag className="mr-1 h-3.5 w-3.5" />
                  {site.flagged ? tr("Белгіленген") : tr("Белгілеу")}
                </Button>
                <Button size="sm" variant="outline" onClick={() => window.print()}>
                  {tr("PDF экспорт")}
                </Button>
                <a
                  href={`https://maps.google.com/?q=${site.lat},${site.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-800 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <MapPin className="h-3.5 w-3.5" /> Google Maps
                </a>
                <a
                  href={`/compare?lat=${site.lat.toFixed(4)}&lng=${site.lng.toFixed(4)}`}
                  className="inline-flex items-center justify-center gap-1 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-800 transition-colors hover:bg-neutral-50 hover:text-neutral-900"
                >
                  <History className="h-3.5 w-3.5" /> {tr("Тарихи салыстыру")}
                </a>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Fullscreen image lightbox */}
      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={tr("Үлкейту")}
          onKeyDown={(e) => { if (e.key === "Escape") setLightbox(null); }}
          tabIndex={-1}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4 "
        >
          <div className="mb-3 flex w-full max-w-4xl items-center justify-between text-sm text-white">
            <span>{lightbox.label}</span>
            <button aria-label={tr("Жабу")} onClick={() => setLightbox(null)} className="rounded-md p-1 hover:bg-white/10">
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.url}
            alt={lightbox.label}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[80vh] max-w-4xl rounded-lg object-contain "
          />
          <p className="mt-3 text-xs text-white">{tr("Жабу үшін кез келген жерді басыңыз")}</p>
        </div>
      )}
    </>
  );
}

function MlBar({ label, value, min, max, color, note }: { label: string; value: number; min: number; max: number; color: string; note: string }) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  return (
    <div className="rounded-md bg-neutral-50 p-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-neutral-600">{label}</span>
        <span className="text-[13px] font-bold text-neutral-900">{value.toFixed(2)}</span>
      </div>
      <div className="my-1 h-1.5 overflow-hidden rounded-full bg-neutral-50">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[12px] text-neutral-600">{note}</span>
    </div>
  );
}

function Indicator({ on, label }: { on: boolean; label: string }) {
  const { tr } = useLang();
  return (
    <div
      className={`rounded-md px-2 py-1.5 ${on ? "bg-red-50 text-red-800" : "bg-neutral-50 text-neutral-600"}`}
    >
      {label}: {on ? tr("Иә") : tr("Жоқ")}
    </div>
  );
}
