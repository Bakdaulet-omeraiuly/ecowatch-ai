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

  // Атмосфера қабат атаулары (спутник панелі)
  "Атмосфера": { ru: "Атмосфера", en: "Atmosphere" },
  "Азот диоксиді (NO₂)": { ru: "Диоксид азота (NO₂)", en: "Nitrogen Dioxide (NO₂)" },
  "Күкірт диоксиді (SO₂)": { ru: "Диоксид серы (SO₂)", en: "Sulfur Dioxide (SO₂)" },
  "Метан (CH₄)": { ru: "Метан (CH₄)", en: "Methane (CH₄)" },
  "Көміртек тотығы (CO)": { ru: "Угарный газ (CO)", en: "Carbon Monoxide (CO)" },
  "Аэрозоль / шаң (AOD)": { ru: "Аэрозоль / пыль (AOD)", en: "Aerosol / Dust (AOD)" },
  "Қар жамылғысы (NDSI)": { ru: "Снежный покров (NDSI)", en: "Snow Cover (NDSI)" },

  // Спутник қабат атаулары
  "Шынайы түс (10 м)": { ru: "Естественный цвет (10 м)", en: "True color (10 m)" },
  "Жалған түс (өсімдік)": { ru: "Ложный цвет (растит.)", en: "False color (vegetation)" },
  "Өсімдік (NDVI)": { ru: "Растительность (NDVI)", en: "Vegetation (NDVI)" },
  "Ылғалдылық (NDMI)": { ru: "Влажность (NDMI)", en: "Moisture (NDMI)" },
  "Ауыл шаруашылығы": { ru: "Сельское хозяйство", en: "Agriculture" },
  "SWIR (өрт/ылғал)": { ru: "SWIR (пожар/влага)", en: "SWIR (fire/moisture)" },
  "Геология / топырақ": { ru: "Геология / почва", en: "Geology / soil" },
  "Су беті / тереңдік": { ru: "Поверхность воды", en: "Water surface" },
  "Жер беті жылуы (күндіз)": { ru: "Температура поверхности (день)", en: "Land surface temp (day)" },
  "Аэрозоль / шаң": { ru: "Аэрозоль / пыль", en: "Aerosol / dust" },
  "Түнгі жарық": { ru: "Ночное освещение", en: "Night lights" },
  "Су / мұнай (VV)": { ru: "Вода / нефть (VV)", en: "Water / oil (VV)" },
  "Өсімдік / құрылым (VH)": { ru: "Растит. / структура (VH)", en: "Vegetation / structure (VH)" },

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

// ── Модерация беті ───────────────────────────────────────────────────
Object.assign(UI_TR, {
  "Модерация панелі": { ru: "Панель модерации", en: "Moderation panel" },
  "Азаматтардың фото-хабарламаларын қарап, растаңыз немесе өшіріңіз": { ru: "Просматривайте фото-сообщения граждан, подтверждайте или удаляйте", en: "Review citizen photo reports, confirm or delete" },
  "Жаңарту": { ru: "Обновить", en: "Refresh" },
  "Растау": { ru: "Подтвердить", en: "Confirm" },
  "Қабылдамау": { ru: "Отклонить", en: "Reject" },
  "Жою": { ru: "Удалить", en: "Delete" },
  "Хабарламалар жоқ": { ru: "Сообщений нет", en: "No reports" },
  "Фото жоқ": { ru: "Нет фото", en: "No photo" },
  "Тәуекел": { ru: "Риск", en: "Risk" },
  "Сүзгі": { ru: "Фильтр", en: "Filter" },
  "Барлығын көру": { ru: "Показать все", en: "Show all" },
  "Барлығы": { ru: "Все", en: "All" },
  "Күтілуде": { ru: "Ожидает", en: "Pending" },
  "Расталған": { ru: "Подтверждённые", en: "Confirmed" },
  "Өшірілген": { ru: "Удалённые", en: "Removed" },
  // STATUS_CFG label
  "Расталды": { ru: "Подтверждено", en: "Confirmed" },
  // toast
  "Хабарламаларды жүктеу мүмкін болмады": { ru: "Не удалось загрузить сообщения", en: "Failed to load reports" },
  "Өзгерту мүмкін болмады": { ru: "Не удалось изменить", en: "Couldn't update" },
  "Жою мүмкін болмады": { ru: "Не удалось удалить", en: "Couldn't delete" },
  "Хабарлама жойылды": { ru: "Сообщение удалено", en: "Report deleted" },
});

