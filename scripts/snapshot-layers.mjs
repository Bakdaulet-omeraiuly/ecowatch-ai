// Жер пайдалану / көгалдандыру қабаттарының статикалық көшірмесі (public/data/layers/*.json).
// Неге: Overpass бір қала сұранысына 16–36 с жұмсайды, серверлес жад кэші суық іске қосылуда
// жоғалады → қабат баяу немесе 503. Көшірме CDN-нен бірден жүктеледі.
//
// Бар маршрут өңдеушілерін (src/app/api/*/route.ts) ТІКЕЛЕЙ шақырады — өңдеу логикасы бір жерде.
// Жауап толық (200, stale емес, қате жоқ) болғанда ҒАНА файл жазылады; әйтпесе ескі көшірме
// өзгеріссіз қалады және скрипт қатемен аяқталады. Ойдан дерек жазылмайды.
//
//   OVERPASS_BUDGET_MS=170000 node --no-warnings --experimental-strip-types --import ./scripts/lib/register-alias.mjs scripts/snapshot-layers.mjs [landuse greenery green-change]
import { writeFileSync, mkdirSync } from "node:fs";

const REGION = "atyrau";
const OUT = new URL("../public/data/layers/", import.meta.url);
const ALL = ["landuse", "greenery", "green-change", "priority-grid"];
const want = process.argv.slice(2).length ? process.argv.slice(2) : ALL;

mkdirSync(OUT, { recursive: true });
let failed = 0;
for (const name of want) {
  if (!ALL.includes(name)) { console.error(`белгісіз қабат: ${name}`); failed++; continue; }
  const t0 = Date.now();
  try {
    const { GET } = await import(`../src/app/api/${name}/route.ts`);
    let res, data, lastErr;
    // Overpass жиі «at capacity» — 3 рет, арасы 30 с / 60 с
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 30_000 * attempt));
      res = await GET(new Request(`http://localhost/api/${name}?region=${REGION}`));
      data = await res.json();
      const partial = res.headers.get("cache-control") === "no-store";
      if (res.ok && !data.error && !data.stale && data.available !== false && !partial) { lastErr = null; break; }
      lastErr = `${res.status} ${data.error ?? (partial ? "ішінара нәтиже" : data.stale ? "stale" : "unavailable")}`;
    }
    if (lastErr) throw new Error(lastErr);
    const snap = { ...data, snapshot: { createdAt: new Date().toISOString(), note: "Статикалық көшірме — scripts/snapshot-layers.mjs" } };
    writeFileSync(new URL(`${name}-${REGION}.json`, OUT), JSON.stringify(snap));
    console.log(`✓ ${name}: ${((Date.now() - t0) / 1000).toFixed(1)} с, ${(JSON.stringify(snap).length / 1024).toFixed(0)} КБ`);
  } catch (err) {
    failed++;
    console.error(`✗ ${name}: ${err instanceof Error ? err.message : err} — ескі көшірме өзгеріссіз`);
  }
}
process.exit(failed ? 1 : 0);
