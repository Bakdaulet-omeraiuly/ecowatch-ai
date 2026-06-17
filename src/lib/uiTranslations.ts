// Карта беті (және басқа жол-тығыз компоненттер) үшін аударма картасы.
// Кілт — қазақ мәтінінің өзі. tr() функциясы lang бойынша аударады.
// kk әдепкі (картадағы түпнұсқа), сондықтан тек ru/en беріледі.

export const UI_TR: Record<string, { ru: string; en: string }> = {
  // Батырмалар / панель тақырыптары
  "Қабаттар": { ru: "Слои", en: "Layers" },
  "Спутник": { ru: "Спутник", en: "Satellite" },
  "Қала картасы": { ru: "Карта города", en: "City map" },
  "Эко қабаттар": { ru: "Эко-слои", en: "Eco layers" },
  "AI талдау": { ru: "AI-анализ", en: "AI analysis" },
  "AI агент": { ru: "AI-агент", en: "AI agent" },
  "көп дереккөз": { ru: "мультиисточник", en: "multi-source" },
  "қосулы": { ru: "вкл", en: "on" },
  "өшулі": { ru: "выкл", en: "off" },
  "Хабарламалар": { ru: "Сообщения", en: "Reports" },
  "Тарихи режим": { ru: "Исторический режим", en: "Historical mode" },
  "Нүкте қосу": { ru: "Добавить точку", en: "Add point" },

  // AI құралдар тақтасы
  "📍 Нүкте": { ru: "📍 Точка", en: "📍 Point" },
  "⬡ Аумақ": { ru: "⬡ Область", en: "⬡ Area" },
  "Талдау": { ru: "Анализ", en: "Analyze" },
  "Тазалау": { ru: "Очистить", en: "Clear" },
  "Картадан нүкте басыңыз — спутник + тірі деректер талданады": {
    ru: "Нажмите точку на карте — анализ спутника + живых данных",
    en: "Click a point — satellite + live data analysis",
  },
  "Талдау үшін сол жақтан «AI талдау» қосыңыз": {
    ru: "Включите «AI-анализ» слева для анализа",
    en: "Enable “AI analysis” on the left to analyze",
  },

  // Жалпы
  "Жүктелуде…": { ru: "Загрузка…", en: "Loading…" },
  "Бүгін": { ru: "Сегодня", en: "Today" },
  "Ойнату": { ru: "Воспроизвести", en: "Play" },
  "Тоқтату": { ru: "Стоп", en: "Stop" },
  "мин": { ru: "мин", en: "min" },
  "орташа": { ru: "сред.", en: "avg" },
  "макс": { ru: "макс", en: "max" },
  "Қабаттарды жасыру": { ru: "Скрыть слои", en: "Hide layers" },
  "Жасыру": { ru: "Скрыть", en: "Hide" },
  "Қабатты өшіру": { ru: "Выключить слой", en: "Turn off layer" },

  // Тірі панель тақырыптары
  "Дала/орман өрті қаупі — тірі": { ru: "Риск степного/лесного пожара — live", en: "Wildfire risk — live" },
  "Құрғақшылық индексі — SPI-3": { ru: "Индекс засухи — SPI-3", en: "Drought index — SPI-3" },
  "Маса қолайлылығы — тірі": { ru: "Комфортность для комаров — live", en: "Mosquito suitability — live" },
  "Газ факелдері — тірі": { ru: "Газовые факелы — live", en: "Gas flares — live" },
  "Қоқыс нүктелері": { ru: "Точки мусора", en: "Waste points" },
  "Топырақ жағдайы — тірі": { ru: "Состояние почвы — live", en: "Soil condition — live" },
  "Жайық өзені — тірі ағын": { ru: "Река Урал — живой сток", en: "Ural river — live flow" },
  "Қоқыс туралы хабарлау": { ru: "Сообщить о мусоре", en: "Report waste" },
  "Радар": { ru: "Радар", en: "Radar" },
  "Төбе қосыңыз": { ru: "Добавьте вершину", en: "Add a vertex" },

  // Эко қабат атаулары
  "Маса": { ru: "Комары", en: "Mosquito" },
  "Ауа": { ru: "Воздух", en: "Air" },
  "Топырақ": { ru: "Почва", en: "Soil" },
  "Мұнай": { ru: "Нефть", en: "Oil" },
  "Қоқыс": { ru: "Мусор", en: "Waste" },
  "Су": { ru: "Вода", en: "Water" },
  "Өрт": { ru: "Пожар", en: "Fire" },
  "Құрғақшылық": { ru: "Засуха", en: "Drought" },

  // Жалпы ескерту
  "Тірі ауа райы деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.": {
    ru: "Живые метеоданные временно недоступны — ложные данные не показываются.",
    en: "Live weather data temporarily unavailable — no fake data shown.",
  },
  "Тірі деректер уақытша қолжетімсіз — жалған дерек көрсетілмейді.": {
    ru: "Живые данные временно недоступны — ложные данные не показываются.",
    en: "Live data temporarily unavailable — no fake data shown.",
  },

  // Құрғақшылық / шкала
  "Архив деректері уақытша қолжетімсіз — жалған дерек көрсетілмейді.": { ru: "Архивные данные временно недоступны — ложные данные не показываются.", en: "Archive data temporarily unavailable — no fake data shown." },
  "Құрғақ": { ru: "Сухо", en: "Dry" },
  "Қалыпты": { ru: "Норма", en: "Normal" },
  "Ылғалды": { ru: "Влажно", en: "Wet" },
  "3-айлық жауын": { ru: "Осадки за 3 мес.", en: "3-month precip." },

  // Маса
  "күн": { ru: "дн", en: "d" },
  "сағ": { ru: "ч", en: "h" },

  // Факелдер
  "NASA FIRMS кілті қажет (тегін). Қосылғанша факелдер көрсетілмейді.": { ru: "Нужен ключ NASA FIRMS (бесплатно). До подключения факелы не показываются.", en: "NASA FIRMS key required (free). Flares hidden until connected." },
  "Соңғы 2 күнде жану нүктесі анықталмады.": { ru: "За последние 2 дня очаги горения не обнаружены.", en: "No fire spots detected in the last 2 days." },
  "анықталған жану нүктесі (2 күн)": { ru: "обнаруженных очагов (2 дня)", en: "detected fire spots (2 days)" },

  // Қоқыс
  "Әзірге қоқыс нүктесі жоқ. Картаны басып AI талдаңыз немесе фото-хабарлама жіберіңіз.": { ru: "Пока нет точек мусора. Нажмите на карту для AI-анализа или отправьте фото.", en: "No waste points yet. Click the map for AI analysis or send a photo." },
  "барлығы": { ru: "всего", en: "total" },
  "расталған": { ru: "подтверждено", en: "confirmed" },
  "азаматтан": { ru: "от граждан", en: "from citizens" },

  // Топырақ
  "орташа ылғал м³/м³": { ru: "ср. влажность м³/м³", en: "avg moisture m³/m³" },
  "деградация стрессі": { ru: "стресс деградации", en: "degradation stress" },

  // Су / өзен
  "Өзен деректері қолжетімсіз.": { ru: "Данные о реке недоступны.", en: "River data unavailable." },

  // Ауа
  "Ауа сапасы — тірі": { ru: "Качество воздуха — live", en: "Air quality — live" },
  "облыс бойынша орташа EU AQI": { ru: "ср. EU AQI по области", en: "avg EU AQI for region" },
  "🩺 Денсаулық кеңесі": { ru: "🩺 Совет по здоровью", en: "🩺 Health advice" },
  "Сезімтал топтар:": { ru: "Чувствительные группы:", en: "Sensitive groups:" },
  "Басты ластаушы": { ru: "Главный загрязнитель", en: "Main pollutant" },
  "Алдағы 24 сағат — нақты CAMS болжамы": { ru: "Ближайшие 24 ч — реальный прогноз CAMS", en: "Next 24h — real CAMS forecast" },
  "Қала аудандары": { ru: "Районы города", en: "City districts" },

  // Нүкте қосу / тарих
  "Координат бойынша": { ru: "По координатам", en: "By coordinates" },
  "Талдау жасау": { ru: "Анализировать", en: "Analyze" },
  "Атыраудың нақты спутник тарихы (2000–2025)": { ru: "Реальная спутниковая история Атырау (2000–2025)", en: "Real satellite history of Atyrau (2000–2025)" },
  "Тайм-лапс": { ru: "Таймлапс", en: "Timelapse" },
  "Қазір": { ru: "Сейчас", en: "Now" },
  "AI талдап жатыр…": { ru: "AI анализирует…", en: "AI analyzing…" },

  // Title жапсырмалары
  "Атырау қаласына жақындау": { ru: "Приблизить к Атырау", en: "Zoom to Atyrau" },
  "Жақындату": { ru: "Приблизить", en: "Zoom in" },
  "Алыстату": { ru: "Отдалить", en: "Zoom out" },
  "Жабу": { ru: "Закрыть", en: "Close" },

  // Әдістеме абзацтары
  "🦟 иконкалар индекс бойынша шоғырланады. Слайдермен 7 күндік болжамды көріңіз. Басты фактор —": {
    ru: "🦟 иконки группируются по индексу. Слайдером смотрите прогноз на 7 дней. Главный фактор —",
    en: "🦟 icons cluster by index. Use the slider for the 7-day forecast. Main factor —",
  },
  "Жайық жайылмасы мен атырауы": { ru: "пойма и дельта Урала", en: "Ural floodplain and delta" },
  "(қамыс, тұрған су) + температура + жаңбыр + қала. Әдістеме: Mordecai 2017 (WHO/ECDC) + гидрология. Дереккөз: Open-Meteo.": {
    ru: "(камыш, застойная вода) + температура + дождь + город. Методика: Mordecai 2017 (WHO/ECDC) + гидрология. Источник: Open-Meteo.",
    en: "(reeds, standing water) + temperature + rain + city. Methodology: Mordecai 2017 (WHO/ECDC) + hydrology. Source: Open-Meteo.",
  },
  "Тірі деректер қолжетімсіз": { ru: "Живые данные недоступны", en: "Live data unavailable" },
  "🔥 иконка өлшемі — жану қуатына (FRP) сай. Мұнай-газ кен орындарының факелдері спутниктен жылулық аномалия ретінде көрінеді. Дереккөз: NASA FIRMS (VIIRS 375м).": {
    ru: "🔥 размер иконки соответствует мощности горения (FRP). Факелы нефтегазовых месторождений видны со спутника как тепловые аномалии. Источник: NASA FIRMS (VIIRS 375м).",
    en: "🔥 icon size reflects fire power (FRP). Oil & gas field flares appear from space as thermal anomalies. Source: NASA FIRMS (VIIRS 375m).",
  },
  "Қоқыс — жергілікті мәселе, спутник API-ы жоқ. Сондықтан ол AI спутник талдауы мен азаматтық фото-хабарламалардан жинақталады (краудсорсинг).": {
    ru: "Мусор — локальная проблема, спутникового API нет. Поэтому он собирается из AI-анализа спутника и фото-сообщений граждан (краудсорсинг).",
    en: "Waste is a local issue with no satellite API. So it's aggregated from AI satellite analysis and citizen photo reports (crowdsourcing).",
  },
  "Сары/қызыл аймақ — құрғақ топырақ, жоғары деградация/тұздану стрессі. Көк — ылғалды, сау. Есеп: түбір қабатының ылғалы + температура + 30 күндік жаңбыр. Дереккөз: Open-Meteo (ECMWF).": {
    ru: "Жёлтая/красная зона — сухая почва, высокий стресс деградации/засоления. Синяя — влажная, здоровая. Расчёт: влажность корневого слоя + температура + дождь за 30 дней. Источник: Open-Meteo (ECMWF).",
    en: "Yellow/red zone — dry soil, high degradation/salinization stress. Blue — moist, healthy. Calculation: root-zone moisture + temperature + 30-day rain. Source: Open-Meteo (ECMWF).",
  },
  "Атырау тұсы · тренд": { ru: "У Атырау · тренд", en: "Near Atyrau · trend" },
  "Нақты өзен ағыны мен тасқын қаупі. Жоғары ағын → жайылма су басу → маса ошақтары. Дереккөз: Copernicus GloFAS (Open-Meteo).": {
    ru: "Реальный сток реки и риск паводка. Высокий сток → затопление поймы → очаги комаров. Источник: Copernicus GloFAS (Open-Meteo).",
    en: "Real river flow and flood risk. High flow → floodplain inundation → mosquito hotspots. Source: Copernicus GloFAS (Open-Meteo).",
  },
  "EU AQI (EAQI), Copernicus CAMS — сағат сайын. Аудандар CAMS ажыратымдылығымен (~10км) бағаланады.": {
    ru: "EU AQI (EAQI), Copernicus CAMS — ежечасно. Районы оцениваются с разрешением CAMS (~10км).",
    en: "EU AQI (EAQI), Copernicus CAMS — hourly. Districts assessed at CAMS resolution (~10km).",
  },
  "Бұл жылдың нүктелері": { ru: "Точек этого года", en: "Points this year" },
  "жыл — NASA MODIS нақты суреті (250м, шолу деңгейі). Sentinel-2 спутнигі 2015 жылы ұшырылғандықтан, бұдан ескі жоғары сапалы сурет жоқ.": {
    ru: "г. — реальный снимок NASA MODIS (250м, обзорный). Спутник Sentinel-2 запущен в 2015 г., более старых снимков высокого качества нет.",
    en: "— real NASA MODIS image (250m, overview). Sentinel-2 launched in 2015, no older high-quality imagery exists.",
  },
  "жыл — бұлтсыз Sentinel-2 мозаикасы (10м), дәл сол жылғы Атыраудың шынайы көрінісі. Картаны бассаңыз, AI сол жылғы суретті талдайды.": {
    ru: "г. — безоблачная мозаика Sentinel-2 (10м), реальный вид Атырау того года. Нажмите на карту — AI проанализирует снимок того года.",
    en: "— cloudless Sentinel-2 mosaic (10m), real view of Atyrau that year. Click the map — AI will analyze that year's image.",
  },
  "Қазіргі Mapbox спутник суреті. Слайдерді жылжытып, өткен жылдармен салыстырыңыз.": {
    ru: "Текущий спутниковый снимок Mapbox. Двигайте слайдер, чтобы сравнить с прошлыми годами.",
    en: "Current Mapbox satellite imagery. Move the slider to compare with past years.",
  },
};

