// АЙМАҚТАР ТІЗІЛІМІ — жүйенің бүкіл географиясы осы файлдан оқылады.
//
// Барлық координата — ашық, тексерілетін дереккөздерден (қала орталығы).
// Ойдан аймақ жасалмаған.
//
// ⚠️ ЗАҢ ҚОЛДАНЫЛУЫ ТУРАЛЫ ЕҢ МАҢЫЗДЫ ЕРЕЖЕ:
// ҚР гигиеналық нормативтері (ҚР ДСМ-70) ТЕК ҚАЗАҚСТАН аумағында
// қолданылады. ҚР-дан тыс аймақ қосылса, ҚР ШРК-мен салыстыру ЗАҢСЫЗ әрі
// мағынасыз болар еді — ол елдердің өз нормативтері бізде жоқ. Сондықтан
// ондай аймақтарда тек WHO нұсқаулықтарымен салыстыру жүреді (олардың
// заңдық күші жоқ, бірақ жаһандық денсаулық эталоны).
//
// 2026-11: жүйе тек Атырау мен Каспий теңізіне шектелді — басқа қалалар
// алынып тасталды.

export type CountryCode = "KZ" | "AZ" | "RU" | "TM" | "IR";

/**
 * ЖҮЙЕ МОДУЛЬДЕРІ — қай аймақта қайсысы жұмыс істейді.
 *
 * Бір бөлігі ЖАҺАНДЫҚ дереккөзге сүйенеді (CAMS, ERA5, VIIRS) — олар
 * кез келген нүктеде жұмыс істейді. Екінші бөлігі АТЫРАУҒА арнайы
 * жасалған тізілімдерге сүйенеді (зауыттар, тасқын аймақтары, өзен
 * нүктелері, оқытылған модель) — олар басқа қалада МАҒЫНАСЫЗ болар еді.
 *
 * ⚠️ Ең маңыздысы: қолжетімсіз модуль басқа қаланың деректерін
 * КӨРСЕТПЕУІ керек. Атыраудың тасқын аймағын басқа аймақта көрсету —
 * жалған дерек. Сондықтан «бұл аймақта әлі жоқ» деп ашық жазылады.
 */
export type ModuleKey =
  | "greenery"       // Атыраудың қалалық терезесі және NDVI торы
  | "air"            // CAMS — жаһандық
  | "weather"        // ECMWF — жаһандық
  | "fire"           // FWI, метеорологиядан есептеледі — жаһандық
  | "drought"        // SPI, ERA5 архиві — жаһандық
  | "wind"           // ECMWF — жаһандық
  | "soil"           // ECMWF топырақ моделі — жаһандық
  | "mosquito"       // JAIYQ-MRI — Атыраудың тізіліміне сүйенеді, ТІЗІЛІМ керек
  | "flares"         // VIIRS — жаһандық
  | "climate"        // CMIP6 — жаһандық
  | "riverFlow"      // GloFAS өзен нүктелері — ТІЗІЛІМ керек
  | "floodExtent"    // Sentinel-1 бақылау аймақтары — ТІЗІЛІМ керек
  | "pollutionSource"// зауыттар тізілімі — ТІЗІЛІМ керек
  | "mlForecast"     // JAIYQ-ML — сол аймақта оқытылуы керек
  | "objects";       // объект карталары — зауыттар тізілімі керек

/** Барлық аймақта бар модульдер — жаһандық дереккөзге сүйенеді */
export const GLOBAL_MODULES: ModuleKey[] = [
  "air", "weather", "fire", "drought", "wind", "soil", "flares", "climate",
];

/** Аймаққа арнайы тізілім қажет ететін модульдер */
export const REGISTRY_MODULES: ModuleKey[] = [
  "greenery",
  "mosquito", "riverFlow", "floodExtent", "pollutionSource", "mlForecast", "objects",
];

export const MODULE_KZ: Record<ModuleKey, string> = {
  greenery: "Көгалдандыру",
  air: "Ауа сапасы",
  weather: "Ауа райы",
  fire: "Өрт қаупі",
  drought: "Құрғақшылық",
  wind: "Жел",
  soil: "Топырақ",
  mosquito: "Маса индексі",
  flares: "Жылу аномалиялары",
  climate: "Климат болжамы",
  riverFlow: "Өзен ағыны",
  floodExtent: "Су басқан аумақ (радар)",
  pollutionSource: "Ластану көзі",
  mlForecast: "JAIYQ-ML болжамы",
  objects: "Объект карталары",
};

