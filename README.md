# Awesome Myanmar CCTV & Infrastructure Platform

A **field service management system** for CCTV, networking, and storage infrastructure in Myanmar. Built on Cloudflare Workers with a dark-themed, glass-morphism UI.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Cloudflare Workers (JavaScript) |
| **Database** | Cloudflare D1 (SQLite) |
| **Frontend** | Vanilla HTML/CSS/JS + Tailwind CSS |
| **Design** | Dark theme, glass morphism, amber accent |
| **Auth** | Google OAuth, PIN-based, username/password |
| **Desktop** | Electron + Tauri (Rust) |
| **Mobile** | Android (Java/Kotlin) |
| **CI/CD** | Wrangler CLI |

## Project Structure

```
├── src/
│   └── index.js              # Cloudflare Worker — main API backend
├── public/
│   ├── index.html             # Landing page
│   ├── admin.html             # Admin dashboard
│   ├── app.html               # Technician mobile app (web)
│   ├── portal.html            # Client portal
│   ├── jobs.html              # Job management
│   ├── portfolio.html         # Portfolio showcase
│   ├── contact.html           # Contact page
│   ├── admin.js               # Admin logic
│   ├── app.js                 # App logic
│   ├── input.css              # Tailwind input
│   ├── tailwind.css           # Compiled Tailwind
│   ├── searchable-select.js   # Reusable select component
│   ├── logo.png / logo.svg    # Brand assets
│   ├── views/                 # Admin sub-views
│   └── _headers               # Cloudflare headers config
├── functions/                 # Cloudflare Functions (if any)
├── Data/                      # Data files / exports
├── android/                   # Android native app
├── src-tauri/                 # Tauri desktop app (Rust)
├── electron-main.js           # Electron desktop entry
├── wrangler.toml              # Cloudflare Workers config
├── package.json               # Node dependencies & scripts
├── tailwind.config.js         # Tailwind CSS config
├── schema.sql                 # Database schema
├── *.sql                      # Migration / seed SQL files
├── *.py                       # Python data export scripts
└── DESIGN.md                  # Full design system documentation
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (`npm install -g wrangler`)
- A Cloudflare account with D1 database

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Build Tailwind CSS
npm run build:css

# 3. Run locally with Wrangler
npm run dev
```

### Environment Variables

Configure in `.dev.vars` (local) or Cloudflare dashboard (production):

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `ADMIN_EMAIL` | Admin email for Google auth |
| `JWT_SECRET` / `ADMIN_SECRET` | Secret for JWT tokens |

### Database

The project uses Cloudflare D1. Run migrations:

```bash
# Apply schema
wrangler d1 execute cctv-fsm-db --file=schema.sql

# Seed data
wrangler d1 execute cctv-fsm-db --file=mock_data.sql
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Wrangler dev server |
| `npm run build:css` | Build Tailwind CSS |
| `npm run watch:css` | Watch Tailwind for changes |

## API Endpoints

All endpoints are served from the Cloudflare Worker at `/api/...`:

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Technician PIN login |
| POST | `/api/auth/google` | Google OAuth login |
| POST | `/api/auth/login-password` | Username/password login |
| POST | `/api/portal/change-pin` | Change technician PIN |
| GET | `/api/jobs` | List jobs |
| POST | `/api/jobs` | Create job |
| GET | `/api/jobs/:id` | Get job details |
| PUT | `/api/jobs/:id` | Update job |
| GET | `/api/technicians` | List technicians |
| POST | `/api/technicians` | Create technician |
| GET | `/api/inventory` | List inventory |
| POST | `/api/inventory` | Add inventory item |
| GET | `/api/clients` | List clients |
| POST | `/api/clients` | Create client |

## Design System

See [DESIGN.md](./DESIGN.md) for the complete design token system including:

- Color palette (dark theme with amber accent)
- Typography (Plus Jakarta Sans, uppercase headings)
- Glass morphism components
- Spacing & border radius system
- Accessibility guidelines

## Deployment

```bash
# Deploy to Cloudflare Workers
wrangler deploy

# Deploy with Tailwind CSS built
npm run build:css && wrangler deploy
```

## License

ISC