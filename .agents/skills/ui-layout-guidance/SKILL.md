---
name: ui-layout-guidance
description: Guidelines for implementing UI layout designs across Admin and Technician client applications. Covers mobile-first navigation, checklist flows, photo capture, signature pad, and hardware warranty tracking.
---

# UI Layout Guidelines

This skill documents and enforces layout design decisions for the KosAI service system web interfaces.

## 1. Admin Dashboard (`admin.html`)

### Primary Layout: 2-Column Tabbed

- **Left Column**: Navigation sidebar panel for high-speed module switching.
  - Width: 240px (collapsible to 64px icon-only on tablet)
  - Contains: Module icons, search, filter controls
- **Right Column**: Main content area with data-grid display
  - Contains: Tables, forms, detail panels, drawer-style sub-elements

### Module Views

| View | Layout | Key Features |
|------|--------|--------------|
| Dashboard | Stat cards grid | 4-column responsive grid, quick stats, activity feed |
| Jobs/Tickets | Pipeline + cards/table | Status bar, dual view toggle, smart filters, pagination, detail modal |
| Clients | Directory + cards | Corporate/Individual client types, AMC status badges, tabbed interface |
| Inventory | Sidebar + table | Module-based sub-navigation, barcode scanner, product grid |
| Reports | Tabs + KPI cards | 6 report tabs (overview, jobs, clients, inventory, financial, technicians), date range filter |
| Attendance | Grid + table | 4 stat cards with accent bars, search, pagination, export CSV, GPS coordinates |
| Distributors | Grid + table | 4 stat cards, search, Excel export, SVG delete buttons |
| Dispatch Map | Sidebar + map | Theme selector, filter buttons with colored dots, active crews panel |
| Currency | Sidebar + ledger | Vault ledger, log transaction, sales ledger modules |
| POS | Sidebar + terminal | Checkout, credits, invoices modules |
| User Mgmt | Sidebar + panels | Registered accounts, create user, roles, permissions |
| System Settings | Tabs + forms | Company profile, users, system, receipt builder, database tabs |
| Landing Page | Form sections | Hero, stats, services, contact, footer sections |
| Portfolio | List + preview | Project list, live preview with filter buttons |

### Stat Card Pattern (New)

```html
<div class="glass-panel rounded-2xl p-5 relative overflow-hidden group hover:border-{color}-500/30 transition-all">
  <div class="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-{color}-400 to-{color}-600 rounded-l-2xl"></div>
  <div class="flex justify-between items-start mb-3">
    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Label</span>
    <div class="w-9 h-9 rounded-xl bg-{color}-500/10 flex items-center justify-center">
      <svg class="w-4 h-4 text-{color}-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
    </div>
  </div>
  <span class="text-3xl font-black text-{color}-400">Value</span>
</div>
```

- Color options: `amber`, `emerald`, `indigo`, `cyan`, `violet`, `rose`
- Left accent bar: 1px wide gradient from color-400 to color-600
- Icon badge: 36px rounded-xl with color-500/10 background
- Value: 3xl font-black in matching color
- Label: text-[10px] uppercase tracking-wider in slate-400

### Header Pattern (New)

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
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
    Button Text
  </button>
</div>
```

### Table Pattern (New)

```html
<div class="glass-panel rounded-2xl overflow-hidden">
  <div class="p-5 pb-3 flex items-center justify-between gap-4 flex-wrap">
    <!-- Search + filters -->
    <div class="relative flex-1 max-w-xs">
      <svg class="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input placeholder="Search..." class="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"/>
    </div>
    <!-- Export buttons -->
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

### Button Patterns (New)

```html
<!-- Primary CTA -->
<button class="bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl transition shadow-md flex items-center gap-1.5">
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
  Label
</button>

<!-- Ghost/Secondary -->
<button class="bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2">
  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
  Label
</button>

<!-- Export -->
<button class="flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl transition-all">
  <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">...</svg>
  Excel
</button>

<!-- Danger action (icon only) -->
<button class="text-rose-400/60 hover:text-rose-300 transition p-1 rounded-lg hover:bg-rose-500/10">
  <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">...</svg>
</button>
```

