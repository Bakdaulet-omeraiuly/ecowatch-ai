// CSV құрастыру — эколог есебі үшін.
//
// Excel үшін екі нәрсе маңызды:
//  1. BOM (﻿) — онсыз кириллица «крякозябра» болып ашылады
//  2. Нүктелі үтір бөлгіші — көп елдің Excel локалінде үтір ондық белгі,
//     сондықтан үтірмен бөлінген файл бір бағанға жабысып қалады

export type Cell = string | number | boolean | null | undefined;

function escape(v: Cell): string {
  if (v == null) return "";
  const s = typeof v === "boolean" ? (v ? "иә" : "жоқ") : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Cell[][]): string {
  return "﻿" + rows.map((r) => r.map(escape).join(";")).join("\r\n");
}

/** Дереккөз бен ескертулерді файлдың соңына тіркейді — есеп өз бетінше түсінікті болуы үшін. */
export function withProvenance(
  rows: Cell[][],
  meta: {
    dataset: string;
    tier: "Өлшем" | "Модель" | "AI бағалауы";
    source: string;
    fetchedAt: string;
    method?: string;
    caveats?: string[];
  }
): Cell[][] {
  return [
    ...rows,
    [],
    ["ДЕРЕККӨЗ ТУРАЛЫ"],
    ["Деректер жиыны", meta.dataset],
    ["Сенімділік деңгейі", meta.tier],
    ["Дереккөз", meta.source],
    ["Жүктелген уақыты (UTC)", meta.fetchedAt],
    ...(meta.method ? [["Әдіс", meta.method] as Cell[]] : []),
    ...(meta.caveats?.length
      ? [[] as Cell[], ["ЕСКЕРТУЛЕР"] as Cell[], ...meta.caveats.map((c) => [c] as Cell[])]
      : []),
  ];
}

export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
}
