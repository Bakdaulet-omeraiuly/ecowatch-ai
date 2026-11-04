import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";
import { authRequest, setupAuthMock } from "@/lib/test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); });

it("me: no token → 401", async () => {
  expect((await GET(authRequest("GET", undefined, null))).status).toBe(401);
});
it("me: uses table resident role despite admin metadata", async () => {
  const res = await GET(authRequest());
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ userId: mock.user.id, email: mock.user.email, role: "resident" });
});
it("me: unavailable role source → 503", async () => {
  mock.state.roleError = { message: "table missing" };
  expect((await GET(authRequest())).status).toBe(503);
});