### Dispatch Form: Corporate vs Individual Client Toggle

The tickets.html dispatch form supports two client selection modes:

- **Corporate**: Shows datalist of clients where `client_type = 'Corporate'` from Clients Directory
- **Annual/AMC**: Shows Corporate clients with active AMC
- **Individual**: Shows datalist of clients where `client_type = 'Individual'`, plus "Create New Client" option

When "Create New Client" is selected, inline fields appear for name, phone, and address. The new client is created via `POST /api/clients` with `client_type = 'Individual'` before dispatch.

### Inventory Management Layout (`#view-inventory`)

**Preferred Layout**: Left Module-Based Sidebar Navigation + Full Width Tabular Workspace.

#### Left Sidebar (48px width)
```
┌─────────┐
│ [icon]  │  Stock Batches
│ [icon]  │  Sales Pricing
│ [icon]  │  Device Catalog
│ [icon]  │  Add Item
│ [icon]  │  Categories
│ [icon]  │  Brands
└─────────┘
```

- High contrast icon badges
- System overview cards
- Module switching via `switchInvModule()`

#### Main Workspace
- Dynamic tables with accordion drawers
- Expandable serial number grids
- Quick action forms in workspace area
- Visual input grouping
- Live count indicators

### High-Density Tables

```css
/* Table styling */
.data-table th {
  padding: 12px 16px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}
.data-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}
```

---

## 2. Technician Mobile UI (`app.html`)

### Navigation

- **Bottom Navigation Bar**: Fixed at bottom, 4 tabs
  - Jobs | Checklist | History | Settings
- **Safe Area**: Use `env(safe-area-inset-top/bottom)` for notch and home indicator
- **Max Width**: 448px (28rem) centered on screen

### Tab Views

| Tab | Content | Layout |
|-----|---------|--------|
| Jobs | Active/pending job cards | Single column list |
| Checklist | Scrollable form | Collapsible sections |
| History | Completed jobs | Single column list |
| Settings | Profile, ID card, PIN | Single column list |

### Checklist Layout

```
┌─────────────────────────────────────┐
│ [1] Pre-Service Checks      [▼]    │
│ ┌─────────────────────────────────┐ │
│ │ ☐ Arrived on time              │ │
│ │ ☐ Checked equipment            │ │
│ │ ☐ Verified client details      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [2] Installation Steps      [▼]    │
│ ┌─────────────────────────────────┐ │
│ │ ☐ Mounted cameras              │ │
│ │ ☐ Ran cables                   │ │
│ │ ☐ Configured NVR               │ │
│ └─────────────────────────────────┘ │
│                                     │
│ Progress: ████████░░ 80%           │
└─────────────────────────────────────┘
```

- **Collapsible Sections**: Numbered badge, title, chevron arrow
- **Section Content**: Hidden by default, expands on tap
- **Checkboxes**: Large tap targets (p-3), accent-indigo-500 color
- **Progress Bar**: Gradient from indigo to emerald, updates live

### Photo Capture

```
┌─────────────────────────────────────┐
│         BEFORE          AFTER       │
│  ┌──────────────┐  ┌──────────────┐│
│  │              │  │              ││
│  │   📷         │  │   📷         ││
│  │   Add Photo  │  │   Add Photo  ││
│  │              │  │              ││
│  └──────────────┘  └──────────────┘│
└─────────────────────────────────────┘
```

- **Layout**: 2-column grid (Before / After)
- **Tap Target**: Entire card is clickable (button element)
- **Preview**: Shows image after capture with "Remove" button below
- **No Nested Buttons**: Use single button wrapping the entire area

### Hardware Section

