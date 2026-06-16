/* Басты беттің hero фоны — фото емес, тақырыптық иллюстрация:
   Жайық өзенінің ирелеңдері + топографиялық сызықтар + жұмсақ жасыл-көк нұр. */
export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 1440 760"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="heroGlow" cx="50%" cy="22%" r="70%">
            <stop offset="0%" stopColor="#065f46" stopOpacity="0.7" />
            <stop offset="45%" stopColor="#052e25" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#0a0a0a" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="riverFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* Негізгі қою фон */}
        <rect width="1440" height="760" fill="#0a0a0a" />
        <rect width="1440" height="760" fill="url(#heroGlow)" />

        {/* Топографиялық (изосызық) қабаттар — солтүстік-батыс бұрыш */}
        <g fill="none" stroke="#10b981" strokeOpacity="0.16" strokeWidth="1.5">
          <path d="M-100 120C180 60 360 180 560 120 760 60 900 180 1100 120" />
          <path d="M-100 175C180 115 360 235 560 175 760 115 900 235 1100 175" />
          <path d="M-100 230C180 170 360 290 560 230 760 170 900 290 1100 230" />
          <path d="M-100 285C180 225 360 345 560 285 760 225 900 345 1100 285" />
        </g>

        {/* Топографиялық қабаттар — оңтүстік-шығыс бұрыш */}
        <g fill="none" stroke="#0ea5e9" strokeOpacity="0.13" strokeWidth="1.5">
          <path d="M520 760C760 700 940 760 1140 690 1340 620 1480 700 1640 640" />
          <path d="M520 700C760 640 940 700 1140 630 1340 560 1480 640 1640 580" />
          <path d="M520 640C760 580 940 640 1140 570 1340 500 1480 580 1640 520" />
        </g>

        {/* Жайық өзенінің басты ирелеңі */}
        <path
          d="M250 -40C470 160 180 320 420 470 660 620 380 760 600 880"
          fill="none"
          stroke="url(#riverFill)"
          strokeOpacity="0.6"
          strokeWidth="7"
          strokeLinecap="round"
        />
        {/* Екінші сала */}
        <path
          d="M1180 -40C980 180 1260 340 1040 500 860 640 1080 780 920 900"
          fill="none"
          stroke="url(#riverFill)"
          strokeOpacity="0.4"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* Спутник нүктелері (жұлдыздай) */}
        <g fill="#6ee7b7" fillOpacity="0.5">
          <circle cx="320" cy="110" r="2" />
          <circle cx="1090" cy="160" r="2.5" />
          <circle cx="760" cy="90" r="1.6" />
          <circle cx="1280" cy="300" r="2" />
          <circle cx="180" cy="330" r="1.8" />
          <circle cx="980" cy="420" r="1.6" />
        </g>
      </svg>

      {/* Мәтін оқылуы үшін төменге қарай қарайту */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/25 via-neutral-950/55 to-neutral-950" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px,transparent 1px)," +
            "linear-gradient(90deg,rgba(255,255,255,0.4) 1px,transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}
