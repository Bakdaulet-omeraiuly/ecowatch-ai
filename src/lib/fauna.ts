// P5.4 / P5.5 — protected areas and fauna observations.
// Fauna = GBIF occurrence RECORDS (observations, museum/survey data), never population
// estimates and never derived from satellites. Sensitive species locations are generalised.

export const GBIF_API = "https://api.gbif.org/v1";
/** Ural (Жайық) delta + Ақжайық reserve + Atyrau — WKT, counter-clockwise. */
export const FAUNA_WKT = "POLYGON((51.3 46.6,52.3 46.6,52.3 47.4,51.3 47.4,51.3 46.6))";

// GBIF class keys verified via api.gbif.org/v1/species/<key> (2026-11-04).
export const CLASS_LABEL: Record<string, string> = {
  "212": "Құстар", "204": "Сәулеқанатты балықтар", "359": "Сүтқоректілер", "11592253": "Қабыршақтылар (кесірткелер, жыландар)",
  "131": "Қосмекенділер", "216": "Жәндіктер", "367": "Өрмекшітәрізділер",
};
/** Animal classes shown on the fauna layer (plants and fungi are excluded). */
export const FAUNA_CLASSES = ["212", "204", "359", "11592253", "131", "216", "367"];

/** IUCN categories whose exact locations are hidden (poaching / disturbance risk). */
export const SENSITIVE_IUCN = new Set(["CR", "EN", "VU", "NT"]);

/** Grid step in degrees: ~10 km for sensitive species, ~1 km otherwise. */
export function generaliseStep(iucn: string | null | undefined): number {
  return iucn && SENSITIVE_IUCN.has(iucn) ? 0.1 : 0.01;
}

/** Snaps a point to the centre of its grid cell, so the original location is not recoverable. */
export function generalise(lat: number, lng: number, iucn: string | null | undefined): { lat: number; lng: number; precisionKm: number } {
  const step = generaliseStep(iucn);
  const snap = (v: number) => +(Math.floor(v / step) * step + step / 2).toFixed(4);
  return { lat: snap(lat), lng: snap(lng), precisionKm: step === 0.1 ? 10 : 1 };
}

export interface FaunaPoint { lat: number; lng: number; precisionKm: number; species: string; classKey: string; month: number | null; year: number | null; iucn: string | null }

interface GbifOcc {
  decimalLatitude?: number; decimalLongitude?: number; species?: string; scientificName?: string;
  classKey?: number; month?: number; year?: number; iucnRedListCategory?: string;
}

export function toPoints(results: GbifOcc[]): FaunaPoint[] {
  const out: FaunaPoint[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (!Number.isFinite(r.decimalLatitude) || !Number.isFinite(r.decimalLongitude) || r.classKey == null) continue;
    const g = generalise(r.decimalLatitude!, r.decimalLongitude!, r.iucnRedListCategory);
    const species = r.species ?? r.scientificName ?? "?";
    const key = `${species}|${g.lat}|${g.lng}`; // one dot per species per cell
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...g, species, classKey: String(r.classKey), month: r.month ?? null, year: r.year ?? null, iucn: r.iucnRedListCategory ?? null });
  }
  return out;
}

export const FAUNA_CAVEATS = [
  "GBIF — бақылау және жинақ жазбалары; популяция саны ЕМЕС. Жазба көп жер — бақылаушы көп жер болуы мүмкін.",
  "Сирек және жойылу қаупі бар түрлердің (IUCN: CR, EN, VU, NT) орны ~10 км торға дейін жалпыланған; қалғаны ~1 км.",
  "Жануарлардың расталған қырылу оқиғалары бойынша ашық машинаоқылатын ресми тізілім табылмады — дерек жоқ.",
  "Спутниктен популяция есептелмейді.",
];
