import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// P2.5: дәлелденбеген кінә атауы src-та жоқ (жалғыз «кінә»-лі түрі). Іздеу сөзі
// бөліктерден құрылған — тест файлының өз мәтіні іздеуге түспейді.
const NEEDLE = "кін" + "әлі";
const SRC = fileURLToPath(new URL("../", import.meta.url));
const EXT = /\.(tsx?|jsx?|json|css|md)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : EXT.test(name) ? [p] : [];
  });
}

describe("P2.5: тыйым салынған сөз src-та жоқ", () => {
  it("ешбір файлда жоқ", () => {
    const hits = walk(SRC).filter((f) => readFileSync(f, "utf8").includes(NEEDLE));
    expect(hits).toEqual([]);
  });
});
