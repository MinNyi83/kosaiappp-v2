# KosAI CCTV & Infrastructure Platform

A **field service management system** for CCTV, networking, and storage infrastructure in Myanmar. Built on Cloudflare Workers with a dark-themed, glass-morphism UI. Supports native desktop and mobile apps with offline-first sync.

## Tech Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| **Backend**  | Cloudflare Workers (TypeScript, modular)   |
| **Database** | Cloudflare D1 (SQLite edge DB)             |
| **Frontend** | Vanilla HTML/CSS/JS + Tailwind CSS v4      |
| **Design**   | Dark/Light theme, glass morphism, amber accent |
| **Auth**     | Google OAuth, PIN-based, username/password |
| **Desktop**  | Tauri 2.0 (Rust + local SQLite)            |
| **Mobile**   | Kotlin + Jetpack Compose (Room + Retrofit) |
| **Sync**     | REST API + WebSocket + offline queue       |
| **CI/CD**    | Wrangler CLI                               |

## Recent Updates (v2.0)

### Major UI Overhaul (v2.0)
Complete redesign of all admin dashboard sections with modern, glass-morphism styled interface.

#### Dashboard
- **Today's Quick Stats** - Date, new jobs, completed, in progress
- **9 KPI Cards** - Primary and secondary metrics with hover effects
- **5 Charts** - Job Status, Service Types, Revenue Trend, Tech Performance, Monthly Trend
- **Activity Feed** - Real-time activity stream
- **Live Map & Calendar** - Dispatch tracking

#### Service Tickets
- **Pipeline Status Bar** - Pending/In Progress/Completed/Cancelled counts
- **Dual View** - Cards (visual) + Table (data-dense) with toggle
- **Smart Filters** - Search, domain, status, tech with clear button
- **Pagination** - Page numbers for large datasets
- **Ticket Detail Modal** - Info grid, timeline, description, notes, photos, equipment, checklist

#### Clients & Partners
- **Directory View** - Visual client cards with company initials
- **AMC Status Badges** - Color-coded contract status
- **Quick Actions** - View Jobs, Edit
- **Tabbed Interface** - Clients / Distributors

#### Inventory Management
- **Barcode Scanner** - Camera-based scanning with visual overlay
- **Product Grid** - Visual cards with stock indicators
- **Search & Filter** - By code, name, category, stock level
- **Import/Export Excel** - Bulk data operations

#### Receipt Builder
- **Template Selection** - Modern, Classic, Minimal designs
- **Paper Size** - A4, A5, Letter options
- **Theme** - Dark/Light mode
- **Alignment** - Left, Center, Right
- **Live Preview** - Real-time receipt preview

### Native Apps (v2.0)

#### Tauri Desktop (Windows)
- **Local SQLite** - Full offline access to jobs, clients, inventory
- **Auto-sync** - Every 5 minutes when online
- **Native notifications** - Job assignments, completions, messages
- **System tray** - Background monitoring
- **~5MB install** - Lightweight Rust backend

#### Android Technician App
- **Room database** - Offline job management
- **GPS clock in/out** - Location-stamped attendance
- **Material 3 UI** - Modern Compose design
- **Offline queue** - Changes sync when online
- **Dark/Light theme** - Follows system preference

### Sync Infrastructure
- **Bidirectional sync** - Cloud D1 ↔ local SQLite
- **Conflict resolution** - Last-write-wins (LWW)
- **Delta sync** - Only changed records transferred
- **Offline queue** - Operations queued for sync
- **WebSocket** - Real-time updates for connected clients

### Technical Improvements
- **Modular Architecture** - Service layer extraction with 6 service classes
- **143 Tests Passing** - Unit tests for all service classes
- **CSRF Protection** - HMAC-SHA256 token verification on all state-changing endpoints
- **Input Validation** - Parameterized queries, field allowlists, type checking
- **SheetJS Integration** - Client-side Excel generation
- **Chart.js Charts** - 5 chart types (doughnut, bar, line, horizontal bar, area)
- **Camera API** - Barcode scanning with WebRTC
- **LocalStorage Persistence** - Settings saved across sessions
- **Toast Notification System** - Non-blocking alerts
- **Glass Morphism Design** - Modern UI with blur effects

