import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { setupAuthMock } from "@/lib/test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const req = (token: string | null = "valid-token") => new Request("https://jaiyq.test/api/officer/audit",
  { headers: token ? { Authorization: `Bearer ${token}` } : {} });

describe("P3.8 officer audit log access", () => {
  it("anonymous → 401", async () => { expect((await GET(req(null))).status).toBe(401); });
  it.each(["resident", "scientist"])("%s → 403", async (role) => {
    mock.state.role = role;
    expect((await GET(req())).status).toBe(403);
  });
  it("officer reads entries", async () => {
    mock.state.role = "officer";
    mock.state.tables.officer_audit_log = { data: [{ id: 1, action: "update" }], error: null };
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect((await res.json()).entries).toHaveLength(1);
  });
  it("DB error → 503, never an empty 'all quiet' list", async () => {
    mock.state.role = "admin";
    mock.state.tables.officer_audit_log = { data: null, error: { message: "relation does not exist" } };
    const res = await GET(req());
    expect(res.status).toBe(503);
    expect((await res.json()).entries).toBeNull();
  });
});
