import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, COMPLAINT_RATE_LIMIT, STATUS_TRANSITIONS, MAX_MEDIA_BYTES } from "./complaints";

const raw = readFileSync("supabase/migrations/20261103_complaints.sql", "utf8");
const sql = raw.replace(/--[^\n]*/g, "");
const policy = (name: string) => sql.match(new RegExp(`create policy ${name}\\b[^;]*;`, "i"))?.[0] ?? "";
const literals = (value: string) => [...value.matchAll(/'([^']+)'/g)].map((match) => match[1]);
describe("P3.3/P3.4 SQL parity (static; never applied)", () => {
  it("declares the same categories and statuses as TypeScript", () => {
    for (const [type, expected] of [["complaint_category", COMPLAINT_CATEGORIES], ["complaint_status", COMPLAINT_STATUSES]] as const) {
      const declaration = sql.match(new RegExp(`create type public\\.${type} as enum \\(([^)]+)\\)`))?.[1] ?? "";
      expect(literals(declaration)).toEqual(expected);
    }
    expect(sql).toContain("status public.complaint_status not null default 'submitted'");
  });
  it("enforces exactly the allowed pairs and staff role in the update trigger", () => {
    const body = sql.match(/function public\.complaints_before_update\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
    const pairs = [...body.matchAll(/\('([^']+)', '([^']+)'\)/g)].map(([, from, to]) => `${from}:${to}`).sort();
    expect(pairs).toEqual(Object.entries(STATUS_TRANSITIONS).flatMap(([from, values]) => values.map((to) => `${from}:${to}`)).sort());
    expect(body).toContain("public.has_role(array['officer','admin']::public.app_role[])");
    expect(body).toContain("new.status_changed_by := auth.uid()");
    expect(body).toContain("raise exception 'complaint_bad_transition'");
  });
  it("enforces the limit and serializes concurrent inserts; callers cannot forge creation time", () => {
    const body = sql.match(/function public\.complaints_before_insert\(\)[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(body).toContain("interval '1 hour'"); expect(body).toContain(`>= ${COMPLAINT_RATE_LIMIT.perHour}`);
    expect(body).toContain("pg_advisory_xact_lock"); expect(body).toContain("new.created_at := now()");
    expect(body).toContain("new.status := 'submitted'"); expect(body).toContain("new.flagged := false");
    expect(body).toContain("interval '30 days'"); expect(body).toContain("interval '10 minutes'");
  });
  it("allows only owner inserts and reads, staff column updates, and no deletes or anon table grants", () => {
    expect(sql).toContain("alter table public.complaints enable row level security");
    expect(policy("complaints_insert_own")).toContain("user_id = auth.uid()");
    expect(policy("complaints_insert_own")).toContain("status = 'submitted'");
    expect(policy("complaints_select_own")).toContain("user_id = auth.uid()");
    expect(policy("complaints_staff_update").match(/public\.has_role/g)).toHaveLength(2);
    expect(sql).not.toMatch(/create policy\s+\S+\s+on public\.complaints\s+for (?:delete|all)/i);
    expect(sql).not.toMatch(/grant[^;]+on public\.complaints\b[^;]+to\s+(?:[^;]*,\s*)?anon/i);
    const update = sql.match(/grant update \(([^)]+)\)\s+on public\.complaints/)?.[1] ?? "";
    expect(update).not.toMatch(/description|user_id|lat|lng|created_at|media_path/);
  });
  it("public view is a rounded allowlist and hides flagged rows", () => {
    const select = sql.match(/create or replace view public\.complaints_public[^;]+/i)?.[0] ?? "";
    const fields = select.match(/\bas\s+select([\s\S]+?)from public\.complaints/i)?.[1] ?? "";
    expect(fields).not.toMatch(/user_id|description|media_path|flag/); expect(fields).toContain("round(lat::numeric, 3)");
    expect(select).toContain("where not flagged"); expect(raw).toContain("Owner-privileged");
  });
  it("private media bucket restricts size, owner upload path and staff reads", () => {
    expect(sql).toContain(`values ('complaint-media', 'complaint-media', false, ${MAX_MEDIA_BYTES}`);
    expect(policy("complaint_media_insert_own")).toContain("(storage.foldername(name))[1] = auth.uid()::text");
    expect(policy("complaint_media_staff_select")).toContain("public.has_role");
  });
  it("restores anon reports reads with a column allowlist, without exposing staff columns to residents", () => {
    expect(policy("reports_public_read")).toContain("for select to anon using (true)");
    const columns = sql.match(/grant select \(([^)]+)\) on public\.reports to anon/)?.[1] ?? "";
    expect(columns).toContain("verification_status"); expect(columns).not.toMatch(/name|photo_thumb/);
    expect(sql).toContain("revoke select on public.reports from public, anon");
    expect(readFileSync("supabase/rls.sql", "utf8")).toContain("Қайта қаралды 2026-11-03 (P3.4)");
  });
  it("is explicitly unapplied and depends on the auth migration", () => {
    expect(raw.split("\n")[0]).toContain("ҚОЛДАНЫЛМАҒАН"); expect(raw.split("\n")[0]).toContain("20261103_auth_roles.sql");
    expect(sql.trim().startsWith("begin;")).toBe(true); expect(sql.trim().endsWith("commit;")).toBe(true);
  });
});
