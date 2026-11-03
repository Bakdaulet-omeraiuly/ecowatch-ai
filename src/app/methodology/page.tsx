"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { TierBadge, TierLegend, type Tier } from "@/components/ui/TierBadge";
import { INDICATORS, SECTIONS } from "@/data/indicatorRegistry";
import { useLang } from "@/lib/i18n";

// ӘДІСТЕМЕ ЖӘНЕ ВАЛИДАЦИЯ КҮЙІ
//
// Көрсеткіштер тізімі `src/data/indicatorRegistry.ts` файлынан оқылады —
// эко-паспортпен ОРТАҚ дереккөз. Екі жерде бөлек жазсақ, олар уақыт өте
// ажырап кетер еді.
//
// Бұл беттің мақсаты — не тексерілмегенін ашық жазу. Валидация бағаны
// көбіне «жоқ» деп тұр: Атырауда жердегі бақылау деректері бізде жоқ.

const WATER = [
  {
    n: "Су басқан аумақ",
    api: "/api/flood-extent",
    what: "Радар өлшеген су беті, км²",
    when: "Қазір (соңғы спутник өтуі)",
    tier: "measurement" as Tier,
  },
  {
    n: "Өзен ағыны",
    api: "/api/flood",
    what: "Жайықтың тірі ағыны, м³/с",
    when: "Бүгін",
    tier: "model" as Tier,
  },
  {
    n: "Ағын трендісі",
    api: "/api/water-trend",
    what: "Жылдық орташа ағын, 2020 → қазір",
    when: "Жылдар бойы",
    tier: "model" as Tier,
  },
  {
    n: "Жер су қоры",
    api: "/api/water",
    what: "Топырақ ылғалы 0–100 см, көп жылдық тренд",
    when: "Ондаған жыл",
    tier: "model" as Tier,
  },
];

// ЖЫЛУ АНОМАЛИЯСЫ — ӨРТ — ФАКЕЛ: айырмашылық (P4.4).
// Үш ұғым бір-бірімен шатастырылмауы керек; сондықтан әр қатар дереккөз мен
// сенімділік деңгейін бірден көрсетеді.
const FIRE_METH = {
  kk: {
    title: "Жылу аномалиясы, өрт және өндірістік факел — айырмашылық",
    rows: [
      { k: "Жылу аномалиясы", v: "NASA FIRMS (VIIRS, 375 м) спутниктің жылу датчигі тіркеген сигнал. Бұл — өлшем. Расталған өрт емес: факел, далалық өрт, күйдірілген алқап немесе жалын болуы мүмкін." },
      { k: "Өрт", v: "Жер бетінде расталған жану оқиғасы. FIRMS оны өзі растамайды — растау үшін жердегі немесе әкімшілік тексеру қажет." },
      { k: "Өндірістік факел", v: "Нысан контурының (және шағын буферінің) ішінде тіркелген аномалия «өндірістік алау» деп жіктеледі. Бұл — модельдің жіктеуі (📊), растау емес: контур дәл болмауы мүмкін." },
      { k: "Контурдан тыс аномалия", v: "«Расталмаған» деп белгіленеді. Оның өндірістік емес екені дәлелденбеген — сондықтан «өрт» деп те, «факел емес» деп те айтуға болмайды." },
    ],
    note: "Шектеу: 375 м пиксельді спутник тек өткен сәтте (тәулігіне бірнеше рет) түсіреді; бұлт пен түтін сигналды жасыруы мүмкін. Уақыт сүзгісі — аномалия күні (acq_date) бойынша.",
  },
  ru: {
    title: "Тепловая аномалия, пожар и промышленный факел — различие",
    rows: [
      { k: "Тепловая аномалия", v: "Сигнал теплового датчика спутника NASA FIRMS (VIIRS, 375 м). Это измерение. Не подтверждённый пожар: может быть факел, полевой пожар, выжженный участок или пламя." },
      { k: "Пожар", v: "Подтверждённое горение на земле. FIRMS сам его не подтверждает — для подтверждения нужна проверка на месте или административная." },
      { k: "Промышленный факел", v: "Аномалия внутри контура объекта (и малого буфера) относится к категории «промышленный факел». Это классификация модели (📊), а не подтверждение: контур может быть неточным." },
      { k: "Аномалия вне контура", v: "Помечается как «не подтверждённая». Что она не промышленная, не доказано — поэтому её нельзя называть ни пожаром, ни «не факелом»." },
    ],
    note: "Ограничение: пиксель 375 м снимается только во время пролёта спутника (несколько раз в сутки); облака и дым могут скрывать сигнал. Фильтр периода — по дате аномалии (acq_date).",
  },
  en: {
    title: "Thermal anomaly, fire and industrial flare — the difference",
    rows: [
      { k: "Thermal anomaly", v: "A signal recorded by the satellite thermal sensor (NASA FIRMS, VIIRS, 375 m). This is a measurement. It is not a confirmed fire: it may be a flare, a field fire, a burned area or flames." },
      { k: "Fire", v: "A confirmed burning event on the ground. FIRMS does not confirm it by itself — on-site or administrative verification is required." },
      { k: "Industrial flare", v: "An anomaly inside a facility footprint (plus a small buffer) is classified as an industrial flare. This is a model classification (📊), not a confirmation: the footprint may be imprecise." },
      { k: "Anomaly outside the footprint", v: "Labelled as unconfirmed. It has not been shown to be non-industrial, so it cannot be called either a fire or 'not a flare'." },
    ],
    note: "Limitation: each 375 m pixel is imaged only during a satellite overpass (several times a day); clouds and smoke can hide the signal. The period filter uses the anomaly date (acq_date).",
  },
} as const;

