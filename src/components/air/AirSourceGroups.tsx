"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/i18n";
import type { AirReading, Pollutant } from "@/lib/airReading";
import { KZH_ATYRAU, KZH_PERIOD, latestKzh, type KzhGas } from "@/data/kazhydrometAtyrau";
import { SAT_COLUMN_META, type SatGas } from "@/data/satelliteColumns";
import { Badge, MetaList, fmtAtyrau } from "@/components/air/SourceBadge";
import { SatColumnNote } from "@/components/air/SatColumnNote";

// Ауа көрсеткіштері ҮШ ТОПҚА бөлек: 🛰 жерүсті станса / 📊 модель (CAMS) / спутник баған.
// Мәндер тек /api/atyrau-air-дан. Мок ЖОҚ. Әр жолда алты өріс: дереккөз, бірлік, уақыт,
// жаңарту жиілігі, сапа, белгісіздік. Спутник бағанында сан көрсетілмейді (тек метадерек).

interface AirResponse {
  fetchedAt: string;
  ground: { state: "ok" | "unavailable" | "no-station"; stationCount: number; note: string | null };
  readings: { ground: AirReading[]; model: AirReading[] };
}

type Loaded = { state: "ok"; data: AirResponse } | { state: "error" } | null;

const POLLUTANT_ORDER: Pollutant[] = ["so2", "co", "no2", "h2s", "no", "pm25", "pm10"];
const KZH_ORDER: KzhGas[] = ["so2", "co", "no2", "no", "h2s"];
const SAT_ORDER: SatGas[] = ["no2", "so2", "co"];

