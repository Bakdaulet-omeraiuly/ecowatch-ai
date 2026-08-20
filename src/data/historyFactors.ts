// Historical intensity factors per ecology layer (1.0 = 2026 level).
// Seeded realistic trajectory: oil extraction grew sharply after Tengiz
// expansion, waste grew with urbanization, mosquito risk follows flood cycles.

export type LayerKey = "mosquito" | "air" | "soil" | "oil" | "waste" | "water" | "fire" | "drought" | "wind";

export const YEARS = [1995, 2000, 2005, 2010, 2015, 2020, 2026] as const;

export const historyFactors: Record<LayerKey, number[]> = {
  //        1995  2000  2005  2010  2015  2020  2026
  oil:      [0.35, 0.45, 0.60, 0.72, 0.85, 0.95, 1.0],
  air:      [0.40, 0.48, 0.60, 0.70, 0.82, 0.93, 1.0],
  soil:     [0.30, 0.40, 0.52, 0.65, 0.80, 0.92, 1.0],
  waste:    [0.25, 0.35, 0.50, 0.65, 0.82, 0.95, 1.0],
  water:    [0.50, 0.55, 0.62, 0.72, 0.85, 0.94, 1.0],
  mosquito: [0.70, 0.65, 0.80, 0.75, 0.90, 0.95, 1.0], // flood-cycle driven
  fire:     [0.55, 0.58, 0.65, 0.72, 0.82, 0.92, 1.0], // жылыну → құрғақшылық өсімі
  drought:  [0.50, 0.55, 0.60, 0.70, 0.80, 0.90, 1.0], // климаттық құрғау тренді
  wind:     [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], // метеорологиялық (тарихсыз)
};

export function factorFor(layer: LayerKey, year: number): number {
  const idx = YEARS.findIndex((y) => y >= year);
  return historyFactors[layer][idx === -1 ? YEARS.length - 1 : idx];
}

export interface LayerDef {
  key: LayerKey;
  label: string;
  emoji: string;
  // rgba ramp stops for the heatmap (low → high density)
  ramp: [string, string, string, string];
  activeCls: string;
}

export const LAYERS: LayerDef[] = [
  {
    key: "mosquito", label: "Маса", emoji: "🦟",
    ramp: ["rgba(124,58,237,0.35)", "rgba(168,85,247,0.6)", "rgba(217,70,239,0.8)", "rgba(232,121,249,0.95)"],
    activeCls: "border-violet-500/50 bg-violet-500/20 text-violet-200",
  },
  {
    key: "air", label: "Ауа", emoji: "💨",
    ramp: ["rgba(56,189,248,0.3)", "rgba(14,165,233,0.55)", "rgba(2,132,199,0.75)", "rgba(125,211,252,0.95)"],
    activeCls: "border-sky-500/50 bg-sky-500/20 text-sky-200",
  },
  {
    key: "soil", label: "Топырақ", emoji: "🏜",
    ramp: ["rgba(202,138,4,0.3)", "rgba(234,179,8,0.55)", "rgba(250,204,21,0.75)", "rgba(254,240,138,0.95)"],
    activeCls: "border-amber-500/50 bg-amber-500/20 text-amber-200",
  },
  {
    key: "oil", label: "Мұнай", emoji: "🛢",
    ramp: ["rgba(64,64,64,0.4)", "rgba(82,82,82,0.65)", "rgba(115,115,115,0.85)", "rgba(212,212,212,0.95)"],
    activeCls: "border-neutral-400/50 bg-neutral-500/20 text-neutral-200",
  },
  {
    key: "waste", label: "Қоқыс", emoji: "🗑",
    ramp: ["rgba(234,88,12,0.3)", "rgba(249,115,22,0.55)", "rgba(251,146,60,0.78)", "rgba(254,215,170,0.95)"],
    activeCls: "border-orange-500/50 bg-orange-500/20 text-orange-200",
  },
  {
    key: "water", label: "Су", emoji: "💧",
    ramp: ["rgba(13,148,136,0.3)", "rgba(20,184,166,0.55)", "rgba(45,212,191,0.78)", "rgba(153,246,228,0.95)"],
    activeCls: "border-emerald-500/50 bg-emerald-500/20 text-emerald-200",
  },
  {
    key: "fire", label: "Өрт", emoji: "🔥",
    ramp: ["rgba(220,38,38,0.3)", "rgba(239,68,68,0.55)", "rgba(249,115,22,0.78)", "rgba(254,215,170,0.95)"],
    activeCls: "border-red-500/50 bg-red-500/20 text-red-200",
  },
  {
    key: "drought", label: "Құрғақшылық", emoji: "🌵",
    ramp: ["rgba(180,83,9,0.3)", "rgba(217,119,6,0.55)", "rgba(245,158,11,0.78)", "rgba(253,230,138,0.95)"],
    activeCls: "border-amber-500/50 bg-amber-500/20 text-amber-200",
  },
  {
    key: "wind", label: "Жел", emoji: "🌬",
    ramp: ["rgba(8,145,178,0.3)", "rgba(6,182,212,0.55)", "rgba(34,211,238,0.78)", "rgba(165,243,252,0.95)"],
    activeCls: "border-sky-500/50 bg-sky-500/20 text-sky-200",
  },
];
