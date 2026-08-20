// ЛАСТАНУ КӨЗІ — УАҚЫТ ТАҢДАУ (тірі режим ↔ архив режимі).
//
// ═══ НЕГЕ КЕРЕК ═══
// Бұрын модуль тек соңғы 48 сағатты көретін. Ал прокуратура үшін керегі
// НАҚТЫ ӨТКЕН ОҚИҒА: «былтырғы 14 тамызда, сағат 15:00-де қалада SO₂
// көтерілді, жел мұнай өңдеу зауыты жағынан соқты». Ол сұраққа жауап
// беру үшін архивке жүгіну керек.
//
// ═══ ЕКІ АРХИВ, ЕКІ ШЕКАРА ═══
// Open-Meteo-да өткен дерек екі бөлек эндпоинтте жатыр:
//   · соңғы ~90 күн — негізгі forecast API (start_date/end_date қабылдайды)
//   · одан ары      — archive-api (ERA5 реанализі)
// Шекараны білмей сұрасақ, бос жауап қайтады. Сондықтан таңдалған күннің
// жасына қарай эндпоинт АВТОМАТТЫ таңдалады.
//
// ═══ ⚠️ «БОЛЖАМ» СӨЗІ АРХИВ РЕЖИМІНДЕ ЖАРАМАЙДЫ ═══
// Тірі режимде таңдалған сағаттан КЕЙІНГІ деректер — болжам.
// Архив режимінде олар ӨЛШЕНГЕН (нақты болған) дерек. Екеуін бір сөзбен
// атау — пайдаланушыны адастыру. Сондықтан режим жауапта ашық беріледі,
// UI жапсырманы соған қарай ауыстырады.
//
// ═══ ⚠️ ДЕРЕК ЖОҚ БОЛСА ═══
// Ойдан толтырылмайды. Таңдалған сағат үшін мән қайтпаса, себебі
// (қай дереккөз, қай күн) нақты жазылып, қате қайтарылады.

/** Артқа қарай рұқсат етілген ең үлкен тереңдік (күн). */
export const MAX_DAYS_BACK = 366;

/** Осы шектен ескі күн үшін ERA5 архиві қолданылады. */
const FORECAST_API_DAYS = 90;

export type SourceMode = "live" | "archive";

export interface TimeSelection {
  mode: SourceMode;
  /** Таңдалған сағат, ЖЕРГІЛІКТІ уақыт: "YYYY-MM-DDTHH:00" (архивте ғана) */
  at: string | null;
  /** Бүгіннен неше күн бұрын */
  daysAgo: number;
  /** Сұралатын терезе — таңдалған сағаттың алды-артындағы бір тәулік */
  startDate: string;
  endDate: string;
  /** ERA5 архивіне жүгіну керек пе */
  useEra5: boolean;
}

export interface TimeSelectionError {
  error: string;
  detail: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const dayStr = (d: Date) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/**
 * `?at=` параметрін оқып тексереді.
 *
 * Қабылданатын пішін: "2026-08-14T15:00" немесе "2026-08-14T15" немесе
 * "2026-08-14 15:00". Уақыт — ТАҢДАЛҒАН АЙМАҚТЫҢ жергілікті уақыты
 * (Open-Meteo `timezone=auto` сол пішінде қайтарады, сондықтан жолды
 * тікелей салыстыруға болады).
 *
 * `at` берілмесе — тірі режим.
 */
export function parseSelection(
  raw: string | null,
  now = new Date()
): TimeSelection | TimeSelectionError {
  if (!raw) {
    return {
      mode: "live",
      at: null,
      daysAgo: 0,
      startDate: dayStr(now),
      endDate: dayStr(now),
      useEra5: false,
    };
  }

  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2})(?::\d{2})?/);
  if (!m) {
    return {
      error: "Уақыт пішімі дұрыс емес",
      detail: "Күтілетін пішін: 2026-08-14T15:00 (жергілікті уақыт).",
    };
  }
  const [, y, mo, d, h] = m;
  const at = `${y}-${mo}-${d}T${h}:00`;

  // Тексеру үшін UTC ретінде оқимыз — салыстыру да, күн санау да
  // бірдей шкалада жүруі керек (белдеу айырмасы 1 сағаттан аспайды,
  // ал шектер тәулікпен өлшенеді).
  const t = Date.UTC(+y, +mo - 1, +d, +h);
  if (!Number.isFinite(t)) {
    return { error: "Уақыт дұрыс емес", detail: `«${raw}» оқылмады.` };
  }

  const nowT = Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()
  );
  const daysAgo = Math.floor((nowT - t) / 86400_000);

  if (t > nowT) {
    return {
      error: "Болашақ уақыт таңдалды",
      detail:
        "Ластану көзін анықтау — ӨТКЕН оқиғаны талдау. Болашақ сағат үшін " +
        "өлшенген дерек жоқ, ал ойдан жасалмайды.",
    };
  }
  if (daysAgo > MAX_DAYS_BACK) {
    return {
      error: `Тереңдік шегі — ${MAX_DAYS_BACK} күн`,
      detail:
        `Таңдалған күн ${daysAgo} күн бұрын. Қазіргі баптауда соңғы ` +
        `${MAX_DAYS_BACK} күн ғана қолжетімді.`,
    };
  }

  // Терезе: таңдалған сағаттың алдындағы және кейінгі бір тәулік.
  // Алдыңғысы — уақыттық CWT пен хронология үшін, кейінгісі — шлейфтің
  // қайда кеткенін көрсету үшін.
  const start = new Date(t - 86400_000);
  const end = new Date(t + 86400_000);

  return {
    mode: "archive",
    at,
    daysAgo,
    startDate: dayStr(start),
    endDate: dayStr(end),
    useEra5: daysAgo > FORECAST_API_DAYS,
  };
}

