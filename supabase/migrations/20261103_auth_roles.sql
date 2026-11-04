-- Иесінің қарауына арналған; ҚОЛДАНЫЛМАҒАН. SQL Editor ішінде орындаңыз.
begin;

do $$ begin
  create type public.app_role as enum ('resident', 'scientist', 'officer', 'admin');
exception when duplicate_object then null;
end $$;

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'resident',
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(roles public.app_role[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles where user_id = auth.uid() and role = any(roles)
  );
$$;
revoke all on function public.has_role(public.app_role[]) from public, anon;
grant execute on function public.has_role(public.app_role[]) to authenticated;

drop policy if exists user_roles_select_own on public.user_roles;
create policy user_roles_select_own on public.user_roles for select to authenticated
  using (user_id = auth.uid());
drop policy if exists user_roles_admin_select on public.user_roles;
create policy user_roles_admin_select on public.user_roles for select to authenticated
  using (public.has_role(array['admin']::public.app_role[]));
drop policy if exists user_roles_admin_insert on public.user_roles;
create policy user_roles_admin_insert on public.user_roles for insert to authenticated
  with check (
    public.has_role(array['admin']::public.app_role[])
    and user_id <> auth.uid() and role <> 'admin'
  );
drop policy if exists user_roles_admin_update on public.user_roles;
create policy user_roles_admin_update on public.user_roles for update to authenticated
  using (
    public.has_role(array['admin']::public.app_role[])
    and user_id <> auth.uid() and role <> 'admin'
  )
  with check (
    public.has_role(array['admin']::public.app_role[])
    and user_id <> auth.uid() and role <> 'admin'
  );
revoke all on public.user_roles from anon, authenticated;
grant select, insert, update on public.user_roles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_roles(user_id, role) values (new.id, 'resident')
    on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
insert into public.user_roles(user_id) select id from auth.users on conflict do nothing;

alter table public.reports enable row level security;
-- Өзгерген жолды қайтару ескі rls.sql қолданылғанына тәуелді болмауы керек.
drop policy if exists reports_staff_select on public.reports;
create policy reports_staff_select on public.reports for select to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]));
drop policy if exists reports_staff_update on public.reports;
create policy reports_staff_update on public.reports for update to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]))
  with check (public.has_role(array['officer','admin']::public.app_role[]));
drop policy if exists reports_staff_delete on public.reports;
create policy reports_staff_delete on public.reports for delete to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]));
grant select, update, delete on public.reports to authenticated;

commit;

-- Алғашқы admin рөлін ТЕК SQL арқылы беріңіз (owner UUID ауыстырыңыз):
-- insert into public.user_roles(user_id, role) values ('<owner-uuid>', 'admin')
-- on conflict (user_id) do update set role = 'admin', granted_at = now();
-- Ғалым/қызметкер: иесі SQL арқылы да бере алады ('scientist' немесе 'officer'):
-- insert into public.user_roles(user_id, role, granted_by)
-- values ('<user-uuid>', 'officer', '<owner-uuid>')
-- on conflict (user_id) do update set role = excluded.role,
-- granted_by = excluded.granted_by, granted_at = now();
