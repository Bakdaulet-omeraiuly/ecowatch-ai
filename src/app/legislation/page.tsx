"use client";

import Link from "next/link";
import { ExternalLink, Scale, AlertTriangle } from "lucide-react";
import { ACTS, AVERAGING_KZ, LEGAL_DISCLAIMER, NORMS } from "@/data/legalNorms";
import { SUBSTANCES, SUMMATION_GROUPS, SUMMATION_SOURCE } from "@/data/summationGroups";
import { INDICATORS } from "@/data/indicatorRegistry";

// ЗАҢНАМА — қолданыстағы актілер мен норма тізілімі.
//
// Бұл бет прокуратура/эколог қызметкері үшін: қай сан қай заңға сүйенеді,
// сол сан бастапқы актіден расталған ба, әрі неге спутник өлшемі айыппұлға
// негіз бола алмайды — бәрі ашық жазылған.

const NAME = new Map(INDICATORS.map((i) => [i.id, i.name]));

const STATUS_UI = {
  verified: {
    label: "расталған",
    cls: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
  },
  "needs-primary-check": {
    label: "бастапқы актіден расталуы керек",
    cls: "border-amber-400/30 bg-amber-500/10 text-amber-200",
  },
  missing: { label: "мәні жоқ", cls: "border-white/10 bg-white/5 text-neutral-400" },
} as const;

