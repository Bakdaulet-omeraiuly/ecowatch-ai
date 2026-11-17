"use client";

import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Factory, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { BUCKETS, DATA_START, latestDate, POLLUTANTS, type Bucket, type BucketStat, type FacilityBearing, type NormLine, type PollutantKey, type SectorStat } from "@/lib/sourceAnalytics";

// ЛАСТАНУ КӨЗІ АНАЛИТИКАСЫ (аналитика беті).
// Пайдаланушы затты, бөлшектеуді (жыл / ай / тәулік / сағат) және кезеңді
// таңдайды. Екі график: кезең бойынша концентрация және жел румбы бойынша
// орташа концентрация. Барлық сан — CAMS моделі (өлшем емес), AI жоқ.

interface Resp {
  pollutantLabel: string; unit: string; bucket: Bucket;
  range: { from: string; to: string; clipped: boolean; dataStart: string; dataEnd: string };
  hours: { total: number; withValue: number };
  minCoverage: number;
  buckets: BucketStat[];
  norms: NormLine[];
  wind: { sectors: SectorStat[]; calmHours: number; usedHours: number; overallMean: number | null; calmBelowMs: number; minSectorHours: number };
  facilities: FacilityBearing[];
}

const BUCKET_LABEL: Record<Bucket, string> = { year: "Жыл", month: "Ай", day: "Тәулік", hour: "Сағат" };
const BUCKET_ORDER: Bucket[] = ["year", "month", "day", "hour"];
const JUR: Record<string, string> = { KZ: "ҚР", WHO: "ДДСҰ", EU: "ЕО" };
const SELECT = "min-h-[44px] rounded-md border border-neutral-400 bg-white px-2 text-sm text-neutral-900";
const pad = (n: number) => String(n).padStart(2, "0");

function fmtKey(key: string, bucket: Bucket): string {
  if (bucket === "year") return key;
  if (bucket === "month") return `${key.slice(5, 7)}.${key.slice(2, 4)}`;
  if (bucket === "day") return `${key.slice(8, 10)}.${key.slice(5, 7)}`;
  return `${key.slice(8, 10)}.${key.slice(5, 7)} ${key.slice(11, 13)}:00`;
}

