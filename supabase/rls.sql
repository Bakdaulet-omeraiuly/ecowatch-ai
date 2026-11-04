-- Қайта қаралды 2026-11-03 (P3.4).
-- reports_public_read жолды ғана шектейді: барлық баған, соның ішінде name
-- (сипаттама) және photo_thumb (метадерегі тазаланбаған фото) ашық болған.
-- 20261103_complaints.sql anon оқылымын баған allowlist-імен шектейді.
-- complaints үшін жария select саясаты жоқ: жария оқу тек complaints_public арқылы.
-- Бұл файлдағы SQL өзгертілмеді; түзету жаңа, ҚОЛДАНЫЛМАҒАН миграцияда.
-- ============================================================================
-- Jaiyq — Supabase Row Level Security (RLS)
-- Жария launch алдында ІСКЕ ҚОСЫҢЫЗ: Supabase → SQL Editor → осыны Run.
--
-- Не істейді:
--   • `reports` кестесіне RLS қосады
--   • Кез келген адам хабарламаларды ОҚИ алады (карта/қала үшін)
--   • Anon key арқылы ЖАЗУ/ЖОЮ/ӨЗГЕРТУ БҰҒАТТАЛАДЫ (спам/қиянаттан қорғау)
--
-- Ескерту: қосымша қазір азаматтық хабарлауды да өшірген (REPORTS_ENABLED=false),
-- сондықтан бұл — қосымша қорғаныс қабаты (defense in depth).
-- Кейін хабарлауды қайта қосқанда: не service-role кілтін серверде қолдану,
-- не төмендегі INSERT саясатын (rate-limit-пен бірге) қосу керек.
-- ============================================================================

-- 1) RLS қосу
alter table public.reports enable row level security;

-- 2) Ескі саясаттарды тазалау (қайта іске қосуға қауіпсіз)
drop policy if exists "reports_public_read" on public.reports;
drop policy if exists "reports_no_public_write" on public.reports;

-- 3) Бәрі оқи алады (SELECT)
create policy "reports_public_read"
  on public.reports
  for select
  using (true);

-- 4) INSERT/UPDATE/DELETE саясаты ЖОҚ → anon рөліне тыйым салынады.
--    (Саясат болмаса RLS әдепкіде рұқсат бермейді.)

-- ============================================================================
-- КЕЙІН хабарлауды қайта қосу үшін (REPORTS_ENABLED=true болғанда) — таңдаңыз:
--
--   А нұсқа (ұсынылады): серверде SERVICE_ROLE кілтін қолдану.
--     Service role RLS-тен өтеді. Клиентке ЕШҚАШАН бермеңіз — тек серверде.
--
--   Б нұсқа: anon-ға шектеулі INSERT рұқсаты (қосымша rate-limit керек):
--     create policy "reports_public_insert"
--       on public.reports for insert
--       with check ( char_length(coalesce(name, '')) <= 200 );
-- ============================================================================
