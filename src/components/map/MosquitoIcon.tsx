// Recognizable mosquito silhouette — long proboscis, slender body, two wings, six legs.
export function MosquitoIcon({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-label="маса"
    >
      {/* legs */}
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.9">
        <path d="M30 38 L16 50 L10 48" />
        <path d="M32 38 L24 54 L18 56" />
        <path d="M34 38 L34 56 L40 58" />
        <path d="M36 36 L48 50 L54 48" />
        <path d="M35 34 L50 42 L56 40" />
        <path d="M30 34 L14 40 L8 38" />
      </g>
      {/* wings */}
      <g fill="currentColor" opacity="0.35">
        <ellipse cx="40" cy="22" rx="13" ry="6" transform="rotate(-28 40 22)" />
        <ellipse cx="46" cy="26" rx="12" ry="5" transform="rotate(-18 46 26)" />
      </g>
      {/* body: head, thorax, segmented abdomen */}
      <g fill="currentColor">
        <circle cx="27" cy="33" r="5" />
        <ellipse cx="33" cy="35" rx="5" ry="4" />
        <path d="M37 35 q9 1 16 7 q-9 -1 -16 -3 z" />
        <ellipse cx="42" cy="37" rx="3.5" ry="2.6" />
        <ellipse cx="48" cy="40" rx="2.8" ry="2" />
      </g>
      {/* proboscis */}
      <path d="M24 34 L6 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
