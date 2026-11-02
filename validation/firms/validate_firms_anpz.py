"""Валидация №2а — АМӨЗ үстіндегі VIIRS жылу аномалиялары. Хаттама: PROTOCOL.md.

Іске қосу:
    FIRMS_MAP_KEY=... python3 -I validate_firms_anpz.py
(тегін кілт: https://firms.modaps.eosdis.nasa.gov/api/map_key/)

Шығыс: results.json, results.md; шикі кэш data/ ішінде (git-ке кірмейді).
"""
from __future__ import annotations

import io
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)
UA = {"User-Agent": "jaiyq-validation/1.0 (research)"}

# --- Алдын ала тіркелген параметрлер (PROTOCOL.md §2–4) -------------------
START, END = date(2024, 1, 1), date(2026, 10, 31)
BBOX = (51.70, 46.95, 52.20, 47.25)  # W, S, E, N
OSM_WAYS = {"anpz": 332522697, "tets": 332522696}
REGISTRY_ANPZ = (47.0736, 51.9257)  # src/data/facilities.ts
BUFFER_KM = 0.375
RADIUS_RULE_KM = 10.0  # /api/object/[id]
H1_MIN_DAYS_PER_YEAR = 12
H1_MIN_DENSITY_RATIO = 10
H2_MIN_PRECISION = 0.80
CLUSTER_CELL_KM, CLUSTER_MIN_DAYS = 0.75, 20

LAT0 = 47.08
KX, KY = 111.320 * np.cos(np.radians(LAT0)), 110.574  # км / градус


def xy(lat, lon):
    return (np.asarray(lon) - BBOX[0]) * KX, (np.asarray(lat) - BBOX[1]) * KY


def get(url: str, data: bytes | None = None, retries: int = 4) -> bytes:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                safe = url.replace(os.environ.get("FIRMS_MAP_KEY", "\0"), "<KEY>")
                raise RuntimeError(f"{safe.split('?')[0]}: {e}") from e
            time.sleep(3 * 2 ** i)
    raise AssertionError


# --- Геометрия -------------------------------------------------------------
def fetch_osm() -> dict[str, np.ndarray]:
    cache = DATA / "osm_ways.json"
    if not cache.exists():
        q = f"[out:json][timeout:60];way(id:{','.join(map(str, OSM_WAYS.values()))});out geom;"
        raw = get("https://overpass-api.de/api/interpreter", urllib.parse.urlencode({"data": q}).encode())
        cache.write_bytes(raw)
    els = {e["id"]: e for e in json.loads(cache.read_text())["elements"]}
    polys = {}
    for name, wid in OSM_WAYS.items():
        g = els[wid]["geometry"]
        x, y = xy([p["lat"] for p in g], [p["lon"] for p in g])
        polys[name] = np.column_stack([x, y])
    return polys


def inside(px, py, poly) -> np.ndarray:
    x, y = poly[:, 0], poly[:, 1]
    res = np.zeros(len(px), bool)
    for i in range(len(x) - 1):
        xi, yi, xj, yj = x[i], y[i], x[i + 1], y[i + 1]
        cond = (yi > py) != (yj > py)
        with np.errstate(divide="ignore", invalid="ignore"):
            xint = (xj - xi) * (py - yi) / (yj - yi) + xi
        res ^= cond & (px < xint)
    return res


def dist_to_poly(px, py, poly) -> np.ndarray:
    """км; іште болса 0."""
    d = np.full(len(px), np.inf)
    for i in range(len(poly) - 1):
        a, b = poly[i], poly[i + 1]
        ab = b - a
        t = np.clip(((px - a[0]) * ab[0] + (py - a[1]) * ab[1]) / max(ab @ ab, 1e-12), 0, 1)
        d = np.minimum(d, np.hypot(px - (a[0] + t * ab[0]), py - (a[1] + t * ab[1])))
    d[inside(px, py, poly)] = 0.0
    return d


def poly_area(poly) -> float:
    x, y = poly[:, 0], poly[:, 1]
    return 0.5 * abs(np.dot(x, np.roll(y, 1)) - np.dot(y, np.roll(x, 1)))