```
┌─────────────────────────────────────┐
│ Action: [Install New ▼]            │
│                                     │
│ Serial Number: [_______________]   │
│ [🔍 Check Warranty]                │
│                                     │
│ ┌─ Warranty Status ──────────────┐ │
│ │ Device: Hikvision DS-2CD2143  │ │
│ │ Client: Omega Logistics        │ │
│ │ Installed: 2024-01-15         │ │
│ │ Status: ✅ Active (245 days)  │ │
│ └────────────────────────────────┘ │
│                                     │
│ New Device: [Search inventory...]  │
│ Stock: 12 units | $45.00 / MMK    │
│ Warranty: [12] [24] [48] months   │
└─────────────────────────────────────┘
```

### Signature Pad

- **Canvas-based**: HTML5 Canvas with touch support
- **Drawing**: Indigo stroke (#818cf8), 2.5px width, round caps
- **Clear Button**: Top-right corner, text button
- **Hint Text**: "Draw signature above" when empty

### Completion Flow

1. **Confirmation Modal**: Fixed overlay with glass-panel card
   - Checklist progress bar
   - Photo status indicators (checkmark/camera icon)
   - Hardware list
   - Signature preview
   - Notes
   - Back / Confirm buttons

2. **Receipt Modal**: Shows after submission
   - Job info (ID, client, type, technician, date)
   - Checklist count
   - Hardware count
   - Signature status
   - Photo upload status
   - Done button

### ID Card

- **Front**: Photo, name, role, ID, mini QR, phone, status bar
- **Back**: Security header, magnetic strip, notice text, large QR, website, email
- **Flip Animation**: Scale + fade (0.35s ease), not 3D transform
- **QR Codes**: Generated via QRCode.js into div containers (not img elements)

### Theme Toggle

- **Position**: Header right side
- **Icons**: Moon (dark) / Sun (light)
- **Persistence**: localStorage key `am-theme`

---

## 3. Responsive Patterns

### Mobile Breakpoints

```css
/* Mobile first */
.container {
  padding: 16px;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 24px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    padding: 32px;
  }
}
```

### Grid Systems

```css
/* Stat cards - responsive grid */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

@media (min-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

/* Inventory modules - sidebar + content */
.inventory-layout {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 16px;
}
```

---

## 4. Design System

### Colors

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

### Glass Morphism

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

### Input Styles

```css
.input-dark {
  background-color: var(--bg-input);
  border: 1px solid var(--border-medium);
  color: var(--text-primary);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.input-dark:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}
```

---

## 5. Admin Surveys & Quotations (`admin.html` → `#view-surveys`)

### Pipeline Status Bar

```
┌──────────────────────────────────────────────────────┐
│  Draft (3)  │  Completed (12)  │  Quoted (5)  │  ✗ (1)  │
└──────────────────────────────────────────────────────┘
```

- Horizontal stat cards showing counts per pipeline stage
- Clickable to filter the list below
- Amber accent for active filter, muted for inactive

### Tabbed Surveys / Quotations View

```
┌──────────────────────────────────────────────────────┐
│  [📋 Surveys]          [📄 Quotations]              │
├──────────────────────────────────────────────────────┤
│  List panel with search, status filter, +New button  │
│  Clicking a row opens detail panel (right side)      │
└──────────────────────────────────────────────────────┘
```

- **Tabs**: Two tabs switching between survey list and quotation list
- **Detail Panel**: Opens on row click, shows full details + actions
- **Actions**: Complete, Approve, Generate Quote, Send, Convert to Job

### Quotation Detail Panel

```
┌──────────────────────────────────────────────────────┐
│  QUO-2025A1  │  Client: Omega Logistics  │  Draft   │
├──────────────────────────────────────────────────────┤
│  Line Items Table                                     │
│  ┌─────┬──────────────┬─────┬───────┬────────┐       │
│  │ Qty │ Item         │ Unit│ Price │ Total  │       │
│  ├─────┼──────────────┼─────┼───────┼────────┤       │
│  │  8  │ Hik DS-2CD  │ pc  │ $45   │ $360   │       │
│  │ 120 │ Cat6 Cable   │ m   │ $0.50 │ $60    │       │
│  │  1  │ Install Labor│ hr  │ $95   │ $95    │       │
│  └─────┴──────────────┴─────┴───────┴────────┘       │
│                                                       │
│  Subtotal: $515.00                                    │
│  Discount (5%): -$25.75                               │
│  Tax (5%): $24.46                                     │
│  Total: $513.71                                       │
│                                                       │
│  [ + Add Item ]  [ Send to Client ]  [ Convert Job ] │
└──────────────────────────────────────────────────────┘
```

- **Line Items Table**: Editable grid with qty, name, category, unit price
- **Add Item Modal**: Select from BOM categories (hardware, cable, labor, software, other)
- **Totals Auto-Recalculate**: On every item add/edit/remove
- **Send Button**: Generates portal_token URL, opens in new tab
- **Convert Job**: 1-click creates JOB-xxx from quotation

### Add/Edit Line Item Modal

```
┌─────────────────────────────────┐
│  Add Line Item                  │
├─────────────────────────────────┤
│  Category: [Hardware ▼]        │
│  Item: [Hikvision DS-2CD2143]  │
│  Qty: [8]  Unit: [pc]          │
│  Unit Price: [$45.00]          │
│  Notes: [Main entrance camera] │
│                                 │
│  [Cancel]          [Add Item]   │
└─────────────────────────────────┘
```

- Category dropdown: hardware, cable, labor, software, other
- Item name with optional item_code
- Unit price in USD (or MMK with exchange rate)

---

## 6. Technician Survey Checklist (`app.html`)

### Expanded On-Site Survey Modal

```
┌─────────────────────────────────────┐
│  📋 On-Site Survey Checklist       │
├─────────────────────────────────────┤
│  SITE INFORMATION                   │
│  Site Type: [Commercial ▼]          │
│  Address: [___________________]     │
│  Contact: [___________] [_________] │
│  Existing Infrastructure: [_______] │
│  Special Req: [_______________]     │
│                                     │
│  SURVEY DETAILS                     │
│  Camera Count: [8]                  │
│  Cable Type: [Cat6 ▼]              │
│  Est. Cable (m): [120]             │
│  Mounting: [Wall ▼]                │
│  Power Notes: [_______________]     │
│                                     │
│  SITE PHOTOS                        │
│  ┌──────┐┌──────┐┌──────┐          │
│  │Server││Cable ││Power │          │
│  │ Room ││ Path ││Source│          │
│  └──────┘└──────┘└──────┘          │
│  ┌──────┐┌──────┐                  │
│  │Camera││Exte- │                  │
│  │  FOV ││rior  │                  │
│  └──────┘└──────┘                  │
│                                     │
│  Notes: [___________________]       │
│                                     │
│  [Cancel]     [Submit Assessment]   │
└─────────────────────────────────────┘
```

- **Photo Capture Grid**: 5 slots (server_room, cable_path, power_source, camera_fov, exterior)
- Each slot uses `<input type="file" accept="image/*" capture="environment">` for mobile camera
- Photos uploaded via `POST /api/surveys/:id/photos`
- Preview thumbnails after capture with remove option

---

## 7. Customer Portal Approval (`portal.html`)

### Quotation Approval View

Accessed via `?quote=TOKEN` URL parameter using `portal_token` UUID.

```
┌──────────────────────────────────────────────┐
│  Awesome Myanmar CCTV                        │
│  QUOTATION APPROVAL                          │
├──────────────────────────────────────────────┤
│  QUO-2025A1  │  Date: Jan 15, 2025          │
│  Client: Omega Logistics                     │
│  Prepared by: Admin                          │
│                                              │
│  ┌─────┬──────────────┬─────┬──────┬──────┐  │
│  │ Qty │ Description  │Unit │ Price│Total │  │
│  ├─────┼──────────────┼─────┼──────┼──────┤  │
│  │  8  │ Hik DS-2CD  │ pc  │ $45  │ $360 │  │
│  │ 120 │ Cat6 Cable   │ m   │ $0.50│ $60  │  │
│  │  1  │ Install Labor│ hr  │ $95  │ $95  │  │
│  └─────┴──────────────┴─────┴──────┴──────┘  │
│                                              │
│  Subtotal: $515.00  Discount: -$25.75        │
│  Tax: $24.46         TOTAL: $513.71          │
│                                              │
│  SIGNATURE                                   │
│  ┌──────────────────────────────────────┐    │
│  │  Canvas signature pad (touch/mouse)  │    │
│  │  Indigo stroke, 2.5px, round caps    │    │
│  └──────────────────────────────────────┘    │
│  [Clear]                                     │
│                                              │
│  Reason for rejection (optional):            │
│  [________________________________]          │
│                                              │
│  [ Reject ]              [ Approve & Sign ]  │
└──────────────────────────────────────────────┘
```

- **Canvas Signature Pad**: HTML5 Canvas, touch/mouse events, indigo stroke
- **Approve**: Stores base64 signature, sets `approved_at` timestamp
- **Reject**: Optional reason, sets `rejected_at` timestamp
- **Read-only Quotation**: Client cannot edit items, only approve/reject

---

## 8. Public Landing Page (`index.html`)

### Layout: Single-Page Marketing

- **Header**: Sticky nav with SVG logo, desktop nav links, theme toggle, Staff Console CTA, hamburger mobile menu
- **Hero**: Typing effect headline, gradient orbs, floating particles, parallax scrolling, dual CTA buttons
- **Services**: 3-column glass cards with icon containers (CCTV, Networking, NAS)
- **Why Choose Us**: 4-column glass cards (Licensed, 24/7 Support, AI-Powered, Myanmar Local)
- **Stats**: 4-column stat items with colored values and dividers
- **Price List**: Real-time catalog table with USD/MMK conversion
- **Quotation Form**: Glass panel form with name, phone, address, description fields
- **CTA Banner**: Gradient glass panel with dual action buttons
- **Footer**: 4-column link grid, social links (Telegram, Facebook), copyright

### Design Patterns

- **Glass Panels**: `glass-panel` class with hover glow effect and amber top border
- **Icon Containers**: 52px rounded-14px with amber gradient background and border
- **Buttons**: `btn-primary` (amber gradient with shine effect), `btn-secondary` (ghost with border)
- **Scroll Reveal**: IntersectionObserver-based fade/slide animations with stagger delays
- **Theme Toggle**: Dark/light mode with localStorage persistence and smooth transitions
- **Parallax**: Floating particles and gradient orbs with data-speed attributes

### Footer Pattern

```html
<footer class="border-t border-white/10 bg-gradient-to-b from-transparent to-black/20 py-12">
  <div class="max-w-6xl mx-auto px-6 text-center space-y-8">
    <!-- Logo -->
    <div class="flex items-center justify-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
        <svg class="w-5 h-5 text-amber-400">...</svg>
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

---

## 9. Rules

- **Mobile**: Never use 2-column layout on technician app
- **Tap Targets**: Minimum 44px for interactive elements
- **Safe Areas**: Always account for notch and home indicator
- **Theme**: Support both dark and light modes
- **Accessibility**: Use semantic HTML, proper labels, and ARIA attributes
- **Performance**: Lazy load images, debounce search inputs
- **Offline**: Cache critical assets, queue offline actions
- **Animations**: Use CSS transitions, avoid heavy JS animations
- **Touch**: Ensure touch events work alongside mouse events
- **Signature Pad**: Always use canvas-based (not image inputs), support both touch and mouse
- **Photo Capture**: Use `capture="environment"` for rear camera on mobile devices
- **Portal Auth**: Never expose quotation IDs directly; use `portal_token` UUIDs for client-facing URLs
