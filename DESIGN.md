# KosAI CCTV & FSM Platform Design System

This document outlines the visual aesthetics, UI components, and design tokens of the KosAI CCTV and Field Service Management (FSM) Platform.

---

## Color Palette & Themes

The platform supports both **dark mode** and **light mode** themes with consistent design tokens across all pages.

### Semantic Color System

| Role | Color | Hex | Tailwind | Usage |
|------|-------|-----|----------|-------|
| **Primary** | Amber | `#f59e0b` | `amber-500` | CTAs, active states, alerts |
| **Success** | Emerald | `#10b981` | `emerald-500` | Completed, positive, in-stock |
| **Warning** | Amber | `#f59e0b` | `amber-500` | Pending, caution, low-stock |
| **Danger** | Rose | `#ef4444` | `rose-500` | Cancelled, error, out-of-stock |
| **Info** | Blue | `#3b82f6` | `blue-500` | In progress, links |
| **Admin** | Violet | `#8b5cf6` | `violet-500` | Admin-only indicators |
| **Technician** | Cyan | `#06b6d4` | `cyan-500` | Technician-specific UI |
| **Accent** | Indigo | `#6366f1` | `indigo-500` | Focus rings, secondary accent |

### Dark Mode (Default)

| Token | CSS Value | Purpose |
|-------|-----------|---------|
| **Background Main** | `#09090b` | Primary page body background |
| **Background Gradient** | `linear-gradient(145deg, #09090b, #0f0f14)` | Subtle depth effect |
| **Surface Low** | `rgba(255, 255, 255, 0.02)` | Table rows, card components |
| **Surface Mid** | `rgba(255, 255, 255, 0.04)` | Active tabs, form containers |
| **Surface High** | `rgba(255, 255, 255, 0.06)` | Modals, dropdowns |
| **Border Soft** | `rgba(255, 255, 255, 0.06)` | Standard card/modal borders |
| **Border Medium** | `rgba(255, 255, 255, 0.10)` | Input borders |
| **Border Active** | `rgba(255, 255, 255, 0.15)` | Focus/Active state borders |
| **Text Primary** | `#ffffff` | Headings, important text |
| **Text Secondary** | `#e2e8f0` | Body text |
| **Text Muted** | `#94a3b8` | Labels, captions |
| **Text Disabled** | `#475569` | Disabled elements |

### Light Mode

| Token | CSS Value | Purpose |
|-------|-----------|---------|
| **Background Main** | `#f8fafc` | Primary page body background |
| **Background Gradient** | `linear-gradient(145deg, #f0f0ff, #e8f5e9, #f5f5ff)` | Subtle depth effect |
| **Surface Low** | `rgba(241, 245, 249, 0.5)` | Table rows, card components |
| **Surface Mid** | `rgba(241, 245, 249, 0.8)` | Active tabs, form containers |
| **Surface High** | `rgba(255, 255, 255, 0.95)` | Modals, dropdowns |
| **Border Soft** | `rgba(0, 0, 0, 0.06)` | Standard card/modal borders |
| **Border Medium** | `rgba(0, 0, 0, 0.10)` | Input borders |
| **Border Active** | `rgba(0, 0, 0, 0.15)` | Focus/Active state borders |
| **Text Primary** | `#0f172a` | Headings, important text |
| **Text Secondary** | `#1e293b` | Body text |
| **Text Muted** | `#475569` | Labels, captions |
| **Text Disabled** | `#94a3b8` | Disabled elements |

### Theme Toggle System

- **Toggle Button:** Located in header, amber-themed with moon/sun icon
- **Persistence:** Saved to `localStorage('am-theme')`
- **OS Detection:** Auto-detects `prefers-color-scheme` on first visit
- **Smooth Transition:** 0.4s ease transitions between themes

---

## Component Library

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #ffffff;
  font-weight: 600;
  border-radius: 12px;
  padding: 10px 20px;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);
}

/* Danger Button */
.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  /* Same structure as primary */
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
}
.btn-ghost:hover {
  background: var(--surface-mid);
}
```

### Cards

```css
/* Standard Card */
.card {
  background: var(--bg-card);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}
.card:hover {
  border-color: var(--border-active);
}

/* Stat Card */
.stat-card {
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}
.stat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Forms

```css
/* Input Field */
.input-field {
  background-color: var(--bg-input, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border-medium);
  color: var(--text-primary);
  border-radius: 12px;
  padding: 12px 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.input-field:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  outline: none;
}
.input-field::placeholder {
  color: var(--text-muted);
}

/* Select Dropdown */
.select-field {
  /* Same as input-field */
  appearance: none;
  background-image: url("data:image/svg+xml,...chevron...");
  background-repeat: no-repeat;
  background-position: right 12px center;
}
```

### Tables

```css
/* Data Table */
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-subtle);
}
.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s ease;
}
.data-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}
```

### Badges & Status

