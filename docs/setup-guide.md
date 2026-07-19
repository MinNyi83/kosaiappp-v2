# Complete CCTV & Network Field Service Deployment Guide

This document contains all necessary scripts, code, and deployment configurations to launch an end-to-end Field Service Management (FSM) system on Cloudflare.

## System Capabilities

- **Cloudflare Workers & D1**: Handles JSON API endpoints and relational data for clients, technicians, and work orders
- **Cloudflare D1**: SQLite database with edge replication
- **Cloudflare R2**: Securely hosts high-resolution before/after deployment site photos (via Google Drive integration)
- **Telegram Bot Routing**: Sends instantaneous automated text and photo notifications to technician dispatch chat
- **Mobile Web Application**: Zero-install, single-file HTML5 interface optimized for smartphones with camera capture
- **AI Integration**: Gemini 2.5 Flash for auto-dispatch, route optimization, and voice transcription
- **Google Drive Integration**: OAuth-based photo uploads to organized client/job folders
- **Modular Architecture**: TypeScript worker with 18+ route modules

---

## Part 1: Project Initialization & Cloudflare Settings

### 1. Initialize the Worker Application

```bash
# From project root
npm install

# Install Wrangler CLI globally (if not already)
npm install -g wrangler
```

### 2. Provision Serverless Storage Engines

```bash
# Create D1 database
npx wrangler d1 create cctv-fsm-db

# Note the database_id from output, update wrangler.toml
```

### 3. File: wrangler.toml

Replace the entire contents with this centralized configuration. Ensure you insert your unique database ID string.

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
JWT_SECRET = "6abfbf0ba5f5f11913b9197ee30f8686b917fca55c70b8cf055696d81e57b613c2f7530d00b8f8b7dcb3d0e98a566f058ed1c2337ca7c2cfb4bb600ceb4e1283"

[triggers]
crons = ["0 0 * * *"]

[ai]
binding = "AI"

[assets]
directory = "./public"
```

---

## Part 2: Relational Database Architecture & Testing Suite

### File: db/migrations/schema.sql

Save this relational database design schema. It maintains strict referential constraints while supporting unstructured data fields via JSON arrays.

```sql
PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS cash_transactions;
DROP TABLE IF EXISTS cash_safes;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_batches;
DROP TABLE IF EXISTS stock_code_map;
DROP TABLE IF EXISTS inventory_stock;
DROP TABLE IF EXISTS service_records;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS technicians;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS service_fees;


CREATE TABLE technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    role TEXT CHECK(role IN ('Sales', 'Technician', 'Admin')) NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1,
    email TEXT,
    username TEXT,
    password TEXT,
    pin TEXT DEFAULT '1234',
    photo TEXT,
    last_login TEXT,
    permissions TEXT CHECK(permissions IN ('read', 'read_write')) DEFAULT 'read_write'
);


CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    address TEXT NOT NULL,
    phone TEXT,
    amc_start TEXT,
    amc_end TEXT,
    amc_status TEXT CHECK(amc_status IN ('Active', 'Inactive', 'Expired', 'No AMC', 'Individual')) DEFAULT 'Inactive'
);

CREATE TABLE service_records (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    technician_id TEXT REFERENCES technicians(id),
    service_type TEXT CHECK(service_type IN ('CCTV', 'Networking', 'WiFi', 'NAS', 'General Maintenance')) NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')) DEFAULT 'Pending',
    job_description TEXT NOT NULL,
    technician_notes TEXT,
    equipment_used TEXT,
    before_photo TEXT,
    after_photo TEXT,
    arrival_time TEXT,
    completion_time TEXT,
    arrival_lat REAL,
    arrival_lng REAL,
    completion_lat REAL,
    completion_lng REAL,
    maps_url TEXT,
    signature TEXT,
    checklist_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    stock_qty INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0.00,
    unit_price_mmk REAL DEFAULT 0.00,
    batch_code TEXT,
    buying_price REAL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS stock_code_map (
    new_stock_code TEXT NOT NULL,
    old_stock_code TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_code TEXT PRIMARY KEY,
    item_code TEXT REFERENCES inventory_stock(item_code),
    buying_price REAL DEFAULT 0.00,
    supplier TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    serial_number TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    client_id TEXT REFERENCES clients(id),
    installed_date TEXT DEFAULT CURRENT_TIMESTAMP,
    warranty_months INTEGER DEFAULT 12,
    status TEXT CHECK(status IN ('Active', 'Defective', 'RMA Sent', 'RMA Completed', 'Replaced')) DEFAULT 'Active',
    distributor TEXT,
    rma_tracking_id TEXT,
    job_id TEXT REFERENCES service_records(id),
    batch_code TEXT REFERENCES inventory_batches(batch_code)
);

CREATE TABLE IF NOT EXISTS cash_safes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usd_balance REAL DEFAULT 0.00,
    mmk_balance REAL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT REFERENCES service_records(id),
    transaction_type TEXT CHECK(transaction_type IN ('Deposit', 'Withdrawal')) NOT NULL,
    primary_currency TEXT CHECK(primary_currency IN ('USD', 'MMK')) NOT NULL,
    amount REAL NOT NULL,
    exchange_rate REAL NOT NULL,
    equivalent_amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    receive_mmk INTEGER DEFAULT 0,
    linked_batch TEXT
);

