// Асу журналының «ескі негіз» жазбаларын белгілеу (P1.2 е, Г.2 4-қадам).
//
// Бұрынғы `/api/fixate` сағаттық мәнді тәуліктік/жылдық нормамен салыстырып,
// жазбаны `observed_hour` бойынша жазатын. Ондай жазба прокуратураға дәлел
// бола алмайды. Миграция (`supabase/exceedances_basis.sql`) оларды ЖОЙМАЙДЫ —
// `legacy_invalid_basis = true` белгісін қояды.
//
// Бұл функция — сол белгіні DB-сыз, таза түрде шығарады: жолдар САНЫ мен
// мазмұны сақталады, ешқандай жол жойылмайды.

/** Журнал жолының өрістері, олар бойынша ескі/жаңа ажыратылады. */
export interface BasisRowFields {
  window_end?: string | null;
  sample_count?: number | null;
  legacy_invalid_basis?: boolean | null;
}

/**
 * Әр жолға `legacy_invalid_basis` белгісін қояды. Ереже:
 * - DB-де белгі `true` болса — ол ескі (өзгермейді);
 * - `window_end` немесе `sample_count` жоқ жол — ескі (терезе анықталмаған, негіз белгісіз);
 * - қалғаны — жаңа негіздегі жазба.
 * Кіріс ұзындығы мен жолдардың өзі сақталады (ештеңе жойылмайды).
 */
export function markLegacy<T extends BasisRowFields>(rows: T[]): (T & { legacy_invalid_basis: boolean })[] {
  return rows.map((r) => ({
    ...r,
    legacy_invalid_basis:
      r.legacy_invalid_basis === true || r.window_end == null || r.sample_count == null,
  }));
}

/** Жолдарды екіге бөледі: ағымдағы негіздегі және ескі негіздегі (жойылмайды). */
export function splitLegacy<T extends BasisRowFields>(rows: T[]): { current: T[]; legacy: T[] } {
  const marked = markLegacy(rows);
  const current: T[] = [];
  const legacy: T[] = [];
  marked.forEach((r, i) => (r.legacy_invalid_basis ? legacy : current).push(rows[i]));
  return { current, legacy };
}
