import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { setupAuthMock } from "@/lib/test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const req = (token: string | null = "valid-token") => new Request(
  "https://jaiyq.test/api/export?dataset=bogus",
  { headers: token ? { Authorization: `Bearer ${token}` } : {} },
);

describe("P3.9 export is bound to roles", () => {
  it("anonymous → 401", async () => {
    expect((await GET(req(null))).status).toBe(401);
  });
  it("resident → 403", async () => {
    mock.state.role = "resident";
    expect((await GET(req())).status).toBe(403);
  });
  it.each(["scientist", "officer", "admin"])("%s passes the role check (then dataset validation → 400)", async (role) => {
    mock.state.role = role;
    expect((await GET(req())).status).toBe(400);
  });
});
