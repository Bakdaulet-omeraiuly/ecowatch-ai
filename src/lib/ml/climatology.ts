// Маусымдық климатология — (ай, сағат) бойынша орташа.
//
// МАҢЫЗДЫ: бұл файл `ml-service/climatology.py` файлымен ДӘЛ БІРДЕЙ болуы
// керек (`ml-service/parity_check.py` тексереді). Модель абсолют мәнді емес,
// осы климатологиядан ауытқуды болжайды — сондықтан кестенің немесе іздеу
// тәртібінің сәл айырмашылығы да болжамды бұрмалайды.

export interface Climatology {
  byMonthHour: Record<string, number>;
  byMonth: Record<string, number>;
  overall: number;
}

/** `time` — "2026-08-01T13:00" (UTC) немесе аймақ белгісі бар ISO жол. */
export function climValue(clim: Climatology, time: string): number {
  const d = new Date(/[Zz]|[+-]\d\d:?\d\d$/.test(time) ? time : `${time}Z`);
  const month = d.getUTCMonth() + 1;
  const hour = d.getUTCHours();

  const mh = clim.byMonthHour[`${month}-${hour}`];
  if (mh != null) return mh;
  const mo = clim.byMonth[String(month)];
  if (mo != null) return mo;
  return clim.overall;
}
