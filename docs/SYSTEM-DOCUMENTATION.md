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

| Item | Details |
|------|---------|
| **Project** | Awesome Myanmar CCTV & Infrastructure FSM |
| **Version** | 2.0.0 |
| **Database** | Turso (SQLite edge DB) |
| **Backend** | Cloudflare Workers / Netlify Functions / Node.js |

---

## Pages

### Main Pages (7)

| Page | URL | Purpose |
|------|-----|---------|
| Landing Page | `/` | Marketing hero, services, stats, price list, quotation form |
| Admin Dashboard | `/admin.html` | HQ Dispatch Console with 13 sub-views |
| Technician App | `/app.html` | Field operations portal for technicians |
| Client Portal | `/portal.html` | Customer service history & warranty lookup |
| Jobs Dashboard | `/jobs.html` | View all jobs with filters and search |
| Portfolio | `/portfolio.html` | Showcase completed projects |
| Contact | `/contact.html` | Contact form with interactive map |

### Admin Sub-Views (13)

| View | Purpose |
|------|---------|
| Dashboard | Stats widgets, charts, revenue overview |
| Service Tickets | Job dispatch, edit, cancel with PDF print |
| Customer Management | Client CRUD, AMC contract tracking |
| Inventory | Stock batches, pricing, device catalog |
| Cash Safe Ledger | USD/MMK balances, transaction log |
| Dispatch Map | Live field map with Leaflet.js |
| Reports | Operational & financial analytics |
| AI Copilot | Auto-dispatch, route optimization, chat |
| Warranty & RMA | Customer warranties, distributor RMA |
| Distributors | Procurement channels directory |
| Service Fees | Rate card management |
| User Management | Technician account administration |
| System Settings | Backup/restore, exchange rate config |

---

## API Endpoints

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/login` | Technician PIN login |
| POST | `/api/auth/google` | Google OAuth sign-in |
| POST | `/api/auth/login-password` | Username/password login |
| POST | `/api/portal/change-pin` | Change security PIN |

### Jobs Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/jobs` | Fetch all jobs |
| POST | `/api/jobs` | Create new job |
| POST | `/api/jobs/update` | Field tech status update |
| POST | `/api/admin/jobs` | Admin dispatch job |
| POST | `/api/admin/jobs/edit` | Edit job details |
| POST | `/api/admin/jobs/cancel` | Cancel job |
| GET | `/api/jobs/receipt` | Job receipt data |

### Inventory

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/inventory/list` | List stock items |
| POST | `/api/admin/inventory/add` | Add new model |
| POST | `/api/admin/inventory/restock` | Adjust quantities |
| POST | `/api/admin/inventory/delete` | Remove item |
| POST | `/api/admin/inventory/catalog/price` | Update prices |
| GET | `/api/admin/inventory/batches` | List batches |
| POST | `/api/admin/inventory/batches/create` | Create batch |

### Client Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/clients/list` | List clients |
| POST | `/api/admin/clients` | Create client |
| POST | `/api/admin/clients/edit` | Edit client |
| POST | `/api/admin/clients/delete` | Delete client |

### Technician Management

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/technicians` | List technicians |
| POST | `/api/admin/technicians/create` | Create technician |
| POST | `/api/admin/technicians/update` | Update technician |
| POST | `/api/admin/technicians/delete` | Delete technician |

### Finance

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/cash/safe` | Get balances |
| GET | `/api/admin/cash/transactions` | List transactions |
| POST | `/api/admin/cash/transact` | Deposit/withdrawal |
| GET | `/api/service-fees` | List service fees |
| POST | `/api/admin/service-fees/manage` | Manage fees |

