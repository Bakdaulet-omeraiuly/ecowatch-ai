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

from features import build_features  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
TS_FEATURES = os.path.abspath(os.path.join(HERE, "..", "src", "lib", "ml", "features.ts"))
TOLERANCE = 1e-9

RUNNER = """
import { buildFeatures } from "./features.ts";
import { readFileSync, writeFileSync } from "node:fs";
const rows = JSON.parse(readFileSync("rows.json", "utf8"));
const { X, times } = buildFeatures(rows);
writeFileSync("ts.json", JSON.stringify({ X, times }));
"""


def make_rows(n: int = 120) -> list[dict]:
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

    with tempfile.TemporaryDirectory() as tmp:
        shutil.copy(TS_FEATURES, os.path.join(tmp, "features.ts"))
        with open(os.path.join(tmp, "rows.json"), "w") as fh:
            json.dump(rows, fh)
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

    print(f"Салыстырылды: {len(X_py)} жол × {len(X_py[0])} белгі")
    print(f"Ең үлкен айырма: {worst:.3e} ({where or '—'})")
    if worst > TOLERANCE:
        print("❌ features.py мен features.ts АЖЫРАП КЕТКЕН — болжам бұрмаланады")
        return 1
    print("✅ Python ↔ TypeScript белгілері бірдей")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
