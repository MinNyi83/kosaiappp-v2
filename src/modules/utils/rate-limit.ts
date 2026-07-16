const rateLimit = new Map();
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

export async function checkRateLimit(request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();

  let entry = rateLimit.get(ip);
  if (!entry) {
    entry = { count: 0, resetAt: now + WINDOW_MS };
  }

  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + WINDOW_MS;
  }

  entry.count++;
  rateLimit.set(ip, entry);

  if (entry.count > MAX_REQUESTS) {
    return { blocked: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  return { blocked: false };
}

