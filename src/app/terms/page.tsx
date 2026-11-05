"use client";
import { useLang } from "@/lib/i18n";


export default function TermsPage() {
  const { tr } = useLang();
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-neutral-900">
      <h1 className="mb-2 text-2xl font-bold leading-tight text-[#0b3a6b] sm:text-3xl">{tr("Пайдалану шарттары")}</h1>
      <p className="mb-8 text-sm text-neutral-600">{tr("Соңғы жаңарту: 2026 жыл")}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("1. Жалпы ережелер")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Jaiyq платформасын (ecojaiyq.com) пайдалану осы Пайдалану шарттарымен келісуді білдіреді. Платформа Қазақстан мен Каспий жағалауының экологиялық жағдайын бақылауға арналған ақпараттық қызмет ретінде ұсынылады.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("2. Платформаны пайдалану")}</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-600">
          <li>{tr("Платформа тегін, жалпыға қолжетімді ақпараттық мақсатта ұсынылады")}</li>
          <li>{tr("Азаматтық хабарламаларды жіберу кезінде шынайы ақпарат беру міндетті")}</li>
          <li>{tr("Жалған, жаңылыстыратын немесе зиянды мазмұн жіберуге тыйым салынады")}</li>
          <li>{tr("Платформаны автоматты сұраныстармен жүктеуге (bot, crawler) тыйым салынады")}</li>
          <li>{tr("Басқа пайдаланушылардың деректеріне рұқсатсыз кіруге тыйым салынады")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("3. Деректердің дәлдігі")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Платформадағы барлық экологиялық деректер NASA, ESA Copernicus, Open-Meteo сияқты ресми ашық көздерден алынады. Алайда:")}{" "}</p>
        <ul className="list-disc list-inside space-y-2 mt-2 text-neutral-600">
          <li>{tr("Деректер ақпараттық мақсатта ғана ұсынылады")}</li>
          <li>{tr("Шұғыл экологиялық шешімдер үшін ресми органдарға жүгінуді ұсынамыз")}</li>
          <li>{tr("AI талдауы болжамдық сипатта, кәсіби сараптаманы алмастырмайды")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("4. Азаматтық хабарламалар")}</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-600">
          <li>{tr("Жіберілген фотосуреттер мен координаттар картада жалпыға көрінеді")}</li>
          <li>{tr("Хабарлама жіберу арқылы сіз осы деректерді платформада орналастыруға келісесіз")}</li>
          <li>{tr("Модератор тиісті емес хабарламаларды жоюға құқылы")}</li>
          <li>{tr("Жеке суреттерді жіберу кезінде үшінші тұлғалардың рұқсатын алу сіздің жауапкершілігіңізде")}</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("5. Жауапкершілікті шектеу")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Jaiyq платформасы ақпараттық қызмет ретінде ұсынылады. Платформа деректерін негізге ала отырып қабылданған шешімдер үшін платформа жауапкершілік көтермейді. Техникалық ақаулар, деректер үзілістері немесе AI талдауының қателіктері үшін шағым қабылданбайды.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("6. Зияткерлік меншік")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Платформаның дизайны, коды және контенті Jaiyq командасына тиесілі. Деректер көздері өз лицензияларымен (NASA Public Domain, Copernicus Open Access, CC BY 4.0) қорғалған. Платформа материалдарын коммерциялық мақсатта қолдануға алдын ала рұқсат қажет.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("7. Шарттарды өзгерту")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Jaiyq осы шарттарды алдын ала хабарламасыз өзгертуге құқылы. Өзгерістер сайтта жарияланған күннен бастап күшіне енеді. Платформаны пайдалануды жалғастыру жаңа шарттармен келісуді білдіреді.")}{" "}</p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("8. Қолданылатын заң")}</h2>
        <p className="text-neutral-600 leading-relaxed">
          {tr("Осы шарттар Қазақстан Республикасының заңнамасына сәйкес реттеледі.")}{" "}</p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-neutral-900">{tr("9. Байланыс")}</h2>
        <p className="text-neutral-600">
          {tr("Сұрақтар бойынша: Telegram боты арқылы немесе")}{" "}
          <span className="text-emerald-800">ecojaiyq.com</span> {tr("сайты арқылы хабарласыңыз.")}{" "}</p>
      </section>
    </main>
  );
}
