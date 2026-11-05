"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import type { AirReading, Pollutant } from "@/lib/airReading";
import type { RiskAssessment, RiskLevel } from "@/lib/atyrauAir";
import { Badge, BADGE } from "@/components/air/SourceBadge";

// Атырау ауа панелі: 7 көрсеткіш (SO₂, CO, NO₂, H₂S, NO, PM₂.₅, PM₁₀).
// Мәндер ТЕК /api/atyrau-air-дан (CAMS модель + OpenAQ станса). Мок, кездейсоқ
// немесе басқа газдан шығарылған мән ЖОҚ: дерек болмаса «Дерек жоқ» + себеп.
// Спутник бағаны (mol/m²) мұнда сан ретінде КӨРСЕТІЛМЕЙДІ — тек картаға сілтеме.

interface AirResponse {
  fetchedAt: string;
  cams: { ok: boolean; error: string | null; time: string | null; ageH: number | null };
  ground: { state: "ok" | "unavailable" | "no-station"; stationCount: number; note: string | null };
  readings: { ground: AirReading[]; model: AirReading[]; primary: AirReading[] };
  risk: RiskAssessment;
}

type Loaded =
  | { state: "ok"; data: AirResponse }
  | { state: "error"; message: string; requestedAt: string };

const POLLUTANT_ORDER: Pollutant[] = ["so2", "co", "no2", "h2s", "no", "pm25", "pm10"];

/** Sentinel-5P TROPOMI бағаны бар газдар (карта қабаты: /api/s5p/[gas]) */
const SATELLITE_COLUMN: ReadonlySet<Pollutant> = new Set<Pollutant>(["so2", "co", "no2"]);

/** Деректің ескіру шегі (сағат): одан ескі болса — «Ескірген дерек» белгісі */
const STALE_AFTER_H = 3;

// Барлық түс жұбы WCAG AA-дан өтеді (≥ 4.5:1): *-900 мәтін *-50 фонда ≈ 8.7–10:1.
// Түс мағынаны жалғыз тасымайды — әр күйде мәтін жазуы бар.
// Ресми стиль: ақ карточка, деңгей түсі тек сол жиек пен белгіде (фон боялмайды).
const RISK_ACCENT: Record<RiskLevel, { border: string; dot: string; text: string }> = {
  low: { border: "border-l-emerald-700", dot: "bg-emerald-700", text: "text-emerald-800" },
  elevated: { border: "border-l-amber-600", dot: "bg-amber-600", text: "text-amber-800" },
  high: { border: "border-l-red-700", dot: "bg-red-700", text: "text-red-800" },
  "insufficient-data": { border: "border-l-neutral-500", dot: "bg-neutral-500", text: "text-neutral-700" },
};

const LOCALE: Record<string, string> = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" };

const AVG_KEY: Record<string, string> = {
  hourly: "air.avg.hourly",
  daily: "air.avg.daily",
  annual: "air.avg.annual",
  "max-single": "air.avg.maxSingle",
  "8h": "air.avg.8h",
  unknown: "air.avg.unknown",
};

