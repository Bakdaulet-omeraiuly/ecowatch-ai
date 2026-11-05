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
      { k: "Өндірістік факел", v: "Нысан контурының (және шағын буферінің) ішінде тіркелген аномалия «өндірістік алау» деп жіктеледі. Бұл — модельдің жіктеуі, растау емес: контур дәл болмауы мүмкін." },
      { k: "Контурдан тыс аномалия", v: "«Расталмаған» деп белгіленеді. Оның өндірістік емес екені дәлелденбеген — сондықтан «өрт» деп те, «факел емес» деп те айтуға болмайды." },
      { k: "Қамыс өрті — түтін бағыты (модель)", v: "Қамыс аймағы — Sentinel-2 NDVI > 0.4 тығыз өсімдік табылған бақылау терезесі (прокси, қамыс картасы емес). Осы терезелер ішіндегі FIRMS аномалиялары алынады; «өндірістік алау» ЕШҚАШАН саналмайды. Конус тек соңғы 2 тәуліктегі аномалияға: ең жақын Open-Meteo жел нүктесі, түтін бағыты = желдің келетін бағыты + 180°, ені — Pasquill D класы (бейтарап, болжам) + жел бағытының соңғы 12 сағаттағы ауытқуы. Конус ұзындығы мен нақты бұрышы ішіндегі облыс елді мекендері тізіледі. Жел дерегі жоқ болса конус сызылмайды — «жел деректері жоқ — бағыт есептелмеді». Концентрация (µg/m³) берілмейді." },
    ],
    note: "Шектеу: 375 м пиксельді спутник тек өткен сәтте (тәулігіне бірнеше рет) түсіреді; бұлт пен түтін сигналды жасыруы мүмкін. Уақыт сүзгісі — аномалия күні (acq_date) бойынша.",
  },
  ru: {
    title: "Тепловая аномалия, пожар и промышленный факел — различие",
    rows: [
      { k: "Тепловая аномалия", v: "Сигнал теплового датчика спутника NASA FIRMS (VIIRS, 375 м). Это измерение. Не подтверждённый пожар: может быть факел, полевой пожар, выжженный участок или пламя." },
      { k: "Пожар", v: "Подтверждённое горение на земле. FIRMS сам его не подтверждает — для подтверждения нужна проверка на месте или административная." },
      { k: "Промышленный факел", v: "Аномалия внутри контура объекта (и малого буфера) относится к категории «промышленный факел». Это классификация модели, а не подтверждение: контур может быть неточным." },
      { k: "Аномалия вне контура", v: "Помечается как «не подтверждённая». Что она не промышленная, не доказано — поэтому её нельзя называть ни пожаром, ни «не факелом»." },
      { k: "Пожар в тростнике — направление дыма (модель)", v: "Зона тростника — окно наблюдения, где Sentinel-2 NDVI > 0.4 показал густую растительность (прокси, а не карта тростника). Берутся аномалии FIRMS внутри этих окон; «промышленный факел» НИКОГДА не учитывается. Конус — только для аномалий за последние 2 суток: ближайшая точка ветра Open-Meteo, направление дыма = направление, откуда дует ветер, + 180°, ширина — класс Pasquill D (нейтральный, допущение) + разброс направления ветра за последние 12 часов. Перечисляются населённые пункты области в пределах длины и фактического угла конуса. Если данных о ветре нет, конус не строится — «нет данных о ветре — направление не рассчитано». Концентрация (µg/m³) не выдаётся." },
    ],
    note: "Ограничение: пиксель 375 м снимается только во время пролёта спутника (несколько раз в сутки); облака и дым могут скрывать сигнал. Фильтр периода — по дате аномалии (acq_date).",
  },
  en: {
    title: "Thermal anomaly, fire and industrial flare — the difference",
    rows: [
      { k: "Thermal anomaly", v: "A signal recorded by the satellite thermal sensor (NASA FIRMS, VIIRS, 375 m). This is a measurement. It is not a confirmed fire: it may be a flare, a field fire, a burned area or flames." },
      { k: "Fire", v: "A confirmed burning event on the ground. FIRMS does not confirm it by itself — on-site or administrative verification is required." },
      { k: "Industrial flare", v: "An anomaly inside a facility footprint (plus a small buffer) is classified as an industrial flare. This is a model classification, not a confirmation: the footprint may be imprecise." },
      { k: "Anomaly outside the footprint", v: "Labelled as unconfirmed. It has not been shown to be non-industrial, so it cannot be called either a fire or 'not a flare'." },
      { k: "Reed fire — smoke direction (model)", v: "A reed zone is a monitoring window where Sentinel-2 NDVI > 0.4 found dense vegetation (a proxy, not a reed map). FIRMS anomalies inside these windows are taken; industrial flares are NEVER counted. A cone is drawn only for anomalies from the last 2 days: nearest Open-Meteo wind point, smoke direction = wind-from direction + 180°, width = Pasquill class D (neutral, an assumption) + wind-direction spread over the last 12 hours. Oblast settlements within the cone length and its actual angle are listed. Without wind data no cone is drawn — 'no wind data — direction not calculated'. No concentration (µg/m³) is given." },
    ],
    note: "Limitation: each 375 m pixel is imaged only during a satellite overpass (several times a day); clouds and smoke can hide the signal. The period filter uses the anomaly date (acq_date).",
  },
} as const;

