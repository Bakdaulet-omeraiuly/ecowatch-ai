import { describe, expect, it } from "vitest";
import { canTransition, COMPLAINT_STATUSES, groupComplaints, PUBLIC_COMPLAINT_FIELDS, STATUS_TRANSITIONS, toPublicComplaint, type PublicComplaint } from "./complaints";

const row = (changes: Partial<PublicComplaint> = {}): PublicComplaint => ({
  id: "a", category: "smell", status: "submitted", event_at: "2026-11-03T10:00:00Z",
  created_at: "2026-11-03T11:00:00Z", lat: 47, lng: 52, ...changes,
});

describe("P3.3 transitions and duplicate grouping", () => {
  const pairs = ["submitted:in_review", "in_review:confirmed", "in_review:not_confirmed", "confirmed:resolved", "not_confirmed:in_review"];
  for (const from of COMPLAINT_STATUSES) for (const to of COMPLAINT_STATUSES) {
    it(`${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(pairs.includes(`${from}:${to}`));
      expect(canTransition(from, to)).toBe(STATUS_TRANSITIONS[from].includes(to));
    });
  }
  it("resolved is terminal", () => expect(STATUS_TRANSITIONS.resolved).toEqual([]));
  it("same category within 400 m and one hour groups", () => {
    expect(groupComplaints([row(), row({ id: "b", lat: 47 + 0.4 / 111.195, event_at: "2026-11-03T11:00:00Z" })]))
      .toEqual([{ id: "a", category: "smell", count: 2, firstAt: "2026-11-03T10:00:00Z", lastAt: "2026-11-03T11:00:00Z", lat: 47, lng: 52, members: ["a", "b"] }]);
  });
  it.each([{ lat: 47 + 0.6 / 111.195 }, { event_at: "2026-11-03T13:00:00Z" }, { category: "smoke" as const }])("separates %j", (change) => {
    expect(groupComplaints([row(), row({ ...change, id: "b" })])).toHaveLength(2);
  });
  it("sorts deterministically without mutating input, with anchor rather than transitive grouping", () => {
    const rows = [row({ id: "c", event_at: "2026-11-03T13:00:00Z" }), row({ id: "b", event_at: "2026-11-03T11:30:00Z" }), row()];
    const before = [...rows];
    expect(groupComplaints(rows)).toEqual(groupComplaints([...rows].reverse()));
    expect(groupComplaints(rows).map((g) => g.members)).toEqual([["a", "b"], ["c"]]);
    expect(rows).toEqual(before);
    expect(groupComplaints([row({ id: "z" }), row()])[0].id).toBe("a");
  });
  it("includes the two-hour boundary and excludes flags", () => {
    expect(groupComplaints([row(), row({ id: "b", event_at: "2026-11-03T12:00:00Z" }), { ...row({ id: "c" }), flagged: true }])[0].count).toBe(2);
  });
});

it("P3.4 public allowlist drops private fields and rounds location", () => {
  const raw = { ...row({ lat: 47.123456, lng: 51.987654 }), user_id: "secret", description: "private", media_path: "private.jpg", flag_reason: "private", email: "private@example.test" };
  const result = toPublicComplaint(raw);
  expect(Object.keys(result).sort()).toEqual(PUBLIC_COMPLAINT_FIELDS.split(", ").sort());
  expect(result.lat).toBe(47.123); expect(result.lng).toBe(51.988);
  expect(JSON.stringify(result)).not.toMatch(/private|secret/);
});
