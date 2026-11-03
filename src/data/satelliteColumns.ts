// Sentinel-5P спутник бағаны — МЕТАДЕРЕК (карта қабаты мен «Ауа» панелі үшін).
//
// ЕРЕЖЕ: спутник бағаны — баған (mol/m²) немесе ppb, жерүсті концентрациясы емес.
// Концентрация бірлігі (микрограмм/текше метр) осы файлда жоқ — satelliteColumns.test.ts тексереді.
// Бұл файлда сандар ЖОҚ — растр тайлдарында сан жоқ, тек метадерек.
//
// Дереккөз: src/app/api/s5p/[gas]/[z]/[x]/[y]/route.ts (7 күн, кешегіге дейін; minQa 50 = qa ≥ 0.5).

import type { Unit } from "@/lib/airReading";

export type SatGas = "no2" | "so2" | "co" | "ch4" | "aod";

/** Нативті бірлік: NO₂/SO₂/CO — mol/m² (баған); CH₄ — ppb; AOD — өлшемсіз индекс (null) */
export const SAT_COLUMN_META: Record<SatGas, { unit: Extract<Unit, "mol/m²" | "ppb"> | null; label: string }> = {
  no2: { unit: "mol/m²", label: "NO₂" },
  so2: { unit: "mol/m²", label: "SO₂" },
  co: { unit: "mol/m²", label: "CO" },
  ch4: { unit: "ppb", label: "CH₄" },
  aod: { unit: null, label: "AOD" },
};

/** Барлық S5P қабаттарына ортақ метадерек. Мәтіндер — i18n кілттері (air.*). */
export const SAT_COMMON = {
  sourceName: "Copernicus Sentinel-5P TROPOMI (Sentinel Hub Process API)",
  sourceUrl: "https://dataspace.copernicus.eu",
  /** Уақыт терезесі: соңғы 7 күн, кешегіге дейін */
  windowKey: "air.time.sat",
  /** Жиілік: тәуліктік (өту бойынша) */
  cadenceKey: "air.freq.sat",
  /** Сапа: qa ≥ 0.5 (картадағы қабат) */
  qualityKey: "air.q.sat",
  /** Белгісіздік: бағаланбаған */
  uncertaintyKey: "air.u.notEst",
} as const;

/** Кілт спутник бағаны метадерегінде бар ма (no2/so2/co/ch4/aod). MODIS snow — жоқ. */
export function isSatColumnKey(key: string): key is SatGas {
  return Object.prototype.hasOwnProperty.call(SAT_COLUMN_META, key);
}

/**
 * Атмосфера қабаты үшін спутник бағаны метадерегін көрсету керек пе — тек Sentinel-5P қабаттары.
 * GIBS қабаттары (соның ішінде резервтік no2/so2, OMI) S5P метадерегін ЕШҚАШАН алмайды.
 */
export function satNoteGasFor(layer: { key: string; source: string }): SatGas | null {
  if (layer.source !== "sentinel5p") return null;
  return isSatColumnKey(layer.key) ? layer.key : null;
}
