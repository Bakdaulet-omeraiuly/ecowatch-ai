"use client";

import { useEffect, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { BrainCircuit, Loader2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLang } from "@/lib/i18n";
import { TierBadge } from "@/components/ui/TierBadge";
import { ModuleMissing } from "@/components/ui/ModuleMissing";
import { hasModule } from "@/data/regions";
import { useRegion } from "@/store/useRegionStore";

interface Metrics { mae: number; rmse: number; r2: number | null }
interface MlData {
  model: {
    name: string; version: string; trainedAt: string;
    trainPeriod: { start: string; end: string; hours: number };
    features: number;
    trees: Record<string, number>;
    metrics: Record<string, { model: Metrics; climatologyBaseline: Metrics; skill: number | null }>;
  };
  camsHorizonEnd: string | null;
  camsAvailable: boolean;
  daily: { date: string; aqiAvg: number; aqiMax: number; pm25Avg: number; beyondCams: boolean }[];
  source: string;
  disclaimer: string;
}

const fmtDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export function MlForecast() {
  const { tr } = useLang();
  const region = useRegion();
  const [data, setData] = useState<MlData | null>(null);
  const [error, setError] = useState<{ msg: string; detail?: string } | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  // Модель бұл аймақта оқытылмаған — сұраныс жіберілмейді
  const missing = !hasModule(region, "mlForecast");
  // Қай аймақ үшін жүктелді — «жүктелуде» күйі осыдан шығарылады
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loading = !missing && loadedFor !== region.id;

  useEffect(() => {
    if (missing || loadedFor === region.id) return;
    fetch(`/api/ml-forecast?region=${region.id}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        setData(ok ? d : null);
        setError(ok ? null : { msg: d.error ?? "Қолжетімсіз", detail: d.detail });
      })
      .catch(() => { setData(null); setError({ msg: "Қолжетімсіз" }); })
      .finally(() => setLoadedFor(region.id));
  }, [region.id, missing, loadedFor]);

  const firstBeyond = data?.daily.find((d) => d.beyondCams)?.date;
  const aqiMetrics = data?.model.metrics["european_aqi"];

  return (
    <Card className="border-white/10 bg-white/[0.02]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-white">
          <TierBadge tier="model" />
          <BrainCircuit className="h-4 w-4 text-violet-400" />
          {tr("JAIYQ-ML — 11 күндік ауа сапасы болжамы")}
          <button
            onClick={() => setShowInfo((v) => !v)}
            className="ml-auto rounded p-1 text-neutral-400 transition hover:bg-white/5 hover:text-white"
            aria-label={tr("Модель туралы")}
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </CardTitle>
        <p className="text-[13px] text-neutral-400">
          {tr("Метеорологиядан оқытылған модель — CAMS-тың 5 күндік шегінен әрі жалғастырады")}
        </p>
      </CardHeader>
      <CardContent>
        {missing ? (
          <ModuleMissing module="mlForecast" region={region} />
        ) : loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-neutral-400">
            <Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}
          </div>
        ) : error || !data ? (
          <div className="space-y-2 py-3">
            <p className="text-sm text-neutral-300">{tr(error?.msg ?? "Қолжетімсіз")}</p>
            {error?.detail && (
              <p className="text-[13px] leading-relaxed text-neutral-400">{error.detail}</p>
            )}
          </div>
        ) : (
          <>
            {showInfo && (
              <div className="mb-3 space-y-1 rounded-lg border border-white/10 bg-black/30 p-3 text-[13px] leading-relaxed text-neutral-300">
                <p>
                  <span className="text-neutral-400">{tr("Модель")}:</span>{" "}
                  {data.model.name} v{data.model.version} · {data.model.features} {tr("белгі")} ·{" "}
                  {data.model.trees["european_aqi"]} {tr("ағаш")}
                </p>
                <p>
                  <span className="text-neutral-400">{tr("Оқыту кезеңі")}:</span>{" "}
                  {data.model.trainPeriod.start} … {data.model.trainPeriod.end} (
                  {data.model.trainPeriod.hours.toLocaleString("kk-KZ")} {tr("сағат")})
                </p>
                {aqiMetrics && (
                  <p>
                    <span className="text-neutral-400">{tr("Дәлдік (тексеру жиыны)")}:</span>{" "}
                    MAE {aqiMetrics.model.mae} (
                    {tr("маусымдық климатология")} {aqiMetrics.climatologyBaseline.mae}) ·{" "}
                    {tr("шеберлік")}{" "}
                    {aqiMetrics.skill != null ? `+${Math.round(aqiMetrics.skill * 100)}%` : "—"}
                  </p>
                )}
                <p className="text-amber-300/80">⚠ {tr(data.disclaimer)}</p>
                <p className="text-neutral-400">{data.source}</p>
              </div>
            )}

            <ResponsiveContainer width="100%" height={170}>
              <AreaChart data={data.daily} margin={{ top: 4, right: 6, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="mlAqi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="date" tickFormatter={fmtDay}
                  tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false}
                />
                <YAxis tick={{ fontSize: 10, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "#fff" }}
                  labelFormatter={(v) => fmtDay(String(v))}
                  formatter={(v, n) => [v, n === "aqiAvg" ? tr("орташа AQI") : tr("ең жоғары AQI")]}
                />
                {firstBeyond && (
                  <ReferenceLine
                    x={firstBeyond} stroke="#fbbf24" strokeDasharray="4 3"
                    label={{ value: tr("CAMS шегі"), position: "insideTopRight", fill: "#fbbf24", fontSize: 9 }}
                  />
                )}
                <Area type="monotone" dataKey="aqiAvg" stroke="#a78bfa" strokeWidth={2} fill="url(#mlAqi)" />
                <Area type="monotone" dataKey="aqiMax" stroke="#f472b6" strokeWidth={1} strokeDasharray="3 3" fill="none" />
              </AreaChart>
            </ResponsiveContainer>

            <p className="mt-2 text-[12px] leading-relaxed text-neutral-400">
              {data.camsAvailable
                ? tr("Сары сызықтан кейінгі күндер — CAMS болжамы жетпейтін аймақ, тек модель бағалауы.")
                : tr("CAMS салыстыруы қазір қолжетімсіз — тек модель бағалауы көрсетілген.")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