// ── Дашборд ──────────────────────────────────────────────────────────
Object.assign(UI_TR, {
  "Аймақтық аналитика": { ru: "Региональная аналитика", en: "Regional analytics" },
  "Атырау облысының экологиялық жағдайы — нақты уақытта": { ru: "Экологическая обстановка Атырауской области — в реальном времени", en: "Environmental status of Atyrau region — in real time" },
  "Шолу": { ru: "Обзор", en: "Overview" },
  "Рейтинг": { ru: "Рейтинг", en: "Ranking" },
  "Жылу картасы": { ru: "Тепловая карта", en: "Heatmap" },
  "Болжам": { ru: "Прогноз", en: "Forecast" },
  "Климат болашағы": { ru: "Климат будущего", en: "Climate future" },
  // Графиктер
  "Тәуекел деңгейлері бойынша": { ru: "По уровням риска", en: "By risk levels" },
  "Мәселе түрлері": { ru: "Типы проблем", en: "Issue types" },
  "Аудандар бойынша орташа тәуекел (платформа талдаулары)": { ru: "Средний риск по районам (анализы платформы)", en: "Average risk by district (platform analyses)" },
  "Ауа сапасы болжамы — алдағы 48 сағат (Copernicus CAMS моделі)": { ru: "Прогноз качества воздуха — 48 ч (модель Copernicus CAMS)", en: "Air quality forecast — next 48h (Copernicus CAMS model)" },
  "Ауа сапасы — соңғы 30 күн, нақты өлшем (Copernicus CAMS)": { ru: "Качество воздуха — 30 дней, реальные измерения (Copernicus CAMS)", en: "Air quality — last 30 days, real measurements (Copernicus CAMS)" },
  "Аймақтық тәуекел: тарих + 6 айлық AI болжамы": { ru: "Региональный риск: история + AI-прогноз на 6 мес.", en: "Regional risk: history + 6-month AI forecast" },
  "Маса белсенділігінің маусымдық болжамы — математикалық модель (тасқын маусымы + климат)": { ru: "Сезонный прогноз активности комаров — мат. модель (паводок + климат)", en: "Seasonal mosquito activity forecast — math model (flood season + climate)" },
  "Жылдық орташа температура: 2000–2050 (IPCC CMIP6 проекциясы)": { ru: "Среднегодовая температура: 2000–2050 (проекция IPCC CMIP6)", en: "Annual mean temperature: 2000–2050 (IPCC CMIP6 projection)" },
  "Жер су қорының өзгерісі: 1995–қазір (ERA5 топырақ ылғалы)": { ru: "Изменение запасов воды: 1995–сейчас (влажность почвы ERA5)", en: "Water storage change: 1995–now (ERA5 soil moisture)" },
  // Мәселе түрлері
  "Деградация": { ru: "Деградация", en: "Degradation" },
  "Тұрған су": { ru: "Застойная вода", en: "Standing water" },
  // KPI
  "Талданған нүктелер": { ru: "Проанализировано точек", en: "Points analyzed" },
  "Жоғары тәуекел": { ru: "Высокий риск", en: "High risk" },
  "Тексеруге белгіленген": { ru: "Помечено к проверке", en: "Flagged for review" },
  "Орташа тәуекел": { ru: "Средний риск", en: "Average risk" },
  // Тірі мониторинг
  "Тірі мониторинг — Атырау": { ru: "Живой мониторинг — Атырау", en: "Live monitoring — Atyrau" },
  "Тірі деректер уақытша қолжетімсіз — дереккөзге қосылу мүмкін болмады. Жалған дерек көрсетілмейді.": { ru: "Живые данные временно недоступны — не удалось подключиться к источнику. Ложные данные не показываются.", en: "Live data temporarily unavailable — couldn't connect to source. No fake data shown." },
  "Тірі деректер жүктелуде…": { ru: "Загрузка живых данных…", en: "Loading live data…" },
  "Температура": { ru: "Температура", en: "Temperature" },
  "Жел": { ru: "Ветер", en: "Wind" },
  "Ылғалдылық": { ru: "Влажность", en: "Humidity" },
  "Қысым": { ru: "Давление", en: "Pressure" },
  "Соңғы жаңару": { ru: "Последнее обновление", en: "Last update" },
  // Климат болашағы
  "Климат деректері жүктелуде…": { ru: "Загрузка климатических данных…", en: "Loading climate data…" },
  "2050 жылға температура": { ru: "Температура к 2050", en: "Temperature by 2050" },
  "Жауын-шашын өзгерісі": { ru: "Изменение осадков", en: "Precipitation change" },
  "Жер су қоры трендісі (GRACE баламасы)": { ru: "Тренд запасов воды (аналог GRACE)", en: "Water storage trend (GRACE analog)" },
  "онжылдықта": { ru: "за десятилетие", en: "per decade" },
  "Климат жылдары": { ru: "Годы климата", en: "Climate years" },
  "ERA5 архиві": { ru: "Архив ERA5", en: "ERA5 archive" },
  // Рейтинг / жылу
  "Аудандардың эко-рейтингі": { ru: "Эко-рейтинг районов", en: "District eco-ranking" },
  "Апталық тәуекел жылу картасы — соңғы 12 апта": { ru: "Тепловая карта риска по неделям — последние 12 недель", en: "Weekly risk heatmap — last 12 weeks" },
  // FWI карточка
  "Дала/орман өрті қаупі — FWI": { ru: "Риск степного/лесного пожара — FWI", en: "Wildfire risk — FWI" },
  // Жалпы
  "Деректер жоқ": { ru: "Нет данных", en: "No data" },
  "Маусымдық ескерту:": { ru: "Сезонное предупреждение:", en: "Seasonal alert:" },
  "Тірі мониторинг — Атырау қ.": { ru: "Живой мониторинг — г. Атырау", en: "Live monitoring — Atyrau city" },
  "Дереккөз: Open-Meteo + Copernicus CAMS (ЕО ресми атмосфера қызметі) · сағат сайын жаңарады": { ru: "Источник: Open-Meteo + Copernicus CAMS (офиц. служба атмосферы ЕС) · обновление ежечасно", en: "Source: Open-Meteo + Copernicus CAMS (EU official atmosphere service) · updated hourly" },
  "Қорытынды:": { ru: "Вывод:", en: "Conclusion:" },
});