// ── Хабарлау беті ────────────────────────────────────────────────────
Object.assign(UI_TR, {
  "Экологиялық мәселе туралы хабарлау": { ru: "Сообщить об экологической проблеме", en: "Report an environmental issue" },
  "Фото түсіріңіз — AI оны талдап, сол нүктенің спутник суретімен салыстырып растайды": { ru: "Сделайте фото — AI проанализирует и сверит со спутниковым снимком этой точки", en: "Take a photo — AI analyzes it and cross-checks with the satellite image of the point" },
  "Фото": { ru: "Фото", en: "Photo" },
  "Жүктелген фото": { ru: "Загруженное фото", en: "Uploaded photo" },
  "Галереядан": { ru: "Из галереи", en: "From gallery" },
  "Камера": { ru: "Камера", en: "Camera" },
  "Галереядан таңдау": { ru: "Выбрать из галереи", en: "Choose from gallery" },
  "Камерадан түсіру": { ru: "Снять на камеру", en: "Take with camera" },
  "Орналасу — картадан белгілеңіз": { ru: "Локация — отметьте на карте", en: "Location — mark on the map" },
  "GPS арқылы анықтау": { ru: "Определить по GPS", en: "Detect via GPS" },
  "Ендік (lat)": { ru: "Широта (lat)", en: "Latitude (lat)" },
  "Бойлық (lng)": { ru: "Долгота (lng)", en: "Longitude (lng)" },
  "Сипаттама (міндетті емес)": { ru: "Описание (необязательно)", en: "Description (optional)" },
  "Мысалы: өзен жағасында қоқыс үйіндісі, жанында тұрған су бар…": { ru: "Например: свалка на берегу реки, рядом застойная вода…", en: "E.g.: a waste pile by the river, standing water nearby…" },
  "Жіберу және AI талдауын алу": { ru: "Отправить и получить AI-анализ", en: "Submit and get AI analysis" },
  "Атымыз белгісіз": { ru: "Имя неизвестно", en: "Anonymous" },
  "Азамат белсенділерінің лидерборды": { ru: "Лидерборд активных граждан", en: "Citizen activists leaderboard" },
  "хабарлама": { ru: "сообщений", en: "reports" },
  "расталған": { ru: "подтверждено", en: "confirmed" },
  "XP = расталған хабарлама × 10 + барлық хабарлама × 2. Лидерборд нақты уақытта жаңарады.": { ru: "XP = подтверждённые × 10 + все сообщения × 2. Лидерборд обновляется в реальном времени.", en: "XP = confirmed reports × 10 + all reports × 2. Leaderboard updates in real time." },
  // toast
  "Фотоны оқу мүмкін болмады": { ru: "Не удалось прочитать фото", en: "Couldn't read the photo" },
  "Орналасу анықталды": { ru: "Локация определена", en: "Location detected" },
  "GPS қолжетімсіз — координатты қолмен енгізіңіз": { ru: "GPS недоступен — введите координаты вручную", en: "GPS unavailable — enter coordinates manually" },
  "Фото жүктеңіз": { ru: "Загрузите фото", en: "Upload a photo" },
  "Координаттарды енгізіңіз": { ru: "Введите координаты", en: "Enter coordinates" },
  "AI фотоны тексеріп, спутникпен салыстырып жатыр…": { ru: "AI проверяет фото и сверяет со спутником…", en: "AI is checking the photo and comparing with satellite…" },
  "Фото қабылданбады": { ru: "Фото отклонено", en: "Photo rejected" },
  "✅ Хабарлама расталды және бәріне көрінеді!": { ru: "✅ Сообщение подтверждено и видно всем!", en: "✅ Report confirmed and visible to everyone!" },
  "Хабарлама қабылданды — бәріне көрінеді": { ru: "Сообщение принято — видно всем", en: "Report accepted — visible to everyone" },
  "Жіберу сәтсіз. Қайталап көріңіз.": { ru: "Не удалось отправить. Попробуйте снова.", en: "Submission failed. Please try again." },
});

