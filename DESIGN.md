# Awesome Myanmar CCTV & FSM Platform Design System

This document outlines the visual aesthetics, UI components, and design tokens of the Awesome Myanmar CCTV and Field Service Management (FSM) Platform.

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

- **Layout Grid:** Mobile-first single-column viewport layout.
- **Bottom Navigation Bar:** Prominent icons for quick tab switching on site.
- **Security PIN Screen:** Large grid-button entry matching pin verification handlers.

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

## Accessibility Guidelines

- **Color Contrast:** Minimum 4.5:1 for normal text, 3:1 for large text
- **Focus Indicators:** Visible focus ring (indigo-500) on all interactive elements
- **Tap Targets:** Minimum 44px for mobile touch targets
- **Semantic HTML:** Use `<nav>`, `<main>`, `<article>`, `<aside>` appropriately
- **ARIA Labels:** Add `aria-label` to icon-only buttons and form controls
- **Keyboard Navigation:** Ensure all interactive elements are focusable and operable via keyboard
