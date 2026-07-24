---
name: ui-layout-guidance
description: Guidelines for implementing UI layout designs across Admin and Technician client applications. Covers mobile-first navigation, checklist flows, photo capture, signature pad, and hardware warranty tracking.
---

# UI Layout Guidelines

This skill documents and enforces layout design decisions for the KosAI service system web interfaces.

## 1. Admin Dashboard (`admin.html`)

- **Preferred Layout**: **2-Column Tabbed Layout** for resource management (e.g. Clients, Technicians, Service Fees).
  - **Left Column**: Search/filter inputs and list of records (e.g., list of clients).
  - **Right Column**: Detail panel showing selected item details, statistics, edit forms, and action buttons.
- **Benefits**: High density, quick side-by-side editing, no need to navigate away from the list context.
- **Responsiveness**: Collapse left column into a drawer/overlay menu or stack columns on mobile screens (`md` Tailwind breakpoint).

## 2. Technician Mobile UI (`app.html`)

### Navigation
- **Bottom Navigation Bar**: Fixed at bottom, 4 tabs (Jobs, Checklist, History, Settings)
- **Safe Area**: Use `env(safe-area-inset-top/bottom)` for notch and home indicator
- **Max Width**: 448px (28rem) centered on screen

### Tab Views
- **Jobs**: Single column list of active/pending job cards
- **Checklist**: Scrollable form with collapsible sections
- **History**: Single column list of completed jobs
- **Settings**: Profile, ID card, PIN change, logout

### Checklist Layout
- **Collapsible Sections**: Each section has a numbered badge, title, and chevron arrow
- **Section Content**: Hidden by default, expands on tap with smooth transition
- **Checkboxes**: Large tap targets (p-3), accent-indigo-500 color
- **Progress Bar**: Gradient from indigo to emerald, updates live

### Photo Capture
- **Layout**: 2-column grid (Before / After)
- **Tap Target**: Entire card is clickable (button element)
- **Preview**: Shows image after capture with "Remove" button below
- **No Nested Buttons**: Use single button wrapping the entire area

### Hardware Section
- **Action Toggle**: Install New / Replace Existing dropdown
- **Replace Flow**: Shows old serial number input + warranty lookup button
- **Warranty Lookup**: Displays device name, client, installed date, warranty status (active/expired), days remaining
- **New Item**: Searchable inventory dropdown with stock info
- **Warranty Selection**: 12 / 24 / 48 months dropdown

### Signature Pad
- **Canvas-based**: HTML5 Canvas with touch support
- **Drawing**: Indigo stroke (#818cf8), 2.5px width, round caps
- **Clear Button**: Top-right corner, text button
- **Hint Text**: "Draw signature above" when empty

### Completion Flow
1. **Confirmation Modal**: Fixed overlay with glass-panel card
   - Checklist progress bar
   - Photo status indicators (✅/📷)
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

## 3. Inventory Management View (`admin.html` -> `#view-inventory`)

- **Preferred Layout**: **Left Module-Based Sidebar Navigation** + **Full Width Tabular Workspace** layout.
  - **Left Sidebar**: 48px width navigation containing high contrast icon badges and system overview cards.
  - **Main Area**: Houses dynamic tables with accordion drawers (e.g. Stock Batches with expandable Serial number grids).
  - **Form Panels**: Opens quick forms in the main workspace featuring visual input grouping, live count indicators, and clean action buttons.
- **Benefits**: Modular architecture allows managing catalog data, batch costs, and serial numbers inside a unified tab.

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

## 5. Rules

- **Mobile**: Never use 2-column layout on technician app
- **Tap Targets**: Minimum 44px for interactive elements
- **Safe Areas**: Always account for notch and home indicator
- **Theme**: Support both dark and light modes
- **Accessibility**: Use semantic HTML, proper labels, and ARIA attributes
- **Performance**: Lazy load images, debounce search inputs
- **Offline**: Cache critical assets, queue offline actions
