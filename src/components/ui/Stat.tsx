import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Stat({ label, value, note, className }: {
  label: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 rounded border border-neutral-200 bg-neutral-50 p-3", className)}>
      <div className="text-2xl font-bold tabular-nums text-brand">{value}</div>
      <div className="mt-1 text-xs leading-snug text-neutral-600">{label}</div>
      {note && <div className="mt-1 text-xs text-neutral-600">{note}</div>}
    </div>
  );
}
