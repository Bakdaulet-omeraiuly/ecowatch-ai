import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UI_TR } from "@/lib/uiTranslations";
import { DispersionFrame } from "./DispersionFrame";

// P2.4: «Модель нәтижесі» белгісі DOM-да ҚАЛАДЫ (сұрланған күйде де), сұрлану — жел жоқта.
const html = (windMissing: boolean) =>
  renderToStaticMarkup(createElement(DispersionFrame, { windMissing }, createElement("span", null, "SLIDER")));

// Match applied classes, not utility names inside a descendant selector such as
// Badge's `[&>svg]:pointer-events-none`, which does not disable the controls.
const hasClass = (markup: string, name: string) =>
  [...markup.matchAll(/class="([^"]*)"/g)].some((m) => m[1].split(/\s+/).includes(name));

describe("P2.4: таралу слайдері — модель белгісі және сұрлану", () => {
  it("«Модель нәтижесі» белгісі екі күйде де бар", () => {
    for (const missing of [false, true]) {
      const out = html(missing);
      expect(out).toContain('data-testid="model-badge"');
      expect(out).toContain("Модель нәтижесі");
    }
  });

  it("жел деректері жоқ → сұрланған, бұғатталған, ескерту бар; балалар (слайдер) сақталған", () => {
    const out = html(true);
    expect(out).toContain('data-wind-missing="true"');
    expect(hasClass(out, "opacity-50")).toBe(true);
    expect(hasClass(out, "grayscale")).toBe(true);
    expect(hasClass(out, "pointer-events-none")).toBe(true);
    expect(out).toContain('aria-disabled="true"');
    expect(out).toContain("inert");
    expect(out).toContain("Жел деректері жоқ");
    expect(out).toContain("SLIDER");
  });

  it("жел деректері бар → сұрланбайды, бұғатталмайды", () => {
    const out = html(false);
    expect(out).toContain('data-wind-missing="false"');
    expect(hasClass(out, "opacity-50")).toBe(false);
    expect(hasClass(out, "pointer-events-none")).toBe(false);
    expect(out).not.toContain("inert");
    expect(out).not.toContain("Жел деректері жоқ");
  });

  it("аударма: ru → «Результат модели», en → «Model output»", () => {
    expect(UI_TR["Модель нәтижесі"]).toEqual({ ru: "Результат модели", en: "Model output" });
  });
});
