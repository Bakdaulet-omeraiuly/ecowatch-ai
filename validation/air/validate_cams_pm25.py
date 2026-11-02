"""Валидация №1 — CAMS PM2.5 (Open-Meteo, сайт қолданатын сұраныс) эталондық
жердегі өлшемге қарсы. Хаттама: PROTOCOL.md (алдын ала тіркелген).

Іске қосу (интернет керек, кілт керек емес):
    python -I validate_cams_pm25.py

Шығыс: results.json, results.md (осы қалтада); шикі дерек кэші data/ ішінде.
"""
from __future__ import annotations

import gzip
import io
import json
import re
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)

# --- Алдын ала тіркелген параметрлер (PROTOCOL.md §2–6) -------------------
STATION = {"id": 7094, "name": "АҚШ елшілігі, Астана (AirNow, BAM-1020)"}
START, END = "2024-01-01", "2024-12-31"
MIN_HOURS_PER_DAY = 18
VALID_RANGE = (0.0, 1000.0)
CRITERIA = {"nmb": 0.30, "nme": 0.50, "r": 0.40}  # Emery et al. 2017, 24h PM2.5
GOAL = {"nmb": 0.10, "nme": 0.35, "r": 0.70}
THRESHOLDS = {"kz_daily_35": 35.0, "who_daily_15": 15.0}  # legalNorms.ts
SCREEN_POD, SCREEN_FAR = 0.5, 0.5
LIVE = "https://www.ecojaiyq.com"

S3 = "https://openaq-data-archive.s3.amazonaws.com"
UA = {"User-Agent": "jaiyq-validation/1.0"}


def get(url: str, retries: int = 4) -> bytes:
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001 — қайталап көреміз, соңында көтереміз
            if i == retries - 1:
                raise RuntimeError(f"{url}: {e}") from e
            time.sleep(2 ** i)
    raise AssertionError


# --- 1. Эталон: OpenAQ ашық архиві -----------------------------------------
def fetch_reference() -> pd.DataFrame:
    cache = DATA / f"openaq_{STATION['id']}_{START[:4]}.csv"
    if cache.exists():
        return pd.read_csv(cache)
    frames = []
    year = START[:4]
    for month in range(1, 13):
        prefix = f"records/csv.gz/locationid={STATION['id']}/year={year}/month={month:02d}/"
        listing = get(f"{S3}/?list-type=2&prefix={prefix}&max-keys=1000").decode()
        for key in re.findall(r"<Key>([^<]+)</Key>", listing):
            raw = gzip.decompress(get(f"{S3}/{key}"))
            frames.append(pd.read_csv(io.BytesIO(raw)))
        print(f"  OpenAQ {year}-{month:02d}: {sum(len(f) for f in frames)} жол", file=sys.stderr)
    if not frames:
        raise SystemExit("Эталон дерегі табылмады — валидация жүргізілмейді (жалған дерек жоқ).")
    df = pd.concat(frames, ignore_index=True)
    df.to_csv(cache, index=False)
    return df


def clean_reference(df: pd.DataFrame) -> tuple[pd.Series, dict]:
    qc = {"raw_rows": int(len(df))}
    df = df[df["parameter"] == "pm25"].copy()
    qc["pm25_rows"] = int(len(df))
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    lo, hi = VALID_RANGE
    bad = df["value"].isna() | (df["value"] < lo) | (df["value"] > hi)
    qc["dropped_out_of_range"] = int(bad.sum())
    df = df[~bad]
    # OpenAQ уақыты — сағат соңы; Open-Meteo — сағат басы → −1 сағат
    t = pd.to_datetime(df["datetime"], utc=True) - pd.Timedelta(hours=1)
    s = pd.Series(df["value"].to_numpy(), index=t).sort_index()
    dup = s.index.duplicated(keep="first")
    qc["dropped_duplicate_hours"] = int(dup.sum())
    s = s[~dup]
    s = s[(s.index >= pd.Timestamp(START, tz="UTC")) & (s.index < pd.Timestamp(END, tz="UTC") + pd.Timedelta(days=1))]
    qc["clean_hours"] = int(len(s))
    return s, qc


