import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH, DELETE } from "./route";
import { authRequest, setupAuthMock } from "@/lib/test/authMock";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
beforeEach(() => { mock = setupAuthMock(); });
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

const context = () => ({ params: Promise.resolve({ id: "report-1" }) });
const validBody = { verification_status: "confirmed" };

describe("P3.1 moderation authorization", () => {
  for (const [method, handler] of [["PATCH", PATCH], ["DELETE", DELETE]] as const) {
    it(`${method} without token → 401 without report access`, async () => {
      const res = await handler(authRequest(method, method === "PATCH" ? validBody : undefined, null), context());
      expect(res.status).toBe(401);
      expect(mock.from).not.toHaveBeenCalled();
    });
    it.each(["resident", "scientist"])(`${method} %s → 403 without a write`, async (role) => {
      mock.state.role = role;
      expect((await handler(authRequest(method, method === "PATCH" ? validBody : undefined), context())).status).toBe(403);
      expect(mock.from).not.toHaveBeenCalledWith("reports");
      expect(mock.reports.update).not.toHaveBeenCalled();
      expect(mock.reports.delete).not.toHaveBeenCalled();
    });
    it.each(["officer", "admin"])(`${method} %s → 200`, async (role) => {
      mock.state.role = role;
      const res = await handler(authRequest(method, method === "PATCH" ? validBody : undefined), context());
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });
      expect(mock.mutation.eq).toHaveBeenCalledWith("id", "report-1");
      expect(mock.mutation.select).toHaveBeenCalledWith("id");
      if (method === "PATCH") expect(mock.reports.update).toHaveBeenCalledWith(validBody);
      else expect(mock.reports.delete).toHaveBeenCalledOnce();
    });
    it(`${method} no affected rows → 404`, async () => {
      mock.state.role = "officer";
      mock.state.reportRows = [];
      expect((await handler(authRequest(method, method === "PATCH" ? validBody : undefined), context())).status).toBe(404);
    });
    it(`${method} DB error is sanitized`, async () => {
      mock.state.role = "officer";
      mock.state.mutationError = { message: "private database detail" };
      vi.spyOn(console, "error").mockImplementation(() => {});
      const res = await handler(authRequest(method, method === "PATCH" ? validBody : undefined), context());
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: "Дерекқор қатесі" });
    });
  }
  it("unauthenticated invalid JSON → 401 before parsing", async () => {
    const res = await PATCH(new Request("http://localhost", { method: "PATCH", body: "{" }), context());
    expect(res.status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each([{}, { verification_status: "invalid" }])("officer invalid schema → 400", async (body) => {
    mock.state.role = "officer";
    expect((await PATCH(authRequest("PATCH", body), context())).status).toBe(400);
    expect(mock.reports.update).not.toHaveBeenCalled();
  });
  it("officer malformed JSON → 400", async () => {
    mock.state.role = "officer";
    const req = new Request("http://localhost", { method: "PATCH", headers: { Authorization: "Bearer token" }, body: "{" });
    expect((await PATCH(req, context())).status).toBe(400);
  });
});
