# Awesome Myanmar CCTV & Infrastructure Platform

A **field service management system** for CCTV, networking, and storage infrastructure in Myanmar. Built on Cloudflare Workers with a dark-themed, glass-morphism UI.

## Tech Stack

| Layer        | Technology                                 |
| ------------ | ------------------------------------------ |
| **Backend**  | Cloudflare Workers (TypeScript, modular)   |
| **Database** | Cloudflare D1 (SQLite edge DB)             |
| **Frontend** | Vanilla HTML/CSS/JS + Tailwind CSS v4      |
| **Design**   | Dark/Light theme, glass morphism, amber accent |
| **Auth**     | Google OAuth, PIN-based, username/password |
| **Desktop**  | Tauri (Rust)                               |
| **CI/CD**    | Wrangler CLI                               |

## Recent Updates (v1.1)

### UI/UX Improvements
- **Dark/Light Theme Toggle** - Consistent theme across all pages with localStorage persistence
- **Toast Notifications** - Replaced 80+ browser alerts with non-blocking toast messages
- **Keyboard Shortcuts** - Ctrl+K (search), Ctrl+N (new ticket), Escape (close modals)
- **Mobile Navigation** - Bottom navigation bar for admin panel
- **Skeleton Loaders** - CSS classes for loading states
- **OS Theme Detection** - Auto-matches system preference on first visit
- **Responsive Design** - Card views for tables on mobile

### Dashboard Redesign
- Time-based greeting (Good Morning/Afternoon/Evening)
- Quick action buttons
- System status indicators
- Refresh button
- Modern card-based layout

### System Improvements
- Fixed null reference errors in warranty/RMA/reports
- Added missing database tables (attendance, client_credits, etc.)
- Replaced all browser alerts with toast notifications
- Added touch swipe support for mobile sidebar
- Added bottom navigation for mobile admin panel

## Project Structure

```
├── src/
│   ├── index.ts                 # Cloudflare Worker — main API entry
│   ├── modules/
│   │   ├── routes/              # Route modules (18+ domain modules)
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
│   │   │   └── landing.ts       # Landing page content
│   │   └── utils/               # Shared utilities
│   │       ├── router.ts        # Lightweight request router
│   │       ├── cors.ts          # CORS headers
│   │       ├── response.ts      # Response helpers
│   │       ├── jwt.ts           # JWT auth
│   │       ├── telegram.ts      # Telegram bot API
│   │       ├── viber.ts         # Viber bot API
│   │       ├── google.ts        # Google OAuth/Drive
│   │       ├── gemini.ts        # Gemini AI integration
│   │       ├── rate-limit.ts    # Rate limiting
│   │       └── sql-validator.ts # SQL injection protection
│   └── types/
│       └── schema.ts            # TypeScript DB types
├── public/
│   ├── index.html               # Landing page
│   ├── admin.html               # Admin dashboard
│   ├── app.html                 # Technician mobile app (web)
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
│   │   ├── user-management.html
│   │   └── system-settings.html
│   └── _headers                 # Cloudflare headers config
├── functions/
│   └── api/
│       └── [[path]].js          # Pages Function API proxy
├── db/
│   ├── migrations/              # SQL migrations
│   │   ├── schema.sql           # Main schema (14 tables)
│   │   ├── mock_data.sql        # Test data
│   │   ├── roles_config_sync.sql
│   │   ├── inventory_sync.sql
│   │   ├── create_roles_table.sql
│   │   └── create_credits_table.sql
│   └── seeds/                   # Seed data files
├── src-tauri/                   # Tauri desktop app (Rust)
│   ├── tauri.conf.json
│   ├── src/
│   └── icons/
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
| `GOOGLE_REFRESH_TOKEN`        | Google OAuth refresh token  | Yes      |
| `GOOGLE_DRIVE_FOLDER_ID`      | Google Drive folder ID      | Yes      |

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