# --- 2. Модель: сайттағыдай CAMS сұранысы ---------------------------------
def fetch_cams(lat: float, lon: float) -> tuple[pd.Series, dict]:
    url = (
        "https://air-quality-api.open-meteo.com/v1/air-quality"
        f"?latitude={lat}&longitude={lon}&hourly=pm2_5"
        f"&start_date={START}&end_date={END}&timezone=GMT"
    )
    cache = DATA / f"cams_{STATION['id']}_{START[:4]}.json"
    if cache.exists():
        j = json.loads(cache.read_text())
    else:
        j = json.loads(get(url))
        cache.write_text(json.dumps(j))
    s = pd.Series(j["hourly"]["pm2_5"], index=pd.to_datetime(j["hourly"]["time"], utc=True), dtype="float64")
    meta = {"url": url, "grid_lat": j.get("latitude"), "grid_lon": j.get("longitude"), "hours": int(s.notna().sum())}
    return s.dropna(), meta


# --- 3. Метрикалар ---------------------------------------------------------
def metrics(o: np.ndarray, m: np.ndarray) -> dict:
    d = m - o
    with np.errstate(divide="ignore", invalid="ignore"):
        ratio = m / o
    return {
        "n": int(len(o)),
        "mean_obs": float(o.mean()),
        "mean_mod": float(m.mean()),
        "nmb": float(d.sum() / o.sum()),
        "nme": float(np.abs(d).sum() / o.sum()),
        "mae": float(np.abs(d).mean()),
        "rmse": float(np.sqrt((d ** 2).mean())),
        "r": float(np.corrcoef(o, m)[0, 1]),
        "spearman": float(pd.Series(o).rank().corr(pd.Series(m).rank())),
        "fac2": float(np.mean((ratio >= 0.5) & (ratio <= 2.0) & (o > 0))),
    }


def verdict(mt: dict) -> dict:
    def lvl(name: str, val: float) -> str:
        v = abs(val) if name in ("nmb", "nme") else val
        good = (lambda x, t: x < t) if name in ("nmb", "nme") else (lambda x, t: x > t)
        return "goal" if good(v, GOAL[name]) else "criteria" if good(v, CRITERIA[name]) else "fail"

    levels = {k: lvl(k, mt[k]) for k in CRITERIA}
    return {"levels": levels, "pass": all(v != "fail" for v in levels.values())}


def contingency(o: np.ndarray, m: np.ndarray, thr: float) -> dict:
    ob, mb = o > thr, m > thr
    hits, misses = int((ob & mb).sum()), int((ob & ~mb).sum())
    fa, cn = int((~ob & mb).sum()), int((~ob & ~mb).sum())
    pod = hits / (hits + misses) if hits + misses else None
    far = fa / (hits + fa) if hits + fa else None
    csi = hits / (hits + misses + fa) if hits + misses + fa else None
    return {"threshold": thr, "hits": hits, "misses": misses, "false_alarms": fa, "correct_negatives": cn,
            "obs_exceed_days": hits + misses, "mod_exceed_days": hits + fa, "pod": pod, "far": far, "csi": csi}


# --- 4. Фиксация аудиті (PROTOCOL §7) --------------------------------------
HOURLY_COMPATIBLE = {"бір реттік", "максималды бір реттік", "1 сағаттық", "сағаттық"}


def audit_fixation() -> dict:
    try:
        j = json.loads(get(f"{LIVE}/api/exceedances"))
    except RuntimeError as e:
        return {"available": False, "error": str(e)}
    recs = j.get("records", [])
    by = {}
    for r in recs:
        k = (r["indicator_id"], r.get("averaging"), r.get("norm_limit"), r.get("act_jurisdiction"))
        by[k] = by.get(k, 0) + 1
    mismatched = sum(n for (_, avg, _, _), n in by.items() if (avg or "").strip() not in HOURLY_COMPATIBLE)
    return {
        "available": True,
        "days": j.get("days"),
        "records": len(recs),
        "kz_violations": j.get("kzViolations"),
        "by_norm": [{"indicator": k[0], "averaging": k[1], "limit": k[2], "jurisdiction": k[3], "count": n}
                    for k, n in sorted(by.items(), key=lambda x: -x[1])],
        "hourly_value_vs_longer_averaging_norm": mismatched,
    }


def season(idx: pd.DatetimeIndex) -> np.ndarray:
    return np.where(idx.month.isin([10, 11, 12, 1, 2, 3, 4]), "heating", "warm")


