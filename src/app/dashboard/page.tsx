"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSitesStore } from "@/store/useSitesStore";
import { RISK_COLORS, RISK_LABELS_KZ } from "@/lib/risk";
import { monthlyMosquitoForecast } from "@/lib/mosquito";
import { aqiCategory } from "@/lib/airQuality";
import type { Forecast } from "@/types/site";
import { AlertTriangle, Flag, MapPin, TrendingUp, Radio, Thermometer, Wind, Droplets, Gauge } from "lucide-react";

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

// WHO 2021 guideline: PM2.5 daily mean 15 µg/m³
const WHO_PM25_DAILY = 15;

const tooltipStyle = {
  backgroundColor: "#171717",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 8,
  fontSize: 12,
};

export default function DashboardPage() {
  const userSites = useSitesStore((s) => s.userSites);
  const allSites = userSites;
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [env, setEnv] = useState<LiveEnv | null>(null);
  const [envError, setEnvError] = useState(false);

  useEffect(() => {
    fetch("/api/environment")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setEnv)
      .catch(() => setEnvError(true));
  }, []);

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
      .then((r) => r.json())
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
      { name: "Мұнай", value: oil, color: "#0ea5e9" },
      { name: "Қоқыс", value: dump, color: "#f97316" },
      { name: "Деградация", value: degrade, color: "#eab308" },
      { name: "Тұрған су", value: water, color: "#a855f7" },
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

  const mosquitoSeason = useMemo(() => monthlyMosquitoForecast(47.12, 51.9, true), []);

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
        <h1 className="text-2xl font-bold text-white">Аймақтық аналитика</h1>
        <p className="text-sm text-neutral-400">Атырау облысының экологиялық жағдайы — нақты уақытта</p>
      </div>

      {/* LIVE environmental data — Open-Meteo / Copernicus CAMS */}
      <Card className="border-emerald-500/20 bg-emerald-500/[0.04]">
        <CardHeader className="pb-2">
          <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-white">
            <Radio className="h-4 w-4 animate-pulse text-emerald-400" />
            Тірі мониторинг — Атырау қ.
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-normal text-emerald-300">
              Дереккөз: Open-Meteo + Copernicus CAMS (ЕО ресми атмосфера қызметі) · сағат сайын жаңарады
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {envError ? (
            <p className="text-sm text-neutral-400">
              Тірі деректер уақытша қолжетімсіз — дереккөзге қосылу мүмкін болмады. Жалған дерек көрсетілмейді.
            </p>
          ) : !env ? (
            <p className="text-sm text-neutral-500">Тірі деректер жүктелуде…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                <LiveStat icon={Thermometer} label="Температура" value={env.current.temperature} unit="°C" />
                <LiveStat icon={Wind} label="Жел" value={env.current.windSpeed} unit="км/сағ" />
                <LiveStat icon={Droplets} label="Ылғалдылық" value={env.current.humidity} unit="%" />
                <LiveStat icon={Gauge} label="EU AQI" value={env.current.europeanAqi} unit="" highlight={(env.current.europeanAqi ?? 0) > 50} />
                <LiveStat label="PM2.5" value={env.current.pm2_5} unit="µg/m³" highlight={(env.current.pm2_5 ?? 0) > WHO_PM25_DAILY} />
                <LiveStat label="PM10" value={env.current.pm10} unit="µg/m³" />
                <LiveStat label="NO₂" value={env.current.no2} unit="µg/m³" />
                <LiveStat label="SO₂" value={env.current.so2} unit="µg/m³" />
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
              <p className="mt-2 text-[10px] text-neutral-500">
                Соңғы жаңару: {new Date(env.fetchedAt).toLocaleString("kk-KZ")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={MapPin} label="Талданған нүктелер" value={stats.total} color="text-sky-400" />
        <Kpi icon={AlertTriangle} label="Жоғары тәуекел" value={stats.high} color="text-orange-400" />
        <Kpi icon={Flag} label="Тексеруге белгіленген" value={stats.flagged} color="text-red-400" />
        <Kpi icon={TrendingUp} label="Орташа тәуекел" value={stats.avg} color="text-emerald-400" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="bg-white/5">
          <TabsTrigger value="overview">Шолу</TabsTrigger>
          <TabsTrigger value="forecast">🔮 Болжам</TabsTrigger>
          <TabsTrigger value="mosquito">🦟 Маса</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-2">
          <ChartCard title="Тәуекел деңгейлері бойынша">
            <BarChart data={riskDist}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="level" stroke="#737373" fontSize={12} />
              <YAxis stroke="#737373" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="count" name="Нүктелер" radius={[6, 6, 0, 0]}>
                {riskDist.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ChartCard>

          <ChartCard title="Мәселе түрлері">
            <PieChart>
              <Pie data={issueBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {issueBreakdown.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ChartCard>

          <ChartCard title="Аудандар бойынша орташа тәуекел (платформа талдаулары)">
            <BarChart data={districtLive} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" domain={[0, 100]} stroke="#737373" fontSize={12} />
              <YAxis type="category" dataKey="district" stroke="#737373" fontSize={11} width={90} />
              <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey="avgRisk" name="Орташа тәуекел" fill="#f97316" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartCard>

          {env && env.forecastHourly?.length > 0 && (
            <ChartCard
              title="Ауа сапасы болжамы — алдағы 48 сағат (Copernicus CAMS моделі)"
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
                  label={{ value: "ДДСҰ PM2.5 шегі", fill: "#22c55e", fontSize: 11 }}
                />
                <Line type="monotone" dataKey="aqi" name="EU AQI" stroke="#a855f7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm2_5" name="PM2.5 µg/m³" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm10" name="PM10 µg/m³" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartCard>
          )}

          {env && env.daily.length > 0 && (
            <ChartCard
              title="Ауа сапасы — соңғы 30 күн, нақты өлшем (Copernicus CAMS)"
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
                  label={{ value: "ДДСҰ PM2.5 шегі", fill: "#22c55e", fontSize: 11 }}
                />
                <Area type="monotone" dataKey="pm2_5" name="PM2.5 µg/m³" stroke="#38bdf8" fill="#38bdf833" strokeWidth={2} />
                <Area type="monotone" dataKey="pm10" name="PM10 µg/m³" stroke="#f97316" fill="#f9731622" strokeWidth={2} />
              </AreaChart>
            </ChartCard>
          )}
        </TabsContent>

        <TabsContent value="forecast" className="mt-4 space-y-4">
          <ChartCard title="Аймақтық тәуекел: тарих + 6 айлық AI болжамы">
            <LineChart data={forecastChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#737373" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#737373" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="тарих" stroke="#38bdf8" strokeWidth={2} dot />
              <Line type="monotone" dataKey="болжам" stroke="#f97316" strokeWidth={2} strokeDasharray="7 5" dot />
            </LineChart>
          </ChartCard>
          {forecast && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader><CardTitle className="text-sm text-white">AI қорытындысы</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm text-neutral-300">{forecast.outlook}</p>
                  <p className="mt-2 text-xs text-neutral-500">
                    Тренд: <b className={forecast.trend === "degrading" ? "text-red-400" : forecast.trend === "improving" ? "text-emerald-400" : "text-yellow-400"}>
                      {forecast.trend === "degrading" ? "Нашарлау" : forecast.trend === "improving" ? "Жақсару" : "Тұрақты"}
                    </b>
                  </p>
                </CardContent>
              </Card>
              <Card className="border-white/10 bg-white/[0.03]">
                <CardHeader><CardTitle className="text-sm text-white">Негізгі факторлар</CardTitle></CardHeader>
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

        <TabsContent value="mosquito" className="mt-4 space-y-4">
          <ChartCard title="Маса белсенділігінің маусымдық болжамы — математикалық модель (тасқын маусымы + климат)">
            <AreaChart data={mosquitoSeason}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" stroke="#737373" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="#737373" fontSize={12} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="6 4" label={{ value: "Пик деңгейі", fill: "#ef4444", fontSize: 11 }} />
              <Area type="monotone" dataKey="index" name="Маса индексі" stroke="#a855f7" fill="#a855f733" strokeWidth={2} />
            </AreaChart>
          </ChartCard>
          <Card className="border-purple-500/20 bg-purple-500/5">
            <CardContent className="pt-4">
              <p className="text-sm text-neutral-300">
                🦟 <b className="text-purple-300">Маусымдық ескерту:</b> мамыр–шілде — Жайық тасқыны кезеңі,
                жайылмадағы тұрған су айдындары маса көбеюінің басты ошағы. Картадағы «Маса қабатын» қосып,
                тәуекелді аймақтарды көріңіз. Өзенге жақын, тұрған суы бар нүктелерде индекс ең жоғары.
              </p>
            </CardContent>
          </Card>
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
}: {
  icon?: React.ElementType;
  label: string;
  value: number | null;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg p-2.5 ${highlight ? "bg-red-500/10" : "bg-white/5"}`}>
      <div className="flex items-center gap-1 text-[10px] text-neutral-400">
        {Icon && <Icon className="h-3 w-3" />} {label}
      </div>
      <div className={`text-base font-bold ${highlight ? "text-red-300" : "text-white"}`}>
        {value != null ? value : "—"}
        <span className="ml-0.5 text-[10px] font-normal text-neutral-500">{unit}</span>
      </div>
    </div>
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
