/**
 * In-memory rate limiter with TTL eviction.
 * Limits requests per IP within a time window.
 * Supports per-endpoint rate limits for sensitive operations.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimit = new Map<string, RateLimitEntry>();
const EVICT_INTERVAL = 300_000; // Evict every 5 minutes
const MAX_ENTRIES = 10_000;

// Rate limit configurations per endpoint type
const RATE_LIMITS = {
  login: { windowMs: 900_000, maxRequests: 5 }, // 15 min window, 5 attempts
  default: { windowMs: 60_000, maxRequests: 30 }, // 1 min window, 30 requests
  sensitive: { windowMs: 60_000, maxRequests: 10 }, // 1 min window, 10 requests
} as const;

type RateLimitType = keyof typeof RATE_LIMITS;

let lastEviction = Date.now();

function evictExpired() {
  const now = Date.now();
  if (now - lastEviction < EVICT_INTERVAL) return;
  lastEviction = now;

  for (const [key, entry] of rateLimit) {
    if (now > entry.resetAt) rateLimit.delete(key);
  }

  // If still too large, clear oldest half
  if (rateLimit.size > MAX_ENTRIES) {
    const entries = [...rateLimit.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(([key]) => rateLimit.delete(key));
  }
}

/**
 * Check rate limit for a request.
 * @param request - The incoming request
 * @param type - Rate limit type: 'login', 'sensitive', or 'default'
 * @param customKey - Optional custom key (e.g., endpoint path) for finer granularity
 */
export async function checkRateLimit(
  request: Request,
  type: RateLimitType = 'default',
  customKey?: string
) {
  evictExpired();

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = customKey ? `${ip}:${customKey}` : `${ip}:${type}`;
  const now = Date.now();
  const config = RATE_LIMITS[type];

  let entry = rateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
  }

  entry.count++;
  rateLimit.set(key, entry);

  if (entry.count > config.maxRequests) {
    return { blocked: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { blocked: false };
}