### Admin Module Upgrades (v2.1)
- **Attendance** - Icon header, 4 glass stat cards with colored accent bars, search, pagination, export CSV, GPS coordinates
- **Distributors** - Icon header, 4 stat cards (Total, Active, Product Lines, With Contact), SVG delete buttons
- **Dispatch Map** - SVG icons replacing emojis, theme selector, filter buttons with colored dots, active crews panel
- **Landing Page (Admin)** - SVG section icons (Hero, Stats, Services, Contact, Footer), consistent form styling
- **Portfolio** - SVG icons, View Live link, Add Project button, live preview with filter buttons
- **Reports** - 6 report tabs, KPI cards, date range filter, Chart.js integration
- **System Settings** - Company profile, users, system, receipt builder, database tabs
- **User Management** - Sidebar navigation, registered accounts, create user, roles
- **Currency** - Vault ledger, log transaction, sales ledger sidebar modules
- **POS** - Terminal checkout, credits, invoices sidebar modules
- **Inventory** - Batch management, pricing, catalog, add item, categories, brands sidebar

### Public Landing Page Upgrade (v2.1)
- **SVG Icons** - Replaced all emoji icons with SVG throughout header, footer, and sections
- **Why Choose Us** - New 4-column section: Licensed & Insured, 24/7 Support, AI-Powered, Myanmar Local
- **CTA Banner** - New gradient glass panel with dual action buttons before footer
- **Footer Upgrade** - 4-column link grid (Services, Company, Clients, System), Telegram + Facebook social links
- **Typing Effect** - Animated headline cycling through 4 phrases with gradient text highlight
- **Parallax** - Floating particles and gradient orbs with scroll-based movement
- **Scroll Reveal** - IntersectionObserver animations with stagger delays on all sections

## Project Structure

