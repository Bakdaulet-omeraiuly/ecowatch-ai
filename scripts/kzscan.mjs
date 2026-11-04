// Lists visible Kazakh strings that would stay Kazakh when RU is selected.
import fs from "node:fs"; import path from "node:path";
const root = process.argv[2];
const trSrc = fs.readFileSync(path.join(root, "src/lib/uiTranslations.ts"), "utf8");
const keys = new Set([...trSrc.matchAll(/^\s*"((?:[^"\\]|\\.)+)":\s*\{\s*ru:/gm)].map((m) => m[1]));
const KZ = /[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/;
const out = [];
function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f);
  if (fs.statSync(p).isDirectory()) walk(p);
  else if (/\.tsx$/.test(f) && !/\.test\./.test(f)) scan(p); } }
function scan(p) {
  const lines = fs.readFileSync(p, "utf8").split("\n");
  lines.forEach((line, i) => {
    const t = line.trim();
    if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*") || t.startsWith("{/*")) return;
    // JSX text between > and <
    for (const m of line.matchAll(/>([^<>{}]*[әғқңөұүһіӘҒҚҢӨҰҮҺІ][^<>{}]*)</g)) out.push([p, i + 1, "jsx", m[1].trim()]);
    // string literals not inside tr()/t()
    for (const m of line.matchAll(/(?<!tr\(|t\(|tk\()(["`])((?:(?!\1)[^\\]|\\.)*[әғқңөұүһіӘҒҚҢӨҰҮҺІ](?:(?!\1)[^\\]|\\.)*)\1/g)) {
      const s = m[2]; if (keys.has(s)) continue; out.push([p, i + 1, "str", s]);
    }
  });
}
walk(path.join(root, "src/app")); walk(path.join(root, "src/components"));
const byFile = {}; for (const [p] of out) byFile[p] = (byFile[p] ?? 0) + 1;
console.log("TOTAL", out.length); for (const [f, n] of Object.entries(byFile).sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(n, f.replace(root + "/", ""));
fs.writeFileSync(process.argv[3], JSON.stringify(out));
