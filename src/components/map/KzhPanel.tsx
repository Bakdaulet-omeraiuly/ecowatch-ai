"use client";

// «Ауа» қабатындағы жердегі өлшем блогы: Қазгидромет посттарының соңғы
// айлық өлшемі + CAMS-тың Атыраудағы дәлелденген ауытқуы.
//
// ⚠️ ТІРІ ЕМЕС: бюллетень ~1–1.5 ай кешігіп шығады — айы әрқашан жазылады.
// ⚠️ Тек Атырау аймағында (ARCHITECTURE 1.7: Атыраудың дерегі басқа қалаға
//    телінбейді). Басқа аймақта «жердегі өлшем қосылмаған» деп айтылады.
// Дереккөзі мен әдісі: validation/kazhydromet.

import type { AtmosElement } from "@/data/atmosElements";
import { KZH_CAMS_VALIDATION, KZH_PERIOD, latestKzh } from "@/data/kazhydrometAtyrau";
import { TierBadge } from "@/components/ui/TierBadge";
import { Panel } from "@/components/ui/Panel";
import { Stat } from "@/components/ui/Stat";
import { useLang } from "@/lib/i18n";

const fmt = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1));

export function KzhPanel({ elem, regionId }: { elem: AtmosElement; regionId: string }) {
  const { tr, t } = useLang();
  const noModelNote = elem.noModel && (
    <p className="mb-1.5 text-[12px] leading-snug text-amber-800">
      {tr("Бұл затты спутник те, CAMS моделі де ӨЛШЕМЕЙДІ — картада тор жоқ. «Дерек жоқ» ≠ «ауа таза».")}
    </p>
  );

  if (!elem.kzh || regionId !== "atyrau") {
    return (
      <Panel className="mt-4 p-4">
        {noModelNote}
        <p className="text-[12px] text-neutral-600">
          {tr("Бұл аймақ үшін жердегі пост өлшемі жүйеге әлі қосылмаған.")}
        </p>
      </Panel>
    );
  }

  const last = latestKzh(elem.kzh);
  const v = KZH_CAMS_VALIDATION[elem.kzh];
  return (
    <Panel className="mt-4 p-4">
      {noModelNote}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-brand">{tr("Қазгидромет посттары — Атырау")}</span>
        <TierBadge tone="light" tier="measurement" />
      </div>
      {last ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat value={fmt(last.meanUg)} label={<>{tr("айлық орташа")} µg/m³</>} />
            {last.maxUg != null && <Stat value={fmt(last.maxUg)} label={tr("ең жоғары бір реттік")} note={last.maxXPdkMr != null && last.maxXPdkMr > 1 ? <span className="font-bold text-red-800">{last.maxXPdkMr}× {tr("ШРК")}</span> : undefined} />}
          </div>
          <p className="mt-1 text-[11px] text-neutral-600">
            {tr("Айы")}: <b className="text-neutral-800">{last.month}</b> · {tr("тірі емес — бюллетень ~1–1.5 ай кешігіп шығады")} ·{" "}
            <a href={last.url} target="_blank" rel="noopener noreferrer" className="text-sky-800 underline">
              {tr("бюллетень")}, {tr("бет")} {last.page}
            </a>
          </p>
          <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px] leading-snug text-neutral-600">
            <dt className="font-semibold text-neutral-800">{t("air.freq")}</dt>
            <dd>{t("air.freq.kzh")}</dd>
            <dt className="font-semibold text-neutral-800">{t("air.quality")}</dt>
            <dd>{t("air.q.kzh")}</dd>
            <dt className="font-semibold text-neutral-800">{t("air.uncertainty")}</dt>
            <dd>{t("air.u.kzh")}</dd>
          </dl>
        </>
      ) : (
        <p className="text-[12px] text-neutral-600">{tr("Бюллетеньде бұл зат бойынша дерек жоқ.")}</p>
      )}
      {v && !v.pass && (
        <p className="mt-1.5 text-[12px] leading-snug text-orange-800">
          {tr("Тексеру")} ({KZH_PERIOD.from}…{KZH_PERIOD.to}, {v.n} {tr("ай")}):{" "}
          {v.obsOverCams >= 1
            ? `${tr("CAMS Атырауда бұл газды посттардан шамамен")} ${v.obsOverCams}× ${tr("төмен көрсетеді")}`
            : `${tr("CAMS Атырауда бұл газды посттардан шамамен")} ${(1 / v.obsOverCams).toFixed(1)}× ${tr("жоғары көрсетеді")}`}
          . {tr("Жоғарыдағы тор мәнін абсолют сан ретінде қолданбаңыз.")}
        </p>
      )}
    </Panel>
  );
}
