"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSitesStore } from "@/store/useSitesStore";
import { useLang } from "@/lib/i18n";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import { aqiCategory } from "@/lib/airQuality";
import type { Forecast } from "@/types/site";
import { AlertTriangle, Flag, MapPin, TrendingUp, Radio, Thermometer, Wind, Droplets, Gauge, Flame } from "lucide-react";
import { SourceComparison } from "@/components/dashboard/SourceComparison";
import { WhyButton } from "@/components/dashboard/WhyButton";
import { WaterTrend } from "@/components/dashboard/WaterTrend";
import { MlForecast } from "@/components/dashboard/MlForecast";
import { FloodExtent } from "@/components/dashboard/FloodExtent";
import { ExportPanel } from "@/components/dashboard/ExportPanel";
import { LegalAlerts } from "@/components/dashboard/LegalAlerts";
import { EventFeed } from "@/components/dashboard/EventFeed";
import { useRegion } from "@/store/useRegionStore";
import { MissingModulesNote, ModuleMissing } from "@/components/ui/ModuleMissing";
import { IndicatorHelp, IndicatorSummary, indicatorName } from "@/components/ui/IndicatorHelp";
import { LevelLegend } from "@/components/ui/LevelLegend";
import { missingModules, hasModule } from "@/data/regions";
import type { FloodSignal, MosquitoDynamics } from "@/hooks/useEcoData";

interface LiveEnv {
  fetchedAt: string;
  current: {
    temperature: number | null;
    humidity: number | null;
    windSpeed: number | null;
    pressure: number | null;
    pm2_5: number | null;
    pm10: number | null;
    no2: number | null;
    so2: number | null;
    ozone: number | null;
    dust: number | null;
    europeanAqi: number | null;
  };
  daily: { date: string; pm2_5: number; pm10: number }[];
  forecastHourly: { time: string; pm2_5: number | null; pm10: number | null; aqi: number | null }[];
}

interface FireData {
  fwi: number;
  isi: number;
  bui: number;
  ffmc: number;
  dmc: number;
  dc: number;
  danger: string;
  dangerLabel: string;
  dangerColor: string;
  spinupDays: number;
  source: string;
}

interface DroughtData {
  spi: number;
  precip3m: number;
  period: string;
  yearsOfRecord: number;
  droughtClass: string;
  droughtLabel: string;
  droughtColor: string;
}

interface ClimateData {
  years: { year: number; temp: number; precip: number }[];
  baseline: { period: string; temp: number; precip: number };
  future: { period: string; temp: number; precip: number };
  tempDelta: number;
  precipDeltaPct: number;
  model: string;
}

interface WaterData {
  years: { year: number; sm: number }[];
  slopePerDecadePct: number;
  baseline: number;
  recent: number;
  trend: string;
}

// WHO 2021 guideline: PM2.5 daily mean 15 µg/m³
// Тірі көрсеткіштер тақтасында тұратын индикаторлар — анықтамалары
// төменде толық тізіммен көрсетіледі (плитка ішіне сыймайды)
const LIVE_INDICATORS = ["aqi", "pm25", "pm10", "no2", "so2", "temperature", "wind", "humidity"];

const WHO_PM25_DAILY = 15;

const tooltipStyle = {
  backgroundColor: "#171717",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};