```
├── src/
│   ├── index.ts                 # Cloudflare Worker — main API entry
│   ├── modules/
│   │   ├── routes/              # Route modules (22 domain modules)
│   │   │   ├── auth.ts          # Authentication (PIN, Google, password)
│   │   │   ├── technicians.ts   # Technician CRUD
│   │   │   ├── clients.ts       # Client CRUD & AMC tracking
│   │   │   ├── jobs.ts          # Service records & job management
│   │   │   ├── inventory.ts     # Stock, batches, items, catalog
│   │   │   ├── invoices.ts      # Invoicing & POS
│   │   │   ├── expenses.ts      # Expense tracking
│   │   │   ├── attendance.ts    # Clock in/out
│   │   │   ├── reports.ts       # Dashboard, jobs, revenue reports
│   │   │   ├── admin.ts         # Admin dashboard data
│   │   │   ├── ai.ts            # AI dispatch, route opt, copilot
│   │   │   ├── telegram.ts      # Telegram webhook & notifications
│   │   │   ├── public.ts        # Public API endpoints
│   │   │   ├── google.ts        # Google OAuth, Drive, Maps
│   │   │   ├── batches.ts       # Inventory batches
│   │   │   ├── rma.ts           # RMA & warranty
│   │   │   ├── distributors.ts  # Distributor management
│   │   │   ├── cashsafe.ts      # Cash safe ledger
│   │   │   ├── servicefees.ts   # Service fee management
│   │   │   ├── landing.ts       # Landing page content
│   │   │   ├── surveys.ts       # Site surveys, AI quotation estimator & customer portal
│   │   │   ├── portal.ts        # Customer portal endpoints
│   │   │   └── sync.ts          # Offline-first sync API
│   │   ├── services/            # Business logic layer
│   │   │   ├── survey.service.ts      # Survey CRUD, photos, status counts
│   │   │   ├── quotation.service.ts   # Quotation CRUD, line items, totals
│   │   │   ├── job.service.ts         # Job CRUD, status changes, calendar
│   │   │   ├── client.service.ts      # Client CRUD, search, AMC status
│   │   │   ├── inventory.service.ts   # Inventory CRUD, stock tracking
│   │   │   └── sync.service.ts        # Sync push/pull/conflict resolution
│   │   └── utils/               # Shared utilities
│   │       ├── router.ts        # Lightweight request router
│   │       ├── cors.ts          # CORS headers
│   │       ├── response.ts      # Response helpers
│   │       ├── jwt.ts           # JWT auth
│   │       ├── csrf.ts          # CSRF protection
│   │       ├── auth-middleware.ts # Authentication middleware
│   │       ├── telegram.ts      # Telegram bot API
│   │       ├── viber.ts         # Viber bot API
│   │       ├── google.ts        # Google OAuth/Drive
│   │       ├── gemini.ts        # Gemini AI integration
│   │       ├── websocket.ts     # WebSocket real-time updates
│   │       ├── rate-limit.ts    # Rate limiting
│   │       └── sql-validator.ts # SQL injection protection
│   └── types/
│       └── schema.ts            # TypeScript DB types
├── public/
│   ├── index.html               # Landing page
│   ├── admin.html               # Admin dashboard (Tauri compatible)
│   ├── app.html                 # Technician mobile app (web PWA)
│   ├── portal.html              # Client portal
│   ├── jobs.html                # Job management
│   ├── portfolio.html           # Portfolio showcase
│   ├── contact.html             # Contact page
│   ├── admin.js                 # Admin dashboard logic
│   ├── app.js                   # Technician app logic
│   ├── input.css                # Tailwind input
│   ├── tailwind.css             # Compiled Tailwind
│   ├── searchable-select.js     # Reusable select component
│   ├── logo.png / logo.svg      # Brand assets
│   ├── manifest.json            # PWA manifest
│   ├── sw.js                    # Service worker
│   ├── views/                   # Admin sub-views
│   │   ├── dashboard.html
│   │   ├── tickets.html
│   │   ├── amc.html
│   │   ├── inventory.html
│   │   ├── currency.html
│   │   ├── dispatch-map.html
│   │   ├── reports.html
│   │   ├── ai-copilot.html
│   │   ├── warranty.html
│   │   ├── distributors.html
│   │   ├── service-fees.html
│   │   ├── receipt-builder.html
│   │   ├── surveys.html
│   │   ├── user-management.html
│   │   └── system-settings.html
│   └── _headers                 # Cloudflare headers config
├── functions/
│   └── api/
│       └── [[path]].js          # Pages Function API proxy
├── db/
│   ├── migrations/              # SQL migrations
│   │   ├── schema.sql           # Main schema (14 tables)
│   │   ├── 0006_survey_quotation_redesign.sql
│   │   ├── 0007_quotation_improvements.sql
│   │   ├── 0008_service_fees_upgrade.sql
│   │   ├── 0009_clients_directory_upgrade.sql
│   │   ├── 0010_sync_infrastructure.sql   # Sync tables
│   │   └── mock_data.sql        # Test data
├── admin-desktop/               # Tauri desktop app (Windows)
│   ├── src-tauri/
│   │   ├── Cargo.toml           # Rust dependencies
│   │   ├── tauri.conf.json      # App config
│   │   └── src/
│   │       ├── main.rs          # Entry point
│   │       ├── lib.rs           # Tauri commands (12 commands)
│   │       ├── db.rs            # Local SQLite (rusqlite)
│   │       ├── sync.rs          # Cloud ↔ Local sync
│   │       └── notifications.rs # Native notifications
│   └── src/
│       ├── index.html           # Desktop UI
│       ├── css/admin.css        # Dark theme
│       └── js/app.js            # View switching
├── technician-android/          # Android app (Kotlin)
│   ├── app/src/main/java/com/kosai/tech/
│   │   ├── MainActivity.kt
│   │   ├── KosaiApp.kt
│   │   ├── data/
│   │   │   ├── model/Models.kt  # 7 Room entities
│   │   │   ├── local/
│   │   │   │   ├── AppDatabase.kt
│   │   │   │   └── Daos.kt      # 6 DAOs
│   │   │   ├── remote/
│   │   │   │   ├── ApiService.kt # Retrofit (14 endpoints)
│   │   │   │   └── ApiClient.kt
│   │   │   └── SyncManager.kt   # Offline queue
│   │   └── ui/
│   │       ├── KosaiApp.kt
│   │       ├── theme/Theme.kt
│   │       ├── jobs/JobListScreen.kt
│   │       ├── attendance/AttendanceScreen.kt
│   │       └── settings/SettingsScreen.kt
│   ├── app/build.gradle.kts
│   ├── build.gradle.kts
│   └── settings.gradle.kts
├── docs/                        # Documentation
├── .agents/                     # AI agent configuration
│   ├── AGENTS.md                # Project rules
│   └── skills/                  # Specialized skills
├── wrangler.toml                # Cloudflare Workers config
├── package.json                 # Node dependencies & scripts
├── tsconfig.json                # TypeScript config
├── design.md                    # Design system documentation
└── AGENTS.md                    # AI agent instructions
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account with D1 database support

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Build Tailwind CSS
npm run build:css

# 3. Run locally with Wrangler
npm run dev
```