function FireAnomalyMethodology() {
  const { lang } = useLang();
  const c = FIRE_METH[lang];
  return (
    <section className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-4" aria-labelledby="fire-meth-title">
      <h2 id="fire-meth-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        {c.title} <TierBadge tier="measurement" />
      </h2>
      <dl className="space-y-2 text-[13px] leading-relaxed text-neutral-300">
        {c.rows.map((r) => (
          <div key={r.k}>
            <dt className="font-semibold text-neutral-100">{r.k}</dt>
            <dd className="text-neutral-400">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-snug text-neutral-500">{c.note}</p>
    </section>
  );
}

export default function MethodologyPage() {
  const { t } = useLang();
  const validated = INDICATORS.filter((i) => i.validated).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-neutral-200">
      <h1 className="mb-2 text-3xl font-bold text-emerald-400">Әдістеме және валидация</h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Бұл бетте сайттағы әр көрсеткіштің қайдан келетіні, қалай есептелетіні және{" "}
        <span className="text-white">не тексерілмегені</span> жазылған. Валидация бағаны көбіне
        «жоқ» деп тұр — себебі Атырауда жердегі бақылау деректері бізде жоқ. Оны жасыру жалған
        сенімділік беру болар еді.
      </p>

      <div className="mb-8 flex flex-wrap gap-2 text-[13px]">
        <Link
          href="/eco-passport"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-emerald-300 transition hover:bg-emerald-500/20"
        >
          Толық эко-паспортты ашу (формулалармен) →
        </Link>
        <Link
          href="/methodology/jaiyq-mri"
          className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2 text-violet-200 transition hover:bg-violet-500/20"
        >
          🦟 JAIYQ-MRI маса моделінің толық әдістемесі →
        </Link>
        <a
          href="/JAIYQ-MRI-adistemesi.pdf"
          className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-neutral-300 transition hover:bg-white/10"
        >
          PDF (11 бет)
        </a>
        <Link
          href="/validation"
          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sky-200 transition hover:bg-sky-500/20"
        >
          {t("val.link.validationHub")}
        </Link>
      </div>

      {/* Маса моделі — жеке құжат. Ол басқа көрсеткіштерден бөлек, себебі
          бұл жобаның ӨЗ моделі: формуласы, дәлелдері, әлемдік модельдермен
          салыстыруы және не жетіспейтіні толық жазылған. */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-1 text-sm font-semibold text-violet-200">
          🦟 JAIYQ-MRI — жобаның өз моделі
        </h2>
        <p className="text-[13px] leading-relaxed text-neutral-300">
          Маса тәуекел индексі — сырттан алынған модель емес, осы жоба үшін жасалған
          тасқын-импульсті жұмыртқа банкі моделі. Толық әдістемесінде формулалар, дереккөздер,
          жеті әлемдік модельмен салыстыру, «шынымен жаңа ма» деген шыншыл баға және не
          жетіспейтіні (шешу жолымен қоса) жазылған.
        </p>
        <Link
          href="/methodology/jaiyq-mri"
          className="mt-2 inline-block text-[13px] text-violet-300 underline-offset-2 hover:underline"
        >
          Толық құжатты ашу →
        </Link>
      </div>

      <FireAnomalyMethodology />

      <div className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Сенімділік деңгейлері</h2>
        <TierLegend className="!text-[13px]" />
        <p className="mt-3 text-[13px] text-neutral-400">
          Барлығы <span className="text-white">{INDICATORS.length}</span> көрсеткіш, оның{" "}
          <span className="text-white">{validated}</span>-і валидацияланған.
        </p>
      </div>

      {SECTIONS.map((section) => {
        const items = INDICATORS.filter((i) => i.section === section);
        if (!items.length) return null;
        return (
          <section key={section} className="mb-10">
            <h2 className="mb-3 text-xl font-semibold text-white">{section}</h2>
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <TierBadge tier={it.tier} />
                    <h3 className="text-sm font-semibold text-white">{it.name}</h3>
                    <span
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[12px] ${
                        it.validated
                          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                          : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {it.validated ? "валидацияланған" : "валидацияланбаған"}
                    </span>
                  </div>

                  <p className="mb-2 text-[13px] leading-relaxed text-neutral-300">{it.what}</p>

                  {it.formula && (
                    <div className="mb-2 overflow-x-auto rounded-md border border-white/10 bg-black/30 px-2.5 py-1.5 font-mono text-[13px] text-emerald-200">
                      {it.formula}
                    </div>
                  )}

                  {/* ЕСЕПТЕУ ТІЗБЕГІ — формула мен нәтиженің арасындағы
                      әр қадам. Әдістеме бетінің ең негізгі бөлігі: эколог
                      санның қалай шыққанын қайталай алуы керек. */}
                  {it.steps.length > 0 && (
                    <ol className="mb-2 space-y-0.5 rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 text-[13px] leading-relaxed text-neutral-300">
                      {it.steps.map((st, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 font-mono text-[12px] text-neutral-400">
                            {i + 1}.
                          </span>
                          <span>{st}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <dl className="grid gap-x-6 gap-y-1 text-[13px] leading-relaxed sm:grid-cols-[max-content_1fr]">
                    <dt className="text-neutral-400">Аспап / модель</dt>
                    <dd className="text-neutral-300">{it.instrument}</dd>
                    <dt className="text-neutral-400">Ажыратымдылық</dt>
                    <dd className="text-neutral-300">
                      {it.spatial} · {it.temporal} · кідіріс {it.latency}
                    </dd>
                    <dt className="text-neutral-400">Дереккөз құжаты</dt>
                    <dd className="space-y-0.5">
                      {it.sources.map((s, i) =>
                        s.url ? (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sky-300 underline-offset-2 hover:underline"
                          >
                            {s.label} <ExternalLink className="inline h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span key={i} className="block text-neutral-300">
                            {s.label}
                          </span>
                        )
                      )}
                    </dd>
                    <dt className="text-neutral-400">Валидация</dt>
                    <dd className="text-neutral-300">{it.validationNote}</dd>
                  </dl>

                  <ul className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[13px] text-amber-200/70">
                    {it.limits.map((l, i) => (
                      <li key={i}>⚠ {l}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-white">Су туралы төрт көрсеткіш</h2>
        <p className="mb-3 text-[13px] leading-relaxed text-neutral-400">
          Сайтта суға қатысты төрт бөлек көрсеткіш бар. Олар бір-бірін қайталамайды — әрқайсысы
          басқа сұраққа жауап береді:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="text-neutral-400">
              <tr className="border-b border-white/10">
                <th className="py-2 pr-3 font-medium">Көрсеткіш</th>
                <th className="py-2 pr-3 font-medium">Нені өлшейді</th>
                <th className="py-2 pr-3 font-medium">Уақыт ауқымы</th>
                <th className="py-2 font-medium">Эндпоинт</th>
              </tr>
            </thead>
            <tbody>
              {WATER.map((w) => (
                <tr key={w.api} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TierBadge tier={w.tier} />
                      <span className="text-neutral-100">{w.n}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-neutral-300">{w.what}</td>
                  <td className="py-2 pr-3 text-neutral-400">{w.when}</td>
                  <td className="py-2 font-mono text-[12px] text-neutral-400">{w.api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-white">Жалған дерек көрсетілмейді</h2>
        <p className="mb-2 text-[13px] leading-relaxed text-neutral-400">
          Дерек көзі қолжетімсіз болса, сайт бос орынды толтыруға тырыспайды: тиісті блок
          «уақытша қолжетімсіз» деп жазады. Бұл жобаның негізгі ережесі.
        </p>
        <ul className="list-inside list-disc space-y-1 text-[13px] text-neutral-400">
          <li>AI кілті жоқ немесе шақыру сәтсіз → талдау көрсетілмейді</li>
          <li>Спутник өтуі жоқ → сол аймақ «өлшенбеді» болып қалады</li>
          <li>Модель дәлдігі талапқа жетпесе → болжам автоматты түрде жасырылады</li>
          <li>Эко-паспортта жалпы «эко-балл» жоқ — түрлі бірліктегі шаманы қосу негізсіз</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">Не істеу керек (жоспар)</h2>
        <ol className="list-inside list-decimal space-y-1 text-[13px] text-neutral-400">
          <li>
            Qazhydromet станцияларының тарихи деректерін жинай бастау — сонда модельдерді нақты
            өлшеммен салыстыруға болады
          </li>
          <li>Су басқан аумақты нақты тасқын кезеңіндегі жердегі есептермен салыстыру</li>
          <li>Маса тұзақтарының деректерін алу — MRI индексін валидациялаудың жалғыз жолы</li>
        </ol>
      </section>
    </main>
  );
}
