# Awesome Myanmar CCTV & FSM Platform Design System

This document outlines the visual aesthetics, UI components, and design tokens of the Awesome Myanmar CCTV and Field Service Management (FSM) Platform.

---

## 🎨 Color Palette & Themes

The platform uses a dark mode aesthetic designed to look premium, high-tech, and easy on the eyes for both admins and field engineers.

| Token | CSS/Tailwind Color | HSL Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Background Main** | Slate 950 / Slate 900 | `hsl(222, 47%, 4%)` | Primary page body background |
| **Surface Low** | Translucent White | `rgba(255, 255, 255, 0.02)` | Table rows, card components |
| **Surface Mid** | Translucent White | `rgba(255, 255, 255, 0.04)` | Active tabs, form containers |
| **Border Soft** | Translucent White Border | `rgba(255, 255, 255, 0.06)` | Standard card/modal borders |
| **Border Active** | Translucent White Border | `rgba(255, 255, 255, 0.15)` | Focus/Active state borders |
| **Accent Primary** | Amber 500 | `hsl(38, 92%, 50%)` | Primary buttons, active alerts |
| **Accent Secondary** | Sky 500 | `hsl(199, 89%, 48%)` | Pricing actions, secondary controls |
| **Error / Alert** | Rose 500 | `hsl(343, 90%, 53%)` | Delete/Cancel actions |

---

## 🫧 Glassmorphism System

All panels, cards, and modal elements utilize a glassmorphism style to create depth:

```css
/* Core Glass Card Token */
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
  border-radius: 12px;
}
```

---

## 🔤 Typography & Hierarchy

We use modern sans-serif typography for clean, readable layout structures:

* **Font Family:** `Plus Jakarta Sans`, `Inter`, sans-serif.
* **Font Weights:** Medium (500) for body, Bold (700) for titles, Black (900) for badges/labels.
* **Heading Style:**
  * Titles: Capitalized, clean, bold with tracking.
  * Meta Labels: Mini uppercase labels with wide tracking (`tracking-[0.15em] text-[8px] font-black text-slate-500`).

---

## 📱 Layout Structures & Viewports

### 1. Admin Dashboard (`admin.html` / `admin.js`)
* **Layout Grid:** 2-Column Tabbed Layout.
  * Left Column: Navigation sidebar panel for high-speed module switching.
  * Right Column: Main data-grid display with detailed drawer-style sub-elements.
* **High-Density Tables:** Space-optimized padding (`px-4 py-2.5`) with translucent row hovering (`hover:bg-white/5`).

### 2. Technician Mobile Console (`app.html` / `app.js`)
* **Layout Grid:** Mobile-first single-column viewport layout.
* **Bottom Navigation Bar:** Prominent icons for quick tab switching on site.
* **Security PIN Screen:** Large grid-button entry matching pin verification handlers.

---

## ⚡ Interactive Micro-Animations

* **Buttons & Row Hovers:** `transition-all duration-200 ease-in-out` on all interactive buttons, links, and forms.
* **Scale Effects:** Smooth hover scaling on dashboard cards (`hover:scale-[1.01]`).
* **Price Updates:** Quick transitions on price modifications showing MMK / USD inputs.
