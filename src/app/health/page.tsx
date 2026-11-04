import fs from "node:fs";
import path from "node:path";
import { HealthView, type AirAnnual } from "@/components/health/HealthView";

// Server part: annual means of the Kazhydromet monthly bulletins (validation/kazhydromet,
// read-only) — the only ground-measured air series for Atyrau. A year counts only if all
// 12 months are present, so partial years never enter the correlation.
function airAnnual(): AirAnnual[] {
  const file = path.join(process.cwd(), "validation/kazhydromet/extracted.csv");
  if (!fs.existsSync(file)) return [];
  const rows = fs.readFileSync(file, "utf8").trim().split("\n").slice(1);
  const acc: Record<string, Record<string, number[]>> = {};
  for (const line of rows) {
    const [month, gas, , mean] = line.split(",");
    const v = Number(mean);
    if (!Number.isFinite(v)) continue;
    ((acc[gas] ??= {})[month.slice(0, 4)] ??= []).push(v);
  }
  const out: AirAnnual[] = [];
  for (const [gas, years] of Object.entries(acc))
    for (const [year, vals] of Object.entries(years))
      if (vals.length === 12) out.push({ gas, year: Number(year), meanMgM3: +(vals.reduce((a, b) => a + b, 0) / 12).toFixed(4) });
  return out;
}

export default function Page() {
  return <HealthView air={airAnnual()} />;
}
