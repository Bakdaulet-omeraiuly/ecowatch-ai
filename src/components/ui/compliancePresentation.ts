import type { ComplianceLevel } from "@/lib/compliance";

// Presentation only; legal levels and their definitions remain in lib/compliance.
export const LEVEL_COLOR_LIGHT: Record<ComplianceLevel, string> = {
  ok: "text-emerald-900 border-emerald-700 bg-emerald-50",
  approaching: "text-amber-900 border-amber-700 bg-amber-50",
  exceeded: "text-red-900 border-red-700 bg-red-50",
  "exceeded-unverified": "text-orange-900 border-orange-700 bg-orange-50",
  "not-comparable": "text-neutral-800 border-neutral-400 bg-neutral-50",
  unknown: "text-neutral-700 border-neutral-400 bg-neutral-50",
};
