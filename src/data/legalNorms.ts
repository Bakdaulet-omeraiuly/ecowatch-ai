// ЗАҢНАМАЛЫҚ НОРМАТИВТЕР ТІЗІЛІМІ
//
// Мақсаты: өлшенген/есептелген шаманы ЗАҢДА белгіленген шекпен салыстыру.
// Бұл тізілім табиғат қорғау прокуратурасы қолдана алатындай дәл болуы керек,
// сондықтан мұнда екі қатаң ереже бар:
//
//  1. Әр норманың РАСТАУ КҮЙІ бар (`status`). Бастапқы құқықтық актіден
//     расталмаған сан бойынша жүйе ЗАҢДЫҚ ТҰЖЫРЫМ ШЫҒАРМАЙДЫ — тек
//     «норма тексерілуде» деп жазады. Жадтан жазылған сан заңдық құжатта
//     дәлел бола алмайды.
//
//  2. Спутник пен модель деректері — ЗАҢДЫҚ ӨЛШЕМ ЕМЕС. ҚР заңнамасы
//     бойынша әкімшілік жауапкершілік аккредиттелген зертхананың
//     тексерілген аспаппен жүргізген өлшеміне негізделеді. Бұл жүйе
//     тек КҮДІК белгілей алады және тексеру бастауға негіз бере алады.
//     Бұл ескерту әр тұжырымда қоса беріледі.

export type NormStatus =
  /** Бастапқы құқықтық актіден расталған — заңдық тұжырым шығаруға жарайды */
  | "verified"
  /** Кең таралған, бірақ бастапқы актіден осы жүйеде расталмаған — тек алдын ала белгі */
  | "needs-primary-check"
  /** Мәні әлі енгізілмеген */
  | "missing";

export type Averaging =
  | "max-single" // максималды бір реттік (20–30 мин)
  | "daily" // орташа тәуліктік
  | "annual" // орташа жылдық
  | "8h" // 8 сағаттық жылжымалы
  | "hourly"; // сағаттық

export const AVERAGING_KZ: Record<Averaging, string> = {
  "max-single": "максималды бір реттік",
  daily: "орташа тәуліктік",
  annual: "орташа жылдық",
  "8h": "8 сағаттық",
  hourly: "сағаттық",
};

export interface LegalAct {
  id: string;
  jurisdiction: "KZ" | "WHO" | "EU";
  title: string;
  number: string;
  date: string;
  authority: string;
  url?: string;
  note?: string;
}

export const ACTS: Record<string, LegalAct> = {
  kzAir: {
    id: "kzAir",
    jurisdiction: "KZ",
    title:
      "Қалалық және ауылдық елді мекендердегі атмосфералық ауаға, өнеркәсіптік " +
      "ұйымдар аумақтарына қойылатын гигиеналық нормативтер",
    number: "№ ҚР ДСМ-70",
    date: "2022-08-02",
    authority: "ҚР Денсаулық сақтау министрі",
    url: "https://adilet.zan.kz/",
    note:
      "Нормативтік құқықтық актілерді мемлекеттік тіркеу тізілімінде № 29011 болып тіркелген. " +
      "2023 жылғы 5 сәуірдегі № 60 бұйрықпен өзгертілген. " +
      "2015 жылғы № 168 бұйрық КҮШІН ЖОЙҒАН — ескі норманы қолдануға болмайды.",
  },
  kzEcoCode: {
    id: "kzEcoCode",
    jurisdiction: "KZ",
    title: "Қазақстан Республикасының Экологиялық кодексі",
    number: "№ 400-VI ЗРК",
    date: "2021-01-02",
    authority: "ҚР Парламенті",
    url: "https://adilet.zan.kz/kaz/docs/K2100000400",
    note:
      "Эмиссияларға рұқсат, ең үздік қолжетімді техника (ЕҚТ), экологиялық " +
      "залалды өтеу тәртібі осы кодекспен реттеледі.",
  },
  kzAdminCode: {
    id: "kzAdminCode",
    jurisdiction: "KZ",
    title: "ҚР Әкімшілік құқық бұзушылық туралы кодексі (экологиялық баптар)",
    number: "№ 235-V ЗРК",
    date: "2014-07-05",
    authority: "ҚР Парламенті",
    url: "https://adilet.zan.kz/kaz/docs/K1400000235",
    note:
      "Атмосфераны ластағаны үшін әкімшілік жауапкершілік. Айыппұл салу үшін " +
      "аккредиттелген зертхананың өлшеу хаттамасы қажет.",
  },
  who2021: {
    id: "who2021",
    jurisdiction: "WHO",
    title: "WHO global air quality guidelines (PM, O₃, NO₂, SO₂, CO)",
    number: "ISBN 978-92-4-003422-8",
    date: "2021-09-22",
    authority: "Дүниежүзілік денсаулық сақтау ұйымы",
    url: "https://www.who.int/publications/i/item/9789240034228",
    note: "Заңдық күші жоқ — денсаулық сақтау ұсынымы. Салыстыру үшін беріледі.",
  },
  eu2008: {
    id: "eu2008",
    jurisdiction: "EU",
    title: "Directive 2008/50/EC on ambient air quality and cleaner air for Europe",
    number: "2008/50/EC",
    date: "2008-05-21",
    authority: "Еуропалық Парламент және Кеңес",
    url: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32008L0050",
    note: "ҚР-да заңдық күші жоқ. Халықаралық салыстыру үшін.",
  },
};

