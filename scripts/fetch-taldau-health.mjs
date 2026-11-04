// Rebuilds src/data/health/atyrau-mortality.json from the official Taldau API
// (Bureau of National Statistics, taldau.stat.gov.kz). Run: node scripts/fetch-taldau-health.mjs
// Aggregated official counts only — no individual records exist in this source.
import fs from "node:fs";

const UA = { "User-Agent": "Jaiyq/1.0 (+https://ecojaiyq.com)" };
const API = "https://taldau.stat.gov.kz/ru/Api";
const AREAS = { "АТЫРАУ Г.А.": "atyrau_city", "АТЫРАУСКАЯ ОБЛАСТЬ": "atyrau_oblast" };
const CAUSES = { "Болезни органов дыхания": "respiratory", "Болезни системы кровообращения": "circulatory", "Всего": "all" };

async function data(id, dics) {
  const r = await fetch(`${API}/GetIndexData/${id}?period=7&dics=${dics}`, { headers: UA });
  if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
  return r.json();
}
const year = (p) => Number(p.name.slice(0, 4));

const deaths = await data(703854, "67,749,726");   // Умершие по основным классам причин смерти
const pop = await data(703834, "67,749,576,1433");  // Среднегодовая численность населения
const out = {};
for (const [name, area] of Object.entries(AREAS)) {
  out[area] = { name, population: {}, deaths: {} };
  for (const r of pop) {
    const [reg, loc, sex, grp] = r.termNames;
    if (reg === name && loc === "Всего" && sex === "Всего" && grp === "Все группы")
      for (const p of r.periods) out[area].population[year(p)] = Math.round(Number(p.value));
  }
  for (const r of deaths) {
    const [reg, loc, cause] = r.termNames;
    const key = CAUSES[cause];
    if (reg === name && loc === "Всего" && key) {
      out[area].deaths[key] = {};
      for (const p of r.periods) out[area].deaths[key][year(p)] = Number(p.value);
    }
  }
}
const doc = {
  fetchedAt: new Date().toISOString(),
  source: "Бюро национальной статистики АСПиР РК · Taldau",
  indicators: {
    deaths: { id: 703854, code: "612205", name: "Умершие по основным классам причин смерти", unit: "человек", url: "https://taldau.stat.gov.kz/ru/NewIndex/GetIndex/703854" },
    population: { id: 703834, name: "Среднегодовая численность населения", unit: "человек", url: "https://taldau.stat.gov.kz/ru/NewIndex/GetIndex/703834" },
  },
  areas: out,
};
fs.writeFileSync(new URL("../src/data/health/atyrau-mortality.json", import.meta.url), JSON.stringify(doc, null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { popYears: Object.keys(v.population), causes: Object.keys(v.deaths) }]))));
