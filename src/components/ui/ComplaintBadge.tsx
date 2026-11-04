"use client";

import { useLang } from "@/lib/i18n";
import type { ComplaintStatus } from "@/lib/complaints";
import { cn } from "@/lib/utils";

const statusClasses: Record<ComplaintStatus, string> = {
  submitted: "border-neutral-300 bg-neutral-50 text-neutral-800",
  in_review: "border-blue-300 bg-blue-50 text-blue-900",
  confirmed: "border-amber-300 bg-amber-50 text-amber-900",
  not_confirmed: "border-neutral-400 bg-neutral-100 text-neutral-800",
  resolved: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

export function ComplaintBadge() {
  const { t } = useLang();
  return <span title={t("complaints.explanation")} className="inline-flex w-fit rounded border border-dashed border-neutral-400 px-2 py-1 text-xs text-neutral-700">{t("complaints.badge")}</span>;
}

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const { t } = useLang();
  return <span className={cn("inline-flex w-fit rounded border px-2 py-1 text-sm font-medium", statusClasses[status])}>{t(`complaints.status.${status}`)}</span>;
}
