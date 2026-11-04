// ДЕТЕКЦИЯНЫ РАСТАУ (EMSA CleanSeaNet кері байланыс үлгісі).
// Спутник тапқан нысан қызметкер тексергенге дейін «тексерілмеген».
// SQL check-тері 20261105_map_tools.sql-мен бірдей (fieldJournal.test.ts).

export const REVIEW_LAYERS = ["fire", "oil", "no2", "waste"] as const;
export type ReviewLayer = typeof REVIEW_LAYERS[number];
export const VERDICTS = ["confirmed", "false_positive", "unverified"] as const;
export type Verdict = typeof VERDICTS[number];

export const VERDICT_LABEL: Record<Verdict, string> = {
  confirmed: "Расталды",
  false_positive: "Жалған дабыл",
  unverified: "Тексерілмеді",
};

/** FIRMS детекциясының тұрақты кілті (reedAnomalyKey-мен бірдей пішім) */
export function fireKey(d: { lat: number; lng: number; acqDate: string; dayNight?: string }): string {
  return `${d.lat.toFixed(4)}|${d.lng.toFixed(4)}|${d.acqDate}|${d.dayNight ?? ""}`;
}

export const KEY_RE = /^[\w.|:\-]{1,200}$/;
