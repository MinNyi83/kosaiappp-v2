# ANTIGRAVITY MEMO

## Technical Feature & Design Reference

### Awesome Myanmar CCTV & Infrastructure Platform v2.0

---

## EXECUTIVE SUMMARY

**Platform:** Field Service Management system for CCTV, networking, and storage infrastructure in Myanmar.

**Architecture:** Pure Node.js HTTP server + Turso (SQLite) database + vanilla JavaScript frontend.

**Design Language:** Dark glassmorphism with amber accent, Plus Jakarta Sans typography, Tailwind CSS utilities.

**Key Metrics:** 7 public pages, 15 admin views, 60+ API endpoints, 13 database tables.

---

## 1. DESIGN SYSTEM

### 1.1 Color Palette

| Token          | Hex       | Role                                |
| -------------- | --------- | ----------------------------------- |
| `brand-orange` | `#f59e0b` | Primary accent, CTAs, active states |
| `brand-dark`   | `#09090b` | Primary background                  |
| `brand-panel`  | `#121218` | Card/panel backgrounds              |
| `indigo-500`   | `#6366f1` | Secondary accent (app, portal)      |
| `emerald-400`  | `#34d399` | Success states                      |
| `sky-400`      | `#38bdf8` | Info states                         |
| `rose-400`     | `#fb7185` | Error/danger states                 |

### 1.2 Glass Panel Component