### Warranty & RMA

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/warranty/list` | List warranties |
| POST | `/api/admin/warranty/register` | Register warranty |
| GET | `/api/admin/rma/list` | List RMA items |
| POST | `/api/admin/rma/update` | Update RMA |
| POST | `/api/admin/rma/raise` | Raise RMA claim |

### AI Features

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/admin/jobs/ai-polish` | AI polish notes |
| POST | `/api/admin/ai/auto-dispatch` | AI auto-dispatch |
| POST | `/api/admin/ai/route-optimize` | AI route optimization |
| POST | `/api/admin/ai/chat-data` | AI chat with database |
| POST | `/api/admin/ai/transcribe` | Voice transcription |

### Other

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/exchange-rate` | Exchange rate |
| POST | `/api/contact` | Contact form |
| GET | `/api/admin/lookups` | Lookup data |
| GET | `/api/admin/backup` | Database backup |
| POST | `/api/admin/restore` | Database restore |
| GET | `/api/portal/history` | Client history |

---

## Database Schema

### Tables (10)

#### technicians
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| name | TEXT | Full name |
| nickname | TEXT | Display name |
| role | TEXT | Sales/Technician/Admin |
| phone | TEXT | Phone number |
| active | INTEGER | 1=active, 0=inactive |
| email | TEXT | Email address |
| username | TEXT | Login username |
| password | TEXT | Login password |
| pin | TEXT | Security PIN |

#### clients
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key |
| company_name | TEXT | Company name |
| contact_person | TEXT | Contact person |
| address | TEXT | Address |
| phone | TEXT | Phone number |
| amc_start | TEXT | AMC start date |
| amc_end | TEXT | AMC end date |
| amc_status | TEXT | Active/Inactive/Expired/No AMC/Individual |

#### service_records
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | Primary key (job ID) |
| client_id | TEXT | FK to clients |
| technician_id | TEXT | FK to technicians |
| service_type | TEXT | CCTV/Networking/WiFi/NAS/General Maintenance |
| status | TEXT | Pending/In Progress/Completed/Cancelled |
| job_description | TEXT | Job description |
| technician_notes | TEXT | Tech notes |
| equipment_used | TEXT | Equipment used |
| before_photo | TEXT | Before photo URL |
| after_photo | TEXT | After photo URL |
| arrival_time | TEXT | Arrival timestamp |
| completion_time | TEXT | Completion timestamp |
| arrival_lat | REAL | Arrival latitude |
| arrival_lng | REAL | Arrival longitude |
| completion_lat | REAL | Completion latitude |
| completion_lng | REAL | Completion longitude |
| maps_url | TEXT | Google Maps URL |
| signature | TEXT | Customer signature |
| checklist_data | TEXT | JSON checklist data |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

#### inventory_stock
| Column | Type | Description |
|--------|------|-------------|
| item_code | TEXT | Primary key |
| item_name | TEXT | Product name |
| category | TEXT | Hard Drives/Network Cables/Security IP Cams/Spare Hardware Parts |
| stock_qty | INTEGER | Stock quantity |
| unit_price | REAL | USD price |
| unit_price_mmk | REAL | MMK price |
| batch_code | TEXT | Batch code |
| buying_price | REAL | Cost price |

#### inventory_batches
| Column | Type | Description |
|--------|------|-------------|
| batch_code | TEXT | Primary key |
| item_code | TEXT | FK to inventory_stock |
| buying_price | REAL | Cost price |
| supplier | TEXT | Supplier name |
| created_at | TEXT | Creation timestamp |

#### inventory_items
| Column | Type | Description |
|--------|------|-------------|
| serial_number | TEXT | Primary key |
| device_name | TEXT | Device name |
| client_id | TEXT | FK to clients |
| installed_date | TEXT | Installation date |
| warranty_months | INTEGER | Warranty period |
| status | TEXT | Active/Defective/RMA Sent/RMA Completed/Replaced |
| distributor | TEXT | Distributor name |
| rma_tracking_id | TEXT | RMA tracking ID |
| job_id | TEXT | FK to service_records |
| batch_code | TEXT | FK to inventory_batches |

#### cash_safes
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| usd_balance | REAL | USD balance |
| mmk_balance | REAL | MMK balance |

#### cash_transactions
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| job_id | TEXT | FK to service_records |
| transaction_type | TEXT | Deposit/Withdrawal |
| primary_currency | TEXT | USD/MMK |
| amount | REAL | Transaction amount |
| exchange_rate | REAL | Exchange rate |
| equivalent_amount | REAL | Equivalent amount |
| notes | TEXT | Transaction notes |
| created_at | TEXT | Creation timestamp |
| receive_mmk | INTEGER | 1=receive MMK |
| linked_batch | TEXT | Linked batch code |

#### service_fees
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| service_type | TEXT | Service type |
| fee_amount | REAL | Fee amount |
| currency | TEXT | USD/MMK |
| description | TEXT | Description |

#### system_config
| Column | Type | Description |
|--------|------|-------------|
| config_key | TEXT | Primary key |
| config_value | TEXT | Config value |

---

## Design System

### Colors

| Color | Hex | Usage |
|-------|-----|-------|
| Brand Dark | #09090b | Primary background |
| Brand Panel | #121218 | Card backgrounds |
| Brand Orange | #f59e0b | Accent color |
| Indigo | #6366f1 | Secondary accent |
| Emerald | #10b981 | Success states |
| Sky | #0ea5e9 | Info states |
| Rose | #f43f5e | Error states |

### Typography

| Element | Font | Weight |
|---------|------|--------|
| Headings | Plus Jakarta Sans | 700-800 |
| Body | Plus Jakarta Sans | 400-500 |
| Labels | Plus Jakarta Sans | 600-700 |
| Code | SF Mono, Consolas | 400 |

### Components

| Component | Description |
|-----------|-------------|
| Glass Panel | Frosted glass with backdrop-blur |
| Status Badge | Color-coded status indicators |
| Form Input | Dark background with amber focus |
| Button Primary | Amber gradient with hover effect |
| Button Secondary | Transparent with border |
| Modal | Full-screen overlay with blur |
| Toast | Notification popup |
| Data Table | Striped rows with hover |

### Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| Tailwind CSS | 4.3.2 | Utility-first CSS |
| Leaflet.js | 1.9.4 | Interactive maps |
| Chart.js | Latest | Analytics charts |
| jsPDF | 2.5.1 | PDF generation |
| FullCalendar | 6.1.8 | Event scheduling |
| Google Identity | Latest | OAuth sign-in |

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
main = "src/index.js"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "cctv-fsm-db"
database_id = "YOUR_DATABASE_ID"

[vars]
GOOGLE_CLIENT_ID = "your-google-client-id"
ADMIN_EMAIL = "your-email@gmail.com"

[triggers]
crons = ["0 0 * * *"]
```