export function SourceAnalytics() {
  const { tr } = useLang();
  const last = useMemo(() => latestDate(), []);
  const years = useMemo(() => {
    const out: number[] = [];
    for (let y = Number(DATA_START.slice(0, 4)); y <= Number(last.slice(0, 4)); y++) out.push(y);
    return out;
  }, [last]);

  const [pollutant, setPollutant] = useState<PollutantKey>("so2");
  const [bucket, setBucket] = useState<Bucket>("month");
  const [yearFrom, setYearFrom] = useState(years[0]);
  const [yearTo, setYearTo] = useState(years[years.length - 1]);
  const [dayYear, setDayYear] = useState(Number(last.slice(0, 4)));
  const [dayMonth, setDayMonth] = useState(Number(last.slice(5, 7)));
  const [hourDate, setHourDate] = useState(last);
  const [hourDays, setHourDays] = useState(1);

  const { from, to } = useMemo(() => {
    if (bucket === "year" || bucket === "month") {
      const a = Math.min(yearFrom, yearTo), b = Math.max(yearFrom, yearTo);
      return { from: `${a}-01-01`, to: `${b}-12-31` };
    }
    if (bucket === "day") {
      const lastDay = new Date(Date.UTC(dayYear, dayMonth, 0)).getUTCDate();
      return { from: `${dayYear}-${pad(dayMonth)}-01`, to: `${dayYear}-${pad(dayMonth)}-${pad(lastDay)}` };
    }
    const end = new Date(Date.parse(hourDate) + (hourDays - 1) * 86400_000).toISOString().slice(0, 10);
    return { from: hourDate, to: end };
  }, [bucket, yearFrom, yearTo, dayYear, dayMonth, hourDate, hourDays]);

  const query = `pollutant=${pollutant}&bucket=${bucket}&from=${from}&to=${to}`;
  const [state, setState] = useState<{ query: string; data: Resp | null; error: string | null }>({ query: "", data: null, error: null });
  const loading = state.query !== query;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/source-analytics?${query}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!r.ok) throw new Error(j?.error ?? "Қолжетімсіз");
        setState({ query, data: j as Resp, error: null });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState({ query, data: null, error: e instanceof Error ? e.message : "Қолжетімсіз" });
      });
    return () => ctrl.abort();
  }, [query]);

  const data = loading ? null : state.data;
  const series = useMemo(() => (data?.buckets ?? []).map((b) => ({ ...b, label: fmtKey(b.key, data!.bucket) })), [data]);
  const suppressed = series.filter((b) => b.mean == null).length;
  const facilitySectors = useMemo(() => new Set((data?.facilities ?? []).map((f) => f.sector)), [data]);
  const sectorsShown = (data?.wind.sectors ?? []).filter((s) => s.mean != null).length;

  return (
    <Card className="border-neutral-300 bg-neutral-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm text-neutral-900">
          <TierBadge tone="light" tier="model" />
          <Factory className="h-4 w-4 text-[#0b3a6b]" aria-hidden />
          {tr("Ластану көзі аналитикасы — кезең бойынша")}
        </CardTitle>
        <p className="text-[13px] text-neutral-600">
          {tr("Қала нүктесіндегі концентрация және жел қай жақтан соққанда жоғары болғаны. Дерек: CAMS моделі мен ERA5 желі, AI қолданылмаған.")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
            {tr("Зат")}
            <select className={SELECT} value={pollutant} onChange={(e) => setPollutant(e.target.value as PollutantKey)}>
              {(Object.keys(POLLUTANTS) as PollutantKey[]).map((k) => <option key={k} value={k}>{POLLUTANTS[k].label}</option>)}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
            <span id="sa-bucket">{tr("Бөлшектеу")}</span>
            <div role="group" aria-labelledby="sa-bucket" className="flex overflow-hidden rounded-md border border-neutral-400">
              {BUCKET_ORDER.filter((b) => BUCKETS.includes(b)).map((b) => (
                <button key={b} type="button" aria-pressed={bucket === b} onClick={() => setBucket(b)}
                  className={`min-h-[44px] px-3 text-sm ${bucket === b ? "bg-[#0b3a6b] font-semibold text-white" : "bg-white text-neutral-800 hover:bg-neutral-100"}`}>
                  {tr(BUCKET_LABEL[b])}
                </button>
              ))}
            </div>
          </div>

          {(bucket === "year" || bucket === "month") && (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Басталу жылы")}
                <select className={SELECT} value={yearFrom} onChange={(e) => setYearFrom(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Аяқталу жылы")}
                <select className={SELECT} value={yearTo} onChange={(e) => setYearTo(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </>
          )}
          {bucket === "day" && (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Жыл")}
                <select className={SELECT} value={dayYear} onChange={(e) => setDayYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Ай")}
                <select className={SELECT} value={dayMonth} onChange={(e) => setDayMonth(Number(e.target.value))}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{pad(m)}</option>)}
                </select>
              </label>
            </>
          )}
          {bucket === "hour" && (
            <>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Күн")}
                <input type="date" className={SELECT} value={hourDate} min={DATA_START} max={last}
                  onChange={(e) => { if (e.target.value) setHourDate(e.target.value); }} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-medium text-neutral-700">
                {tr("Ұзақтығы")}
                <select className={SELECT} value={hourDays} onChange={(e) => setHourDays(Number(e.target.value))}>
                  {[1, 3, 7].map((d) => <option key={d} value={d}>{d} {tr("тәулік")}</option>)}
                </select>
              </label>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> {tr("Жүктелуде…")}</div>
        ) : state.error || !data ? (
          <p role="alert" className="rounded-md border border-neutral-300 border-l-4 border-l-amber-600 bg-white p-2.5 text-sm text-amber-900">{tr(state.error ?? "Қолжетімсіз")}</p>
        ) : (
          <>
            <div>
              <h3 className="text-sm font-semibold text-neutral-900">
                {data.pollutantLabel} · {tr(BUCKET_LABEL[data.bucket])} · {data.range.from} — {data.range.to}
              </h3>
              <p className="text-[12px] text-neutral-600">
                {tr("Баған — кезең орташасы, сызық — кезеңдегі ең жоғары сағаттық мән")} ({data.unit}).
                {data.range.clipped && <> {tr("Кезең қолда бар қатарға қиылды")}: {data.range.dataStart} — {data.range.dataEnd}.</>}
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={series} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} minTickGap={12} />
                  <YAxis tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid #d4d4d4", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#1f2933" }}
                    formatter={(v, name, item) => {
                      const b = item.payload as BucketStat;
                      const cov = `${Math.round(b.coverage * 100)}%`;
                      return [`${v} ${data.unit} (${tr("толықтық")} ${cov})`, name === "mean" ? tr("орташа") : tr("ең жоғары")];
                    }}
                  />
                  <Bar dataKey="mean" fill="#0b3a6b" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                  <Line dataKey="max" stroke="#b45309" strokeWidth={1.5} dot={false} connectNulls={false} isAnimationActive={false} />
                  {data.norms.map((n, i) => (
                    <ReferenceLine key={i} y={n.limit} stroke="#b91c1c" strokeDasharray="4 3"
                      label={{ value: `${tr(JUR[n.jurisdiction] ?? n.jurisdiction)} ${n.limit}`, position: "insideTopRight", fontSize: 10, fill: "#7f1d1d" }} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
              {suppressed > 0 && (
                <p className="mt-1 text-[12px] text-neutral-600">
                  {suppressed} {tr("кезеңде дерек толық емес — орташа көрсетілмеді. Қажетті толықтық")}: {Math.round(data.minCoverage * 100)}%.
                </p>
              )}
              {data.norms.length > 0 ? (
                <ul className="mt-2 space-y-1 text-[13px] text-neutral-800">
                  {data.norms.map((n, i) => (
                    <li key={i}>
                      <span className="font-semibold">{tr(JUR[n.jurisdiction] ?? n.jurisdiction)}: {n.limit} {n.unit}</span>
                      {" — "}{tr("модель орташасы шектен жоғары болған кезең саны")}: <span className="font-semibold">{n.overCount}</span>
                      {!n.verified && <span className="text-neutral-600"> ({tr("шек бастапқы құжаттан расталмаған")})</span>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] text-neutral-600">{tr("Бұл бөлшектеуге сәйкес орташалау кезеңі бар норма тізілімде жоқ — салыстыру жасалмады.")}</p>
              )}
            </div>

            <div className="border-t border-neutral-300 pt-3">
              <h3 className="text-sm font-semibold text-neutral-900">{tr("Жел қай жақтан соққанда концентрация жоғары болды")}</h3>
              <p className="text-[12px] text-neutral-600">
                {tr("Румб бойынша орташа концентрация")} ({data.unit}). {tr("Есепке кірген сағат")}: {data.wind.usedHours}; {tr("тымық сағат (есепке кірмеді)")}: {data.wind.calmHours}.
              </p>
              {sectorsShown === 0 ? (
                <p className="mt-2 text-[13px] text-neutral-700">{tr("Таңдалған кезең румб есебіне қысқа: әр бағытқа кемінде 24 сағат керек. Ұзағырақ кезең таңдаңыз.")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.wind.sectors} margin={{ top: 12, right: 8, bottom: 0, left: -12 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: "#525252" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#ffffff", border: "1px solid #d4d4d4", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#1f2933" }}
                      formatter={(v, _n, item) => [`${v} ${data.unit} (${(item.payload as SectorStat).n} ${tr("сағ")})`, tr("орташа")]}
                    />
                    <Bar dataKey="mean" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {data.wind.sectors.map((s) => <Cell key={s.label} fill={facilitySectors.has(s.label) ? "#b45309" : "#64748b"} />)}
                    </Bar>
                    {data.wind.overallMean != null && (
                      <ReferenceLine y={data.wind.overallMean} stroke="#0b3a6b" strokeDasharray="4 3"
                        label={{ value: `${tr("орташа")} ${data.wind.overallMean}`, position: "insideTopRight", fontSize: 10, fill: "#0b3a6b" }} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
              <p className="mt-1 text-[12px] text-neutral-600">
                {tr("Қоңыр баған — сол бағытта тізілімдегі нысан бар румб. Қаладан 60 км ішіндегі нысандар")}:
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-neutral-800">
                {data.facilities.map((f) => (
                  <li key={f.id}><span className="font-semibold">{tr(f.short)}</span> — {f.sector}, {f.bearing}°, {f.distanceKm} {tr("км")}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-lg border border-amber-700/40 bg-amber-50 p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-amber-900">
                <AlertTriangle className="h-3 w-3" aria-hidden /> {tr("Шектеуі")}
              </div>
              <p className="text-[13px] leading-relaxed text-neutral-800">
                {tr("Бұл — CAMS моделінің есебі (торы ~40 км), жердегі өлшем емес; модель Атырауда тексерілмеген. Тізілімдегі жақын нысандар бір тор ұяшығының ішінде, сондықтан график нақты зауытты анықтамайды және үлес бермейді: румб бойынша айырма аймақтық тасымалды көрсетеді. Қатар 2022 жылғы 4 тамыздан басталады, соңғы 7 тәулік әлі архивте жоқ.")}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
