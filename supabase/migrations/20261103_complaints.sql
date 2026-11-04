-- Иесінің қарауына арналған; ҚОЛДАНЫЛМАҒАН. 20261103_auth_roles.sql-ден КЕЙІН.
begin;

do $$ begin
  create type public.complaint_category as enum ('smell', 'smoke', 'dust', 'fire', 'water', 'soil');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type public.complaint_status as enum ('submitted', 'in_review', 'confirmed', 'not_confirmed', 'resolved');
exception when duplicate_object then null;
end $$;

create table if not exists public.complaints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category public.complaint_category not null,
  lat double precision not null check (lat between 46.0 and 49.0),
  lng double precision not null check (lng between 49.0 and 54.5),
  event_at timestamptz not null,
  description text not null check (char_length(btrim(description)) between 1 and 1000),
  media_path text,
  media_type text check (media_type in ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime')),
  status public.complaint_status not null default 'submitted',
  status_changed_at timestamptz,
  status_changed_by uuid references auth.users(id),
  flagged boolean not null default false,
  flag_reason text check (char_length(flag_reason) <= 200),
  flagged_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check ((media_path is null) = (media_type is null)),
  check (media_path is null or split_part(media_path, '/', 1) = user_id::text),
  check (not flagged or char_length(btrim(flag_reason)) > 0 and flag_reason is not null)
);
create index if not exists complaints_category_event on public.complaints(category, event_at);
create index if not exists complaints_user_created on public.complaints(user_id, created_at);
alter table public.complaints enable row level security;

drop policy if exists complaints_insert_own on public.complaints;
create policy complaints_insert_own on public.complaints for insert to authenticated
  with check (user_id = auth.uid() and status = 'submitted' and not flagged
    and status_changed_by is null and flagged_by is null);
drop policy if exists complaints_select_own on public.complaints;
create policy complaints_select_own on public.complaints for select to authenticated
  using (user_id = auth.uid());
drop policy if exists complaints_staff_select on public.complaints;
create policy complaints_staff_select on public.complaints for select to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]));
drop policy if exists complaints_staff_update on public.complaints;
create policy complaints_staff_update on public.complaints for update to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]))
  with check (public.has_role(array['officer','admin']::public.app_role[]));

revoke all on public.complaints from public, anon, authenticated;
grant select, insert on public.complaints to authenticated;
grant update (status, status_changed_at, status_changed_by, flagged, flag_reason, flagged_by)
  on public.complaints to authenticated;

create or replace function public.complaints_before_insert()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  -- Serialize inserts for this user, including direct PostgREST requests.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  new.created_at := now();
  new.status := 'submitted';
  new.status_changed_at := null;
  new.status_changed_by := null;
  new.flagged := false;
  new.flag_reason := null;
  new.flagged_by := null;
  if new.event_at < now() - interval '30 days' or new.event_at > now() + interval '10 minutes' then
    raise exception 'complaint_bad_event_time';
  end if;
  if (select count(*) from public.complaints
      where user_id = new.user_id and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'complaint_rate_limit';
  end if;
  return new;
end;
$$;
revoke all on function public.complaints_before_insert() from public, anon, authenticated;
drop trigger if exists complaints_before_insert on public.complaints;
create trigger complaints_before_insert before insert on public.complaints
  for each row execute function public.complaints_before_insert();

create or replace function public.complaints_before_update()
returns trigger language plpgsql set search_path = public
as $$
begin
  if not public.has_role(array['officer','admin']::public.app_role[]) then
    raise exception 'complaint_staff_only';
  end if;
  if old.status is distinct from new.status then
    if (old.status::text, new.status::text) not in (
      ('submitted', 'in_review'),
      ('in_review', 'confirmed'),
      ('in_review', 'not_confirmed'),
      ('confirmed', 'resolved'),
      ('not_confirmed', 'in_review')
    ) then
      raise exception 'complaint_bad_transition';
    end if;
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
  else
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  if new.flagged then
    new.flagged_by := auth.uid();
  else
    new.flagged_by := null;
    new.flag_reason := null;
  end if;
  return new;
end;
$$;
revoke all on function public.complaints_before_update() from public, anon, authenticated;
drop trigger if exists complaints_before_update on public.complaints;
create trigger complaints_before_update before update on public.complaints
  for each row execute function public.complaints_before_update();

-- Owner-privileged intentionally: only this explicit privacy allowlist bypasses RLS.
create or replace view public.complaints_public with (security_barrier = true) as
  select id, category, status, event_at, created_at,
    round(lat::numeric, 3)::float8 as lat, round(lng::numeric, 3)::float8 as lng
  from public.complaints where not flagged;
comment on view public.complaints_public is
  'Owner-privileged privacy allowlist; no descriptions, identities or media; flagged rows hidden.';
revoke all on public.complaints_public from public, anon, authenticated;
grant select on public.complaints_public to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('complaint-media', 'complaint-media', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'])
on conflict do nothing;
drop policy if exists complaint_media_insert_own on storage.objects;
create policy complaint_media_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists complaint_media_staff_select on storage.objects;
create policy complaint_media_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'complaint-media' and public.has_role(array['officer','admin']::public.app_role[]));

-- Retain public map reads after the auth migration enables RLS.
-- Authenticated non-staff must not inherit this policy and the staff column grant.
drop policy if exists reports_public_read on public.reports;
create policy reports_public_read on public.reports for select to anon using (true);
revoke select on public.reports from public, anon;
grant select (id, lat, lng, district, risk_score, risk_level, mosquito_index,
  analysis, image_url, verification_status, created_at) on public.reports to anon;

commit;
