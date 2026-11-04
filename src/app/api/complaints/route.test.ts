import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { setupAuthMock, AUTH_USER_ID } from "@/lib/test/authMock";
import { jpegWithGps, textBytes } from "@/lib/test/mediaFixtures";
import { COMPLAINT_ERRORS, MAX_MEDIA_BYTES, PUBLIC_COMPLAINT_FIELDS } from "@/lib/complaints";
import { allow } from "@/lib/ratelimit";
import { GET, POST } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
const publicDb = vi.hoisted(() => ({ client: null as SupabaseClient | null }));
vi.mock("@/lib/supabase", () => ({ get supabase() { return publicDb.client; } }));
vi.mock("@/lib/ratelimit", () => ({ allow: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
const row = () => ({ id: "complaint-1", category: "smell", status: "submitted", lat: 47.123456, lng: 51.901234,
  event_at: new Date().toISOString(), created_at: new Date().toISOString() });
const calls = (method: string) => mock.queries.flatMap((query) => query.calls.filter(([name]) => name === method).map(([, args]) => args));
function request(fields: Record<string, string> = {}, bytes?: Uint8Array, token: string | null = "valid-token") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ category: "smell", lat: "47.123456", lng: "51.901234", event_at: new Date().toISOString(), description: "  Observed a smell  ", ...fields })) form.set(key, value);
  if (bytes) form.set("media", new Blob([bytes as Uint8Array<ArrayBuffer>]), "original.jpg");
  return new Request("http://localhost/api/complaints", { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
}
beforeEach(() => {
  mock = setupAuthMock(); publicDb.client = mock.client;
  vi.mocked(allow).mockReset().mockResolvedValue(true);
  mock.state.tables.complaints = [{ data: null, error: null, count: 0 }, { data: row(), error: null }];
  mock.state.tables.complaints_public = { data: [row()], error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("P3.4 public complaints", () => {
  it("returns unavailable, not fabricated empty data, without a source", async () => {
    publicDb.client = null;
    const response = await GET();
    expect(response.status).toBe(503); expect((await response.json()).complaints).toBeNull();
  });
  it("returns only the public allowlist even if upstream sends personal fields", async () => {
    mock.state.tables.complaints_public = { data: [{ ...row(), user_id: "secret-user", description: "secret-description", media_path: "secret-media", email: "secret-email", flag_reason: "secret-flag" }], error: null };
    const response = await GET(); const body = await response.json();
    expect(response.status).toBe(200); expect(JSON.stringify(body)).not.toContain("secret-");
    expect(Object.keys(body.complaints[0]).sort()).toEqual(PUBLIC_COMPLAINT_FIELDS.split(", ").sort());
    expect(body.complaints[0].lat).toBe(47.123); expect(body.groups[0].count).toBe(1);
    expect(body.measurement).toBe(false); expect(body.kind).toBe("resident-complaint");
  });
  it("returns 503 on DB failure", async () => {
    mock.state.tables.complaints_public = { data: null, error: { message: "private error" } };
    const response = await GET(); expect(response.status).toBe(503); expect(await response.text()).not.toContain("private error");
  });
});

describe("P3.3/P3.4 complaint submission", () => {
  it("rejects missing token before touching the database or rate limiter", async () => {
    expect((await POST(request({}, undefined, null))).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled(); expect(allow).not.toHaveBeenCalled();
  });
  it("applies the IP bucket before parsing the body", async () => {
    vi.mocked(allow).mockResolvedValue(false);
    const req = request(); expect((await POST(req)).status).toBe(429);
    expect(allow).toHaveBeenCalledWith(req, "complaints"); expect(mock.queries).toHaveLength(0);
  });
  it("enforces five per hour before uploads or inserts", async () => {
    mock.state.tables.complaints = { data: null, error: null, count: 5 };
    expect((await POST(request({}, jpegWithGps()))).status).toBe(429);
    expect(calls("insert")).toHaveLength(0); expect(mock.upload).not.toHaveBeenCalled();
    expect(calls("eq")).toContainEqual(["user_id", AUTH_USER_ID]);
  });
  it.each([{ lat: "45" }, { lng: "55" }, { event_at: new Date(Date.now() + 3600e3).toISOString() },
    { event_at: new Date(Date.now() - 31 * 86400e3).toISOString() }, { description: "   " }, { category: "other" }] as Record<string, string>[])("rejects invalid submission %j", async (fields) => {
    expect((await POST(request(fields))).status).toBe(400); expect(calls("insert")).toHaveLength(0);
  });
  it("ignores forged status and owner; response excludes private fields", async () => {
    const response = await POST(request({ status: "resolved", user_id: "forged" }));
    expect(response.status).toBe(200);
    expect(calls("insert")[0][0]).toMatchObject({ user_id: AUTH_USER_ID, description: "Observed a smell" });
    expect(calls("insert")[0][0]).not.toHaveProperty("status");
    const body = await response.json();
    expect(body.complaint).toMatchObject({ id: "complaint-1", status: "submitted" });
    expect(JSON.stringify(body)).not.toMatch(/user_id|description|media_path/);
    expect(body.duplicates).toBe(0);
  });
  it("uploads only sanitized JPEG bytes to the private user folder", async () => {
    expect((await POST(request({}, jpegWithGps()))).status).toBe(200);
    const [path, bytes, options] = mock.upload.mock.calls[0];
    expect(path).toMatch(new RegExp(`^${AUTH_USER_ID}/.*\\.jpg$`));
    expect(new TextDecoder().decode(bytes)).not.toMatch(/Exif|GPS/);
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
    expect(mock.storage.from).toHaveBeenCalledWith("complaint-media");
  });
  it.each([textBytes("bad media"), jpegWithGps().subarray(0, 20)])("rejects unknown or malformed file without uploading", async (bytes) => {
    expect((await POST(request({}, bytes))).status).toBe(400); expect(mock.upload).not.toHaveBeenCalled();
    expect(calls("insert")).toHaveLength(0);
  });
  it("rejects a file over 4 MB", async () => {
    expect((await POST(request({}, new Uint8Array(MAX_MEDIA_BYTES + 1)))).status).toBe(413);
    expect(mock.upload).not.toHaveBeenCalled();
  });
  it("maps DB-enforced rate limits to 429", async () => {
    mock.state.tables.complaints = [{ data: null, error: null, count: 0 }, { data: null, error: { message: "complaint_rate_limit" } }];
    expect((await POST(request())).status).toBe(429);
  });
  it("sanitizes other insert errors", async () => {
    mock.state.tables.complaints = [{ data: null, error: null, count: 0 }, { data: null, error: { message: "secret SQL detail" } }];
    const response = await POST(request()); expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: COMPLAINT_ERRORS.unavailable });
  });
  it("fails closed on count or storage failures", async () => {
    mock.state.tables.complaints = { data: null, count: null, error: { message: "private count" } };
    expect((await POST(request())).status).toBe(503); expect(calls("insert")).toHaveLength(0);
    mock.state.tables.complaints = { data: null, count: 0, error: null };
    mock.state.storageError = { message: "storage unavailable" };
    expect((await POST(request({}, jpegWithGps()))).status).toBe(503); expect(calls("insert")).toHaveLength(0);
  });
  it("returns unknown duplicate count if the source fails", async () => {
    mock.state.tables.complaints_public = { data: null, error: { message: "unavailable" } };
    const response = await POST(request()); expect(response.status).toBe(200);
    expect((await response.json()).duplicates).toBeNull();
  });
});
