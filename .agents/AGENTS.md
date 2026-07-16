# Project Rules

## Local Development and Cloudflare Deployment
- Always run, develop, and test the project in the local environment (e.g. using `npx wrangler dev`).
- Do NOT deploy to Cloudflare until the user explicitly requests it with **"deploy cloudflare"** or **"deploy to cloudflare"**.
- When deploying Cloudflare Pages, always target the project name `awesomemyanmar` using command: `npx wrangler pages deploy public --project-name=awesomemyanmar`.

# AI Agents System Documentation

## 🏗 Overview

This project uses AI agents to provide intelligent assistance for field service management. The system features a main UI (`app.html`, `app.js`), an admin dashboard (`admin.html`, `admin.js`), and a Cloudflare Worker backend (`wrangler.toml`, `src/index.js`, `functions/api/`). The core architecture is based on the **Field Service Worker** template, extended with admin interfaces, AI dispatching, and automated reporting.

## 🧩 Key Components

### 1. **Field Service Worker Backend**
**Location**: `src/index.js`, `wrangler.toml`, `functions/`

**Features**:
- Cloudflare Worker API endpoints for job management, technician dispatch, client profiles, and service scheduling
- D1 database for persistent storage
- AI integration using Gemini API for ticket triaging and dispatch matching
- WebSocket support for real-time job updates
- Telegram bot webhook integration (`/api/telegram-webhook`)
- **Google Drive Storage Integration (OAuth User Consent - Option B)**: Automated upload of site photos (`before_photo` and `after_photo`) into organized subfolders on the admin's personal Google Drive without requiring technicians to have Gmail accounts.

**Key Functions**:
- `handleRequest()`: Main request router
- `jobService.createJob()`: Create new work orders
- `technicianService.assignTechnician()`: Assign technicians to jobs
- `clientService.createClient()`: Manage client profiles
- `aiService.getBestTechnician()`: AI-powered technician matching
- `getGoogleAccessToken()`: Refreshes Google access token using the user's Client ID, Client Secret, and Refresh Token.
- `uploadFileToGoogleDrive()`: Main upload engine that constructs subfolders (`ClientName/JobID/`) and posts the files.
- `getOrCreateDriveFolder()`: Helper to search or recursively create folders in Google Drive.
- `telegramService.sendTelegramPhotoNotification()`: Outbound Telegram notifications (downloads images from Google Drive using OAuth first to pass binary streams to Telegram).

### 2. **Main UI**
**Location**: `public/app.html`, `public/app.js`

**Features**:
- Technician dashboard for viewing assigned jobs, starting/completing services, uploading photos, and logging time
- AI Chat interface with Gemini API for AI assistant support
- Push notifications for new job assignments
- Ticket history and service checklist management

### 3. **Admin Dashboard**
**Location**: `admin.html`, `admin.js`

**Features**:
- Full admin interface for system management
- Client management (create, edit, delete)
- Technician management (create, edit, delete, assign)
- Job management (create, assign, monitor, complete)
- Service fee management
- Service report generation
- Cash safe reconciliation

## 📋 System Setup

### Prerequisites
- Node.js and npm
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account with KV and D1 database support

### Environment Configuration
Create a `.dev.vars` file in the project root with the following variables:
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
GEMINI_API_KEY="your_gemini_api_key"
ADMIN_SECRET="your_admin_secret"

# Google OAuth Credentials (Option B)
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
GOOGLE_REFRESH_TOKEN="your_google_refresh_token"
GOOGLE_DRIVE_FOLDER_ID="your_google_drive_folder_id"
```

### Google Drive Setup & Auth (One-Time Setup)
1. Configure credentials under Google Cloud Console OAuth Client ID.
2. Add Authorized Redirect URI: `http://127.0.0.1:8787/api/setup/google-drive/callback`.
3. Publish App on the OAuth Consent Screen (or add test user `nyinyimin2007@gmail.com`).
4. Add Client ID and Client Secret to `.dev.vars`.
5. Visit `http://127.0.0.1:8787/api/setup/google-drive` to authorize.
6. Copy the generated **Refresh Token** and paste it into `.dev.vars` under `GOOGLE_REFRESH_TOKEN`.
7. Restart wrangler dev.

### Database Setup
1. Create a D1 database: `wrangler d1 create cctv-fsm-db`
2. Run migrations: `npx wrangler d1 execute cctv-fsm-db --local --remote --file=schema.sql`
3. Update `wrangler.toml` with your database ID and name

### Local Development
Run the development server: `npx wrangler dev`

### Production Deployment
Deploy to Cloudflare Workers: `npx wrangler deploy`

## 📂 File Structure