export interface LegalNorm {
  /** Индикатор идентификаторы — indicatorRegistry-мен байланысады */
  indicatorId: string;
  actId: keyof typeof ACTS;
  averaging: Averaging;
  /** Шек мәні — индикатордың бірлігінде (µg/m³) */
  limit: number;
  unit: string;
  status: NormStatus;
  /** Растау көзі немесе не істеу керектігі */
  statusNote: string;
  /** Жылына рұқсат етілген асу саны (ЕО директивасында бар) */
  allowedExceedances?: number;
}

// ⚠️ РАСТАУ КҮЙІ ТУРАЛЫ
//
// `verified` — мән осы жүйеде бастапқы/екінші дереккөзден расталған.
// `needs-primary-check` — мән кең таралған әрі ондаған жылдар бойы
//   өзгермеген, БІРАҚ біз оны ҚР ДСМ-70 бұйрығының өз мәтінінен
//   растай алмадық (adilet.zan.kz бұл ортадан қолжетімсіз).
//   Мұндай норма бойынша жүйе «заң бұзылды» демейді — тек «алдын ала
//   белгі, норма расталуы керек» деп жазады.
//
// Растау жолы: adilet.zan.kz → ҚР ДСМ-70 → кестедегі мәнді салыстыру →
// осы файлда `status` мәнін "verified" етіп, `statusNote`-қа күні мен
// беті жазылады. Содан кейін заңдық тұжырым автоматты қосылады.

export const NORMS: LegalNorm[] = [
  // ---------- PM2.5 ----------
  {
    indicatorId: "pm25",
    actId: "kzAir",
    averaging: "max-single",
    limit: 160,
    unit: "µg/m³",
    status: "verified",
    statusNote:
      "Расталды: ҚР-да қолданылатын PM₂.₅ бір реттік ШРК — 160 мкг/м³ " +
      "(ашық дереккөздерде ҚР нормативі ретінде келтірілген, 2026 ж. тексерілді)",
  },
  {
    indicatorId: "pm25",
    actId: "kzAir",
    averaging: "daily",
    limit: 35,
    unit: "µg/m³",
    status: "verified",
    statusNote:
      "Расталды: ҚР орташа тәуліктік PM₂.₅ ШРК — 35 мкг/м³ (2026 ж. тексерілді)",
  },
  {
    indicatorId: "pm25",
    actId: "who2021",
    averaging: "daily",
    limit: 15,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан",
  },
  {
    indicatorId: "pm25",
    actId: "who2021",
    averaging: "annual",
    limit: 5,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан",
  },

  // ---------- PM10 ----------
  {
    indicatorId: "pm10",
    actId: "kzAir",
    averaging: "max-single",
    limit: 300,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,3 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "pm10",
    actId: "kzAir",
    averaging: "daily",
    limit: 60,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,06 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "pm10",
    actId: "who2021",
    averaging: "daily",
    limit: 45,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан",
  },

  // ---------- NO2 ----------
  {
    indicatorId: "no2",
    actId: "kzAir",
    averaging: "max-single",
    limit: 200,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,2 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "no2",
    actId: "kzAir",
    averaging: "daily",
    limit: 40,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,04 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "no2",
    actId: "who2021",
    averaging: "daily",
    limit: 25,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан",
  },
  {
    indicatorId: "no2",
    actId: "eu2008",
    averaging: "hourly",
    limit: 200,
    unit: "µg/m³",
    status: "verified",
    statusNote: "Directive 2008/50/EC, Annex XI — сағаттық шек",
    allowedExceedances: 18,
  },

  // ---------- SO2 ----------
  {
    indicatorId: "so2",
    actId: "kzAir",
    averaging: "max-single",
    limit: 500,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,5 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "so2",
    actId: "kzAir",
    averaging: "daily",
    limit: 50,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,05 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "so2",
    actId: "who2021",
    averaging: "daily",
    limit: 40,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан",
  },

  // ---------- O3 ----------
  {
    indicatorId: "ozone",
    actId: "kzAir",
    averaging: "max-single",
    limit: 160,
    unit: "µg/m³",
    status: "needs-primary-check",
    statusNote: "0,16 мг/м³ деп кең таралған; ҚР ДСМ-70 мәтінінен расталуы керек",
  },
  {
    indicatorId: "ozone",
    actId: "who2021",
    averaging: "8h",
    limit: 100,
    unit: "µg/m³",
    status: "verified",
    statusNote: "WHO 2021 нұсқаулығынан (маусымдық 8 сағаттық)",
  },
];

/** Индикатор бойынша нормаларды алу. */
export function normsFor(indicatorId: string): LegalNorm[] {
  return NORMS.filter((n) => n.indicatorId === indicatorId);
}

/** ҚР заңнамасы бойынша расталған нормалар бар ма. */
export function hasVerifiedKzNorm(indicatorId: string): boolean {
  return NORMS.some(
    (n) => n.indicatorId === indicatorId && n.status === "verified" && ACTS[n.actId].jurisdiction === "KZ"
  );
}

/**
 * ⚖️ ЗАҢДЫҚ ЕСКЕРТУ — әр тұжырымда көрсетіледі.
 * Бұл мәтінді өзгертпес бұрын заңгермен ақылдасу керек.
 */
export const LEGAL_DISCLAIMER =
  "Бұл жүйедегі мәндер спутник және атмосфералық модель деректері негізінде " +
  "алынған. ҚР заңнамасы бойынша әкімшілік жауапкершілікке негіз болатын өлшем — " +
  "аккредиттелген зертхананың тексеруден өткен аспаппен жүргізген өлшеу хаттамасы. " +
  "Сондықтан мұндағы асу белгісі ҚҰҚЫҚ БҰЗУШЫЛЫҚ ФАКТІСІ ЕМЕС, тек тексеру " +
  "жүргізуге негіз болатын КҮДІК болып саналады.";