// ── Эко паспорт ──────────────────────────────────────────────────────
Object.assign(UI_TR, {
  "Эко паспорт": { ru: "Эко паспорт", en: "Eco passport" },
  "Атырау облысының жылдық экологиялық паспорты": { ru: "Годовой экологический паспорт Атырауской области", en: "Annual environmental passport of Atyrau region" },
  "басып шығару": { ru: "печать", en: "print" },
  "Экологиялық мониторинг": { ru: "Экологический мониторинг", en: "Environmental monitoring" },
  "Атырау облысының экологиялық паспорты": { ru: "Экологический паспорт Атырауской области", en: "Environmental passport of Atyrau region" },
  "Жасалған күні": { ru: "Дата создания", en: "Created on" },
  "Деректер нақты уақытта": { ru: "Данные в реальном времени", en: "Real-time data" },
  "Дереккөздер:": { ru: "Источники:", en: "Sources:" },
  "Ауа сапасы": { ru: "Качество воздуха", en: "Air quality" },
  "EU AQI (Copernicus CAMS, нақты)": { ru: "EU AQI (Copernicus CAMS, реальный)", en: "EU AQI (Copernicus CAMS, real)" },
  "Жел жылдамдығы": { ru: "Скорость ветра", en: "Wind speed" },
  "Газ факелдері (мұнай-газ саласы)": { ru: "Газовые факелы (нефтегаз)", en: "Gas flares (oil & gas)" },
  "Анықталған жану нүктесі (соңғы 2 күн)": { ru: "Обнаружено очагов (за 2 дня)", en: "Detected fire spots (last 2 days)" },
  "Дереккөз": { ru: "Источник", en: "Source" },
  "м ажыратымдылық": { ru: "м разрешение", en: "m resolution" },
  "Атырау облысы шекарасы ішінде ғана": { ru: "Только в пределах Атырауской области", en: "Within Atyrau region boundaries only" },
  "Аймақ": { ru: "Регион", en: "Region" },
  "Азаматтық хабарламалар": { ru: "Сообщения граждан", en: "Citizen reports" },
  "Жіберілген хабарламалар (барлық уақытта)": { ru: "Отправлено сообщений (за всё время)", en: "Reports submitted (all time)" },
  "AI растаған хабарламалар": { ru: "Подтверждено AI", en: "AI-confirmed reports" },
  "Расталу пайызы": { ru: "Процент подтверждения", en: "Confirmation rate" },
  "Жалпы экологиялық жағдай": { ru: "Общая экологическая обстановка", en: "Overall environmental status" },
  "Платформа бағасы": { ru: "Оценка платформы", en: "Platform assessment" },
  "Деградациялық тренд": { ru: "Тренд деградации", en: "Degradation trend" },
  "Мониторинг жүргізілуде": { ru: "Ведётся мониторинг", en: "Monitoring in progress" },
  "Ұсыныс": { ru: "Рекомендация", en: "Recommendation" },
  "Ауа сапасы нашар — сезімтал топтарға сыртқа шықпаған дұрыс": { ru: "Качество воздуха плохое — чувствительным группам лучше не выходить на улицу", en: "Poor air quality — sensitive groups should stay indoors" },
  "Қазіргі жағдай қалыпты деңгейде — мониторингті жалғастыру ұсынылады": { ru: "Текущая обстановка в норме — рекомендуется продолжать мониторинг", en: "Current status is normal — continued monitoring is recommended" },
  "Бұл паспорт": { ru: "Этот паспорт", en: "This passport" },
  "платформасының нақты уақыттағы ресми дереккөздерден (Copernicus CAMS, Open-Meteo, NASA FIRMS) алынған деректер негізінде автоматты жасалады. Жалған дерек қолданылмайды.": { ru: "формируется автоматически на основе данных платформы в реальном времени из официальных источников (Copernicus CAMS, Open-Meteo, NASA FIRMS). Ложные данные не используются.", en: "is generated automatically from the platform's real-time data from official sources (Copernicus CAMS, Open-Meteo, NASA FIRMS). No fake data is used." },
  "Платформа: Атырау облысы": { ru: "Платформа: Атырауская область", en: "Platform: Atyrau region" },
  "Hakaton жобасы": { ru: "Хакатон-проект", en: "Hackathon project" },
  // Рейтинг (ratingFor)
  "Өте жаман": { ru: "Очень плохо", en: "Very poor" },
  "Жаман": { ru: "Плохо", en: "Poor" },
  "Қанағаттанарлық": { ru: "Удовлетворительно", en: "Fair" },
  "Жақсы": { ru: "Хорошо", en: "Good" },
  "Өте жақсы": { ru: "Отлично", en: "Excellent" },
});

