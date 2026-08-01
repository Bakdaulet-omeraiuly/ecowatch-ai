"""JAIYQ-ML оқыту құбыры: жүктеу → белгілер → оқыту → бағалау → экспорт.

Іске қосу:  python3 train.py
Нәтиже:     src/data/models/aqi-model.json  +  ml-service/report.md

Дерек көзі қолжетімсіз болса — қате көтеріледі және модель файлы
ЖАҢАРТЫЛМАЙДЫ. Ойдан модель жасалмайды.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import numpy as np

import config as C
from features import FEATURE_NAMES, build_features
from fetch import build_dataset
from model import GradientBoosting


def _metrics(y: np.ndarray, p: np.ndarray) -> dict:
    err = y - p
    ss_res = float(np.sum(err**2))
    ss_tot = float(np.sum((y - y.mean()) ** 2))
    return {
        "mae": round(float(np.mean(np.abs(err))), 3),
        "rmse": round(float(np.sqrt(np.mean(err**2))), 3),
        "r2": round(1 - ss_res / ss_tot, 4) if ss_tot > 0 else None,
    }


def _seasonal_baseline(times_tr, y_tr, times_te) -> np.ndarray:
    """Базалық болжам: оқыту жиынындағы (ай, сағат) орташасы."""
    acc: dict[tuple[int, int], list[float]] = {}
    for t, v in zip(times_tr, y_tr):
        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
        acc.setdefault((dt.month, dt.hour), []).append(float(v))
    means = {k: sum(v) / len(v) for k, v in acc.items()}
    overall = float(np.mean(y_tr))
    out = []
    for t in times_te:
        dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
        out.append(means.get((dt.month, dt.hour), overall))
    return np.array(out, dtype=np.float64)


def main() -> int:
    dataset = build_dataset()
    rows = dataset["rows"]

    X_all, times = build_features(rows)
    X_all = np.asarray(X_all, dtype=np.float64)
    by_time = {r["time"]: r for r in rows}
    print(f"Белгілер матрицасы: {X_all.shape[0]} × {X_all.shape[1]}")

    n = X_all.shape[0]
    split = int(n * (1 - C.TEST_FRACTION))
    print(f"Хронологиялық бөліну: оқыту={split}, тексеру={n - split}")
    print(f"  оқыту   {times[0]} … {times[split - 1]}")
    print(f"  тексеру {times[split]} … {times[-1]}")

    targets_out: dict[str, dict] = {}
    report_lines: list[str] = []

    for target in C.TARGETS:
        y_raw = np.array(
            [by_time[t].get(target) if by_time[t].get(target) is not None else np.nan for t in times],
            dtype=np.float64,
        )
        ok = ~np.isnan(y_raw)
        if ok.sum() < 8760:
            raise RuntimeError(f"{target}: жарамды жазба тым аз ({int(ok.sum())})")

        tr = ok.copy()
        tr[split:] = False
        te = ok.copy()
        te[:split] = False

        print(f"\n▶ {target}: оқыту={int(tr.sum())}, тексеру={int(te.sum())}")
        gb = GradientBoosting(
            n_trees=C.HYPER["n_trees"],
            learning_rate=C.HYPER["learning_rate"],
            max_depth=C.HYPER["max_depth"],
            min_samples_leaf=C.HYPER["min_samples_leaf"],
            n_bins=C.HYPER["n_bins"],
            min_gain=C.HYPER["min_gain"],
        )
        gb.fit(X_all[tr], y_raw[tr])

        p_te = gb.predict(X_all[te])
        m_model = _metrics(y_raw[te], p_te)
        times_tr = [t for t, f in zip(times, tr) if f]
        times_te = [t for t, f in zip(times, te) if f]
        p_base = _seasonal_baseline(times_tr, y_raw[tr], times_te)
        m_base = _metrics(y_raw[te], p_base)
        skill = round(1 - m_model["mae"] / m_base["mae"], 4) if m_base["mae"] else None

        print(f"  модель : MAE={m_model['mae']}  RMSE={m_model['rmse']}  R²={m_model['r2']}")
        print(f"  базалық: MAE={m_base['mae']}  RMSE={m_base['rmse']}  R²={m_base['r2']}")
        print(f"  шеберлік (skill vs базалық): {skill}")

        spec = gb.to_dict()
        spec["metrics"] = {"model": m_model, "seasonalBaseline": m_base, "skill": skill}
        spec["testSamples"] = int(te.sum())
        targets_out[target] = spec

        report_lines.append(
            f"| {target} | {m_model['mae']} | {m_model['rmse']} | {m_model['r2']} | "
            f"{m_base['mae']} | {skill} |"
        )

    payload = {
        "trained": True,
        "name": "JAIYQ-ML",
        "version": "1.0",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "location": C.LOCATION,
        "trainPeriod": {"start": dataset["start"], "end": dataset["end"], "hours": n},
        "testFraction": C.TEST_FRACTION,
        "features": FEATURE_NAMES,
        "hyper": C.HYPER,
        "targets": targets_out,
        "source": C.SOURCE_LABEL,
        "disclaimer": C.DISCLAIMER,
    }

    os.makedirs(os.path.dirname(C.MODEL_OUT), exist_ok=True)
    with open(C.MODEL_OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(C.MODEL_OUT) / 1024
    print(f"\n✅ Модель жазылды: {C.MODEL_OUT} ({size_kb:.0f} КБ)")

    with open(C.REPORT_OUT, "w", encoding="utf-8") as fh:
        fh.write(
            "# JAIYQ-ML — оқыту есебі\n\n"
            f"- Жасалған уақыты: {payload['generatedAt']}\n"
            f"- Дерек көзі: {C.SOURCE_LABEL}\n"
            f"- Орын: {C.LOCATION['name']} ({C.LOCATION['lat']}, {C.LOCATION['lng']})\n"
            f"- Оқыту кезеңі: {dataset['start']} … {dataset['end']} ({n} сағат)\n"
            f"- Бөліну: соңғы {int(C.TEST_FRACTION * 100)}% — тексеру (хронологиялық)\n\n"
            "| Мақсат | MAE | RMSE | R² | Базалық MAE | Шеберлік |\n"
            "|---|---|---|---|---|---|\n" + "\n".join(report_lines) + "\n\n"
            f"> {C.DISCLAIMER}\n"
        )
    print(f"✅ Есеп жазылды: {C.REPORT_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
