import { PLACES } from "@/data/facilities";
import { checkCompliance, type ComplianceLevel } from "@/lib/compliance";
import type { PlumeFrame } from "@/lib/pollutionSource";

// ЛАСТАНУ ОҚИҒАСЫНЫҢ САҒАТТЫҚ ХРОНОЛОГИЯСЫ.
//
// ═══ НЕГЕ КЕРЕК ═══
// Модуль бұрын тек «қазіргі сурет» көрсететін: бір конус, бір жел бағыты,
// бір концентрация. Ал «қалаға ластану келді» деген тұжырымды тексеру
// үшін керегі — ОҚИҒА ЖЕЛІСІ: қай сағатта жел қалай бұрылды, шлейф қай
// елді мекенге тиді, сол сағатта қандай зат қанша болды.
//
// Бұл файл жаңа дерек ЕСЕПТЕМЕЙДІ. Барлық сан жүйеде бұрыннан бар
// (`frames` — сағаттық конустар, `windHistory` — сағаттық концентрациялар),
// тек бір кестеге жиналады.
//
// ═══ ⚠️ «ЖЕТКЕН ЖЕР» ДЕГЕН НЕ ═══
// Елді мекен сол сағаттағы дисперсия конусының ІШІНЕ түскені —
// «ластану сонда болды» дегенді БІЛДІРМЕЙДІ. Конус — ықтимал таралу
// секторы (Pasquill/Briggs), өлшенген өріс емес. Концентрация ҚАЛА
// нүктесінде өлшенген, әр елді мекенде емес.
//
// Сондықтан бағанның аты «жеткен жер» емес, «ЖЕЛ БАҒЫТЫНДА ТҰРҒАН» болуы
// керек, ал құжатта осы айырма ашық жазылады.

export interface TimelineHour {
  /** ISO, жергілікті уақыт */
  time: string;
  /** "15:00" */
  hour: string;
  /** Тірек сағаттан бұрын ба (тірі режимде «өткен», архивте «дейін») */
  past: boolean;
  /** Тірек сағаттың өзі */
  pivot: boolean;
  wind: { fromLabel: string; toBearing: number; speed: number };
  /** Осы сағаттағы конус ішінде қалған елді мекендер */
  downwind: string[];
  /** Қала нүктесіндегі концентрация, µg/m³ */
  so2: number | null;
  no2: number | null;
  pm: number | null;
  /** Норма салыстыруы — әр зат бойынша ең ауыр деңгей */
  levels: { so2: ComplianceLevel; no2: ComplianceLevel; pm: ComplianceLevel };
  /** Кемінде біреуі расталған ҚР нормасынан асты ма */
  kzViolation: boolean;
}

/** Нүкте көпбұрыш ішінде ме (ray casting). Сақина — [lng, lat] реті. */
function inRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export interface AirHour {
  so2: number | null;
  no2: number | null;
  pm: number | null;
}

/**
 * Сағаттық хронология құрады.
 *
 * @param frames         тірек сағатқа ДЕЙІНГІ сағаттардың конустары
 * @param forwardFrames  тірек сағаттан КЕЙІНГІ сағаттардың конустары
 * @param airByTime      сағат → концентрация (қала нүктесі)
 * @param pivotTime      тірек сағат (ISO, жергілікті)
 * @param jurisdiction   норма салыстыруы үшін
 */
export function buildTimeline(
  frames: PlumeFrame[],
  forwardFrames: PlumeFrame[],
  airByTime: Map<string, AirHour>,
  pivotTime: string | null,
  jurisdiction: "KZ" | "OTHER" = "KZ"
): TimelineHour[] {
  const all = [...frames, ...forwardFrames].filter((f) => f.time);
  // Уақыт бойынша реттеу әрі қайталанатын сағатты алып тастау
  const seen = new Set<string>();
  const ordered = all
    .filter((f) => (seen.has(f.time) ? false : (seen.add(f.time), true)))
    .sort((a, b) => a.time.localeCompare(b.time));

  const pivotMs = pivotTime ? new Date(pivotTime).getTime() : null;

  return ordered.map((f) => {
    const air = airByTime.get(f.time) ?? { so2: null, no2: null, pm: null };
    const tMs = new Date(f.time).getTime();

    // Осы сағаттағы конустың ішіндегі елді мекендер
    const downwind = f.cone?.length
      ? PLACES.filter((p) => inRing(p.lat, p.lng, f.cone)).map((p) => p.name)
      : [];

    const cSo2 = checkCompliance("so2", air.so2, jurisdiction);
    const cNo2 = checkCompliance("no2", air.no2, jurisdiction);
    const cPm = checkCompliance("pm10", air.pm, jurisdiction);

    return {
      time: f.time,
      hour: f.hour || f.time.slice(11, 16),
      past: pivotMs != null ? tMs < pivotMs : true,
      pivot: pivotMs != null && tMs === pivotMs,
      wind: { fromLabel: f.fromLabel, toBearing: f.toBearing, speed: f.speed },
      downwind,
      so2: air.so2,
      no2: air.no2,
      pm: air.pm,
      levels: { so2: cSo2.worst, no2: cNo2.worst, pm: cPm.worst },
      kzViolation: cSo2.kzViolation || cNo2.kzViolation || cPm.kzViolation,
    };
  });
}

/** Хронологиядан қысқаша қорытынды — құжаттың бірінші абзацы үшін. */
export function summarizeTimeline(rows: TimelineHour[]): {
  hours: number;
  exceededHours: number;
  kzViolationHours: number;
  firstExceedance: string | null;
  lastExceedance: string | null;
  affected: string[];
  peak: { time: string; pollutant: string; value: number } | null;
} {
  const exceeded = rows.filter((r) =>
    (["so2", "no2", "pm"] as const).some(
      (k) => r.levels[k] === "exceeded" || r.levels[k] === "exceeded-unverified"
    )
  );
  const affected = new Set<string>();
  for (const r of exceeded) for (const d of r.downwind) affected.add(d);

  let peak: { time: string; pollutant: string; value: number } | null = null;
  for (const r of rows) {
    for (const [k, label] of [["so2", "SO₂"], ["no2", "NO₂"], ["pm", "PM₁₀"]] as const) {
      const v = r[k];
      if (v == null) continue;
      if (!peak || v > peak.value) peak = { time: r.time, pollutant: label, value: v };
    }
  }

  return {
    hours: rows.length,
    exceededHours: exceeded.length,
    kzViolationHours: rows.filter((r) => r.kzViolation).length,
    firstExceedance: exceeded[0]?.time ?? null,
    lastExceedance: exceeded[exceeded.length - 1]?.time ?? null,
    affected: [...affected],
    peak,
  };
}
