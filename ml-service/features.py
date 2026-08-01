"""Белгілер (features) құрастыру.

МАҢЫЗДЫ: бұл логика `src/lib/ml/features.ts` файлымен ДӘЛ БІРДЕЙ болуы керек.
Біреуін өзгертсең — екіншісін де өзгерт, әйтпесе болжам бұрмаланады.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

FEATURE_NAMES = [
    "t2m",        # 2м температура (°C)
    "rh",         # салыстырмалы ылғалдылық (%)
    "dew",        # шық нүктесі (°C)
    "psfc",       # жер бетіндегі қысым (hPa)
    "precip",     # жауын-шашын (мм/сағ)
    "cloud",      # бұлттылық (%)
    "wspd",       # жел жылдамдығы 10м (км/сағ)
    "wgust",      # жел екпіні (км/сағ)
    "wdir_sin",   # жел бағыты — синус
    "wdir_cos",   # жел бағыты — косинус
    "blh",        # шекаралық қабат биіктігі (м)
    "t850",       # 850 гПа температурасы (°C)
    "inversion",  # t850 − t2m: оң мән = инверсия (ластану қақпаны)
    "vent",       # желдету индексі = blh × wspd / 1000
    "precip24",   # соңғы 24 сағаттағы жауын қосындысы (шаю әсері)
    "wspd24",     # соңғы 24 сағаттағы орташа жел (тоқырау көрсеткіші)
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
]

RAW_KEYS = [
    "temperature_2m",
    "relative_humidity_2m",
    "dew_point_2m",
    "surface_pressure",
    "precipitation",
    "cloud_cover",
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "boundary_layer_height",
    "temperature_850hPa",
]

WINDOW = 24  # rolling терезесі, сағат


def _forward_fill(rows: list[dict]) -> list[dict]:
    """Жетіспейтін мәндерді алдыңғы сағаттан толтыру. Бас жағы 0-мен."""
    last: dict[str, float] = {}
    out: list[dict] = []
    for r in rows:
        clean = {"time": r["time"]}
        for k in RAW_KEYS:
            v = r.get(k)
            if v is None or (isinstance(v, float) and math.isnan(v)):
                v = last.get(k, 0.0)
            else:
                v = float(v)
                last[k] = v
            clean[k] = v
        out.append(clean)
    return out


def _parse_hour(t: str) -> tuple[int, int]:
    dt = datetime.fromisoformat(t.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.hour, dt.timetuple().tm_yday


def build_features(rows: list[dict]) -> tuple[list[list[float]], list[str]]:
    """Уақыт бойынша өсу ретімен берілген жолдардан белгілер матрицасын құрады.

    Алғашқы (WINDOW − 1) жол rolling терезесі толмағандықтан тасталады.
    """
    clean = _forward_fill(rows)
    X: list[list[float]] = []
    times: list[str] = []

    precip_win: list[float] = []
    wspd_win: list[float] = []

    for r in clean:
        precip_win.append(r["precipitation"])
        wspd_win.append(r["wind_speed_10m"])
        if len(precip_win) > WINDOW:
            precip_win.pop(0)
            wspd_win.pop(0)
        if len(precip_win) < WINDOW:
            continue

        hour, doy = _parse_hour(r["time"])
        wdir_rad = math.radians(r["wind_direction_10m"])
        t2m = r["temperature_2m"]
        t850 = r["temperature_850hPa"]
        blh = r["boundary_layer_height"]
        wspd = r["wind_speed_10m"]

        X.append([
            t2m,
            r["relative_humidity_2m"],
            r["dew_point_2m"],
            r["surface_pressure"],
            r["precipitation"],
            r["cloud_cover"],
            wspd,
            r["wind_gusts_10m"],
            math.sin(wdir_rad),
            math.cos(wdir_rad),
            blh,
            t850,
            t850 - t2m,
            blh * wspd / 1000.0,
            sum(precip_win),
            sum(wspd_win) / WINDOW,
            math.sin(2 * math.pi * hour / 24.0),
            math.cos(2 * math.pi * hour / 24.0),
            math.sin(2 * math.pi * doy / 365.25),
            math.cos(2 * math.pi * doy / 365.25),
        ])
        times.append(r["time"])

    return X, times
