"""H3 (NO2) нәтижесін жел бағыты бойынша бөлу — PROTOCOL.md §5 (сипаттама).
validate_s5p_anpz.py кэшін (data/) қолданады. Шығыс: results.md соңына қосылады.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
N, W = 8, 45
NAMES = ["С", "СШ", "Ш", "ОШ", "О", "ОБ", "Б", "СБ"]
sect = pd.concat([pd.read_csv(HERE / f"data/NO2_s{k}.csv", index_col=0, parse_dates=True).iloc[:, 0].rename(f"s{k}")
                  for k in range(N)], axis=1)
h = json.loads((HERE / "data/era5_wind.json").read_text())["hourly"]
w = pd.DataFrame({"spd": h["wind_speed_10m"], "dir": h["wind_direction_10m"]}, index=pd.to_datetime(h["time"]))
w = w[w.index.hour == 9]
w.index = w.index.normalize()
df = sect.join(w, how="inner")
df = df[df.spd >= 2]
down = (((df.dir + 180) % 360 + W / 2) // W).astype(int) % N
up = ((df.dir % 360 + W / 2) // W).astype(int) % N
a = df[[f"s{k}" for k in range(N)]].to_numpy()
i = np.arange(len(df))
d = pd.DataFrame({"down": down.values, "delta": a[i, down] - a[i, up], "up": a[i, up]}, index=df.index).dropna()
L = ["", "## Жел бағыты бойынша бөлу (NO₂, сипаттама — §5)", "",
     "| Ық жақ сектор | Күн | Δ (down−up), 10⁻⁶ моль/м² | Салыстырмалы |", "|---|---|---|---|"]
pos = 0
for k in range(N):
    s = d[d.down == k]
    if len(s):
        pos += s.delta.mean() > 0
        L.append(f"| {NAMES[k]} ({k * 45}°) | {len(s)} | {s.delta.mean() * 1e6:.1f} | {s.delta.mean() / s.up.mean() * 100:+.0f}% |")
L += ["", f"Δ > 0 сегіз бағыттың **{pos}-інде** — оның ішінде ық жақ қаладан алыс жатқан (О, ОШ, Ш) бағыттарда да.",
      "Демек сигнал «қала бір секторда тұр» деген артефакт емес.", "",
      "⚠️ **Түсіндіру шегі:** TROPOMI пикселі ≈ 3.5×5.5 км, қала орталығы АМӨЗ-ден ~5 км. Бұл — **АМӨЗ + ЖЭО + қаланың "
      "шығыс бөлігі** көз тобының сигналы, тек АМӨЗ емес. Шығарынды мөлшері (т/жыл) бағаланбаған.", ""]
p = HERE / "results.md"
txt = p.read_text().split("\n## Жел бағыты бойынша бөлу")[0].rstrip("\n") + "\n"
p.write_text(txt + "\n".join(L))
print("\n".join(L))
