"""Валидация №2б — АМӨЗ үстіндегі NO2/SO2, Sentinel-5P. Хаттама: PROTOCOL.md.

Іске қосу (тегін CDSE OAuth клиенті керек: dataspace.copernicus.eu →
User settings → OAuth clients):
    SENTINELHUB_CLIENT_ID=... SENTINELHUB_CLIENT_SECRET=... python3 -I validate_s5p_anpz.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)
UA = {"User-Agent": "jaiyq-validation/1.0 (research)"}

# --- Алдын ала тіркелген параметрлер (PROTOCOL.md) ------------------------
YEARS = [("2024-01-01", "2024-12-31"), ("2025-01-01", "2025-12-31"), ("2026-01-01", "2026-10-31")]
OSM_ANPZ_WAY = 332522697
RING_KM = (5.0, 20.0)
CORE_KM = 5.0
N_SECTORS = 8
MIN_WIND = 2.0
WIND_HOUR_UTC = 9
MIN_QA = {"NO2": 75, "SO2": 50}
MIN_DAYS = 100
N_BOOT = 10_000
RES_DEG = 0.01

TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
STATS_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics"


def http(url: str, data: bytes | None = None, headers: dict | None = None, retries: int = 4) -> bytes:
    for i in range(retries):
        try:
            req = urllib.request.Request(url, data=data, headers={**UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=300) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode(errors="replace")
            if e.code in (400, 401, 403) or i == retries - 1:
                raise RuntimeError(f"{url.split('?')[0]} {e.code}: {body}") from None
        except Exception as e:  # noqa: BLE001
            if i == retries - 1:
                raise RuntimeError(f"{url.split('?')[0]}: {e}") from None
        time.sleep(5 * 2 ** i)
    raise AssertionError


def token() -> str:
    cid, sec = os.environ.get("SENTINELHUB_CLIENT_ID"), os.environ.get("SENTINELHUB_CLIENT_SECRET")
    if not (cid and sec):
        raise SystemExit("CDSE кілттері жоқ — валидация жүргізілмейді (жалған дерек жоқ).")
    body = urllib.parse.urlencode({"grant_type": "client_credentials", "client_id": cid, "client_secret": sec}).encode()
    return json.loads(http(TOKEN_URL, body))["access_token"]


def centroid() -> tuple[float, float]:
    cache = DATA / "osm_anpz.json"
    if not cache.exists():
        q = f"[out:json][timeout:60];way(id:{OSM_ANPZ_WAY});out geom;"
        cache.write_bytes(http("https://overpass-api.de/api/interpreter", urllib.parse.urlencode({"data": q}).encode()))
    g = json.loads(cache.read_text())["elements"][0]["geometry"]
    return float(np.mean([p["lat"] for p in g[:-1]])), float(np.mean([p["lon"] for p in g[:-1]]))


def geometries(lat0: float, lon0: float) -> dict[str, list]:
    kx, ky = 111.320 * np.cos(np.radians(lat0)), 110.574

    def pt(r, bearing):
        b = np.radians(bearing)
        return [lon0 + r * np.sin(b) / kx, lat0 + r * np.cos(b) / ky]

    geoms = {}
    width = 360 / N_SECTORS
    for k in range(N_SECTORS):
        c = k * width  # сектор центрі, азимут (0 = солтүстік)
        arc = np.linspace(c - width / 2, c + width / 2, 12)
        outer = [pt(RING_KM[1], a) for a in arc]
        inner = [pt(RING_KM[0], a) for a in arc[::-1]]
        ring = outer + inner + [outer[0]]
        geoms[f"s{k}"] = ring
    disk = [pt(CORE_KM, a) for a in np.linspace(0, 360, 37)]
    geoms["core"] = disk
    return geoms


EVAL = """//VERSION=3
function setup(){return{input:[{bands:["%s","dataMask"]}],output:[{id:"v",bands:1,sampleType:"FLOAT32"},{id:"dataMask",bands:1}]};}
function evaluatePixel(s){return{v:[s.%s],dataMask:[s.dataMask]};}"""


def daily_stats(tok: str, gas: str, name: str, ring: list) -> pd.Series:
    cache = DATA / f"{gas}_{name}.csv"
    if cache.exists():
        return pd.read_csv(cache, index_col=0, parse_dates=True).iloc[:, 0]
    rows = []
    for a, b in YEARS:
        body = {
            "input": {
                "bounds": {"geometry": {"type": "Polygon", "coordinates": [ring]},
                           "properties": {"crs": "http://www.opengis.net/def/crs/OGC/1.3/CRS84"}},
                "data": [{"type": "sentinel-5p-l2", "dataFilter": {"timeliness": "OFFL"},
                          "processing": {"minQa": MIN_QA[gas]}}],
            },
            "aggregation": {"timeRange": {"from": f"{a}T00:00:00Z", "to": f"{b}T23:59:59Z"},
                            "aggregationInterval": {"of": "P1D"}, "evalscript": EVAL % (gas, gas),
                            "resx": RES_DEG, "resy": RES_DEG},
        }
        j = json.loads(http(STATS_URL, json.dumps(body).encode(),
                            {"Content-Type": "application/json", "Authorization": f"Bearer {tok}"}))
        for d in j.get("data", []):
            st = d.get("outputs", {}).get("v", {}).get("bands", {}).get("B0", {}).get("stats", {})
            n_valid = (st.get("sampleCount") or 0) - (st.get("noDataCount") or 0)
            if n_valid > 0 and st.get("mean") is not None and np.isfinite(st["mean"]):
                rows.append((d["interval"]["from"][:10], st["mean"]))
        print(f"  {gas} {name} {a[:4]}: {len(rows)} күн", file=sys.stderr)
    s = pd.Series(dict(rows), dtype="float64", name=f"{gas}_{name}")
    s.index = pd.to_datetime(s.index)
    s.sort_index().to_csv(cache)
    return s.sort_index()


def wind(lat: float, lon: float) -> pd.DataFrame:
    cache = DATA / "era5_wind.json"
    if not cache.exists():
        url = ("https://archive-api.open-meteo.com/v1/archive"
               f"?latitude={lat}&longitude={lon}&start_date={YEARS[0][0]}&end_date={YEARS[-1][1]}"
               "&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=GMT")
        cache.write_bytes(http(url))
    h = json.loads(cache.read_text())["hourly"]
    df = pd.DataFrame({"spd": h["wind_speed_10m"], "dir": h["wind_direction_10m"]}, index=pd.to_datetime(h["time"]))
    df = df[df.index.hour == WIND_HOUR_UTC]
    df.index = df.index.normalize()
    return df.dropna()


def block_boot(delta: pd.Series, rng: np.random.Generator) -> tuple[float, float]:
    weeks = delta.groupby(delta.index.to_period("W"))
    blocks = [g.to_numpy() for _, g in weeks]
    means = np.empty(N_BOOT)
    for i in range(N_BOOT):
        pick = rng.integers(0, len(blocks), len(blocks))
        means[i] = np.concatenate([blocks[k] for k in pick]).mean()
    return float(np.percentile(means, 2.5)), float(np.percentile(means, 97.5))


def test(gas: str, sect: pd.DataFrame, core: pd.Series, w: pd.DataFrame, rng) -> dict:
    df = sect.join(w, how="inner").join(core.rename("core"), how="left")
    df = df[df["spd"] >= MIN_WIND]
    width = 360 / N_SECTORS
    down_idx = (((df["dir"] + 180) % 360 + width / 2) // width).astype(int) % N_SECTORS
    up_idx = ((df["dir"] % 360 + width / 2) // width).astype(int) % N_SECTORS
    arr = df[[f"s{k}" for k in range(N_SECTORS)]].to_numpy()
    down = arr[np.arange(len(df)), down_idx.to_numpy()]
    up = arr[np.arange(len(df)), up_idx.to_numpy()]
    ok = np.isfinite(down) & np.isfinite(up)
    delta = pd.Series(down[ok] - up[ok], index=df.index[ok])
    up_s = pd.Series(up[ok], index=df.index[ok])
    res = {"valid_days": int(ok.sum())}
    if len(delta) < 10:
        return res | {"pass": False, "note": "жарамды күн жоқ"}
    lo, hi = block_boot(delta, rng)
    core_d = (df["core"][ok] - up_s).dropna()
    clo, chi = block_boot(core_d, rng) if len(core_d) > 10 else (None, None)
    season = np.where(delta.index.month.isin([10, 11, 12, 1, 2, 3]), "cold", "warm")
    by_season = {s: {"days": int((season == s).sum()), "mean_delta": float(delta[season == s].mean())}
                 for s in ("cold", "warm") if (season == s).any()}
    return res | {
        "mean_delta_mol_m2": float(delta.mean()), "ci95": [lo, hi],
        "mean_upwind_mol_m2": float(up_s.mean()),
        "relative_enhancement": float(delta.mean() / up_s.mean()) if up_s.mean() else None,
        "core_minus_upwind": {"mean": float(core_d.mean()) if len(core_d) else None, "ci95": [clo, chi]},
        "by_season": by_season,
        "pass": bool(delta.mean() > 0 and lo > 0 and ok.sum() >= MIN_DAYS),
    }


def main() -> None:
    lat0, lon0 = centroid()
    geoms = geometries(lat0, lon0)
    tok = token()
    w = wind(lat0, lon0)
    rng = np.random.default_rng(20261102)
    out = {"protocol": "validation/s5p/PROTOCOL.md v1.0",
           "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "center": [lat0, lon0], "wind_days": int(len(w))}
    for gas, label in (("NO2", "H3"), ("SO2", "H4")):
        series = {name: daily_stats(tok, gas, name, ring) for name, ring in geoms.items()}
        sect = pd.concat([series[f"s{k}"].rename(f"s{k}") for k in range(N_SECTORS)], axis=1)
        out[label] = {"gas": gas} | test(gas, sect, series["core"], w, rng)
    (HERE / "results.json").write_text(json.dumps(out, ensure_ascii=False, indent=2, default=float))
    (HERE / "results.md").write_text(render(out))
    print(json.dumps(out, ensure_ascii=False, indent=1, default=float))


def render(o: dict) -> str:
    def sci(x):
        return "—" if x is None else f"{x:.2e}"

    L = ["# Валидация №2б — нәтиже: АМӨЗ үстіндегі NO₂/SO₂ (Sentinel-5P)", "",
         f"> Хаттама: `PROTOCOL.md` v1.0 (нәтижеге дейін тіркелген). Есептелді: {o['generated_at']}.", "",
         f"Орталық (OSM центроиді): {o['center'][0]:.4f}, {o['center'][1]:.4f} · ERA5 жел күндері: {o['wind_days']}", "",
         "| | Газ | Жарамды күн | Орташа Δ (down−up), моль/м² | 95% СА | Салыстырмалы артық | Орталық−up | Нәтиже |",
         "|---|---|---|---|---|---|---|---|"]
    for k in ("H3", "H4"):
        r = o[k]
        ci = r.get("ci95", [None, None])
        cu = r.get("core_minus_upwind", {})
        rel = r.get("relative_enhancement")
        L.append(f"| {k} | {r['gas']} | {r['valid_days']} | {sci(r.get('mean_delta_mol_m2'))} | "
                 f"[{sci(ci[0])}, {sci(ci[1])}] | {'—' if rel is None else f'{rel*100:+.1f}%'} | "
                 f"{sci(cu.get('mean'))} | {'✅ ӨТТІ' if r['pass'] else '❌ ӨТПЕДІ'} |")
    L += ["", "## Маусым бойынша Δ", ""]
    for k in ("H3", "H4"):
        for s, v in o[k].get("by_season", {}).items():
            L.append(f"- {k} {o[k]['gas']} · {'суық' if s == 'cold' else 'жылы'}: {v['days']} күн, Δ = {sci(v['mean_delta'])}")
    L += ["", "## Шектеулер", "", "- АМӨЗ пен ЖЭО шекаралас — TROPOMI пикселінде ажыратылмайды.",
          "- SO₂ (H4) — зерттеу деңгейі; теріс нәтиже «көз жоқ» дегенді білдірмейді.",
          "- Толығырақ: `PROTOCOL.md` §5.", ""]
    return "\n".join(L)


if __name__ == "__main__":
    main()
