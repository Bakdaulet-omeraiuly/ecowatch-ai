// АТМОСФЕРАЛЫҚ ДИСПЕРСИЯ — Pasquill–Gifford орнықтылық класы мен
// Briggs дисперсия коэффициенттері.
//
// ═══ НЕГЕ КЕРЕК ═══
// Бұған дейін шлейф конусының ені ТЕК ЖЕЛ ЖЫЛДАМДЫҒЫНАН есептелетін
// (жарты бұрыш 14–30°). Ол физикалық негізсіз еді: 10 км қашықтықта
// нақты бүйірлік жайылу σy ≈ 500–1000 м, яғни жарты бұрыш ~3–6°.
// Конус шындықтан 3–5 есе кең болатын.
//
// Ең үлкен олқылық — АТМОСФЕРАЛЫҚ ОРНЫҚТЫЛЫҚ мүлдем ескерілмейтін.
// Ал ол шешуші: бірдей жел кезінде
//   · түнгі орнықты қабатта (F класы) шлейф ЖІҢІШКЕ әрі АЛЫСҚА кетеді
//   · күндізгі орнықсыз қабатта (A класы) КЕҢ әрі ТЕЗ сұйылады
// Айырма үш еседен асады.
//
// ═══ ӘДІСІ (жаңа модель емес, стандарт) ═══
// Pasquill (1961) орнықтылық класы — жел жылдамдығы + күн радиациясы
// (күндіз) немесе бұлттылық (түнде) бойынша. Briggs (1973) ашық дала
// коэффициенттері σy(x), σz(x). Екеуі де реттеуші органдардың
// (US EPA, ЕО) нұсқаулықтарында қолданылатын классикалық тәсіл.
//
// ⚠️ ШЕКТЕУЛЕРІ АШЫҚ:
//   · Құбыр биіктігі мен шлейфтің көтерілуі (plume rise) ЕСКЕРІЛМЕЙДІ —
//     кәсіпорындардың құбыр параметрлері бізде жоқ
//   · Шығарынды қарқыны (г/с) БЕЛГІСІЗ — сондықтан концентрация
//     САЛЫСТЫРМАЛЫ, µg/m³ емес
//   · Жер бедері мен ғимараттар ескерілмейді (ашық дала жуықтауы)
// Сондықтан нәтиже — ықтимал таралу аймағы, өлшенген өріс емес.

export type PasquillClass = "A" | "B" | "C" | "D" | "E" | "F";

export const PASQUILL_KZ: Record<PasquillClass, string> = {
  A: "Қатты орнықсыз",
  B: "Орнықсыз",
  C: "Аздап орнықсыз",
  D: "Бейтарап",
  E: "Аздап орнықты",
  F: "Орнықты",
};

export const PASQUILL_NOTE: Record<PasquillClass, string> = {
  A: "Күндізгі қатты қызу — шлейф тез көтеріліп, кең жайылады, жақын жерде сұйылады",
  B: "Күндізгі қызу — жайылу күшті",
  C: "Аздап орнықсыз — орташа жайылу",
  D: "Бейтарап (бұлтты немесе желді) — ең жиі кездесетін жағдай",
  E: "Кешкі орнықты — жайылу баяулайды, шлейф ұзарады",
  F: "Түнгі орнықты қабат — шлейф ЖІҢІШКЕ әрі АЛЫСҚА жетеді, ең қауіпті режим",
};

/**
 * Pasquill класын анықтау.
 *
 * @param windMs   жел жылдамдығы, м/с (10 м биіктікте)
 * @param isDay    күндіз бе
 * @param solarWm2 күн радиациясы, Вт/м² (күндіз)
 * @param cloudPct бұлттылық, % (түнде)
 *
 * Кесте — Pasquill (1961) / Turner (1964) классикалық нұсқасы.
 */
export function pasquillClass(
  windMs: number,
  isDay: boolean,
  solarWm2: number | null,
  cloudPct: number | null
): PasquillClass {
  const u = Math.max(0, windMs);

  if (isDay) {
    // Күндізгі инсоляция деңгейі
    const s = solarWm2 ?? 0;
    const strong = s >= 700;      // күшті
    const moderate = s >= 350;    // орташа
    // әйтпесе — әлсіз

    if (u < 2) return strong ? "A" : moderate ? "A" : "B";
    if (u < 3) return strong ? "A" : moderate ? "B" : "C";
    if (u < 5) return strong ? "B" : moderate ? "B" : "C";
    if (u < 6) return strong ? "C" : moderate ? "C" : "D";
    return strong ? "C" : "D";
  }

  // Түнгі жағдай: бұлттылық маңызды (бұлт жылу шығынын тежейді)
  const c = cloudPct ?? 50;
  const cloudy = c >= 50; // ≥4/8 бұлт

  if (u < 2) return cloudy ? "E" : "F";
  if (u < 3) return cloudy ? "E" : "F";
  if (u < 5) return cloudy ? "D" : "E";
  return "D";
}

// ── Briggs (1973) ашық дала дисперсия коэффициенттері ──────────────────
// x — көзден қашықтық, МЕТР. Қайтарады: σy, σz метрмен.

