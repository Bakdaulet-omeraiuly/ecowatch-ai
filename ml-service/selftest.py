"""Кодтың өзін-өзі тексеруі (интернетсіз жүреді).

МАҢЫЗДЫ: мұндағы синтетикалық сандар — тек АЛГОРИТМДІ тексеру үшін.
Олар ешқашан модельге де, сайтқа да түспейді. Сайттағы модель тек нақты
CAMS/ERA5 деректерінде оқытылады (`train.py`).

Тексерілетіні:
  1. Бустинг оқи ала ма (шығын азая ма);
  2. Қорап (bin) арқылы болжам мен шекара (threshold) арқылы болжам БІРДЕЙ ме
     — бұл Python ↔ TypeScript сәйкестігінің кепілі;
  3. JSON экспорты/қайта оқылуы дұрыс па.
"""

from __future__ import annotations

import json
import math

import numpy as np

from features import FEATURE_NAMES, build_features
from model import GradientBoosting


def _json_predict(spec: dict, X: np.ndarray) -> np.ndarray:
    """JSON моделін тікелей оқып болжау — TypeScript нұсқасының көшірмесі."""
    out = np.full(X.shape[0], spec["base"], dtype=np.float64)
    lr = spec["learningRate"]
    for tree in spec["trees"]:
        f, t, l, r, v = tree["f"], tree["t"], tree["l"], tree["r"], tree["v"]
        for i in range(X.shape[0]):
            node = 0
            while f[node] >= 0:
                node = l[node] if X[i, f[node]] <= t[node] else r[node]
            out[i] += lr * v[node]
    return out


def main() -> int:
    rng = np.random.default_rng(7)
    n, d = 3000, 6
    X = rng.normal(size=(n, d))
    y = 3 * np.sin(X[:, 0]) + 2 * X[:, 1] * X[:, 2] - X[:, 3] ** 2 + rng.normal(scale=0.3, size=n)

    gb = GradientBoosting(n_trees=60, learning_rate=0.1, max_depth=4, min_samples_leaf=20, n_bins=32)
    gb.fit(X, y, verbose=False)

    pred = gb.predict(X)
    mae = float(np.mean(np.abs(y - pred)))
    baseline = float(np.mean(np.abs(y - y.mean())))
    print(f"1) MAE={mae:.3f}  базалық={baseline:.3f}")
    assert mae < baseline * 0.5, "модель оқымады"

    spec = gb.to_dict()
    jpred = _json_predict(spec, X[:400])
    diff = float(np.max(np.abs(jpred - pred[:400])))
    print(f"2) JSON ↔ Python айырмасы (max)={diff:.6f}")
    assert diff < 1e-3, "JSON экспорты сәйкес емес — TS болжамы бұрмаланады"

    s = json.dumps(spec)
    assert json.loads(s)["base"] == spec["base"]
    print(f"3) JSON көлемі={len(s) / 1024:.0f} КБ")

    # Белгілер құрастыруы
    rows = []
    for i in range(30):
        rows.append({
            "time": f"2025-06-01T{i % 24:02d}:00",
            "temperature_2m": 20 + i, "relative_humidity_2m": 40, "dew_point_2m": 5,
            "surface_pressure": 1010, "precipitation": 0.1, "cloud_cover": 20,
            "wind_speed_10m": 12, "wind_direction_10m": 90, "wind_gusts_10m": 20,
            "boundary_layer_height": 800, "temperature_850hPa": 15,
        })
    F, times = build_features(rows)
    assert len(F) == 30 - 24 + 1, f"rolling терезесі қате: {len(F)}"
    assert len(F[0]) == len(FEATURE_NAMES), "белгі саны сәйкес емес"
    assert math.isclose(F[0][14], 0.1 * 24, rel_tol=1e-9), "precip24 қате"
    assert math.isclose(F[0][15], 12.0, rel_tol=1e-9), "wspd24 қате"
    assert math.isclose(F[0][13], 800 * 12 / 1000, rel_tol=1e-9), "vent қате"
    print(f"4) Белгілер OK — {len(F)} жол × {len(F[0])} белгі")

    print("\n✅ Барлық тексеру сәтті")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