def main() -> None:
    print("1/4 эталон жүктелуде…", file=sys.stderr)
    ref_raw = fetch_reference()
    lat, lon = float(ref_raw["lat"].iloc[0]), float(ref_raw["lon"].iloc[0])
    obs_h, qc = clean_reference(ref_raw)

    print("2/4 CAMS жүктелуде…", file=sys.stderr)
    cams_h, cams_meta = fetch_cams(lat, lon)

    print("3/4 метрикалар…", file=sys.stderr)
    hourly = pd.concat({"o": obs_h, "m": cams_h}, axis=1).dropna()
    hourly["day"] = hourly.index.floor("D")
    g = hourly.groupby("day")
    daily = g[["o", "m"]].mean()[g.size() >= MIN_HOURS_PER_DAY]
    qc["paired_hours"] = int(len(hourly))
    qc["valid_days"] = int(len(daily))

    m_hourly = metrics(hourly["o"].to_numpy(), hourly["m"].to_numpy())
    m_daily = metrics(daily["o"].to_numpy(), daily["m"].to_numpy())
    v = verdict(m_daily)
    by_season = {}
    for s_name in ("heating", "warm"):
        sub = daily[season(daily.index) == s_name]
        if len(sub) > 10:
            by_season[s_name] = metrics(sub["o"].to_numpy(), sub["m"].to_numpy()) | {"verdict": verdict(metrics(sub["o"].to_numpy(), sub["m"].to_numpy()))}
    monthly = daily.groupby(daily.index.month).mean().round(1)
    cont = {k: contingency(daily["o"].to_numpy(), daily["m"].to_numpy(), t) for k, t in THRESHOLDS.items()}
    kz = cont["kz_daily_35"]
    screening = (kz["pod"] is not None and kz["far"] is not None and kz["pod"] >= SCREEN_POD and kz["far"] <= SCREEN_FAR)

    print("4/4 фиксация аудиті…", file=sys.stderr)
    audit = audit_fixation()

    out = {
        "protocol": "validation/air/PROTOCOL.md v1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "station": STATION | {"lat": lat, "lon": lon},
        "period": [START, END],
        "cams": cams_meta,
        "qc": qc,
        "hourly": m_hourly,
        "daily": m_daily,
        "daily_verdict": v,
        "by_season_daily": by_season,
        "monthly_mean": {"obs": monthly["o"].to_dict(), "cams": monthly["m"].to_dict()},
        "exceedance": cont,
        "screening_signal_kz35": screening,
        "fixation_audit": audit,
    }
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2, default=float))
    daily.round(2).to_csv(HERE / "daily_pairs.csv", index_label="date_utc")
    (HERE / "results.md").write_text(render_md(out))
    print(json.dumps({"daily": m_daily, "verdict": v, "kz35": kz, "screening": screening}, ensure_ascii=False, indent=1))


def pct(x: float | None) -> str:
    return "—" if x is None else f"{x * 100:+.1f}%"


def f2(x: float | None) -> str:
    return "—" if x is None else f"{x:.2f}"


