import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { DICT } from "./i18n";
import { UI_TR } from "./uiTranslations";
import { AUTH_ERRORS } from "./auth";

it("auth and moderation server errors have exact UI_TR keys", () => {
  const paths = ["src/app/api/moderation/[id]/route.ts", "src/app/api/admin/roles/route.ts", "src/app/api/auth/me/route.ts"];
  const literals = paths.flatMap((path) => [...readFileSync(path, "utf8").matchAll(/error: "([^"]*)"/g)].map((match) => match[1]));
  for (const literal of [...literals, ...Object.values(AUTH_ERRORS)]) {
    expect(Object.keys(UI_TR).includes(literal), literal).toBe(true);
  }
});
it("every auth UI key is translated in kk/ru/en", () => {
  const page = readFileSync("src/app/auth/page.tsx", "utf8") + readFileSync("src/components/layout/Navbar.tsx", "utf8");
  for (const [, key] of page.matchAll(/"(auth\.[^"]+)"/g)) {
    for (const language of ["kk", "ru", "en"] as const) expect(Object.keys(DICT[language]).includes(key), `${language}: ${key}`).toBe(true);
  }
});