// ── Спутник қабаттарының атаулары (Sentinel-2 / GIBS / радар) ─────────
Object.assign(UI_TR, {
  "Шынайы түс (10 м)": { ru: "Натуральный цвет (10 м)", en: "True color (10 m)" },
  "Жалған түс (өсімдік)": { ru: "Ложный цвет (растительность)", en: "False color (vegetation)" },
  "Өсімдік (NDVI)": { ru: "Растительность (NDVI)", en: "Vegetation (NDVI)" },
  "Ылғалдылық (NDMI)": { ru: "Влажность (NDMI)", en: "Moisture (NDMI)" },
  "Ауыл шаруашылығы": { ru: "Сельское хозяйство", en: "Agriculture" },
  "SWIR (өрт/ылғал)": { ru: "SWIR (пожар/влага)", en: "SWIR (fire/moisture)" },
  "Геология / топырақ": { ru: "Геология / почва", en: "Geology / soil" },
  "Су беті / тереңдік": { ru: "Поверхность воды / глубина", en: "Water surface / depth" },
  // Радар (Sentinel-1)
  "Су / мұнай (VV)": { ru: "Вода / нефть (VV)", en: "Water / oil (VV)" },
  "Өсімдік / құрылым (VH)": { ru: "Растительность / структура (VH)", en: "Vegetation / structure (VH)" },
  // GIBS резерв
  "Жалған түс (7-2-1)": { ru: "Ложный цвет (7-2-1)", en: "False color (7-2-1)" },
  "Жер беті жылуы (күндіз)": { ru: "Темп. поверхности (день)", en: "Land surface temp (day)" },
  "Жер беті жылуы (түнгі)": { ru: "Темп. поверхности (ночь)", en: "Land surface temp (night)" },
  "Аэрозоль / шаң": { ru: "Аэрозоль / пыль", en: "Aerosol / dust" },
  "Түнгі жарық": { ru: "Ночное освещение", en: "Night lights" },
  "Өсімдік+ (EVI)": { ru: "Растительность+ (EVI)", en: "Vegetation+ (EVI)" },
  // Атмосфералық газдар
  "Атмосфера · газдар": { ru: "Атмосфера · газы", en: "Atmosphere · gases" },
  "Метан (CH₄)": { ru: "Метан (CH₄)", en: "Methane (CH₄)" },
  "Азот диоксиді (NO₂)": { ru: "Диоксид азота (NO₂)", en: "Nitrogen dioxide (NO₂)" },
  "Күкірт диоксиді (SO₂)": { ru: "Диоксид серы (SO₂)", en: "Sulfur dioxide (SO₂)" },
  "Көміртек тотығы (CO)": { ru: "Оксид углерода (CO)", en: "Carbon monoxide (CO)" },
  "Аэрозоль (3 км)": { ru: "Аэрозоль (3 км)", en: "Aerosol (3 km)" },
  "Қар жамылғысы": { ru: "Снежный покров", en: "Snow cover" },
  // Жел қабаты
  "Жел": { ru: "Ветер", en: "Wind" },
  "Жел бағыты — тірі": { ru: "Направление ветра — live", en: "Wind direction — live" },
  "Стрелка — желдің кететін бағыты. Дереккөз: Open-Meteo (ECMWF).": { ru: "Стрелка — куда дует ветер. Источник: Open-Meteo (ECMWF).", en: "Arrow — where the wind blows to. Source: Open-Meteo (ECMWF)." },
  "Жел әлсіз — қалыпты жағдай.": { ru: "Ветер слабый — обычные условия.", en: "Wind is weak — normal conditions." },
  "Жел орташа — шаң аздап көтеріледі.": { ru: "Ветер умеренный — немного поднимается пыль.", en: "Moderate wind — some dust is raised." },
  "Жел күшті — шаң мен ластану тез таралады, өрт қаупі артады.": { ru: "Ветер сильный — пыль и загрязнение быстро разносятся, риск пожара растёт.", en: "Strong wind — dust and pollution spread fast, fire risk rises." },
  "Дауыл — өте қатты жел, далада сақ болыңыз.": { ru: "Шторм — очень сильный ветер, будьте осторожны на улице.", en: "Storm — very strong wind, be careful outdoors." },
  // Компас
  "Солтүстік": { ru: "Север", en: "North" },
  "Солтүстік-шығыс": { ru: "Северо-восток", en: "Northeast" },
  "Шығыс": { ru: "Восток", en: "East" },
  "Оңтүстік-шығыс": { ru: "Юго-восток", en: "Southeast" },
  "Оңтүстік": { ru: "Юг", en: "South" },
  "Оңтүстік-батыс": { ru: "Юго-запад", en: "Southwest" },
  "Батыс": { ru: "Запад", en: "West" },
  "Солтүстік-батыс": { ru: "Северо-запад", en: "Northwest" },
});

