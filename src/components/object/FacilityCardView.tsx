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
      <dt className="text-neutral-600">{k}</dt>
      <dd className="min-w-0 break-words text-neutral-800">{children}</dd>
    </>
  );
}

export function FacilityCardView({ card, compact = false }: { card: FacilityCard; compact?: boolean }) {
  const { tr } = useLang();
  const dash = (
    <span className="text-neutral-600">{tr(DEREK_JOQ)}</span>
  );
  const cite = (c: { source: string; date: string }) => (
    <span className="text-[12px] text-neutral-600">
      {tr("Дереккөз")}: {c.source} · {tr("күні")}: {c.date}
    </span>
  );

  return (
    <div className={compact ? "space-y-3 text-xs text-neutral-800" : "space-y-4 text-sm text-neutral-800"}>
      <p className="rounded bg-amber-50 px-2 py-1 text-[12px] text-amber-800">
        {tr("Ықтимал көз, дәлелденбеген. Жел мен ауа сапасы бойынша бағалау — дәлел емес.")}
      </p>

      <dl className="grid gap-x-4 gap-y-1 grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Row k={tr("Атауы")}>{card.name}</Row>
        <Row k={tr("Өндіріс түрі")}>{card.productionType.value ?? dash}</Row>
        <Row k={tr("Координата")}>
          {card.coords.lat.toFixed(4)}, {card.coords.lng.toFixed(4)}{" "}
          <span className="text-[12px] text-neutral-600">· {tr(card.coords.precision.value ?? "")}</span>
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
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-600">{tr("Заттар")}</div>
        {card.substances.length === 0 ? (
          <p className="text-neutral-600">{tr(DEREK_JOQ)}</p>
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

      {card.emissionLimits.length > 0 && (
        <div>
          <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-600">{tr("Рұқсат етілген шығарынды (лимит)")}</div>
          <p className="text-[12px] text-amber-800">{tr("Бұл — рұқсат етілген шек, нақты шығарынды ЕМЕС.")}</p>
          <ul className="mt-1 space-y-0.5">
            {card.emissionLimits.map((l, i) => {
              const actual = card.emissionMass.value && card.emissionMass.value.period === l.period ? card.emissionMass.value : null;
              return (
                <li key={i}>
                  <span className="tabular-nums">{l.period}: {l.value.toLocaleString("ru-RU")} {l.unit}</span>
                  {actual && (
                    <strong className="ml-1">
                      · {tr("нақты")} {actual.value.toLocaleString("ru-RU")} {actual.unit} = {Math.round((actual.value / l.value) * 100)}% {tr("лимиттің")}
                    </strong>
                  )}{" "}
                  · {cite(l)}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {card.substanceLimits.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-neutral-600">
            {tr("Зат бойынша рұқсат етілген шығарынды (лимит)")} · {card.substanceLimits[0].period}
          </summary>
          <ul className="mt-1 space-y-0.5 tabular-nums">
            {[...card.substanceLimits].sort((a, b) => b.amount - a.amount).map((s, i) => (
              <li key={i}>{tr(s.name)}: {s.amount.toLocaleString("ru-RU")} {s.unit}</li>
            ))}
          </ul>
          <p className="mt-1">{cite(card.substanceLimits[0])}</p>
        </details>
      )}

      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-600">{tr("Мониторинг бекеттері")}</div>
        {card.monitoringPosts.length === 0 ? (
          <p className="text-neutral-600">{tr(DEREK_JOQ)}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {card.monitoringPosts.map((m, i) => <li key={i}>{m.name} · {cite(m)}</li>)}
          </ul>
        )}
      </div>

      <div>
        <div className="text-[12px] font-semibold uppercase tracking-wider text-neutral-600">{tr("Тексерілген оқиғалар")}</div>
        {card.verifiedEvents.length === 0 ? (
          <p className="text-neutral-600">{tr(DEREK_JOQ)}</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {card.verifiedEvents.map((e, i) => <li key={i}>{e.description} · {cite(e)}</li>)}
          </ul>
        )}
      </div>

      <p className="text-[12px] text-neutral-600">
        {tr("Дереккөз және күн")}: {card.source.value ?? tr(DEREK_JOQ)} · {card.sourceDate.value ?? tr(DEREK_JOQ)}
      </p>
    </div>
  );
}
