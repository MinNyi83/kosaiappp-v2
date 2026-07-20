# Project Rules

## Local Development and Cloudflare Deployment

- Always run, develop, and test the project in the local environment (e.g. using `npx wrangler dev`).
- Do NOT deploy to Cloudflare until the user explicitly requests it with **"deploy cloudflare"** or **"deploy to cloudflare"**.
- When deploying Cloudflare Pages, always target the project name `awesomemyanmar` using command: `npx wrangler pages deploy public --project-name=awesomemyanmar`.

# AI Agents System Documentation

## 🏗 Overview

This project uses AI agents to provide intelligent assistance for field service management. The system features a technician UI (`public/app.html`, `public/app.js`), an admin dashboard (`public/admin.html`, `public/admin.js`), and a modular Cloudflare Worker backend (`src/index.ts`, `src/modules/routes/`). The core architecture uses a **modular router pattern** with domain-specific route modules.

## 🧩 Key Components

### 1. **Field Service Worker Backend**

**Location**: `src/index.ts`, `src/modules/routes/`, `wrangler.toml`

**Features**:

- Cloudflare Worker API endpoints for job management, technician dispatch, client profiles, and service scheduling
- D1 database for persistent storage
- AI integration using Gemini API for ticket triaging and dispatch matching
- Telegram bot webhook integration (`/api/telegram-webhook`)
- **Google Drive Storage Integration (OAuth User Consent - Option B)**: Automated upload of site photos (`before_photo` and `after_photo`) into organized subfolders on the admin's personal Google Drive without requiring technicians to have Gmail accounts.
- **Modular Route Architecture**: Each domain (auth, technicians, clients, jobs, inventory, invoices, etc.) registers routes via a `register(router, env)` function in `src/modules/routes/`

**Key Modules** (`src/modules/routes/`):

- `auth.ts` - Authentication (login, PIN, Google OAuth)
- `technicians.ts` - Technician CRUD & management
- `clients.ts` - Client CRUD & AMC tracking
- `jobs.ts` - Service records & job management
- `inventory.ts` - Stock, batches, items, catalog
- `invoices.ts` - Invoice generation & management
- `expenses.ts` - Expense tracking
- `attendance.ts` - Technician attendance
- `reports.ts` - Dynamic report builder
- `admin.ts` - Admin dashboard data
- `ai.ts` - AI dispatch & diagnostics
- `telegram.ts` - Telegram bot webhook
- `batches.ts`, `rma.ts`, `distributors.ts`, `cashsafe.ts`, `servicefees.ts`, `landing.ts`

**Utility Modules** (`src/modules/utils/`):

- `router.ts` - Lightweight request router
- `cors.ts`, `response.ts` - HTTP helpers
- `jwt.ts` - JWT token management
- `telegram.ts`, `viber.ts`, `google.ts`, `gemini.ts` - External service integrations
- `rate-limit.ts`, `sql-validator.ts` - Security utilities

### 2. **Main UI (Technician Mobile Console)**

**Location**: `public/app.html`, `public/app.js`

**Features**:

- Technician dashboard for viewing assigned jobs, starting/completing services, uploading photos, and logging time
- AI Chat interface with Gemini API for AI assistant support
- Push notifications for new job assignments
- Ticket history and service checklist management

### 3. **Admin Dashboard**

**Location**: `public/admin.html`, `public/admin.js`

**Features**:

- Full admin interface for system management
- Client management (create, edit, delete)
- Technician management (create, edit, delete, assign)
- Job management (create, assign, monitor, complete)
- Service fee management
- Service report generation
- Cash safe reconciliation

## 📋 System Setup

### Prerequisites

- Node.js and npm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with KV and D1 database support

### Environment Configuration

Create a `.dev.vars` file in the project root with the following variables:

```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
GEMINI_API_KEY="your_gemini_api_key"
ADMIN_SECRET="your_admin_secret"

# Google OAuth Credentials (Option B)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REFRESH_TOKEN="your_google_refresh_token"
GOOGLE_DRIVE_FOLDER_ID="your_google_drive_folder_id"
```

### Google Drive Setup & Auth (One-Time Setup)

