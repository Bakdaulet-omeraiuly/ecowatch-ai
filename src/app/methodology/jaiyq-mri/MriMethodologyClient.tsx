"use client";


import { useLang } from "@/lib/i18n";
import Link from "next/link";
import { Download, ArrowLeft, Printer } from "lucide-react";

// JAIYQ-MRI ӘДІСТЕМЕСІ — толық техникалық құжат.
//
// Мұнда модельдің формуласы, логикасы, дереккөздері, әлемдік
// модельдермен салыстыруы және НЕ ЖЕТІСПЕЙТІНІ жазылған.
//
// ⚠️ Ең маңызды принцип: бұл — жарнама емес. Модельдің
// валидацияланбағаны, параметрлерінің калибрленбегені және қандай
// тұжырым жасауға жарамайтыны ашық көрсетілген. Сол мәтін
// public/JAIYQ-MRI-adistemesi.pdf файлымен бірдей.



const OK = "text-emerald-800";
const NO = "text-red-800";
const PARTIAL = "text-amber-800";

const LAYERS: { id: string; what: string; state: string; cls: string; how: string }[] = [
  { id: "L1", what: "Гидро-мекен: су басуды анықтау", state: "істейді", cls: OK,
    how: "Sentinel-1 SAR + GloFAS → тасқын импульсі" },
  { id: "L1", what: "Каспий деңгейі модуляторы", state: "жоқ", cls: NO,
    how: "Тексерілген тегін дереккөз табылмады" },
  { id: "L2", what: "FPEB ядросы: жұмыртқа банкі динамикасы", state: "істейді", cls: OK,
    how: "dE/dt, dL/dt, dA/dt тәуліктік интеграция" },
  { id: "L2", what: "Гидропериод", state: "істейді", cls: OK,
    how: "S1 өтулері бойынша «кемінде N күн»" },
  { id: "L3", what: "Температура гейті", state: "істейді", cls: OK,
    how: "Mordecai 2019 термиялық шектері" },
  { id: "L4", what: "Culex / WNV тармағы", state: "істейді", cls: OK,
    how: "Sentinel-2 NDVI → қамыс мекені" },
  { id: "L5", what: "ML болжам (LSTM/GRU + RF/SHAP)", state: "жоқ", cls: NO,
    how: "Валидациясыз қосу жалған дәлдік берер еді" },
  { id: "L6", what: "Bayesian белгісіздік интервалы", state: "жоқ", cls: NO, how: "Сол себеп" },
  { id: "L7", what: "Digital twin + ассимиляция", state: "ішінара", cls: PARTIAL,
    how: "Күй қайта интегралданады; ассимиляциялайтын бақылау жоқ" },
];

const PARAMS: [string, string, string, string][] = [
  ["DD", "150 °C·тәулік", "Жұмыртқа→ересек градус-күн", "Кулициндік әдебиет"],
  ["T_base", "10 °C", "Даму табалдырығы", "Кулициндік әдебиет"],
  ["μ_L", "0,10 /тәулік", "Дернәсіл өлімі", "Әдебиеттегі типтік шама"],
  ["μ_A", "0,12 /тәулік", "Ересек өлімі", "Әдебиеттегі типтік шама"],
  ["k_h", "0,6", "Жарылу коэффициенті", "Модель баптауы"],
  ["f", "0,15 /тәулік", "Банктің толығуы", "Модель баптауы"],
  ["T₀ / Tm", "16,8 / 34,9 °C", "Термиялық шектер", "Mordecai 2019 "],
];

const COMPARE: { model: string; approach: string; strong: string; why: string }[] = [
  { model: "MoLS", approach: "Механистік өмір циклі",
    strong: "Толық биологиялық тізбек",
    why: "Параметрлері ыдыс-су Ae. aegypti үшін. Тасқын-импульс механизмі жоқ" },
  { model: "Aedes-AI", approach: "Нейрожелі (LSTM/GRU)",
    strong: "Жылдам, ықтималдық шығыс",
    why: "MoLS-тің aegypti биологиясын мұрагерлейді, АҚШ-қа калибрленген" },
  { model: "MAMOTH / EYWA", approach: "Спутник + метео + тұзақ",
    strong: "Операциялық, Еуропада қолданыста. Ең жақын аналог",
    why: "Оқыту үшін тұзақ деректері МІНДЕТТІ — Атырауда олар жоқ" },
  { model: "VECTRI", approach: "Климаттық-динамикалық",
    strong: "Континенттік ауқым, су айдынын қоса есептейді",
    why: "Безгек (Anopheles) үшін, Африкаға бағдарланған" },
  { model: "Mordecai термиялық модельдері", approach: "Физиологиялық-термиялық",
    strong: "Жергілікті дерексіз ауысады, рецензияланған",
    why: "ТЕК температура. Су, мекен, гидрология жоқ" },
  { model: "Камарг Ae. caspius моделі", approach: "Тасқынға негізделген популяция динамикасы",
    strong: "Дәл біздің түрге арналған, тасқын-импульс механизмі бар",
    why: "Спутникпен байланыспаған, операциялық жүйе емес" },
  { model: "RF / XGBoost + SHAP", approach: "Статистикалық оқыту",
    strong: "Түсіндірмелі, бейсызық",
    why: "Оқыту үшін бақылау керек — жоқ. Экстраполяциясы нашар" },
];

