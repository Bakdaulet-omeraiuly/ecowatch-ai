"use client";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-neutral-200">
      <h1 className="mb-2 text-3xl font-bold text-emerald-400">Құпиялық саясаты</h1>
      <p className="mb-8 text-sm text-neutral-500">Соңғы жаңарту: 2026 жыл</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">1. Жалпы ақпарат</h2>
        <p className="text-neutral-400 leading-relaxed">
          Jaiyq платформасы (jaiyq.vercel.app) Атырау облысының экологиялық мониторингіне арналған.
          Біз пайдаланушылардың жеке деректерін қорғауды маңызды міндет деп санаймыз және
          Қазақстан Республикасының «Дербес деректер және оларды қорғау туралы» Заңына (№94-V) сай жұмыс істейміз.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">2. Жиналатын деректер</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-400">
          <li><span className="text-white">Азаматтық хабарламалар:</span> GPS координаттары, фотосурет, сипаттама мәтіні</li>
          <li><span className="text-white">Telegram боты:</span> chat_id, пайдаланушы аты (username) — тек ескерту хабарламалары үшін</li>
          <li><span className="text-white">Техникалық деректер:</span> IP-мекенжай (rate limiting үшін, сақталмайды)</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">3. Деректерді қолдану</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-400">
          <li>Азаматтық хабарламаларды картада көрсету және AI арқылы талдау</li>
          <li>Экологиялық ескерту хабарламаларын Telegram арқылы жіберу</li>
          <li>Үшінші тарапқа деректер берілмейді</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">4. Деректерді сақтау</h2>
        <p className="text-neutral-400 leading-relaxed">
          Азаматтық хабарламалар Supabase (АҚШ, AWS eu-central-1) серверінде сақталады.
          Telegram жазылым деректері модератор жойғанға дейін сақталады.
          Пайдаланушы өз деректерін жою туралы өтініш жібере алады: <span className="text-emerald-400">jaiyq.vercel.app/report</span> бетіндегі байланыс арқылы.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">5. Деректер көздері</h2>
        <p className="text-neutral-400 leading-relaxed">
          Платформа тек ашық, ресми деректерді қолданады:
        </p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-neutral-400">
          <li>NASA Landsat / MODIS — жалпыға қолжетімді (Public Domain)</li>
          <li>ESA Copernicus Sentinel-2 — ашық қолжетімді лицензия</li>
          <li>Copernicus CAMS / GloFAS — ашық қолжетімді лицензия</li>
          <li>Open-Meteo — CC BY 4.0</li>
          <li>Mapbox — коммерциялық лицензия</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">6. Байланыс</h2>
        <p className="text-neutral-400">
          Деректеріңізге қатысты сұрақтар бойынша: Telegram боты арқылы немесе
          <span className="text-emerald-400"> jaiyq.vercel.app</span> сайтындағы байланыс формасы арқылы хабарласыңыз.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">7. Деректер атрибуциясы</h2>
        <p className="text-neutral-400 leading-relaxed">
          © Copernicus Service Information (2024). Contains modified Copernicus Climate Change Service information.
          Neither the European Commission nor ECMWF is responsible for any use that may be made of the Copernicus information or data it contains.
        </p>
      </section>
    </main>
  );
}