1. Configure credentials under Google Cloud Console OAuth Client ID.
2. Add Authorized Redirect URI: `https://cctv-service-system.nyinyimin2007.workers.dev/api/auth/google/drive-callback` (production) or `http://127.0.0.1:8787/api/auth/google/drive-callback` (local).
3. Publish App on the OAuth Consent Screen (or add test user `nyinyimin2007@gmail.com`).
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Cloudflare secrets (or `.dev.vars` for local).
5. Visit `/api/auth/google/drive-url` to get the OAuth authorization URL.
6. Complete the OAuth consent in your browser — the refresh token is automatically stored in the `system_config` database table.
7. No need to manually copy refresh tokens to environment variables.

### Database Setup

1. Create a D1 database: `wrangler d1 create cctv-fsm-db`
2. Run schema migration: `npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql`
3. Seed mock data: `npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql`
4. Update `wrangler.toml` with your database ID and name

### Local Development

Run the development server: `npx wrangler dev`

### Production Deployment

Deploy to Cloudflare Workers: `npx wrangler deploy`

## 📂 File Structure

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
│   └── views/               # Admin view partials (dashboard, jobs, inventory, etc.)
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

## ⚙️ API Endpoints

### Google Drive Setup Flow

- `GET /api/auth/google/drive-url`: Returns OAuth authorization URL
- `GET /api/auth/google/drive-callback`: Handles OAuth callback, stores refresh token in `system_config` table
- `GET /api/debug-gdrive`: Debug endpoint to verify Drive connection and token validity

### Authentication

- `POST /api/auth/login`: Technician login (PIN/password)
- `POST /api/auth/verify`: Verify JWT token
- `POST /api/auth/logout`: Logout
- `GET /api/auth/profile`: Get current user profile
- `PUT /api/technicians/:id/pin`: Change technician PIN

### Job Management

- `GET /api/jobs`: List jobs (with filters: status, technician_id, client_id, date_from, date_to, search)
- `GET /api/jobs/active`: Get active jobs
- `GET /api/jobs/calendar`: Get jobs for calendar view
- `GET /api/jobs/receipt`: Generate job receipt
- `GET /api/jobs/:id`: Get job details
- `POST /api/jobs`: Create new job
- `PUT /api/jobs/:id`: Update job
- `DELETE /api/jobs/:id`: Delete job
- `POST /api/jobs/:id/status`: Update job status

### Technician Management

- `GET /api/technicians`: List technicians
- `GET /api/technicians/:id`: Get technician details
- `POST /api/technicians`: Create technician
- `PUT /api/technicians/:id`: Update technician
- `DELETE /api/technicians/:id`: Delete technician

### Client Management

- `GET /api/clients`: List clients
- `GET /api/clients/:id`: Get client details
- `POST /api/clients`: Create client
- `PUT /api/clients/:id`: Update client
- `DELETE /api/clients/:id`: Delete client

### Inventory Management

- `GET /api/inventory`: List inventory items
- `GET /api/inventory/:id`: Get inventory item
- `POST /api/inventory`: Add inventory item
- `PUT /api/inventory/:id`: Update inventory item
- `DELETE /api/inventory/:id`: Delete inventory item
- `POST /api/inventory/:id/adjust`: Adjust stock quantity
- `GET /api/inventory/low-stock`: Get low stock items
- `GET /api/inventory/categories`: Get categories

### Admin Inventory

- `GET /api/admin/inventory/list`: Admin inventory list
- `GET /api/admin/inventory/batches`: Admin batch list
- `GET /api/admin/inventory/categories`: Admin categories
- `GET /api/admin/inventory/sub-categories`: Admin sub-categories
- `GET /api/admin/inventory/brands`: Admin brands
- `GET /api/admin/inventory/units`: Admin units
- `GET /api/admin/warranty/list`: Warranty list
- `GET /api/admin/rma/list`: RMA list
- `POST /api/admin/inventory/catalog/price`: Set catalog price
- `POST /api/admin/inventory/batches/create`: Create batch
- `POST /api/admin/inventory/batches/edit`: Edit batch
- `POST /api/admin/inventory/add`: Add inventory (admin)
- `POST /api/admin/inventory/delete`: Delete inventory (admin)

### Batches & Serials

