// ЖИНАҚТАЛУ (СУММАЦИЯ) ӘСЕРІ — ҚР ДСМ-70 бұйрығына 1-қосымшаның 3-кестесі.
//
// Дереккөз: ҚР Денсаулық сақтау министрінің 2025 жылғы 18 ақпандағы № 10
// бұйрығы (тіркеу № 35741) — ҚР ДСМ-70 бұйрығына толықтыру.
//
// ЕРЕЖЕНІҢ МӘНІ:
// Атмосфералық ауада жинақталу әсері бар бірнеше зат бір мезгілде болса,
// олардың шоғырлану қатынастарының ҚОСЫНДЫСЫ 1-ден аспауға тиіс:
//
//     Σ (Cᵢ / ШРКᵢ)  ≤  1
//
//   Cᵢ   — атмосфералық ауадағы i-заттың нақты шоғырлануы
//   ШРКᵢ — сол заттың рұқсат етілген шекті шоғырлануы
//
// БҰЛ НЕГЕ МАҢЫЗДЫ: әр зат ЖЕКЕ-ЖЕКЕ норма шегінде тұруы мүмкін, бірақ
// бірге әсер еткенде норма БҰЗЫЛҒАН болып саналады. Мысалы NO₂ 0.6 ШРК
// және SO₂ 0.6 ШРК — екеуі де шегінде, ал қосындысы 1.2 > 1 → бұзушылық.
// Көп жүйе бұны есептемейді.
//
// ЕРЕКШЕЛІК ЕРЕЖЕСІ (бұйрық мәтінінен):
// Құрамында азот диоксиді және/немесе күкіртсутек бар 2, 3, 4 компоненттік
// қоспаларда, егер бір компоненттің үлес салмағы (максималды бір реттік
// ШРК үлесімен) 2 компонентте 80%-дан, 3 компонентте 70%-дан, 4 компонентте
// 60%-дан асса — жинақталу әсері ЕСЕПКЕ АЛЫНБАЙДЫ.

/** Жүйедегі өлшенетін заттардың индикатор идентификаторлары */
export type SubstanceId =
  | "no2" | "so2" | "co" | "ozone" | "pm25" | "pm10" | "nh3"
  // Төмендегілері жүйеде ӨЛШЕНБЕЙДІ — топ ТОЛЫҚ ЕМЕС екенін дұрыс
  // көрсету үшін тізілімде тұруы ШАРТ. Оларды тізбеу — топты бір заттан
  // тұрады деп есептеп, жалғыз заттың асуын «жинақталу бұзушылығы» деп
  // көрсетуге әкелер еді.
  | "h2s" | "phenol" | "formaldehyde" | "mazut_ash" | "no"
  | "hexane" | "hexene" | "pb_oxide" | "zn_oxide";

export interface Substance {
  id: SubstanceId;
  name: string;
  /** Жүйеде осы заттың нақты өлшемі бар ма */
  measured: boolean;
  measuredNote?: string;
}

export const SUBSTANCES: Record<SubstanceId, Substance> = {
  no2: { id: "no2", name: "Азот диоксиді (NO₂)", measured: true },
  so2: { id: "so2", name: "Күкірт диоксиді (SO₂)", measured: true },
  co: { id: "co", name: "Көміртегі оксиді (CO)", measured: true },
  ozone: { id: "ozone", name: "Озон (O₃)", measured: true },
  pm25: { id: "pm25", name: "PM₂.₅", measured: true },
  pm10: { id: "pm10", name: "PM₁₀", measured: true },
  nh3: { id: "nh3", name: "Аммиак (NH₃)", measured: true },
  h2s: {
    id: "h2s", name: "Күкіртсутек (H₂S)", measured: false,
    measuredNote: "CAMS моделінде жоқ — жер бетіндегі станция қажет",
  },
  phenol: {
    id: "phenol", name: "Фенол", measured: false,
    measuredNote: "Спутник/модель деректерінде жоқ",
  },
  formaldehyde: {
    id: "formaldehyde", name: "Формальдегид", measured: false,
    measuredNote: "CAMS моделінде жоқ",
  },
  mazut_ash: {
    id: "mazut_ash", name: "Мазут күлі", measured: false,
    measuredNote: "Тек жергілікті өлшеммен анықталады",
  },
  no: {
    id: "no", name: "Азот оксиді (NO)", measured: false,
    measuredNote: "CAMS-те NO₂ ғана бар",
  },
  hexane: {
    id: "hexane", name: "Гексан", measured: false,
    measuredNote: "Ұшпа көмірсутек — жергілікті зертханалық өлшем қажет",
  },
  hexene: {
    id: "hexene", name: "Гексен", measured: false,
    measuredNote: "Ұшпа көмірсутек — жергілікті зертханалық өлшем қажет",
  },
  pb_oxide: {
    id: "pb_oxide", name: "Қорғасын оксиді", measured: false,
    measuredNote: "Ауыр металл аэрозолі — сүзгі әдісімен зертханада өлшенеді",
  },
  zn_oxide: {
    id: "zn_oxide", name: "Мырыш оксиді", measured: false,
    measuredNote: "Ауыр металл аэрозолі — сүзгі әдісімен зертханада өлшенеді",
  },
};

