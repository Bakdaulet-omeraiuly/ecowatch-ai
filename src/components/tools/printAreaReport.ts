// Аймақ есебінің басып шығаруға/PDF-ке арналған беті (жаңа терезеде, сыртқы ресурссыз).
// Мәндер — серверден келген нәтиженің өзі; ештеңе қайта есептелмейді.
import type { LngLat } from "@/lib/areaGeo";

const esc = (v: unknown) => String(v ?? "—").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export interface PrintInput {
  title: string;
  metricLabel: string;
  tierLabel: string;
  areaKm2: number;
  window?: { from: string; to: string };
  header: string[];
  rows: (string | number | null)[][];
  summary?: string;
  source: string;
  caveats: string[];
  ring: LngLat[];
  labels: { generated: string; area: string; period: string; source: string; caveats: string; polygon: string; tier: string; note: string };
}

export function printAreaReport(p: PrintInput) {
  const w = window.open("", "_blank", "noopener=no,width=900,height=1000");
  if (!w) return false;
  const now = new Date().toLocaleString("ru-RU", { timeZone: "Asia/Atyrau" });
  const html = `<!doctype html><html lang="kk"><head><meta charset="utf-8"><title>${esc(p.title)}</title>
<style>
 body{font:13px/1.45 "PT Sans",Arial,sans-serif;color:#1f2933;margin:28px;max-width:820px}
 h1{font-size:20px;color:#0b3a6b;margin:0 0 4px} h2{font-size:14px;margin:18px 0 6px;color:#0b3a6b}
 table{border-collapse:collapse;width:100%} th,td{border:1px solid #d4d4d4;padding:4px 6px;text-align:left} th{background:#f5f5f5}
 td.n{text-align:right;font-variant-numeric:tabular-nums} .meta{color:#4a5563} .tier{display:inline-block;border:1px solid #0b3a6b;color:#0b3a6b;padding:1px 6px;border-radius:3px;font-size:12px}
 ul{margin:4px 0 0 18px;padding:0} .coords{font:11px/1.4 monospace;word-break:break-all;color:#4a5563}
 @media print{body{margin:12mm}}
</style></head><body>
<h1>${esc(p.title)}</h1>
<div class="meta">${esc(p.labels.generated)}: ${esc(now)} (Атырау) · ecojaiyq.com</div>
<p><b>${esc(p.metricLabel)}</b> · <span class="tier">${esc(p.labels.tier)}: ${esc(p.tierLabel)}</span><br>
${esc(p.labels.area)}: ${p.areaKm2 < 1 ? `${(p.areaKm2 * 100).toFixed(2)} га` : `${p.areaKm2.toFixed(3)} км²`}${p.window ? ` · ${esc(p.labels.period)}: ${esc(p.window.from)} — ${esc(p.window.to)}` : ""}</p>
${p.summary ? `<p>${esc(p.summary)}</p>` : ""}
<table><thead><tr>${p.header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>
${p.rows.map((r) => `<tr>${r.map((c) => `<td class="${typeof c === "number" ? "n" : ""}">${esc(c)}</td>`).join("")}</tr>`).join("\n")}
</tbody></table>
<h2>${esc(p.labels.source)}</h2><p>${esc(p.source)}</p>
<h2>${esc(p.labels.caveats)}</h2><ul>${p.caveats.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
<h2>${esc(p.labels.polygon)}</h2><div class="coords">${p.ring.map(([x, y]) => `${y.toFixed(5)}, ${x.toFixed(5)}`).join(" · ")}</div>
<p class="meta" style="margin-top:18px">${esc(p.labels.note)}</p>
<script>window.onload=function(){window.print()}</script>
</body></html>`;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
