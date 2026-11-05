"use client";

import { useState } from "react";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { TierBadge } from "@/components/ui/TierBadge";
import { useLang } from "@/lib/i18n";
import { correlate, countSeries, HEALTH_SOURCE, MIN_CORRELATION_N, rateSeries, type AreaId, type Cause } from "@/lib/health";

export interface AirAnnual { gas: string; year: number; meanMgM3: number }

const AREAS: { id: AreaId; label: string }[] = [
  { id: "atyrau_city", label: "Атырау қ.ә." }, { id: "atyrau_oblast", label: "Атырау облысы" },
];
const CAUSES: { id: Exclude<Cause, "all">; label: string }[] = [
  { id: "respiratory", label: "Тыныс алу ағзаларының аурулары" },
  { id: "circulatory", label: "Қан айналымы жүйесінің аурулары" },
];
const GASES = ["so2", "co", "no2", "h2s", "no"] as const;

export function HealthView({ air }: { air: AirAnnual[] }) {
  const { tr } = useLang();
  const [area, setArea] = useState<AreaId>("atyrau_city");
  const [cause, setCause] = useState<Exclude<Cause, "all">>("respiratory");
  const [gas, setGas] = useState<(typeof GASES)[number]>("no2");

  const rates = rateSeries(area, cause);
  const counts = countSeries(area, cause);
  const maxCount = Math.max(...counts.map((c) => c.deaths), 1);
  const airByYear = new Map(air.filter((a) => a.gas === gas).map((a) => [a.year, a.meanMgM3]));
  const pairs = rates.filter((r) => airByYear.has(r.year)).map((r) => [airByYear.get(r.year)!, r.per100k] as [number, number]);
  const corr = correlate(pairs);
  const btn = (on: boolean) => `min-h-[44px] rounded-md border px-3 text-sm ${on ? "border-brand bg-brand text-white" : "border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100"}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{tr("Халық денсаулығы")}</h1>
        <p className="mt-1 max-w-3xl text-neutral-700">{tr("Тек ресми жинақталған статистика. Жеке адамдардың диагнозы, аты немесе мекенжайы жоқ.")}</p>
      </header>

      <p className="border-l-4 border-amber-500 bg-white p-3 text-sm text-amber-900">
        <strong>{tr("Маңызды")}:</strong> {tr("бұл — өлім-жітім (себебі бойынша), аурушаңдық емес. Денсаулық министрлігінің аурушаңдық кестелері тек PDF жинақ түрінде шығады, ашық машинаоқылатын дерек ретінде жарияланбайды — сондықтан аурушаңдық (ауру жағдайларының саны) «дерек жоқ».")}
      </p>

      <div className="flex flex-wrap gap-2">
        {AREAS.map((a) => <button key={a.id} className={btn(area === a.id)} onClick={() => setArea(a.id)} aria-pressed={area === a.id}>{tr(a.label)}</button>)}
        <span className="mx-1 w-px bg-neutral-300" />
        {CAUSES.map((c) => <button key={c.id} className={btn(cause === c.id)} onClick={() => setCause(c.id)} aria-pressed={cause === c.id}>{tr(c.label)}</button>)}
      </div>

      <Panel>
        <PanelHeader title={tr("100 000 тұрғынға шаққандағы өлім-жітім")} description={`${tr("Формула")}: ${tr("өлгендер саны")} ÷ ${tr("орташа жылдық халық саны")} × 100 000. ${tr("Тексеру: осы әдіспен есептелген жалпы өлім коэффициенті Taldau-дағы ресми мәнмен дәл сәйкес келеді.")}`}
          actions={<TierBadge tone="light" tier="measurement" />} />
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[480px] text-sm">
            <thead><tr className="border-b border-neutral-300 text-left text-neutral-700">
              <th className="py-2">{tr("Жыл")}</th><th className="py-2 text-right">{tr("Өлгендер")}</th><th className="py-2 text-right">{tr("Орташа халық саны")}</th><th className="py-2 text-right">{tr("100 000-ға")}</th>
            </tr></thead>
            <tbody>{rates.map((r) => (
              <tr key={r.year} className="border-b border-neutral-200 tabular-nums">
                <td className="py-2">{r.year}</td><td className="py-2 text-right">{r.deaths}</td>
                <td className="py-2 text-right">{r.population.toLocaleString("ru-RU")}</td><td className="py-2 text-right font-semibold">{r.per100k}</td>
              </tr>))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-600">{tr("Халық санының ресми жылдық қатары 2021 жылдан бастап қолжетімді, сондықтан көрсеткіш 2021–2025 жылдарға ғана есептеледі.")}</p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={tr("Өлгендер саны, жыл бойынша")} description={tr("Абсолютті сан — халық санына бөлінбеген; жылдарды салыстыру үшін жоғарыдағы көрсеткішті қолданыңыз.")} />
        <p className="mx-4 mt-3 rounded border border-neutral-300 bg-neutral-50 p-2 text-xs text-neutral-700">{tr("Секірістерді түсіндіруде абай болыңыз: 2020–2021 жылдары COVID-19 пневмониясының бір бөлігі тыныс алу ағзаларының ауруы ретінде кодталуы мүмкін; ерте жылдардағы өзгерістерге себептерді кодтау тәжірибесі мен «Атырау қ.ә.» аумағының шекарасы әсер етуі мүмкін. Бұл түсіндірме тексерілмеген — ресми әдістемені қараңыз.")}</p>
        <div className="space-y-1 p-4">
          {counts.map((c) => (
            <div key={c.year} className="flex items-center gap-2 text-sm">
              <span className="w-12 tabular-nums text-neutral-700">{c.year}</span>
              <div className="h-4 rounded-sm bg-brand/80" style={{ width: `${(c.deaths / maxCount) * 75}%` }} aria-hidden />
              <span className="tabular-nums">{c.deaths}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title={tr("Ауа сапасы мен өлім-жітім: статистикалық байланыс (зерттеуші құралы)")} description={tr("Корреляция — себеп-салдардың дәлелі емес. Тек бірдей жылдар жұптастырылады; ауа — Қазгидромет бюллетенінің жылдық орташасы (12 айы толық жыл ғана).")} />
        <div className="space-y-3 p-4 text-sm">
          <div className="flex flex-wrap gap-2">{GASES.map((g) => <button key={g} className={btn(gas === g)} onClick={() => setGas(g)} aria-pressed={gas === g}>{g.toUpperCase()}</button>)}</div>
          <p>{tr("Жұптасқан жылдар")}: <strong>n = {pairs.length}</strong> ({pairs.length ? rates.filter((r) => airByYear.has(r.year)).map((r) => r.year).join(", ") : "—"})</p>
          {corr.ok ? (
            <p className="rounded border border-neutral-300 bg-neutral-50 p-3">r = <strong>{corr.r}</strong>, 95% CI [{corr.ci95[0]}, {corr.ci95[1]}] · <strong>{tr("корреляция, себеп-салдар емес")}</strong></p>
          ) : (
            <p className="rounded border border-neutral-400 bg-neutral-50 p-3"><strong>{tr("Дерек жеткіліксіз")}:</strong> {tr("жұптасқан жыл саны")} {corr.n} &lt; {MIN_CORRELATION_N} — {tr("корреляция есептелмейді. Қатар ұзарған сайын (жаңа бюллетеньдер мен жылдық статистика) нәтиже автоматты түрде пайда болады.")}</p>
          )}
          <p className="text-xs text-neutral-600">{tr("Шегі n ≥ 8 — жобаның ережесі (статистикалық заң емес): одан аз жұпта сенім аралығы тым кең, нәтиже жаңылыстырады.")}</p>
        </div>
      </Panel>

      <p className="text-xs text-neutral-600">
        {tr("Дереккөз")}: {HEALTH_SOURCE.source} — <a className="underline" href={HEALTH_SOURCE.indicators.deaths.url} target="_blank" rel="noreferrer">{HEALTH_SOURCE.indicators.deaths.name} ({HEALTH_SOURCE.indicators.deaths.code})</a>, <a className="underline" href={HEALTH_SOURCE.indicators.population.url} target="_blank" rel="noreferrer">{HEALTH_SOURCE.indicators.population.name}</a>. {tr("Алынған күні")}: {HEALTH_SOURCE.fetchedAt.slice(0, 10)}.
      </p>
    </div>
  );
}
