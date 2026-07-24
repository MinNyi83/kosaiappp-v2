---
name: kosai-admin-system
description: Comprehensive KosAI system — Admin Dashboard, Technician Mobile App, Client Portal. UI components, reports, POS, inventory, clients, users, photo uploads, warranty tracking, Telegram notifications, and system settings.
---

# KosAI Admin System Skill

Complete reference for the KosAI system — Admin Dashboard, Technician Mobile App, and Client Portal for managing CCTV/NAS/Network service operations.

## System Overview

### Tech Stack
- **Frontend**: Vanilla JS, Tailwind CSS, Chart.js, FullCalendar, Leaflet Maps
- **Backend**: Cloudflare Workers (TypeScript), D1 Database
- **PDF Generation**: jsPDF
- **Excel Export**: SheetJS (xlsx)
- **Barcode Scanning**: WebRTC Camera API
- **Photo Storage**: Google Drive API
- **Notifications**: Telegram Bot API

### Architecture
```
public/
├── app.html            # Technician mobile app
├── app.js              # Technician app logic
├── sw.js               # Service worker (offline support)
├── admin.html          # Admin dashboard (deployed)
├── admin.js            # Admin dashboard logic
├── portal.html         # Client portal
└── views/              # Admin view partials

web/
├── admin.html          # Admin dashboard (local dev)
├── admin.js            # Admin dashboard logic
└── app.html            # Technician app (local dev)

src/
├── modules/
│   ├── routes/
│   │   ├── auth.ts         # Authentication (login, Google OAuth)
│   │   ├── jobs.ts         # Jobs CRUD, photo upload, notifications
│   │   ├── inventory.ts    # Inventory, warranty, RMA
│   │   ├── admin.ts        # Admin operations
│   │   ├── public.ts       # Public endpoints (tech verification)
│   │   └── telegram.ts     # Telegram bot webhook
│   └── utils/
│       ├── google.ts       # Google Drive upload, OAuth
│       ├── telegram.ts     # Telegram notification helpers
│       └── jwt.ts          # JWT token signing/verification
└── index.ts             # Worker entry point
```

## Technician Mobile App (public/app.html + app.js)

### Tabs
1. **Jobs** — Active/pending jobs assigned to technician
2. **Checklist** — Job checklist with collapsible sections, photo capture, hardware tracking, signature
3. **History** — Completed jobs
4. **Settings** — Profile, ID card with QR, PIN change, logout

### Authentication
- Login via Employee ID + PIN: `POST /api/auth/login`
- Token stored in `localStorage` as `gate_pass_token`
- `authHeaders()` returns `{ Authorization: 'Bearer <token>' }`

### Checklist Flow
1. Start Service → sets job to "In Progress", opens checklist
2. Collapsible sections: Site Assessment, Hardware Installation, System Configuration, Quality Check, Client Handover
3. Photo Evidence: Before/After photos with camera capture and preview
4. Hardware Used/Replaced: Searchable inventory dropdown, warranty selection (12/24/48 months)
5. Old item warranty lookup: `GET /api/warranty/lookup/:serial`
6. Signature pad: Canvas-based with touch support
7. Progress bar: Updates live as items are checked

### Job Completion Flow
1. Tap "Submit & Complete Checklist" → shows confirmation summary
2. Review: checklist progress, photos, hardware, signature
3. Tap "Confirm & Submit" → parallel uploads:
   - Photos → Google Drive (`POST /api/jobs/:id/photo`)
   - Warranties → register (`POST /api/warranty/register`)
   - Status update → `POST /api/jobs/:id/status`
   - Telegram notification → `POST /api/jobs/:id/notify`
4. Receipt screen → shows completion summary
5. Returns to jobs list

### ID Card
- Front: Photo, name, role, ID, mini QR, phone, status
- Back: Security notice, large QR, website, email
- Flip animation: Scale+fade transition (CSS)
- QR codes: Generated via QRCode.js library

### Offline Support
- Service Worker caches static assets
- Jobs cached for offline viewing
- Sync queue for offline actions