- `GET /api/batches`: List batches
- `POST /api/batches`: Create batch
- `PUT /api/batches/:id`: Update batch
- `GET /api/serials`: List serials
- `POST /api/serials/verify`: Verify serial

### Invoices & POS

- `GET /api/invoices`: List invoices
- `POST /api/invoices`: Create invoice
- `PUT /api/invoices/:id/pay`: Mark invoice as paid
- `POST /api/invoices/:id/save-drive`: Save invoice to Google Drive
- `POST /api/pos/checkout`: POS checkout
- `GET /api/pos/sales`: POS sales list
- `GET /api/pos/credits`: POS credits

### Service Fees

- `GET /api/service-fees`: List service fees
- `POST /api/service-fees`: Create service fee
- `PUT /api/service-fees/:id`: Update service fee
- `DELETE /api/service-fees/:id`: Delete service fee
- `POST /api/admin/service-fees/manage`: Admin manage service fees

### Cash Safe

- `GET /api/cash-safe/balance`: Get cash safe balance
- `GET /api/cash-safe/transactions`: List transactions
- `POST /api/cash-safe/deposit`: Deposit
- `POST /api/cash-safe/withdraw`: Withdraw
- `GET /api/admin/cash/safe`: Admin cash safe
- `GET /api/admin/cash/transactions`: Admin transactions
- `POST /api/admin/cash/transact`: Admin transact

### Attendance

- `POST /api/attendance/clock-in`: Clock in
- `POST /api/attendance/clock-out`: Clock out
- `GET /api/attendance`: List attendance
- `GET /api/attendance/status`: Attendance status

### Distributors

- `GET /api/distributors`: List distributors
- `POST /api/distributors`: Create distributor
- `PUT /api/distributors/:id`: Update distributor
- `DELETE /api/distributors/:id`: Delete distributor

### Expenses

- `GET /api/expenses`: List expenses
- `POST /api/expenses`: Create expense
- `PUT /api/expenses/:id/approve`: Approve expense
- `PUT /api/expenses/:id/reject`: Reject expense

### RMA & Warranty

- `GET /api/rma`: List RMA
- `POST /api/rma`: Create RMA
- `PUT /api/rma/:id/status`: Update RMA status
- `GET /api/warranty/check`: Check warranty

### Reports

- `GET /api/reports/dashboard`: Dashboard report
- `GET /api/reports/jobs`: Jobs report
- `GET /api/reports/revenue`: Revenue report
- `GET /api/reports/export`: Export report

### AI Features

- `POST /api/ai/polish-notes`: Polish job notes with AI
- `POST /api/ai/auto-dispatch`: AI auto-dispatch
- `POST /api/ai/route-optimize`: AI route optimization
- `POST /api/ai/copilot`: AI copilot chat
- `POST /api/ai/transcribe`: Transcribe audio

### Admin

- `GET /api/admin/lookups`: Admin lookups
- `GET /api/admin/technicians`: Admin technician list
- `PUT /api/admin/technicians/:id`: Admin update technician
- `DELETE /api/admin/technicians/:id`: Admin delete technician
- `GET /api/admin/clients`: Admin client list
- `GET /api/admin/config/:key`: Get config
- `POST /api/admin/config`: Set config
- `GET /api/admin/roles`: List roles
- `POST /api/admin/roles`: Create role
- `DELETE /api/admin/roles/:id`: Delete role
- `POST /api/admin/backup`: Trigger backup
- `POST /api/admin/restore`: Restore backup
- `GET /api/admin/stats`: Admin stats
- `GET /api/landing-page`: Get landing page
- `POST /api/landing-page`: Update landing page
- `POST /api/admin/hq-config`: HQ config
- `POST /api/admin/jobs/ai-polish`: AI polish job notes
- `POST /api/admin/ai/chat-data`: AI chat data
- `POST /api/admin/ai/route-optimize`: AI route optimize
- `POST /api/admin/ai/auto-dispatch`: AI auto dispatch
- `POST /api/admin/ai/transcribe`: AI transcribe
- `GET /api/jobs/receipt`: Job receipt
- `GET /api/portal/history`: Portal history

### Public

