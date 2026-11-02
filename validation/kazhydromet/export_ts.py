"""extracted.csv + results.json → src/data/kazhydrometAtyrau.ts

Сайттағы «Ауа» қабаты Қазгидромет посттарының соңғы айлық өлшемін және
CAMS-тың Атыраудағы дәлелденген ауытқуын осы файлдан оқиды.
Жаңа бюллетень шыққанда: validate_kazhydromet.py → export_ts.py.
"""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
OUT = HERE.parent.parent / "src" / "data" / "kazhydrometAtyrau.ts"
# ҚР ШРК (мкг/м³), бюллетеньдегі еселікпен тексерілген
PDK_SS = {"so2": 50, "co": 3000, "no2": 40, "no": 60, "h2s": None}
PDK_MR = {"so2": 500, "co": 5000, "no2": 200, "no": 400, "h2s": 8}


def fmt_series(series: dict) -> str:
    parts = []
    for gid, rows in series.items():
        body = ",\n".join("    " + json.dumps(r, ensure_ascii=False) for r in rows)
        parts.append(f"  {gid}: [\n{body},\n  ]")
    return "{\n" + ",\n".join(parts) + ",\n}"


def main() -> None:
    ex = pd.read_csv(HERE / "extracted.csv")
    res = json.loads((HERE / "results.json").read_text())["summary"]
    months = sorted(ex["month"].unique())
    series = {}
    for gid in PDK_MR:
        rows = []
        for _, r in ex[ex["gas"] == gid].sort_values("month").iterrows():
            ss = r["mean_x_pdk_ss"]
            mean = ss * PDK_SS[gid] if PDK_SS[gid] and pd.notna(ss) else r["mean_mg_m3"] * 1000
            mx = r["max_mg_m3"] * 1000 if pd.notna(r["max_mg_m3"]) else None
            rows.append({
                "month": r["month"], "meanUg": round(float(mean), 2),
                "maxUg": None if mx is None else round(float(mx), 1),
                "maxXPdkMr": None if pd.isna(r["max_x_pdk_mr"]) else float(r["max_x_pdk_mr"]),
                "page": int(r["page"]), "url": r["source_url"],
            })
        series[gid] = rows
    validation = {}
    for gid, s in res.items():
        if s.get("cams", 1) is None or not s.get("n"):
            continue
        validation[gid] = {"n": s["n"], "obsOverCams": round(s["median_obs_over_cams"], 1),
                           "nmb": round(s["nmb"], 3), "pass": s["pass"]}
    ts = f"""// ⚠️ АВТОМАТТЫ ЖАСАЛҒАН ФАЙЛ — қолмен өзгертпе.
// Көзі: validation/kazhydromet (export_ts.py). РМК «Қазгидромет» Атырау
// филиалының ай сайынғы жария бюллетеньдері, «г. Атырау» кестесі (қаланың
// 6 постының жиынтығы). 🛰 ӨЛШЕМ деңгейі — бірақ ТІРІ ЕМЕС: бюллетень
// ~1–1.5 ай кешігіп жарияланады. Тек Атырау аймағына қолданылады.

export type KzhGas = "so2" | "co" | "no2" | "no" | "h2s";

export interface KzhMonth {{
  month: string; // YYYY-MM
  meanUg: number; // айлық орташа, мкг/м³
  maxUg: number | null; // максималды бір реттік, мкг/м³
  maxXPdkMr: number | null; // максималды бір реттік / ҚР ШРК м.р.
  page: number; // бюллетеньдегі бет
  url: string; // бюллетень PDF
}}

export const KZH_PERIOD = {{ from: "{months[0]}", to: "{months[-1]}", bulletins: {len(months)} }};

export const KZH_ATYRAU: Record<KzhGas, KzhMonth[]> = {fmt_series(series)};

/**
 * CAMS-тың Атыраудағы ауытқуы (validation/kazhydromet/results.md).
 * obsOverCams — посттар / CAMS айлық орташа қатынасының медианасы.
 */
export const KZH_CAMS_VALIDATION: Partial<Record<KzhGas, {{ n: number; obsOverCams: number; nmb: number; pass: boolean }}>> = {json.dumps(validation, indent=2)};

export function latestKzh(gas: KzhGas): KzhMonth | null {{
  const s = KZH_ATYRAU[gas];
  return s.length ? s[s.length - 1] : null;
}}
"""
    OUT.write_text(ts)
    print(f"жазылды: {OUT} ({len(months)} ай)")


if __name__ == "__main__":
    main()
