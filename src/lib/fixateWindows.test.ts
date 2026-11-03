import { describe, expect, it } from "vitest";
import { windowMean } from "@/lib/averaging";
import {
  dailyWindows, localDayKey, rollingWindows, zoneOffsetMs, type SeriesPoint,
} from "@/lib/fixateWindows";

// Жергілікті 2026-11-03 күні = UTC 2026-11-02T19:00 … 2026-11-03T18:00 (Asia/Atyrau, UTC+5)
function hoursFrom(startUtc: string, n: number, value: (i: number) => number | null): SeriesPoint[] {
  const start = Date.parse(`${startUtc}Z`);
  return Array.from({ length: n }, (_, i) => ({
    time: new Date(start + i * 3600_000).toISOString().slice(0, 16),
    value: value(i),
  }));
}
const LOCAL_NOV3 = "2026-11-02T19:00";
const AFTER_NOV3 = Date.parse("2026-11-04T00:00:00Z");
const MID_NOV3 = Date.parse("2026-11-03T12:00:00Z");

describe("Асия/Атырау уақыт белдеуі", () => {
  it("офсет API-мен сәйкес: utc_offset_seconds = 18000 (UTC+5)", () => {
    expect(zoneOffsetMs(Date.parse("2026-11-03T00:00:00Z"), "Asia/Atyrau")).toBe(18000 * 1000);
  });

  it("UTC 19:00 — жергілікті келесі күннің 00:00; күн ауысуы жергілікті бойынша", () => {
    expect(localDayKey(Date.parse("2026-11-02T19:00:00Z"))).toBe("2026-11-03");
    expect(localDayKey(Date.parse("2026-11-02T18:59:00Z"))).toBe("2026-11-02");
  });
});

describe("windowMean — жеткіліксіз терезе нөлмен толтырылмайды", () => {
  it("минималды саннан аз болса mean = null, sufficient = false (0 емес)", () => {
    const w = windowMean([null, 40, undefined], 2);
    expect(w).toEqual({ mean: null, count: 1, sufficient: false });
  });

  it("жеткілікті болса тек жарамды мәндердің орташасы", () => {
    expect(windowMean([10, null, 30], 2)).toEqual({ mean: 20, count: 2, sufficient: true });
  });
});

describe("dailyWindows — тәуліктік орта (Г.2 2–3)", () => {
  it("толық тәулік: 24 сағат = 40 → орта 40, терезе жергілікті күн шекарасында", () => {
    const [d] = dailyWindows(hoursFrom(LOCAL_NOV3, 24, () => 40), { minHours: 18, nowMs: AFTER_NOV3 });
    expect(d.dayKey).toBe("2026-11-03");
    expect(d.mean).toBe(40);
    expect(d.sufficient).toBe(true);
    expect(d.complete).toBe(true);
    expect(d.windowStart).toBe("2026-11-02T19:00:00.000Z");
    expect(d.windowEnd).toBe("2026-11-03T18:00:00.000Z");
  });

  it("(г) тәулікте шектен аз сағат (17 < 18) → тексерілмеді: sufficient=false, mean=null", () => {
    const [d] = dailyWindows(hoursFrom(LOCAL_NOV3, 17, () => 40), { minHours: 18, nowMs: AFTER_NOV3 });
    expect(d.count).toBe(17);
    expect(d.sufficient).toBe(false);
    expect(d.mean).toBe(null);
  });

  it("әлі аяқталмаған тәулік complete=false (толық емес күнді фиксациялауға болмайды)", () => {
    const [d] = dailyWindows(hoursFrom(LOCAL_NOV3, 24, () => 40), { minHours: 18, nowMs: MID_NOV3 });
    expect(d.complete).toBe(false);
  });

  it("сағаттық мәндер арифметикалық орташаланады", () => {
    const [d] = dailyWindows(hoursFrom(LOCAL_NOV3, 24, (i) => i + 1), { minHours: 18, nowMs: AFTER_NOV3 });
    expect(d.mean).toBe(12.5);
  });
});

describe("rollingWindows — O₃ 8 сағаттық жылжымалы орта", () => {
  it("10 сағат (1..10) → 3 терезе: 4.5, 5.5, 6.5", () => {
    const ws = rollingWindows(hoursFrom("2026-11-03T00:00", 10, (i) => i + 1), { windowHours: 8, minCount: 8 });
    expect(ws.map((w) => w.mean)).toEqual([4.5, 5.5, 6.5]);
    expect(ws[0].windowStart).toBe("2026-11-03T00:00:00.000Z");
    expect(ws[0].windowEnd).toBe("2026-11-03T07:00:00.000Z");
  });

  it("терезедегі бір null → minCount=8 бойынша жеткіліксіз, mean=null", () => {
    const ws = rollingWindows(hoursFrom("2026-11-03T00:00", 9, (i) => (i === 4 ? null : 10)), { windowHours: 8, minCount: 8 });
    expect(ws.every((w) => !w.sufficient && w.mean === null)).toBe(true);
  });

  it("қатардағы үзіліс (саңылау) бар терезе өткізіледі, саңылаумен орта есептелмейді", () => {
    // 0..13 сағат (мән = сағат+1), 3-сағат жоқ → 0..3 тұсындағы терезелер кірмейді
    const series = hoursFrom("2026-11-03T00:00", 14, (i) => i + 1).filter((_, i) => i !== 3);
    const ws = rollingWindows(series, { windowHours: 8, minCount: 8 });
    expect(ws.map((w) => w.mean)).toEqual([8.5, 9.5, 10.5]);
    expect(ws[0].windowStart).toBe("2026-11-03T04:00:00.000Z");
  });
});
