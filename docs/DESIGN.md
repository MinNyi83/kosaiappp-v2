# DESIGN.md — Awesome Myanmar CCTV & Infrastructure Platform

## §1 Objective

**Purpose:** Create a unified design system for the Awesome Myanmar CCTV & Infrastructure platform — a field service management system covering landing pages, admin dashboards, technician mobile apps, and client portals.

**Primary job:** Build trust through visual consistency. Every touchpoint should feel like the same company: professional, reliable, technically competent.

**Success criteria:** A new page added to this system should be indistinguishable in visual language from existing pages without referencing this document.

---

## §2 Product Context

**Platform type:** B2B field service management for CCTV, networking, and storage infrastructure in Myanmar.

**Users:**
- **Technicians** — Mobile-first, field conditions, need fast task completion
- **Admin staff** — Desktop-first, data-heavy dashboards, need efficiency
- **Clients** — Mixed devices, need clarity and trust

**Key states (90% of user time):**
- Technician: Viewing assigned jobs, updating status, capturing photos
- Admin: Scanning job lists, managing inventory, reviewing reports
- Client: Checking service history, viewing warranties

---

## §3 Visual Foundations

### Color Palette

| Token | Hex | Role | Usage |
|-------|-----|------|-------|
| `--bg-primary` | `#09090b` | Background | All page backgrounds |
| `--bg-panel` | `#121218` | Surface | Cards, panels, modals |
| `--accent` | `#f59e0b` | Brand | CTAs, active states, focus rings |
| `--accent-indigo` | `#6366f1` | Secondary | Tech app, portal, forms |
| `--success` | `#34d399` | Positive | Completed, active, stock |
| `--info` | `#38bdf8` | Neutral | Info states, pricing |
| `--warning` | `#fbbf24` | Caution | Pending, warnings |
| `--error` | `#fb7185` | Negative | Cancelled, defects, errors |
| `--text-primary` | `#ffffff` | Text | Headings, important content |
| `--text-secondary` | `rgba(255,255,255,0.6)` | Text | Body, descriptions |
| `--text-muted` | `rgba(255,255,255,0.4)` | Text | Labels, hints |

### Typography

```
Font Family: "Plus Jakarta Sans", sans-serif
Weights: 300 (light), 400 (body), 500 (medium), 600 (semibold), 700 (bold), 800 (extrabold), 900 (black)

Type Scale:
  --text-xs:   12px / 1rem     — Body text, table cells
  --text-sm:   14px / 1.25rem  — Card titles, descriptions
  --text-base: 16px / 1.5rem   — Navigation, headers
  --text-lg:   18px / 1.75rem  — Section titles
  --text-xl:   20px / 1.5rem   — Page heroes
  --text-2xl:  24px / 1.5rem   — Stat values
  --text-3xl:  30px / 1rem     — Hero numbers
  --text-4xl:  36px / 1rem     — Large display (md+)
  --text-6xl:  48px / 1rem     — Hero headlines (md+)

Transform: UPPERCASE on all headings and navigation
Tracking: 0.05em (wide) to 0.1em (wider) on uppercase text
```

### Spacing System

```
--space-1:  4px    — Tight internal spacing
--space-2:  8px    — Button padding, icon gaps
--space-3:  12px   — Card internal padding
--space-4:  16px   — Section padding
--space-6:  24px   — Section gaps
--space-8:  32px   — Large section gaps
--space-12: 48px   — Page section spacing
--space-16: 64px   — Hero section padding
```

### Border Radius

```
--radius-sm:   8px    — Buttons, badges
--radius-md:   12px   — Cards, inputs
--radius-lg:   16px   — Large cards, modals
--radius-xl:   20px   — Hero sections
--radius-full: 9999px — Pills, avatars
```

### Shadows

