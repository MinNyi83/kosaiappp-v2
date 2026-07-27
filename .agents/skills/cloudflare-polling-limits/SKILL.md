---
name: cloudflare-polling-limits
description: Rules and guidance on managing auto-polling intervals, background sync timers, and Cloudflare Worker requests to prevent exceeding daily free tier limits (100k requests/day).
---

# Cloudflare Worker Polling & Usage Limits Guidance

This skill helps manage, optimize, and troubleshoot background polling intervals and API request timers to prevent exhausting Cloudflare Worker free tier request quotas (100,000 requests per day).

## Free Tier Limits

| Resource | Free Tier Limit |
|----------|-----------------|
| Worker Requests | 100,000/day |
| CPU Time | 10ms per request |
| Subrequests | 50 per request |
| KV Reads | 100,000/day |
| KV Writes | 1,000/day |
| D1 Reads | 5,000,000/day |
| D1 Writes | 100,000/day |

---

## Known High-Frequency Timers in the Workspace

### 1. Admin Dispatch Console Dashboard Refresh

- **Root File**: `admin.js` -> runs `setInterval(refreshDashboardData, 10000)` (polls every **10 seconds**).
- **Public Asset File**: `public/admin.js` -> runs `setInterval(refreshDashboardData, 300000)` (polls every **5 minutes**).
- **Recommended Action**: Standardize on **5 minutes** (`300000`ms) or disable auto-polling in favor of manual **Refresh** buttons to conserve requests.

### 2. Technician Chat Polling

- **Root File**: `app.html` -> runs `setInterval(() => pollTechChat(jobId), 3000)` (polls every **3 seconds**).
- **Public Asset File**: `public/app.js` -> runs `setInterval(() => pollTechChat(jobId), 30000)` (polls every **30 seconds**).
- **Recommended Action**: Standardize on **30 seconds** (`30000`ms) or longer when active, and clear the interval when the chat is closed/collapsed using `clearInterval()`.

### 3. Auto-Backup Cron

- **Schedule**: `0 0 * * *` (daily at midnight)
- **Impact**: ~1 request + D1 reads for each table
- **Recommended Action**: Keep as-is, but consider weekly backups if request quota is tight.

---

## Rate Limiting Configuration

The backend implements rate limiting in `src/modules/utils/rate-limit.ts`:

```typescript
const RATE_LIMITS = {
  login: { windowMs: 900_000, maxRequests: 5 },      // 15 min window, 5 attempts
  default: { windowMs: 60_000, maxRequests: 30 },     // 1 min window, 30 requests
  sensitive: { windowMs: 60_000, maxRequests: 10 },   // 1 min window, 10 requests
};
```

### Endpoint-Specific Limits

| Endpoint Type | Window | Max Requests | Key |
|---------------|--------|--------------|-----|
| Login | 15 min | 5 | `auth:login` |
| AI Polish Notes | 1 min | 15 | `polish:{userId}` |
| AI Auto-Dispatch | 1 min | 10 | `dispatch:{userId}` |
| AI Copilot | 1 min | 10 | `copilot:{userId}` |
| AI Transcribe | 1 min | 5 | `transcribe:{userId}` |
| Default | 1 min | 30 | `default` |

**Note**: Rate limits are per-isolate (in-memory). Not shared across Worker instances.

---

## Best Practices for Cloudflare Worker Efficiency

### 1. Clear Active Intervals

Always clear chat intervals using `clearInterval` when windows/tabs are collapsed, minimized, or logged out:

```javascript
// Store interval ID
const chatIntervalId = setInterval(() => pollTechChat(jobId), 30000);

// Clear when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    clearInterval(chatIntervalId);
  }
});
```

### 2. Offline Queues & Batching

Store technician ticket updates in `localStorage` when offline. Provide a manual sync button **Sync Queue** rather than constantly retrying API calls:

```javascript
// Queue offline actions
function queueOfflineAction(action) {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  queue.push({ ...action, timestamp: Date.now() });
  localStorage.setItem('offlineQueue', JSON.stringify(queue));
}

// Sync when online
async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
  for (const action of queue) {
    await fetch(action.url, action.options);
  }
  localStorage.removeItem('offlineQueue');
}
```

### 3. Use Pages Proxy Redirects

Route backend API calls via `https://awesomemyanmar.pages.dev/api/*` mapped to your workers URL in `functions/api/[[path]].js` to bypass the ISP block on `workers.dev` in Myanmar.

### 4. Debounce Search Inputs

Debounce search inputs to reduce API calls:

```javascript
let searchTimeout;
function debounceSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    fetchResults(query);
  }, 300); // 300ms debounce
}
```

### 5. Cache Responses

Use browser caching for static data:

```javascript
// Cache with TTL
const cache = new Map();
function getCached(key, fetchFn, ttlMs = 60000) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }
  return fetchFn().then(data => {
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  });
}
```

### 6. Request Budget Tracking

Monitor daily request usage:

```javascript
// Track requests in localStorage
function trackRequest() {
  const today = new Date().toISOString().split('T')[0];
  const key = `requests_${today}`;
  const count = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, count.toString());
  
  // Warn if approaching limit
  if (count > 80000) {
    console.warn(`Approaching daily limit: ${count}/100000`);
  }
}
```

---

## Monitoring & Debugging

### Check Request Count

```bash
# View Worker analytics
npx wrangler tail

# Check D1 usage
npx wrangler d1 execute cctv-fsm-db --command="SELECT COUNT(*) FROM service_records"
```

### Optimize Slow Endpoints

1. Profile with `console.time()` / `console.timeEnd()`
2. Reduce D1 queries with joins instead of N+1
3. Cache frequent reads in memory (per-request)
4. Use `Promise.all()` for independent queries
