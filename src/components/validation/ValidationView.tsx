"use client";

import { useLang } from "@/lib/i18n";
import {
  NOT_YET_VALIDATED,
  REPO_BLOB,
  summarize,
  type CheckStatus,
  type ValidationCheck,
  type ValidationMetric,
} from "@/lib/validationResults";

// Валидация беті: әр модуль мен әр газ ЖЕКЕ тармақ. Нәтиже — results.json-дан,
// шек — протоколдан (validationResults.ts). Жоқ мән «0%» емес, «—» болып көрінеді.
// Мәтін түсі — neutral-700/800/900; күй белгісі әрқашан жазумен (түс жалғыз белгі емес).

const STATUS_STYLE: Record<CheckStatus, string> = {
  passed: "border-emerald-700 bg-emerald-50 text-emerald-900",
  failed: "border-red-700 bg-red-50 text-red-900",
  descriptive: "border-neutral-500 bg-neutral-100 text-neutral-900",
  "not-comparable": "border-neutral-500 bg-white text-neutral-900",
};

const STATUS_KEY: Record<CheckStatus, string> = {
  passed: "val.status.passed",
  failed: "val.status.failed",
  descriptive: "val.status.desc",
  "not-comparable": "val.status.nc",
};

function ResultMark({ pass, level }: { pass: boolean | null; level?: string }) {
  const { t } = useLang();
  const tk = (k: string) => t(k as never);
  if (pass === null) return <span className="text-neutral-800">{tk("val.status.desc")}</span>;
  // Критерийден өтті, мақсатқа жетпеді — «өтті» деп жазбаймыз
  if (pass && level === "criteria") return <span className="font-bold text-neutral-900">{tk("val.status.criteria")}</span>;
  return pass ? (
    <span className="font-bold text-emerald-900">{tk("val.status.passed")}</span>
  ) : (
    <span className="font-bold text-red-900">{tk("val.status.failed")}</span>
  );
}