// ── Талдау нәтиже терезесі (AnalysisDrawer) ──────────────────────────
Object.assign(UI_TR, {
  "Расталды": { ru: "Подтверждено", en: "Confirmed" },
  "Расталмады": { ru: "Не подтверждено", en: "Unconfirmed" },
  "Қайшы келеді": { ru: "Противоречит", en: "Contradicts" },
  "Талданған аумақ": { ru: "Проанализированная область", en: "Analyzed area" },
  "Талданған нүкте": { ru: "Проанализированная точка", en: "Analyzed point" },
  "жыл": { ru: "г.", en: "yr" },
  "Соңғы талдау": { ru: "Последний анализ", en: "Last analysis" },
  "Растау үшін тағы басыңыз": { ru: "Нажмите ещё раз для подтверждения", en: "Click again to confirm" },
  "Нүктені өшіру": { ru: "Удалить точку", en: "Delete point" },
  "Соңғы деректермен жаңарту": { ru: "Обновить по свежим данным", en: "Refresh with latest data" },
  "Азамат фотосы": { ru: "Фото гражданина", en: "Citizen photo" },
  "Үлкейту": { ru: "Увеличить", en: "Enlarge" },
  "Спутник суреті": { ru: "Спутниковый снимок", en: "Satellite image" },
  "Спутник көрінісі": { ru: "Спутниковый вид", en: "Satellite view" },
  "Спутник көрінісі (қазіргі)": { ru: "Спутниковый вид (текущий)", en: "Satellite view (current)" },
  "тәуекел": { ru: "риск", en: "risk" },
  "Сенімділік": { ru: "Достоверность", en: "Confidence" },
  "Маса индексі": { ru: "Индекс комаров", en: "Mosquito index" },
  "🛢 Мұнай ластануы": { ru: "🛢 Нефтяное загрязнение", en: "🛢 Oil pollution" },
  "🗑 Заңсыз қоқыс": { ru: "🗑 Незаконная свалка", en: "🗑 Illegal dumping" },
  "🏜 Жер деградациясы": { ru: "🏜 Деградация земель", en: "🏜 Land degradation" },
  "💧 Тұрған су": { ru: "💧 Застойная вода", en: "💧 Standing water" },
  "Анықталған белгілер": { ru: "Выявленные признаки", en: "Detected features" },
  "ML спектрлік талдау": { ru: "ML спектральный анализ", en: "ML spectral analysis" },
  "Sentinel-2 · 10м": { ru: "Sentinel-2 · 10м", en: "Sentinel-2 · 10m" },
  "Спутник деректері есептелуде…": { ru: "Спутниковые данные вычисляются…", en: "Computing satellite data…" },
  "NDVI · өсімдік": { ru: "NDVI · растительность", en: "NDVI · vegetation" },
  "NDWI · су": { ru: "NDWI · вода", en: "NDWI · water" },
  "NDMI · ылғал": { ru: "NDMI · влага", en: "NDMI · moisture" },
  "NDBI · құрылыс": { ru: "NDBI · застройка", en: "NDBI · built-up" },
  "соңғы бұлтсыз кадр": { ru: "последний безоблачный кадр", en: "latest cloudless frame" },
  "Спектрлік талдау қолжетімсіз (бұлт болуы мүмкін) — жалған дерек көрсетілмейді.": { ru: "Спектральный анализ недоступен (возможно облачность) — ложные данные не показываются.", en: "Spectral analysis unavailable (possibly clouds) — no fake data shown." },
  "LLM Vision талдауы": { ru: "Анализ LLM Vision", en: "LLM Vision analysis" },
  "AI агент — көп дереккөзді талдау": { ru: "AI-агент — мультиисточниковый анализ", en: "AI agent — multi-source analysis" },
  "Тек спутникке емес, тірі ресми деректерге де сүйенді:": { ru: "Опирался не только на спутник, но и на живые официальные данные:", en: "Relied not only on satellite but also live official data:" },
  "Ғылыми сараптама": { ru: "Научная экспертиза", en: "Scientific assessment" },
  "GPT-4o пайымдауы": { ru: "Оценка GPT-4o", en: "GPT-4o reasoning" },
  "Ластанған аумақ": { ru: "Загрязнённая площадь", en: "Polluted area" },
  "Жақын инфрақұрылым": { ru: "Близкая инфраструктура", en: "Nearby infrastructure" },
  "Динамика:": { ru: "Динамика:", en: "Dynamics:" },
  "Текстура:": { ru: "Текстура:", en: "Texture:" },
  "Себеп-салдар талдауы": { ru: "Причинно-следственный анализ", en: "Cause-effect analysis" },
  "сенімділік": { ru: "достоверность", en: "confidence" },
  "Дәлел:": { ru: "Доказательство:", en: "Evidence:" },
  "Болжам:": { ru: "Прогноз:", en: "Prediction:" },
  "Деректерге негізделген ұсыныс": { ru: "Рекомендация на основе данных", en: "Data-driven recommendation" },
  "Талдау деректеріне сай ұсыныс дайындалуда…": { ru: "Готовим рекомендацию по данным анализа…", en: "Preparing a recommendation from the analysis data…" },
  "Жіберілді ✓": { ru: "Отправлено ✓", en: "Sent ✓" },
  "Жіберілуде…": { ru: "Отправка…", en: "Sending…" },
  "Тиісті органға жіберу": { ru: "Отправить в орган", en: "Send to authority" },
  "Белгіленген": { ru: "Помечено", en: "Flagged" },
  "Белгілеу": { ru: "Пометить", en: "Flag" },
  "PDF экспорт": { ru: "Экспорт PDF", en: "PDF export" },
  "Тарихи салыстыру": { ru: "Историческое сравнение", en: "Historical compare" },
  "Жабу үшін кез келген жерді басыңыз": { ru: "Нажмите в любом месте, чтобы закрыть", en: "Click anywhere to close" },
  // toast
  "✅ Тиісті органға (модераторға) жіберілді": { ru: "✅ Отправлено в орган (модератору)", en: "✅ Sent to authority (moderator)" },
  "Жіберу мүмкін болмады (Telegram бапталмаған болуы мүмкін)": { ru: "Не удалось отправить (возможно, Telegram не настроен)", en: "Couldn't send (Telegram may not be configured)" },
  "Нүкте өшірілді": { ru: "Точка удалена", en: "Point deleted" },
  "Соңғы спутник деректері бойынша қайта талданып жатыр…": { ru: "Повторный анализ по свежим спутниковым данным…", en: "Re-analyzing with the latest satellite data…" },
  "Деректер жаңартылды!": { ru: "Данные обновлены!", en: "Data updated!" },
  "Жаңарту сәтсіз аяқталды. Қайталап көріңіз.": { ru: "Не удалось обновить. Попробуйте снова.", en: "Update failed. Please try again." },
  "Иә": { ru: "Да", en: "Yes" },
  "Жоқ": { ru: "Нет", en: "No" },
});

