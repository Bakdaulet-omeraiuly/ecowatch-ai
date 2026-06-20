export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] overflow-hidden">
      {/* Атырау қаласының фото фоны */}
      <img
        src="/atyrau-city.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      {/* Мәтін оқылуы үшін қою gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/50 via-neutral-950/60 to-neutral-950" />
    </div>
  );
}
