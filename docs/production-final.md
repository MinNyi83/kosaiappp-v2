# Secure Field App, Dynamic Admin Desk, and Automated Backups

This document covers the current production-ready configuration for the Awesome Myanmar CCTV & Infrastructure FSM platform.

## Current Architecture (v2.0)

The system uses a **modular TypeScript architecture**:

- **Worker Entry**: `src/index.ts` with scheduled cron handler
- **Route Modules**: `src/modules/routes/*.ts` (18+ modules)
- **Utilities**: `src/modules/utils/*.ts`
- **Frontend**: `public/` served via Cloudflare Pages
- **Database**: Cloudflare D1 with `db/migrations/schema.sql`

---

## Part 1: Automated Daily Database Backups

### Cron Trigger Configuration (`wrangler.toml`)

```toml
[triggers]
crons = ["0 0 * * *"]  # Fires at 00:00 UTC daily
```

### Scheduled Handler (`src/index.ts`)

The worker exports a `scheduled` handler for cron execution:

```typescript
export default {
  async fetch(request, env) { ... },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutoBackup(env));
  },
};

async function handleAutoBackup(env) {
  const dateStr = new Date().toISOString().split('T')[0];
  try {
    const db = env.DB;
    const tables = [
      'technicians', 'clients', 'service_records',
      'inventory_stock', 'inventory_batches', 'inventory_items',
      'cash_safes', 'cash_transactions', 'service_fees',
      'system_config', 'landing_page'
    ];

    const backup: any = {};
    for (const table of tables) {
      try {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = (result as any).results || [];
      } catch (e) {
        console.warn(`Auto-backup: table ${table} not found:`, e.message);
      }
    }

    backup._exported_at = new Date().toISOString();
    backup._exported_by = 'system_cron';

    const backupJsonString = JSON.stringify(backup);
    const filename = `backup_${dateStr}_autobackup.json`;

    // 1. Upload to Google Drive
    let driveFileId: string | null = null;
    try {
      driveFileId = await uploadBackupToGoogleDrive(env, backupJsonString, filename);
    } catch (driveErr) {
      console.error('Auto-backup Google Drive upload failed:', driveErr);
    }

    // 2. Notify Telegram
    let logMessage = `📊 *Database Auto-Backup Report*\n\n` +
      `📅 *Date:* ${dateStr}\n` +
      `📂 *Backup File:* \`${filename}\`\n`;

    if (driveFileId) {
      logMessage += `✅ *Google Drive Upload:* Successful\n` +
        `🔑 *File ID:* \`${driveFileId}\`\n`;
    } else {
      logMessage += `⚠️ *Google Drive Upload:* Failed\n`;
    }

    logMessage += `\n📦 *Record Summaries:*`;
    for (const table of Object.keys(backup)) {
      if (!table.startsWith('_')) {
        logMessage += `\n• \`${table}\`: ${backup[table].length} records`;
      }
    }

    await sendTelegramNotification(env, logMessage);
  } catch (err) {
    console.error('Auto-backup cron failed:', err);
    try {
      await sendTelegramNotification(env, `🚨 *Database Auto-Backup Failed!*\n\n📅 *Date:* ${dateStr}\n❌ *Error:* ${err.message}`);
    } catch (e) {
      console.error('Failed to notify Telegram about backup failure:', e);
    }
  }
}
```

### Manual Backup Trigger (Testing)

```bash
# Trigger backup manually via API
curl -X GET "http://127.0.0.1:8787/api/test-backup"
```

---

## Part 2: Technician Mobile App with PIN Authentication

### Current Implementation (`public/app.html` + `public/app.js`)

**Features**:

- PIN-based login screen (matches `technicians.pin` in D1)
- JWT session management
- Job list filtered by assigned technician
- Camera capture for before/after photos
- AI chat assistant
- Offline queue with manual sync
- Bottom navigation bar (mobile-first)

### Key Auth Flow

```javascript
// public/app.js
async function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('auth-uid').value.trim();
  const pin = document.getElementById('auth-pin').value.trim();

  const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, pin }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Authentication failed');

  // Store JWT in localStorage
  localStorage.setItem('auth_token', data.token);
  // ... redirect to job list
}
```

### Polling Optimization

**Admin Dashboard** (`public/admin.js`):

```javascript
setInterval(refreshDashboardData, 300000); // 5 minutes
```

**Technician Chat** (`public/app.js`):

```javascript
setInterval(() => pollTechChat(jobId), 30000); // 30 seconds
clearInterval(chatInterval); // Clear when chat closed
```

---

## Part 3: Admin Dispatch Desk with Dynamic Dropdowns

### Current Implementation (`public/admin.html` + `public/admin.js`)

**Features**:

- 2-Column tabbed layout (desktop)
- Dynamic dropdowns populated from D1:
  - Technicians (active, by role)
  - Clients (with AMC status)
  - Inventory items (stock, pricing)
  - Service fees
- Real-time job dispatch with Telegram notifications
- PDF receipt generation
- AI-powered auto-dispatch

### Key Admin Routes (`src/modules/routes/admin.ts`)

```typescript
// Lookup data for dropdowns
router.get('/api/admin/lookups', async (request) => { ... });

