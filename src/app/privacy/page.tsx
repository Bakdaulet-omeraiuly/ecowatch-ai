"use client";
import { useLang } from "@/lib/i18n";


export default function PrivacyPage() {
  const { tr } = useLang();
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-neutral-900">
      <h1 className="mb-2 text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{tr("Құпиялық саясаты")}</h1>
      <p className="mb-8 text-sm text-neutral-600">{tr("Соңғы жаңарту: 2026 жыл")}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("1. Жалпы ақпарат")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Jaiyq платформасы (ecojaiyq.com) Қазақстан мен Каспий жағалауының экологиялық мониторингіне арналған. Біз пайдаланушылардың жеке деректерін қорғауды маңызды міндет деп санаймыз және Қазақстан Республикасының «Дербес деректер және оларды қорғау туралы» Заңына (№94-V) сай жұмыс істейміз.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("2. Жиналатын деректер")}</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-600">
          <li><span className="text-neutral-900">{tr("Азаматтық хабарламалар:")}</span> {tr("GPS координаттары, фотосурет, сипаттама мәтіні")}</li>
          <li><span className="text-neutral-900">{tr("Telegram боты:")}</span> {tr("chat_id, пайдаланушы аты (username) — тек ескерту хабарламалары үшін")}</li>
          <li><span className="text-neutral-900">{tr("Техникалық деректер:")}</span> {tr("IP-мекенжай (rate limiting үшін, сақталмайды)")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("3. Деректерді қолдану")}</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-600">
          <li>{tr("Азаматтық хабарламаларды картада көрсету және AI арқылы талдау")}</li>
          <li>{tr("Экологиялық ескерту хабарламаларын Telegram арқылы жіберу")}</li>
          <li>{tr("Үшінші тарапқа деректер берілмейді")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("4. Деректерді сақтау")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Азаматтық хабарламалар Supabase (АҚШ, AWS eu-central-1) серверінде сақталады. Telegram жазылым деректері модератор жойғанға дейін сақталады. Пайдаланушы өз деректерін жою туралы өтініш жібере алады:")}{" "}<span className="text-emerald-800">ecojaiyq.com/report</span> {tr("бетіндегі байланыс арқылы.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("5. Деректер көздері")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Платформа тек ашық, ресми деректерді қолданады:")}{" "}</p>
        <ul className="list-disc list-inside space-y-1 mt-2 text-neutral-600">
          <li>{tr("NASA Landsat / MODIS — жалпыға қолжетімді (Public Domain)")}</li>
          <li>{tr("ESA Copernicus Sentinel-2 — ашық қолжетімді лицензия")}</li>
          <li>{tr("Copernicus CAMS / GloFAS — ашық қолжетімді лицензия")}</li>
          <li>Open-Meteo — CC BY 4.0</li>
          <li>{tr("Mapbox — коммерциялық лицензия")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("6. Байланыс")}</h2>
        <p className="text-neutral-600">
          {tr("Деректеріңізге қатысты сұрақтар бойынша: Telegram боты арқылы немесе")}{" "}<span className="text-emerald-800"> ecojaiyq.com</span> {tr("сайтындағы байланыс формасы арқылы хабарласыңыз.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("7. Деректер атрибуциясы")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          © Copernicus Service Information (2024). Contains modified Copernicus Climate Change Service information.
          Neither the European Commission nor ECMWF is responsible for any use that may be made of the Copernicus information or data it contains.
        </p>
      </section>
    </main>
  );
}
