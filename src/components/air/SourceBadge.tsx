import { Fragment, type ReactNode } from "react";

// Дерек түрінің белгісі + алты өрісті метадерек тізімі. Түс жалғыз белгі емес:
// әр белгіде мәтін бар. Бірнеше жерде қолданылады (басты бет, /map, /dashboard).

export const BADGE = {
  ground: "border-emerald-800 bg-emerald-50 text-emerald-900",
  model: "border-sky-800 bg-sky-50 text-sky-900",
  satellite: "border-violet-800 bg-violet-50 text-violet-900",
  none: "border-neutral-500 bg-white text-neutral-900",
} as const;

export type BadgeKind = keyof typeof BADGE;

export function Badge({ kind, children }: { kind: BadgeKind; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${BADGE[kind]}`}>
      {children}
    </span>
  );
}

const LOCALE: Record<string, string> = { kk: "kk-KZ", ru: "ru-RU", en: "en-GB" };

/** ISO уақыт → Атырау уақыты (UTC-ден айналдырылады) */
export function fmtAtyrau(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(LOCALE[lang] ?? "kk-KZ", {
    timeZone: "Asia/Atyrau",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Метадерек жолдары: label → мән. tone=dark — қараңғы панель, light — ақ карта. */
export function MetaList({
  rows,
  tone = "light",
}: {
  rows: { k: string; v: ReactNode }[];
  tone?: "light" | "dark";
}) {
  const kc = tone === "dark" ? "text-neutral-400" : "font-bold text-neutral-900";
  const vc = tone === "dark" ? "text-neutral-200" : "text-neutral-800";
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
      {rows.map((r) => (
        <Fragment key={r.k}>
          <dt className={kc}>{r.k}</dt>
          <dd className={vc}>{r.v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