export function AtyrauAirPanel() {
  const { t, tr, lang } = useLang();
  const tk = (k: string) => t(k as never);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let alive = true;
    const requestedAt = new Date().toISOString();
    fetch("/api/atyrau-air")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AirResponse>;
      })
      .then((data) => {
        if (!alive) return;
        setLoaded({ state: "ok", data });
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoaded({ state: "error", message: e instanceof Error ? e.message : String(e), requestedAt });
      });
    return () => {
      alive = false;
    };
  }, []);

  /** CAMS уақыты timezone=auto арқылы жергілікті (naive) келеді — өзгертпей көрсетеміз.
      OpenAQ пен сервер уақыты — UTC, Атырау уақытына айналдырылады. */
  function fmtTime(iso: string | null, isLocalNaive: boolean): string {
    if (!iso) return "—";
    if (isLocalNaive) return `${iso.replace("T", " ")} (${t("air.tz.local")})`;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return (
      d.toLocaleString(LOCALE[lang] ?? "kk-KZ", {
        timeZone: "Asia/Atyrau", day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      }) + ` (${t("air.tz.atyrau")})`
    );
  }

  const avgLabel = (a: string) => tk(AVG_KEY[a] ?? "air.avg.unknown");

  if (!loaded) {
    return (
      <p role="status" aria-live="polite" className="text-neutral-700">
        {t("air.loading")}
      </p>
    );
  }

  if (loaded.state === "error") {
    return (
      <div role="alert" className="rounded-md border-l-4 border-red-700 bg-red-50 p-4 text-red-900">
        <p className="font-bold">{t("air.error")}</p>
        <p className="mt-1 text-sm">
          {t("air.errorAt")}: {fmtTime(loaded.requestedAt, false)}
        </p>
        <p className="mt-1 text-sm">{loaded.message}</p>
      </div>
    );
  }

  const { data } = loaded;
  // Ескіру — МОДЕЛЬ деректің жасы (CAMS уақыты), сервер есептейді. fetchedAt-қа қарап
  // болмайды: ол әрқашан «қазір» болады, сондықтан белгі ешқашан қоспайтын.
  const ageH = data.cams.ok ? data.cams.ageH : null;
  const stale = ageH != null && ageH > STALE_AFTER_H;
  const byP = new Map(data.readings.primary.map((r) => [r.pollutant, r]));
  const groundByP = new Map(data.readings.ground.map((r) => [r.pollutant, r]));
  const modelByP = new Map(data.readings.model.map((r) => [r.pollutant, r]));
  const riskRow = new Map(data.risk.rows.map((r) => [r.pollutant, r]));
  const compared = data.risk.rows.filter((r) => r.status === "compared" && r.norm);
  const riskLabel = data.risk.partialLow
    ? t("air.risk.partialLow")
    : tk(`air.risk.${data.risk.level === "insufficient-data" ? "insufficient" : data.risk.level}`);
  const checkedSources = [data.readings.ground[0]?.sourceName, data.readings.model[0]?.sourceName]
    .filter(Boolean)
    .join("; ");

  function groundReason(p: Pollutant): string {
    const g = groundByP.get(p);
    if (data.ground.state === "unavailable" || g?.missingReason === "source-unavailable") return t("air.ground.fail");
    if (g?.missingReason === "stale-ground") return t("air.ground.stale");
    if (data.ground.state === "no-station") return t("air.ground.zero");
    // Станса мән берген, бірақ бірлігі танылмаған — «дерек жоқ» деу жалған болар еді
    if (g?.kind === "ground" && g.value != null && g.unit == null) return t("air.noData.unitUnknown");
    return t("air.noData.noStation");
  }
  function modelReason(p: Pollutant): string {
    const m = modelByP.get(p);
    if (m?.missingReason === "no-model-field") return t("air.noData.noModelField");
    return t("air.noData.unavailable");
  }

  // Ең жоғары үлес — бір сөйлеммен жауап («қазір қалай?»)
  const worst = compared.filter((r) => r.ratio != null).sort((a, b) => b.ratio! - a.ratio!)[0];
  const accent = RISK_ACCENT[data.risk.partialLow ? "low" : data.risk.level];
  const ratioBar = (ratio: number) => ratio >= 1 ? "bg-red-700" : ratio >= 0.5 ? "bg-amber-600" : "bg-emerald-700";

  return (
    <div className="space-y-5">
      {/* 1. Бір қарағанда: қауіп деңгейі (SPEC §8) */}
      <section
        aria-labelledby="risk-title"
        className={`rounded-lg border border-neutral-300 border-l-4 bg-white p-4 text-neutral-900 sm:p-5 ${accent.border}`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 id="risk-title" className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{t("air.riskTitle")}</h3>
            <p className="mt-1 flex items-center gap-2 text-2xl font-bold sm:text-3xl">
              <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${accent.dot}`} />{riskLabel}
            </p>
          </div>
          <div className="text-right text-xs text-neutral-600">
            <div>{t("air.fetchedAt")}</div>
            <div className="font-semibold tabular-nums">{fmtTime(data.cams.ok ? data.cams.time : data.fetchedAt, data.cams.ok)}</div>
            {stale && (
              <span className="mt-1 inline-block rounded border border-amber-800 bg-amber-50 px-1.5 py-0.5 font-bold text-amber-900">
                {t("air.stale")}{ageH != null ? ` · ${Math.round(ageH)} ${t("air.hoursAgo")}` : ""}
              </span>
            )}
          </div>
        </div>
        {worst && (
          <p className="mt-2 text-sm text-neutral-700">
            {tr("Шекке ең жақыны")}: <strong>{tk(`pol.${worst.pollutant}`)}</strong> — <strong className="tabular-nums">{Math.round(worst.ratio! * 100)}%</strong> {t("air.ofLimit")}
            {" "}({worst.kind === "ground" ? t("air.groundTag") : t("air.modelTag")}).
            {" "}{tr("Салыстырылды")}: {compared.length}/{POLLUTANT_ORDER.length}.
          </p>
        )}
        {data.risk.level === "insufficient-data" && <p className="mt-1 text-sm font-bold">{data.risk.partialLow ? t("air.partialNote") : t("air.notSafe")}</p>}
      </section>

      {/* 2. Жеті зат — ықшам плиткалар; толық мәлімет «Толығырақ» ішінде */}
      <section aria-labelledby="ind-title">
        <h3 id="ind-title" className="sr-only">{t("air.indicators")}</h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {POLLUTANT_ORDER.map((p) => {
            const r = byP.get(p);
            const rr = riskRow.get(p);
            const has = !!r && r.kind !== "none" && r.value != null && r.unit != null;
            const kind: keyof typeof BADGE = !has ? "none" : r!.kind === "ground" ? "ground" : "model";
            const ratio = rr?.status === "compared" && rr.ratio != null ? rr.ratio : null;
            return (
              <li key={p} className="rounded-lg border border-neutral-300 bg-white p-3">
                <div className="truncate text-xs text-neutral-600" title={tk(`pol.${p}`)}><span className="font-bold text-neutral-900">{tk(`pol.${p}`).split(" — ")[0]}</span>{tk(`pol.${p}`).includes(" — ") ? ` · ${tk(`pol.${p}`).split(" — ")[1]}` : ""}</div>
                {has ? (
                  <p className="mt-0.5 text-xl font-bold tabular-nums text-neutral-900">
                    {r!.value!.toLocaleString(LOCALE[lang] ?? "kk-KZ", { maximumFractionDigits: 1 })}
                    <span className="ml-1 text-xs font-normal text-neutral-700">{r!.unit}</span>
                  </p>
                ) : <p className="mt-0.5 text-base font-bold text-neutral-500">{t("air.noData")}</p>}
                {ratio != null ? (
                  <div className="mt-1.5" aria-label={`${Math.round(ratio * 100)}% ${t("air.ofLimit")}`}>
                    <div className="h-1.5 rounded bg-neutral-200"><div className={`h-1.5 rounded ${ratioBar(ratio)}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} /></div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-neutral-600">{Math.round(ratio * 100)}% {t("air.ofLimit")}</div>
                  </div>
                ) : <div className="mt-1.5 text-[11px] text-neutral-500">{has ? t("air.noNorm") : "\u00a0"}</div>}
                <div className="mt-1"><Badge kind={kind}>{kind === "none" ? t("air.type.none") : kind === "ground" ? t("air.type.ground") : t("air.type.model")}</Badge></div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 3. Толығырақ: нормалар, әдіс, дереккөздер, аңыз, әр зат бойынша мәлімет */}
      <details className="group rounded-lg border border-neutral-300 bg-white">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between px-4 font-semibold text-[#0b3a6b]">
          {tr("Толығырақ: нормалар, әдіс және дереккөздер")}
          <span aria-hidden className="transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="space-y-5 border-t border-neutral-200 p-4">
      <section aria-label={t("air.riskNormsUsed")} className="text-sm text-neutral-800">
        <p className="font-bold">{t("air.riskNormsUsed")}:</p>
        {compared.length > 0 ? (
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {compared.map((r) => (
              <li key={r.pollutant}>
                {tk(`pol.${r.pollutant}`)}
                {r.value != null && r.ratio != null && (
                  <> — <strong className="tabular-nums">{r.value.toFixed(1)} {r.norm!.unit}</strong>
                    {r.norm!.averaging === "daily" ? ` (${t("air.daily24")})` : ""}{" "}
                    {r.kind === "ground" ? t("air.groundTag") : t("air.modelTag")} · <strong className="tabular-nums">{Math.round(r.ratio * 100)}%</strong> {t("air.ofLimit")}</>
                )}
                ; {r.norm!.limit} {r.norm!.unit}, {t("air.avg")}: {avgLabel(r.norm!.averaging)};{" "}
                {t("air.riskNormSrc")}: {r.norm!.actTitle} (
                {r.norm!.status === "verified" ? t("air.normVerified") : t("air.normUnverified")})
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1">{t("air.riskNoneCompared")}</p>
        )}
        <p className="mt-3">{t("air.riskMethod")}</p>
        {data.risk.missing.length > 0 && (
          <p className="mt-2">
            <span className="font-bold">{t("air.riskMissing")}:</span>{" "}
            {data.risk.missing.map((p) => tk(`pol.${p}`)).join("; ")}
          </p>
        )}
      </section>

      {/* Дереккөздер күйі */}
      <section aria-label={t("air.statusLabel")} className="space-y-1 text-sm text-neutral-800">
        <p>
          <span className="font-bold">{t("air.ground.ok")}:</span>{" "}
          {data.ground.state === "ok"
            ? `${data.ground.stationCount}`
            : data.ground.state === "no-station"
              ? t("air.ground.zero")
              : t("air.ground.fail")}
        </p>
        <p>
          <span className="font-bold">{data.cams.ok ? t("air.cams.ok") : t("air.cams.fail")}</span>
          {data.cams.ok && data.cams.time ? ` · ${fmtTime(data.cams.time, true)}` : ""}
          {!data.cams.ok && data.cams.error ? ` · ${data.cams.error}` : ""}
        </p>
        <p>
          <span className="font-bold">{t("air.fetchedAt")}:</span> {fmtTime(data.fetchedAt, false)}
        </p>
      </section>

      {/* Дерек түрлерінің аңызы: станса / модель / спутник */}
      <section aria-labelledby="legend-title" className="rounded-md border border-neutral-300 bg-neutral-50 p-4">
        <h3 id="legend-title" className="text-sm font-bold text-neutral-900">
          {t("air.legend")}
        </h3>
        <ul className="mt-2 space-y-2 text-sm text-neutral-800">
          <li>
            <Badge kind="ground">{t("air.type.ground")}</Badge> — {t("air.legend.ground")}
          </li>
          <li>
            <Badge kind="model">{t("air.type.model")}</Badge> — {t("air.legend.model")}
          </li>
          <li>
            <Badge kind="satellite">{t("air.type.satellite")}</Badge> — {t("air.legend.satellite")}
          </li>
        </ul>
      </section>

      {/* Әр зат бойынша толық мәлімет */}
      <section aria-labelledby="ind-detail-title">
        <h3 id="ind-detail-title" className="text-base font-bold text-neutral-900">
          {t("air.indicators")}
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {POLLUTANT_ORDER.map((p) => {
            const r = byP.get(p);
            const rr = riskRow.get(p);
            const has = !!r && r.kind !== "none" && r.value != null && r.unit != null;
            const kind: keyof typeof BADGE = !has ? "none" : r!.kind === "ground" ? "ground" : "model";
            const badgeText =
              kind === "none" ? t("air.type.none") : kind === "ground" ? t("air.type.ground") : t("air.type.model");

            return (
              <li key={p} className="rounded-md border border-neutral-300 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="font-bold text-neutral-900">{tk(`pol.${p}`)}</h4>
                  <Badge kind={kind}>{badgeText}</Badge>
                </div>

                {has ? (
                  <>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-neutral-900">
                      {r!.value!.toLocaleString(LOCALE[lang] ?? "kk-KZ", { maximumFractionDigits: 1 })}{" "}
                      <span className="text-base font-normal text-neutral-800">{r!.unit}</span>
                    </p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-neutral-800">
                      <dt className="font-bold">{t("air.source")}</dt>
                      <dd>
                        <a
                          href={r!.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-[#0b3a6b]"
                        >
                          {r!.sourceName}
                          <span className="sr-only"> ({t("foot.newTab")})</span>
                        </a>
                        {r!.station
                          ? ` — ${r!.station.name}${r!.station.distanceKm != null ? `, ${r!.station.distanceKm} км` : ""}`
                          : ""}
                      </dd>
                      <dt className="font-bold">{t("air.time")}</dt>
                      <dd className="tabular-nums">{fmtTime(r!.observedAt, r!.kind === "model")}</dd>
                      <dt className="font-bold">{t("air.freq")}</dt>
                      <dd>{r!.updateInterval === "hourly" ? t("air.freq.hourly") : t("air.freq.unknown")}</dd>
                      <dt className="font-bold">{t("air.avg")}</dt>
                      <dd>{avgLabel(r!.averaging)}</dd>
                      <dt className="font-bold">{t("air.quality")}</dt>
                      <dd>{r!.quality === "ground-unvalidated" ? t("air.q.ground") : t("air.q.model")}</dd>
                      <dt className="font-bold">{t("air.uncertainty")}</dt>
                      <dd>
                        {r!.uncertainty.kind === "absolute"
                          ? `± ${r!.uncertainty.value} ${r!.uncertainty.unit}`
                          : t("air.u.none")}
                      </dd>
                      <dt className="font-bold">{t("air.compare")}</dt>
                      <dd>
                        {rr?.status === "compared" && rr.norm
                          ? `${t("air.compared")}: ${rr.norm.limit} ${rr.norm.unit}, ${avgLabel(rr.norm.averaging)}; ${t("air.riskNormSrc")}: ${rr.norm.actTitle}`
                          : rr?.status === "not-comparable" && r!.averaging === "unknown"
                            ? t("air.notComparable")
                            : t("air.noNorm")}
                      </dd>
                    </dl>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-2xl font-bold text-neutral-900">{t("air.noData")}</p>
                    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-neutral-800">
                      <dt className="font-bold">{t("air.reasonGround")}</dt>
                      <dd>{groundReason(p)}</dd>
                      <dt className="font-bold">{t("air.reasonModel")}</dt>
                      <dd>{modelReason(p)}</dd>
                      <dt className="font-bold">{t("air.checked")}</dt>
                      <dd>{checkedSources}</dd>
                      <dt className="font-bold">{t("air.time")}</dt>
                      <dd>—</dd>
                    </dl>
                    <p className="mt-2 text-sm text-neutral-800">{t("air.noDerive")}</p>
                  </>
                )}

                {SATELLITE_COLUMN.has(p) && (
                  <div className="mt-3 border-t border-neutral-200 pt-3 text-sm text-neutral-800">
                    <Badge kind="satellite">{t("air.type.satellite")}</Badge>
                    <p className="mt-1">{t("air.sat.row")}</p>
                    <Link
                      href="/map"
                      className="inline-flex min-h-[44px] items-center font-bold text-[#0b3a6b] underline underline-offset-2"
                    >
                      {t("air.sat.link")}
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-neutral-700">{t("air.satNote")}</p>
        </div>
      </details>
    </div>
  );
}
