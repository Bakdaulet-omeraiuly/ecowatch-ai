// Орташалау терезесі (ARCHITECTURE/IMPLEMENTATION Г.2, P1.2).
//
// Тәуліктік/8 сағаттық орта мәнді сағаттық қатардан құрудың таза функциясы.
// ЕСКЕРТУ: тәуліктік орта үшін МИНИМАЛДЫ сағат саны — иесінің шешімі (Е бөлімі).
// Сондықтан шек мұнда аргумент ретінде беріледі, ойдан бекітілмейді.

export interface WindowMean {
  /** Орта мән; терезе жеткіліксіз болса null (нөлмен толтырылмайды) */
  mean: number | null;
  /** Терезедегі жарамды сағат саны */
  count: number;
  /** Жарамды сағат саны минималды шектен кем емес пе */
  sufficient: boolean;
}

export function windowMean(
  values: ReadonlyArray<number | null | undefined>,
  minCount: number
): WindowMean {
  const valid = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const count = valid.length;
  if (count === 0 || count < minCount) {
    return { mean: null, count, sufficient: false };
  }
  const sum = valid.reduce((a, b) => a + b, 0);
  return { mean: sum / count, count, sufficient: true };
}