```
cctv-service-system/
├── .env                     # Environment variables
├── wrangler.toml            # Cloudflare Worker configuration
├── src/
│   └── index.js             # Main Worker application
├── public/
│   ├── app.html             # Technician UI
│   ├── app.js               # Technician UI logic
│   ├── admin.html           # Admin dashboard
│   ├── admin.js             # Admin dashboard logic
│   ├── style.css            # Global styles
│   └── favicon.svg          # Favicon
├── functions/
│   ├── api/
│   │   └── [[path]].js      # API route handler
│   └── asset-management/
│       └── [[path]].js      # Asset management endpoints
├── schema.sql               # D1 database schema
├── AGENTS.md                # AI agent configuration
├── .agents/
│   ├── AGENTS.md            # Project rules
│   └── skills/
│       ├── telegram-bot/
│       │   └── SKILL.md     # Telegram bot integration
│       └── cloudflare-polling-limits/
│           └── SKILL.md     # Cloudflare usage limits
├── exchange_token.js        # Google OAuth callback helper
├── package.json             # Project dependencies
```

## ⚙️ API Endpoints

### Google Drive Setup Flow
- `GET /api/setup/google-drive`: Starts OAuth authorization redirect
- `GET /api/setup/google-drive/callback`: Exposes success screen showing generated Refresh Token

### Job Management
- `POST /api/admin/jobs/create`: Create new job
- `POST /api/admin/jobs/assign`: Assign technician to job
- `POST /api/admin/jobs/complete`: Mark job as complete
- `GET /api/jobs/:id`: Get job details

### Technician Management
- `POST /api/admin/technicians/create`: Create technician
- `POST /api/admin/technicians/edit`: Edit technician
- `POST /api/admin/technicians/delete`: Delete technician
- `GET /api/technicians/active`: Get active technicians

### Client Management
- `POST /api/admin/clients/create`: Create client
- `POST /api/admin/clients/edit`: Edit client
- `POST /api/admin/clients/delete`: Delete client
- `GET /api/admin/clients/list`: List all clients

### Service Fee Management
- `POST /api/admin/service-fees/set`: Set service fee
- `POST /api/admin/service-fees/delete`: Delete service fee
- `GET /api/service-fees/:type`: Get service fee by type

### Cash Safe Management
- `POST /api/admin/cash-safe/record`: Record cash safe transaction
- `GET /api/admin/cash-safe/balance`: Get cash safe balance

### AI Features
- `POST /api/ai/dispatch`: AI-powered technician dispatch
- `POST /api/ai/diagnose`: AI diagnostics and repair suggestions

## 🤖 AI Dispatching

The AI dispatch system automatically matches technicians to jobs based on issue description and technician skills. See `src/index.js` for implementation details.

**Example Prompt:**
```
"Based on this CCTV installation job at [Company Name], identify the best technician from the list:

[List of technicians with their skills and experience]

Choose the technician who is best suited for this job and provide a brief reason for your choice."
```

## 🔄 Real-time Updates

The system uses WebSocket connections to provide real-time updates for:
- New job assignments
- Job status changes
- Chat messages
- System notifications

## 📝 Database Schema

### Customers Table
```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  address TEXT NOT NULL,
  phone TEXT,
  amc_status TEXT CHECK(amc_status IN ('Active', 'Inactive', 'Expired', 'No AMC', 'Individual')) DEFAULT 'Inactive',
  amc_start TEXT,
  amc_end TEXT
);
```

### Technicians Table
```sql
CREATE TABLE technicians (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  role TEXT CHECK(role IN ('Sales', 'Technician', 'Admin')) NOT NULL,
  phone TEXT,
  active INTEGER DEFAULT 1,
  email TEXT,
  username TEXT,
  password TEXT,
  pin TEXT DEFAULT '1234'
);
```

