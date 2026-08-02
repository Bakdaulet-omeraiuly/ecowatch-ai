// КӨРСЕТКІШТЕР ТІЗІЛІМІ — жүйедегі әр санның паспорты.
//
// Бұл файл — эко-паспорт пен әдістеме бетінің ортақ дереккөзі. Мұнда әр
// көрсеткіш үшін жазылады:
//   · нені өлшейді және қандай бірлікте
//   · ҚАЛАЙ есептеледі (формула + қадамдар)
//   · қай аспап/модель, қандай кеңістік және уақыт ажыратымдылығы
//   · дереккөздің РЕСМИ ҚҰЖАТЫ (сілтеме)
//   · ғылыми негізі (мақала/стандарт)
//   · салыстыруға арналған норма (ДДҰ / ЕО), нормаға сілтемемен
//   · шектеулері және валидация күйі
//
// Ереже: жаңа көрсеткіш қосылса — осында да жазылуы тиіс. Тізілімде жоқ
// сан эко-паспортқа шықпайды.

export type Tier = "measurement" | "model" | "ai";

export interface DocLink {
  label: string;
  url?: string;
  note?: string;
}

export interface Norm {
  label: string;
  value: number;
  comparison: "max" | "min";
  source: DocLink;
}

export interface Indicator {
  id: string;
  section: string;
  name: string;
  unit: string;
  tier: Tier;
  /** Мәнді алатын эндпоинт */
  endpoint: string;
  /** Жауап ішіндегі жол, мыс. "current.pm2_5" */
  path: string;
  /** Ондық белгі саны */
  digits?: number;
  what: string;
  formula?: string;
  steps: string[];
  instrument: string;
  spatial: string;
  temporal: string;
  latency: string;
  sources: DocLink[];
  references: DocLink[];
  norms?: Norm[];
  limits: string[];
  validated: boolean;
  validationNote: string;
}

// --- Жиі қайталанатын құжат сілтемелері -----------------------------------
const DOC = {
  openMeteoAir: {
    label: "Open-Meteo Air Quality API — техникалық құжаттама",
    url: "https://open-meteo.com/en/docs/air-quality-api",
  },
  openMeteoWx: {
    label: "Open-Meteo Weather Forecast API — құжаттама",
    url: "https://open-meteo.com/en/docs",
  },
  openMeteoArchive: {
    label: "Open-Meteo Historical Weather API (ERA5) — құжаттама",
    url: "https://open-meteo.com/en/docs/historical-weather-api",
  },
  openMeteoFlood: {
    label: "Open-Meteo Flood API (GloFAS) — құжаттама",
    url: "https://open-meteo.com/en/docs/flood-api",
  },
  cams: {
    label: "Copernicus Atmosphere Monitoring Service (CAMS)",
    url: "https://atmosphere.copernicus.eu/",
  },
  glofas: {
    label: "Copernicus Emergency Management Service — GloFAS",
    url: "https://global-flood.emergency.copernicus.eu/",
  },
  firms: {
    label: "NASA FIRMS — Fire Information for Resource Management System",
    url: "https://firms.modaps.eosdis.nasa.gov/",
  },
  shStats: {
    label: "Sentinel Hub Statistical API — құжаттама",
    url: "https://docs.sentinel-hub.com/api/latest/api/statistical/",
  },
  cdse: {
    label: "Copernicus Data Space Ecosystem — деректер құжаттамасы",
    url: "https://documentation.dataspace.copernicus.eu/",
  },
  eeaAqi: {
    label: "European Environment Agency — European Air Quality Index",
    url: "https://www.eea.europa.eu/themes/air/air-quality-index",
  },
  who2021: {
    label: "WHO global air quality guidelines (2021)",
    url: "https://www.who.int/publications/i/item/9789240034228",
  },
  fwi: {
    label: "Canadian Forest Fire Weather Index System — CWFIS",
    url: "https://cwfis.cfs.nrcan.gc.ca/background/summary/fwi",
  },
  mordecai: {
    label: "Mordecai et al. 2017, PLoS Negl Trop Dis (термиялық қолайлылық)",
    url: "https://doi.org/10.1371/journal.pntd.0005568",
  },
  mordecai2019: {
    label: "Mordecai et al. 2019, PLoS Negl Trop Dis — температура мен берілу (WNV термиялық шектері)",
    url: "https://doi.org/10.1371/journal.pntd.0006451",
  },
  era5: {
    label: "ECMWF ERA5 реанализі",
    url: "https://www.ecmwf.int/en/forecasts/dataset/ecmwf-reanalysis-v5",
  },
} satisfies Record<string, DocLink>;