## Admin Dashboard (web/admin.html + admin.js)

### Authentication
- Login via username/password: `POST /api/auth/login-password`
- Token stored in `localStorage` as `admin_token`
- Global fetch interceptor adds `Authorization: Bearer <token>` to all `/api/` requests

### Dashboard Sections
1. **Dashboard** — KPIs, charts, activity feed, dispatch map/calendar
2. **Service Tickets** — Job management, dispatch, status flow
3. **AMC Contracts** — Annual maintenance contracts
4. **Distributors** — Supplier/vendor management
5. **Warranty & RMA** — Warranty tracking, RMA claims
6. **Inventory** — Stock management, barcode scanning
7. **POS Terminal** — Point of Sale, split payment, receipts
8. **Cash Ledger** — Cash transactions
9. **Reports** — Analytics, Excel/CSV export
10. **Settings** — Users, system config, database backup

### Status Flow
```
Pending → In Progress → Completed
    ↓         ↓
Cancelled  Cancelled
```

## API Endpoints

### Auth
- `POST /api/auth/login` — Technician login (id + pin)
- `POST /api/auth/login-password` — Admin login (username + password)
- `POST /api/auth/google` — Google OAuth login
- `POST /api/auth/verify` — Verify JWT token

### Jobs
- `GET /api/jobs` — List jobs (with filters: status, technician_id, client_id, date range)
- `GET /api/jobs/:id` — Get job details
- `POST /api/jobs` — Create job
- `PUT /api/jobs/:id` — Update job (includes before_photo, after_photo, checklist_data)
- `DELETE /api/jobs/:id` — Delete job (admin only)
- `POST /api/jobs/:id/status` — Update status (sends Telegram notification)
- `POST /api/jobs/:id/photo` — Upload photo to Google Drive + Telegram
- `POST /api/jobs/:id/notify` — Send Telegram notification

### Inventory
- `GET /api/inventory` — List inventory (search, category filter)
- `GET /api/inventory/:id` — Get inventory item
- `POST /api/inventory` — Add inventory item
- `PUT /api/inventory/:id` — Update inventory item
- `DELETE /api/inventory/:id` — Delete inventory item
- `POST /api/inventory/:id/adjust` — Adjust stock quantity

### Warranty
- `GET /api/warranty/lookup/:serial` — Lookup warranty by serial number
- `POST /api/warranty/register` — Register new warranty
- `GET /api/admin/warranty/list` — List all warranties
- `POST /api/admin/rma/claim` — Raise RMA claim
- `POST /api/admin/rma/update` — Update RMA status

### Clients
- `GET /api/clients` — List clients
- `POST /api/clients` — Add client
- `PUT /api/clients/:id` — Update client
- `DELETE /api/clients/:id` — Delete client

### Admin
- `GET /api/admin/lookups` — All lookup data (clients, techs, inventory)
- `GET /api/admin/cash/safe` — Cash safe balance
- `POST /api/admin/cash/transaction` — Add cash transaction
- `GET /api/admin/users` — List users
- `POST /api/admin/users` — Add user
- `POST /api/admin/backup` — Database backup

### Public
- `GET /api/public/technician/:id` — Public technician verification

### Reports
- `GET /api/reports/dashboard` — Dashboard stats
- `GET /api/reports/jobs` — Job reports
- `GET /api/reports/export` — Export data

## Telegram Integration

### Notification Flow
1. **Status change** → Text notification with emoji, job ID, client, type, technician
2. **Photo upload** → Inline photo with caption to Telegram group
3. **Job completion** → Status text + after photo (or before photo)

### Message Format
```
✅ Job Completed

📋 Job: JOB-202
👤 Client: Omega Logistics Hub
🔧 Type: CCTV
👨‍💼 Technician: Alex Mercer
📝 5/5 checklist items, 2 hardware items used
```

### Photo Delivery
- Photos sent as inline images via `sendPhoto` API
- Uses base64 data URI for reliable delivery (avoids Drive re-download issues)
- Caption: `📸 Before/After/Signature Photo — JOB-XXX`