### Jobs Table
```sql
CREATE TABLE service_records (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    technician_id TEXT REFERENCES technicians(id),
    service_type TEXT CHECK(service_type IN ('CCTV', 'Networking', 'WiFi', 'NAS', 'General Maintenance')) NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')) DEFAULT 'Pending',
    job_description TEXT NOT NULL,
    technician_notes TEXT,
    equipment_used TEXT,
    before_photo TEXT,
    after_photo TEXT,
    arrival_time TEXT,
    completion_time TEXT,
    arrival_lat REAL,
    arrival_lng REAL,
    completion_lat REAL,
    completion_lng REAL,
    maps_url TEXT,
    signature TEXT,
    checklist_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## 🤖 Telegram Bot System

The project integrates a Telegram bot dispatcher engine (`/api/telegram-webhook`) that interfaces with active technicians and dispatch coordinators.

### Webhook API Actions
- **`POST /api/telegram-webhook`**: Receives webhook payloads from the Telegram API.

### Webhook Features & Command Flow
1. **Slash Commands**:
   - `/status [Ticket ID]`: Queries and formats work order details, tech assignment, status, and checklist data (renders the new multi-state indicators: 🟢 Good, 🟡 Repair, 🔵 Fixed, 🟣 Change).
   - `/assign [Ticket ID] [Tech ID/Name/Nickname]`: Searches active technician and sets assignment for the ticket. Supports multi-word names (e.g. Hein Lin Htet).
2. **AI Multimodal Dispatching & Transcription**:
   - **Voice Messages**: Receives voice messages (`audio/ogg`), gets the audio file path, downloads the bytes, and transcribes the speech with Gemini `gemini-2.5-flash`.
   - **Auto-Matcher**: Feeds transcribed text to Gemini to choose the service domain (CCTV, Networking, WiFi, NAS, General Maintenance) and assign the best technician based on experience or name/nickname mentions. Creates client and job records in D1.
   - **Dispatch Confirmation**: Messages the Telegram dispatch group with details of the assigned technician and new Job ID.
3. **Outbound Notifications**:
   - Sends before and after site photos automatically upon technician site updates.
   - Dispatches database backup logs alerts to the Telegram group chat on backups.

## 📊 Executive Reporting System

The admin dashboard includes a **Dynamic Report Builder** matching modern SaaS aesthetics.

### Available Custom Reports:
- **Technician Performance Audit**: Compiles task completion rates, active ticket logs, and assigned loads by engineer.
- **Customer Service Audit**: Breaks down ticket history counts, AMC status, and total dollar-revenue contributed per client.
- **Job History Ledger**: Summarizes job types, technicians assigned, created dates, and current statuses in an audit grid.

### Timeframe Scopes:
- **Monthly**: This Month, Last Month
- **Yearly**: This Year, Last Year
- **Custom Relative**: Last 30 Days, Last 90 Days, All-Time Records

## 🤖 Gemini API Dual-Gateway Routing

To bypass local country geo-blocks (e.g. running from Myanmar) during local development (`npx wrangler dev`), the worker routes Gemini queries through a dual-gateway system:
1. **Primary Endpoint**: Direct query to `generativelanguage.googleapis.com` using the Google AI Studio project-scoped API key (`AQ...` or `AIzaSy...`).
2. **Fallback Proxy Endpoint**: If the primary endpoint fails due to location restrictions (status `400`/`403`), it automatically reroutes the query through `api.gemini.tams.tech` with key parameters passed securely in the query string (`?key=${apiKey}`).

## 🎨 UI Layout Guidelines

To maintain consistent user experience:
1. **Admin Console (`admin.html`)**: Recommended to use a **2-Column Tabbed Layout** for dashboard components like Client Management and Technician Management.
2. **Technician Mobile View (`app.html`)**: Avoid 2-column designs. Use a mobile-first single-column design with a bottom navigation bar.
3. **Inventory Management (`admin.html` -> `#view-inventory`)**: Uses a split sidebar layout featuring a left-hand module navigation (Stock Batches, Sales Pricing, Device Catalog, and Add forms) paired with compact, high-density data tables and detailed sliding drawer-style sub-elements (e.g. Serial grids).

## 📦 Stock & Sales Inventory System

The inventory module implements a Parent-Child batch architecture designed to split unit cost history from daily updated sales prices.

### 1. Database Schema
- **`inventory_stock`**: Stores the device catalog models and daily update prices (USD / MMK).
- **`inventory_batches`**: Stores the supply batch imports, purchase cost/unit, vendor details, and dates.
- **`inventory_items`**: Parent-child child table holding individual units with unique Serial Numbers linked to parent batches.

### 2. Layout Structure
- **Left Module Sidebar**: High-speed module switching (`switchInvModule`) between:
  - `batches`: High-density stock batch overview. Clicking a row expands serial cards.
  - `pricing`: Active sales price matrix. Supports quick edit popups.
  - `catalog`: Complete hardware item SKU registration catalog.
- **Quick Action Triggers**: Instant slide-to-form transitions for registering models, updating prices, and importing stock batches.
- **Bulk Serial Input**: Two-column add form with a live regex-based serial counter and barcode gun optimization.

## 🔐 Technician Security Settings & Field Actions
- **Access PIN Modifications (`/api/portal/change-pin`)**: Allows authenticated field technicians to update their security gate pass PIN directly from the mobile console.
- On-Site Sales/Replacement Picker: Dynamic select dropdowns populated automatically from the live database catalog display current device availability, warranty rules, and local pricing information (USD and MMK) directly in the field.

## 🖥️ Desktop Application Packaging (Tauri)
Tauri is used to compile the admin and technician consoles into a standalone Windows `.exe` installer.
- **Tauri Config**: Defined in `src-tauri/tauri.conf.json`.
- **Target Frontend Assets**: Build output is directed to read from `../public`.
- **Tauri Commands**: Use `npx tauri build` to compile the release installer.