- `POST /api/public/contact`: Contact form
- `GET /api/public/exchange-rate`: Exchange rate
- `GET /api/public/serials`: Public serials
- `GET /api/public/technician/:id`: Public technician
- `GET /api/public/landing`: Public landing
- `GET /api/public/service-fees`: Public service fees

### Google & Maps

- `POST /api/auth/google`: Google auth
- `POST /api/auth/login-password`: Password login
- `GET /api/auth/google/drive-url`: Google Drive URL
- `GET /api/admin/resolve-coords`: Resolve coordinates
- `POST /api/resolve-maps-url`: Resolve Maps URL

### Telegram

- `POST /api/telegram/webhook`: Telegram webhook
- `POST /api/telegram/send`: Send Telegram message

### Landing Page Admin

- `GET /api/admin/landing`: Admin landing list
- `POST /api/admin/landing`: Admin create landing
- `PUT /api/admin/landing/:id`: Admin update landing
- `DELETE /api/admin/landing/:id`: Admin delete landing

## 🤖 AI Dispatching

The AI dispatch system automatically matches technicians to jobs based on issue description and technician skills. See `src/modules/routes/ai.ts` and `src/modules/routes/admin.ts` for implementation details.

**Example Prompt:**

```
"Based on this CCTV installation job at [Company Name], identify the best technician from the list:

[List of technicians with their skills and experience]

Choose the technician who is best suited for this job and provide a brief reason for your choice."
```

## 🔄 Real-time Updates

The system uses WebSocket connections to provide real-time updates for:

- New job assignments
- Job status changes
- Chat messages
- System notifications

## 📝 Database Schema

The complete schema is defined in `db/migrations/schema.sql`. Key tables include:

### Customers Table

```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  amc_status TEXT CHECK(amc_status IN ('Active', 'Inactive', 'Expired', 'No AMC', 'Individual')) DEFAULT 'Inactive',
  amc_start TEXT,
  amc_end TEXT
);
```

### Technicians Table

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

### Jobs Table

```sql
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
```

### Additional Tables

- **Inventory**: `inventory_stock`, `inventory_batches`, `inventory_items`, `stock_code_map`
- **Cash Management**: `cash_safes`, `cash_transactions`
- **Configuration**: `service_fees`, `system_config` (columns: `config_key`, `config_value`, `description`, `updated_by`, `updated_at`)

## 🤖 Telegram Bot System

The project integrates a Telegram bot dispatcher engine (`/api/telegram/webhook`) that interfaces with active technicians and dispatch coordinators.

### Webhook API Actions

- **`POST /api/telegram/webhook`**: Receives webhook payloads from the Telegram API.

### Webhook Features & Command Flow

1. **Slash Commands** (15+ commands):
   - `/start` - Welcome message
   - `/help` - Show all commands
   - `/clock` - Quick clock status summary
   - `/checkin` or `/clockin` - Clock in for today
   - `/checkout` or `/clockout` - Clock out
   - `/status` - Check clock-in status & active jobs
   - `/report` - Weekly attendance summary
   - `/team` - See who is currently clocked in
   - `/leaderboard` - Weekly hours leaderboard
   - `/history` - My clock-in/out history this week
   - `/jobs` - List your active jobs
   - `/completed` - List your completed jobs
   - `/today` - Show today's jobs & attendance
   - `/ticket JOB-xxx` - View job details
   - `/accept JOB-xxx` - Accept a job assignment
   - `/assign JOB-xxx TechName` - Assign technician
   - `/cancel JOB-xxx` - Cancel a job

2. **Inline Keyboards** (callback buttons):
   - `accept_job` - Accept job assignment
   - `complete_job` - Mark job as completed

3. **AI Voice Transcription & Auto-Dispatch**:
   - **Voice Messages**: Receives voice messages (`audio/ogg`), downloads via Telegram Bot API `getFile`, transcribes with Gemini `gemini-2.5-flash` using prompt: _"Transcribe this spoken technical issue or service complaint into plain English text. Do not summarize, output only the transcribed text."_
   - **Auto-Matcher**: Feeds transcribed text to Gemini to choose service domain (CCTV, Networking, WiFi, NAS, General Maintenance) and assign best technician based on skills or name/nickname mentions. Creates client and job records in D1 (`CLI-TG-...`, `JOB-TG-...`).
   - **Dispatch Confirmation**: Messages the Telegram dispatch group with assigned technician details and new Job ID.