// ── WasteDetector (YOLO) + LocationPicker ────────────────────────────
Object.assign(UI_TR, {
  "YOLO арқылы қоқысты анықтау": { ru: "Найти мусор через YOLO", en: "Detect waste with YOLO" },
  "YOLO моделі жүктеліп, талдап жатыр…": { ru: "Модель YOLO загружается и анализирует…", en: "YOLO model is loading and analyzing…" },
  "Модель жүктелмеді. Интернетті тексеріп, қайталаңыз.": { ru: "Модель не загрузилась. Проверьте интернет и повторите.", en: "Model failed to load. Check your internet and retry." },
  "қоқысқа қатысты зат анықталды": { ru: "объектов, связанных с мусором, обнаружено", en: "waste-related objects detected" },
  "объект": { ru: "объектов", en: "objects" },
  "YOLOS-tiny моделі браузерде on-device жұмыс істейді (transformers.js). Қызғылт сары — қоқысқа қатысты, көк — басқа объект.": { ru: "Модель YOLOS-tiny работает в браузере on-device (transformers.js). Оранжевый — связано с мусором, синий — другой объект.", en: "The YOLOS-tiny model runs on-device in the browser (transformers.js). Orange — waste-related, blue — other objects." },
  "Мәселе байқалған нақты жерді басыңыз": { ru: "Нажмите точное место, где замечена проблема", en: "Click the exact spot where the issue was seen" },
  "Картадан мәселе орнын басып белгілеңіз": { ru: "Отметьте место проблемы на карте", en: "Mark the issue location on the map" },
});

// ── Дашборд карточкалары (FWI / құрғақшылық / графиктер) ────────────
Object.assign(UI_TR, {
  "AI қорытындысы": { ru: "Вывод AI", en: "AI summary" },
  "ERA5 топырақ су қоры (0–100 см) · Open-Meteo архиві": { ru: "Запасы воды в почве ERA5 (0–100 см) · архив Open-Meteo", en: "ERA5 soil water storage (0–100 cm) · Open-Meteo archive" },
  "Бастапқы тарау индексі": { ru: "Индекс начального распространения", en: "Initial spread index" },
  "Жиналу индексі": { ru: "Индекс накопления", en: "Buildup index" },
  "Жеңіл отын ылғалы": { ru: "Влажность лёгкого топлива", en: "Fine fuel moisture" },
  "Құрғақшылық коды": { ru: "Код засухи", en: "Drought code" },
  "Негізгі факторлар": { ru: "Основные факторы", en: "Key drivers" },
  "Нүктелер": { ru: "Точки", en: "Points" },
  "Орташа темп. °C": { ru: "Ср. темп. °C", en: "Avg temp °C" },
  "Топырақ су қоры (м³/м³)": { ru: "Запас воды в почве (м³/м³)", en: "Soil water storage (m³/m³)" },
  "Тәуекел деңгейі:": { ru: "Уровень риска:", en: "Risk level:" },
  "Ылғалды (+3)": { ru: "Влажно (+3)", en: "Wet (+3)" },
  "Қалыпты (0)": { ru: "Норма (0)", en: "Normal (0)" },
  "Құрғақ (−3)": { ru: "Сухо (−3)", en: "Dry (−3)" },
  "Критикалық": { ru: "Критический", en: "Critical" },
});

