-- P3.8 Қызметкер әрекеттерінің журналы (append-only). Иесінің қарауына; 20261103_auth_roles.sql
-- және 20261103_complaints.sql қолданылғаннан КЕЙІН SQL Editor ішінде орындаңыз.
--
-- Журналды дерекқордың өзі жазады (триггер), сондықтан API-ді айналып өткен өзгеріс те
-- тіркеледі. Ешкім (қызметкер де, әкімші де) жолды өзгерте не өшіре алмайды: insert/update/
-- delete/truncate құқығы ешкімге берілмеген, оған қоса өзгертуге тыйым салатын триггер бар.
-- Жеке деректер (шағым сипаттамасы, медиа) журналға жазылмайды — тек мәртебе өрістері.
begin;

create table if not exists public.officer_audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,                         -- auth.uid(); null = SQL Editor / сервистік рөл
  actor_role text,
  target_table text not null,
  target_id text not null,
  action text not null check (action in ('update', 'delete')),
  changes jsonb not null default '{}'::jsonb
);
alter table public.officer_audit_log enable row level security;
revoke all on public.officer_audit_log from public, anon, authenticated;
grant select on public.officer_audit_log to authenticated;

drop policy if exists officer_audit_staff_select on public.officer_audit_log;
create policy officer_audit_staff_select on public.officer_audit_log for select to authenticated
  using (public.has_role(array['officer','admin']::public.app_role[]));

create or replace function public.officer_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'officer_audit_log is append-only';
end $$;
drop trigger if exists officer_audit_no_update on public.officer_audit_log;
create trigger officer_audit_no_update before update or delete on public.officer_audit_log
  for each row execute function public.officer_audit_immutable();
drop trigger if exists officer_audit_no_truncate on public.officer_audit_log;
create trigger officer_audit_no_truncate before truncate on public.officer_audit_log
  for each statement execute function public.officer_audit_immutable();

-- Тек осы өрістердің өзгерісі жазылады (жеке мәтін/медиа емес).
create or replace function public.officer_audit_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  keep text[] := array['verification_status', 'status', 'flagged', 'flag_reason'];
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else '{}'::jsonb end;
  n jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) else '{}'::jsonb end;
  diff jsonb := '{}'::jsonb;
  k text;
begin
  foreach k in array keep loop
    if o ? k and (tg_op = 'DELETE' or (o -> k) is distinct from (n -> k)) then
      diff := diff || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then
    return new;                       -- мәртебе өзгермеді — жазбаймыз
  end if;
  insert into public.officer_audit_log(actor, actor_role, target_table, target_id, action, changes)
  values (
    auth.uid(),
    (select role::text from public.user_roles where user_id = auth.uid()),
    tg_table_name,
    (o ->> 'id'),
    lower(tg_op),
    diff
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function public.officer_audit_write() from public, anon, authenticated;

drop trigger if exists reports_officer_audit on public.reports;
create trigger reports_officer_audit after update or delete on public.reports
  for each row execute function public.officer_audit_write();
drop trigger if exists complaints_officer_audit on public.complaints;
create trigger complaints_officer_audit after update or delete on public.complaints
  for each row execute function public.officer_audit_write();

commit;
