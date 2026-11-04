"use client";

/** Дереккөз 503 қайтарғанда — себебімен қызыл қорап (жалған дерек көрсетілмейді) */
export function SourceErrorBox({ title, err, tr }: {
  title: string;
  err: { error: string; reason?: string };
  tr: (s: string) => string;
}) {
  return (
    <div className="mb-2 rounded-md border border-red-500/40 bg-red-500/10 p-2 text-[12px] leading-snug text-red-200" role="status">
      <div>{title}: {tr(err.error)}</div>
      {err.reason && <div className="mt-1 text-red-300/80">{tr("Себебі")}: {tr(err.reason)}</div>}
      <div className="mt-1 text-neutral-400">{tr("Жалған дерек көрсетілмейді.")}</div>
    </div>
  );
}