export function AirSourceGroups() {
  const { tr } = useLang();
  const { t, lang } = useLang();
  const tk = (k: string) => t(k as never);
  const [loaded, setLoaded] = useState<Loaded>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/atyrau-air")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<AirResponse>;
      })
      .then((data) => {
        if (alive) setLoaded({ state: "ok", data });
      })
      .catch(() => {
        if (alive) setLoaded({ state: "error" });
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) {
    return (
      <section className="rounded-md border border-neutral-300 bg-white p-4 text-neutral-900" role="status">
        <p className="text-neutral-800">{t("air.loading")}</p>
      </section>
    );
  }
  if (loaded.state === "error") {
    return (
      <section className="rounded-md border-l-4 border-red-700 bg-white p-4 text-red-900" role="alert">
        <p className="font-bold">{t("air.error")}</p>
      </section>
    );
  }

  const { data } = loaded;
  const groundByP = new Map(data.readings.ground.map((r) => [r.pollutant, r]));
  const modelByP = new Map(data.readings.model.map((r) => [r.pollutant, r]));
  const fmtNum = (v: number, u: string | null) =>
    `${v.toLocaleString(lang === "ru" ? "ru-RU" : lang === "en" ? "en-GB" : "kk-KZ", { maximumFractionDigits: 1 })}${u ? ` ${u}` : ""}`;
  /** CAMS уақыты — naive жергілікті; OpenAQ/сервер уақыты — UTC */
  const readingTime = (iso: string | null, naive: boolean) => {
    if (!iso) return "—";
    if (naive) return `${iso.replace("T", " ")} (${t("air.tz.local")})`;
    return `${fmtAtyrau(iso, lang)} (${t("air.tz.atyrau")})`;
  };

  const groundHas = (p: Pollutant) => { const g = groundByP.get(p); return !!g && g.value != null && g.unit != null; };
  const groundPresent = POLLUTANT_ORDER.filter(groundHas);
  const groundMissing = POLLUTANT_ORDER.filter((p) => !groundHas(p));

  return (
    <section aria-labelledby="air-groups-title" className="rounded-md border border-neutral-300 bg-white p-4 text-neutral-900">
      <h2 id="air-groups-title" className="text-lg font-bold text-neutral-900">{tk("air.groups.title")}</h2>
      <p className="mt-1 text-sm text-neutral-800">{tk("air.groups.intro")}</p>

      {/* ЖЕРҮСТІ СТАНСА */}
      <div className="mt-5 border-t border-neutral-300 pt-4">
        <h3 className="flex flex-wrap items-center gap-2 font-bold text-neutral-900">
          <Badge kind="ground">{t("air.type.ground")}</Badge> {tk("air.group.ground")}
        </h3>
        {/* Дерегі жоқ заттар бос карточка болып қайталанбайды — бір жолға жиналады */}
        {groundMissing.length > 0 && (
          <p className="mt-3 rounded border border-dashed border-neutral-400 bg-neutral-50 p-3 text-sm text-neutral-800">
            <span className="font-bold">{t("air.noData")}</span>
            {" "}({groundMissing.length}/{POLLUTANT_ORDER.length}): {groundMissing.map((p) => tk(`pol.${p}`).split(" — ")[0]).join(", ")}.
            {" "}{data.ground.state === "unavailable" ? t("air.ground.fail") : t("air.noData.noStation")}
          </p>
        )}
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {groundPresent.map((p) => {
            const g = groundByP.get(p);
            const has = !!g && g.value != null && g.unit != null;
            return (
              <li key={`g-${p}`} className="rounded border border-neutral-300 p-3">
                <p className="font-bold text-neutral-900">{tk(`pol.${p}`)}</p>
                {has ? (
                  <>
                    <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{fmtNum(g!.value!, g!.unit)}</p>
                    <MetaList
                      rows={[
                        { k: t("air.source"), v: g!.sourceName },
                        { k: t("air.unit"), v: g!.unit ?? "—" },
                        { k: t("air.time"), v: readingTime(g!.observedAt, false) },
                        { k: t("air.freq"), v: t("air.freq.unknown") },
                        { k: t("air.quality"), v: t("air.q.ground") },
                        { k: t("air.uncertainty"), v: g!.uncertainty.kind === "absolute" ? `± ${g!.uncertainty.value} ${g!.uncertainty.unit}` : t("air.u.notEst") },
                      ]}
                    />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-neutral-800">
                    {t("air.noData")}: {data.ground.state === "unavailable" ? t("air.ground.fail") : t("air.noData.noStation")}
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {/* Қазгидромет айлық — тірі емес, бөлек жазылған */}
        <h4 className="mt-5 text-sm font-bold text-neutral-900">{tk("air.kzh.title")}</h4>
        {/* Бір кесте: қайталанатын мәлімет (дереккөз, бірлік, жиілік, сапа) кестенің астында бір рет */}
        {(() => {
          const rows = KZH_ORDER.map((gas) => ({ gas, last: latestKzh(gas) }));
          const any = rows.find((r) => r.last)?.last;
          return (
            <div className="mt-2 overflow-x-auto rounded border border-neutral-300">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
                  <tr><th className="px-3 py-2 font-semibold">{tr("Зат")}</th><th className="px-3 py-2 text-right font-semibold">µg/m³</th><th className="px-3 py-2 font-semibold">{t("air.month")}</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ gas, last }) => (
                    <tr key={`k-${gas}`} className="border-t border-neutral-200">
                      <td className="px-3 py-2">{tk(`pol.${gas}`)}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{last ? fmtNum(last.meanUg, "") : t("air.noData")}</td>
                      <td className="px-3 py-2 tabular-nums text-neutral-700">{last?.month ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                {tk("air.ground.notLive")} · {t("air.freq")}: {t("air.freq.kzh")} · {t("air.quality")}: {t("air.q.kzh")} · {t("air.uncertainty")}: {t("air.u.kzh")}
                {any && <> · <a href={any.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-[#0b3a6b]">{tr("Қазгидромет")}<span className="sr-only"> ({t("foot.newTab")})</span></a></>}
              </div>
            </div>
          );
        })()}
        <p className="mt-2 text-xs text-neutral-800">
          {KZH_PERIOD.from} — {KZH_PERIOD.to} · {Object.keys(KZH_ATYRAU).length} {tk("air.kzh.gases")}
        </p>
      </div>

      {/* МОДЕЛЬ (CAMS) */}
      <div className="mt-5 border-t border-neutral-300 pt-4">
        <h3 className="flex flex-wrap items-center gap-2 font-bold text-neutral-900">
          <Badge kind="model">{t("air.type.model")}</Badge> {tk("air.group.model")}
        </h3>
        {(() => {
          const first = POLLUTANT_ORDER.map((p) => modelByP.get(p)).find((m) => m && m.value != null);
          return (
            <div className="mt-3 overflow-x-auto rounded border border-neutral-300">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-left text-xs text-neutral-700">
                  <tr><th className="px-3 py-2 font-semibold">{tr("Зат")}</th><th className="px-3 py-2 text-right font-semibold">{tr("Мәні")}</th><th className="px-3 py-2 font-semibold">{t("air.time")}</th></tr>
                </thead>
                <tbody>
                  {POLLUTANT_ORDER.map((p) => {
                    const m = modelByP.get(p);
                    const has = !!m && m.value != null && m.unit != null;
                    return (
                      <tr key={`m-${p}`} className="border-t border-neutral-200">
                        <td className="px-3 py-2">{tk(`pol.${p}`)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {has ? <b>{fmtNum(m!.value!, m!.unit)}</b> : <span className="text-neutral-600">{t("air.noData")}: {m?.missingReason === "no-model-field" ? t("air.noData.noModelField") : t("air.noData.unavailable")}</span>}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-neutral-700">{has ? readingTime(m!.observedAt, true) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
                {t("air.source")}: {first?.sourceName ?? "—"} · {t("air.freq")}: {t("air.freq.hourly")} · {t("air.quality")}: {t("air.q.model")} · {t("air.uncertainty")}: {t("air.u.notEst")}
              </div>
            </div>
          );
        })()}
      </div>

      {/* СПУТНИК БАҒАН (Sentinel-5P) — сан жоқ, тек метадерек */}
      <div className="mt-5 border-t border-neutral-300 pt-4">
        <h3 className="flex flex-wrap items-center gap-2 font-bold text-neutral-900">
          <Badge kind="satellite">{t("air.type.satellite")}</Badge> {tk("air.group.sat")}
        </h3>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {SAT_ORDER.map((gas) => (
            <li key={`s-${gas}`} className="rounded border border-neutral-300 p-3">
              <p className="font-bold text-neutral-900">{SAT_COLUMN_META[gas].label}</p>
              <SatColumnNote gas={gas} tone="light" />
              <Link
                href="/map"
                className="mt-2 inline-flex min-h-[44px] items-center font-bold text-[#0b3a6b] underline underline-offset-2"
              >
                {t("air.sat.link")}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
