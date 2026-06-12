import type { RiskLevel } from "@/types/site";

export const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#f97316",
  critical: "#ef4444",
};

export const RISK_LABELS_KZ: Record<RiskLevel, string> = {
  low: "Төмен",
  medium: "Орташа",
  high: "Жоғары",
  critical: "Қауіпті",
};

export function scoreToLevel(score: number): RiskLevel {
  if (score >= 80) return "critical";
  if (score >= 55) return "high";
  if (score >= 30) return "medium";
  return "low";
}