CREATE TABLE IF NOT EXISTS service_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT NOT NULL,
    fee_amount REAL NOT NULL,
    currency TEXT CHECK(currency IN ('USD', 'MMK')) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT
);

PRAGMA foreign_keys = ON;
```

### File: db/migrations/mock_data.sql

Save this file to inject production testing records into your cluster.

```sql
INSERT INTO technicians (id, name, nickname, role, phone, active, email, username, password, pin) VALUES
('TECH-001', 'Alex Mercer', 'Alex', 'Technician', '+15550199', 1, 'alex@example.com', 'alex', 'pass123', '1234'),
('SALE-002', 'Sarah Connor', 'Sarah', 'Sales', '+15550188', 1, 'sarah@example.com', 'sarah', 'pass123', '1234');

INSERT INTO clients (id, company_name, contact_person, address, phone, amc_status) VALUES
('CLI-101', 'Apex Tech Solutions', 'John Doe', '100 Main St, Suite 400', '+15559999', 'Active'),
('CLI-102', 'Omega Logistics Hub', 'Jane Smith', '750 Warehouse Blvd, Dock 4', '+15558888', 'No AMC');

INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description, technician_notes, equipment_used) VALUES
('JOB-201', 'CLI-101', 'TECH-001', 'NAS', 'In Progress', 'Migrate 4-bay Synology NAS array to RAID 6 and configure remote access.', 'Initial deployment complete. Data rebuilding is running smoothly.', '["4x 8TB Enterprise HDDs", "Cat6 Patch Cord 2m"]'),
('JOB-202', 'CLI-102', 'TECH-001', 'CCTV', 'Pending', 'Mount 4x external IP PoE cameras and update firmware on 16-channel NVR.', '', '[]');

INSERT INTO cash_safes (usd_balance, mmk_balance) VALUES (1000.00, 2000000.00);

INSERT INTO service_fees (service_type, fee_amount, currency, description) VALUES
('CCTV', 50.00, 'USD', 'Standard CCTV installation'),
('Networking', 40.00, 'USD', 'Network setup and config'),
('WiFi', 30.00, 'USD', 'WiFi installation'),
('NAS', 80.00, 'USD', 'NAS setup and RAID config'),
('General Maintenance', 25.00, 'USD', 'General maintenance per hour');

INSERT INTO system_config (config_key, config_value) VALUES
('exchange_rate_usd_mmk', '2100'),
('company_name', 'Awesome Myanmar CCTV');
```

### Shell Commands to Build Schema & Seed Data

Execute these commands to apply your local definitions directly to the active local instances:

```bash
# Apply schema to local DB
npx wrangler d1 execute cctv-fsm-db --local --file=./db/migrations/schema.sql

# Seed mock data to local DB
npx wrangler d1 execute cctv-fsm-db --local --file=./db/migrations/mock_data.sql
```

For production remote deployment:

```bash
# Apply schema to remote DB
npx wrangler d1 execute cctv-fsm-db --remote --file=./db/migrations/schema.sql

# Note: For data sync, see D1 Database Sync section below
```

---

## Part 3: Backend Gateway Logic

### File: src/index.ts

This is the main entry point. The modular router registers all route modules from `src/modules/routes/`.

```typescript
/**
 * Kosai v2 — Main Entry Point
 *
 * A modular Cloudflare Worker that routes requests to domain-specific modules.
 * Each module registers its routes on a shared Router instance.
 *
 * Route modules (src/modules/routes/):
 *   auth, technicians, clients, jobs, inventory, invoices, expenses,
 *   attendance, reports, admin, ai, telegram, public, google,
 *   batches, rma, distributors, cashsafe, servicefees, landing
 *
 * Utility modules (src/modules/utils/):
 *   cors, response, jwt, router, telegram, viber, google, gemini
 */