def buffered_area(poly, buf, step=0.025) -> float:
    """Буферленген аудан (км²) — тор бойынша санау."""
    x0, y0 = poly.min(0) - buf - step
    x1, y1 = poly.max(0) + buf + step
    gx, gy = np.meshgrid(np.arange(x0, x1, step), np.arange(y0, y1, step))
    return float((dist_to_poly(gx.ravel(), gy.ravel(), poly) <= buf).sum() * step * step)


# --- FIRMS -----------------------------------------------------------------
def sources_for(day: date) -> list[str]:
    sp_end = date(2026, 7, 31)
    out = []
    for sat in ("VIIRS_SNPP", "VIIRS_NOAA20", "VIIRS_NOAA21"):
        if day <= sp_end:
            if sat == "VIIRS_NOAA21" and day < date(2023, 3, 1):
                continue
            out.append(f"{sat}_SP")
        else:
            out.append(f"{sat}_NRT")
    return out


def fetch_firms(key: str) -> pd.DataFrame:
    cache = DATA / f"firms_{START}_{END}.csv"
    if cache.exists():
        return pd.read_csv(cache)
    area = ",".join(map(str, BBOX))
    frames, d, n = [], START, 0
    while d <= END:
        span = min(5, (END - d).days + 1)  # FIRMS API: 1..5 күн
        if d <= date(2026, 7, 31):  # SP/NRT шекарасынан аспау
            span = min(span, (date(2026, 7, 31) - d).days + 1)
        for src in sources_for(d):
            url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{src}/{area}/{span}/{d}"
            txt = get(url).decode()
            if txt.startswith("Invalid") or "Invalid" in txt[:200]:
                raise SystemExit(f"FIRMS қатесі ({src} {d}): {txt[:120]}")
            df = pd.read_csv(io.StringIO(txt)) if txt.strip() else pd.DataFrame()
            if len(df):
                df["source"] = src
                frames.append(df)
            n += 1
        d += timedelta(days=span)
        if n % 30 == 0:
            print(f"  FIRMS {d}: {sum(len(f) for f in frames)} детекция", file=sys.stderr)
    df = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    df.to_csv(cache, index=False)
    return df