const MATRIX: { feature: string; vals: (string | null)[] }[] = [
  { feature: "Тасқын-импульс ажыратқышы", vals: ["иә", "жоқ", "жоқ", "жоқ", "иә", "жоқ"] },
  { feature: "Диапаузалы жұмыртқа банкі", vals: ["иә", "жоқ", "ішінара", "жоқ", "иә", "жоқ"] },
  { feature: "Спутниктен өлшенген су", vals: ["иә", "иә", "жоқ", "жоқ", "жоқ", "жоқ"] },
  { feature: "Гидропериод (ұзақтығы)", vals: ["иә", "жоқ", "жоқ", "жоқ", "жанама", "жоқ"] },
  { feature: "Қамыс мекені (NDVI)", vals: ["иә", "иә", "жоқ", "жоқ", "жоқ", "жоқ"] },
  { feature: "Қос түр, маусымдық салмақ", vals: ["иә", "ішінара", "жоқ", "жоқ", "жоқ", "жоқ"] },
  { feature: "Тұзақ деректерінсіз жұмыс", vals: ["иә", "жоқ", "иә", "жоқ", "жоқ", "иә"] },
  { feature: "ВАЛИДАЦИЯЛАНҒАН", vals: ["ЖОҚ", "иә", "иә", "иә", "иә", "иә"] },
  { feature: "Белгісіздік интервалы", vals: ["жоқ", "ішінара", "жоқ", "иә", "жоқ", "иә"] },
];
const MATRIX_COLS = ["JAIYQ-MRI", "MAMOTH", "MoLS", "Aedes-AI", "Камарг", "Mordecai"];

const GAPS: { title: string; problem: string; fix: string[] }[] = [
  {
    title: "8.1 Валидация — ең үлкен олқылық",
    problem:
      "Модель ешқашан нақты маса санымен салыстырылмаған. «MRI 70 нүктесінде MRI 40 нүктесіне қарағанда шынымен көп маса бар ма?» деген сұраққа жауап жоқ.",
    fix: [
      "6–10 тұзақ (CDC light trap немесе BG-Sentinel) индексі әртүрлі нүктелерге: 2 — Жайық жағасы, 2 — қамыс алқабы, 2 — қала ішінде, 2 — құрғақ бақылау нүктесі",
      "Кезеңі: мамыр–қыркүйек, аптасына 2 рет санау",
      "Ұзақтығы: кемінде 1 маусым (шешуші), 2 маусым (сенімді)",
      "Нәтижесі: MRI мен тұзақ саны арасындағы Спирман корреляциясы. ρ > 0,6 болса модель «валидацияланған» деп белгіленеді",
      "Кім істей алады: облыстық СЭС, ветеринария қызметі немесе университет биология кафедрасы — жабдық қымбат емес",
    ],
  },
  {
    title: "8.2 Түрге тән параметрлер",
    problem: "Жеті параметрдің алтауы Aedes caspius үшін калибрленбеген.",
    fix: [
      "Тұзақ деректері жиналған соң параметрлерді кері фиттеу (least-squares немесе Bayesian)",
      "Немесе зертханада дернәсілдің даму ұзақтығын әртүрлі температурада өлшеу — бір маусымдық жұмыс",
    ],
  },
  {
    title: "8.3 Каспий деңгейінің әсері",
    problem:
      "Каспий деңгейі 1996 жылдан бері түсуде. Ол тұздылау батпақтардың ауданын қайта пішіндейді — бірақ модельде ескерілмеген.",
    fix: [
      "Спутниктік альтиметрия деректері (Hydroweb, G-REALM, Copernicus Marine)",
      "Ай сайынғы деңгей қатары модельге баяу модулятор ретінде қосылады",
      "Кедергі: тексерілген тегін API әлі табылмады — қолмен жүктелетін файлдарды автоматтандыру керек",
    ],
  },
  {
    title: "8.4 Гидропериодтың дәлдігі",
    problem:
      "Sentinel-1 қайталауы ~6 тәулік, сондықтан «су кемінде N күн тұрды» деген төменгі шек қана шығады. Екі өту арасында су кеуіп, қайта басуы мүмкін.",
    fix: [
      "Sentinel-2 су индексін (MNDWI) қосу — бұлтсыз күндері қосымша өтулер береді, уақыттық тығыздық шамамен екі есе артады",
      "Инфрақұрылым дайын: S2 сұранысы қамыс мекені үшін жазылған",
    ],
  },
  {
    title: "8.5 Қамыс классификациясының тексерілуі",
    problem:
      "NDVI > 0,4 — тығыз өсімдік, бірақ суармалы егіс пен ағаш екпелері де сол шекке кіреді.",
    fix: [
      "Жоғары ажыратымдылықты сурет бойынша 50–100 нүктені қолмен тексеру",
      "Sentinel-2 көп арналы классификациясы (қамыстың су үстіндегі спектрі ерекше)",
      "Далалық маршрутпен растау",
    ],
  },
  {
    title: "8.6 Белгісіздік интервалы",
    problem: "Модель нүктелік сан береді, ал шын мәнінде белгісіздігі үлкен.",
    fix: [
      "Параметрлердің ықтимал диапазонымен ансамбль жүргізу (50–100 жүгіріс) → пайыздық интервал",
      "Бұл ЖАҢА дерек талап етпейді, тек есептеу",
      "Бірақ интервалдың ені калибрлеусіз шындыққа сай болмайды — валидациядан КЕЙІН істеген дұрыс",
    ],
  },
];