```css
/* Status Badge */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.badge-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.badge-progress { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.badge-completed { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.badge-cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
.badge-approved { background: rgba(16, 185, 129, 0.2); color: #34d399; }
.badge-quoted { background: rgba(167, 139, 250, 0.2); color: #c084fc; }
.badge-converted { background: rgba(56, 189, 248, 0.2); color: #38bdf8; }
```

### Modals

```css
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  animation: fadeIn 0.2s ease;
}
.modal-content {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  max-width: 480px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  animation: slideUp 0.3s ease;
}
```

---

## Glassmorphism System

All panels, cards, and modal elements utilize a glassmorphism style to create depth:

```css
/* Core Glass Card Token - Dark Mode */
.glass-panel {
  background: linear-gradient(145deg, rgba(20, 20, 28, 0.75) 0%, rgba(12, 12, 18, 0.85) 100%);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  border-radius: 16px;
}

/* Core Glass Card Token - Light Mode */
[data-theme="light"] .glass-panel {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

---

## Typography & Hierarchy

We use modern sans-serif typography for clean, readable layout structures:

- **Font Family:** `Plus Jakarta Sans`, `Inter`, sans-serif.
- **Font Weights:** Medium (500) for body, Bold (700) for titles, Black (900) for badges/labels.
- **Heading Style:**
  - Titles: Capitalized, clean, bold with tracking.
  - Meta Labels: Mini uppercase labels with wide tracking (`tracking-[0.15em] text-[8px] font-black text-slate-500`).

---

## Layout Structures & Viewports

### 1. Admin Dashboard (`admin.html` / `admin.js`)

- **Layout Grid:** 2-Column Tabbed Layout.
  - Left Column: Navigation sidebar panel for high-speed module switching.
  - Right Column: Main data-grid display with detailed drawer-style sub-elements.
- **High-Density Tables:** Space-optimized padding (`px-4 py-2.5`) with translucent row hovering (`hover:bg-white/5`).
- **Mobile:** Bottom navigation bar with 5 tabs (Home, Tickets, Clients, Stock, More).

### 2. Technician Mobile Console (`app.html` / `app.js`)

- **Layout Grid:** Mobile-first single-column viewport layout with gradient background.
- **Auth Screen:** Indigo icon badge, user/lock input icons, loading spinner on sign-in button.
- **Header:** User avatar badge, attendance clock in/out button with status bar, SVG icon buttons.
- **Bottom Navigation Bar:** SVG icons (clipboard, check-circle, clock, settings-gear) with badge slot on Jobs tab.
- **Attendance System:** Clock in/out with GPS coordinates via `/api/attendance/clock-in` and `/clock-out`.
- **Theme Toggle:** Dark/light mode with smooth transitions.

---

## Responsive Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| `sm` | 640px | Small tablets, large phones landscape |
| `md` | 768px | Tablets, small laptops |
| `lg` | 1024px | Laptops, desktops |
| `xl` | 1280px | Large desktops |

### Mobile-First Patterns

```css
/* Stack columns on mobile, side-by-side on desktop */
.grid-responsive {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 768px) {
  .grid-responsive {
    grid-template-columns: 1fr 1fr;
  }
}

/* Hide sidebar on mobile, show on desktop */
.sidebar {
  display: none;
}
@media (min-width: 1024px) {
  .sidebar {
    display: block;
  }
}
```

---

## Interactive Micro-Animations

- **Buttons & Row Hovers:** `transition-all duration-200 ease-in-out` on all interactive buttons, links, and forms.
- **Scale Effects:** Smooth hover scaling on dashboard cards (`hover:scale-[1.01]`).
- **Price Updates:** Quick transitions on price modifications showing MMK / USD inputs.
- **Theme Toggle:** 0.4s smooth transitions between dark and light modes.
- **Toast Notifications:** Slide-in animation from top center, auto-dismiss after 3 seconds.
- **Scroll Reveal:** Fade-up animation for elements entering viewport.

### Animation Library

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Slide Down */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-16px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Scale In */
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* Pulse */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Spin */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

---

## Spacing & Sizing System

### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Tight spacing, icon gaps |
| `sm` | 8px | Compact elements |
| `md` | 16px | Standard padding |
| `lg` | 24px | Section spacing |
| `xl` | 32px | Page margins |
| `2xl` | 48px | Major section breaks |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 8px | Buttons, inputs |
| `md` | 12px | Cards, dropdowns |
| `lg` | 16px | Modals, panels |
| `xl` | 20px | Large modals |
| `full` | 9999px | Pills, avatars |

### Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
--shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
--shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.4);
```

---

## Survey & Quotation System (Redesigned v2)

### Pipeline Flow

