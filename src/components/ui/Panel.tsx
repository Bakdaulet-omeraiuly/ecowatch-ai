import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("min-w-0 rounded-md border border-neutral-300 bg-white text-neutral-900", className)} {...props} />;
}

export function PanelHeader({ title, description, actions, className }: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex shrink-0 items-start gap-2 border-b border-neutral-200 p-4", className)}>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold leading-snug text-brand">{title}</h2>
        {description && <div className="mt-1 text-sm leading-relaxed text-neutral-600">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  );
}