## Google Drive Integration

### Photo Upload Flow
1. Frontend captures photo as base64 data URI
2. Sent to `POST /api/jobs/:id/photo`
3. Backend converts base64 → Blob
4. Upload to Drive folder: `Awesome Myanmar - Service Records > {Client} > {JobId}/`
5. Returns `drive_file_id` and `photo_url`
6. Photo URL saved to `before_photo` / `after_photo` in database

### OAuth Setup
- Client ID/Secret in `.dev.vars`
- Refresh token stored in `system_config` table (key: `google_drive_refresh_token`)
- Token refreshed automatically via `getGoogleAccessToken()`

## Database Tables

```sql
-- Core Tables
technicians          -- User accounts (id, name, role, email, phone, photo, pin, password)
clients              -- Customer records (id, company_name, contact_person, phone, address, amc_status)
service_records      -- Job/ticket records (id, client_id, technician_id, service_type, status,
                       job_description, technician_notes, equipment_used, before_photo, after_photo,
                       checklist_data, arrival_time, completion_time, created_at, updated_at)
inventory_stock      -- Product catalog (item_code, item_name, category, stock_qty, unit_price)
inventory_items      -- Installed devices/warranties (serial_number, device_name, client_id,
                       installed_date, warranty_months, status, job_id)
inventory_batches    -- Purchase batches

-- Financial
cash_safes           -- Cash balance (usd_balance, mmk_balance)
cash_transactions    -- Transaction history
service_fees         -- Fee schedule

-- Config
system_config        -- Key-value settings (google_drive_refresh_token, etc.)
roles                -- Role definitions with permissions
```

## Design System

### Color Scheme
```javascript
const COLORS = {
  primary: '#f59e0b',    // Amber (primary accent)
  success: '#10b981',    // Emerald (completed, positive)
  warning: '#f59e0b',    // Amber (pending, caution)
  danger: '#ef4444',     // Rose (cancelled, error)
  info: '#3b82f6',       // Blue (in progress)
  violet: '#8b5cf6',     // Violet (admins)
  cyan: '#06b6d4',       // Cyan (technicians)
  indigo: '#6366f1',     // Indigo (accent)
};
```

### Glass Morphism CSS
```css
.glass-panel {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-md);
}
```

### Theme Variables
```css
:root, [data-theme="dark"] {
  --bg-body: #09090b;
  --bg-card: linear-gradient(145deg, rgba(20, 20, 28, 0.75), rgba(12, 12, 18, 0.85));
  --border-subtle: rgba(255, 255, 255, 0.06);
  --text-primary: #ffffff;
  --text-secondary: #e2e8f0;
}
[data-theme="light"] {
  --bg-body: linear-gradient(145deg, #f0f0ff, #e8f5e9, #f5f5ff);
  --bg-card: linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.98));
}
```

## Common Tasks

### Add New Checklist Section
1. Add section to `checklists` object in `loadChecklist()` (app.js)
2. Format: `{ section: 'Name', items: ['Item 1', 'Item 2'] }`
3. Sections auto-render as collapsible panels

### Add New Photo Type
1. Add capture button in photo section HTML (app.js `loadChecklist()`)
2. Handle in `submitChecklist()` → photo upload flow
3. Add to `POST /api/jobs/:id/photo` endpoint

### Add New Warranty Field
1. Add field to `inventory_items` table schema
2. Update `POST /api/warranty/register` endpoint
3. Update warranty lookup response

### Add Telegram Notification
1. Import `sendTelegramNotification` from `../utils/telegram.js`
2. Call with `env` and formatted text
3. For photos: use `sendTelegramPhotoNotification(env, photoSource, caption)`

## Rules

- Always use glass-panel class for containers
- Use amber (#f59e0b) as primary accent
- Support both USD and MMK currencies
- Maintain responsive design (mobile-first)
- Use Chart.js for all charts (admin)
- Store settings in localStorage
- Test all API calls with error handling
- Photos upload to Google Drive AND send to Telegram
- Warranty auto-registered on job completion
- Service worker version must match HTML script version