### Environment Variables

Configure in `.dev.vars` (local) or Cloudflare dashboard (production):

| Variable                      | Description                 | Required |
| ----------------------------- | --------------------------- | -------- |
| `GOOGLE_CLIENT_ID`            | Google OAuth client ID      | Yes      |
| `ADMIN_EMAIL`                 | Admin email for Google auth | Yes      |
| `JWT_SECRET` / `ADMIN_SECRET` | Secret for JWT tokens       | Yes      |
| `TELEGRAM_BOT_TOKEN`          | Telegram bot token          | Yes      |
| `TELEGRAM_CHAT_ID`            | Telegram chat/channel ID    | Yes      |
| `GEMINI_API_KEY`              | Gemini AI API key           | Yes      |
| `GOOGLE_CLIENT_SECRET`        | Google OAuth client secret  | Yes      |
| `GOOGLE_DRIVE_FOLDER_ID`      | Google Drive folder ID      | Yes      |

> **Note:** `GOOGLE_REFRESH_TOKEN` is no longer required as an environment variable. The refresh token is now stored in the `system_config` database table via the OAuth callback flow. To authorize Google Drive, visit `/api/auth/google/drive-url` and complete the OAuth consent.

### Database Setup & Data Sync

The project uses Cloudflare D1. To initialize or migrate database data:

#### Local Setup

```bash
# Apply schema to local DB
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql

# Seed local DB with mock data
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql
```

#### Production Deploy (Remote Sync)

```bash
# 1. Run remote schema creation
npx wrangler d1 execute cctv-fsm-db --remote --file=db/migrations/schema.sql

# 2. Export local DB and import to remote (see D1 Sync docs)
npx wrangler d1 export cctv-fsm-db --local --output=local_dump.sql
# Edit local_dump.sql: replace base64 photos with NULL to avoid 100KB limit
# Import to remote
```

_(Note: To sync data successfully, replace any large base64 photo strings in the SQL file with `NULL` to avoid the 100KB SQLITE_TOOBIG query constraint limit on D1.)_

### Tauri Desktop App Setup

```bash
cd admin-desktop

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production (~5MB installer)
npm run tauri build
```

### Android App Setup

```bash
cd technician-android

# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease

# Install on connected device
./gradlew installDebug
```

## Available Scripts

| Command                | Description                |
| ---------------------- | -------------------------- |
| `npm run dev`          | Start Wrangler dev server  |
| `npm run build:css`    | Build Tailwind CSS         |
| `npm run watch:css`    | Watch Tailwind for changes |
| `npm run test`         | Run Vitest unit tests      |
| `npm run test:watch`   | Watch tests                |
| `npm run format`       | Format with Prettier       |
| `npm run format:check` | Check formatting           |

## API Endpoints

All endpoints served from Cloudflare Worker at `/api/...`:

### Authentication