/** Модуль неге жоқ екенін түсіндіру — UI-де сол жазылады */
export const MODULE_REASON: Record<ModuleKey, string> = {
  greenery: "Қалалық бақылау терезесі мен NDVI торы тек Атырау үшін анықталған.",
  air: "", weather: "", fire: "", drought: "", wind: "", soil: "",
  flares: "", climate: "",
  mosquito:
    "JAIYQ-MRI Атыраудың 65 нүктелік қала тізіліміне, Жайық жайылмасының " +
    "сызығына және елді мекен салмақтарына сүйеніп есептеледі. Ол тізілімсіз " +
    "шыққан сан JAIYQ-MRI емес — тек жалпы климаттық жуықтау болар еді.",
  riverFlow:
    "Өзен ағыны GloFAS-тың нақты арна нүктелерінен алынады. Бұл аймақ үшін " +
    "өзен нүктелерінің тізілімі әлі жасалмаған — жуықтап алу жалған сан берер еді.",
  floodExtent:
    "Су басқан аумақ Sentinel-1 радарымен белгіленген бақылау терезелерінде " +
    "өлшенеді әрі тірек кезеңмен салыстырылады. Бұл аймақ үшін терезелер мен " +
    "тірек кезең анықталмаған.",
  pollutionSource:
    "Ластану көзін анықтау кәсіпорындардың тексерілген координаттарына сүйенеді. " +
    "Бұл аймақтың кәсіпорын тізілімі әлі жиналмаған.",
  mlForecast:
    "JAIYQ-ML моделі нақты аймақтың CAMS/ERA5 деректерінде оқытылады. Бұл аймақ " +
    "үшін модель әлі оқытылмаған — басқа қаланың моделін қолдану дұрыс болмас еді.",
  objects:
    "Объект карталары кәсіпорын тізіліміне сүйенеді. Бұл аймақ үшін тізілім жоқ.",
};

export interface Region {
  id: string;
  name: string;
  /** Ағылшынша/орысша нұсқалары — іздеу үшін */
  aliases: string[];
  country: CountryCode;
  countryName: string;
  lat: number;
  lng: number;
  zoom: number;
  /** Каспий жағалауындағы ма — Каспий бетінде фильтрлеу үшін */
  caspian: boolean;
  /** Қысқа сипаттама — экологиялық контекст */
  context: string;
  /** Осы аймақтағы негізгі экологиялық қысым */
  pressure: string;
  /** Тор шекарасы: [батыс, оңтүстік, шығыс, солтүстік] */
  bbox: [number, number, number, number];
  /** Жүйедегі толық қолдау деңгейі */
  coverage: "full" | "air-only";
  coverageNote?: string;
  /** Осы аймақта ҚОСЫМША жұмыс істейтін модульдер (жаһандықтардан бөлек) */
  extraModules?: ModuleKey[];
}

export const REGIONS: Region[] = [
  // ─────────────── ҚАЗАҚСТАН ───────────────
  {
    id: "atyrau",
    name: "Атырау",
    aliases: ["Atyrau", "Гурьев"],
    country: "KZ",
    countryName: "Қазақстан",
    lat: 47.1167, lng: 51.8833, zoom: 10,
    caspian: true,
    context: "Каспий солтүстігі, Жайық сағасы, мұнай өңдеу мен өндіру орталығы",
    pressure: "Мұнай өңдеу, газ факелдері, көктемгі тасқын, маса",
    bbox: [49.0, 46.0, 54.5, 49.0],
    coverage: "full",
    // Тек Атырауда: зауыттар тізілімі, тасқын аймақтары, Жайық нүктелері,
    // оқытылған JAIYQ-ML моделі
    extraModules: [
      "greenery",
      "mosquito", "riverFlow", "floodExtent", "pollutionSource", "mlForecast", "objects",
    ],
  },
];

export const DEFAULT_REGION_ID = "atyrau";

export const REGION_BY_ID = new Map(REGIONS.map((r) => [r.id, r]));

export function getRegion(id?: string | null): Region {
  return (id && REGION_BY_ID.get(id)) || REGION_BY_ID.get(DEFAULT_REGION_ID)!;
}

/** Осы аймақта модуль жұмыс істей ме */
export function hasModule(region: Region, m: ModuleKey): boolean {
  return GLOBAL_MODULES.includes(m) || (region.extraModules ?? []).includes(m);
}

/** Аймақта жоқ модульдер тізімі — UI-де «жоқ» деп көрсету үшін */
export function missingModules(region: Region): ModuleKey[] {
  return REGISTRY_MODULES.filter((m) => !hasModule(region, m));
}

/** Модуль жоқ болса — стандартты жауап денесі */
export function moduleUnavailable(region: Region, m: ModuleKey) {
  return {
    available: false as const,
    module: m,
    moduleName: MODULE_KZ[m],
    region: { id: region.id, name: region.name },
    error: `«${MODULE_KZ[m]}» бұл аймақ үшін әлі қолжетімсіз`,
    reason: MODULE_REASON[m],
    note:
      "Басқа қаланың деректері көрсетілмейді — ол жалған дерек болар еді. " +
      "Тізілім толықтырылған соң модуль автоматты қосылады.",
  };
}

export const COUNTRY_KZ: Record<CountryCode, string> = {
  KZ: "Қазақстан",
  AZ: "Әзербайжан",
  RU: "Ресей",
  TM: "Түрікменстан",
  IR: "Иран",
};

export const COUNTRY_FLAG: Record<CountryCode, string> = {
  KZ: "🇰🇿", AZ: "🇦🇿", RU: "🇷🇺", TM: "🇹🇲", IR: "🇮🇷",
};

/** Каспий теңізі туралы ортақ контекст — форум бетінде қолданылады */
export const CASPIAN_FACTS = {
  littoralStates: 5,
  note:
    "Каспий — бес мемлекеттің ортақ жабық су айдыны. Ауа мен су ластануы " +
    "мемлекеттік шекараны танымайды.",
  legalNote:
    "Каспий теңізінің құқықтық мәртебесі туралы конвенция (Ақтау, 2018) " +
    "жағалау мемлекеттерінің экологиялық ынтымақтастығын көздейді. " +
    "Теһран конвенциясы (2003) — Каспий теңіз ортасын қорғау жөніндегі " +
    "негізгі құжат.",
};
