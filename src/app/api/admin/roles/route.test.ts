import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { AUTH_USER_ID, TARGET_USER_ID, authRequest, setupAuthMock } from "@/lib/test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
const body = { userId: TARGET_USER_ID, role: "officer" };
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("P3.2 admin role grants", () => {
  it("no token → 401", async () => {
    expect((await POST(authRequest("POST", body, null))).status).toBe(401);
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it.each(["resident", "scientist", "officer"])("%s cannot grant officer → 403", async (role) => {
    mock.state.role = role;
    expect((await POST(authRequest("POST", body))).status).toBe(403);
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it.each(["resident", "scientist", "officer"])("admin grants %s → 200", async (role) => {
    mock.state.role = "admin";
    const res = await POST(authRequest("POST", { ...body, role }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: TARGET_USER_ID, role });
    expect(mock.upsert).toHaveBeenCalledWith({
      user_id: TARGET_USER_ID, role, granted_by: AUTH_USER_ID, granted_at: expect.any(String),
    }, { onConflict: "user_id" });
  });
  it.each([
    [{ ...body, role: "admin" }, 400],
    [{ ...body, userId: AUTH_USER_ID }, 403],
    [{ ...body, userId: "invalid" }, 400],
  ])("admin invalid/self grant %j → %s", async (input, status) => {
    mock.state.role = "admin";
    expect((await POST(authRequest("POST", input))).status).toBe(status);
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it.each([
    ["abcdefab-cdef-4abc-8def-abcdefabcdef", "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF"],
    ["ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF", "abcdefab-cdef-4abc-8def-abcdefabcdef"],
  ])("admin self-change ignores UUID case (%s → %s)", async (adminId, userId) => {
    mock.state.role = "admin";
    mock.user.id = adminId;
    const res = await POST(authRequest("POST", { ...body, userId }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Өз рөліңізді өзгертуге болмайды" });
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it("admin grants to another user with a normalized UUID", async () => {
    mock.state.role = "admin";
    const userId = "ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF";
    const res = await POST(authRequest("POST", { ...body, userId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, userId: userId.toLowerCase(), role: "officer" });
    expect(mock.upsert).toHaveBeenCalledWith({
      user_id: userId.toLowerCase(), role: "officer", granted_by: AUTH_USER_ID, granted_at: expect.any(String),
    }, { onConflict: "user_id" });
  });
  it("admin malformed JSON → 400", async () => {
    mock.state.role = "admin";
    const req = new Request("http://localhost", { method: "POST", headers: { Authorization: "Bearer token" }, body: "{" });
    expect((await POST(req)).status).toBe(400);
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it("role table unavailable → 503 without writes", async () => {
    mock.state.roleError = { message: "missing table" };
    expect((await POST(authRequest("POST", body))).status).toBe(503);
    expect(mock.upsert).not.toHaveBeenCalled();
  });
  it("DB grant failure is sanitized", async () => {
    mock.state.role = "admin";
    mock.state.mutationError = { message: "private database detail" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(authRequest("POST", body));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Дерекқор қатесі" });
  });
});