```
Draft → Completed → Quoted → Sent → Approved → Converted
  │         │          │        │        │          │
  │         │          │        │        │     ┌────┴────┐
  │         │          │        │        │   Job      Invoice
  │         │          │        │        │
  │         │          │        │     Portal
  │         │          │        │    Approval
  │         │          │        │
  │         │          │     Telegram
  │         │          │    Notification
  │         │          │
  │         │       AI BOM
  │         │     Estimation
  │         │
  │      Site Photos
  │     Photo Capture
  │
  New Survey
```

### Survey Photo Types

| Photo Type | Description | Capture Context |
|------------|-------------|-----------------|
| `server_room` | Server room / rack area | Technician on-site |
| `cable_path` | Cable routing paths | Technician on-site |
| `power_source` | Power outlets / UPS | Technician on-site |
| `camera_fov` | Camera field of view | Technician on-site |
| `exterior` | Building exterior | Technician on-site |
| `general` | General site photos | Any |

### Quotation Line Item Categories

| Category | Icon | Examples |
|----------|------|----------|
| `hardware` | 📦 | Cameras, NVR, switches, routers |
| `cable` | 🔌 | Cat6, Cat6a, fiber, conduit |
| `labor` | 👷 | Installation, configuration, testing |
| `software` | 💿 | licenses, NVR software, mobile apps |
| `other` | 📎 | Mounting brackets, patch panels, misc |

### Line Item Component

```css
/* Line item row */
.line-item-row {
  display: grid;
  grid-template-columns: 60px 1fr 80px 80px 100px 40px;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  transition: background 0.15s ease;
}
.line-item-row:hover {
  background: rgba(255, 255, 255, 0.02);
}

/* Category badge */
.category-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}
.category-hardware { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
.category-cable { background: rgba(16, 185, 129, 0.15); color: #10b981; }
.category-labor { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
.category-software { background: rgba(139, 92, 246, 0.15); color: #8b5cf6; }
.category-other { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }
```

### Quotation Totals Row

```css
.quotation-totals {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding: 12px 16px;
  border-top: 2px solid var(--border-subtle);
}
.quotation-totals .row {
  display: flex;
  justify-content: space-between;
  width: 280px;
  font-size: 13px;
}
.quotation-totals .total-row {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  border-top: 1px solid var(--border-subtle);
  padding-top: 4px;
}
```

### Signature Pad (Portal & Technician)

```css
/* Canvas signature container */
.signature-pad-container {
  position: relative;
  border: 1px dashed var(--border-medium);
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-input);
}
.signature-pad-container canvas {
  display: block;
  width: 100%;
  height: 150px;
  touch-action: none;
}
.signature-pad-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  pointer-events: none;
}
.signature-pad-clear {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  color: var(--text-muted);
  background: var(--surface-mid);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  padding: 2px 8px;
  cursor: pointer;
}
```

### Photo Capture Grid (Technician Survey)