// ── Соңғы toast/жапсырмалар ──────────────────────────────────────────
Object.assign(UI_TR, {
  "AI спутник суретін талдап жатыр…": { ru: "AI анализирует спутниковый снимок…", en: "AI is analyzing the satellite image…" },
  "AI талдауы дайын!": { ru: "AI-анализ готов!", en: "AI analysis ready!" },
  "ДДСҰ PM2.5 шегі": { ru: "Предел ВОЗ PM2.5", en: "WHO PM2.5 limit" },
  "Жалған дерек көрсетілмейді.": { ru: "Ложные данные не показываются.", en: "No fake data shown." },
  "Жақсару": { ru: "Улучшение", en: "Improving" },
  "Координаттар жарамсыз": { ru: "Координаты недействительны", en: "Invalid coordinates" },
  "Нашарлау": { ru: "Ухудшение", en: "Worsening" },
  "Пик деңгейі": { ru: "Пиковый уровень", en: "Peak level" },
  "Расталды ✅": { ru: "Подтверждено ✅", en: "Confirmed ✅" },
  "Талдау дайын (демо режимі — API кілті жоқ)": { ru: "Анализ готов (демо — нет API-ключа)", en: "Analysis ready (demo — no API key)" },
  "Талдау сәтсіз аяқталды. Қайталап көріңіз.": { ru: "Анализ не удался. Попробуйте снова.", en: "Analysis failed. Please try again." },
  "Тексеруге жіберілді 🔍": { ru: "Отправлено на проверку 🔍", en: "Sent for review 🔍" },
  "Толығырақ: «Ескертулер» бөлімінде": { ru: "Подробнее: раздел «Оповещения»", en: "More: in the “Alerts” section" },
  "Тұрақты": { ru: "Стабильно", en: "Stable" },
  "Хабарламаны толығымен жоясыз ба?": { ru: "Удалить сообщение полностью?", en: "Delete the report permanently?" },
  "болжам": { ru: "прогноз", en: "forecast" },
  "тарих": { ru: "история", en: "history" },
  "жылғы Sentinel-2 суретін талдап жатыр…": { ru: "г.: AI анализирует снимок Sentinel-2…", en: "AI is analyzing the Sentinel-2 image…" },
  "Өшірілді ❌": { ru: "Удалено ❌", en: "Removed ❌" },
  "⚠️ Жоғары тәуекел! Жауапты органға хабарлама автоматты жіберілді": { ru: "⚠️ Высокий риск! Сообщение автоматически отправлено в орган", en: "⚠️ High risk! Alert automatically sent to the authority" },
  "🤖 AI агент картаны жақындатып, спутник + тірі ресми деректерді талдап жатыр…": { ru: "🤖 AI-агент приближает карту и анализирует спутник + живые официальные данные…", en: "🤖 AI agent zooms the map and analyzes satellite + live official data…" },
});

// ── Site атаулары / аудандар ─────────────────────────────────────────
Object.assign(UI_TR, {
  "AI агент бағалауы": { ru: "Оценка AI-агента", en: "AI agent assessment" },
  "Атырау облысы": { ru: "Атырауская область", en: "Atyrau region" },
  "Жоғары": { ru: "Высокий", en: "High" },
  "Азаматтық хабарлама": { ru: "Сообщение гражданина", en: "Citizen report" },
});

