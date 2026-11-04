import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupAuthMock, authRequest, AUTH_USER_ID } from "@/lib/test/authMock";
import { GET } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => vi.unstubAllEnvs());
it("P3.3 mine requires a session", async () => {
  expect((await GET(authRequest("GET", undefined, null))).status).toBe(401);
  expect(mock.from).not.toHaveBeenCalled();
});
it("filters by the authenticated owner, bypasses caches, and excludes media and flags", async () => {
  mock.state.tables.complaints = { data: [{ id: "1", description: "my report", user_id: "private-owner", media_path: "private-media", flag_reason: "private-reason" }], error: null };
  const response = await GET(authRequest());
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mock.queries[0].calls).toContainEqual(["eq", ["user_id", AUTH_USER_ID]]);
  const body = await response.json(); expect(body.complaints[0].description).toBe("my report");
  expect(JSON.stringify(body)).not.toContain("private-");
});
it("returns 503 for unavailable complaints", async () => {
  mock.state.tables.complaints = { data: null, error: { message: "private SQL" } };
  const response = await GET(authRequest()); expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("private SQL");
});
