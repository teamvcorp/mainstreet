import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

/**
 * Upstash-backed rate limiting. If Upstash env vars are absent (e.g. local dev),
 * every check is allowed — so the app runs without Redis, but production stays
 * protected once configured.
 */
let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redis = url && token ? new Redis({ url, token }) : null;
  return redis;
}

const limiters = new Map<string, Ratelimit>();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

export async function rateLimit(opts: {
  key: string; // logical bucket, e.g. "auth", "orders"
  limit: number;
  windowSeconds: number;
  identifier?: string; // defaults to client IP
}): Promise<RateLimitResult> {
  const r = getRedis();
  if (!r) return { success: true, remaining: opts.limit };

  let limiter = limiters.get(opts.key);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: r,
      limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowSeconds} s`),
      prefix: `rl:${opts.key}`,
      analytics: false,
    });
    limiters.set(opts.key, limiter);
  }

  const id = opts.identifier ?? (await getClientIp());
  const res = await limiter.limit(id);
  return { success: res.success, remaining: res.remaining };
}

export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "anonymous"
  );
}
