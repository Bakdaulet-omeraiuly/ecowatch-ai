// WorldPop 2020 (wpgppop, 100 м, CC BY 4.0) — басымдық торының әр 1 км ұяшығындағы халық саны.
// Дереккөз: WorldPop REST stats API (api.worldpop.org), University of Southampton.
// Тор басымдық торымен БІРДЕЙ (src/lib/priorityGrid.ts → buildCells), ұяшық id-лері сәйкес.
// API-ге жүктеме аз болсын: 3 параллель сұраныс. Сәтсіз ұяшық → null (нөл емес), файлға жазылады.
//   node --no-warnings --experimental-strip-types --import ./scripts/lib/register-alias.mjs scripts/fetch-worldpop-grid.mjs
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { buildCells } from "../src/lib/priorityGrid.ts";
import { GREEN_CITY_BBOX } from "../src/data/greenery.ts";

const OUT = new URL("../public/data/layers/population-grid-atyrau.json", import.meta.url);
const API = "https://api.worldpop.org/v1/services/stats";
const cells = buildCells(GREEN_CITY_BBOX.atyrau);

async function popFor([w, s, e, n]) {
  const geojson = JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] } }] });
  const url = `${API}?dataset=wpgppop&year=2020&runasync=false&geojson=${encodeURIComponent(geojson)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      const text = await res.text();
      const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));   // API JSON-ның алды-артына PHP ескертулерін қосады
      const v = j?.data?.total_population;
      if (!j.error && typeof v === "number" && Number.isFinite(v)) return v;
    } catch { /* қайталау */ }
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
  return null;
}

// Бар файл болса — тек бос (null) ұяшықтар қайта сұралады (`--retry`)
const prev = process.argv.includes("--retry") && existsSync(OUT) ? new Map(JSON.parse(readFileSync(OUT, "utf8")).cells.map((c) => [c.id, c.population])) : null;
const out = cells.map((c) => ({ id: c.id, population: prev?.get(c.id) ?? null }));
const todo = out.map((c, i) => (c.population == null ? i : -1)).filter((i) => i >= 0);
let next = 0, done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < todo.length) {
    const i = todo[next++];
    out[i] = { id: cells[i].id, population: await popFor(cells[i].bbox) };
    if (++done % 50 === 0) console.log(`${done}/${todo.length}`);
  }
}));
const ok = out.filter((c) => c.population != null);
const total = ok.reduce((a, c) => a + c.population, 0);
writeFileSync(OUT, JSON.stringify({
  fetchedAt: new Date().toISOString(),
  source: "WorldPop 2020, Global per-country unconstrained 100 m (wpgppop) · api.worldpop.org · CC BY 4.0",
  citation: "WorldPop (www.worldpop.org — School of Geography and Environmental Science, University of Southampton). 2018. Global High Resolution Population Denominators Project. doi:10.5258/SOTON/WP00645",
  year: 2020, cellKm: 1, cells: out, okCells: ok.length, totalPopulation: Math.round(total),
  caveats: [
    "WorldPop — модельденген тор (санақ + спутник ковариаттары), өлшем емес.",
    "Тордағы жалпы сан ресми қала халқынан төмен (жиыны — totalPopulation өрісінде); абсолютті сан ретінде емес, салыстырмалы тығыздық ретінде қолданылады.",
    "2020 жылғы бағалау; жаңа тұрғын аудандар толық көрінбеуі мүмкін.",
  ],
}));
console.log(`✓ ${ok.length}/${cells.length} ұяшық, жиыны ${Math.round(total)}`);
process.exit(ok.length ? 0 : 1);
