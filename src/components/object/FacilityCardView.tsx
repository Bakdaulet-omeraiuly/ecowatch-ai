"use client";

import { useLang } from "@/lib/i18n";
import { DEREK_JOQ, type FacilityCard } from "@/lib/facilityCard";

// НЫСАН КАРТОЧКАСЫ — P2.1 / P2.5 (SPEC §2).
// Бір компонент: /object/[id] беті (толық) және картадағы popup (ықшам).
// Өрістер жоқ болса — «Дерек жоқ». Көздер саны мен масса БӨЛЕК жолдар.
// P2.5: «ықтимал көз, дәлелденбеген» — бағалау, дәлел емес.

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-neutral-400">{k}</dt>
      <dd className="text-neutral-200">{children}</dd>
    </>
  );
}

export function FacilityCardView({ card, compact = false }: { card: FacilityCard; compact?: boolean }) {
  const { tr } = useLang();
  const dash = (
    <span className="text-neutral-500">{tr(DEREK_JOQ)}</span>
  );
  const cite = (c: { source: string; date: string }) => (
    <span className="text-[12px] text-neutral-400">
      {tr("Дереккөз")}: {c.source} · {tr("күні")}: {c.date}
    </span>
  );

  return (
    <div className={compact ? "space-y-1 text-[12px]" : "space-y-3 text-[13px]"}>
      <p className="rounded bg-amber-500/10 px-2 py-1 text-[12px] text-amber-200">
        {tr("Ықтимал көз, дәлелденбеген. Жел мен ауа сапасы бойынша бағалау — дәлел емес.")}
      </p>

      <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]">
        <Row k={tr("Атауы")}>{card.name}</Row>
        <Row k={tr("Өндіріс түрі")}>{card.productionType.value ?? dash}</Row>
        <Row k={tr("Координата")}>
          {card.coords.lat.toFixed(4)}, {card.coords.lng.toFixed(4)}{" "}
          <span className="text-[12px] text-neutral-400">· {tr(card.coords.precision.value ?? "")}</span>
        </Row>
        <Row k={tr("Координата дереккөзі")}>{card.coords.source.value ?? dash}</Row>
        <Row k={tr("Шығарынды көздерінің саны")}>
          {card.emissionSources.value ? (
            <>
              {card.emissionSources.value.count} {tr("дана")} · {cite(card.emissionSources.value)}
            </>
          ) : dash}
        </Row>
        <Row k={tr("Шығарынды массасы")}>
          {card.emissionMass.value ? (
            <>
              {card.emissionMass.value.value} {card.emissionMass.value.unit} · {tr("кезең")}: {card.emissionMass.value.period} · {cite(card.emissionMass.value)}
            </>
          ) : dash}
        </Row>
      </dl>

      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">{tr("Заттар")}</div>
        {card.substances.length === 0 ? (
          <p className="text-neutral-500">{tr(DEREK_JOQ)}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {card.substances.map((s, i) => (
              <li key={i}>
                {s.name}: {s.amount} {s.unit} · {tr("кезең")}: {s.period} · {cite(s)}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">{tr("Мониторинг бекеттері")}</div>
        {card.monitoringPosts.length === 0 ? (
          <p className="text-neutral-500">{tr(DEREK_JOQ)}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {card.monitoringPosts.map((m, i) => <li key={i}>{m.name} · {cite(m)}</li>)}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-400">{tr("Тексерілген оқиғалар")}</div>
        {card.verifiedEvents.length === 0 ? (
          <p className="text-neutral-500">{tr(DEREK_JOQ)}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {card.verifiedEvents.map((e, i) => <li key={i}>{e.description} · {cite(e)}</li>)}
          </ul>
        )}
      </div>

      <p className="text-[12px] text-neutral-400">
        {tr("Дереккөз және күн")}: {card.source.value ?? tr(DEREK_JOQ)} · {card.sourceDate.value ?? tr(DEREK_JOQ)}
      </p>
    </div>
  );
}
