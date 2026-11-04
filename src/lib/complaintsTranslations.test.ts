import { readdirSync, readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { DICT } from "./i18n";
import { UI_TR } from "./uiTranslations";
import { COMPLAINT_CATEGORIES, COMPLAINT_STATUSES, COMPLAINT_ERRORS } from "./complaints";

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? sources(`${dir}/${entry.name}`) : /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [readFileSync(`${dir}/${entry.name}`, "utf8")] : []);
}
it("P3.4 complaint UI keys, including dynamic category/status keys, exist in kk/ru/en", () => {
  const source = [...sources("src/app/complaints"), ...sources("src/components/complaints"), readFileSync("src/components/ui/ComplaintBadge.tsx", "utf8"), readFileSync("src/components/layout/Navbar.tsx", "utf8")].join("\n");
  const keys = [...source.matchAll(/"((?:complaints\.|nav\.complaints)[^"]*)"/g)].map((match) => match[1]);
  keys.push(...COMPLAINT_CATEGORIES.map((key) => `complaints.category.${key}`), ...COMPLAINT_STATUSES.map((key) => `complaints.status.${key}`));
  for (const key of keys) for (const lang of ["kk", "ru", "en"] as const) expect(Object.hasOwn(DICT[lang], key), `${lang}: ${key}`).toBe(true);
  for (const key of Object.keys(DICT.kk).filter((key) => key.startsWith("complaints."))) {
    expect(Object.hasOwn(DICT.ru, key)).toBe(true); expect(Object.hasOwn(DICT.en, key)).toBe(true);
  }
  expect(COMPLAINT_STATUSES.map((status) => DICT.kk[`complaints.status.${status}`])).toEqual(["Жіберілді", "Тексерілуде", "Расталды", "Расталмады", "Шешілді"]);
  expect(COMPLAINT_STATUSES.map((status) => DICT.ru[`complaints.status.${status}`])).toEqual(["Отправлено", "На проверке", "Подтверждено", "Не подтверждено", "Решено"]);
});
it("all complaint server errors have UI translations", () => {
  const source = sources("src/app/api/complaints").join("\n");
  const literals = [...source.matchAll(/(?:\{\s*error:\s*|failure\()"([^"\n]+)"/g)].map((match) => match[1]);
  for (const error of [...Object.values(COMPLAINT_ERRORS), ...literals]) expect(Object.hasOwn(UI_TR, error), error).toBe(true);
});
it("complaint displays carry their own badge and no measurement badge; controls are at least 44px", () => {
  const source = [...sources("src/components/complaints"), ...sources("src/app/complaints")].join("\n");
  expect(source).not.toContain("TierBadge"); expect(source).toContain("<ComplaintBadge");
  for (const [tag] of source.matchAll(/<(?:Button|Link|Input)\b[^>]*>/g)) expect(tag).toContain("min-h-[44px]");
  for (const path of ["/complaints", "/complaints/new", "/complaints/mine", "/complaints/review"]) {
    expect(readFileSync("src/components/layout/ScaleScope.tsx", "utf8")).toContain(`"${path}"`);
  }
});
