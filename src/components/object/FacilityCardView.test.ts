import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Facility } from "@/data/facilities";
import { buildFacilityCard, DEREK_JOQ } from "@/lib/facilityCard";
import { FacilityCardView } from "./FacilityCardView";

// P2.1 / P2.5: карточка HTML-і (React SSR) — «Дерек жоқ», көздер саны мен масса бөлек.
// vitest `node` ортасында DOM жоқ, сондықтан renderToStaticMarkup қолданамыз.

const base: Facility = {
  id: "t", name: "Тест зауыты", short: "Т", lat: 47.1, lng: 51.9,
  kind: "Мұнай өңдеу", profile: { so2: 0.5, no2: 0.5, pm: 0.5, voc: 0.5 },
};

const render = (f: Facility, compact = false) =>
  renderToStaticMarkup(createElement(FacilityCardView, { card: buildFacilityCard(f), compact }));

// Жол (dt) → оның мәні (dd) ішіндегі HTML
function rowValue(html: string, label: string): string {
  const m = html.match(new RegExp(`${label}</dt><dd[^>]*>([\\s\\S]*?)</dd>`));
  if (!m) throw new Error(`жол табылмады: ${label}`);
  return m[1];
}

describe("P2.1: карточка — жазба жоқ болса барлық жол 'Дерек жоқ'", () => {
  it("көздер саны, масса, заттар, бекеттер, оқиғалар — барлығы «Дерек жоқ»", () => {
    const html = render(base);
    expect(rowValue(html, "Шығарынды көздерінің саны")).toContain(DEREK_JOQ);
    expect(rowValue(html, "Шығарынды массасы")).toContain(DEREK_JOQ);
    // заттар/бекеттер/оқиғалар тізімдері: әр бөлімде «Дерек жоқ» бар
    expect(html.split(DEREK_JOQ).length - 1).toBeGreaterThanOrEqual(6);
    // жоқ сандар көрінбейді: дана/т/кезең белгісі жоқ
    const text = (label: string) => rowValue(html, label).replace(/<[^>]+>/g, "");
    expect(text("Шығарынды көздерінің саны")).not.toMatch(/\d/);
    expect(text("Шығарынды массасы")).not.toMatch(/\d/);
  });

  it("P2.5: «ықтимал көз, дәлелденбеген» жазуы бар (толық және ықшам)", () => {
    expect(render(base)).toContain("Ықтимал көз, дәлелденбеген");
    expect(render(base, true)).toContain("Ықтимал көз, дәлелденбеген");
  });

  it("көздер саны бар, масса жоқ → масса жолында сан жоқ, көздер жолында 12777 бар", () => {
    const html = render({
      ...base,
      record: { emissionSources: { count: 12777, source: "Реестр", date: "2025-01-01" } },
    });
    expect(rowValue(html, "Шығарынды көздерінің саны")).toContain("12777");
    expect(rowValue(html, "Шығарынды массасы")).not.toContain("12777");
    expect(rowValue(html, "Шығарынды массасы")).toContain(DEREK_JOQ);
  });

  it("масса бар, көздер саны жоқ → көздер жолында масса мәні жоқ, масса жолында 340 бар", () => {
    const html = render({
      ...base,
      record: { emissionMass: { value: 340, unit: "т/жыл", period: "2024", source: "Есеп", date: "2025-03-01" } },
    });
    expect(rowValue(html, "Шығарынды массасы")).toContain("340");
    expect(rowValue(html, "Шығарынды көздерінің саны")).not.toContain("340");
    expect(rowValue(html, "Шығарынды көздерінің саны")).toContain(DEREK_JOQ);
  });

  it("дереккөз күні жоқ → «Дерек жоқ» (күнді ойдан қосу жоқ)", () => {
    const html = render({ ...base, coordSource: "Global Energy Monitor" });
    expect(html).toContain("Global Energy Monitor");
    expect(html).toContain(`Global Energy Monitor · ${DEREK_JOQ}`);
  });
});