export default function LegislationPage() {
  const verified = NORMS.filter((n) => n.status === "verified").length;
  const kzActs = Object.values(ACTS).filter((a) => a.jurisdiction === "KZ");
  const intActs = Object.values(ACTS).filter((a) => a.jurisdiction !== "KZ");

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-neutral-200">
      <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold text-emerald-400">
        <Scale className="h-7 w-7" /> Заңнама
      </h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Сайттағы әр көрсеткіш қай заңға сүйеніп бағаланатыны, сол шектің
        бастапқы актіден расталған-расталмағаны және заңдық мәртебесі.
      </p>

      {/* Ең маңызды ескерту */}
      <div className="mb-8 rounded-xl border border-amber-400/30 bg-amber-500/[0.07] p-4">
        <div className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          Заңдық мәртебесі — міндетті түрде оқыңыз
        </div>
        <p className="text-[12px] leading-relaxed text-amber-100/90">{LEGAL_DISCLAIMER}</p>
        <p className="mt-2 text-[12px] leading-relaxed text-amber-100/80">
          Яғни жүйе <b>тексеру бастауға негіз</b> береді: қай жерде, қашан, қандай
          көрсеткіш бойынша күдік бар екенін нақты көрсетеді. Айыппұл салу үшін
          сол жерде аккредиттелген зертхана өлшеу жүргізуі қажет.
        </p>
      </div>

      {/* ҚР актілері */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-white">Қазақстан Республикасының актілері</h2>
        <div className="space-y-3">
          {kzActs.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-200">
                  ҚР
                </span>
                <h3 className="text-sm font-semibold text-white">{a.number}</h3>
                <span className="text-[11px] text-neutral-500">{a.date}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-300">{a.title}</p>
              <p className="mt-1 text-[11px] text-neutral-500">{a.authority}</p>
              {a.note && (
                <p className="mt-1.5 border-t border-white/10 pt-1.5 text-[11px] leading-relaxed text-amber-200/70">
                  {a.note}
                </p>
              )}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-[11px] text-sky-300 underline-offset-2 hover:underline"
                >
                  Ресми мәтін <ExternalLink className="inline h-2.5 w-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Халықаралық */}
      <section className="mb-10">
        <h2 className="mb-3 text-xl font-semibold text-white">Халықаралық құжаттар</h2>
        <div className="space-y-3">
          {intActs.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                  {a.jurisdiction}
                </span>
                <h3 className="text-sm font-semibold text-white">{a.number}</h3>
                <span className="text-[11px] text-neutral-500">{a.date}</span>
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-neutral-300">{a.title}</p>
              {a.note && <p className="mt-1 text-[11px] text-neutral-500">{a.note}</p>}
              {a.url && (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 inline-block text-[11px] text-sky-300 underline-offset-2 hover:underline"
                >
                  Ресми мәтін <ExternalLink className="inline h-2.5 w-2.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Норма тізілімі */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-white">Норма тізілімі</h2>
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-400">
          Барлығы <span className="text-white">{NORMS.length}</span> норма, оның{" "}
          <span className="text-white">{verified}</span>-і расталған.{" "}
          <span className="text-amber-200/90">
            Расталмаған шек бойынша жүйе «заң бұзылды» деген тұжырым шығармайды
          </span>{" "}
          — тек «алдын ала белгі» деп жазады.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="text-neutral-400">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Көрсеткіш</th>
                <th className="py-2 pr-3 font-medium">Акт</th>
                <th className="py-2 pr-3 font-medium">Орташалау</th>
                <th className="py-2 pr-3 text-right font-medium">Шек</th>
                <th className="py-2 font-medium">Растау күйі</th>
              </tr>
            </thead>
            <tbody>
              {NORMS.map((n, i) => {
                const act = ACTS[n.actId];
                const ui = STATUS_UI[n.status];
                return (
                  <tr key={i} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3 text-neutral-200">
                      {NAME.get(n.indicatorId) ?? n.indicatorId}
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-neutral-300">
                        {act.jurisdiction === "KZ" ? "ҚР" : act.jurisdiction}
                      </span>{" "}
                      <span className="text-neutral-500">{act.number}</span>
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">{AVERAGING_KZ[n.averaging]}</td>
                    <td className="py-2 pr-3 text-right text-neutral-200">
                      {n.limit} {n.unit}
                      {n.allowedExceedances != null && (
                        <span className="ml-1 text-[10px] text-neutral-500">
                          ({n.allowedExceedances} рет/жыл)
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <span className={`rounded border px-1.5 py-0.5 text-[10px] ${ui.cls}`} title={n.statusNote}>
                        {ui.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Жинақталу әсері — 2025 ж. № 10 бұйрықпен енгізілген 3-кесте */}
      <section className="mb-10">
        <h2 className="mb-1 text-xl font-semibold text-white">Жинақталу (суммация) әсері</h2>
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-400">
          {SUMMATION_SOURCE.act} — {SUMMATION_SOURCE.amendment}.
        </p>

        <div className="mb-3 rounded-xl border border-emerald-400/25 bg-emerald-500/[0.06] p-4">
          <div className="mb-1 font-mono text-lg text-emerald-200">{SUMMATION_SOURCE.formula}</div>
          <p className="text-[12px] leading-relaxed text-emerald-100/85">
            Cᵢ — атмосфералық ауадағы заттың нақты шоғырлануы, ШРКᵢ — сол заттың рұқсат
            етілген шекті шоғырлануы. Жинақталу әсері бар заттар бірге болғанда, олардың
            қатынастарының қосындысы <b>1-ден аспауға тиіс</b>.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-white">
            Бұл нені білдіреді: әр зат <b>жеке-жеке норма шегінде</b> тұрып, бірге алғанда
            норманы <b>бұзуы мүмкін</b>. Мысалы NO₂ = 0,6 ШРК және SO₂ = 0,6 ШРК — екеуі де
            «жасыл», ал қосындысы 1,2 &gt; 1 → бұзушылық.
          </p>
        </div>

        <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-1 text-[11px] font-semibold text-neutral-200">Ерекшелік ережесі</div>
          <p className="text-[11px] leading-relaxed text-neutral-400">
            {SUMMATION_SOURCE.dominanceRule}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="text-neutral-400">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-medium">№</th>
                <th className="py-2 pr-3 font-medium">Топ құрамы</th>
                <th className="py-2 font-medium">Жүйеде есептеледі ме</th>
              </tr>
            </thead>
            <tbody>
              {SUMMATION_GROUPS.map((g) => {
                const measured = g.substances.filter((id) => SUBSTANCES[id].measured);
                const missing = g.substances.filter((id) => !SUBSTANCES[id].measured);
                const full = missing.length === 0 && g.mode !== "independent";
                return (
                  <tr key={g.no} className="border-b border-white/5 last:border-0">
                    <td className="py-2 pr-3 text-neutral-500">{g.no}</td>
                    <td className="py-2 pr-3 text-neutral-200">
                      {g.substances.map((id) => SUBSTANCES[id].name).join(" + ")}
                      {g.modeNote && (
                        <span className="block text-[10px] text-neutral-500">{g.modeNote}</span>
                      )}
                    </td>
                    <td className="py-2">
                      {full ? (
                        <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-200">
                          иә — {measured.length} компонент
                        </span>
                      ) : (
                        <span
                          className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-neutral-400"
                          title={missing.map((id) => SUBSTANCES[id].name).join(", ")}
                        >
                          жоқ — {missing.length} зат өлшенбейді
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
          Толық кестеде 59 топ бар. Мұнда жүйеде кемінде бір заты өлшенетіндері
          келтірілген — қалғандары (акрил қышқылы, фурфурол, ванадий аэрозольдері т.б.)
          үшін жер бетіндегі зертханалық өлшем қажет.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-2 text-xl font-semibold text-white">Норманы қалай растаймыз</h2>
        <ol className="list-inside list-decimal space-y-1 text-[12px] leading-relaxed text-neutral-400">
          <li>
            adilet.zan.kz сайтынан ҚР ДСМ-70 бұйрығының қолданыстағы редакциясы ашылады
          </li>
          <li>Кестедегі мән сайттағы мәнмен салыстырылады</li>
          <li>
            Сәйкес келсе <code className="text-emerald-300">src/data/legalNorms.ts</code> ішінде{" "}
            <code className="text-emerald-300">status: &quot;verified&quot;</code> қойылады
          </li>
          <li>Сол сәттен бастап жүйе сол норма бойынша заңдық тұжырым шығара бастайды</li>
        </ol>
        <p className="mt-2 text-[11px] text-neutral-500">
          2015 жылғы № 168 бұйрық <b className="text-amber-200/90">күшін жойған</b> — ондағы
          нормаларды қолдануға болмайды.
        </p>
      </section>

      <div className="flex flex-wrap gap-2 text-[12px]">
        <Link
          href="/eco-passport"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-neutral-200 transition hover:bg-white/10"
        >
          Эко-паспорт →
        </Link>
        <Link
          href="/methodology"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-neutral-200 transition hover:bg-white/10"
        >
          Әдістеме және валидация →
        </Link>
      </div>
    </main>
  );
}
