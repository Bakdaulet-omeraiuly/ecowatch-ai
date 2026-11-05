import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// WCAG 2.1 AA: ауыр (serious/critical) бұзушылықтар болмауы керек.
const PAGES = ["/", "/dashboard", "/alerts", "/methodology", "/health", "/validation", "/legislation", "/complaints", "/auth", "/object/anpz", "/map", "/map?tool=area", "/eco-passport", "/report", "/complaints/new"];

for (const path of PAGES) {
  test(`a11y ${path}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "бір рет жеткілікті");
    await page.goto(path);
    // Деректер жүктеліп болсын (қаңқа/жүктеу күйін емес, соңғы бетті тексереміз)
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    const summary = bad.map((v) => `${v.id} (${v.impact}) ×${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
    expect(summary, summary.join("\n")).toEqual([]);
  });
}
