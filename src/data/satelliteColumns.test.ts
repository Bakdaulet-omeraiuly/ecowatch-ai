import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SAT_COLUMN_META, isSatColumnKey, satNoteGasFor } from "./satelliteColumns";
import { ATMOS_LAYERS } from "./gibsLayers";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SatColumnNote } from "@/components/air/SatColumnNote";

describe("спутник бағаны: бірліктер", () => {
  it("µg/m³ / мкг/м³ / g/m немесе μ жоқ", () => {
    for (const [gas, meta] of Object.entries(SAT_COLUMN_META)) {
      const unit = meta.unit ?? "";
      expect(unit, gas).not.toMatch(/g\/m|µ|μ|мкг/);
    }
  });
  it("NO₂ / SO₂ / CO — mol/m², CH₄ — ppb, AOD — бірліксіз", () => {
    expect(SAT_COLUMN_META.no2.unit).toBe("mol/m²");
    expect(SAT_COLUMN_META.so2.unit).toBe("mol/m²");
    expect(SAT_COLUMN_META.co.unit).toBe("mol/m²");
    expect(SAT_COLUMN_META.ch4.unit).toBe("ppb");
    expect(SAT_COLUMN_META.aod.unit).toBeNull();
  });
  it("спутник қабатының файлдарында µg/m³ жоқ", () => {
    const files = [
      "src/data/satelliteColumns.ts",
      "src/data/gibsLayers.ts",
      "src/app/api/s5p/[gas]/[z]/[x]/[y]/route.ts",
    ];
    for (const f of files) {
      const text = fs.readFileSync(path.join(process.cwd(), f), "utf-8");
      expect(text, f).not.toMatch(/µg\/m³|μg\/m³|мкг\/м³|ug\/m3/);
    }
  });
});

describe("атмосфера қабаттары ↔ спутник бағаны метадерегі", () => {
  it("әр Sentinel-5P қабатының метадерегі бар", () => {
    const s5p = ATMOS_LAYERS.filter((l) => l.source === "sentinel5p");
    expect(s5p.length).toBeGreaterThan(0);
    for (const l of s5p) {
      expect(isSatColumnKey(l.key), l.key).toBe(true);
      expect(satNoteGasFor(l), l.key).toBe(l.key);
    }
  });
  it("S5P емес қабаттар (MODIS snow және GIBS) метадерек алмайды", () => {
    const others = ATMOS_LAYERS.filter((l) => l.source !== "sentinel5p");
    expect(others.map((l) => l.key)).toContain("snow");
    for (const l of others) expect(satNoteGasFor(l), l.key).toBeNull();
    // GIBS резервіндегі no2 (OMI) — кілті бірдей, бірақ S5P емес
    expect(satNoteGasFor({ key: "no2", source: "gibs" })).toBeNull();
    expect(isSatColumnKey("snow")).toBe(false);
  });
  it("MODIS snow үшін SatColumnNote жұмыс істейді: бос шығыс, қате жоқ", () => {
    // Бұрын: SAT_COLUMN_META['snow'] = undefined → meta.unit TypeError (/map крашы)
    expect(renderToStaticMarkup(createElement(SatColumnNote, { gas: "snow" }))).toBe("");
    expect(renderToStaticMarkup(createElement(SatColumnNote, { gas: "no2" }))).toContain("mol/m²");
  });
});
