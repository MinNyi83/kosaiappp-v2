---
name: ui-layout-guidance
description: Guidelines for implementing UI layout designs across Admin and Technician client applications. Ensures standard 2-Column layout in admin panel and mobile-first navigation in technician view.
---

# UI Layout Guidelines

This skill documents and enforces layout design decisions for the CCTV Service System web interfaces.

## 1. Admin Dashboard (`admin.html`)
- **Preferred Layout**: **2-Column Tabbed Layout** for resource management (e.g. Clients, Technicians, Service Fees).
  - **Left Column**: Search/filter inputs and list of records (e.g., list of clients).
  - **Right Column**: Detail panel showing selected item details, statistics, edit forms, and action buttons.
- **Benefits**: High density, quick side-by-side editing, no need to navigate away from the list context.
- **Responsiveness**: Collapse left column into a drawer/overlay menu or stack columns on mobile screens (`md` Tailwind breakpoint).

## 2. Technician Mobile UI (`app.html`)
- **Prohibited Layout**: **Do NOT use a 2-column tabbed layout**. The screen is too narrow on mobile devices.
- **Preferred Layout**: **Bottom Navigation Bar + Single Column View Stack** or **List-to-Detail Transition**.
  - **Notch Safe Area**: Use `env(safe-area-inset-top)` on sticky headers to avoid physical screen notch overlaps.
  - **Collapsible Accordions**: Use collapsible headers with chevron arrows (`▼`) to display multiple active job tickets cleanly without cluttering the screen.
  - **Detail View**: Full-screen modal overlay or slides in to replace the main view when a job is tapped.
  - **Forms**: Single-column vertical cards with larger tap targets and inline checklist steps.
  - **On-Site Sales Actions**: Dynamic selectors populated automatically from live inventory catalog cache complete with USD/MMK dual pricing displays.

## 3. Inventory Management View (`admin.html` -> `#view-inventory`)
- **Preferred Layout**: **Left Module-Based Sidebar Navigation** + **Full Width Tabular Workspace** layout.
  - **Left Sidebar**: 48px width navigation containing high contrast icon badges and system overview cards.
  - **Main Area**: Houses dynamic tables with accordion drawers (e.g. Stock Batches with expandable Serial number grids).
  - **Form Panels**: Opens quick forms in the main workspace featuring visual input grouping, live count indicators, and clean action buttons.
- **Benefits**: Modular architecture allows managing catalog data, batch costs, and serial numbers inside a unified tab.