export interface SummationGroup {
  /** Бұйрық кестесіндегі реттік нөмірі */
  no: number;
  substances: SubstanceId[];
  /** Аралас әрекет коэффициенті (болса) — кестенің екінші бөлімінде */
  mixCoefficient?: number;
  /** Ерекше режим */
  mode: "full" | "partial" | "independent" | "potentiation";
  modeNote?: string;
}

// Кестедегі топтардың ішінен жүйеде кемінде БІР заты өлшенетіндері.
// Толық кесте 59 топтан тұрады — бәрін тізу пайдасыз, өйткені олардың
// басым бөлігі жүйеде мүлдем өлшенбейді (акрил қышқылы, фурфурол,
// ванадий аэрозольдері т.б. — олар үшін жергілікті зертхана керек).
export const SUMMATION_GROUPS: SummationGroup[] = [
  { no: 1, substances: ["nh3", "h2s"], mode: "full" },
  { no: 2, substances: ["nh3", "h2s", "formaldehyde"], mode: "full" },
  { no: 3, substances: ["nh3", "formaldehyde"], mode: "full" },
  { no: 4, substances: ["no2", "no", "mazut_ash", "so2"], mode: "full" },
  { no: 5, substances: ["no2", "hexane", "co", "formaldehyde"], mode: "full" },
  { no: 6, substances: ["no2", "hexene", "so2"], mode: "full" },
  // ⭐ Ең маңыздысы — екеуі де жүйеде өлшенеді, сондықтан ЖАЛҒЫЗ есептелетін топ
  { no: 7, substances: ["no2", "so2"], mode: "full" },
  { no: 8, substances: ["no2", "so2", "co", "phenol"], mode: "full" },
  { no: 33, substances: ["ozone", "no2", "formaldehyde"], mode: "full" },
  { no: 35, substances: ["pb_oxide", "so2"], mode: "full" },
  { no: 40, substances: ["so2", "phenol"], mode: "full" },
  { no: 44, substances: ["so2", "h2s"], mode: "full" },
  {
    no: 57, substances: ["so2", "zn_oxide"], mode: "independent",
    modeNote: "Бірге болғанда жекелеген заттардың ШРК-сы сақталады — қосынды есептелмейді",
  },
];

/** Ерекшелік ережесі: бір компоненттің үлесі осы шектен асса — жинақталу есепке алынбайды */
export const DOMINANCE_LIMITS: Record<number, number> = {
  2: 0.8, // 2 компонентте 80%
  3: 0.7, // 3 компонентте 70%
  4: 0.6, // 4 компонентте 60%
};

export const SUMMATION_SOURCE = {
  act: "ҚР ДСМ-70 бұйрығына 1-қосымша, 3-кесте",
  amendment: "ҚР ДСМ 2025 ж. 18 ақпандағы № 10 бұйрығымен енгізілген",
  registration: "тіркеу № 35741",
  url: "https://adilet.zan.kz/kaz/docs/V2500035741",
  formula: "Σ (Cᵢ / ШРКᵢ) ≤ 1",
  dominanceRule:
    "Құрамында NO₂ және/немесе H₂S бар 2, 3, 4 компоненттік қоспаларда бір " +
    "компоненттің үлесі 80% / 70% / 60%-дан асса — жинақталу әсері есепке алынбайды.",
};
