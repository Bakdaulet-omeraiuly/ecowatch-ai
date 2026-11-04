import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/20261103_auth_roles.sql", "utf8").replace(/--[^\n]*/g, "");
const policy = (name: string) => sql.match(new RegExp(`create policy ${name}\\b[^;]*;`, "i"))?.[0] ?? "";

describe("P3.2 role migration (static checks; SQL is NOT applied)", () => {
  it("sign-up always inserts resident without metadata", () => {
    const trigger = sql.match(/create or replace function public\.handle_new_user\(\)[\s\S]*?\$\$;/i)?.[0];
    expect(trigger).toMatch(/insert into public\.user_roles\(user_id, role\) values \(new\.id, 'resident'\)/i);
    expect(sql).not.toMatch(/raw_user_meta_data|raw_app_meta_data/i);
    expect(sql).toMatch(/create trigger on_auth_user_created after insert on auth\.users/i);
  });
  it("roles are RLS protected; no user_roles delete policy", () => {
    expect(sql).toMatch(/alter table public\.user_roles enable row level security/i);
    expect(sql).not.toMatch(/create policy\s+\S+\s+on public\.user_roles\s+for delete/i);
    expect(sql).toMatch(/revoke all on public\.user_roles from anon, authenticated/i);
  });
  it("admin grants exclude self and admin; both update predicates are guarded", () => {
    for (const name of ["user_roles_admin_insert", "user_roles_admin_update"]) {
      const clause = policy(name);
      expect(clause).toContain("public.has_role(array['admin']::public.app_role[])");
      expect(clause).toContain("user_id <> auth.uid()");
      expect(clause).toContain("role <> 'admin'");
    }
    const update = policy("user_roles_admin_update");
    expect(update).toMatch(/using\s*\(/i);
    expect(update).toMatch(/with check\s*\(/i);
    expect(update.match(/user_id <> auth.uid\(\)/g)).toHaveLength(2);
    expect(update.match(/role <> 'admin'/g)).toHaveLength(2);
    const writes = sql.match(/create policy\s+\S+\s+on public\.user_roles\s+for (?:insert|update|all)\b/gi);
    expect(writes).toHaveLength(2);
  });
  it("staff report reads, updates and deletes have RLS checks", () => {
    for (const operation of ["select", "update", "delete"]) {
      const clause = policy(`reports_staff_${operation}`);
      expect(clause).toContain(`for ${operation} to authenticated`);
      expect(clause).toContain("public.has_role(array['officer','admin']::public.app_role[])");
    }
    expect(policy("reports_staff_update")).toMatch(/with check/i);
  });
  it("role lookup avoids recursive RLS with a restricted definer function", () => {
    expect(sql).toMatch(/returns boolean language sql stable security definer set search_path = public/i);
    expect(sql).toContain("user_id = auth.uid() and role = any(roles)");
    expect(sql).toContain("revoke all on function public.has_role(public.app_role[]) from public, anon");
    expect(sql).toContain("grant execute on function public.has_role(public.app_role[]) to authenticated");
  });
});