const PRIORITY: [string, string, string, string][] = [
  ["1", "Тұзақ желісін орнату (валидация)", "орташа", "Далалық жұмыс, серіктес керек"],
  ["2", "Гидропериодқа S2 қосу", "аз", "Тәуелділігі жоқ — бірден істеуге болады"],
  ["3", "Қамыс классификациясын тексеру", "аз", "Тәуелділігі жоқ"],
  ["4", "Каспий деңгейі модуляторы", "орташа", "Дереккөзді автоматтандыру"],
  ["5", "Параметрлерді фиттеу", "орташа", "№1 аяқталуы керек"],
  ["6", "Ансамбль + белгісіздік", "орташа", "№5 аяқталуы керек"],
  ["7", "ML қабаты (L5)", "үлкен", "№1 — оқыту үшін жапсырма керек"],
];

const REFS: { label: string; url?: string }[] = [
  { label: "Mordecai E.A. et al. (2019) — Thermal biology of mosquito-borne disease, PLoS NTD",
    url: "https://doi.org/10.1371/journal.pntd.0006451" },
  { label: "Mordecai E.A. et al. (2017) — Detecting the impact of temperature on transmission, PLoS NTD",
    url: "https://doi.org/10.1371/journal.pntd.0005568" },
  { label: "Aedes caspius flooding population-dynamics model (Камарг), Bulletin of Entomological Research" },
  { label: "Батыс Қазақстан WNV / Culex modestus, Frontiers in Public Health (2020)",
    url: "https://www.frontiersin.org/articles/10.3389/fpubh.2020.575187/full" },
  { label: "WNV Қазақстан жылқыларында, Атырауды қоса (8,7 %)",
    url: "https://doi.org/10.3390/microorganisms13112541" },
  { label: "MAMOTH — Earth Observation data-driven model for mosquito abundance; EYWA жүйесі" },
  { label: "MoLS — Mosquito Life Cycle Simulation", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6367629/" },
  { label: "Aedes-AI нейрожелілері, PLoS Comput Biol",
    url: "https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1009467" },
  { label: "Van Wagner C.E. (1987) — Canadian FWI жүйесі (spin-up тәсілінің үлгісі)" },
  { label: "Ақжайық Рамсар алаңы", url: "https://rsis.ramsar.org/ris/1856" },
];

function Eqn({ children }: { children: React.ReactNode }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-lg border border-neutral-300 border-l-2 border-l-emerald-400 bg-black/40 p-3 font-mono text-[13px] leading-relaxed text-emerald-800 print:border-gray-300 print:bg-gray-50 print:text-black">
      {children}
    </pre>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-10 border-b border-emerald-300 pb-1.5 text-lg font-semibold text-emerald-800 print:border-gray-400 print:text-black">
      {children}
    </h2>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-5 text-[15px] font-semibold text-neutral-900 print:text-black">{children}</h3>;
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-neutral-300 print:border-gray-300">
      <table className="w-full min-w-[540px] text-left text-[13px]">{children}</table>
    </div>
  );
}

const TH = "bg-neutral-50 px-2.5 py-1.5 font-medium text-neutral-700 print:bg-gray-100 print:text-black";
const TD = "border-t border-neutral-300 px-2.5 py-1.5 align-top text-neutral-700 print:border-gray-200 print:text-black";

