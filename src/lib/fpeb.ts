// FPEB ЯДРОСЫ — Flood-Pulse Egg-Bank, УАҚЫТ БОЙЫНША ИНТЕГРАЛДАУ.
//
// ═══ НЕ ҮШІН КЕРЕК ═══
// Бұған дейін модель «лездік» болатын: бүгінгі су басу бүгінгі масаға
// айналатын. Бұл биологиялық тұрғыда ҚАТЕ. Шын тізбек:
//
//     су басады → жұмыртқа жарылады → дернәсіл τ(T) күн дамиды → ересек
//
// Яғни ересек маса тасқыннан ~τ(T) КҮН КЕЙІН шығады (25 °C-та ~10 күн).
// Кідіріссіз модель шыңды дұрыс емес күнге қояды әрі ең пайдалы нәрсені
// бере алмайды: «массалық шығу қашан күтіледі».
//
// ═══ ТЕҢДЕУЛЕР (жоба құжатының L2 қабаты) ═══
//
//   dE/dt = f·φ_egg(ай) − h(W)·E        жұмыртқа банкі
//   dL/dt = h(W)·E − L/τ(T) − μ_L·L      дернәсіл
//   dA/dt = (L/τ(T))·s(hydro) − μ_A·A    ересек
//
//   W       — күндік тасқын импульсі (GloFAS × бейімділік)
//   h(W)    — жарылу жылдамдығы: су басқанда банк жарылады
//   τ(T)    — градус-күн бойынша даму ұзақтығы
//   s(hydro)— гидропериод тірі қалу шарты (су жеткілікті ұзақ тұрды ма)
//   μ       — өлім
//
// ═══ КҮЙ ҚАЙДАН АЛЫНАДЫ ═══
// Дерекқор ЖОҚ. Күй әр сұраныста нөлден қайта интегралданады: GloFAS
// күндік қатары (30 күн өткен + 14 күн болжам) драйвер ретінде беріледі.
// Бұл — FWI-мен бірдей тәсіл (ол да «жүгіріспен» есептеледі): нәтиже
// детерминистік әрі қайталанады, күй жылжып кетпейді.
//
// ═══ ⚠️ АДАЛДЫҚ ═══
// Параметрлер (μ_L, μ_A, k_h, DD) — әдебиеттегі кулициндік шамалар.
// Aedes caspius үшін жергілікті калибрлеу ЖОҚ. Сондықтан шығыс —
// САЛЫСТЫРУҒА жарайтын реттік индекс, абсолют тығыздық емес.
// Модель `validated: false` күйінде қалады.

/** Жұмыртқа→ересек даму үшін қажет градус-күн (T_base-тен жоғары) */
export const DEGREE_DAYS = 150;
/** Даму табалдырығы (°C) — кулициндік */
export const T_BASE = 10;
/** Дернәсіл өлімі (тәулігіне) */
export const MU_LARVA = 0.10;
/** Ересек өлімі (тәулігіне) */
export const MU_ADULT = 0.12;
/** Су басқандағы жарылу жылдамдығының коэффициенті */
export const HATCH_K = 0.6;
/** Жұмыртқа банкінің толығу жылдамдығы (тәулігіне, маусымдық шекке дейін) */
export const EGG_REFILL = 0.15;

/** Жұмыртқа банкі дайындығы — Aedes floodwater фенологиясы (мамырда шыңы) */
export const EGG_READY = [0.05, 0.05, 0.12, 0.45, 0.9, 1.0, 0.95, 0.8, 0.5, 0.2, 0.07, 0.05];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Дернәсілдің даму ұзақтығы (тәулік) — градус-күн жуықтауы */
export function tauDays(t: number): number {
  return DEGREE_DAYS / Math.max(1, t - T_BASE);
}

export interface DayDriver {
  date: string;
  /** Тәуліктік орташа температура (°C) */
  temp: number;
  /** Тасқын импульсі 0..1 (GloFAS × бейімділік) */
  flood: number;
  /** Гидропериодтан шыққан тірі қалу шамасы 0..1 */
  survival: number;
}

