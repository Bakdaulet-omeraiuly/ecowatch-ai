"use client";

import { TierBadge, TierLegend, type Tier } from "@/components/ui/TierBadge";

// Әдістеме мен валидация күйі.
//
// Бұл беттің мақсаты — әр көрсеткіштің қайдан келетінін, қалай есептелетінін
// және НЕ ТЕКСЕРІЛМЕГЕНІН ашық жазу. Валидация бағаны әдейі көбіне «жоқ» деп
// тұр: Атырауда жердегі бақылау деректері бізде жоқ. Оны жасыру — жалған
// сенімділік беру болар еді.

interface Item {
  name: string;
  tier: Tier;
  source: string;
  method: string;
  refresh: string;
  validation: string;
  validated: boolean;
  limits: string[];
}

const ITEMS: Item[] = [
  {
    name: "Су басқан аумақ (км²)",
    tier: "measurement",
    source: "Copernicus Sentinel-1 GRD (IW, VV, GAMMA0_TERRAIN)",
    method:
      "Радарда тегіс су айнадай шағылысып қайтпайды. VV gamma0 −16 дБ-дан төмен пиксельдер су " +
      "деп саналады. «Су басқан аумақ» = ағымдағы су − күзгі төмен су кезеңіндегі су.",
    refresh: "6 сағат сайын (спутник өтуі ~6 күн)",
    validation: "Жердегі өлшеммен салыстырылмаған",
    validated: false,
    limits: [
      "Құрғақ сор мен тақыр да радарда күңгірт — тірек кезеңмен салыстыру олардың басым бөлігін жояды, бірақ ылғал сор «су» болып саналуы мүмкін",
      "Қатты желде су беті бұдырланып, аудан кем бағаланады",
      "Бақылау аймақтары — тікбұрышты терезелер, әкімшілік шекара емес",
    ],
  },
  {
    name: "Спектрлік индекстер (NDVI, NDWI, NDMI, NDBI)",
    tier: "measurement",
    source: "Copernicus Sentinel-2 L2A (Sentinel Hub Statistical API)",
    method: "Стандартты нормаланған айырма индекстері, соңғы бұлтсыз кадр бойынша.",
    refresh: "Сұраныс бойынша (нүкте таңдалғанда)",
    validation: "Формулалар стандартты, бірақ жергілікті калибрлеу жасалмаған",
    validated: false,
    limits: [
      "Бұлт маскасы жетілмеген кадрларда мән бұрмалануы мүмкін",
      "Индекс — сандық көрсеткіш, оны экологиялық диагноз ретінде оқуға болмайды",
    ],
  },
  {
    name: "Жылу аномалиялары (факел / өрт)",
    tier: "measurement",
    source: "NASA FIRMS · VIIRS SNPP NRT",
    method: "Спутниктің инфрақызыл арнасындағы жылу аномалиясының тікелей детекциясы.",
    refresh: "Күніне бірнеше рет, соңғы 2 тәулік",
    validation: "NASA-ның өз алгоритмі валидацияланған; біз оны өзгертпейміз",
    validated: true,
    limits: [
      "Газ факелін дала өртінен АЖЫРАТПАЙДЫ — екеуі де жылу аномалиясы",
      "FRP — жылу қуаты, ластану мөлшері емес",
      "Бұлт детекцияға кедергі келтіреді",
    ],
  },
  {
    name: "Ауа сапасы (12 ластаушы)",
    tier: "model",
    source: "Copernicus CAMS (Open-Meteo арқылы)",
    method: "Жаһандық атмосфералық химия моделінің реанализі мен болжамы.",
    refresh: "Сағат сайын",
    validation: "Жер бетіндегі Qazhydromet станциясымен салыстыру дашбордта бар",
    validated: false,
    limits: [
      "Тор қадамы ~40 км — қала ішіндегі айырма толық көрінбейді",
      "Модель шығысы, станция өлшемі емес",
    ],
  },
  {
    name: "Ластану көзін анықтау",
    tier: "model",
    source: "CAMS + Open-Meteo жел + WAQI станциялары",
    method:
      "Жел бағыты бойынша кері траектория (оңайлатылған CWT) + Гаусс шлейфі. Нәтиже — " +
      "ЫҚТИМАЛ көз, сенімділік пайызымен.",
    refresh: "Сағат сайын",
    validation: "Жоқ — нақты шығарынды өлшемі бізде жоқ",
    validated: false,
    limits: [
      "Кәсіпорынның нақты шығарынды мөлшері белгісіз — тек орналасуы мен жел ескеріледі",
      "Бірнеше көз қатар жұмыс істесе, олардың үлесі ажыратылмайды",
    ],
  },
  {
    name: "JAIYQ-ML — 11 күндік ауа болжамы",
    tier: "model",
    source: "CAMS реанализінде оқытылған, ECMWF болжамымен жүргізіледі",
    method:
      "Градиенттік бустинг маусымдық климатологиядан ауытқуды болжайды. Апта сайын " +
      "GitHub Actions-та нақты деректе қайта оқытылады.",
    refresh: "Болжам сағат сайын, модель апта сайын",
    validation:
      "Хронологиялық тексеру жиынында өлшенеді. Қазіргі шеберлік талапқа (≥5%) жетпеді",
    validated: false,
    limits: [
      "Дәлдігі жеткіліксіз болғандықтан сайтта КӨРСЕТІЛМЕЙДІ (автоматты қақпа)",
      "CAMS реанализінде оқытылған — станция өлшемін емес, CAMS мінезін жалғастырады",
    ],
  },
  {
    name: "JAIYQ-MRI — маса тәуекел индексі",
    tier: "model",
    source: "Open-Meteo (температура, ылғал, жауын)",
    method:
      "Mordecai 2017 термиялық қолайлылық қисығы + су режимі (flood-pulse egg-bank). " +
      "Екі түр: Aedes caspius (тасқын суы) және Culex modestus (тұрақты су).",
    refresh: "Сағат сайын",
    validation: "Жоқ — Атырауда тұзақ (trap) деректері жинақталмаған",
    validated: false,
    limits: [
      "Климаттық ҚОЛАЙЛЫЛЫҚ индексі, маса санының өлшемі емес",
      "Салыстыру үшін жарайды (қай жер қауіптірек), абсолют сан ретінде емес",
    ],
  },
  {
    name: "Өрт қаупі (FWI)",
    tier: "model",
    source: "Open-Meteo (ECMWF) метеорологиясы",
    method: "Van Wagner 1987 Canadian Forest Fire Weather Index System.",
    refresh: "Күн сайын",
    validation: "Әдістеме халықаралық деңгейде валидацияланған, Қазақстанға бейімделмеген",
    validated: false,
    limits: [
      "Ауа райына негізделген ҚАУІП көрсеткіші — өрттің бар-жоғы емес",
      "Канада ормандары үшін жасалған; дала/шөл өсімдігіне толық сәйкес келмейді",
    ],
  },
  {
    name: "Құрғақшылық (SPI-3)",
    tier: "model",
    source: "Open-Meteo ERA5 архиві (ECMWF)",
    method: "McKee 1993 Standardized Precipitation Index — 3 айлық жауын көп жылдық таралумен салыстырылады.",
    refresh: "Күн сайын",
    validation: "Стандартты әдіс (ДМҰ ұсынған)",
    validated: true,
    limits: ["Тек жауынға негізделген — температура мен буланудың әсері ескерілмейді"],
  },
  {
    name: "AI спутник талдауы / агент / «Неге?»",
    tier: "ai",
    source: "OpenAI GPT-4o (спутник суреті + тірі деректер)",
    method: "Тіл моделі суретті және сандық деректерді оқып, мәтінді қорытынды жазады.",
    refresh: "Сұраныс бойынша",
    validation: "ЖОҚ — тексерілмеген",
    validated: false,
    limits: [
      "Ресми есепке негіз бола АЛМАЙДЫ — тек назар аудару үшін",
      "Кіріс — Mapbox RGB тайлы: түсірілім күні белгісіз, спектр каналдары жоқ",
      "Модель қолжетімсіз болса нәтиже көрсетілмейді — ойдан талдау жасалмайды",
    ],
  },
];

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

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-neutral-200">
      <h1 className="mb-2 text-3xl font-bold text-emerald-400">Әдістеме және валидация</h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-400">
        Бұл бетте сайттағы әр көрсеткіштің қайдан келетіні, қалай есептелетіні және{" "}
        <span className="text-white">не тексерілмегені</span> жазылған. Валидация бағаны көбіне
        «жоқ» деп тұр — себебі Атырауда жердегі бақылау деректері бізде жоқ. Оны жасыру жалған
        сенімділік беру болар еді.
      </p>

      <div className="mb-10 rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-2 text-sm font-semibold text-white">Сенімділік деңгейлері</h2>
        <TierLegend className="!text-[11px]" />
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-xl font-semibold text-white">Көрсеткіштер</h2>
        <div className="space-y-3">
          {ITEMS.map((it) => (
            <div key={it.name} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <TierBadge tier={it.tier} />
                <h3 className="text-sm font-semibold text-white">{it.name}</h3>
                <span
                  className={`ml-auto rounded-full border px-2 py-0.5 text-[10px] ${
                    it.validated
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {it.validated ? "валидацияланған" : "валидацияланбаған"}
                </span>
              </div>
              <dl className="grid gap-x-6 gap-y-1 text-[11px] leading-relaxed sm:grid-cols-[max-content_1fr]">
                <dt className="text-neutral-500">Дереккөз</dt>
                <dd className="text-neutral-300">{it.source}</dd>
                <dt className="text-neutral-500">Әдіс</dt>
                <dd className="text-neutral-300">{it.method}</dd>
                <dt className="text-neutral-500">Жаңару</dt>
                <dd className="text-neutral-300">{it.refresh}</dd>
                <dt className="text-neutral-500">Валидация</dt>
                <dd className="text-neutral-300">{it.validation}</dd>
              </dl>
              <ul className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[11px] text-amber-200/70">
                {it.limits.map((l, i) => (
                  <li key={i}>⚠ {l}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-white">Су туралы төрт көрсеткіш</h2>
        <p className="mb-3 text-[12px] leading-relaxed text-neutral-400">
          Сайтта суға қатысты төрт бөлек көрсеткіш бар. Олар бір-бірін қайталамайды — әрқайсысы
          басқа сұраққа жауап береді:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[11px]">
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
                  <td className="py-2 font-mono text-[10px] text-neutral-500">{w.api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-white">Жалған дерек көрсетілмейді</h2>
        <p className="mb-2 text-[12px] leading-relaxed text-neutral-400">
          Дерек көзі қолжетімсіз болса, сайт бос орынды толтыруға тырыспайды: тиісті блок
          «уақытша қолжетімсіз» деп жазады. Бұл жобаның негізгі ережесі.
        </p>
        <ul className="list-inside list-disc space-y-1 text-[12px] text-neutral-400">
          <li>AI кілті жоқ немесе шақыру сәтсіз → талдау көрсетілмейді (бұрын ойдан жасалатын)</li>
          <li>Спутник өтуі жоқ → сол аймақ «өлшенбеді» болып қалады</li>
          <li>Модель дәлдігі талапқа жетпесе → болжам автоматты түрде жасырылады</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-white">Не істеу керек (жоспар)</h2>
        <ol className="list-inside list-decimal space-y-1 text-[12px] text-neutral-400">
          <li>
            Qazhydromet станцияларының тарихи деректерін жинай бастау — сонда модельдерді нақты
            өлшеммен салыстыруға болады
          </li>
          <li>
            Су басқан аумақты нақты тасқын кезеңіндегі жердегі есептермен салыстыру
          </li>
          <li>Маса тұзақтарының деректерін алу — MRI индексін валидациялаудың жалғыз жолы</li>
        </ol>
      </section>
    </main>
  );
}
