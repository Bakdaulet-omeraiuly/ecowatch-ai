import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Optional rate limiting. Active only when Upstash env vars are present
// (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). Without them it's a
// no-op, so local/dev and unconfigured deploys keep working.

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;

const limiter =
  url && token
    ? new Ratelimit({
        redis: new Redis({ url, token }),
        // 20 expensive AI calls per IP per hour
        limiter: Ratelimit.slidingWindow(20, "1 h"),
        prefix: "jaiyq",
      })
    : null;

function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

// Returns true if allowed, false if the caller has exceeded the limit.
export async function allow(req: Request, bucket = "ai"): Promise<boolean> {
  if (!limiter) return true; // not configured → no limiting
  try {
    const { success } = await limiter.limit(`${bucket}:${clientIp(req)}`);
    return success;
  } catch {
    return true; // never block on limiter failure
  }
}
