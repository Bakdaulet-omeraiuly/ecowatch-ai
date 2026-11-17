-- telegram_subscribers: RLS қосу (ҚОЛДАНЫЛМАҒАН миграция).
--
-- Мәселе (2026-11-16 аудиті): кесте қолмен жасалған, RLS жоқ. Жария anon
-- кілті (браузер бандлында бар) арқылы кез келген адам жазылушылардың
-- chat_id мен username тізімін PostgREST-тен тікелей оқи алады.
--
-- ⚠️ РЕТІ: алдымен service-role клиентін қолданатын код (/api/telegram,
-- /api/alerts-push) деплой болуы керек, СОДАН КЕЙІН осы файл іске қосылады.
-- Кері ретте /жазыл, /болдырма және күнделікті ескертулер тоқтайды.
--
-- Саясат әдейі жоқ: RLS қосылған, саясатсыз кесте anon/authenticated үшін
-- толық жабық; service role RLS-тен өтеді.

alter table public.telegram_subscribers enable row level security;

revoke all on table public.telegram_subscribers from anon, authenticated;
