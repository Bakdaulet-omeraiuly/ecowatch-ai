import { test, expect, type Page } from "@playwright/test";

// Эмодзи стикерлері сайтта болмауы керек (кәсіби дизайн ережесі).
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2705}\u{274C}\u{2B50}]/u;
const PAGES = ["/", "/dashboard", "/alerts", "/methodology", "/health", "/validation", "/legislation", "/complaints", "/status"];

async function visibleText(page: Page) {
  return page.locator("main, #main, body").first().innerText();
}

for (const path of PAGES) {
  test(`${path}: тақырып бар, эмодзи жоқ`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(400);
    await expect(page.locator("h1").first()).toBeVisible();
    await page.waitForTimeout(1500);
    const text = await visibleText(page);
    const hit = text.match(EMOJI);
    expect(hit, `эмодзи табылды: ${hit?.[0]}`).toBeNull();
  });
}

test("басты бет: қауіп карточкасы (немесе шынайы қате) және рөл жолдары", async ({ page }) => {
  await page.goto("/");
  const risk = page.locator("#risk-title");
  const err = page.getByRole("alert");
  await expect(risk.or(err).first()).toBeVisible({ timeout: 40_000 });
  for (const href of ["/map?tool=journal", "/map?tool=area", "/complaints/new"]) {
    await expect(page.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
});

test("ескертулер беті органға «автоматты жіберілді» деп өтірік айтпайды", async ({ page }) => {
  await page.goto("/alerts");
  const text = await visibleText(page);
  expect(text).not.toMatch(/автоматты жіберілген|Демо режимі|Қабылданды/);
  expect(text).toMatch(/автоматты жіберілмейді/);
});

test("аналитика: бет мазмұнының сілтемелері бөлімдерге апарады", async ({ page }) => {
  await page.goto("/dashboard");
  const toc = page.getByRole("navigation", { name: /Бет мазмұны/ });
  await expect(toc).toBeVisible();
  for (const id of ["live", "sources", "legal", "export"]) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test("әдістеме: «Карта құралдары» бөлімі тіркелген", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByText("Карта құралдары").first()).toBeVisible();
});

test("карта: ?tool=area құрал панелін ашады", async ({ page }) => {
  await page.goto("/map?tool=area");
  await expect(page.getByRole("button", { name: /Картада сызу/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /GeoJSON\/KML жүктеу/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Аймақ есебі/ })).toHaveAttribute("aria-selected", "true");
});

test("карта: басымдық құралы статикалық тордан жүктеледі", async ({ page }) => {
  await page.goto("/map?tool=priority");
  await expect(page.getByText(/Ең жоғары 10 ұяшық/)).toBeVisible({ timeout: 20_000 });
});

test("API: аймақ есебі жарамсыз полигонды 400-пен қайтарады, мок бермейді", async ({ request }) => {
  const r = await request.post("/api/area-report", { data: { ring: [[10, 10], [10.02, 10], [10.02, 10.02]], metric: "ndvi" } });
  expect(r.status()).toBe(400);
  const j = await r.json();
  expect(j.error).toMatch(/Атырау облысының/);
});

test("API: журнал кірмеген адамға жабық", async ({ request }) => {
  const r = await request.get("/api/field-entries");
  expect([401, 503]).toContain(r.status());
});

test.describe("мобильді", () => {
  test("мәзір түймесі навигацияны ашады", async ({ page, isMobile }) => {
    test.skip(!isMobile, "тек телефон");
    await page.goto("/");
    const nav = page.locator("#site-nav");
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: /Мәзір/ }).click();
    await expect(nav.getByRole("link", { name: "Аналитика" })).toBeVisible();
  });
});

test("API: кері траектория тарихи уақытқа да есептеледі (Open-Meteo мұрағаты)", async ({ request }) => {
  const r = await request.get("/api/back-trajectory?lat=47.11&lng=51.92&hours=3&at=2025-06-01T12:00:00Z");
  expect(r.status()).toBe(200);
  const j = await r.json();
  expect(j.tier).toBe("model");
  expect(j.points.length).toBeGreaterThan(1);
  expect(j.source).toMatch(/Historical/);
});

test("карта: шағымдар құралы ашылады (дерек болмаса — шынайы хабар)", async ({ page }) => {
  await page.goto("/map?tool=complaints");
  await expect(page.getByText(/топ ·|қолжетімсіз|жария шағым жоқ/).first()).toBeVisible({ timeout: 20_000 });
});

// Негізгі сценарий нақты картада (Mapbox кілті бар орта керек — продакшн):
// полигон сызу → «Жер пайдалану мен табиғат» есебі → нәтиже кестесі.
test("карта: полигон сызу → аймақ есебі (OSM)", async ({ page, isMobile }) => {
  test.skip(isMobile || !/ecojaiyq\.com/.test(process.env.BASE_URL ?? ""), "тек продакшн, компьютер");
  await page.goto("/map?tool=area");
  await page.waitForSelector(".mapboxgl-canvas", { timeout: 30_000 });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: /Картада сызу/ }).click();
  const box = (await page.locator(".mapboxgl-canvas").boundingBox())!;
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  for (const [dx, dy] of [[-40, -40], [40, -40], [40, 40], [-40, 40]]) await page.mouse.click(cx + dx, cy + dy);
  await expect(page.getByText(/Төбелер: 4/)).toBeVisible();
  await page.getByText("Жер пайдалану мен табиғат").click();
  await page.getByRole("button", { name: /Есеп шығару/ }).click();
  await expect(page.getByText(/Тор-сынама қадамы|OSM-да белгіленген санат жоқ|облысының ішінде/).first()).toBeVisible({ timeout: 30_000 });
});
