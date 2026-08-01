"""JAIYQ-ML конфигурациясы.

Барлық дерек көзі — НАҚТЫ, тегін, кілтсіз:
  · Open-Meteo Air Quality Archive (Copernicus CAMS реанализі) — мақсатты айнымалы
  · Open-Meteo Historical Weather Archive (ECMWF ERA5) — белгілер (features)

Ойдан шығарылған дерек ЖОҚ. Дерек көзі қолжетімсіз болса — оқыту тоқтайды,
модель файлы жаңартылмайды (ескі модель қалады немесе `trained: false` болады).
"""

from __future__ import annotations

import os
from datetime import date, timedelta

# --- Орналасқан жер: Атырау қаласы ---------------------------------------
LOCATION = {
    "name": "Атырау",
    "lat": 47.1167,
    "lng": 51.8833,
}

# CAMS реанализі 2022-07-29-дан басталады. Қауіпсіз шек — тамыз айынан.
TRAIN_START = date(2022, 8, 1)

# ERA5 архивінің кідірісі ~5 күн. Соңғы 7 күнді алмаймыз.
ARCHIVE_LAG_DAYS = 7


def train_end() -> date:
    return date.today() - timedelta(days=ARCHIVE_LAG_DAYS)


# --- API ұштары -----------------------------------------------------------
AQ_ARCHIVE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# Ауа сапасы: мақсатты айнымалылар
AQ_VARS = ["european_aqi", "pm2_5", "pm10"]

# Ауа райы: белгілер үшін шикі айнымалылар.
# МАҢЫЗДЫ: бұл тізімнің бәрі Open-Meteo БОЛЖАМ API-де де бар —
# сондықтан модель нақты болжам жасай алады (leakage жоқ).
WX_VARS = [
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

# --- Модель гиперпараметрлері --------------------------------------------
TARGETS = ["european_aqi", "pm2_5"]

HYPER = {
    "n_trees": 600,          # жоғарғы шек — нақты саны ерте тоқтатумен анықталады
    "learning_rate": 0.05,
    "max_depth": 5,
    "min_samples_leaf": 60,
    "n_bins": 64,
    "min_gain": 1e-6,
    "l2": 20.0,              # жапырақ регуляризациясы
    "patience": 40,          # валидацияда жақсармаса — тоқтау
}

# Хронологиялық бөліну: соңғы 20% — тексеру (test) жиыны
TEST_FRACTION = 0.2
# Оқыту жиынының соңғы 15%-ы — ерте тоқтату үшін валидация
VAL_FRACTION = 0.15

# Модель маусымдық климатологияны кемінде осынша жеңуі керек (MAE бойынша).
# Жете алмаса — `usable: false` болып, /api/ml-forecast 503 қайтарады.
# Себебі: климатологиядан артық ештеңе білмейтін модельді «AI болжам» деп
# көрсету — жалған дәлдік. Ондай нәрсе сайтқа шықпауы керек.
MIN_SKILL = 0.05

# --- Жолдар ---------------------------------------------------------------
HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "data")
DATASET_PATH = os.path.join(DATA_DIR, "dataset.json")
MODEL_OUT = os.path.abspath(
    os.path.join(HERE, "..", "src", "data", "models", "aqi-model.json")
)
REPORT_OUT = os.path.join(HERE, "report.md")

SOURCE_LABEL = (
    "Open-Meteo · Copernicus CAMS реанализі (мақсат) + ECMWF ERA5 (белгілер)"
)

# Адал ескерту — API жауабында да, UI-де де көрсетіледі.
DISCLAIMER = (
    "Модель CAMS реанализі (жаһандық атмосфералық модель) деректерінде оқытылған, "
    "жер бетіндегі өлшеу станцияларында емес. Сондықтан ол CAMS мінез-құлқын "
    "метеорологияға сүйеніп жалғастырады. Валидацияланған сенсор өлшемі емес."
)
