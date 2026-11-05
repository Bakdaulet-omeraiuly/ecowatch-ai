-- Карта құралдары: далалық журнал, детекцияны растау, аймаққа жазылу.
-- Prod-қа қолданылды 2026-11-05 (SQL Editor). 20261103_auth_roles.sql және 20261104_officer_audit.sql-ден КЕЙІН.
begin;

-- ── 1. Далалық журнал (FieldSeeker үлгісі) ──────────────────────────────
create table if not exists public.field_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  layer text not null check (layer in ('green','waste','mosquito','air','water','soil','oil','nature','fire','general')),
  kind text not null check (kind in ('planting','dump','breeding_site','larvicide','trap','sample','observation','inspection')),
  geom jsonb not null check (geom->>'type' in ('Point','Polygon')),
  lat double precision not null check (lat between 45.0 and 49.5),
  lng double precision not null check (lng between 49.5 and 55.5),
  area_km2 double precision check (area_km2 is null or area_km2 between 0 and 2000),
  event_date date not null check (event_date <= current_date + 366),
  status text not null default 'open' check (status in ('planned','open','done','failed','cancelled')),
  fields jsonb not null default '{}'::jsonb check (jsonb_typeof(fields) = 'object' and pg_column_size(fields) < 8192),
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists field_entries_layer_date on public.field_entries(layer, event_date desc);
create index if not exists field_entries_user on public.field_entries(user_id, created_at desc);
alter table public.field_entries enable row level security;

drop policy if exists field_entries_read on public.field_entries;
create policy field_entries_read on public.field_entries for select to authenticated
  using (public.has_role(array['scientist','officer','admin']::public.app_role[]));
drop policy if exists field_entries_insert on public.field_entries;
create policy field_entries_insert on public.field_entries for insert to authenticated
  with check (user_id = auth.uid() and public.has_role(array['scientist','officer','admin']::public.app_role[]));
drop policy if exists field_entries_update on public.field_entries;
create policy field_entries_update on public.field_entries for update to authenticated
  using ((user_id = auth.uid() and public.has_role(array['scientist','officer','admin']::public.app_role[]))
    or public.has_role(array['officer','admin']::public.app_role[]))
  with check ((user_id = auth.uid() and public.has_role(array['scientist','officer','admin']::public.app_role[]))
    or public.has_role(array['officer','admin']::public.app_role[]));
drop policy if exists field_entries_delete on public.field_entries;
create policy field_entries_delete on public.field_entries for delete to authenticated
  using (user_id = auth.uid() or public.has_role(array['admin']::public.app_role[]));

revoke all on public.field_entries from public, anon, authenticated;
grant select, insert, delete on public.field_entries to authenticated;
grant update (status, fields, note, event_date, updated_at) on public.field_entries to authenticated;

create or replace function public.field_entries_touch()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists field_entries_touch on public.field_entries;
create trigger field_entries_touch before update on public.field_entries
  for each row execute function public.field_entries_touch();
-- Мәртебе өзгерісі мен өшіру қызметкер журналына түседі (officer_audit_write 'status' кілтін бақылайды)
drop trigger if exists field_entries_officer_audit on public.field_entries;
create trigger field_entries_officer_audit after update or delete on public.field_entries
  for each row execute function public.officer_audit_write();

-- ── 2. Детекцияны растау (EMSA CleanSeaNet кері байланыс үлгісі) ────────
create table if not exists public.detection_reviews (
  id bigint generated always as identity primary key,
  layer text not null check (layer in ('fire','oil','no2','waste')),
  detection_key text not null check (char_length(detection_key) between 1 and 200),
  verdict text not null check (verdict in ('confirmed','false_positive','unverified')),
  note text check (char_length(note) <= 1000),
  reviewer uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists detection_reviews_key on public.detection_reviews(layer, detection_key, created_at desc);
alter table public.detection_reviews enable row level security;
drop policy if exists detection_reviews_staff_select on public.detection_reviews;
create policy detection_reviews_staff_select on public.detection_reviews for select to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]));
drop policy if exists detection_reviews_staff_insert on public.detection_reviews;
create policy detection_reviews_staff_insert on public.detection_reviews for insert to authenticated
  with check (reviewer = auth.uid() and public.has_role(array['officer','admin']::public.app_role[]));
revoke all on public.detection_reviews from public, anon, authenticated;
grant select, insert on public.detection_reviews to authenticated;
-- Тарих өзгермейді: жаңа шешім — жаңа жол.
create or replace function public.detection_reviews_immutable()
returns trigger language plpgsql as $$ begin raise exception 'detection_reviews is append-only'; end $$;
drop trigger if exists detection_reviews_no_update on public.detection_reviews;
create trigger detection_reviews_no_update before update or delete on public.detection_reviews
  for each row execute function public.detection_reviews_immutable();

-- Жария проекция: әр детекцияның СОҢҒЫ шешімі, тексерушісіз.
create or replace function public.detection_verdicts(p_layer text)
returns table (detection_key text, verdict text, reviewed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (r.detection_key) r.detection_key, r.verdict, r.created_at
  from public.detection_reviews r
  where r.layer = p_layer
  order by r.detection_key, r.created_at desc;
$$;
revoke all on function public.detection_verdicts(text) from public;
grant execute on function public.detection_verdicts(text) to anon, authenticated;

-- ── 3. Аймаққа жазылу ───────────────────────────────────────────────────
create table if not exists public.watch_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  ring jsonb not null check (jsonb_typeof(ring) = 'array' and jsonb_array_length(ring) between 3 and 500),
  area_km2 double precision not null check (area_km2 > 0 and area_km2 <= 2000),
  layers text[] not null default array['fire'] check (layers <@ array['fire','no2','ndvi']),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists watch_areas_user on public.watch_areas(user_id);
alter table public.watch_areas enable row level security;
drop policy if exists watch_areas_own on public.watch_areas;
create policy watch_areas_own on public.watch_areas for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.watch_areas from public, anon, authenticated;
grant select, insert, delete on public.watch_areas to authenticated;
grant update (name, layers, last_seen_at) on public.watch_areas to authenticated;

create or replace function public.watch_areas_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.watch_areas where user_id = new.user_id) >= 10 then
    raise exception 'watch_areas limit 10 per user';
  end if;
  return new;
end $$;
revoke all on function public.watch_areas_limit() from public, anon, authenticated;
drop trigger if exists watch_areas_limit on public.watch_areas;
create trigger watch_areas_limit before insert on public.watch_areas
  for each row execute function public.watch_areas_limit();

commit;