4. **Photo Messages**:
   - Receives photos, downloads highest resolution, uploads to Google Drive via `uploadFileToGoogleDrive` (organized in `Awesome Myanmar - Service Records / {Client} / {JobID}/`).
   - Creates job record with `before_photo` pointing to Drive link.
   - Sends confirmation with job ID.

5. **Plain Text Messages**: Auto-creates job ticket from any text message.

### Outbound Notifications

The application triggers outbound alerts to the Telegram channel in these scenarios:

1. **Site Photos / Job Completion**:
   - Sends text and before/after photos during site uploads in `src/index.ts`.
   - **Photo Delivery Pipeline**: Instead of passing raw Google Drive URLs (which Telegram cannot download because they require authorization), the worker retrieves the binary stream from Google Drive using the OAuth refresh token, formats it, and transmits it directly via `sendTelegramPhotoNotification`.

2. **System Database Backups**:
   - Sends database backup logs automatically upon backup events (cron at midnight).

3. **Job Assignment Notifications**:
   - Notifies technicians when assigned to a job via `/assign` or `accept_job` callback.

## 📊 Executive Reporting System

The admin dashboard includes a **Dynamic Report Builder** matching modern SaaS aesthetics.

### Available Custom Reports:

- **Technician Performance Audit**: Compiles task completion rates, active ticket logs, and assigned loads by engineer.
- **Customer Service Audit**: Breaks down ticket history counts, AMC status, and total dollar-revenue contributed per client.
- **Job History Ledger**: Summarizes job types, technicians assigned, created dates, and current statuses in an audit grid.

### Timeframe Scopes:

- **Monthly**: This Month, Last Month
- **Yearly**: This Year, Last Year
- **Custom Relative**: Last 30 Days, Last 90 Days, All-Time Records

## 🤖 Gemini API Dual-Gateway Routing

To bypass local country geo-blocks (e.g. running from Myanmar) during local development (`npx wrangler dev`), the worker routes Gemini queries through a dual-gateway system:

1. **Primary Endpoint**: Direct query to `generativelanguage.googleapis.com` using the Google AI Studio project-scoped API key (`AQ...` or `AIzaSy...`).
2. **Fallback Proxy Endpoint**: If the primary endpoint fails due to location restrictions (status `400`/`403`), it automatically reroutes the query through `api.gemini.tams.tech` with key parameters passed securely in the query string (`?key=${apiKey}`).

## 🎨 UI Layout Guidelines

To maintain consistent user experience:

1. **Admin Console (`admin.html`)**: Recommended to use a **2-Column Tabbed Layout** for dashboard components like Client Management and Technician Management.
2. **Technician Mobile View (`app.html`)**: Avoid 2-column designs. Use a mobile-first single-column design with a bottom navigation bar.
3. **Inventory Management (`admin.html` -> `#view-inventory`)**: Uses a split sidebar layout featuring a left-hand module navigation (Stock Batches, Sales Pricing, Device Catalog, and Add forms) paired with compact, high-density data tables and detailed sliding drawer-style sub-elements (e.g. Serial grids).

## 📦 Stock & Sales Inventory System

The inventory module implements a Parent-Child batch architecture designed to split unit cost history from daily updated sales prices.

### 1. Database Schema

- **`inventory_stock`**: Stores the device catalog models and daily update prices (USD / MMK).
- **`inventory_batches`**: Stores the supply batch imports, purchase cost/unit, vendor details, and dates.
- **`inventory_items`**: Parent-child child table holding individual units with unique Serial Numbers linked to parent batches.

### 2. Layout Structure

- **Left Module Sidebar**: High-speed module switching (`switchInvModule`) between:
  - `batches`: High-density stock batch overview. Clicking a row expands serial cards.
  - `pricing`: Active sales price matrix. Supports quick edit popups.
  - `catalog`: Complete hardware item SKU registration catalog.
- **Quick Action Triggers**: Instant slide-to-form transitions for registering models, updating prices, and importing stock batches.
- **Bulk Serial Input**: Two-column add form with a live regex-based serial counter and barcode gun optimization.

