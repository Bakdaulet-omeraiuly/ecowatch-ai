import { describe, expect, it } from "vitest";
import { GET } from "./route";
import { ANALYSIS_LOGIN_REQUIRED } from "@/lib/features";

describe("export is open while ANALYSIS_LOGIN_REQUIRED is off", () => {
  it("anonymous request reaches dataset validation (400), not 401", async () => {
    expect(ANALYSIS_LOGIN_REQUIRED).toBe(false);
    const res = await GET(new Request("https://jaiyq.test/api/export?dataset=bogus"));
    expect(res.status).toBe(400);
  });
});
