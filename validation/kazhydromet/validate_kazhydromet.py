"""Валидация №3 — Атырау: CAMS (SO2, CO, NO2, NO) Қазгидромет бюллетеньдеріне
қарсы; H2S — сипаттама. Хаттама: PROTOCOL.md.

    python3 -I validate_kazhydromet.py      (pymupdf, pandas, numpy керек)

Шығыс: extracted.csv (бюллетеньнен оқылған әр мән + бет нөмірі),
monthly_pairs.csv, results.json, results.md.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import pymupdf

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (jaiyq-validation research)"}
SITE = "https://www.kazhydromet.kz"
LIST = SITE + "/ru/ecology/ezhemesyachnyy-informacionnyy-byulleten-o-sostoyanii-okruzhayuschey-sredy/{y}"
YEARS = (2024, 2025, 2026)
LAT, LON = 47.1167, 51.8833  # сайттағы Атырау координатасы
MONTHS = {"yanvar": 1, "fevral": 2, "mart": 3, "aprel": 4, "may": 5, "iyun": 6, "iyul": 7,
          "avgust": 8, "sentyabr": 9, "oktyabr": 10, "noyabr": 11, "dekabr": 12}
GASES = {  # бюллетеньдегі атауы → (id, CAMS айнымалысы)
    "Диоксид серы": ("so2", "sulphur_dioxide"),
    "Оксид углерода": ("co", "carbon_monoxide"),
    "Диоксид азота": ("no2", "nitrogen_dioxide"),
    "Оксид азота": ("no", "nitrogen_monoxide"),
    "Сероводород": ("h2s", None),
}
NMB_MAX, NME_MAX, MIN_N_FOR_R = 0.30, 0.50, 8


def get(url: str) -> bytes:
    for i in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == 3:
                raise RuntimeError(f"{url}: {e}") from None
            time.sleep(3 * 2 ** i)
    raise AssertionError


def bulletin_links() -> dict[str, str]:
    out = {}
    for y in YEARS:
        html = get(LIST.format(y=y)).decode("utf-8", "ignore")
        for href in set(re.findall(r'href="([^"]*atyrau[^"]*\.pdf)"', html, re.I)):
            name = href.rsplit("/", 1)[-1].lower()
            if "kv" in name or "polugod" in name or re.search(r"za-20\d\dg?\.pdf$", name):
                continue  # тоқсандық / жартыжылдық / жылдық — айлық емес
            m = next((v for k, v in MONTHS.items() if re.search(rf"[-_]{k}[-_.]", name)), None)
            if m is None:
                print(f"  ай анықталмады: {name}", file=sys.stderr)
                continue
            out[f"{y}-{m:02d}"] = SITE + href
    return dict(sorted(out.items()))


def num(s: str) -> float | None:
    s = s.strip().replace(",", ".").replace(" ", "")
    try:
        return float(s)
    except ValueError:
        return None


def parse(pdf: Path, month: str) -> list[dict]:
    doc = pymupdf.open(pdf)
    lines: list[tuple[int, str]] = []
    for pno, page in enumerate(doc, 1):
        lines += [(pno, ln) for ln in page.get_text().split("\n")]
    # «г. Атырау» кестесінің басы: келесі мағыналы жол «Взвешенные...»
    start = None
    for i, (_, ln) in enumerate(lines):
        if re.fullmatch(r"\s*г\.\s*Атырау\s*", ln):
            nxt = next((x for _, x in lines[i + 1:i + 6] if x.strip()), "")
            if nxt.strip().startswith("Взвешенные") or any(g in nxt for g in GASES):
                start = i
                break
    if start is None:
        return [{"month": month, "gas": g[0], "error": "кесте табылмады"} for g in GASES.values()]
    rows = []
    for name, (gid, _) in GASES.items():
        idx = next((i for i in range(start, min(start + 400, len(lines)))
                    if lines[i][1].strip() == name), None)
        if idx is None:
            rows.append({"month": month, "gas": gid, "error": "жол табылмады"})
            continue
        cells = [lines[idx + k][1] for k in range(1, 5)]
        rows.append({"month": month, "gas": gid, "page": lines[idx][0],
                     "mean_mg_m3": num(cells[0]), "mean_x_pdk_ss": num(cells[1]),
                     "max_mg_m3": num(cells[2]), "max_x_pdk_mr": num(cells[3]),
                     "raw": " | ".join(c.strip() for c in cells)})
    return rows


def cams_monthly() -> pd.DataFrame:
    cache = DATA / "cams_atyrau.json"
    if not cache.exists():
        vars_ = ",".join(v for _, v in GASES.values() if v)
        url = ("https://air-quality-api.open-meteo.com/v1/air-quality"
               f"?latitude={LAT}&longitude={LON}&hourly={vars_}&start_date=2024-01-01&end_date=2026-04-30&timezone=Asia%2FAqtobe")
        cache.write_bytes(get(url))
    h = json.loads(cache.read_text())["hourly"]
    df = pd.DataFrame({k: v for k, v in h.items() if k != "time"}, index=pd.to_datetime(h["time"]))
    g = df.groupby(df.index.to_period("M"))
    cnt, mean = g.count(), g.mean()
    expected = g.size()
    mean[cnt.lt(0.75 * expected.to_numpy()[:, None])] = np.nan
    mean.index = mean.index.astype(str)
    return mean


def main() -> None:
    links = bulletin_links()
    print(f"{len(links)} айлық бюллетень", file=sys.stderr)
    rows = []
    for month, url in links.items():
        pdf = DATA / f"atyrau_{month}.pdf"
        if not pdf.exists():
            pdf.write_bytes(get(url))
        for r in parse(pdf, month):
            rows.append(r | {"source_url": url})
    ex = pd.DataFrame(rows)
    ex.to_csv(HERE / "extracted.csv", index=False)

    cams = cams_monthly()
    pairs, summary = [], {}
    for name, (gid, var) in GASES.items():
        obs = ex[ex["gas"] == gid].set_index("month")["mean_mg_m3"] * 1000  # → мкг/м³
        if var is None:
            summary[gid] = {"cams": None, "months": int(obs.notna().sum()),
                            "obs_mean_ug": float(obs.mean()),
                            "max_x_pdk_mr_max": float(ex[ex["gas"] == gid]["max_x_pdk_mr"].max())}
            continue
        mod = cams[var]
        j = pd.concat({"obs": obs, "cams": mod}, axis=1).dropna()
        j = j[j["obs"] > 0]
        for m, r in j.iterrows():
            pairs.append({"month": m, "gas": gid, "obs_ug_m3": r["obs"], "cams_ug_m3": r["cams"]})
        if not len(j):
            summary[gid] = {"n": 0}
            continue
        o, m_ = j["obs"].to_numpy(), j["cams"].to_numpy()
        nmb, nme = (m_ - o).sum() / o.sum(), np.abs(m_ - o).sum() / o.sum()
        summary[gid] = {
            "n": int(len(j)), "obs_mean_ug": float(o.mean()), "cams_mean_ug": float(m_.mean()),
            "nmb": float(nmb), "nme": float(nme),
            "r": float(np.corrcoef(o, m_)[0, 1]) if len(j) >= MIN_N_FOR_R else None,
            "median_obs_over_cams": float(np.median(o / m_)),
            "pass": bool(abs(nmb) < NMB_MAX and nme < NME_MAX),
            "jan2026_seen_before_protocol": "2026-01" in j.index,
        }
    pd.DataFrame(pairs).round(2).to_csv(HERE / "monthly_pairs.csv", index=False)
    out = {"protocol": "validation/kazhydromet/PROTOCOL.md v1.1",
           "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "bulletins": len(links), "parse_errors": int(ex.get("error", pd.Series(dtype=str)).notna().sum()),
           "summary": summary}
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2, default=float))
    (HERE / "results.md").write_text(render(out, ex))
    print(json.dumps(out, ensure_ascii=False, indent=1, default=float))


def render(o: dict, ex: pd.DataFrame) -> str:
    names = {"so2": "SO₂", "co": "CO", "no2": "NO₂", "no": "NO", "h2s": "H₂S"}
    L = ["# Валидация №3 — нәтиже: Атырау, CAMS vs Қазгидромет посттары", "",
         f"> Хаттама: `PROTOCOL.md` v1.1. Есептелді: {o['generated_at']}. "
         f"Бюллетень: {o['bulletins']} ай; оқу қатесі: {o['parse_errors']}.", "",
         "| Газ | Ай саны | Посттар орташа, мкг/м³ | CAMS орташа, мкг/м³ | NMB | NME | r | Пост/CAMS (медиана) | Нәтиже |",
         "|---|---|---|---|---|---|---|---|---|"]
    for gid, s in o["summary"].items():
        if s.get("cams", 1) is None:
            L.append(f"| {names[gid]} | {s['months']} | {s['obs_mean_ug']:.1f} | — (CAMS-та жоқ) | | | | | тек өлшем |")
        elif s.get("n"):
            r = "—" if s["r"] is None else f"{s['r']:.2f}"
            L.append(f"| {names[gid]} | {s['n']} | {s['obs_mean_ug']:.1f} | {s['cams_mean_ug']:.1f} | "
                     f"{s['nmb']*100:+.0f}% | {s['nme']*100:.0f}% | {r} | {s['median_obs_over_cams']:.1f}× | "
                     f"{'✅ ӨТТІ' if s['pass'] else '❌ ӨТПЕДІ'} |")
    L += ["", "Шарт: |NMB| < 30% және NME < 50%. Әр мән `extracted.csv`-те бет нөмірімен — қолмен тексеруге болады.", "",
          "## H₂S (тек посттар өлшейді)", ""]
    h = ex[ex["gas"] == "h2s"].dropna(subset=["mean_mg_m3"])
    L += ["| Ай | Орташа, мкг/м³ | Макс. бір реттік, мкг/м³ | × ШРК м.р. |", "|---|---|---|---|"]
    for _, r in h.iterrows():
        L.append(f"| {r['month']} | {r['mean_mg_m3']*1000:.1f} | {r['max_mg_m3']*1000:.1f} | {r['max_x_pdk_mr'] if pd.notna(r['max_x_pdk_mr']) else '—'} |")
    L += ["", "## Шектеулер", "", "- Қалалық жиынтық (бірнеше пост) vs ~40 км CAMS ұяшығы.",
          "- 2026-01 хаттамаға дейін көрілген (PROTOCOL.md басы).", ""]
    return "\n".join(L)


if __name__ == "__main__":
    main()
