import { describe, expect, it } from "vitest";
import { UI_TR } from "./uiTranslations";
import { DICT } from "./i18n";

// Аударма кілттерінің толықтығы: әр UI_TR жазбасында ru мен en бос емес.
// kk — кілттің өзі (қазақша түпнұсқа), сондықтан оны тексеру мәнсіз.
describe("UI_TR кілттері", () => {
  it("әр жазбада ru және en бар және бос емес", () => {
    const bad = Object.entries(UI_TR)
      .filter(([, v]) => !v || !v.ru?.trim() || !v.en?.trim())
      .map(([k]) => k);
    expect(bad).toEqual([]);
  });
});

// DICT: kk-дегі әр кілт ru және en-де бар болуы керек.
describe("DICT кілттері", () => {
  it("kk кілттері ru/en-де бар", () => {
    const kk = Object.keys(DICT.kk);
    const missing = {
      ru: kk.filter((k) => !(k in DICT.ru)),
      en: kk.filter((k) => !(k in DICT.en)),
    };
    expect(missing).toEqual({ ru: [], en: [] });
  });
});