function FireAnomalyMethodology() {
  const { lang } = useLang();
  const c = FIRE_METH[lang];
  return (
    <section className="mb-10 rounded-xl border border-neutral-300 bg-neutral-50 p-4" aria-labelledby="fire-meth-title">
      <h2 id="fire-meth-title" className="mb-2 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        {c.title} <TierBadge tone="light" tier="measurement" />
      </h2>
      <dl className="space-y-2 text-[13px] leading-relaxed text-neutral-700">
        {c.rows.map((r) => (
          <div key={r.k}>
            <dt className="font-semibold text-neutral-900">{r.k}</dt>
            <dd className="text-neutral-600">{r.v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-[12px] leading-snug text-neutral-600">{c.note}</p>
    </section>
  );
}

// P4.1 / P4.2 — шектердің негізі мен жетіспейтін жергілікті деректер ашық жазылады.
const GREEN_METH = {
  kk: {
    title: "Көгалдандыру: OSM, NDVI және ұсыныстар",
    rows: [
      { k: "OSM картографиясы · ODbL 1.0", v: "OpenStreetMap саябақ, бақ, орман, шөп, ағаш қатары мен жеке ағаш белгілері Overpass арқылы алынады. © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. Толықтығы тексерілмеген: картада объект жоқтығы жасыл аумақ жоқ деген сөз емес. Аудандар қабаттасуын шегермей қосылады; қатынастың тек жабық сыртқы контурлары алынады, ішкі тесіктер шегерілмейді; ашық контурлар өткізіліп, саны көрсетіледі." },
      { k: "Спутник индексі — жердегі шындық емес", v: "Sentinel-2 L2A: NDVI = (B08 − B04)/(B08 + B04). SCL 3, 8, 9, 10, 11 және dataMask=0 пиксельдері алынады, бөлім ≤0 болса да есептелмейді. 60 м, P7D; қамту ≥0.6 болған кемінде екі аптаның медианасы. Соңғы толық маусым–тамыз бен одан бес жыл бұрынғы жаз салыстырылады; қыркүйекке дейін былтырғы жаз алынады. Атырау терезесі [51.72, 47.00, 52.12, 47.30], 3×3 тор; әкімшілік шекара емес. Әр кезеңнің үлестері мен NDVI медианалары бөлек есептеледі." },
      { k: "Шектер және өзгеріс", v: "NDVI ≥0.2 — өсімдік, >0.4 — тығыз өсімдік; өсімдік үлесінің өзгерісі ≥+0.05 — өсу, ≤−0.05 — азаю, әйтпесе тұрақты. Бұл — жоба болжамдары, Атырауда валидацияланбаған. NDVI су пиксельдерін қамтиды (waterFraction). Жауын-шашын, суару мен құрылыс өзгеріске әсер етеді; бұл ағаш отырғызу/кесу дәлелі емес. Бұлтты апталар алынады, жоқ мән нөл емес." },
      { k: "Ұсыныс ережелері · AI қолданылмаған", v: "NDVI жоқ → ұсыныс жоқ. OSM жер мақсаты жоқ → жер мақсаты ескерілмейді. OSM объектілерінің кемінде жартысы бір санатта болса, сол басым (тең болса аралас); ауданмен өлшенбейді. Тұрғын аумақ + өсімдік үлесі <0.15 → көше/аула ағаштарын қарастыру; өнеркәсіп → қорғаныш белдеуін қарастыру; азаю → себебін жерде тексеру. SCL=6 су үлесі ≥0.01 немесе OSM су объектісі ≥1 → суару мүмкіндігін тексеру. Екі су кірісі белгілі және бұл шарт орындалмаса → құрғаққа төзімді өсімдік/тамшылатып суаруды қарастыру. Басқа ереже болмаса басым ұсыныс жоқ. 0.15 және 0.01 — жоба болжамдары, валидацияланбаған. Су объектісінің болуы қолжетімді, жарамды не рұқсат етілген суаруды білдірмейді." },
      { k: "Жетіспейтін жергілікті жағдайлар", v: "Топырақ тұздылығы — Дерек жоқ (әр карточкада көрсетіледі). Жер иелігі, су сапасы, суаруға рұқсат және жергілікті түрлер тізімі тексерілмеген; түр атаулары ұсынылмайды. Барлық ұсыныс жобалауға дейін жердегі тексеруді қажет етеді. OSM мен спутник санауыштары дереккөз істемесе бөлек «—» көрсетеді." },
    ],
  },
  ru: {
    title: "Озеленение: OSM, NDVI и рекомендации",
    rows: [
      { k: "Картография OSM · ODbL 1.0", v: "Метки OpenStreetMap: парки, сады, леса, травяные участки, ряды деревьев и отдельные деревья — через Overpass. © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. Полнота не проверена: отсутствие объекта на карте не означает отсутствия зелени. Площади суммируются без вычитания перекрытий; у отношений берутся только замкнутые внешние контуры, внутренние отверстия не вычитаются; незамкнутые контуры пропускаются и считаются." },
      { k: "Спутниковый индекс — не наземная истина", v: "Sentinel-2 L2A: NDVI = (B08 − B04)/(B08 + B04). Исключены SCL 3, 8, 9, 10, 11, dataMask=0 и знаменатель ≤0. 60 м, P7D; медианы минимум двух недель с покрытием ≥0.6. Сравниваются последний полный июнь–август и лето на пять лет раньше; до сентября берётся прошлогоднее лето. Окно Атырау [51.72, 47.00, 52.12, 47.30], сетка 3×3; это не административная граница. Медианы долей и NDVI каждого сезона считаются отдельно." },
      { k: "Пороги и изменение", v: "NDVI ≥0.2 — растительность, >0.4 — густая; изменение доли растительности ≥+0.05 — рост, ≤−0.05 — снижение, иначе стабильно. Это допущения проекта, не валидированные в Атырау. NDVI включает водные пиксели (waterFraction). Осадки, полив и строительство влияют на изменение; это не доказательство посадки/вырубки. Облачные недели исключены, отсутствие значения не означает ноль." },
      { k: "Правила рекомендаций · без ИИ", v: "Нет NDVI → нет рекомендации. Нет землепользования OSM → оно не учитывается. Категория с не менее чем половиной объектов OSM считается преобладающей (при равенстве — смешанная); это не площадь. Жилая территория + доля растительности <0.15 → рассмотреть уличные/дворовые деревья; промышленная → защитный пояс; снижение → проверить причину на месте. Доля воды SCL=6 ≥0.01 или ≥1 водного объекта OSM → проверить возможность полива. Если оба водных входа известны и условие не выполнено → рассмотреть засухоустойчивые растения/капельный полив. Без иных правил нет приоритетной рекомендации. 0.15 и 0.01 — допущения проекта, не валидированы. Наличие воды не означает доступность, пригодность или разрешение на полив." },
      { k: "Недостающие местные условия", v: "Засолённость почвы — Нет данных (в каждой карточке). Землевладение, качество воды, разрешение на полив и местный список видов не проверены; виды не рекомендуются. Перед проектированием нужна проверка на месте. Счётчики OSM и спутника независимо показывают «—» при отказе своего источника." },
    ],
  },
  en: {
    title: "Greening: OSM, NDVI and recommendations",
    rows: [
      { k: "OSM mapping · ODbL 1.0", v: "OpenStreetMap parks, gardens, woods, grass, tree rows and individual trees are fetched through Overpass. © OpenStreetMap contributors, ODbL: https://www.openstreetmap.org/copyright. Completeness is unverified: an unmapped object does not mean greenery is absent. Areas are summed without subtracting overlaps; only closed outer relation rings are used, without subtracting inner holes; open rings are skipped and counted." },
      { k: "Satellite index — not ground truth", v: "Sentinel-2 L2A: NDVI = (B08 − B04)/(B08 + B04). SCL 3, 8, 9, 10, 11, dataMask=0 and denominators ≤0 are excluded. 60 m, P7D; medians of at least two weeks with coverage ≥0.6. The latest complete June–August is compared with summer five years earlier; before September, last year's summer is used. Atyrau window [51.72, 47.00, 52.12, 47.30], 3×3 grid; not an administrative boundary. Fraction and NDVI medians are calculated independently for each season." },
      { k: "Thresholds and change", v: "NDVI ≥0.2 means vegetation, >0.4 dense vegetation; vegetated share change ≥+0.05 means increase, ≤−0.05 decrease, otherwise stable. These are project assumptions, not validated in Atyrau. NDVI includes water pixels (waterFraction). Rainfall, irrigation and construction affect change; this does not prove tree planting/removal. Cloudy weeks are excluded; missing is not zero." },
      { k: "Recommendation rules · no AI used", v: "No NDVI → no recommendation. No OSM land use → land use is not considered. A category with at least half of OSM objects dominates (ties are mixed); counts are not area. Residential land + vegetated share <0.15 → consider street/courtyard trees; industrial land → protective belt; decline → check the cause on site. SCL=6 water share ≥0.01 or ≥1 OSM water object → assess irrigation feasibility. If both water inputs are known and the condition fails → consider drought-tolerant plants/drip irrigation. With no other rule there is no priority recommendation. 0.15 and 0.01 are unvalidated project assumptions. Water presence does not imply availability, suitability or permission to irrigate." },
      { k: "Missing local conditions", v: "Soil salinity — No data (shown in every card). Ownership, water quality, irrigation permission and a local species list are unverified; species are not recommended. All advice requires on-site checks before design. OSM and satellite tiles independently show ‘—’ when their own source fails." },
    ],
  },
} as const;

function GreeneryMethodology() {
  const { lang } = useLang();
  const c = GREEN_METH[lang];
  return <section className="mb-10 rounded-xl border border-neutral-300 bg-neutral-50 p-4" aria-labelledby="green-meth-title">
    <h2 id="green-meth-title" className="mb-2 text-sm font-semibold text-neutral-900">{c.title}</h2>
    <dl className="space-y-3 text-[13px] leading-relaxed">{c.rows.map((row) => <div key={row.k}><dt className="font-semibold text-neutral-900">{row.k}</dt><dd className="text-neutral-600">{row.v}</dd></div>)}</dl>
  </section>;
}

export default function MethodologyPage() {
  const { tr } = useLang();
  const { t } = useLang();
  const validated = INDICATORS.filter((i) => i.validated).length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-12 text-neutral-900">
      <h1 className="mb-2 text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{tr("Әдістеме және валидация")}</h1>
      <p className="mb-6 max-w-2xl text-sm leading-relaxed text-neutral-600">
        {tr("Бұл бетте сайттағы әр көрсеткіштің қайдан келетіні, қалай есептелетіні және")}{" "}
        <span className="text-neutral-900">{tr("не тексерілмегені")}</span> {tr("жазылған. Валидация бағаны көбіне «жоқ» деп тұр — себебі Атырауда жердегі бақылау деректері бізде жоқ. Оны жасыру жалған сенімділік беру болар еді.")}{" "}</p>

      <div className="mb-8 flex flex-wrap gap-2 text-[13px]">
        <Link
          href="/eco-passport"
          className="rounded border border-neutral-300 bg-white px-3 py-2 font-medium text-[#0b3a6b] transition hover:border-[#0b3a6b]"
        >
          {tr("Толық эко-паспортты ашу (формулалармен) →")}{" "}</Link>
        <Link
          href="/methodology/jaiyq-mri"
          className="rounded border border-neutral-300 bg-white px-3 py-2 font-medium text-[#0b3a6b] transition hover:border-[#0b3a6b]"
        >
          {tr("JAIYQ-MRI маса моделінің толық әдістемесі →")}{" "}</Link>
        <a
          href="/JAIYQ-MRI-adistemesi.pdf"
          className="rounded border border-neutral-300 bg-white px-3 py-2 font-medium text-[#0b3a6b] transition hover:border-[#0b3a6b]"
        >
          {tr("PDF (11 бет)")}{" "}</a>
        <Link
          href="/validation"
          className="rounded border border-neutral-300 bg-white px-3 py-2 font-medium text-[#0b3a6b] transition hover:border-[#0b3a6b]"
        >
          {t("val.link.validationHub")}
        </Link>
      </div>

      {/* Маса моделі — жеке құжат. Ол басқа көрсеткіштерден бөлек, себебі
          бұл жобаның ӨЗ моделі: формуласы, дәлелдері, әлемдік модельдермен
          салыстыруы және не жетіспейтіні толық жазылған. */}
      <div className="mb-8 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
        <h2 className="mb-1 text-sm font-semibold text-violet-800">
          {tr("JAIYQ-MRI — жобаның өз моделі")}{" "}</h2>
        <p className="text-[13px] leading-relaxed text-neutral-700">
          {tr("Маса тәуекел индексі — сырттан алынған модель емес, осы жоба үшін жасалған тасқын-импульсті жұмыртқа банкі моделі. Толық әдістемесінде формулалар, дереккөздер, жеті әлемдік модельмен салыстыру, «шынымен жаңа ма» деген шыншыл баға және не жетіспейтіні (шешу жолымен қоса) жазылған.")}{" "}</p>
        <Link
          href="/methodology/jaiyq-mri"
          className="mt-2 inline-block text-[13px] text-violet-800 underline-offset-2 hover:underline"
        >
          {tr("Толық құжатты ашу →")}{" "}</Link>
      </div>

      <FireAnomalyMethodology />
      <GreeneryMethodology />

      <div className="mb-10 rounded-xl border border-neutral-300 bg-neutral-50 p-4">
        <h2 className="mb-2 text-sm font-semibold text-neutral-900">{tr("Сенімділік деңгейлері")}</h2>
        <TierLegend tone="light" className="!text-[13px]" />
        <p className="mt-3 text-[13px] text-neutral-600">
          {tr("Барлығы")}{" "}<span className="text-neutral-900">{INDICATORS.length}</span> {tr("көрсеткіш, оның")}{" "}
          <span className="text-neutral-900">{validated}</span>{tr("-і валидацияланған.")}{" "}</p>
      </div>

      {SECTIONS.map((section) => {
        const items = INDICATORS.filter((i) => i.section === section);
        if (!items.length) return null;
        return (
          <section key={tr(section)} className="mb-10">
            <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr(section)}</h2>
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="rounded-xl border border-neutral-300 bg-neutral-50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <TierBadge tone="light" tier={it.tier} />
                    <h3 className="text-sm font-semibold text-neutral-900">{tr(it.name)}</h3>
                    <span
                      className={`ml-auto rounded-full border px-2 py-0.5 text-[12px] ${
                        it.validated
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-amber-300 bg-amber-50 text-amber-800"
                      }`}
                    >
                      {it.validated ? tr("валидацияланған") : tr("валидацияланбаған")}
                    </span>
                  </div>

                  <p className="mb-2 text-[13px] leading-relaxed text-neutral-700">{tr(it.what)}</p>

                  {it.formula && (
                    <div className="mb-2 overflow-x-auto rounded-md border border-neutral-300 bg-neutral-50 px-2.5 py-1.5 font-mono text-[13px] text-emerald-800">
                      {tr(it.formula)}
                    </div>
                  )}

                  {/* ЕСЕПТЕУ ТІЗБЕГІ — формула мен нәтиженің арасындағы
                      әр қадам. Әдістеме бетінің ең негізгі бөлігі: эколог
                      санның қалай шыққанын қайталай алуы керек. */}
                  {it.steps.length > 0 && (
                    <ol className="mb-2 space-y-0.5 rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] leading-relaxed text-neutral-700">
                      {it.steps.map((st, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="shrink-0 font-mono text-[12px] text-neutral-600">
                            {i + 1}.
                          </span>
                          <span>{tr(st)}</span>
                        </li>
                      ))}
                    </ol>
                  )}

                  <dl className="grid gap-x-6 gap-y-1 text-[13px] leading-relaxed sm:grid-cols-[max-content_1fr]">
                    <dt className="text-neutral-600">{tr("Аспап / модель")}</dt>
                    <dd className="text-neutral-700">{tr(it.instrument)}</dd>
                    <dt className="text-neutral-600">{tr("Ажыратымдылық")}</dt>
                    <dd className="text-neutral-700">
                      {tr(it.spatial)} · {tr(it.temporal)} {tr("· кідіріс")}{" "}{tr(it.latency)}
                    </dd>
                    <dt className="text-neutral-600">{tr("Дереккөз құжаты")}</dt>
                    <dd className="space-y-0.5">
                      {it.sources.map((s, i) =>
                        s.url ? (
                          <a
                            key={i}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sky-800 underline-offset-2 hover:underline"
                          >
                            {tr(s.label)} <ExternalLink className="inline h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span key={i} className="block text-neutral-700">
                            {tr(s.label)}
                          </span>
                        )
                      )}
                    </dd>
                    <dt className="text-neutral-600">{tr("Валидация")}</dt>
                    <dd className="text-neutral-700">{tr(it.validationNote)}</dd>
                  </dl>

                  <ul className="mt-2 space-y-0.5 border-t border-neutral-300 pt-2 text-[13px] text-amber-800">
                    {it.limits.map((l, i) => (
                      <li key={i}>{tr(l)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-neutral-900">{tr("Су туралы төрт көрсеткіш")}</h2>
        <p className="mb-3 text-[13px] leading-relaxed text-neutral-600">
          {tr("Сайтта суға қатысты төрт бөлек көрсеткіш бар. Олар бір-бірін қайталамайды — әрқайсысы басқа сұраққа жауап береді:")}{" "}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <thead className="text-neutral-600">
              <tr className="border-b border-neutral-300">
                <th className="py-2 pr-3 font-medium">{tr("Көрсеткіш")}</th>
                <th className="py-2 pr-3 font-medium">{tr("Нені өлшейді")}</th>
                <th className="py-2 pr-3 font-medium">{tr("Уақыт ауқымы")}</th>
                <th className="py-2 font-medium">{tr("Эндпоинт")}</th>
              </tr>
            </thead>
            <tbody>
              {WATER.map((w) => (
                <tr key={w.api} className="border-b border-neutral-300 last:border-0">
                  <td className="py-2 pr-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TierBadge tone="light" tier={w.tier} />
                      <span className="text-neutral-900">{tr(w.n)}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-neutral-700">{tr(w.what)}</td>
                  <td className="py-2 pr-3 text-neutral-600">{tr(w.when)}</td>
                  <td className="py-2 font-mono text-[12px] text-neutral-600">{w.api}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="mb-2 text-xl font-semibold text-neutral-900">{tr("Жалған дерек көрсетілмейді")}</h2>
        <p className="mb-2 text-[13px] leading-relaxed text-neutral-600">
          {tr("Дерек көзі қолжетімсіз болса, сайт бос орынды толтыруға тырыспайды: тиісті блок «уақытша қолжетімсіз» деп жазады. Бұл жобаның негізгі ережесі.")}{" "}</p>
        <ul className="list-inside list-disc space-y-1 text-[13px] text-neutral-600">
          <li>{tr("AI кілті жоқ немесе шақыру сәтсіз → талдау көрсетілмейді")}</li>
          <li>{tr("Спутник өтуі жоқ → сол аймақ «өлшенбеді» болып қалады")}</li>
          <li>{tr("Модель дәлдігі талапқа жетпесе → болжам автоматты түрде жасырылады")}</li>
          <li>{tr("Эко-паспортта жалпы «эко-балл» жоқ — түрлі бірліктегі шаманы қосу негізсіз")}</li>
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-xl font-semibold text-neutral-900">{tr("Не істеу керек (жоспар)")}</h2>
        <ol className="list-inside list-decimal space-y-1 text-[13px] text-neutral-600">
          <li>
            {tr("Qazhydromet станцияларының тарихи деректерін жинай бастау — сонда модельдерді нақты өлшеммен салыстыруға болады")}{" "}</li>
          <li>{tr("Су басқан аумақты нақты тасқын кезеңіндегі жердегі есептермен салыстыру")}</li>
          <li>{tr("Маса тұзақтарының деректерін алу — MRI индексін валидациялаудың жалғыз жолы")}</li>
        </ol>
      </section>
    </main>
  );
}
