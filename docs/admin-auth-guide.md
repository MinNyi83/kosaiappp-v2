# Admin Console, Authentication, and Telegram Bot Configuration

This document covers the secure authentication system, admin console CRUD tools, and Telegram bot integration for the Awesome Myanmar CCTV & Infrastructure FSM platform.

## Current Architecture (v2.0)

The system now uses a **modular TypeScript architecture** with:

- **Worker Entry**: `src/index.ts` (main router)
- **Route Modules**: `src/modules/routes/*.ts` (18+ domain modules)
- **Utilities**: `src/modules/utils/*.ts` (shared utilities)
- **Database**: Cloudflare D1 with schema in `db/migrations/schema.sql`

---

## Part 1: Secure Database Architecture

The database schema (`db/migrations/schema.sql`) includes authentication fields in the `technicians` table:

```sql
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
```

### System Config Table

```sql
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT
);
```

### Seeded Admin Secret

```sql
INSERT OR REPLACE INTO system_config (config_key, config_value)
VALUES ('ADMIN_SECRET_KEY', 'SuperSecureAdminPass123!');
```

---

## Part 2: Authentication Flow

### Technician PIN Login (`src/modules/routes/auth.ts`)

**Endpoint**: `POST /api/auth/login`

```typescript
const { id, pin } = await request.json();
const tech = await env.DB.prepare(
  'SELECT id, name, role, permissions FROM technicians WHERE id = ? AND pin = ? AND active = 1'
)
  .bind(id, pin)
  .first();

if (!tech) return error('Invalid ID or PIN', 401);
return success({ user: tech });
```

**Features**:

- Plain-text PIN fallback for local development
- JWT token generation with `src/modules/utils/jwt.ts`
- Role-based permissions (`read` / `read_write`)

### Admin Authentication

Admin endpoints are protected via `X-Admin-Secret` header:

```typescript
const adminKey = request.headers.get('X-Admin-Secret');
const storedKey = await env.DB.prepare(
  "SELECT config_value FROM system_config WHERE config_key = 'ADMIN_SECRET_KEY'"
).first('config_value');

if (!adminKey || adminKey !== storedKey) {
  return error('Unauthorized Admin Request', 403);
}
```

---

## Part 3: Admin Console CRUD Endpoints

All admin endpoints under `/api/admin/*` require `X-Admin-Secret` header.

### Client Management (`src/modules/routes/clients.ts`)

| Method | Endpoint           | Description        |
| ------ | ------------------ | ------------------ |
| GET    | `/api/clients`     | List all clients   |
| GET    | `/api/clients/:id` | Get client details |
| POST   | `/api/clients`     | Create client      |
| PUT    | `/api/clients/:id` | Update client      |
| DELETE | `/api/clients/:id` | Delete client      |

### Technician Management (`src/modules/routes/technicians.ts`)

| Method | Endpoint                   | Description       |
| ------ | -------------------------- | ----------------- |
| GET    | `/api/technicians`         | List technicians  |
| GET    | `/api/technicians/:id`     | Get technician    |
| POST   | `/api/technicians`         | Create technician |
| PUT    | `/api/technicians/:id`     | Update technician |
| DELETE | `/api/technicians/:id`     | Delete technician |
| PUT    | `/api/technicians/:id/pin` | Change PIN        |

### Job Management (`src/modules/routes/jobs.ts`)

| Method | Endpoint               | Description              |
| ------ | ---------------------- | ------------------------ |
| GET    | `/api/jobs`            | List jobs (with filters) |
| GET    | `/api/jobs/active`     | Active jobs              |
| GET    | `/api/jobs/calendar`   | Calendar view            |
| GET    | `/api/jobs/receipt`    | Job receipt              |
| GET    | `/api/jobs/:id`        | Get job details          |
| POST   | `/api/jobs`            | Create job               |
| PUT    | `/api/jobs/:id`        | Update job               |
| DELETE | `/api/jobs/:id`        | Delete job               |
| POST   | `/api/jobs/:id/status` | Update status            |

---

## Part 4: Telegram Bot Integration

### Configuration

Set secrets in Cloudflare:

```bash
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```

### Webhook Endpoint (`src/modules/routes/telegram.ts`)

**Endpoint**: `POST /api/telegram/webhook`

#### Features

1. **Slash Commands**
   - `/status [Ticket ID]` - Query work order details
   - `/assign [Ticket ID] [Tech ID/Name/Nickname]` - Assign technician

2. **AI Voice Dispatch**
   - Receives voice messages (`audio/ogg`)
   - Transcribes with Gemini 2.5 Flash
   - Auto-matches service domain (CCTV, Networking, WiFi, NAS, General)
   - Auto-assigns best technician by skill/nickname
   - Creates client & job records in D1

3. **Outbound Notifications**
   - Site photos (before/after) sent on job updates
   - Database backup logs sent to Telegram group

### Setting Webhook

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook" \
  -d "url=https://cctv-service-system.nyinyimin2007.workers.dev/api/telegram/webhook"
```

---

## Part 5: Deployment

### Local Development

```bash
# 1. Start dev server
npm run dev

# 2. Apply schema locally
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql

# 3. Seed mock data
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql
```

### Production Deploy

```bash
# Deploy Worker
npx wrangler deploy

# Deploy Frontend (Cloudflare Pages)
npx wrangler pages deploy public --project-name=awesomemyanmar
```

### Set Production Secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

---

## Part 6: Google Drive Setup (Photo Storage)

### One-Time Setup

1. Google Cloud Console → OAuth Client ID
2. Authorized Redirect URI: `http://127.0.0.1:8787/api/auth/google/drive-callback`
3. Publish OAuth Consent Screen (or add test user `nyinyimin2007@gmail.com`)
4. Add Client ID/Secret to `.dev.vars` / wrangler secrets
5. Visit `http://127.0.0.1:8787/api/auth/google/drive-url` to authorize
6. Copy Refresh Token to `.dev.vars` / secret `GOOGLE_REFRESH_TOKEN`
7. Restart `npm run dev`

### Photo Pipeline

1. Technician uploads via mobile app → `/api/jobs/update` (FormData)
2. Worker uploads to Google Drive → `ClientName/JobID/`
3. Telegram notification pulls binary from Drive → sends as photo

---

## Security Notes

| Concern          | Mitigation                                                          |
| ---------------- | ------------------------------------------------------------------- |
| CSP Errors       | Check `public/_headers` for `Content-Security-Policy`               |
| PIN Hashing      | Local dev uses plain-text; verifyPin supports fallback              |
| QR Codes         | Use `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`   |
| Google OAuth 403 | Add testing origin to Authorized JavaScript Origins in Google Cloud |

---

_Updated: 2026-07-19_