function MetricsTable({ title, metrics }: { title: string; metrics: ValidationMetric[] }) {
  const { t } = useLang();
  const tk = (k: string) => t(k as never);
  return (
    <div className="mt-4 w-full overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="border-b border-neutral-300 text-neutral-800">
            <th scope="col" className="py-2 pr-3 font-bold">{tk("val.col.metric")}</th>
            <th scope="col" className="py-2 pr-3 font-bold">{tk("val.col.value")}</th>
            <th scope="col" className="py-2 pr-3 font-bold">{tk("val.col.threshold")}</th>
            <th scope="col" className="py-2 font-bold">{tk("val.col.result")}</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((m) => (
            <tr key={m.label} className="border-b border-neutral-200 align-top">
              <th scope="row" className="py-2 pr-3 font-normal text-neutral-900">
                {m.label.startsWith("val.") ? tk(m.label) : m.label}
              </th>
              <td className="py-2 pr-3 tabular-nums text-neutral-900">{m.value}</td>
              <td className="py-2 pr-3 text-neutral-800">{m.thresholdKey ? tk(m.thresholdKey) : (m.threshold ?? "—")}</td>
              <td className="py-2">
                <ResultMark pass={m.pass} level={m.level} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusChip({ status }: { status: CheckStatus }) {
  const { t } = useLang();
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>
      {t(STATUS_KEY[status] as never)}
    </span>
  );
}

function CheckCard({ check: c }: { check: ValidationCheck }) {
  const { t } = useLang();
  const tk = (k: string) => t(k as never);
  const headingId = `${c.id}-title`;
  return (
    <article aria-labelledby={headingId} className="w-full rounded-md border border-neutral-300 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={headingId} className="text-lg font-bold text-neutral-900">
          {c.pollutant ? `${c.pollutant} · ` : ""}
          {tk(c.titleKey)}
        </h2>
        <StatusChip status={c.status} />
      </header>

      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm text-neutral-800">
        {c.methodKey && (
          <>
            <dt className="font-bold">{tk("val.lbl.method")}</dt>
            <dd>{tk(c.methodKey)}</dd>
          </>
        )}
        {c.referenceKey && (
          <>
            <dt className="font-bold">{tk("val.lbl.ref")}</dt>
            <dd>{tk(c.referenceKey)}</dd>
          </>
        )}
        <dt className="font-bold">{tk("val.lbl.period")}</dt>
        <dd className="tabular-nums">{c.period}</dd>
      </dl>

      <MetricsTable title={tk(c.titleKey)} metrics={c.metrics} />

      {c.children?.map((ch) => (
        <section key={ch.id} aria-labelledby={`${ch.id}-title`} className="mt-5 border-t border-neutral-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id={`${ch.id}-title`} className="font-bold text-neutral-900">{tk(ch.titleKey)}</h3>
            <StatusChip status={ch.status} />
          </div>
          <MetricsTable title={tk(ch.titleKey)} metrics={ch.metrics} />
        </section>
      ))}

      {c.noteKeys.map((k) => (
        <p key={k} className="mt-3 text-sm font-bold text-neutral-900">{tk(k)}</p>
      ))}

      {c.knownErrorKeys.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-neutral-900">{tk("val.sec.errors")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {c.knownErrorKeys.map((k) => (
              <li key={k}>{tk(k)}</li>
            ))}
          </ul>
        </div>
      )}

      {c.gapKeys.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-bold text-neutral-900">{tk("val.sec.gaps")}</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-neutral-800">
            {c.gapKeys.map((k) => (
              <li key={k}>{tk(k)}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-sm text-neutral-800">
        <a
          href={`${REPO_BLOB}/${c.protocolPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-[#0b3a6b]"
        >
          {tk("val.link.protocol")}
          <span className="sr-only"> ({tk("foot.newTab")})</span>
        </a>
        {" · "}
        <a
          href={`${REPO_BLOB}/${c.resultsPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-[#0b3a6b]"
        >
          {tk("val.link.results")}
          <span className="sr-only"> ({tk("foot.newTab")})</span>
        </a>
        {" · "}
        <span>
          {c.protocol}, {tk("val.generated")} {c.generatedAt.slice(0, 10)}
        </span>
      </p>
    </article>
  );
}

export function ValidationView({ checks }: { checks: ValidationCheck[] }) {
  const { t } = useLang();
  const tk = (k: string) => t(k as never);
  const s = summarize(checks);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 text-neutral-900 sm:py-10">
      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold leading-tight text-[#0b3a6b] sm:text-4xl">{tk("val.title")}</h1>
        <p className="mt-3 text-base text-neutral-700 sm:text-lg">{tk("val.intro")}</p>
        <p className="mt-4 text-sm font-bold text-neutral-900">
          {tk("val.sum.label")}: {s.total} — {s.passed} {tk("val.sum.passed")} · {s.failed} {tk("val.sum.failed")} ·{" "}
          {s.descriptive} {tk("val.sum.desc")} · {s.notComparable} {tk("val.sum.nc")}
        </p>
      </header>

      <div className="mt-8 space-y-6">
        {checks.map((c) => (
          <CheckCard key={c.id} check={c} />
        ))}
      </div>

      <section aria-labelledby="nv-title" className="mt-12 border-t border-neutral-300 pt-8">
        <h2 id="nv-title" className="text-xl font-bold text-neutral-900">{tk("val.nv.title")}</h2>
        <p className="mt-2 text-sm text-neutral-700">{tk("val.nv.intro")}</p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {NOT_YET_VALIDATED.map((m) => (
            <li key={m.name} className="rounded-md border border-neutral-300 bg-white p-4">
              <p className="font-bold text-neutral-900">{tk(m.name)}</p>
              <p className="mt-1 text-sm text-neutral-800">
                {tk("val.nv.reference")}: {tk(m.reference)}
              </p>
              <p className="mt-1 text-sm text-neutral-800">{tk("val.nv.planned")}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
