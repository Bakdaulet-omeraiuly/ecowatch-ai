import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setupAuthMock, authRequest } from "@/lib/test/authMock";
import { GET } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => {
  mock = setupAuthMock(); mock.state.role = "officer";
  mock.state.tables.complaints = { data: [{ id: "1", category: "smell", status: "submitted", lat: 47, lng: 52,
    event_at: "2026-11-03T10:00:00Z", media_path: "user/photo.jpg", media_type: "image/jpeg", description: "reported smell", flagged: true,
    user_id: "secret-owner", status_changed_by: "secret-officer", flagged_by: "secret-flagger" }], error: null };
});
afterEach(() => vi.unstubAllEnvs());
it("P3.3 review requires a token", async () => {
  expect((await GET(authRequest("GET", undefined, null))).status).toBe(401); expect(mock.from).not.toHaveBeenCalled();
});
it.each(["resident", "scientist"])("rejects %s before reading complaints or signing media", async (role) => {
  mock.state.role = role;
  expect((await GET(authRequest())).status).toBe(403); expect(mock.queries).toHaveLength(0); expect(mock.createSignedUrl).not.toHaveBeenCalled();
});
it("uses 10-minute signed media, omits identities and excludes flagged rows from groups", async () => {
  const response = await GET(authRequest()); const body = await response.json();
  expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(mock.createSignedUrl).toHaveBeenCalledWith("user/photo.jpg", 600);
  expect(body.complaints[0].mediaUrl).toBe("https://storage-test.invalid/signed");
  expect(body.groups).toEqual([]); expect(JSON.stringify(body)).not.toMatch(/secret-|media_path/);
});
it("shows unavailable media honestly on signing failure", async () => {
  mock.state.storageError = { message: "private detail" };
  const body = await (await GET(authRequest())).json(); expect(body.complaints[0].mediaUrl).toBeNull();
});
it("returns 503 for a failed source", async () => {
  mock.state.tables.complaints = { data: null, error: { message: "private detail" } };
  const response = await GET(authRequest()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private detail");
});