```
--shadow-sm:   0 1px 2px rgba(0,0,0,0.3)
--shadow-md:   0 4px 6px rgba(0,0,0,0.3)
--shadow-lg:   0 8px 32px rgba(0,0,0,0.3)
--shadow-xl:   0 12px 40px rgba(0,0,0,0.4)
--shadow-glow: 0 0 30px rgba(245,158,11,0.15)
```

### Glass Morphism

```css
.glass-panel {
  background: rgba(18, 18, 24, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.glass-panel:hover {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}
```

### Background Patterns

```css
/* Marketing pages */
body {
  background: 
    radial-gradient(circle at top right, rgba(245, 158, 11, 0.05), transparent 45%),
    radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.05), transparent 40%),
    #09090b;
}

/* Admin dashboard */
body {
  background: radial-gradient(circle at top right, #111115, #070709);
  background-attachment: fixed;
}
```

---

## §4 Accessibility

**Contrast ratios:**
- Body text on background: 4.5:1 minimum (white on #09090b = 18.1:1 ✓)
- Accent text on background: 3:1 minimum (#f59e0b on #09090b = 8.2:1 ✓)
- Status badges: Background tint ensures readability

**Focus states:**
```css
a:focus-visible, button:focus-visible, input:focus-visible {
  outline: 2px solid #f59e0b;
  outline-offset: 2px;
}
```

**Motion:** All animations respect `prefers-reduced-motion: reduce`

**Touch targets:** Minimum 44px for interactive elements on mobile

---

## §5 Voice & Tone

**Brand voice:** Professional, technically competent, trustworthy. No marketing fluff.

**Tone by context:**
- **Headlines:** Confident, direct, uppercase
- **Body text:** Clear, concise, action-oriented
- **Labels:** Technical but readable
- **Error messages:** Specific, actionable, no blame
- **Success messages:** Brief confirmation, no celebration

**Writing rules:**
- Sentence case for body text
- UPPERCASE for navigation and section headers
- Active voice preferred
- No jargon without context
- Numbers over words for stats

---

## §6 Implementation Practices

**CSS architecture:**
- Tailwind CSS via CDN for rapid development
- Custom CSS for glass morphism and animations
- CSS custom properties for token system
- Mobile-first responsive design

**Component patterns:**
- Glass panels for content containers
- Rounded corners (12-20px) for modern feel
- Subtle borders (rgba(255,255,255,0.05)) for depth
- Backdrop blur for glass effects

**Animation:**
- Duration: 0.2-0.3s for interactions
- Easing: ease or cubic-bezier for natural feel
- Respect reduced-motion preference

**Layout:**
- Max-width: 1152px (6xl) for content containers
- Responsive breakpoints: sm(640), md(768), lg(1024)
- Mobile-first approach

---

## §7 Anti-Patterns

**Avoid:**
- ❌ Gradient hero backgrounds (purple-blue-cyan radial glow)
- ❌ Rounded-16px card grids with emoji bullets
- ❌ "Seamlessly unlock your potential" copy
- ❌ Every action as filled primary button
- ❌ Isometric 3D illustrations
- ❌ Floating stat-card trios without context

**Prefer:**
- ✅ Dark backgrounds with subtle gradients
- ✅ Glass morphism for depth
- ✅ Amber accent for CTAs and active states
- ✅ Technical, specific copy
- ✅ Data-driven visuals
- ✅ Contextual action styling

---

## §8 Decision-Making

**When in doubt:**
1. Check consistency with existing pages
2. Prioritize readability over decoration
3. Maintain the dark theme integrity
4. Keep accent usage restrained

**Escalation:**
- New color? Add to palette with rationale
- New component? Document in this file
- New pattern? Add to anti-patterns if it conflicts

---

## §9 Workflow

**For new pages:**
1. Review this DESIGN.md
2. Match existing patterns exactly
3. Add new tokens/components here
4. Update anti-patterns if needed

**For modifications:**
1. Preserve existing patterns
2. Document any deviations
3. Test across all page types

**File locations:**
- Landing page: `public/index.html`
- Admin: `public/admin.html` + `public/views/`
- App: `public/app.html`
- Portal: `public/portal.html`
- Jobs: `public/jobs.html`
- Portfolio: `public/portfolio.html`
- Contact: `public/contact.html`

---

## §10 ID Card Specifications

This section governs the design and production requirements for the physical and digital technician security identification cards.

### 1. Physical Dimensions (CR80 Standard)
- **Dimensions:** Standard CR80 credit card size: 85.60 mm × 53.98 mm (3.370 in × 2.125 in).
- **Layout orientation:** Vertical/Portrait layout preferred for technician ID badges.
- **Resolution:** 300 DPI minimum for physical printing (1012 × 638 pixels canvas size).

### 2. Photo Handling & Standardization
- **Aspect Ratio:** 1:1.25 portrait crop (standard passport ratio).
- **Styling:** Circular or rounded-md container with a subtle border tint (`rgba(255, 255, 255, 0.1)`) and an inner drop-shadow.
- **Color treatment:** The photo background must match the neutral brand colors (solid slate/dark gray) to maintain theme consistency.
- **Fallback placeholder:** If a photo is absent, render a high-contrast vector silhouette with the initials overlay.

### 3. QR Code Integration
- **Purpose:** Security validation. Scanning the QR code points to the secure gate verification API route.
- **Sizing:** 20 mm × 20 mm square.
- **Error Correction:** Level M (15% restoration) or Level Q (25% restoration) to ensure readability on scratched or scuffed physical badges.
- **Quiet Zone:** Minimum 2.5 mm border margin surrounding the QR code block.

### 4. Print & Production Specifications
- **Bleed Area:** 3 mm (0.125 in) border expansion on all sides.
- **Color Profile:** CMYK color space conversion (using target swatch matches for `#09090b` and `#f59e0b` brand colors) to prevent muddy tones.
- **Card Stock:** 30 mil (0.76 mm) PVC plastic or high-density composite Teslin core with a matte overlays.

### 5. Three-Surface Adaptation
- **Web UI Preview:** High-fidelity interactive CSS grid layout displaying front and back flipping card previews.
- **PDF Export:** Vector-scaled layout utilizing `@media print` CSS rules, disabling background pattern gradients to print pure solids with crop/bleed guidelines.
- **Physical Print Output:** Exact 1:1 scale export with bleed edges preserved for high-speed thermal badge printers.

---

## §11 Decision Trace

The following records the key architectural and design trade-offs made during the implementation of the platform:

| # | Choice | Selected Option | Rejected Option | Trade-off / Rationale |
|---|---|---|---|---|
| **1** | **Standard CR80 dimensions** | Strict 85.6mm × 53.98mm container boundaries | Dynamic flexible screen layouts | **Strict constraints:** Guarantees that export maps precisely to physical badges without scaling skew, sacrificing browser viewport layout fluidity. |
| **2** | **QR Error Correction** | Level M (15% redundancy) | Level H (30% redundancy) | **Scanning speed vs density:** Level M balances high density (allowing longer secure validation URLs) with robust scuff/dirt resilience on-site. |
| **3** | **Photo background tint** | Dark slate background overlay | Original color backgrounds | **Aesthetic cohesion:** Standardizing backgrounds guarantees the badge fits the premium corporate brand identity, sacrificing raw realism. |
| **4** | **Card Preview Flipping** | Pure CSS 3D transforms | JavaScript-managed toggles | **Performance:** Pure CSS animations are GPU-accelerated and run lag-free on low-end mobile devices, though harder to audit programmatically. |
| **5** | **Typography scale** | Plus Jakarta Sans vector embed | Browser system sans-serif | **Legibility:** Standardizing on Jakarta ensures clean geometric rendering on micro-printed text lines, increasing final PDF output size. |
| **6** | **Color Profiles** | Dual RGB/CMYK swatches | Single RGB styling rules | **Consistency:** Maps exact screen colors to distinct physical printer ink profiles to avoid flat and washed-out amber tones in print. |