```css
.glass-panel {
  background: rgba(18, 18, 24, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.3s ease;
}
.glass-panel:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### 1.3 Typography

- **Font:** Plus Jakarta Sans (300-900 weights)
- **Body size:** `text-xs` (12px) across all pages
- **Style:** Almost all text is `UPPERCASE` with `letter-spacing: 0.05em`

### 1.4 Status Badges

```css
.status-pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}
.status-in-progress {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}
.status-completed {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
}
.status-cancelled {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}
```

---

## 2. PUBLIC PAGES

### 2.1 Landing Page (`public/index.html`)

**Features:**

- Animated hero with gradient orbs and grid background
- Sticky header with scroll shadow
- Responsive hamburger menu
- Stats section (500+ Projects, 150+ Clients, 10+ Years, 24/7 Support)
- Real-time price list from `/api/admin/inventory`
- Quotation form creating service records
- Back-to-top button
- Dynamic content loaded from `/api/landing-page`

**Key Code:**

```javascript
// Fetch landing page content
async function fetchLandingPageContent() {
  const res = await fetch(`${API_BASE_URL}/api/landing-page`);
  const data = await res.json();
  if (data.value) {
    document.getElementById('lp-eyebrow').textContent = data.value.eyebrow;
    // ... update all elements
  }
}
```

### 2.2 Jobs Dashboard (`public/jobs.html`)

**Features:**

- Real-time stats cards (Total, Pending, In Progress, Completed)
- Filter buttons by status
- Search by Job ID, Client, Technician, Service type
- Auto-refresh every 30 seconds
- Color-coded status badges

**API Endpoint:** `GET /api/jobs`

### 2.3 Portfolio Page (`public/portfolio.html`)

**Features:**

- Responsive grid (1/2/3 columns)
- Category filters: All, CCTV, Networking, NAS, WiFi
- Project modal with before/after slider
- Image gallery
- 6 sample projects

**Before/After Slider Code:**

```javascript
const updatePosition = (x) => {
  const rect = slider.getBoundingClientRect();
  let pos = ((x - rect.left) / rect.width) * 100;
  pos = Math.max(0, Math.min(100, pos));
  before.style.clipPath = `inset(0 ${100 - pos}% 0 0)`;
  handle.style.left = pos + '%';
};
```

### 2.4 Contact Page (`public/contact.html`)

**Features:**

- Contact form (Name, Phone, Email, Service, Message)
- Leaflet.js dark-themed map centered on Yangon
- Contact info cards (Address, Phone, Email, Hours)
- Form submits to `/api/contact` creating service record

**API Endpoint:** `POST /api/contact` (public, no auth)

---

## 3. ADMIN PANEL

### 3.1 Admin Views (15 total)

| View                   | Purpose                   |
| ---------------------- | ------------------------- |
| `dashboard.html`       | Stats, charts, overview   |
| `tickets.html`         | Service ticket management |
| `amc.html`             | Client/AMC management     |
| `inventory.html`       | Stock, batches, pricing   |
| `currency.html`        | Cash safe ledger          |
| `dispatch-map.html`    | Leaflet.js dispatch map   |
| `reports.html`         | Analytics reports         |
| `ai-copilot.html`      | AI assistant              |
| `warranty.html`        | Warranty & RMA            |
| `distributors.html`    | Distributor directory     |
| `service-fees.html`    | Rate card management      |
| `user-management.html` | Technician accounts       |
| `system-settings.html` | Backup/restore, config    |
| `landing-page.html`    | Landing page CMS          |
| `portfolio.html`       | Portfolio editor          |

### 3.2 Landing Page Editor (`public/views/landing-page.html`)

**Editable Sections:**

- Hero: Eyebrow, Headline, Description, Button text
- Stats: 4 value/label pairs
- Services: Title + 3 service cards
- Contact: Address, Phone, Email, Hours
- Footer: Copyright text

**API Endpoints:**

```
GET  /api/landing-page    → Returns content (defaults if empty)
POST /api/landing-page    → Saves content (admin auth required)
```

### 3.3 Portfolio Editor (`public/views/portfolio.html`)

**Features:**

- Projects list with thumbnails
- Add/Edit/Delete modal
- Live preview panel with filters
- localStorage persistence
- Service type color coding

**Fields:** Title, Client, Location, Service Type, Description, Date, Technician, After Image URL, Before Image URL

---

## 4. API ARCHITECTURE

### 4.1 Authentication

| Endpoint                   | Method | Auth | Description             |
| -------------------------- | ------ | ---- | ----------------------- |
| `/api/auth/login`          | POST   | None | Technician PIN login    |
| `/api/auth/login-password` | POST   | None | Username/password + JWT |
| `/api/portal/change-pin`   | POST   | None | Change security PIN     |

### 4.2 Core Endpoints

| Endpoint             | Method   | Auth                   | Description                                 |
| -------------------- | -------- | ---------------------- | ------------------------------------------- |
| `/api/jobs`          | GET      | None                   | List all jobs                               |
| `/api/jobs`          | POST     | None                   | Create job (auto-creates Individual client) |
| `/api/contact`       | POST     | None                   | Public contact form                         |
| `/api/landing-page`  | GET/POST | GET: None, POST: Admin | Landing page CMS                            |
| `/api/exchange-rate` | GET      | None                   | USD/MMK rate (4500)                         |

### 4.3 Admin Endpoints (require JWT or X-Admin-Secret)

**Inventory:**

```
GET  /api/admin/inventory          → List stock
POST /api/admin/inventory/add      → Add item
POST /api/admin/inventory/delete   → Delete item
POST /api/admin/inventory/restock  → Update quantity
POST /api/admin/inventory/catalog/price → Update prices
GET  /api/admin/inventory/batches  → List batches
POST /api/admin/inventory/batches/create → Create batch
```

**Technicians:**

```
GET  /api/admin/technicians           → List all
POST /api/admin/technicians/create    → Create new
POST /api/admin/technicians/update    → Update details
POST /api/admin/technicians/delete    → Delete/deactivate
```

**Clients:**

```
GET  /api/admin/clients/list   → List all
POST /api/admin/clients        → Create
POST /api/admin/clients/edit   → Update
POST /api/admin/clients/delete → Delete
```

**Finance:**

```
GET  /api/admin/cash/safe           → Get balances
GET  /api/admin/cash/transactions   → List transactions
POST /api/admin/cash/transact       → Record deposit/withdrawal
GET  /api/service-fees              → List fees
POST /api/admin/service-fees/manage → CRUD fees
```

**Warranty & RMA:**

```
GET  /api/admin/warranty/list     → List warranties
POST /api/admin/warranty/register → Register warranty
GET  /api/admin/rma/list          → List RMA items
POST /api/admin/rma/update        → Update RMA
POST /api/admin/rma/raise         → Raise RMA claim
```

**Other:**

```
GET    /api/admin/distributors/list  → List distributors
POST   /api/admin/distributors/add   → Add distributor
DELETE /api/admin/distributors/delete → Delete distributor
GET    /api/admin/backup             → Full database backup
GET    /api/admin/lookups            → Clients + technicians
GET    /api/admin/resolve-coords     → Google Maps URL → lat/lng
GET    /api/portal/history           → Client service history
GET    /api/portal/warranties        → Client warranties
```

---

## 5. DATABASE SCHEMA

### 5.1 Tables (13)

| Table               | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `technicians`       | Staff registry (id, name, role, phone, email, username, password, pin, active)       |
| `clients`           | Customer registry (id, company_name, contact_person, address, phone, amc_status)     |
| `service_records`   | Job tickets (id, client_id, technician_id, service_type, status, notes, photos, GPS) |
| `inventory_stock`   | Product catalog (item_code, item_name, category, stock_qty, prices)                  |
| `inventory_batches` | Import batches (batch_code, item_code, buying_price, supplier)                       |
| `inventory_items`   | Serialized devices (serial_number, device_name, warranty, status)                    |
| `cash_safes`        | Cash vault (usd_balance, mmk_balance)                                                |
| `cash_transactions` | Transaction log (job_id, type, currency, amount, exchange_rate)                      |
| `service_fees`      | Rate card (service_type, fee_amount, currency)                                       |
| `system_config`     | Key-value settings store                                                             |
| `distributors`      | Supplier directory                                                                   |
| `messages`          | Communication log                                                                    |
| `landing_page`      | CMS content (26 columns for all editable sections)                                   |

### 5.2 Key Relationships

```
service_records.client_id → clients.id
service_records.technician_id → technicians.id
inventory_items.client_id → clients.id
inventory_items.job_id → service_records.id
inventory_items.batch_code → inventory_batches.batch_code
inventory_batches.item_code → inventory_stock.item_code
cash_transactions.job_id → service_records.id
```

---

## 6. DEPLOYMENT

### 6.1 Local Server

```bash
npm install
npm start
# Access at http://localhost:3000
```

### 6.2 Environment Variables

| Variable           | Required |
| ------------------ | -------- |
| TURSO_DATABASE_URL | Yes      |
| TURSO_AUTH_TOKEN   | Yes      |
| JWT_SECRET         | Yes      |
| ADMIN_EMAIL        | Yes      |

### 6.3 Default Credentials

| Type       | Username     | Password      |
| ---------- | ------------ | ------------- |
| Admin      | admin        | AdminPass123! |
| Technician | tech1        | tech123!      |
| Tech PIN   | TECH-KRUDXID | 1234          |

---

## 7. FILE INVENTORY

### 7.1 Root Files

| File                 | Purpose                     |
| -------------------- | --------------------------- |
| `server.js`          | Node.js server (660+ lines) |
| `schema.sql`         | Database schema             |
| `package.json`       | npm config                  |
| `tailwind.config.js` | Tailwind config             |
| `netlify.toml`       | Netlify config              |

### 7.2 Public Files (7 pages)

| File             | Purpose         |
| ---------------- | --------------- |
| `index.html`     | Landing page    |
| `admin.html`     | Admin dashboard |
| `app.html`       | Technician app  |
| `portal.html`    | Client portal   |
| `jobs.html`      | Jobs dashboard  |
| `portfolio.html` | Portfolio page  |
| `contact.html`   | Contact page    |

### 7.3 Admin Views (15 files in `public/views/`)

All 15 admin sub-views loaded dynamically by `admin.js`.

### 7.4 Documentation (12 files in `docs/`)

Complete documentation index with README.md.

---

_Document generated 2026-07-11_