# --- Талдау ----------------------------------------------------------------
def main() -> None:
    key = os.environ.get("FIRMS_MAP_KEY")
    if not key:
        raise SystemExit("FIRMS_MAP_KEY жоқ — валидация жүргізілмейді (жалған дерек жоқ).")
    print("1/3 OSM контурлары…", file=sys.stderr)
    polys = fetch_osm()
    print("2/3 FIRMS архиві…", file=sys.stderr)
    raw = fetch_firms(key)
    df = raw.drop_duplicates(["latitude", "longitude", "acq_date", "acq_time", "source"]).copy()
    df["date"] = pd.to_datetime(df["acq_date"]).dt.date
    df = df[(df["date"] >= START) & (df["date"] <= END)]
    px, py = xy(df["latitude"].to_numpy(), df["longitude"].to_numpy())

    print("3/3 талдау…", file=sys.stderr)
    dist = {k: dist_to_poly(px, py, p) for k, p in polys.items()}
    near = np.vstack([dist["anpz"], dist["tets"]])
    in_any = near.min(0) <= BUFFER_KM
    nearest = np.where(dist["anpz"] <= dist["tets"], "anpz", "tets")
    df["facility"] = np.where(in_any, nearest, "")
    rx, ry = xy(REGISTRY_ANPZ[0], REGISTRY_ANPZ[1])
    df["dist_registry_km"] = np.hypot(px - rx, py - ry)

    years = ((END - START).days + 1) / 365.25
    bbox_area = (BBOX[2] - BBOX[0]) * KX * (BBOX[3] - BBOX[1]) * KY
    fac_area = {k: buffered_area(p, BUFFER_KM) for k, p in polys.items()}
    bg_area = bbox_area - sum(fac_area.values())  # буферлер шамалы қиылысады — консервативті
    n_bg = int((~in_any).sum())
    bg_density = n_bg / bg_area

    def fac_stats(name: str) -> dict:
        sub = df[df["facility"] == name]
        days = sub["date"].nunique()
        dens = len(sub) / fac_area[name]
        return {
            "detections": int(len(sub)),
            "detection_days": int(days),
            "detection_days_per_year": days / years,
            "area_km2_buffered": fac_area[name],
            "osm_area_km2": poly_area(polys[name]),
            "density_per_km2": dens,
            "density_ratio_vs_background": dens / bg_density if bg_density else None,
            "night_share": float((sub["daynight"] == "N").mean()) if len(sub) else None,
            "confidence": sub["confidence"].astype(str).value_counts().to_dict(),
            "firms_type": sub["type"].astype(str).value_counts().to_dict() if "type" in sub else {},
            "frp_median_mw": float(sub["frp"].median()) if len(sub) else None,
            "frp_p90_mw": float(sub["frp"].quantile(0.9)) if len(sub) else None,
            "monthly_detection_days": {str(k): int(v) for k, v in sub.groupby(pd.to_datetime(sub["acq_date"]).dt.to_period("M"))["date"].nunique().items()},
        }

    anpz, tets = fac_stats("anpz"), fac_stats("tets")
    h1 = {
        "days_per_year": anpz["detection_days_per_year"],
        "density_ratio": anpz["density_ratio_vs_background"],
        "pass": bool(anpz["detection_days_per_year"] >= H1_MIN_DAYS_PER_YEAR
                     and (anpz["density_ratio_vs_background"] or 0) >= H1_MIN_DENSITY_RATIO),
    }
    rule = df[df["dist_registry_km"] <= RADIUS_RULE_KM]
    prec = float((rule["facility"] == "anpz").mean()) if len(rule) else None
    rule_breakdown = {
        "anpz_footprint": int((rule["facility"] == "anpz").sum()),
        "tets_footprint": int((rule["facility"] == "tets").sum()),
        "elsewhere": int((rule["facility"] == "").sum()),
    }
    rule_days = rule.groupby("date")["facility"].apply(lambda s: (s == "anpz").any())
    h2 = {"attributed": int(len(rule)), "breakdown": rule_breakdown, "precision": prec,
          "attributed_days": int(len(rule_days)), "days_with_any_anpz_detection": int(rule_days.sum()),
          "pass": bool(prec is not None and prec >= H2_MIN_PRECISION)}

    # Тұрақты кластерлер (~750 м тор)
    df["cx"], df["cy"] = (px // CLUSTER_CELL_KM).astype(int), (py // CLUSTER_CELL_KM).astype(int)
    cl = df.groupby(["cx", "cy"]).agg(days=("date", "nunique"), n=("date", "size"),
                                      lat=("latitude", "mean"), lon=("longitude", "mean"),
                                      frp_med=("frp", "median"), night=("daynight", lambda s: (s == "N").mean()),
                                      fac=("facility", lambda s: s.mode().iat[0] if len(s) else ""),
                                      dreg=("dist_registry_km", "mean")).reset_index()
    cl = cl[cl["days"] >= CLUSTER_MIN_DAYS].sort_values("days", ascending=False)
    clusters = [{k: (round(v, 4) if isinstance(v, float) else (int(v) if isinstance(v, (np.integer,)) else v))
                 for k, v in r.items() if k not in ("cx", "cy")} for r in cl.to_dict("records")]

    out = {
        "protocol": "validation/firms/PROTOCOL.md v1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "period": [str(START), str(END)], "years": years, "bbox": BBOX,
        "total_detections": int(len(df)), "by_source": df["source"].value_counts().to_dict(),
        "background": {"detections": n_bg, "area_km2": bg_area, "density_per_km2": bg_density},
        "anpz": anpz, "tets": tets, "H1": h1, "H2": h2, "persistent_clusters": clusters,
    }
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2, default=float))
    (HERE / "results.md").write_text(render(out))
    print(json.dumps({"total": out["total_detections"], "H1": h1, "H2": h2, "tets_days": tets["detection_days"],
                      "clusters": clusters[:8]}, ensure_ascii=False, indent=1, default=float))


def f(x, nd=2):
    return "—" if x is None else f"{x:.{nd}f}"


