// Тәуліктік және 8 сағаттық терезелер — `/api/fixate` үшін таза функциялар (P1.2, Г.2 2–3).
//
// Кіріс — Open-Meteo-дың САҒАТТЫҚ қатары (`timezone=GMT`, уақыттар UTC).
// Тәулік — АТЫРАУДЫҢ ЖЕРГІЛІКТІ КҮНІ (IANA `Asia/Atyrau`).
//
// УАҚЫТ БЕЛДЕУІ (шешім, Г.2 3-қадам): сұрау `timezone=GMT` күйінде қалады (жауап
// UTC, парсинг өзгермейді), ал жергілікті күн `Intl` арқылы `Asia/Atyrau` бойынша
// есептеледі. Open-Meteo `timezone=Asia/Atyrau` сұрауы `utc_offset_seconds: 18000`
// қайтарады (2026-11-03 тексерілді) — Intl офсеті соған сәйкес, `fixateWindows.test.ts`
// осыны тексереді.

import { windowMean } from "@/lib/averaging";

export const LOCAL_TIME_ZONE = "Asia/Atyrau";

/**
 * Тәуліктік орта үшін тәулікте кемінде қанша жарамды сағат керек.
 * ⚠️ ИЕСІНІҢ ШЕШІМІ (Г.2 2-қадам). Ұсыныс — 18 (24-тің 18-і), ойдан бекітілмеген:
 * иесі бекітпейінше осы мән ұсыныс ретінде қалады. Кез келген жаңа мән — параметр.
 */
export const DAILY_MIN_HOURS_DEFAULT = 18;

/**
 * 8 сағаттық жылжымалы терезе үшін кемінде қанша жарамды сағат керек.
 * ⚠️ ИЕСІНІҢ ШЕШІМІ. Әдепкі 8 — ең қатаң шарт: терезедегі әр сағат өлшенген болуы
 * керек (сондықтан ешқандай «толтырылған» мән шықпайды).
 */
export const EIGHT_HOUR_MIN_COUNT_DEFAULT = 8;

export interface SeriesPoint {
  /** UTC уақыт (`2026-11-02T19:00` немесе ISO). Аяқтаушы `Z` жоқ болса, UTC деп оқылады. */
  time: string;
  value: number | null | undefined;
}

export interface DailyWindow {
  /** Жергілікті күн, `YYYY-MM-DD` */
  dayKey: string;
  /** Тәуліктің басы (жергілікті 00:00), UTC ISO */
  windowStart: string;
  /** Тәуліктің соңғы сағаты (жергілікті 23:00), UTC ISO — кестедегі бірегейлік кілтіне кіреді */
  windowEnd: string;
  mean: number | null;
  count: number;
  sufficient: boolean;
  /** Тәулік толық өтті ме (келесі жергілікті түн орта шақтан өтті ме) */
  complete: boolean;
}

export interface RollingWindow {
  windowStart: string;
  windowEnd: string;
  mean: number | null;
  count: number;
  sufficient: boolean;
}

/** UTC уақыт жолын миллисекундқа айналдырады. `Z`/офсет жоқ болса UTC деп қабылданады. */
export function parseUtcMs(time: string): number {
  return Date.parse(/(Z|[+-]\d{2}:?\d{2})$/i.test(time) ? time : `${time}Z`);
}

/** Берілген UTC мезеттегі `timeZone` офсеті, миллисекундпен (UTC+5 → 18000000). */
export function zoneOffsetMs(utcMs: number, timeZone: string = LOCAL_TIME_ZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Жергілікті күн (`YYYY-MM-DD`) — UTC мезет үшін. */
export function localDayKey(utcMs: number, timeZone: string = LOCAL_TIME_ZONE): string {
  const local = new Date(utcMs + zoneOffsetMs(utcMs, timeZone));
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}

/** Жергілікті күннің басы (00:00) — UTC миллисекунд. Офсет екі рет тексеріледі. */
export function localMidnightUtcMs(dayKey: string, timeZone: string = LOCAL_TIME_ZONE): number {
  const [y, m, d] = dayKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d);
  const first = naive - zoneOffsetMs(naive, timeZone);
  return naive - zoneOffsetMs(first, timeZone);
}

/** Келесі күн кілті (`YYYY-MM-DD`). UTC арифметикасы — күн ауыстыруға жергілікті офсет әсер етпейді. */
function nextDayKey(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/**
 * Сағаттық қатарды жергілікті күн бойынша топтап, әр тәулік үшін 24 сағаттық орта.
 * Жеткіліксіз тәулік (`count < minHours`) — `sufficient: false`, `mean: null`:
 * ол «тексерілмеді» дегенді білдіреді, асу емес.
 *
 * @param nowMs тәулік толық өтті ме, соны анықтау үшін (келесі түн ≤ now → complete)
 */
export function dailyWindows(
  series: SeriesPoint[],
  opts: { minHours: number; nowMs: number; timeZone?: string }
): DailyWindow[] {
  const tz = opts.timeZone ?? LOCAL_TIME_ZONE;
  const groups = new Map<string, (number | null | undefined)[]>();
  for (const p of series) {
    const ms = parseUtcMs(p.time);
    if (!Number.isFinite(ms)) continue;
    const key = localDayKey(ms, tz);
    const values = groups.get(key) ?? [];
    values.push(p.value);
    groups.set(key, values);
  }

  return [...groups.keys()].sort().map((dayKey) => {
    const start = localMidnightUtcMs(dayKey, tz);
    const end = localMidnightUtcMs(nextDayKey(dayKey), tz);
    const w = windowMean(groups.get(dayKey) ?? [], opts.minHours);
    return {
      dayKey,
      windowStart: new Date(start).toISOString(),
      windowEnd: new Date(end - 3600_000).toISOString(),
      mean: w.mean,
      count: w.count,
      sufficient: w.sufficient,
      complete: opts.nowMs >= end,
    };
  });
}

/**
 * Жылжымалы `windowHours` сағаттық орта. Терезе — ҮЗІЛМЕЙТІН сағаттар қатары:
 * ортасында үзіліс болса, ол терезе өткізіледі (саңылаумен орта есептелмейді).
 */
export function rollingWindows(
  series: SeriesPoint[],
  opts: { windowHours: number; minCount: number }
): RollingWindow[] {
  const points = series
    .map((p) => ({ ms: parseUtcMs(p.time), value: p.value }))
    .filter((p) => Number.isFinite(p.ms))
    .sort((a, b) => a.ms - b.ms);
  const back = opts.windowHours - 1;
  const out: RollingWindow[] = [];
  for (let i = back; i < points.length; i++) {
    const first = points[i - back];
    const last = points[i];
    // Терезе толық сағаттардан тұруы керек: бірінші мен соңғы арасы дәл back сағат
    if (last.ms - first.ms !== back * 3600_000) continue;
    const w = windowMean(points.slice(i - back, i + 1).map((p) => p.value), opts.minCount);
    out.push({
      windowStart: new Date(first.ms).toISOString(),
      windowEnd: new Date(last.ms).toISOString(),
      mean: w.mean,
      count: w.count,
      sufficient: w.sufficient,
    });
  }
  return out;
}