```css
/* 5-slot photo capture grid */
.photo-capture-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.photo-capture-slot {
  position: relative;
  aspect-ratio: 1;
  border: 1px dashed var(--border-medium);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}
.photo-capture-slot:hover {
  border-color: var(--accent-indigo);
  background: rgba(99, 102, 241, 0.05);
}
.photo-capture-slot img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-capture-slot .label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

### Portal Approval Layout

```css
/* Portal quotation view - centered card */
.portal-quotation {
  max-width: 640px;
  margin: 0 auto;
  padding: 24px;
}
.portal-quotation .header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.portal-quotation .actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}
.portal-quotation .btn-approve {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  font-weight: 700;
  padding: 12px 24px;
  border-radius: 12px;
}
.portal-quotation .btn-reject {
  background: transparent;
  border: 1px solid var(--border-medium);
  color: var(--text-secondary);
  padding: 12px 24px;
  border-radius: 12px;
}
```

---

## Accessibility Guidelines

- **Color Contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators:** Visible focus ring (indigo-500) on all interactive elements
- **Tap Targets:** Minimum 44px for mobile touch targets
- **Semantic HTML:** Use `<nav>`, `<main>`, `<article>`, `<aside>` appropriately
- **ARIA Labels:** Add `aria-label` to icon-only buttons and form controls
- **Keyboard Navigation:** Ensure all interactive elements are focusable and operable via keyboard
- **Signature Pad:** Provide aria-label for canvas, keyboard clear button accessible
- **Photo Capture:** Label each slot with photo type name for screen readers
- **Portal Auth:** Use UUID-based `portal_token` for client-facing URLs, never expose internal IDs

---

## Architecture: Modular Monolith with Service Layer

### Overview

The backend follows a **modular monolith** pattern with a clean **service layer** extraction. Route handlers are thin HTTP adapters that delegate business logic to service classes.

```
src/index.ts                    ← Route registration
src/modules/routes/*.ts         ← Thin HTTP handlers (auth, CSRF, request/response)
src/modules/services/*.ts       ← Business logic (CRUD, validation, calculations)
src/modules/utils/*.auth, csrf, response, google, telegram, ai
```

### Service Layer Pattern

Each service class:
- Accepts `D1Database` via constructor for testability
- Contains pure business logic (no HTTP concerns)
- Uses parameterized queries (never string interpolation)
- Returns plain objects (not Response objects)

```typescript
// Example: JobService constructor
export class JobService {
  constructor(private db: D1Database) {}
  
  async list(filters, userId?, isAdmin?) { ... }
  async getById(id) { ... }
  async create(data) { ... }
  async update(id, data) { ... }
}
```

### Service Files

| Service | File | Responsibilities |
|---------|------|------------------|
| `SurveyService` | `services/survey.service.ts` | Survey CRUD, photos, status counts |
| `QuotationService` | `services/quotation.service.ts` | Quotation CRUD, line items, totals, portal, revisions, stock deduction |
| `JobService` | `services/job.service.ts` | Job CRUD, status changes, calendar, receipt |
| `ClientService` | `services/client.service.ts` | Client CRUD, search, AMC status |
| `InventoryService` | `services/inventory.service.ts` | Inventory CRUD, stock tracking, batches, warranty, RMA |

### Route Handler Pattern

Route files are thin HTTP adapters:
- Handle authentication and CSRF
- Parse request (URL params, JSON body)
- Call service methods
- Return JSON responses

```typescript
// Example: POST /api/jobs
router.post('/api/jobs', async (request) => {
  const user = await authenticate(request);
  if (!user) return error('Unauthorized', 401);
  if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
  
  const body = await request.json();
  const result = await jobService.create(body);
  return success(result, 201);
});
```

---

## Security Posture

### Authentication & Authorization

- **JWT-based** auth via `authenticate()` middleware on all protected endpoints
- **Role-based access**: Admin-only endpoints check `user.role?.toLowerCase() === 'admin'`
- **CSRF protection**: `requireCsrf()` on all state-changing endpoints (POST/PUT/DELETE)
- **Portal endpoints**: Token-based (UUID `portal_token`), no auth/CSRF — public customer-facing
- **Telegram webhook**: Verified via `TELEGRAM_WEBHOOK_SECRET` header, called by Telegram servers

### Endpoint Security Matrix

| Category | Auth | CSRF | Admin Check |
|----------|------|------|-------------|
| Login (`POST /api/auth/login-password`) | None | No | No |
| Portal (`GET/POST /api/portal/quote/:token/*`) | Token-based | No | No |
| Telegram webhook | Secret header | No | No |
| All other `GET` endpoints | JWT required | No (read-only) | No |
| All `POST/PUT/DELETE` endpoints | JWT required | Yes | As needed |

### Input Validation

- **Parameterized queries**: All SQL uses `.bind()` — never string interpolation
- **Field allowlists**: Update operations only accept known fields
- **Type checking**: Status values validated against allowed lists
- **Size limits**: Photo uploads capped at 10MB

### CSRF Implementation

```typescript
// CSRF token is HMAC-SHA256 of userId + timestamp + nonce
// Verified via X-CSRF-Token header
// Skips GET/HEAD/OPTIONS (safe methods)
export function requireCsrf(request, userId): boolean
```

---

## Telegram Bot Features

### Overview

The Telegram bot provides field technicians with a mobile-first interface for job management, attendance, and team coordination.

### Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all commands |
| `/clock` | Quick clock status summary |
| `/checkin` or `/clockin` | Clock in for today |
| `/checkout` or `/clockout` | Clock out |
| `/status` | Check clock-in status & active jobs |
| `/report` | Weekly attendance summary |
| `/team` | See who is currently clocked in |
| `/leaderboard` | Weekly hours leaderboard |
| `/history` | My clock-in/out history this week |
| `/jobs` | List your active jobs |
| `/completed` | List your completed jobs |
| `/today` | Show today's jobs & attendance |
| `/ticket JOB-xxx` | View job details |
| `/accept JOB-xxx` | Accept a job assignment |
| `/assign JOB-xxx TechName` | Assign technician |
| `/cancel JOB-xxx` | Cancel a job |
| `/stats` | Your performance stats (completed, pending, weekly hours) |
| `/schedule` | Upcoming jobs with status and dates |
| `/broadcast msg` | Admin-only: message all active technicians |
| `/myid` | Show your Telegram ID, username, name for account linking |

### Features

- **Voice Transcription**: Send voice messages → Gemini 2.0 Flash transcribes → auto-create job ticket
- **Photo Handling**: Send photos → upload to Google Drive → attach to job
- **Location Sharing**: Share location → auto clock in/out with GPS coordinates
- **Webhook Security**: Verified via `TELEGRAM_WEBHOOK_SECRET` header
- **Technician Performance**: `/stats` shows completed jobs, pending jobs, weekly hours
- **Schedule Management**: `/schedule` shows upcoming jobs with status badges
- **Broadcast Messaging**: Admin can send messages to all active technicians

---

## Testing

### Test Infrastructure

- **Framework**: Vitest (v4.1.10)
- **E2E tests**: Wrangler `unstable_dev` with local D1
- **Unit tests**: Mock D1 database with `vi.fn()`
- **Total tests**: 143 passing across 7 test files

### Test Files

| File | Type | Coverage |
|------|------|----------|
| `e2e.test.ts` | E2E | Auth, login, RMA, warranty |
| `services.test.ts` | Unit | All 5 service classes |
| `response.test.ts` | Unit | Response utilities |
| `google.test.ts` | Unit | Google Drive integration |
| `telegram.test.ts` | Unit | Telegram notifications & commands |
| `cors.test.ts` | Unit | CORS headers |
| `sql-injection.test.ts` | Security | SQL injection prevention |

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

### Service Layer Testing Pattern

Services are tested with a mock D1 database:

```typescript
function createMockDb() {
  const chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({}),
  };
  return { prepare: vi.fn().mockReturnValue(chain) };
}

// Test: create service with mock, assert SQL calls
const db = createMockDb();
const service = new JobService(db as any);
const result = await service.create({ client_id: 'CLT-001', ... });
expect(result.id).toMatch(/^SR-/);
```

---

## Sync Architecture (Offline-First)

### Overview

The platform supports **hybrid sync** between cloud D1 and local SQLite on desktop/mobile apps. This enables offline field work with automatic synchronization when connectivity returns.

### Sync Flow

```
┌─────────────────────────────────────────────────────────┐
│                   CLOUDFLARE WORKERS                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  REST API   │  │  Sync API   │  │  WebSocket      │ │
│  │  (existing) │  │  /api/sync/*│  │  /ws            │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────────┘ │
│         │                │                │             │
│         └────────────────┼────────────────┘             │
│                          │                              │
│                  ┌───────▼───────┐                      │
│                  │   D1 Database │                      │
│                  │   (cloud)     │                      │
│                  └───────┬───────┘                      │
└──────────────────────────┼──────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
     │ Tauri   │     │ Android │     │  Web    │
     │ Desktop │     │ Kotlin  │     │  PWA    │
     │ SQLite  │     │ Room    │     │ (legacy)│
     └─────────┘     └─────────┘     └─────────┘
```

### Sync API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sync/push` | POST | JWT + CSRF | Push client changes to server |
| `/api/sync/pull` | GET | JWT | Pull server changes to client |
| `/api/sync/changes` | GET | JWT + Admin | Get raw changes since timestamp |
| `/api/sync/status` | GET | JWT | Get sync status for client |

### Conflict Resolution

- **Strategy**: Last-write-wins (LWW)
- **Timestamp**: Client records include `client_timestamp`, compared to `server_timestamp`
- **Resolution**: Newer timestamp wins; older changes are overwritten
- **Logging**: All conflicts logged to `sync_log` table

### Database Schema (Sync Tables)

```sql
-- Tracks all changes across key tables for delta sync
CREATE TABLE sync_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    payload TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_timestamp TEXT NOT NULL,
    server_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for sync operations
CREATE TABLE sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('push', 'pull')) NOT NULL,
    records_synced INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('success', 'partial', 'failed')) DEFAULT 'success'
);
```

### Tracked Tables

| Table | Sync Direction | Notes |
|-------|----------------|-------|
| `service_records` | Bidirectional | Jobs created/updated offline |
| `clients` | Bidirectional | Client data |
| `technicians` | Pull only | Server is source of truth |
| `inventory_stock` | Bidirectional | Stock changes |
| `inventory_items` | Bidirectional | Installed equipment |
| `expenses` | Bidirectional | Expense submissions |
| `invoices` | Bidirectional | Invoice changes |
| `cash_transactions` | Bidirectional | Cash ledger entries |
| `attendance_log` | Bidirectional | Clock in/out from mobile |

---

## Tauri Desktop App (Windows)

### Overview

Native Windows desktop application built with **Tauri 2.0** (Rust backend + web frontend). Reuses existing admin UI patterns with local SQLite for offline access.

### Project Structure

```
admin-desktop/
├── src-tauri/                    # Rust backend
│   ├── Cargo.toml                # Dependencies
│   ├── tauri.conf.json           # App config
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # Tauri commands (12 commands)
│   │   ├── db.rs                 # Local SQLite (rusqlite)
│   │   ├── sync.rs               # Cloud ↔ Local sync
│   │   └── notifications.rs      # Native push notifications
│   └── icons/                    # App icons
└── src/                          # Web frontend
    ├── index.html                # Dashboard UI
    ├── css/admin.css             # Dark theme
    └── js/app.js                 # View switching, data loading
```

### Features

| Feature | Implementation |
|---------|----------------|
| Local SQLite | rusqlite with full CRUD |
| Auto-sync | Every 5 minutes |
| Native notifications | tauri-plugin-notification |
| System tray | Background monitoring |
| Offline-first | Queue changes, sync when online |
| Dark theme | Matches web admin |

### Tauri Commands

| Command | Description |
|---------|-------------|
| `get_jobs` | Get all jobs from local DB |
| `get_clients` | Get all clients from local DB |
| `get_inventory` | Get inventory from local DB |
| `get_technicians` | Get active technicians |
| `sync_push` | Push changes to server |
| `sync_pull` | Pull changes from server |
| `sync_full` | Bidirectional sync |
| `get_sync_status` | Get sync status |
| `notify_job_assigned` | Native notification for job assignment |
| `notify_job_completed` | Native notification for completion |
| `notify_new_message` | Native notification for messages |

### Build Commands

```bash
cd admin-desktop
npm install
npm run tauri dev        # Development mode
npm run tauri build      # Production build (~5MB)
```

---

## Android Technician App (Kotlin)

### Overview

Native Android application built with **Kotlin + Jetpack Compose**. Uses Room database for offline storage and Retrofit for API communication.

### Project Structure

```
technician-android/
├── app/src/main/java/com/kosai/tech/
│   ├── MainActivity.kt            # Entry point
│   ├── KosaiApp.kt                # App initialization
│   ├── data/
│   │   ├── model/Models.kt        # 7 Room entities + API models
│   │   ├── local/
│   │   │   ├── AppDatabase.kt     # Room database
│   │   │   └── Daos.kt            # 6 DAOs
│   │   ├── remote/
│   │   │   ├── ApiService.kt      # Retrofit interface (14 endpoints)
│   │   │   └── ApiClient.kt       # OkHttp client
│   │   └── SyncManager.kt         # Offline queue + auto-sync
│   └── ui/
│       ├── KosaiApp.kt            # Navigation + login
│       ├── theme/Theme.kt         # Dark/Light theme
│       ├── jobs/JobListScreen.kt  # Job cards + detail sheet
│       ├── attendance/AttendanceScreen.kt  # Clock in/out + GPS
│       └── settings/SettingsScreen.kt      # Sync status + account
├── app/build.gradle.kts           # Dependencies
├── build.gradle.kts               # Root config
└── settings.gradle.kts            # Project settings
```

### Features

| Feature | Implementation |
|---------|----------------|
| Room database | 7 entities, 6 DAOs |
| Retrofit | 14 API endpoints |
| Offline queue | PendingOperation table |
| Auto-sync | Every 5 minutes |
| GPS location | FusedLocationProviderClient |
| Material 3 | Compose UI components |
| Dark/Light theme | Dynamic color scheme |
| Native notifications | Firebase Cloud Messaging |

### Room Entities

| Entity | Table | Description |
|--------|-------|-------------|
| `ServiceRecord` | `service_records` | Jobs |
| `Client` | `clients` | Client data |
| `Technician` | `technicians` | Tech profiles |
| `InventoryItem` | `inventory_stock` | Stock items |
| `AttendanceLog` | `attendance_log` | Clock in/out |
| `PendingOperation` | `pending_operations` | Offline queue |
| `SyncMeta` | `sync_meta` | Sync tracking |

### API Endpoints (Retrofit)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login-password` | POST | Login |
| `/api/jobs` | GET | Get all jobs |
| `/api/jobs/{id}` | GET | Get job by ID |
| `/api/jobs/{id}` | PUT | Update job |
| `/api/clients` | GET | Get all clients |
| `/api/inventory/stock` | GET | Get inventory |
| `/api/attendance/clock-in` | POST | Clock in |
| `/api/attendance/clock-out` | POST | Clock out |
| `/api/sync/push` | POST | Push changes |
| `/api/sync/pull` | GET | Pull changes |
| `/api/sync/status` | GET | Sync status |
| `/api/reports/dashboard` | GET | Dashboard data |

### Build Commands

```bash
cd technician-android
./gradlew assembleDebug      # Debug APK
./gradlew assembleRelease    # Release APK
```

---

## WebSocket Real-time Updates

### Overview

WebSocket endpoint at `/ws` provides real-time updates for connected desktop and mobile clients.

### Connection

```javascript
const ws = new WebSocket('wss://your-worker.workers.dev/ws');

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  switch (msg.type) {
    case 'connected': // Client ID assigned
    case 'pong': // Keepalive response
    case 'job_update': // Job status changed
    case 'attendance_update': // Clock in/out
    case 'sync_needed': // Server requests sync
  }
};
```

### Message Types

| Type | Direction | Payload |
|------|-----------|---------|
| `connected` | Server → Client | `{ clientId, timestamp }` |
| `ping` | Client → Server | `{ type: 'ping' }` |
| `pong` | Server → Client | `{ timestamp }` |
| `subscribe` | Client → Server | `{ userId }` |
| `job_update` | Server → Client | `{ jobId, status, technicianId }` |
| `attendance_update` | Server → Client | `{ technicianId, action }` |
| `sync_needed` | Server → Client | `{ timestamp }` |

### Features

- **Auto-reconnect**: Clients handle disconnection
- **Stale cleanup**: Connections inactive >60s are closed
- **User targeting**: Messages can filter by userId
- **Broadcasting**: Admin can push to all connected clients

---

## Admin Module Styling

All admin dashboard modules have been upgraded with consistent modern styling. Every module follows these patterns for headers, stat cards, tables, buttons, and search inputs.

### Module Matrix

| Module | Layout | Key Features |
|--------|--------|--------------|
| **Dashboard** | Grid + Charts | 4 stat cards, 5 Chart.js charts, activity feed, quick stats |
| **Tickets** | Pipeline + cards/table | Status bar, dual view, smart filters, pagination, detail modal, dispatch form with corporate/individual toggle |
| **Clients** | Directory + cards | Corporate/Individual client types, AMC badges, tabbed interface, client dropdowns across all modules |
| **Attendance** | Grid + table | Icon header, 4 stat cards with accent bars, search, pagination, export CSV, GPS coordinates |
| **Distributors** | Grid + table | Icon header, 4 stat cards (Total, Active, Products, Contact), search, Excel export, SVG delete |
| **Dispatch Map** | Sidebar + map | Theme selector with SVG icons, filter buttons with colored dots, active crews panel |
| **Landing Page** | Form sections | Hero/Stats/Services/Contact/Footer, SVG section icons, save button |
| **Portfolio** | List + preview | Project list, live preview with filter buttons, View Live link, SVG icons |
| **Reports** | Tabs + KPI cards | 6 report tabs, KPI cards, date range filter, Chart.js charts |
| **System Settings** | Tabs + forms | Company profile, users, system, receipt builder, database tabs |
| **User Mgmt** | Sidebar + panels | Registered accounts, create user, roles, permissions |
| **Currency** | Sidebar + ledger | Vault ledger, log transaction, sales ledger modules |
| **POS** | Sidebar + terminal | Terminal checkout, credits, invoices modules |
| **Inventory** | Sidebar + table | Batches, pricing, catalog, add item, categories, brands, serial management |

### Design Patterns

#### Header Pattern
```html
<div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
  <div>
    <h1 class="text-2xl md:text-3xl font-black text-white uppercase tracking-tight flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-{color}-500/15 flex items-center justify-center">
        <svg class="w-5 h-5 text-{color}-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
      </div>
      Title
    </h1>
    <p class="text-sm text-slate-400 mt-1">Subtitle description</p>
  </div>
  <button class="bg-{color}-500 hover:bg-{color}-400 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5">
    <svg>...</svg> Button Text
  </button>
</div>
```

#### Stat Card Pattern
```html
<div class="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-{color}-500/30 transition-all">
  <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-{color}-400 to-{color}-600 rounded-l-2xl"></div>
  <div class="flex justify-between items-start mb-3">
    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Label</span>
    <div class="w-9 h-9 rounded-xl bg-{color}-500/10 flex items-center justify-center">
      <svg class="w-4 h-4 text-{color}-400">...</svg>
    </div>
  </div>
  <span class="text-3xl font-black text-{color}-400">Value</span>
</div>
```

#### Table Pattern
```html
<div class="glass-panel rounded-2xl overflow-hidden">
  <div class="p-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
    <div class="relative flex-1 max-w-xs">
      <svg class="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2">search icon</svg>
      <input class="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"/>
    </div>
    <button class="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl transition-all">Excel</button>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-xs text-left">
      <thead>
        <tr class="text-slate-500 border-b border-white/5 uppercase tracking-widest text-[9px]">
          <th class="px-5 py-3 font-semibold">Column</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        <tr class="hover:bg-white/[0.02] transition-all group">
          <td class="px-5 py-3.5">Data</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
```

#### Button Patterns
```html
<!-- Primary CTA -->
<button class="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5">
  <svg>...</svg> Label
</button>

<!-- Ghost/Secondary -->
<button class="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2">
  <svg>...</svg> Label
</button>

<!-- Export -->
<button class="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl transition-all">
  <svg>...</svg> Excel
</button>

<!-- Danger action -->
<button class="text-rose-400/60 hover:text-rose-300 transition p-1 rounded-lg hover:bg-rose-500/10">
  <svg class="w-4 h-4">...</svg>
</button>
```

### Common Elements

- **Header**: Flex layout with icon badge (rounded-xl with color accent), title (2xl/3xl font-black), subtitle (sm text-slate-400)
- **Stat Cards**: Glass panels with colored left accent bar (w-1 h-full gradient), icon badge, value (3xl font-black colored), label (text-[10px] uppercase)
- **Search/Input**: bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs with search SVG icon
- **Buttons**: Rounded-xl px-4 py-2.5 text-xs font-bold with SVG icons (no emojis)
- **Tables**: divide-y divide-white/5, hover:bg-white/[0.02], px-5 py-3.5 cells
- **Action Buttons**: SVG icons instead of emojis, rounded-lg hover:bg-{color}-500/10 transitions
- **Color palette**: amber (primary), emerald (success), indigo (info), cyan (technician), violet (admin), rose (danger)

---

## Public Landing Page (`index.html`)

### Overview

Single-page marketing site with glass morphism design, animated interactions, and dark/light theme support.

### Page Sections

| Section | Layout | Key Features |
|---------|--------|--------------|
| **Header** | Sticky nav | SVG logo, desktop nav links, theme toggle, hamburger mobile menu |
| **Hero** | Centered | Typing effect headline, gradient orbs, floating particles, parallax, dual CTA |
| **Services** | 3-column grid | Glass cards with icon containers (CCTV, Networking, NAS) |
| **Why Choose Us** | 4-column grid | Glass cards (Licensed, 24/7 Support, AI-Powered, Myanmar Local) |
| **Stats** | 4-column | Stat items with colored values and gradient dividers |
| **Price List** | Table | Real-time catalog with USD/MMK conversion |
| **Quotation Form** | Single column | Glass panel form with name, phone, address, description |
| **CTA Banner** | Full width | Gradient glass panel with dual action buttons |
| **Footer** | 4-column grid | Link sections, social icons (Telegram, Facebook), copyright |

### Design Tokens

```css
/* Landing page specific */
--bg-body: radial-gradient(ellipse at top right, rgba(245, 158, 11, 0.06), transparent 50%),
  radial-gradient(ellipse at bottom left, rgba(99, 102, 241, 0.06), transparent 45%), #09090b;

