import { defineConfig, devices } from "@playwright/test";

// E2E: құрылым мен шынайылық ережелерін тексереді (дерекке тәуелсіз — кілт жоқ ортада да өтеді).
// BASE_URL=https://www.ecojaiyq.com npx playwright test  — продакшнді тексеру (тек оқу).
// Браузер жүктелмейді: жүйедегі Google Chrome қолданылады (channel: "chrome").
export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3000",
    channel: "chrome",
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
});