## 🔐 Technician Security Settings & Field Actions

- **Access PIN Modifications (`/api/portal/change-pin`)**: Allows authenticated field technicians to update their security gate pass PIN directly from the mobile console.
- On-Site Sales/Replacement Picker: Dynamic select dropdowns populated automatically from the live database catalog display current device availability, warranty rules, and local pricing information (USD and MMK) directly in the field.

## 🖥️ Desktop Application Packaging (Tauri)

Tauri is used to compile the admin and technician consoles into a standalone Windows `.exe` installer.

- **Tauri Config**: Defined in `src-tauri/tauri.conf.json`.
- **Target Frontend Assets**: Build output is directed to read from `../public`.
- **Tauri Commands**: Use `npx tauri build` to compile the release installer.

## 🗄️ D1 Database Sync & Migrations

When syncing database schema and data between local and remote Cloudflare D1 databases, follow these rules:

1. **SQLITE_TOOBIG Limit (100KB)**: Cloudflare D1 restricts single SQL statements to 100KB.
   - Large tables (like `technicians` with base64 profiles) must have their base64 image strings replaced with `NULL` during data migration/sync scripts.
   - Bulk inserts must be split into individual `INSERT OR IGNORE` statement lines.
2. **Foreign Key Dependencies**:
   - Disable or drop remote tables in iterative dependency order (e.g. drop child tables like `inventory_items` and `service_records` before parent tables like `clients` and `technicians` to avoid `SQLITE_CONSTRAINT` failures).
   - Rebuild schema from `db/migrations/schema.sql` (and subsequent migrations like `create_roles_table.sql`, etc.) first, then perform the data import in exact parent-to-child order: `roles` -> `clients` -> `technicians` -> `cash_safes` -> `inv_categories` -> `inv_brands` -> `inv_stock_units` -> `inv_sub_categories` -> `inventory_stock` -> `inventory_batches` -> `distributors` -> `service_fees` -> `system_config` -> `landing_page` -> `service_records` -> `messages` -> `inventory_items` -> `cash_transactions`.
3. **Missing Column Alignments**: Always cross-reference table column structures between local SQLite and remote D1 schemas (e.g. check for `telegram_username` in `technicians`, `sub_category_id` in `inventory_stock`, and `quantity` in `inventory_batches`) and run `ALTER TABLE` to align them if missing.

## 🪟 Frontend Inline JavaScript Security

- **Quotes and Newline Safety**: Never pass descriptive model names, descriptions, or addresses containing random characters, quotes, or newlines directly as string parameters in inline HTML event handlers (e.g. `onclick="editItem('${item.name}')"`). This causes `SyntaxError: Invalid or unexpected token`.
- **Lookup Pattern**: Pass only clean, alphanumeric identifier codes (e.g. `item_code` SKU) and perform the object lookup within the JavaScript function block from an in-memory data array (e.g. `activeCatalogList.find()`).

## 🔐 Authentication & Security Quirks

When developing or debugging authentication flows in this project, remember the following critical quirks:

1. **Content Security Policy (CSP)**:
   - Cloudflare Pages enforces a strict CSP in `public/_headers`.
   - If UI components (like `fonts.gstatic.com` or third-party scripts) fail to load, check the `connect-src` or `script-src` directives in `_headers`.
2. **Technician PIN Hashing**:
   - The local database (`local_dump.sql` / seed data) stores technician PINs in plain text (e.g. `'1234'`).
   - The `/api/auth/login` endpoint's `verifyPin` function in `src/modules/routes/auth.ts` must support plain-text string matching fallback (`plainPin === storedHash`) before attempting bcrypt/SHA-256 checks, otherwise valid local logins will be rejected.
3. **QR Code Dependencies**:
   - Do NOT use `cdn.jsdelivr.net` for `qrcode.min.js`, as their build paths often break. Use `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js`.
4. **Google Identity Services (GSI)**:
   - If the Google Sign-In button fails with a `403 Forbidden` (`[GSI_LOGGER]`), the current testing origin (e.g., `http://127.0.0.1:8787`) must be manually added to the **Authorized JavaScript origins** in the Google Cloud Console. This cannot be bypassed through code.