export function sigmaY(x: number, cls: PasquillClass): number {
  const d = Math.max(1, x);
  const k: Record<PasquillClass, number> = { A: 0.22, B: 0.16, C: 0.11, D: 0.08, E: 0.06, F: 0.04 };
  return (k[cls] * d) / Math.sqrt(1 + 0.0001 * d);
}

export function sigmaZ(x: number, cls: PasquillClass): number {
  const d = Math.max(1, x);
  switch (cls) {
    case "A": return 0.2 * d;
    case "B": return 0.12 * d;
    case "C": return (0.08 * d) / Math.sqrt(1 + 0.0002 * d);
    case "D": return (0.06 * d) / Math.sqrt(1 + 0.0015 * d);
    case "E": return (0.03 * d) / (1 + 0.0003 * d);
    case "F": return (0.016 * d) / (1 + 0.0003 * d);
  }
}

/**
 * ШЛЕЙФ КОНУСЫНЫҢ ЖАРТЫ БҰРЫШЫ — екі құрамдастан:
 *
 *   1. ФИЗИКАЛЫҚ ЖАЙЫЛУ: 2σy(x) — шлейф массасының ~95%-ы осы жолақта.
 *      Орнықтылық класына тәуелді.
 *   2. ЖЕЛ БАҒЫТЫНЫҢ АУЫТҚУЫ: соңғы сағаттардағы бағыттың стандартты
 *      ауытқуы. Бұл — БЕЛГІСІЗДІК, физикалық жайылу емес: жел бұрылып
 *      кетсе шлейф басқа секторға түседі.
 *
 * Екеуін ҚОСАМЫЗ, сондықтан конус «ықтимал таралу секторы» болады.
 * Құрамдастары бөлек қайтарылады — UI-де қайсысы қанша екені жазылады.
 */
export function coneHalfAngle(
  lengthKm: number,
  cls: PasquillClass,
  windDirSigmaDeg: number
): { total: number; physical: number; wind: number } {
  const x = lengthKm * 1000;
  const physical = (Math.atan((2 * sigmaY(x, cls)) / x) * 180) / Math.PI;
  const wind = Math.max(0, Math.min(45, windDirSigmaDeg));
  return {
    total: Math.min(60, physical + wind),
    physical: +physical.toFixed(1),
    wind: +wind.toFixed(1),
  };
}

/**
 * Шлейфтің ұзындығы — концентрация елеусіз болғанға дейінгі қашықтық.
 *
 * Орнықты қабатта (E/F) шлейф баяу сұйылады → алысқа жетеді.
 * Орнықсызда (A/B) тез араласады → қысқа.
 */
export function plumeLengthKm(cls: PasquillClass, windMs: number): number {
  const base: Record<PasquillClass, number> = { A: 12, B: 16, C: 22, D: 30, E: 40, F: 50 };
  // Жел қатты болса ластаушы алысырақ тасымалданады (бірақ сұйылуы да артады)
  const u = Math.max(0.5, windMs);
  return +Math.max(8, Math.min(60, base[cls] * (0.6 + 0.12 * u))).toFixed(1);
}

/**
 * САЛЫСТЫРМАЛЫ жер бетіндегі концентрация (Gaussian plume, H = 0).
 *
 *   C(x,y) ∝ 1/(π · σy · σz · u) · exp(−y²/(2σy²))
 *
 * Шығарынды қарқыны Q белгісіз болғандықтан нәтиже НОРМАЛАНҒАН:
 * ең жоғары мәнге қатысты үлес (0…1). Абсолют µg/m³ БЕРІЛМЕЙДІ.
 *
 * ⚠️ Бұрын осьтік кему `exp(−d/30)` болатын — ол гаусс шлейфінің түрі
 * емес. Нақты жер бетіндегі концентрация σy·σz көбейтіндісіне кері
 * пропорционал, яғни дәрежелік заңға жақын.
 */
export function relativeConcentration(
  alongKm: number,
  crossKm: number,
  cls: PasquillClass,
  windMs: number
): number {
  if (alongKm <= 0) return 0;
  const x = alongKm * 1000;
  const y = crossKm * 1000;
  const sy = sigmaY(x, cls);
  const sz = sigmaZ(x, cls);
  const u = Math.max(0.5, windMs);
  const lateral = Math.exp(-(y * y) / (2 * sy * sy));
  return lateral / (Math.PI * sy * sz * u);
}

/** Бағыттардың стандартты ауытқуы (циклдік, градус) */
export function bearingStdDev(bearings: number[]): number {
  if (bearings.length < 2) return 0;
  let sx = 0, sy = 0;
  for (const b of bearings) {
    const r = (b * Math.PI) / 180;
    sx += Math.cos(r);
    sy += Math.sin(r);
  }
  const n = bearings.length;
  const R = Math.sqrt(sx * sx + sy * sy) / n; // орташа векторының ұзындығы
  if (R >= 1) return 0;
  // Циклдік стандартты ауытқу (Mardia)
  return +((Math.sqrt(-2 * Math.log(R)) * 180) / Math.PI).toFixed(1);
}

/** км/сағ → м/с */
export const kmhToMs = (kmh: number) => kmh / 3.6;