def render_md(o: dict) -> str:
    d, h, v = o["daily"], o["hourly"], o["daily_verdict"]
    mark = {"goal": "✅ мақсат", "criteria": "🟡 критерий", "fail": "❌ өтпеді"}
    L = [
        "# Валидация №1 — нәтиже: CAMS PM₂.₅ vs эталондық станса",
        "",
        f"> Хаттама: `PROTOCOL.md` v1.0 (нәтижеге дейін тіркелген). Есептелді: {o['generated_at']}.",
        f"> Скрипт: `validate_cams_pm25.py` — кез келген адам қайта жүргізе алады.",
        "",
        f"**Станса:** {o['station']['name']} (OpenAQ {o['station']['id']}, {o['station']['lat']:.3f}, {o['station']['lon']:.3f})  ",
        f"**CAMS торы:** {o['cams']['grid_lat']}, {o['cams']['grid_lon']}  ",
        f"**Кезең:** {o['period'][0]} … {o['period'][1]} · жұп сағат: {o['qc']['paired_hours']} · жарамды күн: {o['qc']['valid_days']}",
        "",
        f"## Қорытынды: {'✅ ӨТТІ' if v['pass'] else '❌ ӨТПЕДІ'} (Emery 2017 критерийлері, 24 сағ)",
        "",
        "| Метрика | Тәуліктік | Сағаттық | Шек (критерий / мақсат) | Баға |",
        "|---|---|---|---|---|",
        f"| NMB (жүйелі ауытқу) | {pct(d['nmb'])} | {pct(h['nmb'])} | ±30% / ±10% | {mark[v['levels']['nmb']]} |",
        f"| NME (орташа қате) | {d['nme']*100:.1f}% | {h['nme']*100:.1f}% | <50% / <35% | {mark[v['levels']['nme']]} |",
        f"| r (корреляция) | {f2(d['r'])} | {f2(h['r'])} | >0.40 / >0.70 | {mark[v['levels']['r']]} |",
        f"| Орташа: эталон / CAMS | {d['mean_obs']:.1f} / {d['mean_mod']:.1f} | {h['mean_obs']:.1f} / {h['mean_mod']:.1f} | | мкг/м³ |",
        f"| MAE / RMSE | {d['mae']:.1f} / {d['rmse']:.1f} | {h['mae']:.1f} / {h['rmse']:.1f} | | мкг/м³ |",
        f"| Спирман ρ / FAC2 | {f2(d['spearman'])} / {f2(d['fac2'])} | {f2(h['spearman'])} / {f2(h['fac2'])} | | |",
        "",
        "## Маусым бойынша (тәуліктік)",
        "",
        "| Маусым | n | Эталон | CAMS | NMB | NME | r | Баға |",
        "|---|---|---|---|---|---|---|---|",
    ]
    names = {"heating": "Жылыту (қаз–сәу)", "warm": "Жылы (мам–қыр)"}
    for k, s in o["by_season_daily"].items():
        L.append(f"| {names[k]} | {s['n']} | {s['mean_obs']:.1f} | {s['mean_mod']:.1f} | {pct(s['nmb'])} | {s['nme']*100:.0f}% | {f2(s['r'])} | {'✅' if s['verdict']['pass'] else '❌'} |")
    L += ["", "## Айлық орташа (мкг/м³)", "", "| Ай | " + " | ".join(str(m) for m in o["monthly_mean"]["obs"]) + " |",
          "|---|" + "---|" * len(o["monthly_mean"]["obs"]),
          "| Эталон | " + " | ".join(f"{x}" for x in o["monthly_mean"]["obs"].values()) + " |",
          "| CAMS | " + " | ".join(f"{x}" for x in o["monthly_mean"]["cams"].values()) + " |", "",
          "## «Норма асу» күндері (тәуліктік орташа, дұрыс орташалау)", "",
          "| Шек | Нақты асу күні | CAMS көрсеткен | Дәл түскен | Өткізіп алған | Жалған дабыл | POD | FAR | CSI |",
          "|---|---|---|---|---|---|---|---|---|"]
    for k, c in o["exceedance"].items():
        L.append(f"| {k} ({c['threshold']:.0f}) | {c['obs_exceed_days']} | {c['mod_exceed_days']} | {c['hits']} | {c['misses']} | {c['false_alarms']} | {f2(c['pod'])} | {f2(c['far'])} | {f2(c['csi'])} |")
    L += ["", f"**Скрининг белгісі (ҚР 35, POD ≥ 0.5 және FAR ≤ 0.5):** {'✅ жарайды' if o['screening_signal_kz35'] else '❌ жарамайды'}", ""]
    a = o["fixation_audit"]
    L += ["## Фиксация аудиті (`/api/exceedances`, тірі сайт)", ""]
    if a.get("available"):
        L += [f"Соңғы {a['days']} күнде {a['records']} жазба; ҚР заң бұзушылығы: {a['kz_violations']}.", "",
              "| Көрсеткіш | Орташалау | Шек | Акт | Жазба |", "|---|---|---|---|---|"]
        L += [f"| {b['indicator']} | {b['averaging']} | {b['limit']} | {b['jurisdiction']} | {b['count']} |" for b in a["by_norm"]]
        L += ["", f"⚠️ **{a['hourly_value_vs_longer_averaging_norm']} / {a['records']}** жазба — бір САҒАТТЫҚ мән "
              "ұзағырақ орташалауға (тәулік / 8 сағ / жыл) арналған нормамен салыстырылған. "
              "Бұл әдістемелік қате: норма сол уақыт аралығының ОРТАШАСЫНА қолданылады."]
    else:
        L += [f"Тірі эндпоинт қолжетімсіз: {a.get('error')}"]
    L += ["", "## Шектеулер", "",
          "- Астана ≠ Атырау: Атырауда ашық эталондық станса жоқ. Нәтиже Атырауға тікелей көшірілмейді.",
          "- Бір нүктелік станса vs ~40 км CAMS ұяшығы — өкілдік қатесі нәтижеге кіреді.",
          "- Толығырақ: `PROTOCOL.md` §8.", ""]
    return "\n".join(L)


if __name__ == "__main__":
    main()