def render(o: dict) -> str:
    a, t, h1, h2 = o["anpz"], o["tets"], o["H1"], o["H2"]
    ok = lambda b: "✅ ӨТТІ" if b else "❌ ӨТПЕДІ"  # noqa: E731
    L = [
        "# Валидация №2а — нәтиже: АМӨЗ үстіндегі VIIRS жылу аномалиялары", "",
        f"> Хаттама: `PROTOCOL.md` v1.0 (нәтижеге дейін тіркелген). Есептелді: {o['generated_at']}.", "",
        f"**Кезең:** {o['period'][0]} … {o['period'][1]} ({o['years']:.2f} жыл) · барлық детекция аумақта: {o['total_detections']}  ",
        "**Спутниктер:** " + ", ".join(f"{k} {v}" for k, v in o["by_source"].items()), "",
        f"## H1 — спутник АМӨЗ-ді көре ме? {ok(h1['pass'])}", "",
        "| Метрика | АМӨЗ | ЖЭО (салыстыру) | Шек |", "|---|---|---|---|",
        f"| Детекция-күн, барлығы | {a['detection_days']} | {t['detection_days']} | |",
        f"| Детекция-күн / жыл | {f(a['detection_days_per_year'],1)} | {f(t['detection_days_per_year'],1)} | ≥ {H1_MIN_DAYS_PER_YEAR} |",
        f"| Тығыздық / фон | {f(a['density_ratio_vs_background'],0)}× | {f(t['density_ratio_vs_background'],0)}× | ≥ {H1_MIN_DENSITY_RATIO}× |",
        f"| FIRMS `type` (0 өсімдік өрті · 2 тұрақты жер көзі) | {a.get('firms_type')} | {t.get('firms_type')} | |",
        f"| Түнгі үлес | {f(a['night_share'])} | {f(t['night_share'])} | |",
        f"| FRP медиана / p90, МВт | {f(a['frp_median_mw'],1)} / {f(a['frp_p90_mw'],1)} | {f(t['frp_median_mw'],1)} / {f(t['frp_p90_mw'],1)} | |",
        "", f"Фон: {o['background']['detections']} детекция / {o['background']['area_km2']:.0f} км².", "",
        f"## H2 — 10 км ережесі дұрыс тели ме? {ok(h2['pass'])}", "",
        f"`/api/object/anpz` 10 км радиусқа {h2['attributed']} детекцияны АМӨЗ-ге телір еді:", "",
        "| Шын орны | Детекция |", "|---|---|",
        f"| АМӨЗ аумағы (+375 м) | {h2['breakdown']['anpz_footprint']} |",
        f"| ЖЭО аумағы | {h2['breakdown']['tets_footprint']} |",
        f"| Басқа жер | {h2['breakdown']['elsewhere']} |",
        f"| **Дәлдік (precision)** | **{f(h2['precision'])}** (шек ≥ {H2_MIN_PRECISION}) |", "",
        "## Айлық детекция-күндер (АМӨЗ)", "",
        "| Ай | " + " | ".join(a["monthly_detection_days"]) + " |",
        "|---|" + "---|" * len(a["monthly_detection_days"]),
        "| Күн | " + " | ".join(map(str, a["monthly_detection_days"].values())) + " |", "",
        f"## Тұрақты кластерлер (≥ {CLUSTER_MIN_DAYS} детекция-күн, ~750 м тор)", "",
        "| lat, lon | Детекция-күн | Түнгі үлес | FRP мед., МВт | Нысан аумағы | Тізілім нүктесінен, км |",
        "|---|---|---|---|---|---|",
    ]
    for c in o["persistent_clusters"]:
        L.append(f"| {c['lat']:.4f}, {c['lon']:.4f} | {c['days']} | {c['night']:.2f} | {c['frp_med']:.1f} | {c['fac'] or '— (тізілімде жоқ)'} | {c['dreg']:.1f} |")
    L += ["", "## Шектеулер", "",
          "- VIIRS факелді, өртті және ыстық өнеркәсіп бетін ажыратпайды.",
          "- Детекцияның болмауы факелдің болмауын дәлелдемейді.",
          "- Толығырақ: `PROTOCOL.md` §6.", ""]
    return "\n".join(L)


if __name__ == "__main__":
    main()
