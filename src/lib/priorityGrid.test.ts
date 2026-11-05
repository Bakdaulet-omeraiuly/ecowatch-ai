import { describe, it, expect } from "vitest";
import { buildCells, scoreCells, cellFraction, toPolys, decodeNdvi, type PriorityCell } from "./priorityGrid";
import { deflateSync } from "node:zlib";
import { decodeGrayPng } from "./pngGray";

const cell = (o: Partial<PriorityCell>): PriorityCell => ({ id: "x", bbox: [0, 0, 1, 1], ndvi: 0.2, ndviCoverage: 1, residential: 0, green: 0, sourceKm: 20, ...o });

describe("priorityGrid", () => {
  it("1 км ұяшықтар саны bbox-қа сай", () => {
    const cells = buildCells([51.72, 47.0, 52.12, 47.3]);
    expect(cells.length).toBeGreaterThan(900); expect(cells.length).toBeLessThan(1100);
  });
  it("салмақ: тек NDVI → ең аз NDVI ең жоғары; NDVI жоқ → null", () => {
    const s = scoreCells([cell({ ndvi: 0.1 }), cell({ ndvi: 0.5 }), cell({ ndvi: null })], { ndvi: 100, residential: 0, source: 0, population: 0 });
    expect(s[0]).toBeCloseTo(1); expect(s[1]).toBeCloseTo(0); expect(s[2]).toBeNull();
  });
  it("халық: көп халықты ұяшық жоғары; дерегі жоқ ұяшықта критерий алынады", () => {
    const cells = [cell({ id: "a", ndvi: 0.2 }), cell({ id: "b", ndvi: 0.2 }), cell({ id: "c", ndvi: 0.2 })];
    const pop = new Map<string, number | null>([["a", 5000], ["b", 10], ["c", null]]);
    const s = scoreCells(cells, { ndvi: 0, residential: 0, source: 0, population: 100 }, pop);
    expect(s[0]).toBeCloseTo(1); expect(s[1]!).toBeLessThan(0.4); expect(s[2]).toBeNull();
  });
  it("үлес: жарты ұяшық", () => {
    expect(cellFraction([0, 0, 1, 1], toPolys([[[0, 0], [0.5, 0], [0.5, 1], [0, 1]]]))).toBeCloseTo(0.5);
  });
  it("NDVI кодтау: 0 = дерек жоқ", () => {
    expect(decodeNdvi(0)).toBeNull(); expect(decodeNdvi(1)).toBeCloseTo(-1); expect(decodeNdvi(255)).toBeCloseTo(1);
  });
  it("PNG декодер (filter 0 және 2)", () => {
    const w = 3, h = 2;
    const raw = Buffer.from([0, 10, 20, 30, 2, 1, 1, 1]); // 2-жол: Up фильтрі → 11 21 31
    const chunk = (type: string, data: Buffer) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      return Buffer.concat([len, Buffer.from(type), data, Buffer.alloc(4)]);
    };
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
    const img = decodeGrayPng(new Uint8Array(png));
    expect([...img.data]).toEqual([10, 20, 30, 11, 21, 31]);
  });
});