#### Step 5: Initialize Database
```bash
wrangler d1 execute cctv-fsm-db --file=schema.sql
```

#### Step 6: Set Secrets
```bash
wrangler secret put JWT_SECRET
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
wrangler secret put GEMINI_API_KEY
wrangler secret put GOOGLE_CLIENT_SECRET
```

#### Step 7: Deploy
```bash
wrangler deploy
```

#### Step 8: Configure Custom Domain (Optional)
1. Go to Cloudflare Dashboard > Workers & Pages
2. Select your worker
3. Go to Settings > Triggers > Custom Domains
4. Add your domain

#### Step 9: Set Up Telegram Webhook
```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/setWebhook" \
  -d "url=https://your-worker.your-subdomain.workers.dev/api/telegram-webhook"
```

---

### 2. Netlify Functions (Backup)

#### Prerequisites
- Netlify account
- Node.js 18+
- Netlify CLI

#### Step 1: Install Netlify CLI
```bash
npm install -g netlify-cli
```

#### Step 2: Login to Netlify
```bash
netlify login
```

#### Step 3: Link Project
```bash
netlify init
```

#### Step 4: Set Environment Variables
```bash
netlify env:set TURSO_DATABASE_URL "libsql://your-db.turso.io"
netlify env:set TURSO_AUTH_TOKEN "your-token"
netlify env:set ADMIN_EMAIL "your-email@gmail.com"
netlify env:set JWT_SECRET "your-secret"
```

