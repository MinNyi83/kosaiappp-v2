/**
 * In-memory rate limiter with TTL eviction.
 * Limits requests per IP within a time window.
 * Evicts expired entries periodically to prevent unbounded growth.
 */

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;
const EVICT_INTERVAL = 300_000; // Evict every 5 minutes
const MAX_ENTRIES = 10_000; // Cap entries to prevent memory issues

let lastEviction = Date.now();

function evictExpired() {
  const now = Date.now();
  if (now - lastEviction < EVICT_INTERVAL) return;
  lastEviction = now;

  for (const [ip, entry] of rateLimit) {
    if (now > entry.resetAt) rateLimit.delete(ip);
  }

  // If still too large, clear oldest half
  if (rateLimit.size > MAX_ENTRIES) {
    const entries = [...rateLimit.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
    const toRemove = entries.slice(0, Math.floor(entries.length / 2));
    toRemove.forEach(([ip]) => rateLimit.delete(ip));
  }
}

export async function checkRateLimit(request: Request) {
  evictExpired();

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();

  let entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  entry.count++;
  rateLimit.set(ip, entry);

  if (entry.count > MAX_REQUESTS) {
    return { blocked: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { blocked: false };
}
