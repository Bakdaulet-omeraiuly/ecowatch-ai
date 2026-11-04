import { expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ select: vi.fn(), order: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => ({ select: mocks.select }) } }));
it("P3.4 legacy public reports select only non-personal columns", async () => {
  mocks.select.mockReturnValue({ order: mocks.order }); mocks.order.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [{ id: "1", lat: 47, lng: 52 }], error: null });
  const response = await GET(); expect(response.status).toBe(200);
  const fields = mocks.select.mock.calls[0][0] as string;
  expect(fields).toBe("id, lat, lng, district, risk_score, risk_level, mosquito_index, analysis, image_url, verification_status, created_at");
  expect(fields).not.toMatch(/\*|name|photo_thumb/);
  expect(await response.text()).not.toMatch(/name|photo_thumb/);
});