// ── Ескертулер беті + жалпы тәуекел/статус ──────────────────────────
Object.assign(UI_TR, {
  "Хабарлау орталығы": { ru: "Центр оповещений", en: "Alert center" },
  "Тәуекелі жоғары нүктелер бойынша жауапты органдарға автоматты жіберілген хабарламалар": { ru: "Сообщения, автоматически отправленные ответственным органам по точкам высокого риска", en: "Alerts automatically sent to responsible authorities for high-risk points" },
  "Шешілді деп белгілеу": { ru: "Отметить решённым", en: "Mark resolved" },
  "Әзірге ескертулер жоқ. Картада талдау жасаңыз — тәуекелі жоғары (55+) нүктелер бойынша хабарламалар осында автоматты пайда болады.": { ru: "Пока нет оповещений. Сделайте анализ на карте — сообщения по точкам высокого риска (55+) появятся здесь автоматически.", en: "No alerts yet. Run an analysis on the map — alerts for high-risk points (55+) appear here automatically." },
  "Демо режимі: хабарламалар жүйе ішінде модельденеді. Өндірісте — e-eGov / email / Telegram интеграциясы арқылы нақты жіберіледі.": { ru: "Демо-режим: сообщения моделируются внутри системы. В продакшене — реально отправляются через e-eGov / email / Telegram.", en: "Demo mode: alerts are simulated in-system. In production they're sent via e-eGov / email / Telegram integration." },
  // Статус (lib/alerts)
  "Жіберілді": { ru: "Отправлено", en: "Sent" },
  "Қабылданды": { ru: "Принято", en: "Acknowledged" },
  "Тексеруде": { ru: "Проверяется", en: "Inspecting" },
  "Шешілді": { ru: "Решено", en: "Resolved" },
  // Тәуекел деңгейлері (lib/risk RISK_LABELS_KZ)
  "Төмен": { ru: "Низкий", en: "Low" },
  "Қауіпті": { ru: "Критический", en: "Critical" },
  "Орташа": { ru: "Средний", en: "Medium" },
});

