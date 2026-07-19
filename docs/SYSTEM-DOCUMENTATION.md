# Awesome Myanmar CCTV & Infrastructure System

## Complete System Documentation

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Pages](#pages)
3. [API Endpoints](#api-endpoints)
4. [Database Schema](#database-schema)
5. [Design System](#design-system)
6. [Deployment Guides](#deployment-guides)
7. [Configuration](#configuration)

---

## System Overview

| Item         | Details                                         |
| ------------ | ----------------------------------------------- |
| **Project**  | Awesome Myanmar CCTV & Infrastructure FSM       |
| **Version**  | 2.0.0                                           |
| **Database** | Cloudflare D1 (SQLite edge DB)                  |
| **Backend**  | Cloudflare Workers (TypeScript, modular routes) |
| **Frontend** | Vanilla JS + Tailwind CSS (served via Pages)    |

---

## Pages

### Main Pages

| Page            | File                    | Purpose                                                     |
| --------------- | ----------------------- | ----------------------------------------------------------- |
| Landing Page    | `public/index.html`     | Marketing hero, services, stats, price list, quotation form |
| Admin Dashboard | `public/admin.html`     | HQ Dispatch Console with modular sub-views                  |
| Technician App  | `public/app.html`       | Field operations portal for technicians                     |
| Client Portal   | `public/portal.html`    | Customer service history & warranty lookup                  |
| Jobs Dashboard  | `public/jobs.html`      | View all jobs with filters and search                       |
| Portfolio       | `public/portfolio.html` | Showcase completed projects                                 |
| Contact         | `public/contact.html`   | Contact form with interactive map                           |

### Admin Sub-Views (in `public/views/`)

| View                | File                         | Purpose                                   |
| ------------------- | ---------------------------- | ----------------------------------------- |
| Dashboard           | `views/dashboard.html`       | Stats widgets, charts, revenue overview   |
| Service Tickets     | `views/tickets.html`         | Job dispatch, edit, cancel with PDF print |
| Customer Management | `views/amc.html`             | Client CRUD, AMC contract tracking        |
| Inventory           | `views/inventory.html`       | Stock batches, pricing, device catalog    |
| Cash Safe Ledger    | `views/currency.html`        | USD/MMK balances, transaction log         |
| Dispatch Map        | `views/dispatch-map.html`    | Live field map with Leaflet.js            |
| Reports             | `views/reports.html`         | Operational & financial analytics         |
| AI Copilot          | `views/ai-copilot.html`      | Auto-dispatch, route optimization, chat   |
| Warranty & RMA      | `views/warranty.html`        | Customer warranties, distributor RMA      |
| Distributors        | `views/distributors.html`    | Procurement channels directory            |
| Service Fees        | `views/service-fees.html`    | Rate card management                      |
| User Management     | `views/user-management.html` | Technician account administration         |
| System Settings     | `views/system-settings.html` | Backup/restore, exchange rate config      |

---

## API Endpoints

All endpoints are served from Cloudflare Worker at `/api/...`

### Authentication

| Method | Route                      | Description              |
| ------ | -------------------------- | ------------------------ |
| POST   | `/api/auth/login`          | Technician PIN login     |
| POST   | `/api/auth/google`         | Google OAuth sign-in     |
| POST   | `/api/auth/login-password` | Username/password login  |
| POST   | `/api/auth/logout`         | Logout                   |
| GET    | `/api/auth/profile`        | Get current user profile |
| POST   | `/api/auth/verify`         | Verify JWT token         |
| PUT    | `/api/technicians/:id/pin` | Change security PIN      |

### Jobs Management

| Method | Route                  | Description              |
| ------ | ---------------------- | ------------------------ |
| GET    | `/api/jobs`            | Fetch all jobs (filters) |
| GET    | `/api/jobs/active`     | Get active jobs          |
| GET    | `/api/jobs/calendar`   | Jobs for calendar view   |
| GET    | `/api/jobs/receipt`    | Job receipt data         |
| GET    | `/api/jobs/:id`        | Get job details          |
| POST   | `/api/jobs`            | Create new job           |
| PUT    | `/api/jobs/:id`        | Update job               |
| DELETE | `/api/jobs/:id`        | Delete job               |
| POST   | `/api/jobs/:id/status` | Update job status        |

### Inventory Management

| Method | Route                       | Description        |
| ------ | --------------------------- | ------------------ |
| GET    | `/api/inventory`            | List inventory     |
| GET    | `/api/inventory/:id`        | Get inventory item |
| POST   | `/api/inventory`            | Add inventory      |
| PUT    | `/api/inventory/:id`        | Update inventory   |
| DELETE | `/api/inventory/:id`        | Delete inventory   |
| POST   | `/api/inventory/:id/adjust` | Adjust stock       |
| GET    | `/api/inventory/low-stock`  | Low stock items    |
| GET    | `/api/inventory/categories` | Categories         |

### Admin Inventory

| Method | Route                                 | Description      |
| ------ | ------------------------------------- | ---------------- |
| GET    | `/api/admin/inventory/list`           | Admin inventory  |
| GET    | `/api/admin/inventory/batches`        | List batches     |
| GET    | `/api/admin/inventory/categories`     | Admin categories |
| GET    | `/api/admin/inventory/sub-categories` | Admin sub-cats   |
| GET    | `/api/admin/inventory/brands`         | Admin brands     |
| GET    | `/api/admin/inventory/units`          | Admin units      |
| GET    | `/api/admin/warranty/list`            | Warranty list    |
| GET    | `/api/admin/rma/list`                 | RMA list         |
| POST   | `/api/admin/inventory/catalog/price`  | Update prices    |
| POST   | `/api/admin/inventory/batches/create` | Create batch     |
| POST   | `/api/admin/inventory/batches/edit`   | Edit batch       |
| POST   | `/api/admin/inventory/add`            | Add inventory    |
| POST   | `/api/admin/inventory/delete`         | Delete inventory |

### Batches & Serials

| Method | Route                 | Description   |
| ------ | --------------------- | ------------- |
| GET    | `/api/batches`        | List batches  |
| POST   | `/api/batches`        | Create batch  |
| PUT    | `/api/batches/:id`    | Update batch  |
| GET    | `/api/serials`        | List serials  |
| POST   | `/api/serials/verify` | Verify serial |

### Invoices & POS

| Method | Route                          | Description    |
| ------ | ------------------------------ | -------------- |
| GET    | `/api/invoices`                | List invoices  |
| POST   | `/api/invoices`                | Create invoice |
| PUT    | `/api/invoices/:id/pay`        | Mark as paid   |
| POST   | `/api/invoices/:id/save-drive` | Save to Drive  |
| POST   | `/api/pos/checkout`            | POS checkout   |
| GET    | `/api/pos/sales`               | POS sales list |
| GET    | `/api/pos/credits`             | POS credits    |

### Service Fees

| Method | Route                            | Description       |
| ------ | -------------------------------- | ----------------- |
| GET    | `/api/service-fees`              | List service fees |
| POST   | `/api/service-fees`              | Create fee        |
| PUT    | `/api/service-fees/:id`          | Update fee        |
| DELETE | `/api/service-fees/:id`          | Delete fee        |
| POST   | `/api/admin/service-fees/manage` | Admin manage      |

### Cash Safe

| Method | Route                          | Description        |
| ------ | ------------------------------ | ------------------ |
| GET    | `/api/cash-safe/balance`       | Get balances       |
| GET    | `/api/cash-safe/transactions`  | List transactions  |
| POST   | `/api/cash-safe/deposit`       | Deposit            |
| POST   | `/api/cash-safe/withdraw`      | Withdraw           |
| GET    | `/api/admin/cash/safe`         | Admin cash safe    |
| GET    | `/api/admin/cash/transactions` | Admin transactions |
| POST   | `/api/admin/cash/transact`     | Admin transact     |

### Attendance

| Method | Route                       | Description       |
| ------ | --------------------------- | ----------------- |
| POST   | `/api/attendance/clock-in`  | Clock in          |
| POST   | `/api/attendance/clock-out` | Clock out         |
| GET    | `/api/attendance`           | List attendance   |
| GET    | `/api/attendance/status`    | Attendance status |

### Distributors

| Method | Route                   | Description        |
| ------ | ----------------------- | ------------------ |
| GET    | `/api/distributors`     | List distributors  |
| POST   | `/api/distributors`     | Create distributor |
| PUT    | `/api/distributors/:id` | Update distributor |
| DELETE | `/api/distributors/:id` | Delete distributor |

### Expenses

| Method | Route                       | Description     |
| ------ | --------------------------- | --------------- |
| GET    | `/api/expenses`             | List expenses   |
| POST   | `/api/expenses`             | Create expense  |
| PUT    | `/api/expenses/:id/approve` | Approve expense |
| PUT    | `/api/expenses/:id/reject`  | Reject expense  |

### RMA & Warranty

| Method | Route                 | Description       |
| ------ | --------------------- | ----------------- |
| GET    | `/api/rma`            | List RMA          |
| POST   | `/api/rma`            | Create RMA        |
| PUT    | `/api/rma/:id/status` | Update RMA status |
| GET    | `/api/warranty/check` | Check warranty    |

### Reports

| Method | Route                    | Description      |
| ------ | ------------------------ | ---------------- |
| GET    | `/api/reports/dashboard` | Dashboard report |
| GET    | `/api/reports/jobs`      | Jobs report      |
| GET    | `/api/reports/revenue`   | Revenue report   |
| GET    | `/api/reports/export`    | Export report    |

### AI Features

| Method | Route                    | Description           |
| ------ | ------------------------ | --------------------- |
| POST   | `/api/ai/polish-notes`   | Polish notes with AI  |
| POST   | `/api/ai/auto-dispatch`  | AI auto-dispatch      |
| POST   | `/api/ai/route-optimize` | AI route optimization |
| POST   | `/api/ai/copilot`        | AI copilot chat       |
| POST   | `/api/ai/transcribe`     | Transcribe audio      |

### Admin

| Method | Route                          | Description         |
| ------ | ------------------------------ | ------------------- |
| GET    | `/api/admin/lookups`           | Admin lookups       |
| GET    | `/api/admin/technicians`       | Admin tech list     |
| PUT    | `/api/admin/technicians/:id`   | Admin update tech   |
| DELETE | `/api/admin/technicians/:id`   | Admin delete tech   |
| GET    | `/api/admin/clients`           | Admin client list   |
| GET    | `/api/admin/config/:key`       | Get config          |
| POST   | `/api/admin/config`            | Set config          |
| GET    | `/api/admin/roles`             | List roles          |
| POST   | `/api/admin/roles`             | Create role         |
| DELETE | `/api/admin/roles/:id`         | Delete role         |
| POST   | `/api/admin/backup`            | Trigger backup      |
| POST   | `/api/admin/restore`           | Restore backup      |
| GET    | `/api/admin/stats`             | Admin stats         |
| GET    | `/api/landing-page`            | Get landing page    |
| POST   | `/api/landing-page`            | Update landing page |
| POST   | `/api/admin/hq-config`         | HQ config           |
| POST   | `/api/admin/jobs/ai-polish`    | AI polish job notes |
| POST   | `/api/admin/ai/chat-data`      | AI chat data        |
| POST   | `/api/admin/ai/route-optimize` | AI route optimize   |
| POST   | `/api/admin/ai/auto-dispatch`  | AI auto dispatch    |
| POST   | `/api/admin/ai/transcribe`     | AI transcribe       |
| GET    | `/api/jobs/receipt`            | Job receipt         |
| GET    | `/api/portal/history`          | Portal history      |

### Public

| Method | Route                        | Description    |
| ------ | ---------------------------- | -------------- |
| POST   | `/api/public/contact`        | Contact form   |
| GET    | `/api/public/exchange-rate`  | Exchange rate  |
| GET    | `/api/public/serials`        | Public serials |
| GET    | `/api/public/technician/:id` | Public tech    |
| GET    | `/api/public/landing`        | Public landing |
| GET    | `/api/public/service-fees`   | Public fees    |

### Google & Maps

| Method | Route                             | Description      |
| ------ | --------------------------------- | ---------------- |
| POST   | `/api/auth/google`                | Google auth      |
| POST   | `/api/auth/login-password`        | Password login   |
| GET    | `/api/auth/google/drive-url`      | Drive URL        |
| GET    | `/api/auth/google/drive-callback` | Drive callback   |
| GET    | `/api/admin/resolve-coords`       | Resolve coords   |
| POST   | `/api/resolve-maps-url`           | Resolve Maps URL |

### Telegram

| Method | Route                   | Description      |
| ------ | ----------------------- | ---------------- |
| POST   | `/api/telegram/webhook` | Telegram webhook |
| POST   | `/api/telegram/send`    | Send message     |

### Landing Page Admin

| Method | Route                    | Description        |
| ------ | ------------------------ | ------------------ |
| GET    | `/api/admin/landing`     | Admin landing list |
| POST   | `/api/admin/landing`     | Create landing     |
| PUT    | `/api/admin/landing/:id` | Update landing     |
| DELETE | `/api/admin/landing/:id` | Delete landing     |

---

## Database Schema

### Tables (14)

Defined in `db/migrations/schema.sql`

#### technicians

| Column      | Type    | Description                 |
| ----------- | ------- | --------------------------- |
| id          | TEXT    | Primary key                 |
| name        | TEXT    | Full name                   |
| nickname    | TEXT    | Display name                |
| role        | TEXT    | Sales/Technician/Admin      |
| phone       | TEXT    | Phone number                |
| active      | INTEGER | 1=active, 0=inactive        |
| email       | TEXT    | Email address               |
| username    | TEXT    | Login username              |
| password    | TEXT    | Login password              |
| pin         | TEXT    | Security PIN (default 1234) |
| photo       | TEXT    | Profile photo (base64)      |
| last_login  | TEXT    | Last login timestamp        |
| permissions | TEXT    | read / read_write           |

#### clients

| Column         | Type | Description                               |
| -------------- | ---- | ----------------------------------------- |
| id             | TEXT | Primary key                               |
| company_name   | TEXT | Company name                              |
| contact_person | TEXT | Contact person                            |
| address        | TEXT | Address                                   |
| phone          | TEXT | Phone number                              |
| amc_start      | TEXT | AMC start date                            |
| amc_end        | TEXT | AMC end date                              |
| amc_status     | TEXT | Active/Inactive/Expired/No AMC/Individual |

#### service_records

| Column           | Type | Description                                  |
| ---------------- | ---- | -------------------------------------------- |
| id               | TEXT | Primary key (job ID)                         |
| client_id        | TEXT | FK to clients                                |
| technician_id    | TEXT | FK to technicians                            |
| service_type     | TEXT | CCTV/Networking/WiFi/NAS/General Maintenance |
| status           | TEXT | Pending/In Progress/Completed/Cancelled      |
| job_description  | TEXT | Job description                              |
| technician_notes | TEXT | Tech notes                                   |
| equipment_used   | TEXT | Equipment used                               |
| before_photo     | TEXT | Before photo URL                             |
| after_photo      | TEXT | After photo URL                              |
| arrival_time     | TEXT | Arrival timestamp                            |
| completion_time  | TEXT | Completion timestamp                         |
| arrival_lat      | REAL | Arrival latitude                             |
| arrival_lng      | REAL | Arrival longitude                            |
| completion_lat   | REAL | Completion latitude                          |
| completion_lng   | REAL | Completion longitude                         |
| maps_url         | TEXT | Google Maps URL                              |
| signature        | TEXT | Customer signature                           |
| checklist_data   | TEXT | JSON checklist data                          |
| created_at       | TEXT | Creation timestamp                           |
| updated_at       | TEXT | Last update timestamp                        |

#### inventory_stock

| Column         | Type    | Description    |
| -------------- | ------- | -------------- |
| item_code      | TEXT    | Primary key    |
| item_name      | TEXT    | Product name   |
| category       | TEXT    | Category       |
| stock_qty      | INTEGER | Stock quantity |
| unit_price     | REAL    | USD price      |
| unit_price_mmk | REAL    | MMK price      |
| batch_code     | TEXT    | Batch code     |
| buying_price   | REAL    | Cost price     |

#### inventory_batches

| Column       | Type | Description           |
| ------------ | ---- | --------------------- |
| batch_code   | TEXT | Primary key           |
| item_code    | TEXT | FK to inventory_stock |
| buying_price | REAL | Cost price            |
| supplier     | TEXT | Supplier name         |
| created_at   | TEXT | Creation timestamp    |

#### inventory_items

| Column          | Type    | Description                                      |
| --------------- | ------- | ------------------------------------------------ |
| serial_number   | TEXT    | Primary key                                      |
| device_name     | TEXT    | Device name                                      |
| client_id       | TEXT    | FK to clients                                    |
| installed_date  | TEXT    | Installation date                                |
| warranty_months | INTEGER | Warranty period                                  |
| status          | TEXT    | Active/Defective/RMA Sent/RMA Completed/Replaced |
| distributor     | TEXT    | Distributor name                                 |
| rma_tracking_id | TEXT    | RMA tracking ID                                  |
| job_id          | TEXT    | FK to service_records                            |
| batch_code      | TEXT    | FK to inventory_batches                          |

#### stock_code_map

| Column         | Type | Description         |
| -------------- | ---- | ------------------- |
| new_stock_code | TEXT | New stock code      |
| old_stock_code | TEXT | Old stock code (PK) |

#### cash_safes

| Column      | Type    | Description |
| ----------- | ------- | ----------- |
| id          | INTEGER | Primary key |
| usd_balance | REAL    | USD balance |
| mmk_balance | REAL    | MMK balance |

#### cash_transactions

| Column            | Type    | Description           |
| ----------------- | ------- | --------------------- |
| id                | INTEGER | Primary key           |
| job_id            | TEXT    | FK to service_records |
| transaction_type  | TEXT    | Deposit/Withdrawal    |
| primary_currency  | TEXT    | USD/MMK               |
| amount            | REAL    | Transaction amount    |
| exchange_rate     | REAL    | Exchange rate         |
| equivalent_amount | REAL    | Equivalent amount     |
| notes             | TEXT    | Transaction notes     |
| created_at        | TEXT    | Creation timestamp    |
| receive_mmk       | INTEGER | 1=receive MMK         |
| linked_batch      | TEXT    | Linked batch code     |

#### service_fees

| Column       | Type    | Description  |
| ------------ | ------- | ------------ |
| id           | INTEGER | Primary key  |
| service_type | TEXT    | Service type |
| fee_amount   | REAL    | Fee amount   |
| currency     | TEXT    | USD/MMK      |
| description  | TEXT    | Description  |

#### system_config

| Column       | Type | Description  |
| ------------ | ---- | ------------ |
| config_key   | TEXT | Primary key  |
| config_value | TEXT | Config value |

---

## Design System

### Colors

| Color            | Value     | Usage              |
| ---------------- | --------- | ------------------ |
| Background       | Slate 950 | Primary background |
| Surface Low      | White/2%  | Table rows, cards  |
| Surface Mid      | White/4%  | Active tabs, forms |
| Border Soft      | White/6%  | Standard borders   |
| Border Active    | White/15% | Focus/Active       |
| Accent Primary   | Amber 500 | Primary buttons    |
| Accent Secondary | Sky 500   | Secondary actions  |
| Error            | Rose 500  | Delete/Cancel      |

### Typography

| Element  | Font              | Weight  |
| -------- | ----------------- | ------- |
| Headings | Plus Jakarta Sans | 700-800 |
| Body     | Plus Jakarta Sans | 400-500 |
| Labels   | Plus Jakarta Sans | 600-700 |
| Code     | SF Mono, Consolas | 400     |

### Components

| Component        | Description                      |
| ---------------- | -------------------------------- |
| Glass Panel      | Frosted glass with backdrop-blur |
| Status Badge     | Color-coded status indicators    |
| Form Input       | Dark background with amber focus |
| Button Primary   | Amber gradient with hover effect |
| Button Secondary | Transparent with border          |
| Modal            | Full-screen overlay with blur    |
| Toast            | Notification popup               |
| Data Table       | Striped rows with hover          |

### Libraries

| Library         | Version | Purpose           |
| --------------- | ------- | ----------------- |
| Tailwind CSS    | 4.3.2   | Utility-first CSS |
| Leaflet.js      | 1.9.4   | Interactive maps  |
| Chart.js        | Latest  | Analytics charts  |
| jsPDF           | 2.5.1   | PDF generation    |
| FullCalendar    | 6.1.8   | Event scheduling  |
| Google Identity | Latest  | OAuth sign-in     |

---

## Deployment Guides

### 1. Cloudflare Workers (Primary)

#### Prerequisites

- Cloudflare account
- Node.js 18+
- Wrangler CLI

#### Step 1: Install Wrangler

```bash
npm install -g wrangler
```

#### Step 2: Login to Cloudflare

```bash
wrangler login
```

#### Step 3: Create D1 Database

```bash
wrangler d1 create cctv-fsm-db
```

Note the database ID from the output.

#### Step 4: Update wrangler.toml

```toml
name = "cctv-service-system"
main = "src/index.ts"
compatibility_date = "2026-07-04"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cctv-fsm-db"
database_id = "YOUR_DATABASE_ID"

[vars]
GOOGLE_CLIENT_ID = "your-google-client-id"
ADMIN_EMAIL = "your-email@gmail.com"
JWT_SECRET = "your-jwt-secret"

[triggers]
crons = ["0 0 * * *"]

[ai]
binding = "AI"

[assets]
directory = "./public"
```

#### Step 5: Initialize Database (Local)

```bash
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql
```

#### Step 6: Set Secrets

```bash
wrangler secret put JWT_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REFRESH_TOKEN
wrangler secret put GOOGLE_DRIVE_FOLDER_ID
```

#### Step 7: Deploy

```bash
wrangler deploy
```

#### Step 8: Deploy Frontend (Cloudflare Pages)

```bash
npx wrangler pages deploy public --project-name=awesomemyanmar
```

#### Step 9: Configure Custom Domain (Optional)

1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Go to Settings > Triggers > Custom Domains
4. Add your domain

#### Step 10: Set Up Telegram Webhook

```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -d "url=https://cctv-service-system.nyinyimin2007.workers.dev/api/telegram/webhook"
```

---

### 2. Local Development Only

This project follows a **local-first development** approach. See [Local-First Development](#local-first-development) below.

---

## Configuration

### Environment Variables

| Variable               | Description                 | Required | Location             |
| ---------------------- | --------------------------- | -------- | -------------------- |
| TELEGRAM_BOT_TOKEN     | Telegram bot token          | Yes      | `.dev.vars` / Secret |
| TELEGRAM_CHAT_ID       | Telegram chat ID            | Yes      | `.dev.vars` / Secret |
| GEMINI_API_KEY         | Gemini AI API key           | Yes      | `.dev.vars` / Secret |
| GOOGLE_CLIENT_ID       | Google OAuth client ID      | Yes      | `wrangler.toml`      |
| GOOGLE_CLIENT_SECRET   | Google OAuth client secret  | Yes      | Secret               |
| GOOGLE_REFRESH_TOKEN   | Google OAuth refresh token  | Yes      | Secret               |
| GOOGLE_DRIVE_FOLDER_ID | Google Drive folder ID      | Yes      | Secret               |
| ADMIN_EMAIL            | Admin email for Google auth | Yes      | `wrangler.toml`      |
| JWT_SECRET             | JWT signing secret          | Yes      | Secret               |

### Local Development (`.dev.vars`)

Create `.dev.vars` in project root:

```env
TELEGRAM_BOT_TOKEN="your-telegram-bot-token"
TELEGRAM_CHAT_ID="your-telegram-chat-id"
GEMINI_API_KEY="your-gemini-api-key"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REFRESH_TOKEN="your-google-refresh-token"
GOOGLE_DRIVE_FOLDER_ID="your-drive-folder-id"
```

### Default Credentials (Seeded in mock_data.sql)

| Type                | Username     | Password/PIN  |
| ------------------- | ------------ | ------------- |
| Admin               | admin        | AdminPass123! |
| Test Technician     | tech1        | tech123!      |
| Test Technician PIN | TECH-KRUDXID | 1234          |

---

## Local-First Development

This project enforces **local-only development**. Do NOT deploy to Cloudflare until explicitly requested.

### Rules

1. **Always run locally** using `npm run dev` (Wrangler dev server)
2. **Never run** `wrangler deploy` or `npm run deploy` unless user says "deploy cloudflare"
3. **Test locally** with local D1 database and `.dev.vars`
4. **Verify changes** locally before any deployment consideration

### Local Dev Commands

```bash
# Start dev server (local D1, local assets)
npm run dev

# Build CSS
npm run build:css

# Watch CSS
npm run watch:css

# Run tests
npm run test

# Format code
npm run format
```

### Local Database

```bash
# Apply schema
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql

# Seed mock data
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql
```

---

## D1 Database Sync & Migrations (Critical)

When syncing database schema and data between local and remote Cloudflare D1 databases:

### 1. SQLITE_TOOBIG Limit (100KB)

Cloudflare D1 restricts single SQL statements to 100KB.

- Large tables (like `technicians` with base64 profiles) must have base64 image strings replaced with `NULL` during data migration/sync scripts.
- Bulk inserts must be split into individual `INSERT OR IGNORE` statement lines.

### 2. Foreign Key Dependencies

- Disable or drop remote tables in iterative dependency order (e.g., drop child tables like `inventory_items` and `service_records` before parent tables like `clients` and `technicians` to avoid `SQLITE_CONSTRAINT` failures).
- Rebuild schema from `db/migrations/schema.sql` (and subsequent migrations like `create_roles_table.sql`, etc.) first, then perform the data import in exact parent-to-child order:
  `roles` → `clients` → `technicians` → `cash_safes` → `inventory_stock` → `inventory_batches` → `distributors` → `service_fees` → `system_config` → `landing_page` → `service_records` → `inventory_items` → `cash_transactions`

### 3. Missing Column Alignments

Always cross-reference table column structures between local SQLite and remote D1 schemas (e.g., check for `telegram_username` in `technicians`, `sub_category_id` in `inventory_stock`, and `quantity` in `inventory_batches`) and run `ALTER TABLE` to align them if missing.

---

## Frontend Inline JavaScript Security

- **Quotes and Newline Safety**: Never pass descriptive model names, descriptions, or addresses containing random characters, quotes, or newlines directly as string parameters in inline HTML event handlers (e.g., `onclick="editItem('${item.name}')"`). This causes `SyntaxError: Invalid or unexpected token`.
- **Lookup Pattern**: Pass only clean, alphanumeric identifier codes (e.g., `item_code` SKU) and perform the object lookup within the JavaScript function block from an in-memory data array (e.g., `activeCatalogList.find()`).

---

## Authentication & Security Quirks

1. **Content Security Policy (CSP)**:
   - Cloudflare Pages enforces a strict CSP in `public/_headers`.
   - If UI components (like `fonts.gstatic.com` or third-party scripts) fail to load, check the `connect-src` or `script-src` directives in `_headers`.

2. **Technician PIN Hashing**:
   - The local database (`local_dump.sql` / seed data) stores technician PINs in plain text (e.g., `'1234'`).
   - The `/api/auth/login` endpoint's `verifyPin` function in `src/modules/routes/auth.ts` must support plain-text string matching fallback (`plainPin === storedHash`) before attempting bcrypt/SHA-256 checks, otherwise valid local logins will be rejected.

3. **QR Code Dependencies**:
   - Do NOT use `cdn.jsdelivr.net` for `qrcode.min.js`, as their build paths often break. Use `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`.

4. **Google Identity Services (GSI)**:
   - If the Google Sign-In button fails with a `403 Forbidden` (`[GSI_LOGGER]`), the current testing origin (e.g., `http://127.0.0.1:8787`) must be manually added to the **Authorized JavaScript origins** in the Google Cloud Console. This cannot be bypassed through code.

---

## File Structure

```
cctv-service-system/
├── .dev.vars                # Local environment variables (secrets)
├── wrangler.toml            # Cloudflare Worker configuration
├── src/
│   ├── index.ts             # Main Worker entry point
│   ├── modules/
│   │   ├── routes/          # Route modules (auth, technicians, clients, jobs, etc.)
│   │   └── utils/           # Utilities (router, cors, jwt, telegram, google, etc.)
│   └── types/
│       └── schema.ts        # TypeScript types for database schema
├── public/
│   ├── app.html             # Technician UI
│   ├── app.js               # Technician UI logic
│   ├── admin.html           # Admin dashboard
│   ├── admin.js             # Admin dashboard logic
│   ├── tailwind.css         # Compiled Tailwind CSS
│   ├── input.css            # Tailwind input CSS
│   ├── manifest.json        # PWA manifest
│   ├── sw.js                # Service worker
│   ├── _headers             # Cloudflare headers config
│   └── views/               # Admin sub-views (dashboard, tickets, inventory, etc.)
├── db/
│   ├── migrations/          # SQL migrations (schema.sql, mock_data.sql, etc.)
│   └── seeds/               # Seed data files
├── functions/
│   └── api/
│       └── [[path]].js      # Cloudflare Pages API proxy
├── schema.sql               # Legacy schema (use db/migrations/schema.sql)
├── AGENTS.md                # AI agent configuration
├── .agents/
│   ├── AGENTS.md            # Project rules
│   └── skills/
│       ├── telegram-bot/
│       │   └── SKILL.md     # Telegram bot integration
│       ├── cloudflare-polling-limits/
│       │   └── SKILL.md     # Cloudflare usage limits
│       ├── cloudflare-local-first/
│       │   └── SKILL.md     # Local-first development
│       ├── cms-assistant/
│       │   └── SKILL.md     # Client management assistant
│       └── ui-layout-guidance/
│           └── SKILL.md     # UI layout guidelines
├── exchange_token.js        # Google OAuth callback helper
├── package.json             # Project dependencies
├── design.md                # Design system documentation
├── docs/                    # Additional documentation
└── src-tauri/               # Tauri desktop app config
```

---

_Documentation updated: 2026-07-19_
