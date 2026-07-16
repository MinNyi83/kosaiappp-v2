---
name: cloudflare-polling-limits
description: Rules and guidance on managing auto-polling intervals, background sync timers, and Cloudflare Worker requests to prevent exceeding daily free tier limits (100k requests/day).
---

# ⚡ Cloudflare Worker Polling & Usage Limits Guidance

This skill helps manage, optimize, and troubleshoot background polling intervals and API request timers to prevent exhausting Cloudflare Worker free tier request quotas (100,000 requests per day).

## ⚠️ Known High-Frequency Timers in the Workspace

If you are modifying or debugging client applications in this repository, pay close attention to these files and their polling intervals:

### 1. Admin Dispatch Console Dashboard Refresh

- **Root File**: [**`admin.js`**](file:///d:/kosai-project/v2/admin.js#L267) -> runs `setInterval(refreshDashboardData, 10000)` (polls every **10 seconds**).
- **Public Asset File**: [**`public/admin.js`**](file:///d:/kosai-project/v2/public/admin.js#L353) -> runs `setInterval(refreshDashboardData, 300000)` (polls every **5 minutes**).
- **Recommended Action**: Standardize on **5 minutes** (`300000`ms) or disable auto-polling in favor of manual **🔄 Refresh** buttons to conserve requests.

### 2. Technician Chat Polling

- **Root File**: [**`app.html`**](file:///d:/kosai-project/v2/app.html#L667) -> runs `setInterval(() => pollTechChat(jobId), 3000)` (polls every **3 seconds**).
- **Public Asset File**: [**`public/app.js`**](file:///d:/kosai-project/v2/public/app.js#L675) -> runs `setInterval(() => pollTechChat(jobId), 30000)` (polls every **30 seconds**).
- **Recommended Action**: Standardize on **30 seconds** (`30000`ms) or longer when active, and clear the interval when the chat is closed/collapsed using `clearInterval()`.

---

## 💡 Best Practices for Cloudflare Worker Efficiency

1. **Clear Active Intervals**: Always clear chat intervals using `clearInterval` when windows/tabs are collapsed, minimized, or logged out.
2. **Offline Queues & Batching**: Store technician ticket updates in `localStorage` when offline. Provide a manual sync button **`Sync Queue`** rather than constantly retrying API calls.
3. **Use Pages Proxy Redirects**: Route backend API calls via `https://awesomemyanmar.pages.dev/api/*` mapped to your workers URL in [**`functions/api/[[path]].js`**](file:///d:/kosai-project/v2/functions/api/%5B%5Bpath%5D%5D.js) to bypass the ISP block on `workers.dev` in Myanmar.
