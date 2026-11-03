import { describe, expect, it } from "vitest";
import { buildWindHourly, isDispersionWindMissing, type WindHourlySeries, type WindHourlyUpstream } from "@/lib/windGrid";

// Сағаттық тізбек: 30 сағат, ағымдағы сағат индексі = 26 ("…T26")
const times = Array.from({ length: 60 }, (_, i) => `2026-11-03T${String(i).padStart(2, "0")}:00`);
const now = times[26];

function node(speed: (number | null)[], dir: (number | null)[], cur = now): WindHourlyUpstream {
  return {
    current: { time: cur },
    hourly: { time: times, wind_speed_10m: speed, wind_direction_10m: dir },
  };
}
const flat = (v: number | null) => Array.from({ length: 60 }, () => v);

describe("P2.3: сағаттық жел — өткен/болжам белгісі", () => {
  it("өткен 24 сағат және алдағы 24 сағат, әр нүкте kind-пен белгіленеді", () => {
    const s = buildWindHourly([node(flat(5), flat(90))])!;
    expect(s.past).toHaveLength(24);
    expect(s.forecast).toHaveLength(24);
    expect(s.past.every((p) => p.kind === "past")).toBe(true);
    expect(s.forecast.every((p) => p.kind === "forecast")).toBe(true);
    expect(s.past[s.past.length - 1].time).toBe(now);
    expect(s.forecast[0].time).toBe(times[27]);
  });

  it("жарамды жоқ сағат — avgSpeed null (нөл емес)", () => {
    const sp = flat(null);
    sp[27] = 8; // тек бір сағатта мән бар
    const s = buildWindHourly([node(sp, flat(null))])!;
    expect(s.forecast[0].avgSpeed).toBe(8);
    expect(s.forecast[1].avgSpeed).toBeNull();
    expect(s.forecast[1].dominantDir).toBeNull();
    expect(s.forecast[1].validCount).toBe(0);
  });

  it("тор бойынша орташа тек жарамды нүктелерден; нақты 0 м/с — 0", () => {
    const a = node(flat(10), flat(0));
    const b = node(flat(null), flat(null));
    const c = node(flat(0), flat(180));
    const s = buildWindHourly([a, b, c])!;
    expect(s.past[0].avgSpeed).toBe(5); // (10+0)/2, b жоқ
    expect(s.past[0].validCount).toBe(2);
  });

  it("current 15 мин қадамымен келеді ('…T26:30') — сол сағат индексі табылады", () => {
    // Open-Meteo нақты жауабы: current.time = "2026-11-03T17:30", hourly — "…T17:00"
    const s = buildWindHourly([node(flat(5), flat(90), `${times[26].slice(0, 13)}:30`)])!;
    expect(s.past[s.past.length - 1].time).toBe(now);
    expect(s.forecast[0].time).toBe(times[27]);
  });

  it("ағымдағы уақыт анкері жоқ → null (503-ке жол береді)", () => {
    expect(buildWindHourly([{ current: null, hourly: { time: times } }])).toBeNull();
    expect(buildWindHourly([{ current: { time: "1999-01-01T00:00" }, hourly: { time: times } }])).toBeNull();
    expect(buildWindHourly([{ current: { time: now } }])).toBeNull();
  });

  it("басым бағыт векторлық орташа: 350° және 10° → ~0°", () => {
    const s = buildWindHourly([node(flat(3), flat(350)), node(flat(3), flat(10))])!;
    expect(s.forecast[0].dominantDir).toBe(0);
  });
});

describe("P2.4: таралу слайдері сұрлануы — жел деректеріне байланысты", () => {
  const ok: WindHourlySeries = {
    past: [{ time: now, kind: "past", avgSpeed: 4, dominantDir: 90, validCount: 1 }],
    forecast: [{ time: times[27], kind: "forecast", avgSpeed: null, dominantDir: null, validCount: 0 }],
  };
  const allNull: WindHourlySeries = {
    past: [{ time: now, kind: "past", avgSpeed: null, dominantDir: null, validCount: 0 }],
    forecast: [],
  };

  it("көз жылдамдығы жоқ/жарамсыз → сұрланады (null, NaN, undefined)", () => {
    for (const sourceSpeed of [null, NaN, undefined, Infinity]) {
      expect(isDispersionWindMissing({ sourceSpeed, windState: "ok", hourly: ok })).toBe(true);
    }
  });

  it("жел торы сұрауы сәтсіз (error) → сұрланады, hourly бар болса да", () => {
    expect(isDispersionWindMissing({ sourceSpeed: 5, windState: "error", hourly: ok })).toBe(true);
  });

  it("жүктелуде (loading) → сұрланбайды (дерек әлі белгісіз)", () => {
    expect(isDispersionWindMissing({ sourceSpeed: 5, windState: "loading", hourly: null })).toBe(false);
  });

  it("жауап бар, бір де жарамды сағаттық жылдамдық жоқ → сұрланады", () => {
    expect(isDispersionWindMissing({ sourceSpeed: 5, windState: "ok", hourly: allNull })).toBe(true);
  });

  it("ескі жауап (hourly жоқ) → сұрланады", () => {
    expect(isDispersionWindMissing({ sourceSpeed: 5, windState: "ok", hourly: undefined })).toBe(true);
  });

  it("жарамды сағаттық жел бар және көз жылдамдығы ақырлы → сұрланбайды", () => {
    expect(isDispersionWindMissing({ sourceSpeed: 5, windState: "ok", hourly: ok })).toBe(false);
  });
});