// --- Тізілім --------------------------------------------------------------

export const INDICATORS: Indicator[] = [
  // ======================= АУА САПАСЫ =======================
  {
    id: "aqi",
    section: "Ауа сапасы",
    name: "Еуропалық ауа сапасы индексі (EU AQI)",
    unit: "индекс",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.europeanAqi",
    what:
      "Бес ластаушының (PM₂.₅, PM₁₀, NO₂, O₃, SO₂) ішіндегі ең нашарының " +
      "сыныбы бойынша жиынтық баға. Индекс 0-ден жоғары, шамасы неғұрлым " +
      "үлкен болса, ауа соғұрлым нашар.",
    formula: "AQI = max(индекс(PM₂.₅), индекс(PM₁₀), индекс(NO₂), индекс(O₃), индекс(SO₂))",
    steps: [
      "CAMS моделі әр ластаушының концентрациясын есептейді (µg/m³)",
      "Әр концентрация EEA кестесі бойынша қосалқы индекске түрлендіріледі",
      "Ең жоғары қосалқы индекс жалпы AQI болып алынады — «ең әлсіз буын» қағидасы",
    ],
    instrument: "Copernicus CAMS жаһандық атмосфералық химия моделі",
    spatial: "≈40 км тор",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir],
    references: [DOC.eeaAqi],
    limits: [
      "Модель шығысы — жер бетіндегі станция өлшемі емес",
      "40 км тор қала ішіндегі айырманы көрсетпейді",
      "Ең нашар ластаушы бойынша алынғандықтан, қалғандарының үлесі жасырын қалады",
    ],
    validated: false,
    validationNote:
      "Жер бетіндегі Qazhydromet станциясымен салыстыру дашбордта жүргізіледі, " +
      "бірақ жүйелі валидация есебі жасалмаған",
  },
  {
    id: "pm25",
    section: "Ауа сапасы",
    name: "PM₂.₅ — ұсақ дисперсті шаң",
    unit: "µg/m³",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.pm2_5",
    digits: 1,
    what:
      "Диаметрі 2.5 мкм-ден кіші бөлшектер. Өкпенің терең бөлігіне жетіп, " +
      "қанға өте алатындықтан денсаулыққа ең қауіптісі саналады.",
    formula: "C(PM₂.₅) — CAMS модель тордағы жер бетіне жақын қабаттың концентрациясы",
    steps: [
      "CAMS шығарынды кадастрын, метеорологияны және химиялық реакцияларды біріктіріп есептейді",
      "Шөл шаңының тасымалы жеке компонент ретінде қосылады",
      "Нәтиже жер бетіне жақын (≈10 м) қабат үшін беріледі",
    ],
    instrument: "Copernicus CAMS",
    spatial: "≈40 км тор",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir],
    references: [DOC.who2021],
    norms: [
      { label: "ДДҰ 2021 — тәуліктік нұсқаулық", value: 15, comparison: "max", source: DOC.who2021 },
      { label: "ДДҰ 2021 — жылдық нұсқаулық", value: 5, comparison: "max", source: DOC.who2021 },
    ],
    limits: [
      "Модель мәні — станция өлшемі емес",
      "Шаң дауылы кезінде модель нақты шыңды жеткізбеуі мүмкін (Каспий маңы, Батыс ҚР)",
    ],
    validated: false,
    validationNote: "Жергілікті станциямен жүйелі салыстыру жүргізілмеген",
  },
  {
    id: "pm10",
    section: "Ауа сапасы",
    name: "PM₁₀ — ірі дисперсті шаң",
    unit: "µg/m³",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.pm10",
    digits: 1,
    what: "Диаметрі 10 мкм-ден кіші бөлшектер. Жоғарғы тыныс жолдарына әсер етеді.",
    formula: "C(PM₁₀) — CAMS модель концентрациясы",
    steps: [
      "CAMS антропогендік шығарынды мен табиғи шаңды қоса есептейді",
      "Шөл аймақтарында (Атырау, Ақтау) шөл шаңының үлесі маңызды — ол бөлек компонент",
    ],
    instrument: "Copernicus CAMS",
    spatial: "≈40 км тор",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir],
    references: [DOC.who2021],
    norms: [
      { label: "ДДҰ 2021 — тәуліктік нұсқаулық", value: 45, comparison: "max", source: DOC.who2021 },
      { label: "ДДҰ 2021 — жылдық нұсқаулық", value: 15, comparison: "max", source: DOC.who2021 },
    ],
    limits: ["Модель мәні", "Жергілікті шаң көздері (жол, құрылыс) толық ескерілмейді"],
    validated: false,
    validationNote: "Жергілікті станциямен жүйелі салыстыру жүргізілмеген",
  },
  {
    id: "no2",
    section: "Ауа сапасы",
    name: "NO₂ — азот диоксиді",
    unit: "µg/m³",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.no2",
    digits: 1,
    what:
      "Жану процестерінің көрсеткіші — көлік, ЖЭО, мұнай өңдеу. Ірі " +
      "қалаларда көліктің, өнеркәсіп аймақтарында шығарындының негізгі маркері.",
    formula: "C(NO₂) — CAMS модель концентрациясы",
    steps: [
      "CAMS жанудан шығатын NOx шығарындысын есептейді",
      "Атмосферадағы фотохимиялық түрленуі ескеріледі",
    ],
    instrument: "Copernicus CAMS · тәуелсіз тексеру: Sentinel-5P/TROPOMI растры",
    spatial: "≈40 км тор (S5P: ≈5.5×3.5 км)",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir, DOC.cdse],
    references: [DOC.who2021],
    norms: [
      { label: "ДДҰ 2021 — тәуліктік нұсқаулық", value: 25, comparison: "max", source: DOC.who2021 },
      { label: "ДДҰ 2021 — жылдық нұсқаулық", value: 10, comparison: "max", source: DOC.who2021 },
    ],
    limits: [
      "Модель мәні",
      "Нүктелік көзден шыққан шлейф 40 км торда «жағылып» кетеді",
    ],
    validated: false,
    validationNote: "Sentinel-5P растрымен көзбен салыстыруға болады; сандық валидация жоқ",
  },
  {
    id: "so2",
    section: "Ауа сапасы",
    name: "SO₂ — күкірт диоксиді",
    unit: "µg/m³",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.so2",
    digits: 1,
    what:
      "Күкіртті отынның жануы мен мұнай өңдеудің көрсеткіші. Мұнай-газ " +
      "инфрақұрылымы мен көмір ЖЭО-ларына тікелей қатысты.",
    formula: "C(SO₂) — CAMS модель концентрациясы",
    steps: ["CAMS күкірт шығарындысын және оның сульфатқа айналуын есептейді"],
    instrument: "Copernicus CAMS · тәуелсіз тексеру: Sentinel-5P/TROPOMI",
    spatial: "≈40 км тор",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir],
    references: [DOC.who2021],
    norms: [
      { label: "ДДҰ 2021 — тәуліктік нұсқаулық", value: 40, comparison: "max", source: DOC.who2021 },
    ],
    limits: ["Модель мәні", "Факелден шыққан жергілікті шыңдар торда көрінбейді"],
    validated: false,
    validationNote: "Валидация жүргізілмеген",
  },
  {
    id: "ozone",
    section: "Ауа сапасы",
    name: "O₃ — жер бетіндегі озон",
    unit: "µg/m³",
    tier: "model",
    endpoint: "/api/environment",
    path: "current.ozone",
    digits: 1,
    what:
      "Тікелей шығарылмайды — NOx пен ұшпа органикалық қосылыстардан күн " +
      "сәулесі әсерінен түзіледі. Жазда шыңға жетеді.",
    formula: "C(O₃) — CAMS фотохимиялық модель нәтижесі",
    steps: [
      "CAMS NOx, VOC және күн радиациясын кіріс ретінде алады",
      "Фотохимиялық реакциялар тізбегі есептеледі",
    ],
    instrument: "Copernicus CAMS",
    spatial: "≈40 км тор",
    temporal: "сағат сайын",
    latency: "≈1–3 сағат",
    sources: [DOC.cams, DOC.openMeteoAir],
    references: [DOC.who2021],
    norms: [
      { label: "ДДҰ 2021 — 8 сағаттық нұсқаулық", value: 100, comparison: "max", source: DOC.who2021 },
    ],
    limits: ["Модель мәні", "Озон түзілуі жергілікті жағдайға өте сезімтал"],
    validated: false,
    validationNote: "Валидация жүргізілмеген",
  },

  // ======================= СУ РЕЖИМІ =======================
  {
    id: "floodedKm2",
    section: "Су режимі",
    name: "Су басқан аумақ",
    unit: "км²",
    tier: "measurement",
    endpoint: "/api/flood-extent",
    path: "totals.floodedKm2",
    digits: 1,
    what:
      "Бақылау аймақтарында тұрақты су деңгейінен АСЫП жатқан су беті. " +
      "Радар суретіндегі су пиксельдерінің нақты саны бойынша есептеледі.",
    formula:
      "S_басқан = (μ_ағымдағы − медиана(μ_тірек)) × N_жарамды × (120·cos φ)² / 10⁶",
    steps: [
      "Sentinel-1 VV кері шашырауы гамма⁰-ға келтіріледі (орторектификация + рельеф түзетуі)",
      "Әр пиксель децибелге түрлендіріледі: dB = 10·log₁₀(VV)",
      "dB < −16 болса пиксель «су» деп белгіленеді (тегіс су айнадай шағылысып қайтпайды)",
      "Statistical API аймақ бойынша су пиксельдерінің үлесін (μ) және жарамды пиксель санын қайтарады",
      "Тірек кезең (өткен күздің төмен су маусымы) бойынша медиана есептеледі",
      "Айырма алынады — тұрақты су мен құрғақ сор екеуінде де бар, өзара жойылады",
      "Пиксель ауданы ендік бойынша түзетіледі: EPSG:3857 бірлігі φ ендікте cos φ метрді ғана құрайды",
    ],
    instrument: "Sentinel-1 C-SAR (IW режимі, VV поляризация, GAMMA0_TERRAIN)",
    spatial: "120 м есептеу қадамы",
    temporal: "спутник өтуі ≈6 күн; кэш 6 сағат",
    latency: "≈1 тәулік",
    sources: [DOC.cdse, DOC.shStats],
    references: [
      {
        label: "Copernicus EMS Rapid Mapping — SAR табалдырық әдісі",
        url: "https://emergency.copernicus.eu/",
        note: "Табалдырық тәсілі осы операциялық қызметте қолданылады",
      },
    ],
    limits: [
      "Құрғақ сор, тақыр, асфальт та радарда күңгірт — тірек кезеңмен салыстыру олардың басым бөлігін жояды",
      "Жаңбырдан кейінгі ылғал сор «су» болып саналуы мүмкін",
      "Қатты желде су беті бұдырланып, аудан кем бағаланады",
      "Бақылау аймақтары — тікбұрышты терезелер, әкімшілік шекара емес",
    ],
    validated: false,
    validationNote: "Жердегі тасқын есептерімен салыстырылмаған",
  },
  {
    id: "waterTotalKm2",
    section: "Су режимі",
    name: "Жалпы су беті",
    unit: "км²",
    tier: "measurement",
    endpoint: "/api/flood-extent",
    path: "totals.waterKm2",
    digits: 1,
    what: "Бақылау аймақтарындағы барлық су беті — тұрақты су мен тасқынды қоса.",
    formula: "S_су = μ_ағымдағы × N_жарамды × (120·cos φ)² / 10⁶",
    steps: [
      "Жоғарыдағы су маскасы қолданылады",
      "Тірек кезең алынып тасталмайды — жалпы шама",
    ],
    instrument: "Sentinel-1 C-SAR",
    spatial: "120 м",
    temporal: "≈6 күн",
    latency: "≈1 тәулік",
    sources: [DOC.cdse, DOC.shStats],
    references: [],
    limits: ["Су басқан аумақпен бірдей шектеулер"],
    validated: false,
    validationNote: "Жердегі өлшеммен салыстырылмаған",
  },
  {
    id: "riverTrend",
    section: "Су режимі",
    name: "Жайық ағынының өзгерісі (2020 → қазір)",
    unit: "%",
    tier: "model",
    endpoint: "/api/water-trend",
    path: "changePct",
    digits: 1,
    what:
      "Өзеннің жылдық орташа ағынының 2020 жылмен салыстырғандағы өзгерісі. " +
      "Оң мән — ағын артқан, теріс — азайған.",
    formula: "Δ% = (Q̄_соңғы_жыл − Q̄_2020) / Q̄_2020 × 100",
    steps: [
      "GloFAS моделі өзен арнасының тәуліктік ағынын (м³/с) есептейді",
      "Әр жыл үшін орташа алынады",
      "Соңғы жыл 2020 жылмен салыстырылады",
    ],
    instrument: "Copernicus GloFAS (Global Flood Awareness System)",
    spatial: "≈5 км өзен торы",
    temporal: "тәулік сайын",
    latency: "≈1 тәулік",
    sources: [DOC.glofas, DOC.openMeteoFlood],
    references: [],
    limits: [
      "GloFAS — жаһандық модель, жергілікті гидропост өлшемі емес",
      "Су бөгеттері мен реттеу толық ескерілмейді",
      "Ағын өзгерісі тек климатқа емес, су алуға да байланысты",
    ],
    validated: false,
    validationNote: "Жергілікті гидропост деректерімен салыстырылмаған",
  },

  // ======================= ӨРТ ЖӘНЕ ЖЫЛУ =======================
  {
    id: "fwi",
    section: "Өрт қаупі",
    name: "Өрт ауа райы индексі (FWI)",
    unit: "индекс",
    tier: "model",
    endpoint: "/api/fire",
    path: "fwi",
    digits: 1,
    what:
      "Ауа райына негізделген жиынтық өрт қаупі. Өрттің бар-жоғын емес, " +
      "жағдайдың қаншалық қауіпті екенін көрсетеді.",
    formula: "FWI = f(ISI, BUI) — Van Wagner 1987 жүйесі",
    steps: [
      "FFMC — ұсақ отынның ылғалы (температура, ылғал, жел, жауын бойынша)",
      "DMC — орта қабаттың ылғалы",
      "DC — терең қабаттың құрғақтығы (жинақталу баяу)",
      "ISI = f(жел, FFMC) — таралу жылдамдығы",
      "BUI = f(DMC, DC) — жанғыш материал қоры",
      "FWI = f(ISI, BUI) — жиынтық қауіп",
      "Индекстер жинақталатындықтан, есептеу алдын ала бірнеше апталық «жүгіріспен» жүреді",
    ],
    instrument: "ECMWF метеорологиясы бойынша есептелген (Open-Meteo арқылы)",
    spatial: "нүктелік (таңдалған аймақтың орталығы)",
    temporal: "тәулік сайын",
    latency: "≈6 сағат",
    sources: [DOC.openMeteoWx],
    references: [
      DOC.fwi,
      { label: "Van Wagner C.E. 1987, Canadian Forestry Service, Technical Report 35" },
    ],
    limits: [
      "Ауа райына негізделген ҚАУІП көрсеткіші — өрттің бар-жоғы емес",
      "Канада ормандары үшін жасалған; дала мен шөл өсімдігіне толық сәйкес келмейді",
      "Жанғыш материалдың нақты мөлшері ескерілмейді",
    ],
    validated: true,
    validationNote:
      "Әдістеме халықаралық деңгейде валидацияланған (Канада, ЕО EFFIS); " +
      "Қазақстан жағдайына бейімделмеген",
  },
  {
    id: "flares",
    section: "Өрт қаупі",
    name: "Жылу аномалиялары (соңғы 2 тәулік)",
    unit: "нүкте",
    tier: "measurement",
    endpoint: "/api/flares",
    path: "flares.length",
    what:
      "Спутник инфрақызыл арнада тіркеген жылу нүктелері. Мұнай өңдеу " +
      "аймақтарында бұл — газ факелдері, дала аймақтарында — өрттер. " +
      "VIIRS екеуін АЖЫРАТПАЙДЫ.",
    formula: "N — детекция алгоритмі растаған пиксельдер саны",
    steps: [
      "VIIRS 4 мкм және 11 мкм арналарындағы жарықтық температурасын өлшейді",
      "Айналасындағы фонмен салыстырылады (контекстік алгоритм)",
      "Айырма табалдырықтан асса — жылу аномалиясы деп белгіленеді",
      "FRP (жылу сәулелену қуаты) есептеледі",
      "Таңдалған аймақтың шекарасына (bbox) сүзгіленеді",
    ],
    instrument: "VIIRS (Suomi-NPP) — 375 м ажыратымдылық, NRT ағыны",
    spatial: "375 м",
    temporal: "тәулігіне бірнеше өту",
    latency: "≈3 сағат (NRT)",
    sources: [DOC.firms],
    references: [
      {
        label: "NASA FIRMS VIIRS 375 m Active Fire product",
        url: "https://www.earthdata.nasa.gov/data/tools/firms",
      },
    ],
    limits: [
      "Газ факелін дала өртінен АЖЫРАТПАЙДЫ — екеуі де жылу аномалиясы",
      "FRP — жылу қуаты, ластану мөлшері емес",
      "Бұлт детекцияға кедергі келтіреді",
      "Тек спутник өткен сәттегі жағдай",
    ],
    validated: true,
    validationNote: "NASA алгоритмі валидацияланған; біз оны өзгертпейміз, тек аймаққа сүзгілейміз",
  },

  // ======================= ҚҰРҒАҚШЫЛЫҚ =======================
  {
    id: "spi",
    section: "Құрғақшылық",
    name: "Стандартталған жауын индексі (SPI-3)",
    unit: "σ",
    tier: "model",
    endpoint: "/api/drought",
    path: "spi",
    digits: 2,
    what:
      "Соңғы 3 айдағы жауынның көп жылдық нормадан ауытқуы, стандартты " +
      "ауытқу бірлігінде. −1-ден төмен = құрғақшылық, +1-ден жоғары = ылғалды.",
    formula: "SPI = (P₃ᴍ − μ) / σ,  мұндағы μ мен σ — көп жылдық үлестірімнің параметрлері",
    steps: [
      "ERA5 архивінен көп жылдық тәуліктік жауын алынады",
      "Әр жыл үшін дәл сол 3 айлық терезедегі жиынтық жауын есептеледі",
      "Осы жиынтықтардан орташа (μ) мен стандартты ауытқу (σ) табылады",
      "Ағымдағы 3 айлық жауын осы үлестіріммен салыстырылады",
    ],
    instrument: "ECMWF ERA5 реанализі (Open-Meteo архиві арқылы)",
    spatial: "≈25 км тор",
    temporal: "тәулік сайын жаңарады",
    latency: "≈5 тәулік (ERA5 кідірісі)",
    sources: [DOC.openMeteoArchive, DOC.era5],
    references: [
      { label: "McKee T.B., Doesken N.J., Kleist J. 1993 — SPI бастапқы мақаласы" },
      { label: "WMO-No. 1090 — Standardized Precipitation Index User Guide" },
    ],
    norms: [
      { label: "Құрғақшылық шегі (SPI)", value: -1, comparison: "min", source: { label: "WMO-No. 1090" } },
    ],
    limits: [
      "Тек жауынға негізделген — температура мен буланудың әсері ескерілмейді",
      "Бақылау кезеңі неғұрлым ұзақ болса, индекс соғұрлым сенімді",
      "Шөл аймақта жауын аз болғандықтан үлестірім қисық болады",
    ],
    validated: true,
    validationNote: "Дүниежүзілік метеорологиялық ұйым ұсынған стандартты әдіс",
  },

  // ======================= БИОҚАУІП =======================
  {
    id: "mri",
    section: "Биологиялық қауіп",
    name: "Маса тәуекел индексі (JAIYQ-MRI)",
    unit: "0–100",
    tier: "model",
    endpoint: "/api/mosquitogrid",
    path: "avgIndex",
    digits: 0,
    what:
      "Масаның көбеюіне климаттық жағдайдың қаншалық қолайлы екенін көрсететін " +
      "индекс. Маса САНЫ емес — қолайлылық дәрежесі.",
    formula: "MRI = 100 · Φ_T · (0.15 + 0.85·species) · (1 + 0.4·urban + 0.5·flood)",
    steps: [
      "Φ_T — температура гейті: Mordecai т.б. 2019 (PLoS NTD) Батыс Нил вирусы жүйесі үшін жариялаған термиялық шектер T₀ = 16.8 °C, Tm = 34.9 °C. Квадрат түрде шыңы 25.9 °C — мақаладағы ~25 °C оптимумына сәйкес. ⚠️ Мақаладағы Brière фиті емес, симметриялы жуықтау",
      "flood = БЕЙІМДІЛІК × ИМПУЛЬС. Бейімділік — Жайық жайылмасына/атырауға жақындық (география, тұрақты)",
      "ИМПУЛЬС — өлшенген тасқын: 🛰 Sentinel-1 SAR (тірек кезеңмен салыстырғандағы артық су ауданы) + 📊 GloFAS өзен ағыны. Модельдің ажыратқышы: су басу жұмыртқа банкін жарады",
      "Спутник өтуі болмаған терезеде импульс НӨЛ деп алынбайды — GloFAS-қа шегінеді (өлшемнің жоқтығы судың жоқтығы емес)",
      "ГИДРОПЕРИОД: су тірек деңгейінен жоғары болып қанша күн тұрғанын Sentinel-1 өтулері бойынша санаймыз. Дернәсіл ересекке жету үшін су ≥ τ(T) күн тұруы керек; τ(T) = 150 градус-күн / (T − 10 °C) — 25 °C-та ~10 күн",
      "Aedes тармағы: айлық жұмыртқа банкі дайындығы × жарылу (импульс+ылғал+жауын) × гидропериод",
      "Culex тармағы: ҚАМЫС МЕКЕНІ (🛰 Sentinel-2 NDVI > 0.4 — тығыз өсімдік үлесі) басты предиктор, оған тұрақты су мен қала дренажы қосылады, ылғалдылыққа көбейтіледі. Қамыс өлшенбесе — бұрынғы су+қала проксиі",
      "Айлық динамикалық салмақ: көктемде Aedes (тасқын), жаз ортасында Culex (WNV)",
    ],
    instrument:
      "Жеке модель. Кірістер: Open-Meteo (ECMWF) метеорологиясы + Copernicus Sentinel-1 SAR (су, гидропериод) + Sentinel-2 NDVI (қамыс мекені) + GloFAS (өзен ағыны)",
    spatial: "90 нүкте (облыстық 5×5 тор + Атырау қаласының 65 нүктелік тізілімі)",
    temporal: "сағат сайын (тасқын импульсі — SAR қайталау кезеңі ~6 күн)",
    latency: "≈1 сағат (метео), ≈1–6 тәулік (SAR)",
    sources: [DOC.openMeteoWx, DOC.openMeteoFlood],
    references: [DOC.mordecai, DOC.mordecai2019],
    limits: [
      "Климаттық ҚОЛАЙЛЫЛЫҚ индексі — маса санының өлшемі ЕМЕС",
      "Салыстыру үшін жарайды (қай жер қауіптірек), абсолют сан ретінде емес",
      "Түрлердің үлесі әдебиетке негізделген, жергілікті есепке емес",
      "Тасқын импульсі қолжетімсіз болса, модель тек бейімділікпен есептейді — ол жауапта ашық белгіленеді",
      "Гидропериод — S1 қайталауы ~6 күн болғандықтан «КЕМІНДЕ N күн» деген төменгі шек, дәл сан емес",
      "Радар ұсақ көлшіктер мен арықтарды көрмейді (10–30 м), сондықтан топырақ ылғалы төменгі шек ретінде қалады",
      "τ(T) градус-күн параметрі әдебиеттегі кулициндік шамалардан — Aedes caspius үшін жергілікті калибрленбеген",
      "Қамыс мекені — NDVI проксиі, қамыстың картасы емес: суармалы егіс пен ағаш екпелері де тығыз өсімдік береді",
      "Температура қисығы БАСЫМ түрдің (Culex modestus, аулауда 56%) жүйесіне калибрленген. Aedes caspius суыққа төзімдірек — 16.8 °C-тан төмен де белсенді бола алады, бірақ ол үшін жарияланған термиялық фит табылмады",
    ],
    validated: false,
    validationNote:
      "Тұзақ (trap) деректері ешбір аймақта жинақталмағандықтан валидациялау мүмкін емес",
  },

  // ======================= КЛИМАТ =======================
  {
    id: "tempDelta",
    section: "Климат",
    name: "Температураның болжамды өсуі",
    unit: "°C",
    tier: "model",
    endpoint: "/api/climate",
    path: "tempDelta",
    digits: 1,
    what:
      "Климаттық модельдер бойынша болашақ кезеңдегі орташа температураның " +
      "тірек кезеңмен салыстырғандағы айырмасы.",
    formula: "ΔT = T̄_болашақ_кезең − T̄_тірек_кезең",
    steps: [
      "CMIP6 климаттық модель шығысы алынады",
      "Тірек кезең мен болашақ кезеңнің орташасы есептеледі",
      "Айырма алынады",
    ],
    instrument: "CMIP6 климаттық модельдері (Open-Meteo Climate API арқылы)",
    spatial: "модель торы (ондаған км)",
    temporal: "жылдық/онжылдық",
    latency: "—",
    sources: [
      { label: "Open-Meteo Climate API — құжаттама", url: "https://open-meteo.com/en/docs/climate-api" },
    ],
    references: [
      { label: "CMIP6 — Coupled Model Intercomparison Project Phase 6", url: "https://wcrp-cmip.org/" },
    ],
    limits: [
      "Климаттық модель — БОЛЖАМ, өлшем емес",
      "Сценарийге тәуелді: шығарынды жолы өзгерсе нәтиже де өзгереді",
      "Жергілікті масштабқа дейін нақтыланбаған",
    ],
    validated: false,
    validationNote: "Модельдер IPCC аясында бағаланған; жергілікті бейімдеу жасалмаған",
  },
];

export const SECTIONS = [
  "Ауа сапасы",
  "Су режимі",
  "Өрт қаупі",
  "Құрғақшылық",
  "Биологиялық қауіп",
  "Климат",
] as const;

/** Жауап нысанынан "a.b.c" жолы бойынша мән алу. `.length` да қолдау табады. */
export function resolvePath(obj: unknown, path: string): number | null {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (cur == null) return null;
    if (key === "length" && Array.isArray(cur)) return cur.length;
    if (typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : null;
}

/** Паспорт үшін керекті бірегей эндпоинттер тізімі. */
export function requiredEndpoints(): string[] {
  return [...new Set(INDICATORS.map((i) => i.endpoint))];
}