export default function MriMethodologyClient() {
  const { tr } = useLang();
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/methodology"
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-700 transition hover:bg-neutral-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {tr("Әдістемеге қайту")}{" "}</Link>
        <a
          href="/JAIYQ-MRI-adistemesi.pdf"
          className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 transition hover:bg-emerald-100"
        >
          <Download className="h-3.5 w-3.5" /> {tr("PDF жүктеу (11 бет)")}{" "}</a>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-600">
          <Printer className="h-3.5 w-3.5" /> {tr("Ctrl+P — басып шығару")}{" "}</span>
      </div>

      {/* Титул */}
      <header className="border-b-2 border-emerald-300 pb-5 print:border-gray-400">
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-emerald-800 print:text-emerald-800">
          {tr("Ғылыми-техникалық әдістеме · Jaiyq экологиялық мониторинг платформасы")}{" "}</div>
        <h1 className="mt-2 print:text-black text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">
          JAIYQ-MRI
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-700 print:text-gray-700">
          {tr("Тасқын-импульсті жұмыртқа банкіне негізделген маса тәуекел моделі")}{" "}<br />
          {tr("Атырау қаласы және Жайық өзенінің атырауы, Солтүстік Каспий")}{" "}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-1 text-[13px] text-neutral-600 sm:grid-cols-2 print:text-gray-600">
          <div><span className="text-neutral-600">{tr("Толық аты:")}</span>{" "}
            <span className="text-neutral-900 print:text-black">Jaiyq Flood-pulse Mosquito Risk Intelligence</span></div>
          <div><span className="text-neutral-600">{tr("Ядросы:")}</span>{" "}
            <span className="text-neutral-900 print:text-black">FPEB — Flood-Pulse Egg-Bank engine</span></div>
          <div><span className="text-neutral-600">{tr("Түрі:")}</span>{" "}
            <span className="text-neutral-900 print:text-black">{tr("механистік компартмент моделі + қашықтан зондтау")}</span></div>
          <div><span className="text-neutral-600">{tr("Валидация күйі:")}</span>{" "}
            <span className="font-semibold text-red-800 print:text-red-700">{tr("валидацияланбаған")}</span></div>
          <div><span className="text-neutral-600">{tr("Аумағы:")}</span>{" "}
            <span className="text-neutral-900 print:text-black">{tr("Атырау облысы, 90 есептеу нүктесі")}</span></div>
          <div><span className="text-neutral-600">{tr("Жаңару жиілігі:")}</span>{" "}
            <span className="text-neutral-900 print:text-black">{tr("сағат сайын")}</span></div>
        </dl>
      </header>

      <div className="mt-5 rounded-lg border-l-2 border-red-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-red-50 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Құжаттың мәртебесі.")}</b> {tr("Бұл — жұмыс істеп тұрған жүйенің техникалық сипаттамасы, жарнамалық материал емес. Модельдің әлі тексерілмегені, параметрлерінің калибрленбегені және қандай тұжырым жасауға жарамайтыны ашық жазылған. Әр сан қай дереккөзден келетіні көрсетілген.")}{" "}</div>

      <H2>{tr("1. Модель нені өлшейді және нені өлшемейді")}</H2>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Өлшейді:")}</b> {tr("маса көбеюіне жағдайдың қаншалық қолайлы екенін — уақыт пен кеңістік бойынша салыстыруға жарайтын 0–100 индекс.")}{" "}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Өлшемейді:")}</b> {tr("маса САНЫН. Индекс 70 деген жерде бір шаршы метрде қанша маса бар екенін бұл модель айта алмайды. Ол үшін далалық тұзақ деректері қажет, олар Атырау бойынша жинақталмаған.")}{" "}</p>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Сондықтан индекс")}{" "}<b className="text-neutral-900 print:text-black">{tr("реттік")}</b> {tr("(ordinal): «А ауданы Б ауданынан қауіптірек» деген тұжырым жасауға жарайды, «А ауданында 500 маса бар» деген тұжырымға жарамайды.")}{" "}</p>

      <H3>{tr("Неге бұл модель керек болды")}</H3>
      <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Дайын модельдердің басым бөлігі")}{" "}<b>{tr("ыдыс-су")}</b> {tr("(container-breeding) масаларына —")}{" "}
        <i>Aedes aegypti</i>, <i>Ae. albopictus</i> {tr("— арналған. Олардың ажыратқышы: адам жинаған су (шина, ыдыс, науа). Ал Жайық атырауында басты драйвер мүлдем басқа:")}{" "}
        <b className="text-neutral-900 print:text-black">{tr("көктемгі қар суы тасқыны")}</b>{tr(". Су басқанда құрғақ жатқан диапаузалы жұмыртқа банкі жарылады. Ыдыс-су модельдері бұл механизмді мүлдем қамтымайды.")}{" "}</p>

      <H2>{tr("2. Экологиялық негіз")}</H2>
      <H3>{tr("2.1 Түрлер")}</H3>
      <Table>
        <thead><tr><th className={TH}>{tr("Түр")}</th><th className={TH}>{tr("Үлесі")}</th><th className={TH}>{tr("Экологиясы")}</th><th className={TH}>{tr("Маңызы")}</th></tr></thead>
        <tbody>
          <tr>
            <td className={TD}><b>Culex modestus</b></td><td className={TD}>56,2 %</td>
            <td className={TD}>{tr("Тұрақты су: қамыс көлшіктері, суару каналдары, қала дренажы")}</td>
            <td className={TD}>{tr("Батыс Нил вирусының (WNV) басты тасымалдаушысы")}</td>
          </tr>
          <tr>
            <td className={TD}><b>Aedes caspius</b> {tr("(және")}{" "}<i>vexans, flavescens, cinereus</i>)</td>
            <td className={TD}>{tr("басым топ")}</td>
            <td className={TD}>{tr("Тасқын-су, тұздылау батпақ. Десикацияға төзімді диапаузалы жұмыртқа")}</td>
            <td className={TD}>{tr("Массалық мазалау — тұрғындарға тікелей әсері")}</td>
          </tr>
          <tr>
            <td className={TD}><b>Anopheles</b> (<i>maculipennis, hyrcanus</i>)</td><td className={TD}>1,8 %</td>
            <td className={TD}>{tr("Тұрақты су, жылы климат")}</td>
            <td className={TD}>{tr("Аз, бірақ жылынумен таралуда")}</td>
          </tr>
        </tbody>
      </Table>
      <p className="text-[13px] text-neutral-600">
        {tr("Батыс Қазақстан / Жайық-Ақжайық аулау жинақтары бойынша. Атырау қаласының өз тұзақ базасы жоқ.")}{" "}</p>

      <div className="my-3 rounded-lg border-l-2 border-amber-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-amber-50 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Модельге тікелей әсер еткен түзету.")}</b> {tr("Әдетте «Атырауда Aedes caspius басым» деп болжанады. Ал аулау деректерінде")}{" "}
        <b className="text-neutral-900 print:text-black">{tr("Culex modestus доминант (56 %)")}</b>{tr(". Сондықтан модель екі экологияны БӨЛЕК ұстайды: тасқын-су Aedes (импульсті шыңдар) және тұрақты-су Culex (WNV, жаз ортасы), айлық салмақпен ауысады.")}{" "}</div>

      <H3>{tr("2.2 Басты драйверлер (дәлелденген реті бойынша)")}</H3>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-neutral-700 marker:text-emerald-800 print:text-black">
        <li><b>{tr("Көктемгі тасқынның көлемі мен уақыты")}</b> {tr("— жұмыртқа су басумен жарылады")}</li>
        <li><b>{tr("Гидропериод")}</b> {tr("— көлшік дернәсілдің дамуын аяқтауға жеткілікті ұзақ тұруы қажет")}</li>
        <li><b>{tr("Қамыс алқаптары")}</b> (<i>Phragmites</i>{tr(") — Culex modestus үшін ең күшті мекен предикторы")}</li>
        <li><b>{tr("Температура")}</b> {tr("— буын санын және даму жылдамдығын белгілейді")}</li>
        <li><b>{tr("Топырақ ылғалы, жауын")}</b> {tr("— қосалқы су көздері")}</li>
        <li><b>{tr("Қалалық амплификация")}</b> {tr("— дренаж, подвал, суару арықтары")}</li>
      </ol>

      <H2>{tr("3. Модельдің архитектурасы")}</H2>
      <p className="mt-2 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Жеті қабат. Әрқайсысының")}{" "}<b className="text-neutral-900 print:text-black">{tr("іске асу күйі")}</b> {tr("ашық көрсетілген — жоба құжатында сипатталғанның бәрі кодта бар емес.")}{" "}</p>
      <Table>
        <thead><tr><th className={TH}>{tr("Қабат")}</th><th className={TH}>{tr("Мазмұны")}</th><th className={TH}>{tr("Күйі")}</th><th className={TH}>{tr("Іске асуы")}</th></tr></thead>
        <tbody>
          {LAYERS.map((l, i) => (
            <tr key={i}>
              <td className={`${TD} font-mono`}>{l.id}</td>
              <td className={TD}>{tr(l.what)}</td>
              <td className={`${TD} font-semibold ${l.cls}`}>{tr(l.state)}</td>
              <td className={TD}>{tr(l.how)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2>{tr("4. Формулалар")}</H2>
      <H3>{tr("4.1 Жиынтық индекс")}</H3>
      <Eqn>{tr(`MRI = 100 · Φ_T(T) · (0,15 + 0,85 · S) · (1 + 0,4 · U + 0,5 · W)

  Φ_T — температура гейті (0…1)
  S   — түрлер қоспасы: S = clamp(w_A(ай) · A + w_C(ай) · C)
  A   — тасқын-су Aedes ересек индексі (FPEB интеграциясынан)
  C   — тұрақты-су Culex индексі
  U   — қалалық амплификация (елді мекенге жақындық, 0…1)
  W   — тасқын мүшесі = бейімділік × өлшенген импульс`)}</Eqn>
      <p className="text-[13px] leading-relaxed text-neutral-600 print:text-gray-700">
        {tr("Тұрақты мүше")}{" "}<code className="font-mono text-neutral-900 print:text-black">0,15</code> {tr("— температура рұқсат еткен кездегі фондық белсенділік: су режимі нашар болса да маса мүлдем нөл болмайды.")}{" "}</p>

      <H3>{tr("4.2 Температура гейті Φ_T")}</H3>
      <Eqn>{tr(`Φ_T(T) = (T − T₀)(Tm − T) / ((Tm − T₀)/2)²,   T₀ < T < Tm
Φ_T(T) = 0                                    әйтпесе

  T₀ = 16,8 °C     Tm = 34,9 °C     шыңы = 25,9 °C`)}</Eqn>
      <p className="text-[13px] leading-relaxed text-neutral-600 print:text-gray-700">
        {tr("Шектер Mordecai т.б. (2019) Батыс Нил вирусы жүйесі үшін жариялаған мәндерден. Нормалау шыңда дәл 1 береді. Мақаладағы Brière фитінің дәл көшірмесі емес — симметриялы жуықтау, бірақ шыңы (25,9 °C) мақалада хабарланған ~25 °C оптимумына сәйкес келеді.")}{" "}</p>

      <H3>{tr("4.3 FPEB ядросы — тасқын-импульсті жұмыртқа банкі")}</H3>
      <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Модельдің жүрегі. Тәуліктік қадаммен интегралданатын үш теңдеу:")}{" "}</p>
      <Eqn>{tr(`dE/dt = f · (φ_egg(ай) − E)  −  h(W) · E
dL/dt = h(W) · E  −  L/τ(T)  −  μ_L · L
dA/dt = (L/τ(T)) · s(hydro)  −  μ_A · A

  E — жұмыртқа банкі (диапаузалы, құрғақта тірі қалады)
  L — дернәсіл
  A — ересек
  h(W) = k_h · W            жарылу жылдамдығы (су басу қосады)
  τ(T) = DD / (T − T_base)  даму ұзақтығы, тәулік
  s(hydro)                  гидропериодтан шыққан тірі қалу
  φ_egg(ай)                 маусымдық банк сыйымдылығы`)}</Eqn>
      <div className="my-3 rounded-lg border-l-2 border-emerald-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-emerald-50 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Осы теңдеулердің мәні — КІДІРІС.")}</b> {tr("Су басқан күні маса пайда болмайды: алдымен жұмыртқа жарылады, содан кейін дернәсіл τ(T) күн дамиды. 25 °C-та бұл ≈ 10 тәулік. Кідіріссіз модель шыңды дұрыс емес күнге қояды әрі «массалық шығу қашан күтіледі» деген ең пайдалы сұраққа жауап бере алмайды.")}{" "}</div>

      <H3>{tr("4.4 Параметрлер")}</H3>
      <Table>
        <thead><tr><th className={TH}>{tr("Параметр")}</th><th className={TH}>{tr("Мәні")}</th><th className={TH}>{tr("Мағынасы")}</th><th className={TH}>{tr("Негізі")}</th></tr></thead>
        <tbody>
          {PARAMS.map(([a, b, c, d]) => (
            <tr key={a}>
              <td className={`${TD} font-mono`}>{tr(a)}</td><td className={TD}>{tr(b)}</td>
              <td className={TD}>{tr(c)}</td>
              <td className={TD}>{tr(d)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="my-3 rounded-lg border-l-2 border-red-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-red-50 print:text-black">
        {tr("Жеті параметрдің")}{" "}<b className="text-neutral-900 print:text-black">{tr("тек біреуі")}</b> {tr("(термиялық шектер) нақты жарияланған зерттеуден алынған. Қалғандары — кулициндік әдебиеттегі жалпы шамалар мен модель баптаулары.")}{" "}<i>Aedes caspius</i> {tr("үшін жергілікті калибрлеу ЖОҚ. Бұл — модельдің басты әлсіздігі.")}{" "}</div>

      <H3>{tr("4.5 Тасқын мүшесі W")}</H3>
      <Eqn>{tr(`W = БЕЙІМДІЛІК × ИМПУЛЬС

  БЕЙІМДІЛІК — Жайық арнасына/атырауға жақындық (география, тұрақты)
  ИМПУЛЬС    — 0,65 · SAR + 0,35 · GloFAS  (өлшенген, күн сайын өзгереді)
  SAR        = min(1, артық су ауданы % / 5%)
  GloFAS     = ағынның өз терезесіндегі қатынасы`)}</Eqn>
      <p className="text-[13px] leading-relaxed text-neutral-600 print:text-gray-700">
        {tr("Бұл бөліну маңызды: бейімділік «қай жер су басуға бейім» дегенді, импульс «бүгін су басты ма» дегенді көрсетеді. Бұрын екеуі араласып, сәуірде де, қаңтарда да бірдей мән беретін.")}{" "}</p>

      <H3>{tr("4.6 Culex тармағы")}</H3>
      <Eqn>{tr(`C = clamp(0,55 · R + 0,30 · W + 0,15 · U) · H(rh)

  R     — қамыс мекені (Sentinel-2 NDVI > 0,4 үлесі / 0,3)
  H(rh) — ылғалдылық көбейткіші: (rh − 40) / 45`)}</Eqn>

      <H2>{tr("5. Кіріс деректері")}</H2>
      <Table>
        <thead><tr><th className={TH}>{tr("Дерек")}</th><th className={TH}>{tr("Дереккөз")}</th><th className={TH}>{tr("Түрі")}</th><th className={TH}>{tr("Кідіріс")}</th></tr></thead>
        <tbody>
          {[
            ["Су басқан аумақ, гидропериод", "Copernicus Sentinel-1 GRD (VV, GAMMA0)", "өлшем", "1–6 тәулік"],
            ["Қамыс мекені", "Copernicus Sentinel-2 L2A (NDVI)", "өлшем", "1–5 тәулік"],
            ["Өзен ағыны", "GloFAS (Open-Meteo Flood API)", "модель", "1 тәулік"],
            ["Температура, ылғал, жауын", "ECMWF (Open-Meteo)", "модель", "1 сағат"],
            ["Топырақ ылғалы", "ECMWF топырақ моделі", "модель", "1 сағат"],
            ["Қала/елді мекен тізілімі", "Жобаның өз тізілімі (8 елді мекен)", "тізілім", "—"],
            ["Есептеу нүктелері", "Атыраудың 65 нүктесі + облыстық 5×5 тор", "тізілім", "—"],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => <td key={i} className={TD}>{tr(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </Table>

      <H3>{tr("Есептеу тізбегі")}</H3>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-neutral-700 marker:text-emerald-800 print:text-black">
        <li>{tr("90 нүкте бойынша ECMWF метеорологиясы алынады (өткен 30 + алдағы 14 тәулік)")}</li>
        <li>{tr("GloFAS күндік ағыны → күндік тасқын импульсі W(t)")}</li>
        <li>{tr("Sentinel-1 бақылау терезелерінде артық су ауданы мен гидропериод өлшенеді")}</li>
        <li>{tr("Sentinel-2 NDVI бойынша қамыс мекені бағаланады")}</li>
        <li>{tr("Әр нүкте үшін FPEB теңдеулері 30 тәуліктік «жүгіріспен» интегралданады")}</li>
        <li>{tr("Ересек индексі A(t) идеал жағдайдағы теориялық шыңға нормаланады")}</li>
        <li>{tr("Culex тармағы қосылып, айлық салмақпен араластырылады")}</li>
        <li>{tr("Температура гейті мен амплификация қолданылып, 0–100 шкаласына келтіріледі")}</li>
      </ol>

      <div className="my-3 rounded-lg border-l-2 border-amber-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-amber-50 print:text-black">
        <b className="text-neutral-900 print:text-black">{tr("Күй дерекқорда сақталмайды.")}</b> {tr("Әр сұраныста нөлден қайта интегралданады. Артықшылығы: нәтиже детерминистік, қайталанады, күй жылжып кетпейді. Жобадағы өрт қаупі индексі (FWI) де дәл осылай есептеледі — бұл салада қалыптасқан тәсіл.")}{" "}</div>

      <H2>{tr("6. Әлемдік модельдермен салыстыру")}</H2>
      <Table>
        <thead><tr><th className={TH}>{tr("Модель")}</th><th className={TH}>{tr("Тәсілі")}</th><th className={TH}>{tr("Күшті жағы")}</th><th className={TH}>{tr("Атырауға жарамауының себебі")}</th></tr></thead>
        <tbody>
          {COMPARE.map((c) => (
            <tr key={c.model}>
              <td className={`${TD} font-semibold text-neutral-900 print:text-black`}>{tr(c.model)}</td>
              <td className={TD}>{tr(c.approach)}</td>
              <td className={TD}>{tr(c.strong)}</td>
              <td className={TD}>{tr(c.why)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H3>{tr("Салыстырмалы қасиеттер")}</H3>
      <Table>
        <thead>
          <tr>
            <th className={TH}>{tr("Қасиет")}</th>
            {MATRIX_COLS.map((c, i) => (
              <th key={c} className={`${TH} text-center ${i === 0 ? "text-emerald-800" : ""}`}>{tr(c)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MATRIX.map((row) => (
            <tr key={row.feature}>
              <td className={TD}>{tr(row.feature)}</td>
              {row.vals.map((v, i) => (
                <td
                  key={i}
                  className={`${TD} text-center font-medium ${
                    v === "ЖОҚ" ? "text-red-800" : v === "иә" ? "text-emerald-800"
                      : v === "жоқ" ? "text-neutral-600" : "text-amber-800"
                  }`}
                >
                  {tr(v ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </Table>

      <H2>{tr("7. Уникальділік — шыншыл баға")}</H2>
      <H3>{tr("Не жаңа ЕМЕС")}</H3>
      <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Модельдің")}{" "}<b className="text-neutral-900 print:text-black">{tr("бірде-бір компоненті")}</b> {tr("жаңа емес. Барлығы жарияланған, белгілі әдістер:")}{" "}</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-neutral-700 marker:text-neutral-600 print:text-black">
        <li>{tr("Компартмент моделі (E–L–A) — вектор экологиясында ондаған жылдан бері")}</li>
        <li>{tr("Градус-күн даму жуықтауы — энтомологияның классикалық құралы")}</li>
        <li>{tr("SAR табалдырығымен су картасын жасау — Copernicus EMS-тің операциялық тәсілі")}</li>
        <li>{tr("NDVI-мен мекен бағалау — қашықтан зондтаудың негізгі әдісі")}</li>
        <li>{tr("Термиялық-жауап қисықтары — Mordecai тобының жұмысы")}</li>
        <li>{tr("Тасқын-импульс тұжырымдамасы — Камарг моделінде бар")}</li>
      </ul>

      <H3>{tr("Не жаңа")}</H3>
      <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 print:text-black">
        {tr("Жаңалық —")}{" "}<b className="text-neutral-900 print:text-black">{tr("компоненттерде емес, олардың ЖИНАҚТАЛУЫНДА және ОПЕРАЦИЯЛЫҚ ІСКЕ АСУЫНДА")}</b>:
      </p>
      <ol className="mt-1 list-decimal space-y-1.5 pl-5 text-[14px] leading-relaxed text-neutral-700 marker:text-emerald-800 print:text-black">
        <li>
          <b className="text-neutral-900 print:text-black">{tr("Спутниктен ӨЛШЕНГЕН тасқын импульсі мен гидропериод механистік жұмыртқа банкі теңдеулерінің тікелей драйвері ретінде.")}</b>{" "}
          {tr("Камарг моделі тасқынды есептейді, бірақ спутникпен байланыспаған. MAMOTH спутникті қолданады, бірақ жұмыртқа банкі динамикасы жоқ әрі тұзақпен оқытылады. Екеуін біріктірген жүйе әдебиетте табылмады.")}{" "}</li>
        <li>
          <b className="text-neutral-900 print:text-black">{tr("Қос түрдің фазаға тәуелді салмағы")}</b> {tr("— көктемде тасқын-су Aedes, жаз ортасында WNV-тасымалдаушы Culex — бір архитектурада.")}{" "}</li>
        <li>
          <b className="text-neutral-900 print:text-black">{tr("Тұзақ деректерінсіз операциялық жұмыс.")}</b>{" "}
          {tr("Ең жақын аналог (MAMOTH) тұзақсыз іске қосыла алмайды.")}{" "}</li>
        <li>
          <b className="text-neutral-900 print:text-black">{tr("Солтүстік Каспий атырауына арнайы бейімделу")}</b> {tr("— бұл аймақ үшін жарияланған операциялық маса моделі табылмады.")}{" "}</li>
      </ol>

      <div className="my-4 rounded-lg border-l-2 border-red-400 bg-neutral-50 p-3 text-[13px] leading-relaxed text-neutral-700 print:bg-red-50 print:text-black">
        <b className="text-neutral-900 print:text-black">
          {tr("Бірақ: «үздік» немесе «дәлірек» деген тұжырым ЖАСАЛМАЙДЫ.")}{" "}</b>{" "}
        {tr("Модель валидацияланбаған. Салыстыру кестесіндегі «иә» белгілері")}{" "}<i>{tr("мүмкіндіктің бар-жоғын")}</i> {tr("көрсетеді,")}{" "}<i>{tr("дәлдікті")}</i> {tr("емес. Валидацияланған модельмен (MAMOTH, MoLS) дәлдік бойынша салыстыру үшін алдымен өз тұзақ базамыз болуы керек. Ғылыми жарияланымда бұл модельді «жаңа архитектура ұсынылды» деп сипаттауға болады, «нақтырақ болжайды» деп сипаттауға болмайды.")}{" "}</div>

      <H2>{tr("8. Не жетіспейді және оны шешу жолы")}</H2>
      {GAPS.map((g) => (
        <div key={g.title} className="mt-5">
          <H3>{tr(g.title)}</H3>
          <p className="mt-1 text-[14px] leading-relaxed text-neutral-700 print:text-black">
            <b className="text-neutral-900 print:text-black">{tr("Мәселе:")}</b> {tr(g.problem)}
          </p>
          <p className="mt-1.5 text-[14px] font-medium text-emerald-800 print:text-emerald-800">
            {tr("Шешу жолы:")}
          </p>
          <ul className="mt-0.5 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-neutral-700 marker:text-emerald-800 print:text-black">
            {g.fix.map((f, i) => <li key={i}>{tr(f)}</li>)}
          </ul>
        </div>
      ))}

      <H3>{tr("8.7 Басымдық реті")}</H3>
      <Table>
        <thead><tr><th className={TH}>№</th><th className={TH}>{tr("Жұмыс")}</th><th className={TH}>{tr("Күш")}</th><th className={TH}>{tr("Тәуелділігі")}</th></tr></thead>
        <tbody>
          {PRIORITY.map(([n, w, e, d]) => (
            <tr key={n}>
              <td className={`${TD} font-mono`}>{n}</td>
              <td className={`${TD} ${n === "1" ? "font-semibold text-neutral-900 print:text-black" : ""}`}>{tr(w)}</td>
              <td className={TD}>{tr(e)}</td><td className={TD}>{tr(d)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      <H2>{tr("9. Шектеулер — қысқаша тізім")}</H2>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-amber-800 marker:text-amber-800 print:text-black">
        <li>{tr("Индекс климаттық ҚОЛАЙЛЫЛЫҚТЫ өлшейді, маса САНЫН емес")}</li>
        <li>{tr("Модель валидацияланбаған — тұзақ деректері жоқ")}</li>
        <li>{tr("Жеті параметрдің алтауы түрге калибрленбеген")}</li>
        <li>{tr("Гидропериод — «кемінде N күн» деген төменгі шек, дәл сан емес")}</li>
        <li>{tr("Қамыс мекені — NDVI проксиі, қамыстың картасы емес")}</li>
        <li>{tr("Радар 10–30 м ажыратымдылықпен ұсақ көлшіктер мен арықтарды көрмейді")}</li>
        <li>{tr("Температура қисығы басым түрдің (Culex) жүйесіне калибрленген")}</li>
        <li>{tr("Каспий деңгейінің әсері ескерілмеген")}</li>
        <li>
          {tr("Дереккөз қолжетімсіз болса модель әлсіретілген режимге көшеді — ол әрқашан ашық белгіленеді, жалған санмен толтырылмайды")}{" "}</li>
      </ul>

      <H2>{tr("10. Дереккөздер")}</H2>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-[13px] leading-relaxed text-neutral-600 marker:text-neutral-600 print:text-black">
        {REFS.map((r, i) => (
          <li key={i}>
            {r.url ? (
              <a href={r.url} target="_blank" rel="noopener noreferrer"
                 className="text-sky-800 underline-offset-2 hover:underline print:text-sky-700">
                {tr(r.label)}
              </a>
            ) : tr(r.label)}
          </li>
        ))}
      </ol>

      <footer className="mt-10 border-t border-neutral-300 pt-4 text-[13px] leading-relaxed text-neutral-600 print:border-gray-300 print:text-gray-600">
        <b className="text-neutral-700 print:text-black">Jaiyq</b> {tr("· ecojaiyq.com · Қазақстан мен Каспий жағалауының экологиялық AI мониторинг платформасы")}{" "}<br />
        {tr("Бұл құжат жүйенің ағымдағы техникалық күйін сипаттайды. Модель валидацияланбаған: шығысы тексеру тағайындауға негіз болады, бірақ сот немесе әкімшілік іс үшін дәлел ретінде қолданылмайды.")}{" "}</footer>

      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: #fff !important; }
        }
      `}</style>
    </main>
  );
}
