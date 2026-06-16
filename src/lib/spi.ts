// Standardized Precipitation Index (SPI) — McKee 1993, ДДСҰ/WMO құрғақшылық эталоны.
// Тарихи жауын-шашынға гамма-үлестірім сәйкестендіріліп, ағымдағы кезең
// стандартты қалыпты шкалаға (z-балл) аударылады. Барлығы нақты деректен.

// ── Гамма функциясының логарифмі (Lanczos жуықтауы) ──────────────────────
const G = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012,
  9.9843695780195716e-6, 1.5056327351493116e-7,
];
function gammaln(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - gammaln(1 - x);
  }
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < G.length; i++) a += G[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// ── Төменгі толымсыз гамма P(a,x) (Numerical Recipes: серия + үздіксіз бөлшек)
function lowerGammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  if (x < a + 1) {
    // Серия
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 200; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  } else {
    // Үздіксіз бөлшек (Q арқылы)
    const tiny = 1e-30;
    let b = x + 1 - a;
    let c = 1 / tiny;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 200; i++) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < tiny) d = tiny;
      c = b + an / c;
      if (Math.abs(c) < tiny) c = tiny;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    const Q = Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
    return 1 - Q;
  }
}

// ── Стандартты қалыпты үлестірімнің кері CDF (Acklam алгоритмі) ──────────
function inverseNormalCDF(p: number): number {
  if (p <= 0) return -3.5;
  if (p >= 1) return 3.5;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  return Math.max(-3.5, Math.min(3.5, x));
}

// ── Гамма параметрлерін бағалау (Thom 1966 максималды ұқсастық жуықтауы) ──
function fitGamma(positive: number[]): { alpha: number; beta: number } | null {
  const n = positive.length;
  if (n < 3) return null;
  const mean = positive.reduce((a, b) => a + b, 0) / n;
  if (mean <= 0) return null;
  const meanLn = positive.reduce((a, b) => a + Math.log(b), 0) / n;
  const A = Math.log(mean) - meanLn;
  if (A <= 0) return { alpha: 1, beta: mean };
  const alpha = (1 + Math.sqrt(1 + (4 * A) / 3)) / (4 * A);
  const beta = mean / alpha;
  return { alpha, beta };
}

/**
 * SPI: тарихи мәндер тізбегінен (бір күнтізбелік ай/кезеңнің әртүрлі жылдары)
 * гамма үлестірімін сәйкестендіріп, ағымдағы мәннің SPI z-баллын қайтарады.
 */
export function computeSPI(history: number[], current: number): number | null {
  if (history.length < 10) return null;
  const zeros = history.filter((v) => v <= 0).length;
  const positive = history.filter((v) => v > 0);
  const q = zeros / history.length; // нөлдік (құрғақ) кезеңдер үлесі

  const fit = fitGamma(positive);
  if (!fit) return null;

  const gammaCdf = (x: number) =>
    x <= 0 ? 0 : lowerGammaP(fit.alpha, x / fit.beta);

  // Аралас үлестірім: H(x) = q + (1-q)·G(x)
  const H = q + (1 - q) * gammaCdf(current);
  const Hc = Math.min(0.9999, Math.max(0.0001, H));
  return +inverseNormalCDF(Hc).toFixed(2);
}

// ── SPI сыныптары (McKee 1993) ──────────────────────────────────────────
export type DroughtClass =
  | "extreme_wet" | "severe_wet" | "moderate_wet" | "normal"
  | "moderate_dry" | "severe_dry" | "extreme_dry";

export function droughtClass(spi: number): DroughtClass {
  if (spi >= 2.0) return "extreme_wet";
  if (spi >= 1.5) return "severe_wet";
  if (spi >= 1.0) return "moderate_wet";
  if (spi > -1.0) return "normal";
  if (spi > -1.5) return "moderate_dry";
  if (spi > -2.0) return "severe_dry";
  return "extreme_dry";
}

export const DROUGHT_KZ: Record<DroughtClass, string> = {
  extreme_wet: "Аса ылғалды",
  severe_wet: "Қатты ылғалды",
  moderate_wet: "Ылғалды",
  normal: "Қалыпты",
  moderate_dry: "Орташа құрғақшылық",
  severe_dry: "Қатты құрғақшылық",
  extreme_dry: "Апатты құрғақшылық",
};

export const DROUGHT_COLOR: Record<DroughtClass, string> = {
  extreme_wet: "#1d4ed8",
  severe_wet: "#3b82f6",
  moderate_wet: "#60a5fa",
  normal: "#22c55e",
  moderate_dry: "#eab308",
  severe_dry: "#f97316",
  extreme_dry: "#dc2626",
};
