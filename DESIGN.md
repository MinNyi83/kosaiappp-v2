# Awesome Myanmar CCTV & FSM Platform Design System

This document outlines the visual aesthetics, UI components, and design tokens of the Awesome Myanmar CCTV and Field Service Management (FSM) Platform.

---

## Color Palette & Themes

The platform supports both **dark mode** and **light mode** themes with consistent design tokens across all pages.

### Dark Mode (Default)

| Token                | CSS/Tailwind Color       | Purpose                             |
| :------------------- | :----------------------- | :---------------------------------- |
| **Background Main**  | `#09090b` with gradient  | Primary page body background        |
| **Surface Low**      | `rgba(255, 255, 255, 0.02)` | Table rows, card components     |
| **Surface Mid**      | `rgba(255, 255, 255, 0.04)` | Active tabs, form containers    |
| **Border Soft**      | `rgba(255, 255, 255, 0.06)` | Standard card/modal borders     |
| **Border Active**    | `rgba(255, 255, 255, 0.15)` | Focus/Active state borders      |
| **Text Primary**     | `#ffffff`                     | Headings, important text         |
| **Text Secondary**   | `#e2e8f0`                     | Body text                        |
| **Text Muted**       | `#94a3b8`                     | Labels, captions                 |
| **Accent Primary**   | Amber 500 `#f59e0b`          | Primary buttons, active alerts   |

### Light Mode

| Token                | CSS/Tailwind Color       | Purpose                             |
| :------------------- | :----------------------- | :---------------------------------- |
| **Background Main**  | `#f8fafc` to `#e2e8f0` gradient | Primary page body background |
| **Surface Low**      | `rgba(241, 245, 249, 0.5)` | Table rows, card components    |
| **Surface Mid**      | `rgba(241, 245, 249, 0.8)` | Active tabs, form containers   |
| **Border Soft**      | `rgba(0, 0, 0, 0.06)`      | Standard card/modal borders    |
| **Border Active**    | `rgba(0, 0, 0, 0.15)`      | Focus/Active state borders     |
| **Text Primary**     | `#0f172a`                    | Headings, important text        |
| **Text Secondary**   | `#1e293b`                    | Body text                       |
| **Text Muted**       | `#475569`                    | Labels, captions                |
| **Accent Primary**   | Amber 500 `#f59e0b`         | Primary buttons, active alerts  |

### Theme Toggle System

- **Toggle Button:** Located in header, amber-themed with moon/sun icon
- **Persistence:** Saved to `localStorage('am-theme')`
- **OS Detection:** Auto-detects `prefers-color-scheme` on first visit
- **Smooth Transition:** 0.4s ease transitions between themes

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

## Interactive Micro-Animations

- **Buttons & Row Hovers:** `transition-all duration-200 ease-in-out` on all interactive buttons, links, and forms.
- **Scale Effects:** Smooth hover scaling on dashboard cards (`hover:scale-[1.01]`).
- **Price Updates:** Quick transitions on price modifications showing MMK / USD inputs.
- **Theme Toggle:** 0.4s smooth transitions between dark and light modes.
- **Toast Notifications:** Slide-in animation from top center, auto-dismiss after 3 seconds.
- **Scroll Reveal:** Fade-up animation for elements entering viewport.
