"use client";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-neutral-200">
      <h1 className="mb-2 text-3xl font-bold text-emerald-400">Пайдалану шарттары</h1>
      <p className="mb-8 text-sm text-neutral-500">Соңғы жаңарту: 2026 жыл</p>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">1. Жалпы ережелер</h2>
        <p className="text-neutral-400 leading-relaxed">
          Jaiyq платформасын (ecojaiyq.com) пайдалану осы Пайдалану шарттарымен келісуді білдіреді.
          Платформа Атырау облысының экологиялық жағдайын бақылауға арналған ақпараттық қызмет ретінде ұсынылады.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">2. Платформаны пайдалану</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-400">
          <li>Платформа тегін, жалпыға қолжетімді ақпараттық мақсатта ұсынылады</li>
          <li>Азаматтық хабарламаларды жіберу кезінде шынайы ақпарат беру міндетті</li>
          <li>Жалған, жаңылыстыратын немесе зиянды мазмұн жіберуге тыйым салынады</li>
          <li>Платформаны автоматты сұраныстармен жүктеуге (bot, crawler) тыйым салынады</li>
          <li>Басқа пайдаланушылардың деректеріне рұқсатсыз кіруге тыйым салынады</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">3. Деректердің дәлдігі</h2>
        <p className="text-neutral-400 leading-relaxed">
          Платформадағы барлық экологиялық деректер NASA, ESA Copernicus, Open-Meteo сияқты
          ресми ашық көздерден алынады. Алайда:
        </p>
        <ul className="list-disc list-inside space-y-2 mt-2 text-neutral-400">
          <li>Деректер ақпараттық мақсатта ғана ұсынылады</li>
          <li>Шұғыл экологиялық шешімдер үшін ресми органдарға жүгінуді ұсынамыз</li>
          <li>AI талдауы болжамдық сипатта, кәсіби сараптаманы алмастырмайды</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">4. Азаматтық хабарламалар</h2>
        <ul className="list-disc list-inside space-y-2 text-neutral-400">
          <li>Жіберілген фотосуреттер мен координаттар картада жалпыға көрінеді</li>
          <li>Хабарлама жіберу арқылы сіз осы деректерді платформада орналастыруға келісесіз</li>
          <li>Модератор тиісті емес хабарламаларды жоюға құқылы</li>
          <li>Жеке суреттерді жіберу кезінде үшінші тұлғалардың рұқсатын алу сіздің жауапкершілігіңізде</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">5. Жауапкершілікті шектеу</h2>
        <p className="text-neutral-400 leading-relaxed">
          Jaiyq платформасы ақпараттық қызмет ретінде ұсынылады. Платформа деректерін негізге ала отырып
          қабылданған шешімдер үшін платформа жауапкершілік көтермейді. Техникалық ақаулар,
          деректер үзілістері немесе AI талдауының қателіктері үшін шағым қабылданбайды.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">6. Зияткерлік меншік</h2>
        <p className="text-neutral-400 leading-relaxed">
          Платформаның дизайны, коды және контенті Jaiyq командасына тиесілі.
          Деректер көздері өз лицензияларымен (NASA Public Domain, Copernicus Open Access, CC BY 4.0) қорғалған.
          Платформа материалдарын коммерциялық мақсатта қолдануға алдын ала рұқсат қажет.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">7. Шарттарды өзгерту</h2>
        <p className="text-neutral-400 leading-relaxed">
          Jaiyq осы шарттарды алдын ала хабарламасыз өзгертуге құқылы.
          Өзгерістер сайтта жарияланған күннен бастап күшіне енеді.
          Платформаны пайдалануды жалғастыру жаңа шарттармен келісуді білдіреді.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-white">8. Қолданылатын заң</h2>
        <p className="text-neutral-400 leading-relaxed">
          Осы шарттар Қазақстан Республикасының заңнамасына сәйкес реттеледі.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-white">9. Байланыс</h2>
        <p className="text-neutral-400">
          Сұрақтар бойынша: Telegram боты арқылы немесе{" "}
          <span className="text-emerald-400">ecojaiyq.com</span> сайты арқылы хабарласыңыз.
        </p>
      </section>
    </main>
  );
}