export interface FpebDay {
  date: string;
  /** Ересек маса индексі 0..1 (теориялық максимумға қатысты) */
  adults: number;
  larvae: number;
  eggs: number;
}

/**
 * Тәуліктік Эйлер интеграциясы (қадам = 1 тәулік).
 *
 * Бастапқы күй: банк сол айдың дайындығына тең, дернәсіл мен ересек нөл.
 * Алғашқы күндер «жүгіріс» (spin-up) болып саналады — олардың нәтижесі
 * бастапқы шарттың әсерінен әлі тұрақсыз.
 */
export function integrateFpeb(drivers: DayDriver[], startMonth: number): FpebDay[] {
  let E = EGG_READY[startMonth];
  let L = 0;
  let A = 0;
  const out: FpebDay[] = [];

  for (const d of drivers) {
    const month = new Date(d.date).getUTCMonth();
    const cap = EGG_READY[month]; // маусымдық банк сыйымдылығы
    const tau = tauDays(d.temp);
    const hatch = HATCH_K * clamp01(d.flood);

    // Температура табалдырықтан төмен болса даму тоқтайды, бірақ банк
    // сақталады (диапаузалы жұмыртқа құрғақ жатып тірі қалады)
    const devOn = d.temp > T_BASE;

    const dE = EGG_REFILL * Math.max(0, cap - E) - (devOn ? hatch * E : 0);
    const emerge = devOn ? L / tau : 0;
    const dL = (devOn ? hatch * E : 0) - emerge - MU_LARVA * L;
    const dA = emerge * clamp01(d.survival) - MU_ADULT * A;

    E = clamp01(E + dE);
    L = Math.max(0, L + dL);
    A = Math.max(0, A + dA);

    out.push({ date: d.date, adults: A, larvae: L, eggs: E });
  }
  return out;
}

/**
 * ТЕОРИЯЛЫҚ МАКСИМУМ — нормалау тұрақтысы.
 *
 * Индексті 0–100 шкаласына келтіру үшін бөлгіш керек. Ол нүктенің өз
 * максимумы БОЛМАУЫ керек: онда әр нүкте 100-ге жетіп, салыстыру
 * мағынасын жоғалтады. Сондықтан идеал жағдайдағы (су толық, температура
 * оптимумда, тірі қалу толық) модельдің өз тұрақты шыңы алынады.
 *
 * Бір рет есептеліп кэштеледі — детерминистік шама.
 */
let refPeak: number | null = null;
export function referencePeak(): number {
  if (refPeak != null) return refPeak;
  const drivers: DayDriver[] = Array.from({ length: 120 }, (_, i) => ({
    // Мамыр — банк толық ашылатын ай
    date: new Date(Date.UTC(2000, 4, 1 + i)).toISOString().slice(0, 10),
    temp: 25.9, // Φ_T шыңы
    flood: 1,
    survival: 1,
  }));
  const sim = integrateFpeb(drivers, 4);
  refPeak = Math.max(1e-6, ...sim.map((d) => d.adults));
  return refPeak;
}

/** Ересек индексін 0..1 шкаласына келтіру */
export function normalizeAdults(a: number): number {
  return clamp01(a / referencePeak());
}

/**
 * Массалық шығу шыңы — болжам терезесіндегі ең жоғары ересек мәні.
 * Бұл — модельдің ЕҢ ПАЙДАЛЫ шығысы: дезинсекция сол күнге жоспарланады.
 */
export function emergencePeak(
  sim: FpebDay[],
  fromDate: string
): { date: string; value: number } | null {
  const future = sim.filter((d) => d.date >= fromDate);
  if (!future.length) return null;
  const best = future.reduce((a, b) => (b.adults > a.adults ? b : a));
  if (best.adults <= 0) return null;
  return { date: best.date, value: +normalizeAdults(best.adults).toFixed(3) };
}
