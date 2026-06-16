/* Jaiyq логотипі — жанына қисайып тұрған жапырақ, ортасынан Жайық өзені ағады.
   Жапырақ currentColor-ды мұрагерлейді (мәтін түсіне сай), өзен — көк градиент. */
export function JaiyqLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Jaiyq"
    >
      <defs>
        <linearGradient id="jaiyqRiver" x1="4" y1="4" x2="20" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>

      <g transform="translate(12 12) rotate(-35) scale(0.92) translate(-12 -12)">
        {/* Жапырақ контуры мен жеңіл толтыруы */}
        <path
          d="M12 22C4.5 16.8 4.3 7.4 12 2C19.7 7.4 19.5 16.8 12 22Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          fill="currentColor"
          fillOpacity="0.14"
        />
        {/* Сабақ (стебель) */}
        <path d="M12 22.6L12 20.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Ортасынан ағатын Жайық өзені */}
        <path
          d="M12 20.6C9.7 17.4 14.3 14.4 12 11.5C9.7 8.6 14.3 5.6 12 3.4"
          stroke="url(#jaiyqRiver)"
          strokeWidth="1.9"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    </svg>
  );
}