export function isSelectionError(
  s: TimeSelection | TimeSelectionError
): s is TimeSelectionError {
  return "error" in s;
}

// ── URL құрастырғыштар ───────────────────────────────────────────────────

const coords = (pts: { lat: number; lng: number }[]) =>
  `latitude=${pts.map((p) => p.lat).join(",")}&longitude=${pts.map((p) => p.lng).join(",")}`;

const WIND_VARS = "wind_speed_10m,wind_direction_10m";
/** Pasquill орнықтылық класы осы екеуінсіз есептелмейді */
const METEO_VARS = "shortwave_radiation,cloud_cover";
const AIR_VARS = "sulphur_dioxide,nitrogen_dioxide,pm10";

/**
 * Метео (жел + орнықтылық кірістері) — тор нүктелері үшін.
 * Архив режимінде `current` ЖОҚ: барлығы сағаттық массивтен алынады.
 */
export function meteoUrl(pts: { lat: number; lng: number }[], sel: TimeSelection): string {
  if (sel.mode === "live") {
    return (
      `https://api.open-meteo.com/v1/forecast?${coords(pts)}` +
      `&current=${WIND_VARS},is_day,${METEO_VARS}` +
      `&hourly=${WIND_VARS}&past_days=2&forecast_days=2&timezone=auto`
    );
  }
  const base = sel.useEra5
    ? "https://archive-api.open-meteo.com/v1/archive"
    : "https://api.open-meteo.com/v1/forecast";
  return (
    `${base}?${coords(pts)}` +
    `&hourly=${WIND_VARS},${METEO_VARS},is_day` +
    `&start_date=${sel.startDate}&end_date=${sel.endDate}&timezone=auto`
  );
}

/**
 * Ауа сапасы (CAMS) — тор нүктелері немесе қала.
 *
 * `hourly` — тірі режимде сағаттық қатар да керек пе. Тор үшін керек емес
 * (лездік мән жеткілікті), ал қала үшін керек: хронология мен уақыттық
 * CWT сағаттық қатардан есептеледі. Архив режимінде `current` МҮЛДЕМ жоқ,
 * сондықтан сағаттық әрқашан сұралады.
 */
export function airUrl(
  pts: { lat: number; lng: number }[],
  sel: TimeSelection,
  opts: { hourly?: boolean } = {}
): string {
  const base = "https://air-quality-api.open-meteo.com/v1/air-quality";
  if (sel.mode === "live") {
    const h = opts.hourly ? `&hourly=${AIR_VARS}&past_days=2&forecast_days=0` : "";
    return `${base}?${coords(pts)}&current=${AIR_VARS}${h}&timezone=auto`;
  }
  return (
    `${base}?${coords(pts)}&hourly=${AIR_VARS}` +
    `&start_date=${sel.startDate}&end_date=${sel.endDate}&timezone=auto`
  );
}

/**
 * Сағаттық массивтен таңдалған сағаттың индексін табады.
 * Табылмаса −1 — шақырушы «дерек жоқ» деп ашық хабарлауы керек.
 */
export function hourIndex(times: string[] | undefined, at: string): number {
  if (!times?.length) return -1;
  const i = times.indexOf(at);
  if (i >= 0) return i;
  // Кейбір жауапта секунд бар ("…T15:00:00") — префикспен де іздейміз
  return times.findIndex((t) => t.startsWith(at));
}

/** Адамға арналған қазақша уақыт жазуы: «14 тамыз 2026, 15:00» */
const MONTHS_KZ = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];
export function formatKz(at: string): string {
  const m = at.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2})/);
  if (!m) return at;
  const [, y, mo, d, h] = m;
  return `${+d} ${MONTHS_KZ[+mo - 1]} ${y} ж., ${h}:00`;
}
