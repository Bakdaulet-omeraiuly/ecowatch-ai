import { beforeEach, expect, it, vi } from "vitest";
import { authHeaders, buildSignUp, getAccessToken } from "./authClient";

const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { auth: { getSession: mocks.getSession } } }));
beforeEach(() => { mocks.getSession.mockReset(); });

it("P3.2 sign-up sends credentials and redirect only", () => {
  const input = buildSignUp("resident@example.test", "password123", "https://example.test/auth");
  expect(input).toEqual({ email: "resident@example.test", password: "password123", options: { emailRedirectTo: "https://example.test/auth" } });
  expect(JSON.stringify(input)).not.toContain("role");
  expect(JSON.stringify(input)).not.toContain('"data"');
});
it("session token becomes a Bearer header", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "token" } } });
  expect(await getAccessToken()).toBe("token");
  expect(await authHeaders()).toEqual({ Authorization: "Bearer token" });
});
it("missing session does not invent a token", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  expect(await getAccessToken()).toBeNull();
  expect(await authHeaders()).toEqual({});
});
