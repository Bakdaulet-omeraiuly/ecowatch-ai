"""JAIYQ-ML оқыту құбыры: жүктеу → белгілер → оқыту → бағалау → экспорт.

Іске қосу:  python3 train.py
Нәтиже:     src/data/models/aqi-model.json  +  ml-service/report.md

Тәсіл: модель абсолют AQI-ды емес, **маусымдық климатологиядан ауытқуды**
болжайды (residual). Соңғы болжам = климатология + модель ауытқуы.
Осылайша базалық болжам мен модель бір негізде салыстырылады да, ML-дің
нақты қосқан құны өлшенеді.

Модель климатологияны MIN_SKILL шамасынан артық жеңе алмаса — `usable: false`
болып жазылады және сайт оны КӨРСЕТПЕЙДІ. Дерек көзі қолжетімсіз болса
қате көтеріледі, модель файлы жаңартылмайды. Ойдан модель жасалмайды.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import numpy as np

import climatology
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


def main() -> int:
    dataset = build_dataset()
    rows = dataset["rows"]

    X_all, times = build_features(rows)
    X_all = np.asarray(X_all, dtype=np.float64)
    by_time = {r["time"]: r for r in rows}
    print(f"Белгілер матрицасы: {X_all.shape[0]} × {X_all.shape[1]}")

    n = X_all.shape[0]
    split = int(n * (1 - C.TEST_FRACTION))
    vsplit = int(split * (1 - C.VAL_FRACTION))
    print(f"Хронологиялық бөліну: оқыту={vsplit}, валидация={split - vsplit}, тексеру={n - split}")
    print(f"  оқыту     {times[0]} … {times[vsplit - 1]}")
    print(f"  валидация {times[vsplit]} … {times[split - 1]}")
    print(f"  тексеру   {times[split]} … {times[-1]}")

    targets_out: dict[str, dict] = {}
    report_lines: list[str] = []
    usable_all = True

    for target in C.TARGETS:
        y_raw = np.array(
            [by_time[t].get(target) if by_time[t].get(target) is not None else np.nan for t in times],
            dtype=np.float64,
        )
        ok = ~np.isnan(y_raw)
        if ok.sum() < 8760:
            raise RuntimeError(f"{target}: жарамды жазба тым аз ({int(ok.sum())})")

        def mask(lo: int, hi: int) -> np.ndarray:
            m = ok.copy()
            m[:lo] = False
            m[hi:] = False
            return m

        m_fit, m_val, m_test = mask(0, vsplit), mask(vsplit, split), mask(split, n)
        t_fit = [t for t, f in zip(times, m_fit) if f]
        t_val = [t for t, f in zip(times, m_val) if f]
        t_test = [t for t, f in zip(times, m_test) if f]

        print(
            f"\n▶ {target}: оқыту={len(t_fit)}, валидация={len(t_val)}, тексеру={len(t_test)}"
        )

        # Климатология ТЕК оқыту бөлігінен — валидация мен тексеру «ағып» кетпейді
        clim = climatology.build(t_fit, y_raw[m_fit])
        c_fit = np.array(climatology.series(clim, t_fit), dtype=np.float64)
        c_val = np.array(climatology.series(clim, t_val), dtype=np.float64)
        c_test = np.array(climatology.series(clim, t_test), dtype=np.float64)

        gb = GradientBoosting(
            n_trees=C.HYPER["n_trees"],
            learning_rate=C.HYPER["learning_rate"],
            max_depth=C.HYPER["max_depth"],
            min_samples_leaf=C.HYPER["min_samples_leaf"],
            n_bins=C.HYPER["n_bins"],
            min_gain=C.HYPER["min_gain"],
            l2=C.HYPER["l2"],
            patience=C.HYPER["patience"],
        )
        # Мақсат — климатологиядан ауытқу
        gb.fit(X_all[m_fit], y_raw[m_fit] - c_fit, X_all[m_val], y_raw[m_val] - c_val)

        p_test = c_test + gb.predict(X_all[m_test])
        m_model = _metrics(y_raw[m_test], p_test)
        m_base = _metrics(y_raw[m_test], c_test)  # базалық = таза климатология
        skill = round(1 - m_model["mae"] / m_base["mae"], 4) if m_base["mae"] else None
        usable = skill is not None and skill >= C.MIN_SKILL
        usable_all = usable_all and usable

        print(f"  модель  : MAE={m_model['mae']}  RMSE={m_model['rmse']}  R²={m_model['r2']}")
        print(f"  базалық : MAE={m_base['mae']}  RMSE={m_base['rmse']}  R²={m_base['r2']}")
        print(f"  шеберлік: {skill}  → {'ПАЙДАЛЫ' if usable else 'ЖЕТКІЛІКСІЗ (көрсетілмейді)'}")

        spec = gb.to_dict()
        spec["climatology"] = clim
        spec["metrics"] = {"model": m_model, "climatologyBaseline": m_base, "skill": skill}
        spec["usable"] = usable
        spec["testSamples"] = len(t_test)
        targets_out[target] = spec

        report_lines.append(
            f"| {target} | {spec['nTrees']} | {m_model['mae']} | {m_model['rmse']} | "
            f"{m_model['r2']} | {m_base['mae']} | {skill} | {'✅' if usable else '❌'} |"
        )

    payload = {
        "trained": True,
        "usable": usable_all,
        "name": "JAIYQ-ML",
        "version": "1.1",
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "location": C.LOCATION,
        "trainPeriod": {"start": dataset["start"], "end": dataset["end"], "hours": n},
        "testFraction": C.TEST_FRACTION,
        "minSkill": C.MIN_SKILL,
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
    if not usable_all:
        print(
            "\n⚠️  ЕСКЕРТУ: модель климатологияны жеткілікті жеңе алмады.\n"
            "   `usable: false` жазылды — /api/ml-forecast 503 қайтарады,\n"
            "   сайтта жалған дәлдікпен болжам КӨРСЕТІЛМЕЙДІ."
        )

    with open(C.REPORT_OUT, "w", encoding="utf-8") as fh:
        fh.write(
            "# JAIYQ-ML — оқыту есебі\n\n"
            f"- Жасалған уақыты: {payload['generatedAt']}\n"
            f"- Дерек көзі: {C.SOURCE_LABEL}\n"
            f"- Орын: {C.LOCATION['name']} ({C.LOCATION['lat']}, {C.LOCATION['lng']})\n"
            f"- Оқыту кезеңі: {dataset['start']} … {dataset['end']} ({n} сағат)\n"
            f"- Бөліну: оқыту {vsplit} · валидация {split - vsplit} · тексеру {n - split}"
            " (хронологиялық, араластыру жоқ)\n"
            f"- Тәсіл: модель маусымдық климатологиядан **ауытқуды** болжайды\n"
            f"- Пайдалану шегі: шеберлік ≥ {C.MIN_SKILL}\n\n"
            "| Мақсат | Ағаш | MAE | RMSE | R² | Климатология MAE | Шеберлік | Пайдаланылады |\n"
            "|---|---|---|---|---|---|---|---|\n" + "\n".join(report_lines) + "\n\n"
            f"**Жалпы күй:** {'✅ модель сайтта көрсетіледі' if usable_all else '❌ модель көрсетілмейді — шеберлік жеткіліксіз'}\n\n"
            f"> {C.DISCLAIMER}\n"
        )
    print(f"✅ Есеп жазылды: {C.REPORT_OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
