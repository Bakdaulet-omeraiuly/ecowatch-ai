-- ============================================================================
-- Jaiyq — АСУ ЖУРНАЛЫ: ОРТАЛАУ НЕГІЗІНІҢ МИГРАЦИЯСЫ (P1.2, Г.2 4–5)
--
-- НЕГЕ КЕРЕК:
-- Бұрынғы `/api/fixate` сағаттық мәнді тәуліктік және жылдық нормамен
-- салыстырған (асудың базасы дұрыс емес). Ондай жолдар прокуратураға дәлел
-- бола алмайды. Бұл файл:
--   • жолдардың терезесін (window_start, window_end) және санын (sample_count) қосады;
--   • ескі жолдарды БЕЛГІЛЕЙДІ (legacy_invalid_basis = true) — ЖОЙМАЙДЫ;
--   • бірегейлік кілтін (region, indicator, averaging, window_end) етіп ауыстырады;
--   • fixation_runs-ке «жеткіліксіз тәулік» санағышын қосады.
--
-- ⚠️ Жою операциялары ЖОҚ: ескі деректер сақталады, тек белгіленеді.
-- ✔ Прод-қа қолданылды 2026-11-05 (SQL Editor). Бұрын: ІСКЕ ҚОСУ — иесі, бір рет.
--    Бұл қадамсыз жаңа `/api/fixate` жүгірісі upsert-те қатеге ұшырайды
--    (onConflict жаңа кілтті күтеді).
-- Идемпотент: қайта іске қосуға болады.
-- ============================================================================

-- 1) ЖАҢА БАҒАНДАР ---------------------------------------------------------
alter table public.exceedances
  add column if not exists window_start        timestamptz,
  add column if not exists window_end          timestamptz,
  add column if not exists sample_count        int,
  add column if not exists legacy_invalid_basis boolean not null default false;

-- 2) ЕСКІ ЖОЛДАРДЫ БЕЛГІЛЕУ (жою ЖОҚ)
-- Ескі жолдарда window_end жоқ (миграцияға дейін жазылған). Осы шарт
-- бұрынғы барлық жолды қамтиды; жаңа код әрқашан window_end жазады.
update public.exceedances
   set legacy_invalid_basis = true
 where window_end is null;

-- 3) БІРЕГЕЙЛІК КІЛТІ ------------------------------------------------------
-- Ескі кілт: unique (region_id, indicator_id, observed_hour) — кестені
-- құру кезіндегі әдепкі атаумен. Ол орташалау кезеңін ескермейді, сондықтан
-- алынады. Жаңа кілт: бір терезе — бір жазба.
alter table public.exceedances
  drop constraint if exists exceedances_region_id_indicator_id_observed_hour_key;

create unique index if not exists exceedances_basis_key
  on public.exceedances (region_id, indicator_id, averaging, window_end);

create index if not exists exceedances_legacy
  on public.exceedances (legacy_invalid_basis);

-- 4) ЖҮГІРІС ЖУРНАЛЫ: жеткіліксіз тәулік санағышы --------------------------
-- insufficient_days — толық өткен, бірақ сағаттары жеткіліксіз тәуліктер
-- (көрсеткіш × күн). Олар «тексерілмеді» дегенді білдіреді, асу емес.
alter table public.fixation_runs
  add column if not exists insufficient_days int not null default 0;
