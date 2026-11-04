import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { AUTH_ERRORS, bearerToken, requireRole, ROLES, STAFF_ROLES } from "./auth";
import { UI_TR } from "./uiTranslations";
import { authRequest, setupAuthMock } from "./test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); });

describe("Bearer token", () => {
  it.each([
    [null, null], ["", null], ["Basic token", null], ["Bearer", null],
    ["Bearer   ", null], ["Bearer token extra", null], ["Bearer abc", "abc"],
    ["bearer abc", "abc"], ["Bearer    abc", "abc"],
  ])("%s → %s", (header, expected) => {
    const req = new Request("http://localhost", { headers: header === null ? {} : { Authorization: header } });
    expect(bearerToken(req)).toBe(expected);
  });
});

describe("server role authorization", () => {
  it.each(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"])("missing %s → 503", async (key) => {
    vi.stubEnv(key, "");
    const result = await requireRole(authRequest(), ROLES);
    expect(result.ok ? 200 : result.response.status).toBe(503);
    expect(mock.getUser).not.toHaveBeenCalled();
  });
  it("no token → 401 before the Auth or DB call", async () => {
    const result = await requireRole(authRequest("GET", undefined, null), ROLES);
    expect(result.ok ? 200 : result.response.status).toBe(401);
    expect(mock.getUser).not.toHaveBeenCalled();
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("rejected token → 401", async () => {
    mock.state.authError = { message: "expired" };
    const result = await requireRole(authRequest(), ROLES);
    expect(result.ok ? 200 : result.response.status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it("missing user → 401", async () => {
    mock.state.noUser = true;
    const result = await requireRole(authRequest(), ROLES);
    expect(result.ok ? 200 : result.response.status).toBe(401);
  });
  it("role query failure → 503, never resident", async () => {
    mock.state.roleError = { message: "table missing" };
    const result = await requireRole(authRequest(), ROLES);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(503);
      expect(await result.response.json()).toEqual({ error: AUTH_ERRORS.rolesUnavailable });
    }
  });
  it.each([null, "unknown"])("missing/unknown role %s → resident", async (role) => {
    mock.state.noRole = role === null;
    mock.state.role = role;
    const result = await requireRole(authRequest(), ROLES);
    expect(result.ok && result.role).toBe("resident");
  });
  it("resident cannot use admin metadata for staff access", async () => {
    const result = await requireRole(authRequest(), STAFF_ROLES);
    expect(result.ok ? 200 : result.response.status).toBe(403);
  });
  it("officer uses a verified JWT and its own RLS client", async () => {
    mock.state.role = "officer";
    const result = await requireRole(authRequest(), STAFF_ROLES);
    expect(result.ok && result.role).toBe("officer");
    expect(mock.getUser).toHaveBeenCalledWith("valid-token");
    expect(mock.roles.eq).toHaveBeenCalledWith("user_id", mock.user.id);
    expect(createClient).toHaveBeenCalledWith("https://auth-test.invalid", "test-anon-key", {
      global: { headers: { Authorization: "Bearer valid-token" } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  });
  it("all auth errors have exact translations", () => {
    for (const error of Object.values(AUTH_ERRORS)) expect(UI_TR[error]).toBeDefined();
  });
});
