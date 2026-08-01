@AGENTS.md

# Jaiyq — жоба туралы (Claude үшін бағдар)

Бұл — **Атырау облысының экологиялық AI мониторинг платформасы** (бренд: **Jaiyq**;
бұрынғы атауы EcoWatch AI; қалта аты `ecowatch-ai` сол қалпында). Спутник
суреттері мен жасанды интеллект арқылы қоқыс, мұнай ластануы, жер деградациясы
және маса тәуекелін анықтайды. Хакатон жобасы, Vercel-де орналасқан.

**Тіл:** интерфейс толығымен **қазақ тілінде**. Жаңа мәтіндер де қазақша болсын.

## Маңызды қағида: ТЕК ШЫНАЙЫ ДЕРЕКТЕР

Ешқашан ойдан жалған дерек жасама. Барлық деректер нақты, ресми, тегін
көздерден. Дереккөз қолжетімсіз болса — «жалған дерек көрсетілмейді» деп
хабарла, мок дерек көрсетпе.

⚠️ Бұл ЕШҚАНДАЙ жағдайда бұзылмайды — «демо құламасын» деген де себеп емес.
`analyze`, `agent`, `forecast` эндпоинттерінде бұрын mock-қа шегіну болған,
ол алынып тасталды: енді кілт жоқ/шақыру сәтсіз болса 503 + себебі
қайтарылады. Жаңа эндпоинт жазғанда да солай істе.

Әр көрсеткіш үш деңгейдің бірінде: 🛰 **өлшем** (аспап өлшеген), 📊 **модель**
(есептелген), 🤖 **AI** (валидацияланбаған). UI-де `TierBadge` арқылы
белгіленуі керек, ал `src/app/methodology` бетіне жазылуы тиіс.

## Технологиялар

Next.js 16 (App Router) · TypeScript · Tailwind v4 · shadcn/ui · Mapbox
(react-map-gl) · OpenAI GPT-4o/4o-mini · Zustand · Recharts · Framer Motion ·
Supabase (ортақ хабарламалар).

## Файл картасы

- `src/app/page.tsx` — басты бет (Атырау фоны, ғылыми мақалалар)
- `src/app/map/page.tsx` + `src/components/map/MapView.tsx` — басты карта
  (AI талдау, эко қабаттар, тарихи режим, AI агент, фото-хабарламалар)
- `src/app/dashboard/page.tsx` — аналитика (тірі ауа деректері, графиктер, болжам)
- `src/app/report/page.tsx` — азаматтық фото-хабарлау (картадан жер таңдау)
- `src/app/alerts/page.tsx` — ескерту жүйесі (жоғары тәуекелді нүктелер)
- `src/app/api/analyze` — AI спутник талдауы (GPT-4o Vision)
- `src/app/api/agent` — көп дереккөзді AI агент (спутник + тірі деректер)
- `src/app/api/reports` — ортақ фото-хабарламалар (Supabase + AI модерация)
- `src/app/api/environment`, `api/airgrid`, `api/mosquitogrid` — тірі деректер
- `src/app/api/articles` — ғылыми мақалалар (RSS + AI аударма)
- `src/app/api/forecast` — AI болжам
- `src/app/api/flood-extent` — Sentinel-1 SAR: су басқан аумақ км² (өлшем,
  болжам емес); `?format=csv` — эколог есебі үшін. Әдіс: `src/lib/floodSar.ts`
- `src/app/api/ml-forecast` — JAIYQ-ML: 11 күндік ауа болжамы (CAMS шегінен әрі)
- `ml-service/` — Python оқыту құбыры (numpy GBT); апта сайын GitHub Actions
  арқылы нақты CAMS/ERA5 деректерінде қайта оқытылады. ⚠️ `ml-service/features.py`
  мен `src/lib/ml/features.ts` ӘРҚАШАН бірдей болуы керек (`parity_check.py` тексереді)
- `eo-service/` — ЖЕРГІЛІКТІ зерттеу құралы (Qwen2-VL remote-sensing).
  ⚠️ Өнімге қосылмаған әрі қосылмайды — себебі README-де жазылған
- `src/lib/` — mapbox, mosquito (MRI индексі), risk, alerts, supabase утилиталары
- `src/data/historyFactors.ts` — эко қабаттар анықтамасы
- `src/app/methodology` — әдістеме + валидация күйі (әр көрсеткіш: дереккөз,
  әдіс, тексерілген бе, шектеулері). Жаңа көрсеткіш қосқанда осында да қос
- `src/app/api/export` — эколог есебі үшін CSV (`?dataset=air|mosquito|fire|drought|flares`)
- `src/components/ui/TierBadge.tsx` — 🛰 өлшем / 📊 модель / 🤖 AI белгілері
- `src/lib/cdse.ts` — Copernicus OAuth (ортақ, көшірме жасама)
- `docs/` — PRD, архитектура, роадмап

## Деректер көздері (бәрі шынайы)

- Спутник: Mapbox (қазіргі) + Sentinel-2/EOX (2016-2025) + NASA MODIS (2000-2015)
- Ауа/маса/ауа райы: Open-Meteo + Copernicus CAMS (сағат сайын)
- Маса индексі: Mordecai 2017 климаттық-қолайлылық әдістемесі + қалалық амплификация
- Мақалалар: ScienceDaily, Phys.org RSS

## Кілттер (.env.local — GitHub-та ЖОҚ, Vercel-де бар)

`OPENAI_API_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`. Жергілікті сынау үшін кілттер керек; продакшнде
Vercel-де сақталған.

## Деплой

GitHub-қа push → Vercel автоматты деплой. Қолмен: `vercel deploy --prod`.
Repo: github.com/Bakdaulet-omeraiuly/ecowatch-ai

## Node іске қосу

nvm арқылы: `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"` алдымен, сосын
`npm run dev` / `npm run build`.
