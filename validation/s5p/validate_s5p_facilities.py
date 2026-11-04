"""Валидация №2б v1.1 — КПИ, Болашақ, Теңіз үстіндегі NO2/SO2 (PROTOCOL.md §6).

validate_s5p_anpz.py функцияларын ӨЗГЕРТПЕЙ қолданады; тек орталық пен кэш қалтасы ауысады.
Іске қосу (жоба түбірінен; node керек — контурлар src/data/facilities.ts-тен оқылады):
    SENTINELHUB_CLIENT_ID=... SENTINELHUB_CLIENT_SECRET=... python3 -I validation/s5p/validate_s5p_facilities.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))
import validate_s5p_anpz as base  # noqa: E402

FACILITIES = ["kpi", "bolashak", "tco"]

NODE = """import(process.argv[1]).then(m=>console.log(JSON.stringify(m.FACILITIES.map(f=>({id:f.id,name:f.short??f.name,lat:f.lat,lng:f.lng,footprint:f.footprint??null})))))"""


def registry() -> list[dict]:
    out = subprocess.run(["node", "--no-warnings", "--experimental-strip-types", "-e", NODE,
                          str(ROOT / "src/data/facilities.ts")], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def area_centroid(footprint) -> tuple[float, float]:
    """Ауданмен өлшенген центроид (shoelace), барлық сыртқы сақиналар бойынша."""
    rings = footprint if isinstance(footprint[0][0], list) else [footprint]
    A = cx = cy = 0.0
    for r in rings:
        x = np.array([p[0] for p in r]); y = np.array([p[1] for p in r])
        if x[0] != x[-1] or y[0] != y[-1]:
            x = np.append(x, x[0]); y = np.append(y, y[0])
        cross = x[:-1] * y[1:] - x[1:] * y[:-1]
        a = cross.sum() / 2
        A += a
        cx += ((x[:-1] + x[1:]) * cross).sum() / 6
        cy += ((y[:-1] + y[1:]) * cross).sum() / 6
    return cy / A, cx / A


def dist_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    kx = 111.320 * np.cos(np.radians((a[0] + b[0]) / 2))
    return float(np.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * 110.574))


def main() -> None:
    reg = registry()
    base.token()
    out = {"protocol": "validation/s5p/PROTOCOL.md v1.1 §6",
           "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "facilities": {}}
    rng = np.random.default_rng(20261104)
    for fid in FACILITIES:
        f = next(x for x in reg if x["id"] == fid)
        lat0, lon0 = area_centroid(f["footprint"]) if f["footprint"] else (f["lat"], f["lng"])
        neighbours = [{"id": o["id"], "km": round(dist_km((lat0, lon0), (o["lat"], o["lng"])), 1)}
                      for o in reg if o["id"] != fid
                      and base.RING_KM[0] <= dist_km((lat0, lon0), (o["lat"], o["lng"])) <= base.RING_KM[1]]
        base.DATA = HERE / "data" / fid
        base.DATA.mkdir(parents=True, exist_ok=True)
        print(f"== {fid} {lat0:.4f},{lon0:.4f} көршілер={neighbours}", file=sys.stderr)
        geoms = base.geometries(lat0, lon0)
        w = base.wind(lat0, lon0)
        res = {"center": [lat0, lon0], "wind_days": int(len(w)), "neighbours_in_ring": neighbours}
        for gas, label in (("NO2", "H3"), ("SO2", "H4")):
            with ThreadPoolExecutor(max_workers=3) as pool:
                futs = {n: pool.submit(base.daily_stats, gas, n, ring) for n, ring in geoms.items()}
                series = {n: fu.result() for n, fu in futs.items()}
            sect = pd.concat([series[f"s{k}"].rename(f"s{k}") for k in range(base.N_SECTORS)], axis=1)
            res[label] = {"gas": gas} | base.test(gas, sect, series["core"], w, rng)
        out["facilities"][fid] = res
    (HERE / "results_facilities.json").write_text(json.dumps(out, ensure_ascii=False, indent=2, default=float))
    print(json.dumps(out, ensure_ascii=False, indent=1, default=float))


if __name__ == "__main__":
    main()
