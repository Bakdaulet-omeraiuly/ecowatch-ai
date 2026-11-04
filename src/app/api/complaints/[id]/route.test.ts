import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupAuthMock, authRequest, AUTH_USER_ID } from "@/lib/test/authMock";
import { PATCH } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
let mock: ReturnType<typeof setupAuthMock>;
const context = { params: Promise.resolve({ id: "complaint-1" }) };
const calls = (method: string) => mock.queries.flatMap((query) => query.calls.filter(([name]) => name === method).map(([, args]) => args));
beforeEach(() => {
  mock = setupAuthMock(); mock.state.role = "officer";
  mock.state.tables.complaints = [{ data: { status: "in_review" }, error: null }, { data: [{ id: "complaint-1" }], error: null }];
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("P3.3 staff-only complaint transitions and abuse flags", () => {
  it("requires a token", async () => {
    expect((await PATCH(authRequest("PATCH", {}, null), context)).status).toBe(401);
    expect(mock.from).not.toHaveBeenCalled();
  });
  it.each(["resident", "scientist"])("rejects %s before mutation", async (role) => {
    mock.state.role = role;
    expect((await PATCH(authRequest("PATCH", { status: "confirmed" }), context)).status).toBe(403);
    expect(calls("update")).toHaveLength(0); expect(mock.from).not.toHaveBeenCalledWith("complaints");
  });
  it.each(["officer", "admin"])("allows %s in_review → confirmed with compare-and-set", async (role) => {
    mock.state.role = role;
    expect((await PATCH(authRequest("PATCH", { status: "confirmed" }), context)).status).toBe(200);
    expect(calls("update")).toEqual([[{ status: "confirmed" }]]);
    expect(calls("eq")).toContainEqual(["status", "in_review"]);
  });
  it("rejects submitted → resolved", async () => {
    mock.state.tables.complaints = { data: { status: "submitted" }, error: null };
    expect((await PATCH(authRequest("PATCH", { status: "resolved" }), context)).status).toBe(409);
    expect(calls("update")).toHaveLength(0);
  });
  it("returns 404 for a missing complaint", async () => {
    mock.state.tables.complaints = { data: null, error: null };
    expect((await PATCH(authRequest("PATCH", { status: "confirmed" }), context)).status).toBe(404);
  });
  it("returns conflict if the row changed concurrently", async () => {
    mock.state.tables.complaints = [{ data: { status: "in_review" }, error: null }, { data: [], error: null }];
    expect((await PATCH(authRequest("PATCH", { status: "confirmed" }), context)).status).toBe(409);
  });
  it("flags with a required reason and authenticated actor", async () => {
    mock.state.tables.complaints = { data: [{ id: "complaint-1" }], error: null };
    expect((await PATCH(authRequest("PATCH", { flagged: true, flag_reason: "spam" }), context)).status).toBe(200);
    expect(calls("update")).toEqual([[{ flagged: true, flag_reason: "spam", flagged_by: AUTH_USER_ID }]]);
  });
  it("unflag clears the reason and actor", async () => {
    mock.state.tables.complaints = { data: [{ id: "complaint-1" }], error: null };
    expect((await PATCH(authRequest("PATCH", { flagged: false }), context)).status).toBe(200);
    expect(calls("update")).toEqual([[{ flagged: false, flag_reason: null, flagged_by: null }]]);
  });
  it("combines status and flag in one atomic mutation", async () => {
    expect((await PATCH(authRequest("PATCH", { status: "confirmed", flagged: true, flag_reason: "abuse" }), context)).status).toBe(200);
    expect(calls("update")).toEqual([[{ status: "confirmed", flagged: true, flag_reason: "abuse", flagged_by: AUTH_USER_ID }]]);
  });
  it.each([{ description: "private", status: "confirmed" }, {}, { flagged: true }, { flagged: true, flag_reason: " " }])("rejects invalid body %j", async (body) => {
    expect((await PATCH(authRequest("PATCH", body), context)).status).toBe(400); expect(calls("update")).toHaveLength(0);
  });
  it("maps a DB transition error to 409 and other failures to sanitized 500", async () => {
    for (const [message, status] of [["complaint_bad_transition", 409], ["private SQL", 500]] as const) {
      mock.state.tables.complaints = [{ data: { status: "in_review" }, error: null }, { data: null, error: { message } }];
      const response = await PATCH(authRequest("PATCH", { status: "confirmed" }), context);
      expect(response.status).toBe(status); expect(await response.text()).not.toContain(message);
    }
  });
});