#### Step 5: Deploy
```bash
netlify deploy --dir=public --functions=netlify/functions --prod
```

---

### 3. Local Node.js Server

#### Prerequisites
- Node.js 18+

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Start Server
```bash
npm start
```

#### Step 3: Access
Open http://localhost:3000

---

### 4. Synology NAS (Docker)

#### Step 1: Copy Project to NAS
Upload the project folder to `/volume1/docker/awesome-myanmar`

#### Step 2: Create docker-compose.yml
```yaml
version: '3'
services:
  web:
    image: node:18-alpine
    container_name: awesome-myanmar
    ports:
      - "3000:3000"
    volumes:
      - .:/app
    working_dir: /app
    command: sh -c "npm install && npm start"
    restart: unless-stopped
```

#### Step 3: Deploy
```bash
ssh admin@your-nas-ip
cd /volume1/docker/awesome-myanmar
docker-compose up -d
```

#### Step 4: Access
Open http://your-nas-ip:3000

---

### 5. Synology Web Station

#### Step 1: Copy Files
Copy `public` folder to `/volume1/web/awesome-myanmar`

#### Step 2: Configure Web Station
1. Open Web Station in DSM
2. Create new service portal
3. Point to `awesome-myanmar` folder

#### Step 3: Access
Open http://your-nas-ip/awesome-myanmar

---

### 6. Electron Desktop App

#### Step 1: Install Electron
```bash
npm install electron --save-dev
```

#### Step 2: Update package.json
```json
{
  "main": "electron-main.js",
  "scripts": {
    "electron": "electron ."
  }
}
```

#### Step 3: Run
```bash
npm run electron
```

---

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| TURSO_DATABASE_URL | Turso database URL | Yes |
| TURSO_AUTH_TOKEN | Turso auth token | Yes |
| JWT_SECRET | JWT signing secret | Yes |
| ADMIN_EMAIL | Admin email address | Yes |
| GOOGLE_CLIENT_ID | Google OAuth client ID | No |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | No |
| TELEGRAM_BOT_TOKEN | Telegram bot token | No |
| TELEGRAM_CHAT_ID | Telegram chat ID | No |
| GEMINI_API_KEY | Gemini AI API key | No |
| VIBER_BOT_TOKEN | Viber bot token | No |
| VIBER_RECEIVER_ID | Viber receiver ID | No |

### Default Credentials

| Type | Username | Password |
|------|----------|----------|
| Admin | admin | AdminPass123! |
| Test Technician | tech1 | tech123! |
| Test Technician PIN | TECH-KRUDXID | 1234 |

---

## File Structure

```
Claude/
├── public/                    # Static files
│   ├── index.html            # Landing page
│   ├── admin.html            # Admin dashboard
│   ├── app.html              # Technician app
│   ├── portal.html           # Client portal
│   ├── jobs.html             # Jobs dashboard
│   ├── portfolio.html        # Portfolio page
│   ├── contact.html          # Contact page
│   ├── admin.js              # Admin JavaScript
│   ├── app.js                # Technician JavaScript
│   ├── views/                # Admin sub-views
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
│   └── logo.png              # Logo
├── src/
│   └── index.js              # Cloudflare Worker (primary API)
├── netlify/
│   └── functions/
│       ├── api.js            # Netlify Functions API
│       └── lib/
│           ├── db.js         # Turso database driver
│           ├── auth.js       # JWT authentication
│           └── notifications.js # Telegram/Viber
├── android/                  # Android app (Kotlin)
├── schema.sql                # Database schema
├── server.js                 # Local Node.js server
├── wrangler.toml             # Cloudflare config
├── netlify.toml              # Netlify config
├── package.json              # npm config
└── .env                      # Environment variables
```

---

*Documentation generated on 2026-07-11*
