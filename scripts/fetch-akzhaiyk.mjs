// Rebuilds src/data/protected/akzhaiyk.json from OpenStreetMap relation 14980321
// («Ақжайық» мемлекеттік табиғи резерваты). © OpenStreetMap contributors, ODbL.
// Run: node scripts/fetch-akzhaiyk.mjs
import fs from "node:fs";
const REL = 14980321;
const r = await fetch(`https://api.openstreetmap.org/api/0.6/relation/${REL}/full.json`, { headers: { "User-Agent": "Jaiyq/1.0 (+https://ecojaiyq.com)" } });
if (!r.ok) throw new Error(`OSM HTTP ${r.status}`);
const els = (await r.json()).elements;
const rel = els.find((e) => e.type === "relation" && e.id === REL);
const nodes = new Map(els.filter((e) => e.type === "node").map((n) => [n.id, [+n.lon.toFixed(6), +n.lat.toFixed(6)]]));
const ways = new Map(els.filter((e) => e.type === "way").map((w) => [w.id, w]));
const rings = rel.members.filter((m) => m.type === "way" && m.role === "outer").map((m) => {
  const w = ways.get(m.ref);
  if (w.nodes[0] !== w.nodes.at(-1)) throw new Error(`way ${m.ref} is not closed — assemble manually`);
  return { way: m.ref, ring: w.nodes.map((id) => nodes.get(id)) };
});
const doc = {
  fetchedAt: new Date().toISOString(),
  source: `OpenStreetMap relation ${REL}`, url: `https://www.openstreetmap.org/relation/${REL}`,
  osmVersion: rel.version, osmTimestamp: rel.timestamp, license: "ODbL 1.0", attribution: "© OpenStreetMap contributors",
  tags: rel.tags, rings,
};
fs.writeFileSync(new URL("../src/data/protected/akzhaiyk.json", import.meta.url), JSON.stringify(doc) + "\n");
console.log(rings.map((x) => `${x.way}: ${x.ring.length} pts`).join(", "));
