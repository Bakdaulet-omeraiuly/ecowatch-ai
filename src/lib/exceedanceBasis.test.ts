import { describe, expect, it } from "vitest";
import { markLegacy, splitLegacy } from "@/lib/exceedanceBasis";

const modern = { id: 1, window_end: "2026-11-03T18:00:00Z", sample_count: 24, legacy_invalid_basis: false };
const oldRow = { id: 2, window_end: null, sample_count: null, legacy_invalid_basis: null };
const oldFlagged = { id: 3, window_end: "2026-11-01T10:00:00Z", sample_count: 1, legacy_invalid_basis: true };
const noCount = { id: 4, window_end: "2026-11-01T11:00:00Z", sample_count: null };

describe("P1.2 (е): ескі жолдар жойылмайды, белгіленеді", () => {
  it("markLegacy ұзындықты сақтайды және жолдарды жоймайды", () => {
    const rows = [modern, oldRow, oldFlagged, noCount];
    const marked = markLegacy(rows);
    expect(marked).toHaveLength(rows.length);
    expect(marked.map((r) => r.id)).toEqual([1, 2, 3, 4]);
  });

  it("window_end немесе sample_count жоқ жол — legacy_invalid_basis = true", () => {
    const marked = markLegacy([oldRow, noCount]);
    expect(marked.every((r) => r.legacy_invalid_basis === true)).toBe(true);
  });

  it("толық жаңа жол legacy_invalid_basis = false болып қалады", () => {
    expect(markLegacy([modern])[0].legacy_invalid_basis).toBe(false);
  });

  it("DB-де белгіленген ескі жол тіпті window_end бар болса да ескі күйінде қалады", () => {
    expect(markLegacy([oldFlagged])[0].legacy_invalid_basis).toBe(true);
  });

  it("splitLegacy: ағымдағы және ескі топтар — жиыны бастапқыға тең, ешбірі жоғалмайды", () => {
    const rows = [modern, oldRow, oldFlagged, noCount];
    const { current, legacy } = splitLegacy(rows);
    expect(current).toEqual([modern]);
    expect(legacy).toEqual([oldRow, oldFlagged, noCount]);
    expect(current.length + legacy.length).toBe(rows.length);
  });

  it("бос кіріс → бос нәтиже (қате жоқ)", () => {
    expect(splitLegacy([])).toEqual({ current: [], legacy: [] });
  });
});