// ── Салыстыру беті ───────────────────────────────────────────────────
Object.assign(UI_TR, {
  "Жыл салыстыру": { ru: "Сравнение лет", en: "Compare years" },
  "Нақты спутник суреттері: Sentinel-2 (2016–2025) · NASA MODIS (2000–2015)": { ru: "Реальные спутниковые снимки: Sentinel-2 (2016–2025) · NASA MODIS (2000–2015)", en: "Real satellite imagery: Sentinel-2 (2016–2025) · NASA MODIS (2000–2015)" },
  "Орын": { ru: "Место", en: "Location" },
  "Сол жыл": { ru: "Левый год", en: "Left year" },
  "Оң жыл": { ru: "Правый год", en: "Right year" },
  "Слайдерді сүйреп жылжытыңыз": { ru: "Перетащите слайдер", en: "Drag the slider" },
  "NASA MODIS Terra (250 м ажыратымдылық) — Sentinel-2 спутнигі 2015 жылға дейін болмаған, сондықтан осы дәуірдің жалғыз нақты дереккөзі.": { ru: "NASA MODIS Terra (разрешение 250 м) — спутник Sentinel-2 до 2015 г. не существовал, поэтому это единственный реальный источник той эпохи.", en: "NASA MODIS Terra (250 m resolution) — Sentinel-2 didn't exist before 2015, so this is the only real source for that era." },
  "Sentinel-2 Cloudless (EOX, ESA Copernicus, 10 м) — жыл сайынғы жазғы мозаика, бұлтсыз.": { ru: "Sentinel-2 Cloudless (EOX, ESA Copernicus, 10 м) — ежегодная летняя мозаика, безоблачная.", en: "Sentinel-2 Cloudless (EOX, ESA Copernicus, 10 m) — annual summer mosaic, cloudless." },
  // Орындар (ATYRAU_SPOTS)
  "Атырау қаласы": { ru: "город Атырау", en: "Atyrau city" },
  "Жайық өзені жайылмасы": { ru: "Пойма реки Урал", en: "Ural river floodplain" },
  "Мұнай зауыты маңы": { ru: "Район НПЗ", en: "Near oil refinery" },
  "Теңіз кен орны": { ru: "Месторождение Тенгиз", en: "Tengiz field" },
  "Солтүстік аймақ": { ru: "Северная зона", en: "Northern zone" },
  "Таңдалған нүкте (AI талдау)": { ru: "Выбранная точка (AI-анализ)", en: "Selected point (AI analysis)" },
});

export function translate(s: string, lang: "kk" | "ru" | "en"): string {
  if (lang === "kk") return s;
  return UI_TR[s]?.[lang] ?? s;
}
