"""Python ↔ TypeScript белгілерінің сәйкестігін тексеру.

Бұл — жүйенің ең нәзік жері: модель Python-да оқытылып, болжам TypeScript-те
есептеледі. Егер `features.py` мен `src/lib/ml/features.ts` бір-бірінен
ажырап кетсе, модель дұрыс емес кірісті алады да, болжам мәнсіз болады —
бірақ ешқандай қате шықпайды. Сондықтан оны машина тексеруі керек.

Node.js қажет (`node --experimental-strip-types`). Интернет қажет емес.
"""

from __future__ import annotations

import json
import os
import random
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import climatology  # noqa: E402
from features import build_features  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ML_DIR = os.path.abspath(os.path.join(HERE, "..", "src", "lib", "ml"))
TS_FEATURES = os.path.join(ML_DIR, "features.ts")
TS_CLIM = os.path.join(ML_DIR, "climatology.ts")
TOLERANCE = 1e-9

RUNNER = """
import { buildFeatures } from "./features.ts";
import { climValue } from "./climatology.ts";
import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("rows.json", "utf8"));
const { X, times } = buildFeatures(rows);
const { clim, climTimes } = JSON.parse(readFileSync("clim.json", "utf8"));
const climOut = climTimes.map((t) => climValue(clim, t));
writeFileSync("ts.json", JSON.stringify({ X, times, climOut }));
"""


def make_rows(n: int = 220) -> list[dict]:
    """Синтетикалық кіріс — ТЕК екі іске асырудың сәйкестігін тексеру үшін.
    Бұл сандар модельге де, сайтқа да ешқашан түспейді."""
    random.seed(11)
    rows = []
    for i in range(n):
        rows.append({
            "time": f"2025-0{1 + i // 40}-{1 + (i // 24) % 27:02d}T{i % 24:02d}:00",
            "temperature_2m": round(random.uniform(-15, 38), 2),
            "relative_humidity_2m": round(random.uniform(10, 99), 1),
            "dew_point_2m": round(random.uniform(-20, 20), 2),
            "surface_pressure": round(random.uniform(985, 1035), 1),
            "precipitation": round(random.choice([0, 0, 0, 0.3, 2.1]), 2),
            "cloud_cover": round(random.uniform(0, 100), 1),
            "wind_speed_10m": round(random.uniform(0, 60), 2),
            "wind_direction_10m": round(random.uniform(0, 360), 1),
            "wind_gusts_10m": round(random.uniform(0, 90), 2),
            "boundary_layer_height": round(random.uniform(50, 2500), 1),
            "temperature_850hPa": round(random.uniform(-25, 30), 2),
            "wind_speed_850hPa": round(random.uniform(0, 90), 2),
            "wind_direction_850hPa": round(random.uniform(0, 360), 1),
            "geopotential_height_500hPa": round(random.uniform(5100, 5900), 1),
        })
    # forward-fill тармағын да тексеру үшін бірнеше бос мән
    rows[0]["cloud_cover"] = None
    rows[5]["wind_speed_10m"] = None
    rows[40]["boundary_layer_height"] = None
    return rows


def main() -> int:
    if shutil.which("node") is None:
        print("⚠️  Node.js табылмады — сәйкестік тексеруі өткізілді")
        return 0

    rows = make_rows()
    X_py, t_py = build_features(rows)

    # Климатология: әдейі кейбір (ай, сағат) жиынын сирек қылып, барлық үш
    # шегіну тармағын (month-hour → month → overall) тексереміз.
    random.seed(3)
    clim_times = [
        f"2025-{m:02d}-1{d}T{h:02d}:00"
        for m in (1, 3, 7, 12) for d in (0, 5) for h in (0, 6, 13, 23)
    ]
    clim_vals = [random.uniform(5, 90) for _ in clim_times]
    clim = climatology.build(clim_times * 30, clim_vals * 30)  # кейбірі MIN_COUNT-тан асады
    probe_times = clim_times + ["2025-02-14T09:00", "2025-11-03T17:00"]
    clim_py = [climatology.value(clim, t) for t in probe_times]

    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(TS_FEATURES, os.path.join(tmp, "features.ts"))
        shutil.copy(TS_CLIM, os.path.join(tmp, "climatology.ts"))
        with open(os.path.join(tmp, "rows.json"), "w") as fh:
            json.dump(rows, fh)
        with open(os.path.join(tmp, "clim.json"), "w") as fh:
            json.dump({"clim": clim, "climTimes": probe_times}, fh)
        with open(os.path.join(tmp, "run.ts"), "w") as fh:
            fh.write(RUNNER)

        res = subprocess.run(
            ["node", "--experimental-strip-types", "run.ts"],
            cwd=tmp, capture_output=True, text=True,
        )
        if res.returncode != 0:
            print("❌ TypeScript нұсқасын іске қосу сәтсіз:")
            print(res.stderr[-2000:])
            return 1

        with open(os.path.join(tmp, "ts.json")) as fh:
            ts = json.load(fh)

    if t_py != ts["times"]:
        print(f"❌ Уақыт белгілері сәйкес емес: py={len(t_py)} ts={len(ts['times'])}")
        return 1

    worst, where = 0.0, ""
    for i, (a, b) in enumerate(zip(X_py, ts["X"])):
        if len(a) != len(b):
            print(f"❌ Белгі саны сәйкес емес: py={len(a)} ts={len(b)}")
            return 1
        for j, (x, y) in enumerate(zip(a, b)):
            d = abs(x - y)
            if d > worst:
                worst, where = d, f"жол {i}, белгі {j}"

    print(f"Белгілер: {len(X_py)} жол × {len(X_py[0])}")
    print(f"  ең үлкен айырма: {worst:.3e} ({where or '—'})")
    if worst > TOLERANCE:
        print("❌ features.py мен features.ts АЖЫРАП КЕТКЕН — болжам бұрмаланады")
        return 1

    clim_ts = ts["climOut"]
    if len(clim_ts) != len(clim_py):
        print(f"❌ Климатология ұзындығы сәйкес емес: py={len(clim_py)} ts={len(clim_ts)}")
        return 1
    cworst = max((abs(a - b) for a, b in zip(clim_py, clim_ts)), default=0.0)
    print(f"Климатология: {len(clim_py)} нүкте")
    print(f"  ең үлкен айырма: {cworst:.3e}")
    if cworst > TOLERANCE:
        print("❌ climatology.py мен climatology.ts АЖЫРАП КЕТКЕН")
        return 1

    print("✅ Python ↔ TypeScript толық сәйкес (белгілер + климатология)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
