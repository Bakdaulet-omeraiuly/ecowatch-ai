import { createClient } from "@supabase/supabase-js";
import { vi } from "vitest";

export const AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
export const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";

export type TableResult = { data: unknown; error: { message: string } | null; count?: number | null };

// Тек тестке арналған Auth/DB алмастырғышы: желіге сұраныс жіберілмейді.
export function setupAuthMock() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://auth-test.invalid");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
  const state = {
    role: "resident" as unknown,
    noRole: false,
    noUser: false,
    authError: null as { message: string } | null,
    roleError: null as { message: string } | null,
    mutationError: null as { message: string } | null,
    reportRows: [{ id: "report-1" }] as { id: string }[],
    tables: {} as Record<string, TableResult | TableResult[]>,
    storageError: null as { message: string } | null,
  };
  const user = {
    id: AUTH_USER_ID, email: "resident@example.test",
    user_metadata: { role: "admin" }, app_metadata: { role: "admin" },
  };
  const roles = {
    select: vi.fn(() => roles),
    eq: vi.fn(() => roles),
    maybeSingle: vi.fn(async () => ({
      data: state.noRole ? null : { role: state.role }, error: state.roleError,
    })),
  };
  const mutation = {
    eq: vi.fn(() => mutation),
    select: vi.fn(async () => ({ data: state.reportRows, error: state.mutationError })),
  };
  const reports = { update: vi.fn(() => mutation), delete: vi.fn(() => mutation) };
  const grant = {
    select: vi.fn(() => grant),
    single: vi.fn(async () => ({ data: { user_id: TARGET_USER_ID, role: state.role }, error: state.mutationError })),
  };
  const upsert = vi.fn(() => grant);
  const getUser = vi.fn(async () => ({ data: { user: state.noUser ? null : user }, error: state.authError }));
  const queries: { table: string; calls: [string, unknown[]][] }[] = [];
  function tableQuery(table: string) {
    const calls: [string, unknown[]][] = [];
    queries.push({ table, calls });
    const result = () => {
      const value = state.tables[table];
      return Array.isArray(value) ? value.shift() ?? { data: null, error: null } : value ?? { data: [], error: null, count: 0 };
    };
    const query: Record<string, unknown> = {};
    for (const method of ["select", "insert", "update", "eq", "gte", "lte", "order", "limit"]) {
      query[method] = vi.fn((...args: unknown[]) => { calls.push([method, args]); return query; });
    }
    for (const method of ["single", "maybeSingle"]) {
      query[method] = vi.fn(async (...args: unknown[]) => { calls.push([method, args]); return result(); });
    }
    query.then = (resolve: (value: TableResult) => unknown, reject: (reason: unknown) => unknown) => {
      calls.push(["then", []]);
      return Promise.resolve(result()).then(resolve, reject);
    };
    return query;
  }
  const upload = vi.fn(async (_path: string, _bytes: Uint8Array, _options: unknown) => ({ data: null, error: state.storageError }));
  const createSignedUrl = vi.fn(async (_path: string, _seconds: number) => ({
    data: { signedUrl: "https://storage-test.invalid/signed" }, error: state.storageError,
  }));
  const storage = { from: vi.fn(() => ({ upload, createSignedUrl })) };
  const from = vi.fn((table: string) => {
    if (table === "user_roles") return { ...roles, upsert };
    if (table === "reports") return reports;
    if (table === "complaints" || table === "complaints_public") return tableQuery(table);
    throw new Error(`Unexpected test table: ${table}`);
  });
  const client = { auth: { getUser }, from, storage } as unknown as ReturnType<typeof createClient>;
  vi.mocked(createClient).mockReset().mockReturnValue(client);
  return { state, user, from, roles, reports, mutation, upsert, getUser, queries, upload, createSignedUrl, storage, client };
}

export function authRequest(method = "GET", body?: unknown, token: string | null = "valid-token") {
  return new Request("http://localhost/api/test", {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