// Technician management
router.get('/api/admin/technicians', async (request) => { ... });
router.put('/api/admin/technicians/:id', async (request, params) => { ... });
router.delete('/api/admin/technicians/:id', async (request, params) => { ... });

// Client management
router.get('/api/admin/clients', async (request) => { ... });

// Job dispatch
router.post('/api/admin/jobs/ai-polish', async (request) => { ... });
router.post('/api/admin/ai/auto-dispatch', async (request) => { ... });
```

---

## Part 4: Production Deployment Checklist

### 1. Environment Setup

```bash
# Worker secrets
wrangler secret put JWT_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put GOOGLE_DRIVE_FOLDER_ID

# wrangler.toml [vars]
GOOGLE_CLIENT_ID = "your-client-id"
ADMIN_EMAIL = "your-email@gmail.com"
JWT_SECRET = "your-jwt-secret"  # or use secret above
```

### 2. Database Migration

```bash
# Local
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql

# Remote (production)
npx wrangler d1 execute cctv-fsm-db --remote --file=db/migrations/schema.sql
```

### 3. Google Drive Auth

```bash
# Local: Visit to authorize
http://127.0.0.1:8787/api/auth/google/drive-url

# Copy refresh token to secrets
wrangler secret put GOOGLE_REFRESH_TOKEN
```

### 4. Deploy

```bash
# Worker
npx wrangler deploy

# Frontend (Pages)
npx wrangler pages deploy public --project-name=awesomemyanmar
```

### 5. Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://cctv-service-system.nyinyimin2007.workers.dev/api/telegram/webhook"
```

### 6. Custom Domain (Optional)

- Cloudflare Dashboard → Workers → Settings → Triggers → Custom Domains
- Add your domain (e.g., `api.awesomemyanmar.com`)

---

## Part 5: Key Configuration Files

### `wrangler.toml`

```toml
name = "cctv-service-system"
main = "src/index.ts"
compatibility_date = "2026-07-04"
compatibility_flags = [ "nodejs_compat" ]

[[d1_databases]]
binding = "DB"
database_name = "cctv-fsm-db"
database_id = "a887d01b-41ac-4ef7-9e9d-464a3f52f15b"

[vars]
GOOGLE_CLIENT_ID = "609507528219-2foc0ch65rkqkgdlvlihqagb6dqbmpcm.apps.googleusercontent.com"
ADMIN_EMAIL = "nyinyimin2007@gmail.com"
JWT_SECRET = "your-secret-here"

[triggers]
crons = ["0 0 * * *"]

[ai]
binding = "AI"

[assets]
directory = "./public"
```

### `.dev.vars` (Local Only)

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="your-drive-folder-id"
```

---

## Part 6: Monitoring & Limits

### Cloudflare Free Tier Limits

| Resource          | Limit           |
| ----------------- | --------------- |
| Worker Requests   | 100,000/day     |
| D1 Read Requests  | 5,000,000/month |
| D1 Write Requests | 100,000/month   |
| D1 Storage        | 5 GB            |
| R2 Storage        | 10 GB           |

### Polling Configuration

- **Admin Dashboard**: 5 min interval (300,000ms)
- **Technician Chat**: 30 sec interval (30,000ms) when active
- **Clear intervals** on tab close/logout

### Offline Queue

Technician updates stored in `localStorage` when offline:

- Manual "Sync Queue" button
- Prevents constant retry API calls

---

_Updated: 2026-07-19_
