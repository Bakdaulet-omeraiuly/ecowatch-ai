import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { JOURNAL_KINDS, JOURNAL_LAYERS, JOURNAL_STATUSES, KIND_SPECS, plantingSeasons, validateEntry } from "./fieldJournal";
import { REVIEW_LAYERS, VERDICTS } from "./detectionReview";

const sql = readFileSync("supabase/migrations/20261105_map_tools.sql", "utf8").replace(/--[^\n]*/g, "");
const listIn = (col: string) => [...(sql.match(new RegExp(`${col} text not null[^,]*check \\(${col} in \\(([^)]+)\\)\\)`))?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);

const sq = [[51.92, 47.11], [51.93, 47.11], [51.93, 47.12], [51.92, 47.12], [51.92, 47.11]];
const base = { layer: "green", kind: "planting", geom: { type: "Polygon", coordinates: [sq] }, event_date: "2026-05-01", status: "open", fields: { species: "қарағаш", count: "120" } };
const today = new Date("2026-11-04T12:00:00Z");

describe("далалық журнал", () => {
  it("SQL check-тері TypeScript тізімдерімен бірдей", () => {
    expect(listIn("layer").slice(0, JOURNAL_LAYERS.length)).toEqual([...JOURNAL_LAYERS]);
    expect(listIn("kind")).toEqual([...JOURNAL_KINDS]);
    expect(listIn("status")).toEqual([...JOURNAL_STATUSES]);
    expect(listIn("verdict")).toEqual([...VERDICTS]);
    const reviewLayers = [...(sql.match(/detection_reviews \([\s\S]*?layer text not null check \(layer in \(([^)]+)\)\)/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(reviewLayers).toEqual([...REVIEW_LAYERS]);
  });
  it("RLS: журнал тек scientist/officer/admin, жазу иесінің атынан; растау append-only", () => {
    expect(sql).toContain("alter table public.field_entries enable row level security");
    expect(sql).toMatch(/field_entries_insert[\s\S]*?user_id = auth\.uid\(\)/);
    expect(sql).not.toMatch(/grant[^;]+on public\.field_entries[^;]+anon/i);
    expect(sql).toContain("detection_reviews is append-only");
    expect(sql).toContain("watch_areas limit 10 per user");
  });
  it("әр түрдің мәртебелері жалпы тізімнің ішінде", () => {
    for (const k of KIND_SPECS) for (const s of k.statuses) expect(JOURNAL_STATUSES).toContain(s);
  });
  it("жарамды отырғызу жазбасы — сан нөмірге айналады, аудан есептеледі", () => {
    const r = validateEntry(base, today);
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.row.fields.count).toBe(120); expect(r.row.area_km2).toBeGreaterThan(0.5); }
  });
  it("қате жазбалар қабылданбайды", () => {
    expect(validateEntry({ ...base, layer: "air" }, today).ok).toBe(false); // planting ауаға жатпайды
    expect(validateEntry({ ...base, fields: { count: 5 } }, today).ok).toBe(false); // species міндетті
    expect(validateEntry({ ...base, event_date: "2026-12-01" }, today).ok).toBe(false); // болашақ, бірақ open
    expect(validateEntry({ ...base, event_date: "2026-12-01", status: "planned" }, today).ok).toBe(true);
    expect(validateEntry({ ...base, kind: "trap", layer: "mosquito", fields: { trap_type: "CDC light", count: 3 }, status: "done" }, today).ok).toBe(false); // тұзаққа нүкте керек
    expect(validateEntry({ ...base, geom: { type: "Point", coordinates: [60, 47] } }, today).ok).toBe(false); // облыстан тыс
  });
  it("отырғызу маусымдары: 2026 көктемінде отырғызылған → 2026 жазы әлі 'ерте' емес", () => {
    const s = plantingSeasons("2026-04-10", today);
    expect(s.baseline.year).toBe(2025); expect(s.recent.year).toBe(2026); expect(s.tooEarly).toBe(false);
    expect(plantingSeasons("2026-09-10", today).tooEarly).toBe(true);
  });
});
