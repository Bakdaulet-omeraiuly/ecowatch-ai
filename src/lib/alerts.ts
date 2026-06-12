import type { Alert, AlertStatus, Site } from "@/types/site";

export const ALERT_THRESHOLD = 55; // high & critical trigger an alert

// Route the alert to the right authority based on the dominant issue
export function pickRecipient(site: Site): { recipient: string; reason: string } {
  const a = site.analysis;
  if (a.oilPollution)
    return {
      recipient: "Атырау облысының экология департаменті",
      reason: "Мұнай ластануы анықталды — жедел далалық тексеру қажет",
    };
  if (a.illegalDumping)
    return {
      recipient: "Атырау қаласының әкімдігі (тұрмыстық қалдықтар бөлімі)",
      reason: "Заңсыз қоқыс орны анықталды — жою және айыппұл шаралары қажет",
    };
  if (a.standingWater && site.mosquitoRiskIndex >= 60)
    return {
      recipient: "Санитарлық-эпидемиологиялық қызмет (СЭС)",
      reason: "Маса көбею ошағы — дезинсекция өңдеуі қажет",
    };
  return {
    recipient: "Атырау облысының экология департаменті",
    reason: "Жоғары экологиялық тәуекел — мониторингке алу қажет",
  };
}

export function buildAlert(site: Site): Alert | null {
  if (site.analysis.riskScore < ALERT_THRESHOLD) return null;
  const { recipient, reason } = pickRecipient(site);
  return {
    id: `alert-${site.id}`,
    siteId: site.id,
    siteName: site.name ?? `Нүкте ${site.lat.toFixed(3)}, ${site.lng.toFixed(3)}`,
    lat: site.lat,
    lng: site.lng,
    riskScore: site.analysis.riskScore,
    riskLevel: site.analysis.riskLevel,
    recipient,
    reason,
    createdAt: site.createdAt,
    status: "sent",
  };
}

// Demo: status progresses with elapsed time since creation
export function liveStatus(alert: Alert): AlertStatus {
  if (alert.status === "resolved") return "resolved";
  const ageMin = (Date.now() - new Date(alert.createdAt).getTime()) / 60000;
  if (ageMin < 2) return "sent";
  if (ageMin < 10) return "acknowledged";
  return "inspecting";
}

export const STATUS_UI: Record<AlertStatus, { label: string; cls: string }> = {
  sent: { label: "Жіберілді", cls: "bg-sky-500/15 text-sky-300" },
  acknowledged: { label: "Қабылданды", cls: "bg-yellow-500/15 text-yellow-300" },
  inspecting: { label: "Тексеруде", cls: "bg-orange-500/15 text-orange-300" },
  resolved: { label: "Шешілді", cls: "bg-emerald-500/15 text-emerald-300" },
};
