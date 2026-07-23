---
name: kosai-admin-system
description: Comprehensive KosAI Admin Dashboard management - UI components, reports, POS, inventory, clients, users, and system settings. Use for any admin dashboard modifications, feature additions, or UI upgrades.
---

# KosAI Admin System Skill

Complete reference for the KosAI Admin Dashboard - a modern, glass-morphism styled admin panel for managing CCTV service operations.

## System Overview

### Tech Stack
- **Frontend**: Vanilla JS, Tailwind CSS, Chart.js, FullCalendar, Leaflet Maps
- **Backend**: Cloudflare Workers (TypeScript), D1 Database
- **PDF Generation**: jsPDF
- **Excel Export**: SheetJS (xlsx)
- **Barcode Scanning**: WebRTC Camera API

### Architecture
```
web/
├── admin.html          # Main admin dashboard
├── admin.js            # All JavaScript logic
├── app.html            # Technician mobile app
├── portal.html         # Client portal
└── public/             # Static assets
```

## Dashboard Sections

### 1. Dashboard (view-dashboard)
**Purpose**: Business overview with KPIs, charts, and activity feed

**Components**:
- Today's Quick Stats bar (date, new jobs, completed, in progress)
- 4 Primary KPI cards (Active Tickets, Completion Rate, Revenue, Technicians)
- 5 Secondary KPI cards (Low Stock, USD/MMK Safe, Clients, Inventory)
- 5 Charts (Job Status, Service Types, Revenue Trend, Tech Performance, Monthly Trend)
- Recent Tickets table
- Activity Feed
- Live Dispatch Map (Leaflet)
- Dispatch Calendar (FullCalendar)

**Data Sources**:
- `/api/jobs` - All job records
- `/api/admin/lookups` - Clients, technicians, inventory
- `/api/admin/cash/safe` - Cash safe balances

### 2. Service Tickets (view-tickets)
**Purpose**: Job management and dispatch

**Components**:
- Collapsible New Ticket form
- KPI cards (Total, Pending, In Progress, Completed, Cancelled)
- Status tabs with counts
- Search and filter (status, type)
- Job cards grid
- PDF generation input

**Status Flow**:
```
Pending → In Progress → Completed
    ↓         ↓
Cancelled  Cancelled
```

### 3. AMC Contracts (view-amc)
**Purpose**: Annual Maintenance Contract management

### 4. Distributors (view-distributors)
**Purpose**: Supplier/vendor management

### 5. Warranty & RMA (view-warranty)
**Purpose**: Warranty tracking and RMA claims

### 6. Inventory (view-inventory)
**Purpose**: Stock management with barcode scanning

**Components**:
- KPI cards (Total Items, In Stock, Low Stock, Total Qty, Value)
- Barcode Scanner modal (camera + manual input)
- Product grid with search/filter
- Add/Restock/Lookup tabs
- Import/Export Excel

**Barcode Scanner Features**:
- Camera-based scanning with overlay
- Manual code input
- Quick restock from scan
- Add to POS from scan
- Add new item from scan

### 7. POS Terminal (view-pos)
**Purpose**: Point of Sale system

**Components**:
- Left sidebar with modules (Terminal Checkout, Outstanding Credits)
- Product catalog with search/filter
- Shopping cart with quantity controls
- Split payment (Method A + B)
- Custom exchange rate
- Customer selector with autocomplete
- Link to Service Ticket
- Receipt generation
- Credit tracking

### 8. Cash Ledger (view-currency)
**Purpose**: Cash transaction management

### 9. Reports (view-reports)
**Purpose**: Analytics and data export

**Tabs**:
- Overview (KPIs, charts)
- Jobs (status/type breakdown)
- Clients (AMC status, jobs summary)
- Inventory (stock by category, low stock)
- Financial (cash safe, transactions)
- Technicians (performance metrics)

**Export Options**:
- Print (browser print)
- Export Excel (SheetJS)
- Export CSV
- Customize (select specific reports)

### 10. Settings (view-system-settings)
**Purpose**: System configuration

**Tabs**:
- Users (KPI cards, user cards, search/filter)
- System Settings (Company Profile, Exchange Rate, Tax, Notifications, Appearance)
- Database (Backup/Restore)

## Key JavaScript Functions

### Data Loading
```javascript
refreshDashboardData()    // Load all dashboard data
loadJobsData()           // Load jobs for all views
loadInventoryData()      // Load inventory stock
loadCashSafeData()       // Load cash safe balances
loadTechniciansData()    // Load technician list
populateReports()        // Load report data
```

### POS Functions
```javascript
loadPOSProducts()        // Load products for POS
addPOSProduct(code)      // Add product to cart
processPOSCheckout()     // Complete sale
showPOSReceipt(sale)     // Display receipt
```

### Inventory Functions
```javascript
loadInventory()          // Load inventory data
filterInventory()        // Filter products
openBarcodeScanner()     // Open scanner modal
submitNewInventoryItem() // Add new item
submitInventoryRestock() // Adjust stock
```

### Report Functions
```javascript
exportAllReports()       // Export all to Excel
exportReportsCSV()       // Export jobs to CSV
switchReportTab(tab)     // Switch report tabs
```

## Color Scheme

```javascript
const COLORS = {
  primary: '#f59e0b',    // Amber (primary accent)
  success: '#10b981',    // Emerald (completed, positive)
  warning: '#f59e0b',    // Amber (pending, caution)
  danger: '#ef4444',     // Rose (cancelled, error)
  info: '#3b82f6',       // Blue (in progress)
  violet: '#8b5cf6',     // Violet (admins)
  cyan: '#06b6d4',       // Cyan (technicians)
};
```

## Glass Morphism CSS

```css
.glass-panel {
  background: rgba(18, 18, 24, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

## Common Tasks

### Add New Report
1. Add report generator function in `admin.js`
2. Register in `allReports` object
3. Add checkbox in `admin.html` report customizer

### Add New Chart
1. Add canvas element in HTML
2. Add Chart.js initialization in `renderDashboardCharts()`
3. Use Chart.js API for configuration

### Add New Settings
1. Add form fields in HTML
2. Add save function in JavaScript
3. Store in localStorage or API

### Add New KPI Card
1. Add card HTML with icon and value element
2. Update stat calculation in data loading function
3. Set element text content

## Database Tables

```sql
-- Core Tables
technicians          -- User accounts
clients              -- Customer records
service_records      -- Job/ticket records
inventory_stock      -- Product catalog
inventory_items      -- Installed devices
inventory_batches    -- Purchase batches

-- Financial
cash_safes           -- Cash balance
cash_transactions    -- Transaction history
service_fees         -- Fee schedule

-- Config
system_config        -- Key-value settings
stock_code_map       -- Code mapping
```

## API Endpoints

### Auth
- `POST /api/auth/login-password` - Login

### Jobs
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create job

### Admin
- `GET /api/admin/lookups` - All lookup data
- `GET /api/admin/cash/safe` - Cash safe balance
- `POST /api/admin/cash/transaction` - Add transaction
- `GET /api/admin/clients` - List clients
- `POST /api/admin/clients` - Add client
- `GET /api/admin/users` - List users
- `POST /api/admin/users` - Add user

### Reports
- `GET /api/reports/dashboard` - Dashboard stats
- `GET /api/reports/jobs` - Job reports
- `GET /api/reports/export` - Export data

## Rules

- Always use glass-panel class for containers
- Use amber (#f59e0b) as primary accent
- Support both USD and MMK currencies
- Maintain responsive design (mobile-first)
- Use Chart.js for all charts
- Store settings in localStorage
- Test all API calls with error handling