import { Router } from './modules/utils/router.js';
import { getCorsHeaders } from './modules/utils/cors.js';
import { error } from './modules/utils/response.js';
import { uploadBackupToGoogleDrive } from './modules/utils/google.js';
import { sendTelegramNotification } from './modules/utils/telegram.js';

// ── Route module registry ────────────────────────────────────────────────
import * as authRoutes from './modules/routes/auth.js';
import * as techniciansRoutes from './modules/routes/technicians.js';
import * as clientsRoutes from './modules/routes/clients.js';
import * as jobsRoutes from './modules/routes/jobs.js';
import * as inventoryRoutes from './modules/routes/inventory.js';
import * as invoicesRoutes from './modules/routes/invoices.js';
import * as expensesRoutes from './modules/routes/expenses.js';
import * as attendanceRoutes from './modules/routes/attendance.js';
import * as reportsRoutes from './modules/routes/reports.js';
import * as adminRoutes from './modules/routes/admin.js';
import * as aiRoutes from './modules/routes/ai.js';
import * as telegramRoutes from './modules/routes/telegram.js';
import * as publicRoutes from './modules/routes/public.js';
import * as googleRoutes from './modules/routes/google.js';
import * as batchesRoutes from './modules/routes/batches.js';
import * as rmaRoutes from './modules/routes/rma.js';
import * as distributorsRoutes from './modules/routes/distributors.js';
import * as cashsafeRoutes from './modules/routes/cashsafe.js';
import * as servicefeesRoutes from './modules/routes/servicefees.js';
import * as landingRoutes from './modules/routes/landing.js';

const routeModules = [
  authRoutes,
  techniciansRoutes,
  clientsRoutes,
  jobsRoutes,
  inventoryRoutes,
  invoicesRoutes,
  expensesRoutes,
  attendanceRoutes,
  reportsRoutes,
  adminRoutes,
  aiRoutes,
  telegramRoutes,
  publicRoutes,
  googleRoutes,
  batchesRoutes,
  rmaRoutes,
  distributorsRoutes,
  cashsafeRoutes,
  servicefeesRoutes,
  landingRoutes,
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ── CORS preflight ──────────────────────────────────────────────────
    if (method === 'OPTIONS') {
      const origin = request.headers.get('Origin') || undefined;
      return new Response(null, { headers: getCorsHeaders(origin) });
    }

    // ── Temporary: manual backup trigger for testing ─────────────────────
    if (url.pathname === '/api/test-backup') {
      await handleAutoBackup(env);
      return new Response('Backup triggered — check Telegram', { status: 200 });
    }

    // ── Build router and register all modules ───────────────────────────
    const router = new Router();
    for (const mod of routeModules) {
      const registerFn = (mod as any).register || (mod as any).default?.register;
      if (typeof registerFn === 'function') {
        registerFn(router, env);
      } else {
        console.warn('Warning: Route module is missing register function', mod);
      }
    }

    // ── Match and execute route ─────────────────────────────────────────
    const origin = request.headers.get('Origin') || undefined;
    const match = router.match(method, url.pathname);
    if (match) {
      try {
        const response = await match.handler(request, match.params);
        return wrapResponse(response, origin);
      } catch (err) {
        console.error(`Route error [${method} ${url.pathname}]:`, err);
        return wrapResponse(error('Internal server error', 500), origin);
      }
    }

    // ── 404 fallback ────────────────────────────────────────────────────
    return wrapResponse(error(`Not found: ${method} ${url.pathname}`, 404), origin);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutoBackup(env));
  },
};