/* Glass panel hover effect */
.glass-panel:hover {
  border-color: rgba(245, 158, 11, 0.25);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(245, 158, 11, 0.1);
  transform: translateY(-4px) scale(1.01);
}

/* Icon container */
.icon-container {
  width: 52px; height: 52px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05));
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 14px;
}

/* Primary button with shine effect */
.btn-primary::before {
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  transition: left 0.6s ease;
}
.btn-primary:hover::before { left: 100%; }

/* Scroll reveal animations */
.reveal { opacity: 0; transform: translateY(30px); transition: all 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
.reveal.active { opacity: 1; transform: translateY(0); }
.reveal-delay-1 { transition-delay: 0.1s; }
.reveal-delay-2 { transition-delay: 0.2s; }
.reveal-delay-3 { transition-delay: 0.3s; }
```

### Footer Pattern

```html
<footer class="border-t border-white/10 bg-gradient-to-b from-transparent to-black/20 py-12">
  <div class="max-w-6xl mx-auto px-6 text-center space-y-8">
    <!-- Logo -->
    <div class="flex items-center justify-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <svg class="w-5 h-5 text-amber-400">settings icon</svg>
      </div>
      <span class="font-extrabold text-white tracking-wider uppercase text-sm">Awesome Myanmar</span>
    </div>
    <!-- 4-Column Link Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 text-left max-w-2xl mx-auto">
      <div class="space-y-3">
        <h4 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Section</h4>
        <div class="space-y-2">
          <a href="..." class="block text-xs text-slate-500 hover:text-amber-400 transition-colors">Link</a>
        </div>
      </div>
    </div>
    <!-- Copyright + Social -->
    <div class="border-t border-white/5 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
      <p class="text-[11px] text-slate-500">© 2026 Company. All rights reserved.</p>
      <div class="flex items-center gap-4">
        <a href="..." class="text-slate-500 hover:text-amber-400 transition-colors">
          <svg class="w-4 h-4">social icon</svg>
        </a>
      </div>
    </div>
  </div>
</footer>
```

### CTA Banner Pattern

```html
<section class="max-w-6xl mx-auto px-4 py-12">
  <div class="glass-panel rounded-3xl p-10 md:p-14 text-center space-y-6 relative overflow-hidden">
    <div class="absolute inset-0 bg-gradient-to-r from-amber-500/5 via-transparent to-indigo-500/5"></div>
    <div class="relative z-10 space-y-4">
      <h2 class="text-2xl md:text-3xl font-black text-white uppercase tracking-tight">Headline</h2>
      <p class="text-sm text-slate-400 max-w-lg mx-auto">Description text</p>
      <div class="flex flex-wrap justify-center gap-4 pt-2">
        <a href="#quotation" class="btn-primary bg-amber-500 text-black text-xs font-extrabold uppercase tracking-wider px-8 py-4 rounded-xl">
          Primary Action
        </a>
        <a href="/contact.html" class="btn-secondary bg-white/5 border border-white/10 text-white text-xs font-bold uppercase tracking-wider px-8 py-4 rounded-xl">
          Secondary Action
        </a>
      </div>
    </div>
  </div>
</section>
```
