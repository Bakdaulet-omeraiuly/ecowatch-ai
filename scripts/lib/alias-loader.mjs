// Node (--experimental-strip-types) үшін: "@/..." → src/..., кеңейтімсіз импортқа .ts/.tsx қосу.
// Тек скрипттер үшін (сайт құрастыруына қатысы жоқ).
const SRC = new URL("../../src/", import.meta.url);
export async function resolve(spec, ctx, next) {
  if (spec.startsWith("@/")) spec = new URL(spec.slice(2), SRC).href;
  try {
    return await next(spec, ctx);
  } catch (err) {
    if (spec === "next/server") return next("next/server.js", ctx);
    if (spec.startsWith(".") || spec.startsWith("file:") || spec.startsWith("/")) {
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        try { return await next(spec + ext, ctx); } catch { /* келесі */ }
      }
    }
    throw err;
  }
}
