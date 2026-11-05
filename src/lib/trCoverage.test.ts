import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { UI_TR } from "./uiTranslations";

// Әр tr("...") қазақша мәтінінің ru/en аудармасы болуы керек — әйтпесе RU/EN режимінде қазақша қалады.
// Эмодзи де болмауы керек (кәсіби дизайн ережесі).
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
  });
}
const KZ = /[А-Яа-яӘәҒғҚқҢңӨөҰұҮүІі]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2705}\u{274C}\u{2B50}]/u;

describe("UI мәтіндері", () => {
  const all = files("src");
  it("tr() литералдарының бәрі аударылған", () => {
    const missing = new Set<string>();
    for (const f of all) {
      for (const m of readFileSync(f, "utf8").matchAll(/\btr\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) {
        if (KZ.test(m[1]) && !(m[1] in UI_TR)) missing.add(`${m[1]}  (${f})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
  it("TSX-те эмодзи жоқ (✓/✗ мәтін белгілерінен басқа)", () => {
    const bad = all.flatMap((f) => readFileSync(f, "utf8").split("\n")
      .map((l, i) => ({ l, i }))
      .filter(({ l }) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l) && EMOJI.test(l))
      .map(({ i }) => `${f}:${i + 1}`));
    expect(bad).toEqual([]);
  });
});
