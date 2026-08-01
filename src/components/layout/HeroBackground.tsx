// БАСТЫ БЕТТІҢ ФОНЫ — минималистік қазақ пейзажы.
//
// Неге SVG, фото емес:
//   · жүйе енді бір қалаға арналмаған — нақты қаланың фотосы жаңылыс
//     сигнал берер еді («бұл сайт тек сол жер туралы» деген)
//   · SVG бірден жүктеледі, интернетке тәуелді емес, ажыратымдылығы шексіз
//   · түсі бренд палитрасымен дәл үйлеседі
//
// Композиция: дала көкжиегі, Каспий сызығы, алыстағы жота, күн шұғыласы.
//
// ⚠️ Фон — көркемдік элемент, ДЕРЕК ЕМЕС. Онда ешқандай көрсеткіш немесе
// «нақты көрініс» деген мәтін болмайды.

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 760"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden
      >
        <defs>
          {/* Аспан — түннен таңға көшу */}
          <linearGradient id="hb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#04120f" />
            <stop offset="42%" stopColor="#07231d" />
            <stop offset="72%" stopColor="#0a3630" />
            <stop offset="100%" stopColor="#0b1c22" />
          </linearGradient>

          {/* Күн сәулесі */}
          <radialGradient id="hb-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#10b981" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="hb-ridgeFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d4a3f" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0d4a3f" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="hb-ridgeNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a3a33" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#061f1c" stopOpacity="0.95" />
          </linearGradient>

          {/* Су беті */}
          <linearGradient id="hb-water" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0e7490" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#082f3a" stopOpacity="0.75" />
          </linearGradient>

          {/* Мәтін оқылуы үшін төменгі күңгірттеу */}
          <linearGradient id="hb-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a0a0a" stopOpacity="0" />
            <stop offset="62%" stopColor="#0a0a0a" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="1" />
          </linearGradient>
        </defs>

        <rect width="1440" height="760" fill="url(#hb-sky)" />

        {/* Жұлдыздар — сирек, жоғарғы бөлікте */}
        <g fill="#d1fae5" opacity="0.5">
          {(
            [
              [140, 70, 1.1], [320, 120, 0.8], [520, 60, 1.3], [760, 110, 0.9],
              [980, 78, 1.2], [1180, 140, 0.8], [1320, 66, 1.1], [240, 190, 0.7],
              [660, 176, 0.8], [1060, 200, 0.7], [420, 232, 0.6], [880, 244, 0.6],
            ] as [number, number, number][]
          ).map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>

        {/* Күн шұғыласы — көкжиек үстінде */}
        <circle cx="1040" cy="430" r="300" fill="url(#hb-sun)" />
        <circle cx="1040" cy="430" r="26" fill="#6ee7b7" opacity="0.7" />

        {/* Алыстағы жота */}
        <path
          d="M0 452 L120 428 L240 444 L360 406 L470 432 L580 400 L700 430 L820 404 L940 428 L1060 396 L1180 424 L1300 404 L1440 430 L1440 470 L0 470 Z"
          fill="url(#hb-ridgeFar)"
        />

        {/* Каспий сызығы */}
        <rect x="0" y="470" width="1440" height="96" fill="url(#hb-water)" />
        <g stroke="#5eead4" strokeOpacity="0.16" strokeWidth="1.5">
          {[486, 500, 514, 528, 542, 556].map((y, i) => (
            <line key={i} x1={420 + i * 34} y1={y} x2={1280 - i * 26} y2={y} />
          ))}
        </g>

        {/* Жағалау сызығы */}
        <path
          d="M0 566 Q 220 552 460 566 T 940 560 T 1440 570 L1440 600 L0 600 Z"
          fill="#0a3a33"
          opacity="0.9"
        />

        {/* Жақындағы дала */}
        <path
          d="M0 596 Q 260 574 520 594 T 1040 588 T 1440 600 L1440 760 L0 760 Z"
          fill="url(#hb-ridgeNear)"
        />

        {/* Даладағы жеңіл толқындар */}
        <g stroke="#10b981" strokeOpacity="0.12" strokeWidth="1.5" fill="none">
          <path d="M0 648 Q 300 632 600 650 T 1200 644 T 1440 654" />
          <path d="M0 692 Q 340 676 680 694 T 1440 692" />
        </g>

        <rect width="1440" height="760" fill="url(#hb-fade)" />
      </svg>
    </div>
  );
}
