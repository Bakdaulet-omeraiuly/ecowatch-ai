-- ============================================================================
-- Jaiyq — НОРМА АСУЫНЫҢ ФИКСАЦИЯСЫ
--
-- НЕГЕ КЕРЕК:
-- Жүйе сәйкестікті СҰРАНЫС КЕЗІНДЕ есептейді де, кэшке салады. Яғни түнгі
-- 03:00-де болған асу таңертең қарағанда ЖОҚ болып қалады — ешжерде
-- сақталмайды. Ал прокуратура үшін керегі дәл сол: «қашан, қай жерде,
-- қандай мән, қандай нормадан асты».
--
-- Осы кесте әр асуды УАҚЫТЫМЕН жазып отырады.
--
-- ІСКЕ ҚОСУ: Supabase → SQL Editor → осыны Run.
-- ============================================================================

-- 1) АСУ ЖУРНАЛЫ ---------------------------------------------------------
create table if not exists public.exceedances (
  id            bigserial primary key,

  -- Қайда
  region_id     text not null,
  region_name   text not null,

  -- Не
  indicator_id   text not null,
  indicator_name text not null,
  unit           text not null,
  value          double precision not null,

  -- Қаншалық ауыр
  --   exceeded             — РАСТАЛҒАН нормадан асты (заңдық белгі)
  --   exceeded-unverified  — асты, бірақ норма мәтіні расталмаған
  level          text not null check (level in ('exceeded','exceeded-unverified')),
  kz_violation   boolean not null default false,

  -- Ең ауыр норма (қай актіден)
  act_jurisdiction text,
  act_number       text,
  averaging        text,
  norm_limit       double precision,
  times_over       double precision,

  -- Дереккөздің сенімділік деңгейі: measurement | model
  tier    text,
  summary text,

  -- ⚠️ ЕКІ УАҚЫТ БӨЛЕК САҚТАЛАДЫ:
  --   observed_hour — ДЕРЕКТІҢ өз сағаты (CAMS сағат сайын жаңарады)
  --   recorded_at   — біздің жазған сәтіміз
  -- Екеуін шатастыруға болмайды: біріншісі — оқиғаның уақыты, екіншісі —
  -- тіркеудің уақыты. Кідіріс болса, айырма көрінеді.
  observed_hour timestamptz not null,
  recorded_at   timestamptz not null default now(),

  -- Бір сағаттағы бір көрсеткіш бір рет жазылады (қайталанбайды),
  -- бірақ асу бірнеше сағат тұрса — әр сағат жеке жазба болады.
  unique (region_id, indicator_id, observed_hour)
);

create index if not exists exceedances_region_time
  on public.exceedances (region_id, observed_hour desc);
create index if not exists exceedances_time
  on public.exceedances (observed_hour desc);

-- 2) ТЕКСЕРУ ЖҮГІРІСТЕРІ -------------------------------------------------
--
-- ⚠️ ЕҢ МАҢЫЗДЫ КЕСТЕ. Журналда жазба жоқтығы «асу болмады» дегенді
-- БІЛДІРМЕЙДІ — тексеру мүлдем жүрмеген болуы да мүмкін. Сондықтан әр
-- жүгіріс тіркеледі: сонда журналдағы БОС кезең мен ТЕКСЕРІЛГЕН кезең
-- ажыратылады.
create table if not exists public.fixation_runs (
  id        bigserial primary key,
  ran_at    timestamptz not null default now(),
  regions   int  not null default 0,
  checked   int  not null default 0,
  found     int  not null default 0,
  ok        boolean not null default true,
  error     text
);

create index if not exists fixation_runs_time on public.fixation_runs (ran_at desc);

-- 3) RLS -----------------------------------------------------------------
alter table public.exceedances   enable row level security;
alter table public.fixation_runs enable row level security;

drop policy if exists "exceedances_public_read"   on public.exceedances;
drop policy if exists "fixation_runs_public_read" on public.fixation_runs;

-- Оқу — бәріне ашық (журнал жария болуы керек)
create policy "exceedances_public_read"
  on public.exceedances for select using (true);
create policy "fixation_runs_public_read"
  on public.fixation_runs for select using (true);

-- ЖАЗУ саясаты ЖОҚ → anon кілтімен жазу мүмкін емес.
-- Жазуды тек сервер SUPABASE_SERVICE_ROLE_KEY арқылы жасайды
-- (service role RLS-тен өтеді). Ол кілтті клиентке ЕШҚАШАН бермеу керек.