- `POST /api/auth/login` — Technician PIN login
- `POST /api/auth/google` — Google OAuth login
- `POST /api/auth/login-password` — Username/password login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/profile` — Current user profile
- `PUT /api/technicians/:id/pin` — Change PIN

### Jobs Management

- `GET /api/jobs` — List jobs (with filters)
- `GET /api/jobs/active` — Active jobs
- `GET /api/jobs/:id` — Job details
- `POST /api/jobs` — Create job
- `PUT /api/jobs/:id` — Update job
- `POST /api/jobs/:id/status` — Update status

### Inventory

- `GET /api/inventory` — List inventory
- `POST /api/inventory` — Add inventory
- `PUT /api/inventory/:id` — Update inventory
- `DELETE /api/inventory/:id` — Delete inventory
- `POST /api/inventory/:id/adjust` — Adjust stock

### Admin Inventory

- `GET /api/admin/inventory/list` — Admin inventory
- `GET /api/admin/inventory/batches` — Batches
- `GET /api/admin/inventory/categories` — Categories
- `POST /api/admin/inventory/catalog/price` — Update prices
- `POST /api/admin/inventory/batches/create` — Create batch

### Invoices & POS

- `GET /api/invoices` — List invoices
- `POST /api/invoices` — Create invoice
- `POST /api/pos/checkout` — POS checkout

### Service Fees

- `GET /api/service-fees` — List fees
- `POST /api/service-fees` — Create fee

### Cash Safe

- `GET /api/cash-safe/balance` — Balances
- `POST /api/cash-safe/deposit` — Deposit
- `POST /api/cash-safe/withdraw` — Withdraw

### Attendance

- `POST /api/attendance/clock-in` — Clock in
- `POST /api/attendance/clock-out` — Clock out

### RMA & Warranty

- `GET /api/rma` — List RMA
- `POST /api/rma` — Create RMA
- `GET /api/warranty/check` — Check warranty

### Reports

- `GET /api/reports/dashboard` — Dashboard
- `GET /api/reports/jobs` — Jobs report
- `GET /api/reports/revenue` — Revenue report

### AI Features

- `POST /api/ai/auto-dispatch` — AI dispatch
- `POST /api/ai/route-optimize` — Route optimization
- `POST /api/ai/copilot` — AI chat
- `POST /api/ai/transcribe` — Transcribe audio

### Sync (Offline-First)

- `POST /api/sync/push` — Push client changes to server
- `GET /api/sync/pull` — Pull server changes to client
- `GET /api/sync/changes` — Get changes since timestamp (admin)
- `GET /api/sync/status` — Get sync status for client

### WebSocket

- `wss://your-worker/ws` — Real-time updates for connected clients

### Admin

- `GET /api/admin/technicians` — Tech list
- `GET /api/admin/clients` — Client list
- `GET /api/admin/stats` — Admin stats
- `POST /api/admin/backup` — Trigger backup

### Public

- `POST /api/public/contact` — Contact form
- `GET /api/public/exchange-rate` — Exchange rate

### Telegram

- `POST /api/telegram/webhook` — Webhook
- `POST /api/telegram/send` — Send message

### Google & Maps

- `GET /api/auth/google/drive-url` — Drive auth URL
- `GET /api/auth/google/drive-callback` — Drive OAuth callback (stores refresh token in DB)
- `GET /api/debug-gdrive` — Debug Drive connection
- `GET /api/test-backup` — Trigger full backup upload to Drive
- `GET /api/admin/resolve-coords` — Resolve coordinates
- `POST /api/resolve-maps-url` — Resolve Maps URL

---

## Design System

See [design.md](./design.md) for complete design token system including:

- Color palette (dark theme with amber accent)
- Typography (Plus Jakarta Sans, uppercase headings)
- Glass morphism components
- Spacing & border radius system
- Accessibility guidelines

---

## Deployment

```bash
# Deploy Worker
npx wrangler deploy

# Deploy Frontend (Cloudflare Pages)
npx wrangler pages deploy public --project-name=awesomemyanmar
```

**Production URLs:**

- Backend API: `https://cctv-service-system.nyinyimin2007.workers.dev/`
- Frontend: `https://awesomemyanmar.pages.dev/`

### Local-First Development Policy

> **⚠️ IMPORTANT**: This project follows a **local-first development** approach.
>
> - Always run and test locally using `npm run dev`
> - Do NOT deploy to Cloudflare until explicitly requested with "deploy cloudflare"
> - See `.agents/skills/cloudflare-local-first/SKILL.md` for details

---

## License

ISC