async function handleAutoBackup(env) {
  const dateStr = new Date().toISOString().split('T')[0];
  try {
    const db = env.DB;
    const tables = [
      'technicians',
      'clients',
      'service_records',
      'inventory_stock',
      'inventory_batches',
      'inventory_items',
      'cash_safes',
      'cash_transactions',
      'service_fees',
      'system_config',
      'landing_page',
    ];

    const backup: any = {};
    for (const table of tables) {
      try {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = (result as any).results || [];
      } catch (e) {
        console.warn(`Auto-backup: table ${table} not found or query failed:`, e.message);
      }
    }

    backup._exported_at = new Date().toISOString();
    backup._exported_by = 'system_cron';

    const backupJsonString = JSON.stringify(backup);
    const filename = `backup_${dateStr}_autobackup.json`;

    // 1. Upload to Google Drive (non-blocking — Telegram fires regardless)
    let driveFileId: string | null = null;
    try {
      driveFileId = await uploadBackupToGoogleDrive(env, backupJsonString, filename);
    } catch (driveErr) {
      console.error('Auto-backup Google Drive upload failed:', driveErr);
    }

    // 2. Notify Telegram
    let logMessage =
      `📊 *Database Auto-Backup Report*\n\n` +
      `📅 *Date:* ${dateStr}\n` +
      `📂 *Backup File:* \`${filename}\`\n`;

    if (driveFileId) {
      logMessage += `✅ *Google Drive Upload:* Successful\n` + `🔑 *File ID:* \`${driveFileId}\`\n`;
    } else {
      logMessage += `⚠️ *Google Drive Upload:* Failed (Token/Permissions Issue)\n`;
    }

    // Include summary counts
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
      await sendTelegramNotification(
        env,
        `🚨 *Database Auto-Backup Failed!*\n\n📅 *Date:* ${dateStr}\n❌ *Error:* ${err.message}`
      );
    } catch (e) {
      console.error('Failed to notify Telegram about backup failure:', e);
    }
  }
}

/**
 * Wrap a response object or plain data into a proper Response.
 */
