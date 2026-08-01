"""Нақты тарихи деректерді Open-Meteo архивінен жүктеу.

Екі архив бөлек сұралады да, сағаттық белгі (timestamp) бойынша біріктіріледі.
Сұраныстар жыл бойынша бөлшектеледі — ұзын аралық бір сұраныста сәтсіз болуы мүмкін.

Ешқандай ойдан дерек жасалмайды: сұраныс сәтсіз болса — қате көтеріледі.
"""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

import config as C

USER_AGENT = "jaiyq-ml/1.0 (+https://ecojaiyq.com)"


def _get(url: str, params: dict, retries: int = 4) -> dict:
    qs = urllib.parse.urlencode(params, doseq=True)
    full = f"{url}?{qs}"
    delay = 2.0
    last: Exception | None = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as exc:
            last = exc
            if attempt < retries - 1:
                print(f"  … сұраныс сәтсіз ({exc}), {delay:.0f}с күтіп қайталаймыз")
                time.sleep(delay)
                delay *= 2
    raise RuntimeError(f"Дерек көзі қолжетімсіз: {full[:120]}… — {last}")


def _year_chunks(start: date, end: date) -> list[tuple[date, date]]:
    chunks: list[tuple[date, date]] = []
    cur = start
    while cur <= end:
        stop = min(date(cur.year, 12, 31), end)
        chunks.append((cur, stop))
        cur = date(cur.year + 1, 1, 1)
    return chunks


def _fetch_series(url: str, variables: list[str], start: date, end: date) -> dict[str, dict]:
    """Уақыт → {айнымалы: мән} сөздігін қайтарады."""
    out: dict[str, dict] = {}
    for a, b in _year_chunks(start, end):
        print(f"  {a} … {b}")
        data = _get(
            url,
            {
                "latitude": C.LOCATION["lat"],
                "longitude": C.LOCATION["lng"],
                "start_date": a.isoformat(),
                "end_date": b.isoformat(),
                "hourly": ",".join(variables),
                "timezone": "UTC",
            },
        )
        hourly = data.get("hourly") or {}
        times = hourly.get("time") or []
        if not times:
            raise RuntimeError(f"Бос жауап: {url} {a}..{b}")
        for i, t in enumerate(times):
            row = out.setdefault(t, {})
            for v in variables:
                col = hourly.get(v)
                row[v] = col[i] if col is not None and i < len(col) else None
    return out


def build_dataset(force: bool = False) -> dict:
    os.makedirs(C.DATA_DIR, exist_ok=True)
    start, end = C.TRAIN_START, C.train_end()

    if not force and os.path.exists(C.DATASET_PATH):
        with open(C.DATASET_PATH, encoding="utf-8") as fh:
            cached = json.load(fh)
        if cached.get("end") == end.isoformat() and cached.get("start") == start.isoformat():
            print(f"Кэш қолданылды: {len(cached['rows'])} сағаттық жазба")
            return cached

    print(f"Ауа сапасы архиві (CAMS) жүктелуде — {start} … {end}")
    aq = _fetch_series(C.AQ_ARCHIVE_URL, C.AQ_VARS, start, end)
    print(f"Ауа райы архиві (ERA5) жүктелуде — {start} … {end}")
    wx = _fetch_series(C.WX_ARCHIVE_URL, C.WX_VARS, start, end)

    times = sorted(set(aq) & set(wx))
    rows = []
    for t in times:
        row = {"time": t}
        row.update({k: aq[t].get(k) for k in C.AQ_VARS})
        row.update({k: wx[t].get(k) for k in C.WX_VARS})
        rows.append(row)

    if len(rows) < 8760:
        raise RuntimeError(
            f"Дерек тым аз ({len(rows)} сағат) — оқыту тоқтатылды, жалған модель жасалмайды"
        )

    dataset = {
        "location": C.LOCATION,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "source": C.SOURCE_LABEL,
        "rows": rows,
    }
    with open(C.DATASET_PATH, "w", encoding="utf-8") as fh:
        json.dump(dataset, fh)
    print(f"Жиналды: {len(rows)} сағаттық жазба → {C.DATASET_PATH}")
    return dataset


if __name__ == "__main__":
    build_dataset(force=True)