// ── Қарапайым тілмен түсіндірмелер (эко қабат панельдері) ────────────
Object.assign(UI_TR, {
  "Өрт қаупі өте төмен — қауіп жоқ.": { ru: "Риск пожара очень низкий — опасности нет.", en: "Fire risk very low — no danger." },
  "Өрт қаупі төмен — сақтық жеткілікті.": { ru: "Риск пожара низкий — достаточно осторожности.", en: "Fire risk low — basic caution is enough." },
  "Орташа қауіп — далада отпен абай болыңыз.": { ru: "Средний риск — будьте осторожны с огнём на природе.", en: "Moderate risk — be careful with fire outdoors." },
  "Жоғары қауіп — далада от жақпаңыз, темекі тастамаңыз.": { ru: "Высокий риск — не разводите огонь, не бросайте окурки.", en: "High risk — don't light fires or drop cigarettes outdoors." },
  "Аса қауіпті — кез келген ұшқын дала өртін тудыруы мүмкін.": { ru: "Крайне опасно — любая искра может вызвать степной пожар.", en: "Extreme — any spark can start a wildfire." },
  "Жер ылғалды — су тапшылығы жоқ.": { ru: "Земля влажная — дефицита воды нет.", en: "Land is moist — no water shortage." },
  "Ылғалдылық қалыпты деңгейде.": { ru: "Влажность в норме.", en: "Moisture is at a normal level." },
  "Орташа құрғақшылық — өсімдікке су жетіспейді.": { ru: "Умеренная засуха — растениям не хватает воды.", en: "Moderate drought — plants lack water." },
  "Қатты құрғақшылық — суды үнемдеу қажет.": { ru: "Сильная засуха — нужно экономить воду.", en: "Severe drought — water saving needed." },
  "Апатты құрғақшылық — су ресурстарын қатаң үнемдеңіз.": { ru: "Катастрофическая засуха — строго экономьте воду.", en: "Extreme drought — conserve water strictly." },
  "Маса жоқтың қасы — қорғану қажет емес.": { ru: "Комаров почти нет — защита не нужна.", en: "Almost no mosquitoes — no protection needed." },
  "Маса аз — қорғану қажеті шамалы.": { ru: "Комаров мало — защита почти не нужна.", en: "Few mosquitoes — little protection needed." },
  "Орташа төмен — кешке репеллент жеткілікті.": { ru: "Умеренно-низко — вечером достаточно репеллента.", en: "Low-moderate — evening repellent is enough." },
  "Орташа жоғары — репеллент пен жабық киім қажет.": { ru: "Умеренно-высоко — нужны репеллент и закрытая одежда.", en: "Moderate-high — repellent and covering clothes needed." },
  "Маса өте көп — репеллент, тор қажет, тұрған суды құрғатыңыз.": { ru: "Очень много комаров — нужны репеллент, сетки, осушите застойную воду.", en: "Very many mosquitoes — repellent, nets, and drain standing water." },
  // Топырақ
  "Топырақ сау әрі ылғалды — деградация қаупі төмен.": { ru: "Почва здоровая и влажная — риск деградации низкий.", en: "Soil is healthy and moist — low degradation risk." },
  "Топырақ қалыпты — елеулі стресс жоқ.": { ru: "Почва в норме — серьёзного стресса нет.", en: "Soil is normal — no significant stress." },
  "Орташа стресс — құрғау мен тұздану басталуы мүмкін.": { ru: "Умеренный стресс — возможны иссушение и засоление.", en: "Moderate stress — drying and salinization may begin." },
  "Жоғары стресс — топырақ құрғаған, шөлейттену қаупі бар.": { ru: "Высокий стресс — почва иссушена, риск опустынивания.", en: "High stress — soil is dry, desertification risk." },
  // Факел
  "Бірнеше факел — қалыпты мұнай-газ белсенділігі.": { ru: "Несколько факелов — нормальная нефтегазовая активность.", en: "A few flares — normal oil & gas activity." },
  "Факел саны орташа — ауаға жану өнімдері бөлінуде.": { ru: "Среднее число факелов — продукты горения попадают в воздух.", en: "Moderate flares — combustion products are released into the air." },
  "Факел көп — ауа сапасына әсер ететін қарқынды жану.": { ru: "Много факелов — интенсивное горение, влияет на качество воздуха.", en: "Many flares — intense burning affecting air quality." },
  // Су
  "Тасқын қаупі жоғары — өзен жайылмасынан аулақ болыңыз.": { ru: "Высокий риск паводка — держитесь подальше от поймы.", en: "High flood risk — stay away from the floodplain." },
  "Су деңгейі көтерілуде — жағада сақ болыңыз.": { ru: "Уровень воды растёт — будьте осторожны у берега.", en: "Water level is rising — be careful near the bank." },
  "Су деңгейі бақылауда — әзірге қауіп жоқ.": { ru: "Уровень воды под контролем — пока опасности нет.", en: "Water level is monitored — no danger for now." },
  "Өзен деңгейі қалыпты — тасқын қаупі жоқ.": { ru: "Уровень реки в норме — паводка не ожидается.", en: "River level is normal — no flood risk." },
});

export function translate(s: string, lang: "kk" | "ru" | "en"): string {
  if (lang === "kk") return s;
  return UI_TR[s]?.[lang] ?? s;
}
