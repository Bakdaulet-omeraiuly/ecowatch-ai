"""Маусымдық климатология — (ай, сағат) бойынша орташа.

Бұл екі рөл атқарады:
  1. **Базалық болжам** — модель осыны жеңуі керек. Жеңе алмаса, ML-дің
     қосатын құны жоқ дегенді білдіреді.
  2. **Модельдің негізі** — модель абсолют мәнді емес, климатологиядан
     ауытқуды (residual) болжайды. Бұл дұрысырақ: маусымдық және тәуліктік
     циклды ағаштарға қайта үйретудің қажеті жоқ, олар тек метеорологиялық
     ауытқуға шоғырланады.

МАҢЫЗДЫ: `src/lib/ml/gbt.ts` ішіндегі `climValue()` осымен бірдей болуы керек.
"""

from __future__ import annotations

from datetime import datetime

MIN_COUNT = 20  # осыдан аз үлгі болса — жалпы айлық орташаға шегінеміз


def _parse(t: str) -> tuple[int, int]:
    dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
    return dt.month, dt.hour


def build(times: list[str], values) -> dict:
    """Тек ОҚЫТУ жиынынан құрылуы керек — әйтпесе тексеру жиыны «ағып» кетеді."""
    mh: dict[str, list[float]] = {}
    mo: dict[str, list[float]] = {}
    all_vals: list[float] = []

    for t, v in zip(times, values):
        v = float(v)
        month, hour = _parse(t)
        mh.setdefault(f"{month}-{hour}", []).append(v)
        mo.setdefault(str(month), []).append(v)
        all_vals.append(v)

    return {
        "byMonthHour": {
            k: round(sum(a) / len(a), 4) for k, a in mh.items() if len(a) >= MIN_COUNT
        },
        "byMonth": {k: round(sum(a) / len(a), 4) for k, a in mo.items()},
        "overall": round(sum(all_vals) / len(all_vals), 4) if all_vals else 0.0,
    }


def value(clim: dict, time: str) -> float:
    month, hour = _parse(time)
    v = clim["byMonthHour"].get(f"{month}-{hour}")
    if v is not None:
        return v
    v = clim["byMonth"].get(str(month))
    if v is not None:
        return v
    return clim["overall"]


def series(clim: dict, times: list[str]) -> list[float]:
    return [value(clim, t) for t in times]