function wrapResponse(data, origin?: string) {
  const corsHeaders = getCorsHeaders(origin);

  if (data instanceof Response) {
    const newHeaders = new Headers(data.headers);
    Object.entries(corsHeaders).forEach(([key, val]) => {
      newHeaders.set(key, val);
    });
    return new Response(data.body, {
      status: data.status,
      statusText: data.statusText,
      headers: newHeaders,
    });
  }

  const body = JSON.stringify(data);
  return new Response(body, {
    status: data?.statusCode || 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
```

---

## Part 4: Production Deployment

Deploy your backend worker code to the global edge network:

```bash
# Deploy Worker
npx wrangler deploy

# Deploy Frontend (Cloudflare Pages)
npx wrangler pages deploy public --project-name=awesomemyanmar
```

**Target URLs after deployment:**

- Backend API: `https://cctv-service-system.nyinyimin2007.workers.dev/`
- Frontend: `https://awesomemyanmar.pages.dev/`

---

## Part 5: Local Development Workflow

```bash
# 1. Build Tailwind CSS
npm run build:css

# 2. Start local dev server (uses local D1, .dev.vars)
npm run dev

# 3. Access at http://127.0.0.1:8787
```

### Available npm Scripts

| Command                | Description                |
| ---------------------- | -------------------------- |
| `npm run dev`          | Start Wrangler dev server  |
| `npm run build:css`    | Build Tailwind CSS         |
| `npm run watch:css`    | Watch Tailwind for changes |
| `npm run test`         | Run Vitest unit tests      |
| `npm run test:watch`   | Watch tests                |
| `npm run format`       | Format with Prettier       |
| `npm run format:check` | Check formatting           |

---

## Part 6: D1 Database Sync & Migrations (Critical)

When syncing database schema and data between local and remote Cloudflare D1 databases, follow these rules:

### 1. SQLITE_TOOBIG Limit (100KB)

Cloudflare D1 restricts single SQL statements to 100KB.

- Large tables (like `technicians` with base64 profiles) must have their base64 image strings replaced with `NULL` during data migration/sync scripts.
- Bulk inserts must be split into individual `INSERT OR IGNORE` statement lines.

### 2. Foreign Key Dependencies

- Disable or drop remote tables in iterative dependency order (e.g., drop child tables like `inventory_items` and `service_records` before parent tables like `clients` and `technicians` to avoid `SQLITE_CONSTRAINT` failures).
- Rebuild schema from `db/migrations/schema.sql` (and subsequent migrations like `create_roles_table.sql`, etc.) first, then perform the data import in exact parent-to-child order:
  `roles` → `clients` → `technicians` → `cash_safes` → `inventory_stock` → `inventory_batches` → `distributors` → `service_fees` → `system_config` → `landing_page` → `service_records` → `inventory_items` → `cash_transactions`

### 3. Missing Column Alignments

Always cross-reference table column structures between local SQLite and remote D1 schemas (e.g., check for `telegram_username` in `technicians`, `sub_category_id` in `inventory_stock`, and `quantity` in `inventory_batches`) and run `ALTER TABLE` to align them if missing.

---

## Part 7: Google Drive Setup & Auth (One-Time Setup)

1. Configure credentials under Google Cloud Console OAuth Client ID.
2. Add Authorized Redirect URI: `http://127.0.0.1:8787/api/auth/google/drive-callback`
3. Publish App on the OAuth Consent Screen (or add test user `nyinyimin2007@gmail.com`).
4. Add Client ID and Client Secret to `.dev.vars`.
5. Visit `http://127.0.0.1:8787/api/auth/google/drive-url` to authorize.
6. Copy the generated **Refresh Token** and paste it into `.dev.vars` under `GOOGLE_REFRESH_TOKEN`.
7. Restart wrangler dev.

---

## Part 8: Telegram Bot Setup

1. Create bot via @BotFather, get `TELEGRAM_BOT_TOKEN`
2. Get chat ID from @userinfobot or group info
3. Add to `.dev.vars`:
   ```env
   TELEGRAM_BOT_TOKEN="your-token"
   TELEGRAM_CHAT_ID="your-chat-id"
   ```
4. Set webhook after deployment:
   ```bash
   curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
     -d "url=https://cctv-service-system.nyinyimin2007.workers.dev/api/telegram/webhook"
   ```

**Webhook Features:**

- `/status [Ticket ID]` - Query work order details
- `/assign [Ticket ID] [Tech ID/Name/Nickname]` - Assign technician
- Voice messages → Auto-transcription + AI dispatch
- Keywords: `dispatch`, `repair`, `cameras`, `blank` trigger AI dispatcher

---

## Part 9: Frontend Applications

### Admin Dashboard (`public/admin.html` / `public/admin.js`)

- 2-Column tabbed layout (desktop)
- 13 modular sub-views loaded dynamically
- Real-time stats, charts, job dispatch

### Technician Mobile App (`public/app.html` / `public/app.js`)

- Mobile-first single-column layout
- Bottom navigation bar
- PIN security screen
- Camera capture for before/after photos
- AI chat assistant

### Client Portal (`public/portal.html`)

- Service history lookup
- Warranty status check

---

## Part 10: Desktop Application (Tauri)

Compile the admin and technician consoles into a standalone Windows `.exe` installer.

```bash
# Build Tauri app
npx tauri build
```

**Config:** `src-tauri/tauri.conf.json`
**Target Frontend Assets:** Build output reads from `../public`

---

## Part 11: Environment Variables Reference

### Local (`.dev.vars`)

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="your-drive-folder-id"
```

### Cloudflare Worker (wrangler.toml `[vars]` or secrets)

```toml
GOOGLE_CLIENT_ID = "your-google-client-id"
ADMIN_EMAIL = "your-email@gmail.com"
JWT_SECRET = "your-jwt-secret"
```

Set secrets via CLI:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

---

## Part 12: Key Implementation Notes

### Modular Route Architecture

Each route module in `src/modules/routes/*.ts` exports a `register(router, env)` function:

```typescript
export function register(router: Router, env: Env) {
  router.get('/api/endpoint', async (request) => { ... });
  router.post('/api/endpoint', async (request) => { ... });
}
```

### Authentication

- JWT-based with `verifyToken()` in `src/modules/utils/jwt.ts`
- PIN fallback for local development (plain text comparison)
- Google OAuth for admin access

### AI Integration (Gemini)

- Dual-gateway routing: direct → fallback proxy
- Used for: auto-dispatch, route optimization, note polishing, transcription

### Photo Storage Pipeline

1. Technician uploads via mobile app → FormData to `/api/jobs/update`
2. Worker uploads to Google Drive (OAuth) → Organized: `ClientName/JobID/`
3. Telegram notifications pull binary from Drive → Send as photo (not URL)

### Polling Limits (Free Tier: 100k req/day)

- Admin dashboard: 5 min interval (300000ms)
- Technician chat: 30 sec interval (30000ms) when active
- Clear intervals on tab close/logout

---

## Part 13: Troubleshooting

### CSP Errors

Check `public/_headers` for `Content-Security-Policy` directives if fonts/scripts fail to load.

### PIN Login Fails Locally

Ensure `verifyPin` in `src/modules/routes/auth.ts` supports plain-text fallback: `plainPin === storedHash`

### Google OAuth 403

Add `http://127.0.0.1:8787` to Authorized JavaScript Origins in Google Cloud Console.

### D1 Foreign Key Errors

Drop tables in dependency order (children first) before re-running schema.sql.

### QR Code Broken

Use `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js` not jsdelivr.

---

_Documentation updated: 2026-07-19_