export default function DashboardPage() {
  const { tr } = useLang();
  // Таңдалған аймақ — барлық тірі дерек сол қала бойынша сұралады
  const region = useRegion();
  const rq = `?region=${region.id}`;
  const userSites = useSitesStore((s) => s.userSites);
  const allSites = userSites;
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [env, setEnv] = useState<LiveEnv | null>(null);
  const [envError, setEnvError] = useState(false);
  const [fire, setFire] = useState<FireData | null>(null);
  const [drought, setDrought] = useState<DroughtData | null>(null);
  const [climate, setClimate] = useState<ClimateData | null>(null);
  const [water, setWater] = useState<WaterData | null>(null);

  useEffect(() => {
    fetch(`/api/environment${rq}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEnv)
      .catch(() => setEnvError(true));
    fetch(`/api/fire${rq}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFire)
      .catch(() => setFire(null));
    fetch(`/api/drought${rq}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDrought)
      .catch(() => setDrought(null));
    fetch(`/api/climate${rq}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setClimate)
      .catch(() => setClimate(null));
    fetch(`/api/water${rq}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setWater)
      .catch(() => setWater(null));
    // Аймақ ауысса — барлық дерек қайта сұралады
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region.id]);

  // Forecast input: real history of the platform's own analyses, grouped by day
  const riskHistory = useMemo(() => {
    const byDay = new Map<string, number[]>();
    allSites.forEach((s) => {
      const day = s.createdAt.slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(s.analysis.riskScore);
    });
    return [...byDay.entries()]
      .map(([month, scores]) => ({
        month,
        score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [allSites]);

  useEffect(() => {
    if (riskHistory.length < 2) return;
    fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history: riskHistory }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) =>
        setForecast({
          trend: d.forecast.trend,
          points: [
            ...riskHistory.map((h) => ({ ...h, isProjection: false })),
            ...d.forecast.projectedScores.map((p: { month: string; score: number }) => ({ ...p, isProjection: true })),
          ],
          drivers: d.forecast.drivers,
          outlook: d.forecast.outlook,
        })
      )
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riskHistory.length]);

  const stats = useMemo(() => {
    const high = allSites.filter((s) => s.analysis.riskScore >= 55).length;
    const flagged = allSites.filter((s) => s.flagged).length;
    const avg = allSites.length
      ? Math.round(allSites.reduce((a, s) => a + s.analysis.riskScore, 0) / allSites.length)
      : 0;
    return { total: allSites.length, high, flagged, avg };
  }, [allSites]);

  const riskDist = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    allSites.forEach((s) => counts[s.analysis.riskLevel]++);
    return (Object.keys(counts) as (keyof typeof counts)[]).map((k) => ({
      level: RISK_LABELS_KZ[k],
      count: counts[k],
      color: RISK_COLORS[k],
    }));
  }, [allSites]);

  const issueBreakdown = useMemo(() => {
    let oil = 0, dump = 0, degrade = 0, water = 0;
    allSites.forEach((s) => {
      if (s.analysis.oilPollution) oil++;
      if (s.analysis.illegalDumping) dump++;
      if (s.analysis.landDegradation) degrade++;
      if (s.analysis.standingWater) water++;
    });
    return [
      { name: tr("Мұнай"), value: oil, color: "#0ea5e9" },
      { name: tr("Қоқыс"), value: dump, color: "#f97316" },
      { name: tr("Деградация"), value: degrade, color: "#eab308" },
      { name: tr("Тұрған су"), value: water, color: "#a855f7" },
    ];
  }, [allSites]);

  // District comparison computed from the platform's own analyses (live store)
  const districtLive = useMemo(() => {
    const by = new Map<string, number[]>();
    allSites.forEach((s) => {
      if (!by.has(s.district)) by.set(s.district, []);
      by.get(s.district)!.push(s.analysis.riskScore);
    });
    return [...by.entries()]
      .map(([district, scores]) => ({
        district,
        avgRisk: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        sites: scores.length,
      }))
      .sort((a, b) => b.avgRisk - a.avgRisk);
  }, [allSites]);

  // ⚠️ Бұрын мұнда `monthlyMosquitoForecast` тұрған — ол БАСҚА, ескі
  // формула еді (lib/mosquito.ts), сондықтан дашборд пен карта бір жер
  // үшін әртүрлі сан көрсететін. Енді екеуі де бір ғана JAIYQ-MRI
  // моделінен оқиды: /api/mosquitogrid → grid[].days.
  const mosMissing = !hasModule(region, "mosquito");
  const [mosDays, setMosDays] = useState<{ date: string; index: number; temp: number; rainMm: number }[] | null>(null);
  const [mosMeta, setMosMeta] = useState<{ avgIndex: number | null; maxIndex: number | null; points: number; flood: FloodSignal | null; dyn: MosquitoDynamics | null } | null>(null);
  const [mosLoadedFor, setMosLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (mosMissing || mosLoadedFor === region.id) return;
    fetch(`/api/mosquitogrid?region=${region.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        const grid = (d.grid ?? []) as { days?: { date: string; index: number; temp: number; rainMm: number }[] }[];
        // Тор бойынша орташа — облыстың жалпы бейнесі
        const n = grid[0]?.days?.length ?? 0;
        const days = Array.from({ length: n }, (_, i) => {
          const vals = grid.map((g) => g.days?.[i]).filter(Boolean) as { date: string; index: number; temp: number; rainMm: number }[];
          const avg = (k: "index" | "temp" | "rainMm") =>
            vals.length ? vals.reduce((a, v) => a + v[k], 0) / vals.length : 0;
          return {
            date: vals[0]?.date ?? "",
            index: Math.round(avg("index")),
            temp: +avg("temp").toFixed(1),
            rainMm: +avg("rainMm").toFixed(1),
          };
        });
        setMosDays(days);
        setMosMeta({
          avgIndex: d.avgIndex ?? null,
          maxIndex: d.maxIndex ?? null,
          points: d.gridPoints ?? grid.length,
          flood: d.floodSignal ?? null,
          dyn: d.dynamics ?? null,
        });
      })
      .catch(() => setMosDays([]))
      .finally(() => setMosLoadedFor(region.id));
  }, [region.id, mosMissing, mosLoadedFor]);

  const forecastChart = useMemo(() => {
    if (!forecast) return [];
    return forecast.points.map((p) => ({
      month: p.month.slice(5),
      тарих: p.isProjection ? undefined : p.score,
      болжам: p.isProjection ? p.score : undefined,
    }));
  }, [forecast]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{tr("Аймақтық аналитика")}</h1>
        <p className="text-sm text-neutral-400">{tr("Атырау облысының экологиялық жағдайы — нақты уақытта")}</p>
      </div>

      {/* LIVE environmental data — Open-Meteo / Copernicus CAMS */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
            <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
            {tr("Тірі мониторинг — Атырау қ.")}
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-normal text-emerald-300">
              {tr("Дереккөз: Open-Meteo + Copernicus CAMS (ЕО ресми атмосфера қызметі) · сағат сайын жаңарады")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {envError ? (
            <p className="text-sm text-neutral-400">
              {tr("Тірі деректер уақытша қолжетімсіз — дереккөзге қосылу мүмкін болмады. Жалған дерек көрсетілмейді.")}
            </p>
          ) : !env ? (
            <p className="text-sm text-neutral-500">{tr("Тірі деректер жүктелуде…")}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                <LiveStat icon={Thermometer} label={tr("Температура")} value={env.current.temperature} unit="°C" indicatorId="temperature" />
                <LiveStat icon={Wind} label={tr("Жел")} value={env.current.windSpeed} unit="км/сағ" indicatorId="wind" />
                <LiveStat icon={Droplets} label={tr("Ылғалдылық")} value={env.current.humidity} unit="%" indicatorId="humidity" />
                <LiveStat icon={Gauge} label="EU AQI" value={env.current.europeanAqi} unit="" highlight={(env.current.europeanAqi ?? 0) > 50} indicatorId="aqi" />
                <LiveStat label="PM2.5" value={env.current.pm2_5} unit="µg/m³" highlight={(env.current.pm2_5 ?? 0) > WHO_PM25_DAILY} indicatorId="pm25" />
                <LiveStat label="PM10" value={env.current.pm10} unit="µg/m³" indicatorId="pm10" />
                <LiveStat label="NO₂" value={env.current.no2} unit="µg/m³" indicatorId="no2" />
                <LiveStat label="SO₂" value={env.current.so2} unit="µg/m³" indicatorId="so2" />
              </div>
              {env.current.europeanAqi != null && (() => {
                const cat = aqiCategory(env.current.europeanAqi);
                return (
                  <div
                    className="mt-2 flex items-center gap-3 rounded-lg p-2.5"
                    style={{ backgroundColor: `${cat.color}18`, border: `1px solid ${cat.color}44` }}
                  >
                    <span className="text-lg font-bold" style={{ color: cat.color }}>
                      {cat.name}
                    </span>
                    <p className="text-[11px] text-neutral-300">
                      🩺 {cat.advice} <span className="text-neutral-400">{cat.sensitiveAdvice}</span>
                    </p>
                  </div>
                );
              })()}
              {/* КӨРСЕТКІШТЕР НЕНІ БІЛДІРЕДІ — плиткалар кішкентай
                  болғандықтан анықтамалар осында, толық тізіммен тұрады */}
              <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  {tr("Көрсеткіштер нені білдіреді")}
                </div>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {LIVE_INDICATORS.map((id) => (
                    <div key={id}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-medium text-neutral-200">
                          {indicatorName(id) ?? id}
                        </span>
                        <IndicatorHelp id={id} />
                      </div>
                      <IndicatorSummary id={id} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-2.5">
                <LevelLegend defaultOpen />
              </div>
              <p className="mt-2 text-[10px] text-neutral-500">
                Соңғы жаңару: {new Date(env.fetchedAt).toLocaleString("kk-KZ")} ·{" "}
                {tr("әр көрсеткіштің жанындағы ⓘ — сол сан нені білдіретіні")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Бұл қалада ҚАНДАЙ модуль жоқ — алдын ала ашық жазылады, сонда
          төмендегі бос блоктар «бәрі тыныш» деп оқылмайды */}
      <MissingModulesNote region={region} modules={missingModules(region)} />

      {/* Заңнамалық сәйкестік — ҚР/WHO/EU нормаларынан асу (ең жоғарыда) */}
      <LegalAlerts />

      {/* Оқиғалар таспасы — нақты дерек нүктелері, уақыт бойынша */}
      <EventFeed limit={12} />

      {/* AI «Неге?» — бүгінгі ауаны тірі деректермен түсіндіру */}
      <WhyButton />

      {/* Дереккөздерді салыстыру — CAMS моделі vs Qazhydromet датчигі */}
      <SourceComparison />

      {/* Су басқан аумақ — Sentinel-1 радарымен ӨЛШЕНГЕН км² */}
      <FloodExtent />

      {/* Эколог есебі үшін CSV экспорт + сенімділік деңгейлерінің легендасы */}
      <ExportPanel />

      {/* Су деңгейінің өзгерісі — Жайық өзені 2020→қазір (GloFAS) */}
      <WaterTrend />

      {/* JAIYQ-ML — CAMS шегінен әрі созылған 11 күндік ауа болжамы */}
      <MlForecast />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={MapPin} label={tr("Талданған нүктелер")} value={stats.total} color="text-sky-400" />
        <Kpi icon={AlertTriangle} label={tr("Жоғары тәуекел")} value={stats.high} color="text-orange-400" />
        <Kpi icon={Flag} label={tr("Тексеруге белгіленген")} value={stats.flagged} color="text-red-400" />
        <Kpi icon={TrendingUp} label={tr("Орташа тәуекел")} value={stats.avg} color="text-emerald-400" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-white/5">
          <TabsTrigger value="overview">{tr("Шолу")}</TabsTrigger>
          <TabsTrigger value="rating">{tr("Рейтинг")}</TabsTrigger>
          <TabsTrigger value="heatmap">{tr("Жылу картасы")}</TabsTrigger>
          <TabsTrigger value="forecast">{tr("Болжам")}</TabsTrigger>
          <TabsTrigger value="climate">{tr("Климат болашағы")}</TabsTrigger>
          <TabsTrigger value="mosquito">{tr("Маса")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          {fire && <FireDangerCard fire={fire} />}
          {drought && <DroughtCard drought={drought} />}

          <ChartCard title={tr("Тәуекел деңгейлері бойынша")}>
            <BarChart data={riskDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="level" stroke="#737373" fontSize={12} />
              <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" name={tr("Нүктелер")} radius={[6, 6, 0, 0]}>
                {riskDist.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title={tr("Мәселе түрлері")}>
            <PieChart>
              <Pie data={issueBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {issueBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title={tr("Аудандар бойынша орташа тәуекел (платформа талдаулары)")}>
            <BarChart data={districtLive} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} stroke="#737373" fontSize={12} />
              <YAxis type="category" dataKey="district" stroke="#737373" fontSize={11} width={90} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="avgRisk" name={tr("Орташа тәуекел")} fill="#f97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartCard>

          {env && env.forecastHourly?.length > 0 && (
            <ChartCard
              title={tr("Ауа сапасы болжамы — алдағы 48 сағат (Copernicus CAMS моделі)")}
              className="lg:col-span-2"
            >
              <LineChart
                data={env.forecastHourly.map((h) => ({
                  ...h,
                  time: h.time.slice(5, 13).replace("T", " "),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="time" stroke="#737373" fontSize={10} interval={5} />
                <YAxis stroke="#737373" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={WHO_PM25_DAILY}
                  stroke="#22c55e"
                  strokeDasharray="6 4"
                  label={{ value: tr("ДДСҰ PM2.5 шегі"), fill: "#22c55e", fontSize: 11 }}
                />
                <Line type="monotone" dataKey="aqi" name="EU AQI" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm2_5" name="PM2.5 µg/m³" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm10" name="PM10 µg/m³" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
          )}

          {env && env.daily.length > 0 && (
            <ChartCard
              title={tr("Ауа сапасы — соңғы 30 күн, нақты өлшем (Copernicus CAMS)")}
              className="lg:col-span-2"
            >
              <AreaChart data={env.daily.map((d) => ({ ...d, date: d.date.slice(5) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="#737373" fontSize={10} interval={3} />
                <YAxis stroke="#737373" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  y={WHO_PM25_DAILY}
                  stroke="#22c55e"
                  strokeDasharray="6 4"
                  label={{ value: tr("ДДСҰ PM2.5 шегі"), fill: "#22c55e", fontSize: 11 }}
                />
                <Area type="monotone" dataKey="pm2_5" name="PM2.5 µg/m³" stroke="#38bdf8" fill="#38bdf833" strokeWidth={2} />
                <Area type="monotone" dataKey="pm10" name="PM10 µg/m³" stroke="#f97316" fill="#f9731622" strokeWidth={2} />
              </AreaChart>
            </ChartCard>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="mt-4 space-y-4">
          <ChartCard title={tr("Аймақтық тәуекел: тарих + 6 айлық AI болжамы")}>
            <LineChart data={forecastChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#737373" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#737373" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="тарих" name={tr("тарих")} stroke="#38bdf8" strokeWidth={2} dot />
              <Line type="monotone" dataKey="болжам" name={tr("болжам")} stroke="#f97316" strokeWidth={2} strokeDasharray="7 5" dot />
            </LineChart>
          </ChartCard>
          {forecast && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader><CardTitle className="text-sm text-white">{tr("AI қорытындысы")}</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-300">{forecast.outlook}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Тренд: <b className={forecast.trend === "degrading" ? "text-red-400" : forecast.trend === "improving" ? "text-emerald-400" : "text-yellow-400"}>
                      {forecast.trend === "degrading" ? tr("Нашарлау") : forecast.trend === "improving" ? tr("Жақсару") : tr("Тұрақты")}
                    </b>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader><CardTitle className="text-sm text-white">{tr("Негізгі факторлар")}</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {forecast.drivers.map((d, i) => (
                      <li key={i} className="flex gap-2 text-sm text-neutral-300">
                        <span className="text-orange-400">•</span> {d}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* District Eco-Rating tab */}
        <TabsContent value="rating" className="mt-4 space-y-4">
          <DistrictRating allSites={allSites} env={env} />
        </TabsContent>

        {/* Weekly heatmap tab */}
        <TabsContent value="heatmap" className="mt-4 space-y-4">
          <WeeklyHeatmap allSites={allSites} />
        </TabsContent>

        <TabsContent value="mosquito" className="mt-4 space-y-4">
          {mosMissing ? (
            <ModuleMissing module="mosquito" region={region} />
          ) : (
            <>
              <div className="mb-2">
                <IndicatorHelp id="mri" inline />
              </div>

              {/* Тасқын импульсі — модельдің ажыратқышы */}
              {mosMeta?.flood && (
                <Card
                  className={
                    mosMeta.flood.available
                      ? "border-sky-500/20 bg-sky-500/[0.05]"
                      : "border-amber-500/20 bg-amber-500/[0.05]"
                  }
                >
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Droplets className={`h-4 w-4 ${mosMeta.flood.available ? "text-sky-400" : "text-amber-400"}`} />
                      <span className="text-sm font-semibold text-white">{tr("Тасқын импульсі")}</span>
                      {mosMeta.flood.value != null && (
                        <span className="text-lg font-bold text-sky-300">
                          {Math.round(mosMeta.flood.value * 100)}%
                        </span>
                      )}
                      {mosMeta.flood.hydroperiodDaysMax != null && (
                        <span className="rounded border border-sky-400/25 bg-sky-500/10 px-2 py-0.5 text-[11px] text-sky-200">
                          {tr("гидропериод")} ≥ {mosMeta.flood.hydroperiodDaysMax} {tr("күн")}
                        </span>
                      )}
                      {mosMeta.flood.reedMax != null && (
                        <span className="rounded border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-200">
                          {tr("қамыс мекені")} {Math.round(mosMeta.flood.reedMax * 100)}%
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                      {mosMeta.flood.note}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Массалық шығу болжамы — модельдің ең пайдалы шығысы */}
              {mosMeta?.dyn?.emergencePeak && (
                <Card className="border-purple-500/25 bg-purple-500/[0.07]">
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-purple-200">
                        🦟 {tr("Күтілетін массалық шығу")}:
                      </span>
                      <span className="text-lg font-bold text-white">
                        {mosMeta.dyn.emergencePeak.date}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
                      {mosMeta.dyn.note}
                    </p>
                    <p className="mt-1 text-[10px] text-neutral-500">
                      {tr("Динамикалық интеграция")}: {mosMeta.dyn.pointsWithOde}/{mosMeta.dyn.pointsTotal}{" "}
                      {tr("нүктеде")}
                    </p>
                  </CardContent>
                </Card>
              )}

              <ChartCard
                title={tr("Маса индексінің 7 күндік болжамы — JAIYQ-MRI (тор бойынша орташа)")}
              >
                <AreaChart data={mosDays ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" stroke="#737373" fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
                  <YAxis domain={[0, 100]} stroke="#737373" fontSize={12} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine y={62} stroke="#f97316" strokeDasharray="6 4" label={{ value: tr("Жоғары"), fill: "#f97316", fontSize: 11 }} />
                  <Area type="monotone" dataKey="index" name={tr("Маса индексі")} stroke="#a855f7" fill="#a855f733" strokeWidth={2} />
                </AreaChart>
              </ChartCard>

              <Card className="border-purple-500/20 bg-purple-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm leading-relaxed text-neutral-300">
                    🦟 <b className="text-purple-300">{tr("Бұл график — картадағы дәл сол модель.")}</b>{" "}
                    {mosMeta?.points ?? 0} {tr("есептелген нүктенің тәуліктік орташасы.")}{" "}
                    {tr("Мамыр–шілде — Жайық тасқыны кезеңі: су басу жұмыртқа банкін жарады, сондықтан индекс сол кезде шыңға шығады.")}
                  </p>
                  <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-neutral-500">
                    {tr("Индекс — климаттық ҚОЛАЙЛЫЛЫҚ, маса САНЫ емес. Тұзақ деректері жоқ болғандықтан модель валидацияланбаған.")}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="climate" className="mt-4 space-y-4">
          {!climate && !water && (
            <p className="py-8 text-center text-sm text-neutral-500">{tr("Климат деректері жүктелуде…")}</p>
          )}

          {climate && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-orange-500/20 bg-orange-500/5">
                  <CardContent className="pt-4 text-center">
                    <div className="text-3xl font-bold text-orange-400">+{climate.tempDelta}°C</div>
                    <div className="mt-1 text-xs text-neutral-400">{tr("2050 жылға температура")}</div>
                  </CardContent>
                </Card>
                <Card className="border-sky-500/20 bg-sky-500/5">
                  <CardContent className="pt-4 text-center">
                    <div className={`text-3xl font-bold ${climate.precipDeltaPct < 0 ? "text-red-400" : "text-sky-400"}`}>
                      {climate.precipDeltaPct > 0 ? "+" : ""}{climate.precipDeltaPct}%
                    </div>
                    <div className="mt-1 text-xs text-neutral-400">{tr("Жауын-шашын өзгерісі")}</div>
                  </CardContent>
                </Card>
                <Card className="border-white/10 bg-white/[0.03]">
                  <CardContent className="pt-4 text-center">
                    <div className="text-lg font-bold text-white">{climate.baseline.temp}° → {climate.future.temp}°C</div>
                    <div className="mt-1 text-xs text-neutral-400">{climate.baseline.period} → {climate.future.period}</div>
                  </CardContent>
                </Card>
              </div>

              <ChartCard title={tr("Жылдық орташа температура: 2000–2050 (IPCC CMIP6 проекциясы)")}>
                <LineChart data={climate.years}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="year" stroke="#737373" fontSize={10} interval={4} />
                  <YAxis stroke="#737373" fontSize={12} unit="°" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <ReferenceLine x={2025} stroke="#a855f7" strokeDasharray="4 4" label={{ value: "бүгін", fill: "#a855f7", fontSize: 10 }} />
                  <Line type="monotone" dataKey="temp" name={tr("Орташа темп. °C")} stroke="#f97316" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
              <p className="text-[11px] text-neutral-500">
                Дереккөз: Open-Meteo Climate · IPCC CMIP6 HighResMIP (MRI-AGCM3-2-S) даунскейлингі.
              </p>
            </>
          )}

          {water && (
            <>
              <Card className={`${water.trend === "drying" ? "border-amber-500/30 bg-amber-500/5" : "border-sky-500/20 bg-sky-500/5"}`}>
                <CardContent className="pt-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Droplets className={`h-7 w-7 ${water.trend === "drying" ? "text-amber-400" : "text-sky-400"}`} />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white">{tr("Жер су қоры трендісі (GRACE баламасы)")}</h3>
                      <p className="text-[11px] text-neutral-500">{tr("ERA5 топырақ су қоры (0–100 см) · Open-Meteo архиві")}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${water.slopePerDecadePct < 0 ? "text-amber-400" : "text-sky-400"}`}>
                        {water.slopePerDecadePct > 0 ? "+" : ""}{water.slopePerDecadePct}%
                      </div>
                      <div className="text-xs text-neutral-400">{tr("онжылдықта")}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <ChartCard title={tr("Жер су қорының өзгерісі: 1995–қазір (ERA5 топырақ ылғалы)")}>
                <AreaChart data={water.years}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="year" stroke="#737373" fontSize={10} interval={3} />
                  <YAxis stroke="#737373" fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="sm" name={tr("Топырақ су қоры (м³/м³)")} stroke="#38bdf8" fill="#38bdf833" strokeWidth={2} />
                </AreaChart>
              </ChartCard>
              <Card className="border-amber-500/20 bg-amber-500/5">
                <CardContent className="pt-4">
                  <p className="text-sm text-neutral-300">
                    💧 <b className="text-amber-300">{tr("Қорытынды:")}</b> CMIP6 моделі бойынша Атырау 2050 жылға қарай{" "}
                    <b className="text-orange-300">+{climate?.tempDelta ?? "—"}°C</b> жылынады, ал жер су қоры соңғы
                    онжылдықтарда <b className="text-amber-300">{water.slopePerDecadePct}%/онжылдық</b> азайып келеді
                    ({water.trend === "drying" ? "құрғау трендісі" : "тұрақты"}). Бұл — өрт, құрғақшылық пен
                    шөлейттену тәуекелін арттыратын фактор.
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LiveStat({
  icon: Icon,
  label,
  value,
  unit,
  highlight,
  indicatorId,
}: {
  icon?: React.ElementType;
  label: string;
  value: number | null;
  unit: string;
  highlight?: boolean;
  /** indicatorRegistry идентификаторы — ⓘ басқанда анықтамасы ашылады */
  indicatorId?: string;
}) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? "bg-red-500/10" : "bg-white/5"}`}>
      <div className="flex flex-wrap items-center gap-1 text-[10px] text-neutral-400">
        {Icon && <Icon className="h-3 w-3" />} {label}
        {indicatorId && <IndicatorHelp id={indicatorId} />}
      </div>
      <div className={`text-base font-bold ${highlight ? "text-red-300" : "text-white"}`}>
        {value != null ? value : "—"}
        <span className="ml-0.5 text-[10px] font-normal text-neutral-500">{unit}</span>
      </div>
    </div>
  );
}

function FireDangerCard({ fire }: { fire: FireData }) {
  const { tr } = useLang();
  // Шкала: FWI 0–50+ (EFFIS). Көрсеткіш үшін 60-қа дейін нормалаймыз.
  const pct = Math.min(100, (fire.fwi / 60) * 100);
  const components = [
    { label: "ISI", value: fire.isi, hint: tr("Бастапқы тарау индексі") },
    { label: "BUI", value: fire.bui, hint: tr("Жиналу индексі") },
    { label: "FFMC", value: fire.ffmc, hint: tr("Жеңіл отын ылғалы") },
    { label: "DC", value: fire.dc, hint: tr("Құрғақшылық коды") },
  ];
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${fire.dangerColor}22`, border: `1px solid ${fire.dangerColor}55` }}
          >
            <Flame className="h-6 w-6" style={{ color: fire.dangerColor }} />
          </div>
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white">
              {tr("Дала/орман өрті қаупі — FWI")}
              <IndicatorHelp id="fwi" />
            </h3>
            <p className="text-[11px] text-neutral-500">
              Канада FWI жүйесі (EFFIS) · {fire.spinupDays} күндік нақты ауа райынан есептелді
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: fire.dangerColor }}>
              {fire.fwi}
            </div>
            <div className="text-xs font-medium" style={{ color: fire.dangerColor }}>
              {fire.dangerLabel}
            </div>
          </div>
        </div>

        {/* Қауіп шкаласы */}
        <div className="mb-3 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: fire.dangerColor }} />
        </div>

        {/* Құрамдас индекстер */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {components.map((c) => (
            <div key={c.label} className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
              <div className="text-base font-bold text-white">{c.value}</div>
              <div className="text-[10px] font-medium text-neutral-300">{c.label}</div>
              <div className="text-[9px] text-neutral-500">{c.hint}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-neutral-600">
          Шкала: &lt;5 өте төмен · 5–11 төмен · 11–21 орташа · 21–38 жоғары · 38–50 өте жоғары · 50+ аса қауіпті
        </p>
      </CardContent>
    </Card>
  );
}

function DroughtCard({ drought }: { drought: DroughtData }) {
  const { tr } = useLang();
  // SPI шкаласы −3…+3 → 0–100% (көрсеткіш орналасуы)
  const pos = Math.min(100, Math.max(0, ((drought.spi + 3) / 6) * 100));
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${drought.droughtColor}22`, border: `1px solid ${drought.droughtColor}55` }}
          >
            <Droplets className="h-6 w-6" style={{ color: drought.droughtColor }} />
          </div>
          <div className="flex-1">
            <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-white">
              {tr("Құрғақшылық индексі — SPI-3")}
              <IndicatorHelp id="spi" />
            </h3>
            <p className="text-[11px] text-neutral-500">
              McKee 1993 (WMO) · {drought.yearsOfRecord} жылдық ERA5 климатологиясы
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: drought.droughtColor }}>
              {drought.spi > 0 ? "+" : ""}{drought.spi}
            </div>
            <div className="text-xs font-medium" style={{ color: drought.droughtColor }}>
              {drought.droughtLabel}
            </div>
          </div>
        </div>

        {/* SPI шкаласы: құрғақ ← қалыпты → ылғалды */}
        <div className="relative mb-1 h-2.5 w-full overflow-hidden rounded-full"
          style={{ background: "linear-gradient(90deg,#dc2626,#f97316,#eab308,#22c55e,#60a5fa,#1d4ed8)" }}>
          <div className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-white shadow" style={{ left: `${pos}%` }} />
        </div>
        <div className="mb-3 flex justify-between text-[9px] text-neutral-500">
          <span>{tr("Құрғақ (−3)")}</span><span>{tr("Қалыпты (0)")}</span><span>{tr("Ылғалды (+3)")}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
            <div className="text-base font-bold text-white">{drought.precip3m} мм</div>
            <div className="text-[10px] font-medium text-neutral-300">{tr("3-айлық жауын")}</div>
            <div className="text-[9px] text-neutral-500">{drought.period} кезеңі</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-2.5">
            <div className="text-base font-bold text-white">{drought.yearsOfRecord}</div>
            <div className="text-[10px] font-medium text-neutral-300">{tr("Климат жылдары")}</div>
            <div className="text-[9px] text-neutral-500">{tr("ERA5 архиві")}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <Card className="border-white/10 bg-white/[0.03]">
      <CardContent className="flex items-center gap-3 pt-4">
        <Icon className={`h-7 w-7 ${color}`} />
        <div>
          <div className="text-2xl font-bold text-white">{value}</div>
          <div className="text-xs text-neutral-400">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const DISTRICT_LIST = [
  "Атырау қаласы",
  "Жылыой ауданы",
  "Индер ауданы",
  "Исатай ауданы",
  "Қызылқоға ауданы",
  "Мақат ауданы",
  "Махамбет ауданы",
  "Құрманғазы ауданы",
];

function DistrictRating({ allSites, env }: { allSites: { district: string; analysis: { riskScore: number } }[]; env: LiveEnv | null }) {
  const { tr } = useLang();
  // Build rating from own analyses + add base air quality context
  const byDistrict = useMemo(() => {
    const map = new Map<string, number[]>();
    DISTRICT_LIST.forEach((d) => map.set(d, []));
    allSites.forEach((s) => {
      const d = s.district;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(s.analysis.riskScore);
    });
    return DISTRICT_LIST.map((d) => {
      const scores = map.get(d) ?? [];
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      return { name: d, avg, count: scores.length };
    }).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
  }, [allSites]);

  const aqi = env?.current?.europeanAqi;

  return (
    <div className="space-y-4">
      {aqi != null && (
        <Card className="border-sky-500/20 bg-sky-500/5">
          <CardContent className="pt-4">
            <p className="text-sm text-neutral-300">
              Қазіргі Атырау EU AQI:{" "}
              <span className={`font-bold ${aqi > 50 ? "text-orange-400" : "text-emerald-400"}`}>{aqi}</span>
              {" "}— Copernicus CAMS тірі деректері бойынша.
            </p>
          </CardContent>
        </Card>
      )}
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-sm text-white">{tr("Аудандардың эко-рейтингі")}</CardTitle>
        </CardHeader>
        <CardContent>
          {byDistrict.filter((d) => d.avg !== null).length === 0 ? (
            <p className="text-sm text-neutral-400">
              Аудандар бойынша деректер жоқ. Картада аудандарды талдасаңыз, рейтинг осында жаңарады.
            </p>
          ) : (
            <div className="space-y-2">
              {byDistrict.map((d, i) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="w-5 text-right text-xs text-neutral-500">{i + 1}</span>
                  <span className="w-40 truncate text-sm text-neutral-300">{d.name}</span>
                  <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{
                        width: `${d.avg ?? 0}%`,
                        backgroundColor: (d.avg ?? 0) >= 70 ? "#ef4444" : (d.avg ?? 0) >= 40 ? "#f97316" : "#22c55e",
                      }}
                    />
                  </div>
                  <span
                    className="w-12 text-right text-sm font-bold"
                    style={{ color: (d.avg ?? 0) >= 70 ? "#ef4444" : (d.avg ?? 0) >= 40 ? "#f97316" : "#22c55e" }}
                  >
                    {d.avg ?? "—"}
                  </span>
                  <span className="text-xs text-neutral-600">({d.count} талдау)</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-xs text-neutral-500">
        Рейтинг платформаның өз AI талдауларынан есептеледі. Картада аудандарды нүктелесеңіз, рейтинг
        нақты деректермен толығады. Балл — 0 (таза) – 100 (критикалық).
      </p>
    </div>
  );
}

function WeeklyHeatmap({ allSites }: { allSites: { createdAt: string; analysis: { riskScore: number } }[] }) {
  const { tr } = useLang();
  const today = new Date();
  // Build 12 weeks × 7 days grid
  const cells = useMemo(() => {
    const scoreByDay = new Map<string, number[]>();
    allSites.forEach((s) => {
      const day = s.createdAt.slice(0, 10);
      if (!scoreByDay.has(day)) scoreByDay.set(day, []);
      scoreByDay.get(day)!.push(s.analysis.riskScore);
    });
    const grid: { date: string; score: number | null }[] = [];
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const scores = scoreByDay.get(key) ?? [];
      grid.push({
        date: key,
        score: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      });
    }
    return grid;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSites]);

  function cellColor(score: number | null) {
    if (score === null) return "bg-white/5";
    if (score >= 70) return "bg-red-500";
    if (score >= 50) return "bg-orange-500";
    if (score >= 30) return "bg-yellow-500";
    return "bg-emerald-500";
  }

  const weeks: typeof cells[] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <div className="space-y-4">
      <Card className="border-white/10 bg-white/[0.03]">
        <CardHeader>
          <CardTitle className="text-sm text-white">{tr("Апталық тәуекел жылу картасы — соңғы 12 апта")}</CardTitle>
        </CardHeader>
        <CardContent>
          {allSites.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Деректер жоқ. Картада нүктелерді AI талдасаңыз, жылу картасы толығады.
            </p>
          ) : (
            <>
              <div className="flex gap-1">
                {weeks.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-1">
                    {week.map((cell) => (
                      <div
                        key={cell.date}
                        title={`${cell.date}: ${cell.score ?? "деректер жоқ"}`}
                        className={`h-3.5 w-3.5 rounded-sm ${cellColor(cell.score)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-3 text-[11px] text-neutral-500">
                <span>{tr("Тәуекел деңгейі:")}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-emerald-500 inline-block" />{tr("Төмен")}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-yellow-500 inline-block" />{tr("Орташа")}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-orange-500 inline-block" />{tr("Жоғары")}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-red-500 inline-block" />{tr("Критикалық")}</span>
                <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-white/5 inline-block" />{tr("Деректер жоқ")}</span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactElement; className?: string }) {
  return (
    <Card className={`border-white/10 bg-white/[0.03] ${className}`}>
      <CardHeader className="pb-2"><CardTitle className="text-sm text-white">{title}</CardTitle></CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
