"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { translate } from "./uiTranslations";

export type Lang = "kk" | "ru" | "en";

/* Жоба негізінен қазақша. Бұл сөздік — қонақ бірінші көретін мазмұн
   (басты бет, навигация, футер) үшін. Басқа беттер қазақша қалады. */
const DICT = {
  kk: {
    "nav.map": "Карта",
    "nav.dashboard": "Аналитика",
    "nav.compare": "Салыстыру",
    "nav.report": "Хабарлау",
    "nav.moderation": "Модерация",
    "nav.passport": "Эко паспорт",
    "nav.alerts": "Ескертулер",
    "nav.tagline": "Атырау экологиясы",

    "hero.badge": "Атырау облысына арналған экологиялық AI платформа",
    "hero.sub": "Жайық · Атырау экологиялық AI",
    "hero.desc": "Спутник суреттері мен жасанды интеллект арқылы мұнай ластануын, қоқыс полигондарын, жер деградациясын және маса тәуекелін анықтаймыз — болжам жасап, шара ұсынамыз.",
    "hero.openMap": "Картаны ашу",
    "hero.report": "Мәселе хабарлау",
    "live.note": "Тірі деректер · Open-Meteo + Copernicus CAMS · сағат сайын жаңарады",
    "live.air": "Ауа сапасы · Атырау",
    "live.temp": "Температура",
    "live.humidity": "Ылғалдылық",
    "live.aqiUnit": "AQI",
    "live.atyrauCity": "Атырау қаласы",
    "live.air.clean": "Таза",
    "live.air.moderate": "Орташа",
    "live.air.sensitive": "Сезімтал",
    "live.air.poor": "Нашар",
    "live.pm.high": "Шектен жоғары",
    "live.pm.norm": "Норма шегінде",

    "summary.title": "Бүгінгі эко-жағдай",
    "summary.loading": "Бүгінгі жағдай есептелуде…",

    "stats.area": "Бақыланатын аудан",
    "stats.areaSub": "Атырау облысы",
    "stats.refresh": "Деректер жаңарту",
    "stats.refreshSub": "Open-Meteo + CAMS",
    "stats.reports": "Азаматтық хабарлама",
    "stats.reportsSub": "Платформаға түскен",
    "stats.years": "Спутник жылдары",
    "stats.yearsSub": "MODIS + Sentinel-2",

    "feat.title": "Платформа мүмкіндіктері",
    "feat.subtitle": "Барлық деректер шынайы, ресми дереккөздерден",
    "feat.open": "Ашу",
    "feat.sat.t": "Спутник талдауы",
    "feat.sat.d": "Картаның кез келген нүктесін басыңыз — AI спутник суретінен мұнай, қоқыс, деградацияны анықтайды.",
    "feat.cross.t": "Кросс-верификация",
    "feat.cross.d": "Азамат фотосы + спутник суреті бір AI сұранысында салыстырылып, мәселе расталады немесе жоққа шығарылады.",
    "feat.forecast.t": "AI болжамы",
    "feat.forecast.d": "Жинақталған деректер негізінде 6 айлық экологиялық тренд проекциясы мен ауа сапасы болжамы.",
    "feat.mosquito.t": "Маса индексі",
    "feat.mosquito.d": "Тұрған су + тасқын маусымы + өзенге жақындық негізінде аймақтық маса тәуекел картасы.",
    "feat.compare.t": "Уақыт салыстыру",
    "feat.compare.d": "2000 жылдан бүгінге дейін жер бетінің өзгеруін Sentinel-2 / MODIS суреттерімен салыстырыңыз.",
    "feat.alerts.t": "Ескерту жүйесі",
    "feat.alerts.d": "Жоғары тәуекелді нүктелерде жедел ескерту — PM2.5 артып кетсе немесе жаңа ластану анықталса.",

    "how.title": "Қалай жұмыс істейді?",
    "how.subtitle": "Үш қадамда экологиялық бағалау",
    "how.1.t": "Жерді таңдаңыз",
    "how.1.d": "Картадан кез келген нүктені басыңыз немесе мәселені фотоға түсіріп жіберіңіз.",
    "how.2.t": "AI талдайды",
    "how.2.d": "GPT-4o Vision спутник суретін сканерлейді, тірі ауа деректерімен қосады.",
    "how.3.t": "Нәтиже аласыз",
    "how.3.d": "Тәуекел деңгейі, анықталған мәселелер, шара ұсынымдары — секундтарда.",

    "qn.dash.t": "Аналитика беті",
    "qn.dash.d": "Графиктер, рейтинг, жылу картасы, болжам",
    "qn.mod.t": "Модерация панелі",
    "qn.mod.d": "Азаматтық хабарламаларды растау, өшіру",
    "qn.pass.t": "Эко паспорт",
    "qn.pass.d": "Жыл қорытындысы, басып шығару (PDF)",
    "qn.enter": "Кіру",

    "art.title": "Экология ғылымы",
    "art.subtitle": "ScienceDaily · Phys.org · күн сайын жаңарады, AI қазақшаға түйіндейді",
    "art.empty": "Мақалалар уақытша қолжетімсіз.",

    "cta.title": "Атырауды бірге қорғайық",
    "cta.desc": "Экологиялық мәселені байқасаңыз — фотоға түсіріп жіберіңіз. AI секундтарда талдайды, модераторлар тексеріп, тиісті органдарға жіберіледі.",
    "cta.report": "Мәселе хабарлау",
    "cta.explore": "Картаны зерттеу",

    "float.report": "Хабарлау",

    "foot.tagline": "Атырау облысының спутниктік-AI экологиялық мониторинг платформасы. Барлық деректер шынайы, ресми әрі тегін дереккөздерден.",
    "foot.nav": "Бөлімдер",
    "foot.sources": "Дереккөздер",
    "foot.contact": "Байланыс",
    "foot.tg": "Telegram бот",
    "foot.tgDesc": "Эко-маманмен сөйлесіп, мәселе жіберіңіз",
    "foot.github": "GitHub репозиторий",
    "foot.rights": "Атырау экологиясы үшін жасалған · Хакатон жобасы",
  },
  ru: {
    "nav.map": "Карта",
    "nav.dashboard": "Аналитика",
    "nav.compare": "Сравнение",
    "nav.report": "Сообщить",
    "nav.moderation": "Модерация",
    "nav.passport": "Эко паспорт",
    "nav.alerts": "Оповещения",
    "nav.tagline": "Экология Атырау",

    "hero.badge": "Экологическая AI-платформа для Атырауской области",
    "hero.sub": "Жайык · Экологический AI Атырау",
    "hero.desc": "С помощью спутниковых снимков и искусственного интеллекта выявляем нефтяные загрязнения, свалки, деградацию земель и риск комаров — строим прогнозы и предлагаем меры.",
    "hero.openMap": "Открыть карту",
    "hero.report": "Сообщить о проблеме",
    "live.note": "Живые данные · Open-Meteo + Copernicus CAMS · обновление ежечасно",
    "live.air": "Качество воздуха · Атырау",
    "live.temp": "Температура",
    "live.humidity": "Влажность",
    "live.aqiUnit": "AQI",
    "live.atyrauCity": "город Атырау",
    "live.air.clean": "Чисто",
    "live.air.moderate": "Умеренно",
    "live.air.sensitive": "Чувствит.",
    "live.air.poor": "Плохо",
    "live.pm.high": "Выше нормы",
    "live.pm.norm": "В норме",

    "summary.title": "Эко-обстановка сегодня",
    "summary.loading": "Рассчитываем обстановку…",

    "stats.area": "Под наблюдением",
    "stats.areaSub": "Атырауская область",
    "stats.refresh": "Обновление данных",
    "stats.refreshSub": "Open-Meteo + CAMS",
    "stats.reports": "Сообщений граждан",
    "stats.reportsSub": "Поступило на платформу",
    "stats.years": "Годы снимков",
    "stats.yearsSub": "MODIS + Sentinel-2",

    "feat.title": "Возможности платформы",
    "feat.subtitle": "Все данные реальные, из официальных источников",
    "feat.open": "Открыть",
    "feat.sat.t": "Спутниковый анализ",
    "feat.sat.d": "Нажмите на любую точку карты — AI выявит нефть, мусор и деградацию по спутниковому снимку.",
    "feat.cross.t": "Кросс-верификация",
    "feat.cross.d": "Фото гражданина + спутниковый снимок сравниваются в одном AI-запросе, проблема подтверждается или опровергается.",
    "feat.forecast.t": "AI-прогноз",
    "feat.forecast.d": "Прогноз экологического тренда на 6 месяцев и качества воздуха на основе собранных данных.",
    "feat.mosquito.t": "Индекс комаров",
    "feat.mosquito.d": "Карта риска комаров по застойной воде, сезону паводка и близости к реке.",
    "feat.compare.t": "Сравнение во времени",
    "feat.compare.d": "Сравните изменения поверхности с 2000 года по снимкам Sentinel-2 / MODIS.",
    "feat.alerts.t": "Система оповещений",
    "feat.alerts.d": "Срочные оповещения в зонах риска — при росте PM2.5 или новом загрязнении.",

    "how.title": "Как это работает?",
    "how.subtitle": "Экологическая оценка в три шага",
    "how.1.t": "Выберите место",
    "how.1.d": "Нажмите на любую точку карты или отправьте фото проблемы.",
    "how.2.t": "AI анализирует",
    "how.2.d": "GPT-4o Vision сканирует спутниковый снимок и совмещает с живыми данными.",
    "how.3.t": "Получите результат",
    "how.3.d": "Уровень риска, выявленные проблемы и рекомендации — за секунды.",

    "qn.dash.t": "Страница аналитики",
    "qn.dash.d": "Графики, рейтинг, тепловая карта, прогноз",
    "qn.mod.t": "Панель модерации",
    "qn.mod.d": "Подтверждение и удаление сообщений граждан",
    "qn.pass.t": "Эко паспорт",
    "qn.pass.d": "Итоги года, печать (PDF)",
    "qn.enter": "Войти",

    "art.title": "Наука об экологии",
    "art.subtitle": "ScienceDaily · Phys.org · обновляется ежедневно, AI делает выжимку",
    "art.empty": "Статьи временно недоступны.",

    "cta.title": "Защитим Атырау вместе",
    "cta.desc": "Заметили экологическую проблему — сфотографируйте и отправьте. AI анализирует за секунды, модераторы проверяют и передают в органы.",
    "cta.report": "Сообщить о проблеме",
    "cta.explore": "Исследовать карту",

    "float.report": "Сообщить",

    "foot.tagline": "Спутниково-AI платформа экологического мониторинга Атырауской области. Все данные реальные, из официальных бесплатных источников.",
    "foot.nav": "Разделы",
    "foot.sources": "Источники данных",
    "foot.contact": "Контакты",
    "foot.tg": "Telegram-бот",
    "foot.tgDesc": "Поговорите с эко-экспертом и отправьте проблему",
    "foot.github": "GitHub репозиторий",
    "foot.rights": "Создано для экологии Атырау · Хакатон-проект",
  },
  en: {
    "nav.map": "Map",
    "nav.dashboard": "Analytics",
    "nav.compare": "Compare",
    "nav.report": "Report",
    "nav.moderation": "Moderation",
    "nav.passport": "Eco passport",
    "nav.alerts": "Alerts",
    "nav.tagline": "Atyrau ecology",

    "hero.badge": "Environmental AI platform for Atyrau region",
    "hero.sub": "Jaiyq · Atyrau environmental AI",
    "hero.desc": "Using satellite imagery and artificial intelligence we detect oil pollution, landfills, land degradation and mosquito risk — forecasting trends and recommending action.",
    "hero.openMap": "Open the map",
    "hero.report": "Report an issue",
    "live.note": "Live data · Open-Meteo + Copernicus CAMS · updated hourly",
    "live.air": "Air quality · Atyrau",
    "live.temp": "Temperature",
    "live.humidity": "Humidity",
    "live.aqiUnit": "AQI",
    "live.atyrauCity": "Atyrau city",
    "live.air.clean": "Clean",
    "live.air.moderate": "Moderate",
    "live.air.sensitive": "Sensitive",
    "live.air.poor": "Poor",
    "live.pm.high": "Above limit",
    "live.pm.norm": "Within norm",

    "summary.title": "Eco status today",
    "summary.loading": "Calculating today's status…",

    "stats.area": "Area monitored",
    "stats.areaSub": "Atyrau region",
    "stats.refresh": "Data refresh",
    "stats.refreshSub": "Open-Meteo + CAMS",
    "stats.reports": "Citizen reports",
    "stats.reportsSub": "Submitted to platform",
    "stats.years": "Satellite years",
    "stats.yearsSub": "MODIS + Sentinel-2",

    "feat.title": "Platform features",
    "feat.subtitle": "All data is real, from official sources",
    "feat.open": "Open",
    "feat.sat.t": "Satellite analysis",
    "feat.sat.d": "Click any point on the map — AI detects oil, waste and degradation from the satellite image.",
    "feat.cross.t": "Cross-verification",
    "feat.cross.d": "Citizen photo + satellite image are compared in one AI request, confirming or refuting the issue.",
    "feat.forecast.t": "AI forecast",
    "feat.forecast.d": "A 6-month environmental trend projection and air quality forecast from collected data.",
    "feat.mosquito.t": "Mosquito index",
    "feat.mosquito.d": "Regional mosquito risk map based on standing water, flood season and proximity to the river.",
    "feat.compare.t": "Time comparison",
    "feat.compare.d": "Compare land surface changes from 2000 to today with Sentinel-2 / MODIS imagery.",
    "feat.alerts.t": "Alert system",
    "feat.alerts.d": "Instant alerts in high-risk zones — when PM2.5 rises or new pollution is detected.",

    "how.title": "How does it work?",
    "how.subtitle": "Environmental assessment in three steps",
    "how.1.t": "Pick a location",
    "how.1.d": "Click any point on the map or send a photo of the issue.",
    "how.2.t": "AI analyzes",
    "how.2.d": "GPT-4o Vision scans the satellite image and combines it with live data.",
    "how.3.t": "Get the result",
    "how.3.d": "Risk level, detected issues and recommendations — in seconds.",

    "qn.dash.t": "Analytics page",
    "qn.dash.d": "Charts, ranking, heatmap, forecast",
    "qn.mod.t": "Moderation panel",
    "qn.mod.d": "Approve and remove citizen reports",
    "qn.pass.t": "Eco passport",
    "qn.pass.d": "Yearly summary, print (PDF)",
    "qn.enter": "Enter",

    "art.title": "Ecology science",
    "art.subtitle": "ScienceDaily · Phys.org · updated daily, AI summarizes",
    "art.empty": "Articles temporarily unavailable.",

    "cta.title": "Let's protect Atyrau together",
    "cta.desc": "Spotted an environmental issue — take a photo and send it. AI analyzes in seconds, moderators review and forward to the authorities.",
    "cta.report": "Report an issue",
    "cta.explore": "Explore the map",

    "float.report": "Report",

    "foot.tagline": "Satellite-AI environmental monitoring platform for the Atyrau region. All data is real, from official and free sources.",
    "foot.nav": "Sections",
    "foot.sources": "Data sources",
    "foot.contact": "Contact",
    "foot.tg": "Telegram bot",
    "foot.tgDesc": "Chat with the eco expert and send an issue",
    "foot.github": "GitHub repository",
    "foot.rights": "Built for Atyrau's ecology · Hackathon project",
  },
} as const;

type Key = keyof typeof DICT["kk"];

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: Key) => string;
  tr: (s: string) => string; // қазақ мәтінін кілт ретінде аудару (жол-тығыз беттерге)
}

const LangContext = createContext<Ctx | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("kk");

  useEffect(() => {
    const saved = localStorage.getItem("jaiyq-lang");
    if (saved === "ru" || saved === "kk" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("jaiyq-lang", l);
    document.documentElement.lang = l;
  }, []);

  const t = useCallback((k: Key) => DICT[lang][k] ?? DICT.kk[k] ?? k, [lang]);
  const tr = useCallback((s: string) => translate(s, lang), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t, tr }}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Провайдерсіз қолданылса — қазақша әдепкі
    return { lang: "kk", setLang: () => {}, t: (k: Key) => DICT.kk[k] ?? k, tr: (s: string) => s };
  }
  return ctx;
}
