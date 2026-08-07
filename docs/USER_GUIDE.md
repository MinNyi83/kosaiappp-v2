# KosAI Field Service Management System — Complete User Guide

> **Version 2.0** | Awesome Myanmar CCTV & Infrastructure  
> A full-stack field service platform for managing technicians, jobs, inventory, finances, and customer relationships.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Getting Started](#2-getting-started)
3. [Admin Dashboard](#3-admin-dashboard)
4. [Service Tickets & Job Dispatch](#4-service-tickets--job-dispatch)
5. [Dispatch Map](#5-dispatch-map)
6. [Site Surveys & Quotations](#6-site-surveys--quotations)
7. [Customer Management (AMC)](#7-customer-management-amc)
8. [Attendance & Time Tracking](#8-attendance--time-tracking)
9. [Inventory & Stock Management](#9-inventory--stock-management)
10. [POS Terminal & Invoicing](#10-pos-terminal--invoicing)
11. [Cash Ledger](#11-cash-ledger)
12. [Warranty & RMA](#12-warranty--rma)
13. [Distributors](#13-distributors)
14. [Service Fees](#14-service-fees)
15. [Reports & Analytics](#15-reports--analytics)
16. [AI Copilot](#16-ai-copilot)
17. [User Management](#17-user-management)
18. [System Settings](#18-system-settings)
19. [Landing Page Editor](#19-landing-page-editor)
20. [Portfolio](#20-portfolio)
21. [Receipt Builder](#21-receipt-builder)
22. [Technician Mobile App](#22-technician-mobile-app)
23. [Client Portal](#23-client-portal)
24. [Telegram Bot](#24-telegram-bot)
25. [Keyboard Shortcuts](#25-keyboard-shortcuts)
26. [Troubleshooting](#26-troubleshooting)

---

## 1. System Overview

KosAI is a cloud-based field service management platform designed for CCTV, networking, WiFi, and NAS infrastructure companies. It connects office administrators, field technicians, and customers through a unified system.

### User Roles

| Role | Access | Login Method |
|------|--------|-------------|
| **Admin** | Full system access — all modules | Username + Password or Google Sign-In |
| **Technician** | Mobile app — jobs, checklist, history, settings | Employee ID (`TECH-xxx`) + 4-6 digit PIN |
| **Sales** | Limited admin — clients and jobs | Employee ID + PIN |
| **Client** | Portal — service history, warranty, invoices | Client ID lookup |

### Access Points

| Platform | URL | Purpose |
|----------|-----|---------|
| Admin Console | `admin.html` | Office management dashboard |
| Technician App | `app.html` | Field operations (mobile-first) |
| Client Portal | `portal.html` | Customer self-service |
| Landing Page | `index.html` | Public marketing site |
| Portfolio | `portfolio.html` | Project showcase |
| Desktop App | `.exe` (Tauri) | Offline-capable Windows application |

---

## 2. Getting Started

### First-Time Admin Login

1. Open `admin.html` in your browser (or launch the desktop app)
2. Click **"Sign In"** on the lock screen
3. Enter your **Username** and **Password**
4. Click **"Sign In"**

> **Default Admin Account**  
> Username: `admin` | Password: *(set during initial setup)*  
> If you forgot your password, use the **System Settings > Database Restore** from a backup.

### First-Time Technician Login

1. Open `app.html` on your phone (or use the PWA install prompt)
2. Enter your **Employee ID** (e.g., `TECH-001`) and **PIN** (default: `1234`)
3. Tap **"Sign In"**
4. You can also tap **"Sign in with Google"** if your Google account is linked

### Changing Your PIN (Technician)

1. Go to **Settings** tab in the mobile app
2. Tap **"Change PIN"**
3. Enter your current PIN, then your new PIN twice
4. Tap **"Update PIN"**

---

## 3. Admin Dashboard

The dashboard is your **Command Center** — the first screen you see after login.

### Key Metrics (Top Row)

- **Total Jobs** — All service records in the system
- **Active Jobs** — Currently in-progress or pending jobs
- **Completed** — Jobs marked as completed
- **Revenue** — Total income from completed jobs

### Charts & Visuals

- **Job Status Distribution** — Pie chart showing Pending / In Progress / Completed / Cancelled
- **Weekly Activity** — Bar chart of jobs created per day
- **Revenue Trend** — Line chart of income over time

### Quick Actions

- **Create Job** — Opens the ticket creation form
- **Add Customer** — Opens the client registration form
- **Run Backup** — Downloads a JSON backup of the entire database
- **View Reports** — Jumps to the Reports module

### Auto-Refresh

The dashboard refreshes data every 10 seconds automatically. You'll see live updates without page reload.

---

## 4. Service Tickets & Job Dispatch

**Module**: `Dashboard > Service Tickets`

This is the core module for creating, managing, and dispatching field service jobs.

### Creating a New Job

1. Click **"Create Job"** or **"+"** button
2. Fill in the required fields:
   - **Client** — Search and select from existing clients (or create new)
   - **Service Type** — CCTV, Networking, WiFi, NAS, General Maintenance
   - **Technician** — Assign to a specific technician (or leave blank for auto-assign)
   - **Priority** — Low, Medium, High, Urgent
   - **Description** — Describe the issue or required work
   - **Scheduled Date** — When the job should be completed
3. Click **"Create"**

### Job Status Flow

```
Pending → In Progress → Completed
    ↓          ↓
Cancelled  Cancelled
```

### Updating Job Status

1. Open the job card
2. Click the **status dropdown** or use the **"Update Status"** button
3. Select the new status:
   - **Pending** — Waiting to be started
   - **In Progress** — Technician has started work
   - **Completed** — Work finished and verified
   - **Cancelled** — Job cancelled (with reason)

### Assigning a Technician

1. Open the job card
2. Click **"Assign"** or use the **"Assign Technician"** dropdown
3. Search by name, nickname, or ID
4. The assigned technician receives a **Telegram notification** instantly

### Job Card Fields

| Field | Description |
|-------|-------------|
| Job ID | Auto-generated (e.g., `JOB-1001`) |
| Client | Company or individual name |
| Service Type | CCTV / Networking / WiFi / NAS / General |
| Technician | Assigned field worker |
| Status | Current job state |
| Priority | Urgency level |
| Created | When the job was created |
| Scheduled | Target completion date |
| Checklist | Service checklist progress (parsed from `checklist_data`) |
| Before Photo | Site photo taken on arrival |
| After Photo | Site photo taken on completion |
| Notes | Technician field notes |

### Filtering & Search

- Use the **search bar** to find jobs by client name, job ID, or description
- Filter by **status** (Pending, In Progress, Completed, All)
- Filter by **technician**
- Filter by **date range**

### Deleting a Job

1. Open the job card
2. Click **"Delete"** (trash icon)
3. Confirm the deletion

> **Note**: Deleted jobs are permanently removed. Consider cancelling instead.

---

## 5. Dispatch Map

**Module**: `Dashboard > Dispatch Map`

An interactive Leaflet.js map showing real-time technician locations.

### Features

- **Technician Markers** — Each technician appears as a colored marker on the map
- **Click a Marker** — Shows technician name, current status, and assigned job
- **GPS Tracking** — Technicians share location when they clock in
- **HQ Marker** — Your head office location is always shown
- **Dark Mode** — Map tiles automatically adjust to dark/light theme

### HQ Configuration

1. Go to **System Settings**
2. Scroll to **"Head Office Location"**
3. Enter your:
   - Office name
   - Google Maps URL (auto-resolves to coordinates)
   - Latitude / Longitude (manual override)
   - Address
4. Click **"Save"**

---

## 6. Site Surveys & Quotations

**Module**: `Dashboard > Surveys`

A complete pipeline for site inspections, quotation generation, and client approval.

### Survey Pipeline

```
Draft → Completed → Quoted → (Converted to Job or Invoice)
                    ↓
                Cancelled
```

### Creating a Survey

1. Click **"New Survey"**
2. Fill in:
   - **Client** — Select from existing clients
   - **Site Address** — Location of the survey
   - **Survey Type** — CCTV, Networking, WiFi, NAS, General
   - **Notes** — Initial observations
3. Click **"Create"**

### Adding Site Photos

1. Open the survey card
2. Click **"Add Photo"**
3. Select photo type:
   - `server_room` — Server/rack room
   - `cable_path` — Cable routing paths
   - `power_source` — Power outlets/UPS
   - `camera_fov` — Camera field of view
   - `exterior` — Building exterior
   - `general` — General site photos
4. Upload the photo
5. Repeat for all required photos

### Generating a Quotation

1. Complete the survey (mark as **"Completed"**)
2. Click **"Generate Quotation"**
3. The AI estimates:
   - **BOM (Bill of Materials)** — Required hardware with quantities
   - **Cable Lengths** — Estimated cable runs
   - **Labor** — Installation labor costs
   - **Software** — License fees if applicable
4. Review and edit the line items
5. Click **"Create Quotation"**

### Quotation Line Items

| Field | Description |
|-------|-------------|
| Category | Hardware, Cable, Labor, Software, Other |
| Item Name | Description of the item |
| Quantity | Number of units |
| Unit Price (USD) | Price per unit in dollars |
| Unit Price (MMK) | Price per unit in kyat |
| Total | Auto-calculated |

### Sending to Client

1. Click **"Send to Client"**
2. A unique **portal link** is generated
3. The quotation is sent via **Telegram** to the client
4. The client can:
   - View the quotation online
   - **Approve** with digital signature
   - **Reject** with a reason

### Converting to Job or Invoice

After client approval:
- **Convert to Job** — Creates an active service ticket
- **Convert to Invoice** — Creates a POS invoice for billing

---

## 7. Customer Management (AMC)

**Module**: `Dashboard > Customers`

Manage your client directory and Annual Maintenance Contracts (AMC).

### Client Types

| Type | Description |
|------|-------------|
| **Corporate** | Business clients with AMC contracts |
| **Individual** | One-time residential customers |

### AMC Status

| Status | Meaning |
|--------|---------|
| **Active** | AMC contract is current and paid |
| **Inactive** | Contract exists but not currently active |
| **Expired** | Contract has passed its renewal date |
| **No AMC** | Client has no maintenance contract |
| **Individual** | One-time service customer |

### Creating a Client

1. Click **"Add Client"**
2. Select type: **Corporate** or **Individual**
3. Fill in the required fields:
   - **Company/Individual Name**
   - **Phone Number**
   - **Email**
   - **Address**
   - **AMC Status** (for corporate clients)
   - **AMC Start/End Date** (if applicable)
4. Click **"Save"**

### Client Details

Each client profile shows:
- Contact information
- Service history (all past jobs)
- Active warranties on installed hardware
- AMC contract status and expiry
- Total revenue contributed

---

## 8. Attendance & Time Tracking

**Module**: `Dashboard > Attendance` (Admin) / `App Header Bar` (Technician)

Track when technicians start and end their workday.

### How Clock-In Works (Technician)

1. Open the mobile app
2. Tap the **green clock icon** in the header bar
3. Tap **"Clock In"**
4. Your GPS coordinates are recorded
5. A status bar appears showing "Clocked In since HH:MM"

### How Clock-Out Works (Technician)

1. Tap the **"Clock Out"** button on the attendance bar
2. Your clock-out time is recorded
3. Total hours worked is calculated

### Admin Attendance View

- **Today's Grid** — Who is currently clocked in (real-time)
- **Weekly Summary** — Hours worked per technician per day
- **Date Range Filter** — View any historical period
- **Export** — Download attendance data as CSV

### Attendance via Telegram

Technicians can also manage attendance through the Telegram bot:

| Command | Action |
|---------|--------|
| `/checkin` or `/clockin` | Clock in for today |
| `/checkout` or `/clockout` | Clock out |
| `/status` | Check current clock-in status |
| `/report` | Weekly attendance summary |
| `/team` | See who is currently clocked in |
| `/leaderboard` | Weekly hours leaderboard |
| `/history` | My clock-in/out history this week |

---

## 9. Inventory & Stock Management

**Module**: `Dashboard > Stock & Items`

A parent-child batch architecture for tracking hardware inventory with separated cost history from daily sales prices.

### Three Sub-Modules

#### A. Stock Batches
View all imported stock batches. Each batch contains:
- **Batch Code** — Unique identifier (e.g., `BATCH-2024-001`)
- **Item Name** — Device model
- **Category** — Product category
- **Buying Price** — Cost per unit (USD)
- **Supplier** — Distributor name
- **Total Units** — Number of items in batch
- **Available Units** — Items still in stock
- **Sold Units** — Items sold or assigned to jobs

**Click a batch row** to expand and see individual serial numbers.

#### B. Sales Pricing
The price matrix for all device models:
- **Item Code** — SKU identifier
- **Item Name** — Device model name
- **Category** — Product category
- **In Stock** — Current available quantity
- **USD Price** — Selling price in dollars
- **MMK Price** — Selling price in kyat
- **Edit** — Quick edit popup to update prices

#### C. Device Catalog
Complete hardware SKU registration:
- Add new device models
- Set categories and sub-categories
- Register brands and units
- Delete obsolete entries

### Adding a New Stock Batch

1. Go to **Stock Batches**
2. Click **"Import Batch"**
3. Fill in:
   - **Batch Code** — Your internal batch reference
   - **Device Model** — Select from catalog
   - **Buying Price** — Cost per unit
   - **Supplier** — Distributor name
   - **Serial Numbers** — Enter one per line (or paste from spreadsheet)
4. Click **"Create Batch"**

### Serial Number Tracking

Each item in a batch gets a unique serial number:
- **Active** — Item is in stock and available
- **Sold** — Item has been sold or assigned to a job
- **RMA** — Item has been returned to distributor

### Bulk Serial Input

When adding serial numbers:
- Paste from a spreadsheet (one per line)
- The system counts serials automatically
- Supports barcode scanner input
- Validates serial format in real-time

### Price Updates

1. Go to **Sales Pricing**
2. Click **"Edit"** next to the item
3. Update the **USD** and/or **MMK** price
4. Click **"Save"**

> Prices update immediately across the POS terminal and quotation system.

---

## 10. POS Terminal & Invoicing

**Module**: `Dashboard > POS Terminal`

A full point-of-sale system for walk-in sales and invoice management.

### Two Sub-Modules

#### A. Terminal Checkout
Process sales and generate invoices.

**Workflow:**
1. Select items from the **inventory dropdown** (shows current stock, price, warranty)
2. Set **quantity** for each item
3. Click **"Add to Cart"**
4. Review the cart — items show name, quantity, unit price, line total
5. Click **"Checkout"**
6. An invoice is created (`INV-xxx`)
7. Payment is recorded

**Cart Features:**
- Add multiple items
- Remove items from cart
- Adjust quantities
- Dual currency display (USD / MMK)
- Running total

#### B. Outstanding Credits
View and manage unpaid invoices:
- List of all unpaid invoices
- Client name and amount owed
- Days outstanding
- **Mark as Paid** button for each invoice
- **Save to Google Drive** for PDF backup

### Invoice Details

| Field | Description |
|-------|-------------|
| Invoice ID | Auto-generated (e.g., `INV-001`) |
| Client | Buyer name |
| Items | Line items with quantities and prices |
| Subtotal | Sum before tax/discount |
| Tax | Applied tax amount |
| Discount | Applied discount |
| Total | Final amount |
| Status | Paid / Unpaid / Partial |
| Date | Transaction date |

---

## 11. Cash Ledger

**Module**: `Dashboard > Cash Ledger`

Track all cash flow — deposits, withdrawals, and running balance.

### Features

- **Current Balance** — Real-time USD and MMK totals
- **Deposit** — Add funds to the cash safe
- **Withdraw** — Remove funds from the cash safe
- **Transaction History** — Full log of all movements
- **Dual Currency** — Separate USD and MMK tracking

### Making a Deposit

1. Click **"Deposit"**
2. Enter the **amount** (USD or MMK)
3. Enter a **description** (e.g., "POS Invoice #INV-001")
4. Click **"Confirm"**

### Making a Withdrawal

1. Click **"Withdraw"**
2. Enter the **amount**
3. Enter a **description** (e.g., "Office supplies purchase")
4. Click **"Confirm"**

### Transaction History

| Field | Description |
|-------|-------------|
| Date | When the transaction occurred |
| Type | Deposit (+) or Withdrawal (-) |
| Amount | Transaction amount |
| Currency | USD or MMK |
| Description | What the transaction was for |
| Balance After | Running balance after this transaction |

---

## 12. Warranty & RMA

**Module**: `Dashboard > Warranty & RMA`

Track product warranties and manage distributor Return Merchandise Authorization (RMA) claims.

### KPI Dashboard

- **Active Warranties** — Devices currently under warranty
- **Expired** — Warranties past their expiry date
- **Open RMA** — Pending resolution claims
- **RMA Completed** — Resolved claims

### Registering a Warranty

1. Click **"Register Warranty"**
2. Fill in:
   - **Serial Number** — Device serial (from inventory)
   - **Device Name** — What the device is
   - **Client** — Who the device belongs to
   - **Installed Date** — When it was installed
   - **Warranty Months** — Duration of coverage (e.g., 12, 24, 36)
3. Click **"Register"**

### Warranty Expiry Tracking

Each warranty shows:
- Start date
- End date (calculated from installed date + warranty months)
- Days remaining
- Status badge: **Active** (green) or **Expired** (red)

### Raising an RMA Claim

When a device fails under warranty:
1. Click **"Raise RMA Claim"**
2. Select the **serial number** from the dropdown
3. Enter the **distributor** name
4. Enter the **RMA tracking ID** (from the distributor)
5. Enter the **date sent**
6. Click **"Submit"**

### RMA Status Flow

```
RMA Sent → RMA Completed
```

### Resolving an RMA Claim

1. Go to **RMA Claims** tab
2. Find the claim
3. Click the **checkmark** button to mark as resolved
4. Confirm the resolution

---

## 13. Distributors

**Module**: `Dashboard > Distributors`

Manage your hardware suppliers and procurement channels.

### Adding a Distributor

1. Click **"Add Distributor"**
2. Fill in:
   - **Name** — Company name
   - **Contact Person** — Primary contact
   - **Phone** — Contact number
   - **Email** — Contact email
   - **Product Lines** — What they supply (e.g., "Hikvision, Ubiquiti, MikroTik")
3. Click **"Save"**

### Distributor Details

- Linked to inventory batches (which supplier provided which stock)
- Linked to RMA claims (which supplier handles returns)
- Contact information for quick reference

---

## 14. Service Fees

**Module**: `Dashboard > Service Fees`

Manage the catalog of service charges for different types of work.

### Service Fee Categories

- CCTV Installation
- Network Setup
- WiFi Configuration
- NAS Setup
- General Maintenance
- Emergency Repair
- Consultation

### Adding a Service Fee

1. Click **"Add Fee"**
2. Fill in:
   - **Fee Name** — Description (e.g., "CCTV Camera Installation")
   - **Category** — Service type
   - **Price (USD)** — Charge in dollars
   - **Price (MMK)** — Charge in kyat
3. Click **"Save""

### Using Service Fees

Service fees are linked to the job dispatch form. When creating a ticket:
1. Select a service type
2. Available fees for that type appear as chips
3. Click a fee to add it to the job
4. The fee amount is included in the job total

---

## 15. Reports & Analytics

**Module**: `Dashboard > Reports`

Generate executive analytics and exportable reports.

### Report Types

#### 1. Technician Performance Audit
- Task completion rates per technician
- Active ticket logs
- Assigned workload distribution
- Average job duration

#### 2. Customer Service Audit
- Ticket history counts per client
- AMC status breakdown
- Revenue contributed per client
- Service frequency analysis

#### 3. Job History Ledger
- Complete job records in audit grid
- Job types, technicians, dates, statuses
- Filterable by any criteria

### Timeframe Scopes

| Scope | Description |
|-------|-------------|
| This Month | Current calendar month |
| Last Month | Previous calendar month |
| This Year | Current calendar year |
| Last Year | Previous calendar year |
| Last 30 Days | Rolling 30-day window |
| Last 90 Days | Rolling 90-day window |
| All-Time | Every record in the system |

### Generating a Report

1. Select a **report type** from the dropdown
2. Select a **timeframe**
3. Click **"Generate Report"**
4. View the results in the data table
5. Click **"Export PDF"** to download

---

## 16. AI Copilot

**Module**: `Dashboard > AI Copilot`

Smart dispatching, route optimization, and natural language data queries powered by Gemini AI.

### Three Tools

#### A. Chat with Data
Ask natural language questions about your business data.

**Example Queries:**
- "How many jobs were completed this month?"
- "Which technician has the highest completion rate?"
- "What is our total revenue this quarter?"
- "Show me all pending jobs for CCTV installations"

**How it works:**
1. Type your question in the chat box
2. Click **"Ask"** or press Enter
3. The AI queries the database and responds with a natural language answer
4. If a chart or table is needed, it's generated automatically

#### B. Auto-Dispatcher
AI matches technicians to jobs based on skills and availability.

**How it works:**
1. Select an unassigned job
2. Click **"Auto-Assign"**
3. The AI considers:
   - Technician skills (CCTV, Networking, WiFi, NAS, General)
   - Current workload
   - Geographic proximity
   - Past performance
4. The best-matching technician is suggested
5. Click **"Confirm"** to assign

#### C. Route Optimizer
Calculate the optimal visit sequence for multiple jobs.

**How it works:**
1. Select multiple jobs to visit
2. Click **"Optimize Route"**
3. The AI calculates:
   - Shortest total travel distance
   - Estimated travel time between stops
   - Optimal visit order
4. View the optimized route on the map

### KPI Cards

- **Queries Run** — Total AI queries in this session
- **Dispatches Made** — Jobs auto-assigned
- **Routes Optimized** — Routes calculated today
- **Response Time** — Average AI response time

---

## 17. User Management

**Module**: `Dashboard > User Management`

Manage all system users — technicians, sales staff, and admins.

### Creating a New User

1. Click **"Add User"**
2. Fill in:
   - **Name** — Full name
   - **Employee ID** — Auto-generated or custom (e.g., `TECH-005`)
   - **Role** — Admin, Technician, or Sales
   - **Phone** — Contact number
   - **Email** — Email address
   - **PIN** — 4-6 digit security PIN (default: `1234`)
   - **Profile Photo** — Upload a photo (stored as base64)
3. Click **"Create"**

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all modules, settings, and reports |
| **Technician** | Mobile app — jobs, checklist, history, own profile |
| **Sales** | View clients and jobs, limited admin access |

### Digital ID Card

Each technician gets a digital ID card with:
- **Front**: Photo, name, role, employee ID, QR code, phone, active status
- **Back**: Company details, emergency contact, QR verification link
- **Print**: Button to print a physical card

### Editing a User

1. Find the user in the list
2. Click **"Edit"** (pencil icon)
3. Update any fields
4. Click **"Save"**

### Deactivating a User

1. Find the user in the list
2. Click **"Edit"**
3. Set **Status** to **"Inactive"**
4. Click **"Save"**

> Inactive users cannot log in but their records are preserved.

---

## 18. System Settings

**Module**: `Dashboard > Settings`

Configure system-wide settings and perform maintenance tasks.

### Configuration Options

| Setting | Description |
|---------|-------------|
| Exchange Rate | USD to MMK conversion rate |
| HQ Location | Head office coordinates for the dispatch map |
| Timezone | System timezone |
| Date Format | Display format for dates |
| Currency Symbol | Default currency display |

### Database Backup

1. Go to **System Settings**
2. Click **"Download Backup"**
3. A JSON file is downloaded containing:
   - All technicians, clients, service records
   - Inventory data, cash transactions
   - Service fees, system config, landing page content
4. Store the backup file safely

### Database Restore

1. Go to **System Settings**
2. Click **"Upload Backup"**
3. Select a previously downloaded backup file
4. **WARNING**: This will **erase all current data** and replace it with the backup
5. Confirm the restore
6. The page reloads with the restored data

> **Always create a backup before restoring.** This action cannot be undone.

### Auto-Backup (Cron)

The system automatically backs up the database at **midnight every day**:
- Backup is uploaded to Google Drive
- A notification is sent to the Telegram group
- Backup includes all major tables

---

## 19. Landing Page Editor

**Module**: `Dashboard > Landing Page`

Customize the public-facing marketing page without code changes.

### Editable Sections

#### Hero Section
- **Eyebrow Text** — Small tagline above the headline
- **Headline** — Main title (e.g., "Next-Gen CCTV & Infrastructure Systems")
- **Description** — Supporting text
- **CTA Button** — Text and URL for the call-to-action button

#### Services Section
- Add/edit/remove service cards
- Each card has: icon, title, description

#### Why Choose Us Section
- Feature cards with icon, title, description

#### Stats Section
- 4 statistic values with labels (e.g., "500+ Projects", "50+ Technicians")

#### Price List Section
- Automatically populated from the inventory catalog
- Shows device models and current prices

#### CTA Banner
- Call-to-action banner text and link

#### Footer
- 4-column link grid
- Social media icons
- Copyright text

### Saving Changes

1. Edit any section in the form
2. Click **"Save Changes"**
3. Changes are live immediately on the public page

### Preview

Click **"View Live"** to open the public landing page in a new tab.

---

## 20. Portfolio

**Module**: `Dashboard > Portfolio`

Showcase completed projects on the public portfolio page.

### Adding a Project

1. Click **"Add Project"**
2. Fill in:
   - **Title** — Project name
   - **Category** — CCTV, Networking, WiFi, NAS, General Maintenance
   - **Description** — What was done
   - **Images** — Upload project photos
3. Click **"Save"**

### Category Filters

Filter the portfolio by service type:
- All
- CCTV
- Networking
- WiFi
- NAS
- General Maintenance

### Live Preview

The right panel shows a real-time preview of how projects appear on the public page.

### Public View

Click **"View Live"** to open `/portfolio.html` — the public-facing project gallery.

---

## 21. Receipt Builder

**Module**: `Dashboard > Receipt Builder`

Design and generate PDF receipts for completed jobs.

### Features

- **Visual Designer** — Drag-and-drop receipt layout
- **Live Preview** — See the receipt as you build it
- **PDF Generation** — Export as PDF using jsPDF
- **Customizable Template** — Add your company logo, details, and terms

### Generating a Receipt

1. Select a job from the dropdown
2. The receipt auto-populates with:
   - Client information
   - Service details
   - Items used
   - Labor charges
   - Total amount
3. Customize the layout if needed
4. Click **"Generate PDF"**
5. Download or print the receipt

---

## 22. Technician Mobile App

**File**: `app.html` (mobile-first Progressive Web App)

The field technician's primary tool for daily operations.

### Login

1. Open `app.html` on your phone
2. Enter your **Employee ID** (e.g., `TECH-001`)
3. Enter your **PIN** (default: `1234`)
4. Tap **"Sign In"**

### Tab 1: Jobs

View all assigned jobs:
- **Active Jobs** — Currently in progress
- **Pending Jobs** — Waiting to be started
- Pull down to refresh
- Tap a job to open the checklist

### Tab 2: Checklist

The active job form — your main workspace for each job.

#### Service Checklist
- Pre-defined checklist items for the service type
- Check off each item as you complete it
- Add custom notes for each item

#### Photo Capture
- **Before Photo** — Take a photo of the site condition on arrival
- **After Photo** — Take a photo of the completed work
- Photos are uploaded to Google Drive automatically
- Photos are sent to the Telegram group for the admin to see

#### Hardware Picker
- Select equipment used from the inventory catalog
- Shows current stock, warranty status, and pricing (USD/MMK)
- Items are deducted from inventory automatically

#### Technician Notes
- Free-text field for describing work done
- **AI Polish** — Tap to have AI clean up your notes

#### Digital Signature
- Customer signs on the screen to confirm job completion
- Signature is captured and stored with the job record

#### GPS Coordinates
- Arrival and completion coordinates are recorded automatically
- Used for the dispatch map and attendance verification

#### Submit Job
1. Complete all checklist items
2. Take before and after photos
3. Select hardware used
4. Add notes
5. Get customer signature
6. Tap **"Submit Job"**
7. Job status changes to **Completed**
8. Photos are sent to Telegram
9. You're returned to the jobs list

### Tab 3: History

View all your completed jobs:
- Job cards with before/after photos
- Client name and service type
- Completion date
- Total time spent

### Tab 4: Settings

- **Profile** — View your name, role, employee ID
- **Digital ID Card** — 3D-flippable card with QR code
- **Change PIN** — Update your security PIN
- **Theme Toggle** — Switch between dark and light mode
- **Offline Indicator** — Shows connection status
- **Sync Button** — Manually sync pending data when back online

### PWA Installation

On your phone:
1. Open `app.html` in Chrome/Safari
2. Tap **"Add to Home Screen"** (or use the install prompt)
3. The app appears as a native icon on your home screen
4. Opens in full-screen mode without browser chrome

### Offline Support

- The app works offline using a Service Worker
- Jobs and checklist data are cached locally
- Photos are queued for upload when reconnected
- A sync button appears when you're back online

---

## 23. Client Portal

**File**: `portal.html`

A self-service portal for customers to view their service history.

### How to Access

1. Open `portal.html`
2. Enter your **Client ID** (e.g., `CLI-001`)
3. Click **"Pull Logs"**

### Available Information

#### AMC Panel
- Annual maintenance contract status
- Contract start and end dates
- Days remaining

#### Warranty Panel
- Active hardware warranties
- Device names and serial numbers
- Warranty expiry countdown

#### Billing Panel
- Invoice/payment transaction ledger
- Outstanding balances
- Payment history
- **Download PDF** — Export billing statement

#### Service Log Feed
- Paginated list of all completed service records
- Before/after photos for each job
- Technician notes
- Job dates and durations

### Quotation Approval

When you receive a quotation link (`/portal/quotation/:token`):

1. Open the link
2. Review the quotation details:
   - Line items with quantities and prices
   - Subtotal, tax, discount, total
3. Click **"Approve"** and sign digitally
4. Or click **"Reject"** with a reason

---

## 24. Telegram Bot

The Telegram bot provides field access to the system without opening the web app.

### Setup

1. Create a bot via **@BotFather** on Telegram
2. Set the bot token in `wrangler.toml` or `.dev.vars`:
   ```
   TELEGRAM_BOT_TOKEN=your-bot-token
   TELEGRAM_CHAT_ID=your-group-id
   ```
3. Set the webhook URL to: `https://your-domain.com/api/telegram/webhook`

### Available Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all available commands |
| `/clock` | Quick clock status summary |
| `/checkin` or `/clockin` | Clock in for today |
| `/checkout` or `/clockout` | Clock out |
| `/status` | Check clock-in status & active jobs |
| `/report` | Weekly attendance summary |
| `/team` | See who is currently clocked in |
| `/leaderboard` | Weekly hours leaderboard |
| `/history` | My clock-in/out history this week |
| `/jobs` | List your active jobs |
| `/completed` | List your completed jobs |
| `/today` | Show today's jobs & attendance |
| `/ticket JOB-xxx` | View job details |
| `/accept JOB-xxx` | Accept a job assignment |
| `/assign JOB-xxx TechName` | Assign a technician (admin only) |
| `/cancel JOB-xxx` | Cancel a job (admin only) |

### Voice Messages

Send a voice message to the bot:
1. The bot transcribes your speech using Gemini AI
2. AI analyzes the issue and selects the best technician
3. A new job is created automatically
4. You receive a confirmation with the Job ID

### Photo Messages

Send a photo to the bot:
1. The photo is uploaded to Google Drive
2. A new job is created with the photo attached
3. You receive a confirmation with the Job ID

### Text Messages

Send any text message:
1. A job ticket is created automatically from your message
2. You receive a confirmation with the Job ID

### Inline Buttons

When a job is assigned, the bot sends a message with buttons:
- **"Accept Job"** — Marks the job as In Progress
- **"Complete Job"** — Marks the job as Completed

### Outbound Notifications

The bot sends notifications for:
- Job status changes (Pending → In Progress → Completed → Cancelled)
- Before/after photos from site visits
- Database backup logs (daily at midnight)
- Low stock alerts

---

## 25. Keyboard Shortcuts

Available in the Admin Console:

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` | Focus the search bar |
| `Ctrl + N` | Open the New Ticket form |
| `Escape` | Close any open modal |

---

## 26. Troubleshooting

### Cannot Log In

**Admin:**
- Verify username and password are correct
- Check that your account role is set to "Admin"
- Try Google Sign-In if password login fails

**Technician:**
- Verify your Employee ID format: `TECH-xxx`
- Default PIN is `1234` — ask admin to reset if changed
- Check that your account is "Active" (not deactivated)

### Photos Not Uploading

- Check your internet connection
- Verify Google Drive integration is configured
- Check the Telegram bot token is valid
- Try uploading a smaller image

### Jobs Not Appearing

- Pull down to refresh the jobs list
- Check that you're logged in with the correct account
- Verify the job is assigned to you
- Ask admin to check the job status

### Attendance Not Recording

- Ensure GPS/location services are enabled
- Check that you have internet connectivity
- Try clocking in via Telegram as a backup

### AI Copilot Not Responding

- Check that `GEMINI_API_KEY` is configured
- Verify the API key hasn't exceeded its quota
- The system uses a dual-gateway fallback — if one endpoint is blocked, it tries the other

### Telegram Bot Not Sending Notifications

- Verify `TELEGRAM_BOT_TOKEN` is correct
- Check that `TELEGRAM_CHAT_ID` matches your group
- Ensure the webhook URL is set correctly
- Test with `/start` command

### Database Restore Failed

- Ensure the backup file is valid JSON
- Check that the file contains a `data` property
- Large tables may need to be split (D1 has a 100KB statement limit)
- Contact support if the issue persists

### Offline Mode (Technician App)

- The app caches data locally via Service Worker
- Jobs and checklists work offline
- Photos are queued for upload when reconnected
- Tap the **Sync** button when back online
- Check the offline indicator in Settings

---

## Quick Reference Card

### Admin Daily Workflow

1. **Morning**: Check dashboard metrics, review overnight jobs
2. **Dispatch**: Assign new jobs to technicians
3. **Monitor**: Watch the dispatch map for technician locations
4. **Review**: Check completed jobs and photos
5. **Finance**: Process POS sales, update cash ledger
6. **Reports**: Generate end-of-day reports

### Technician Daily Workflow

1. **Clock In**: Tap the clock icon in the app header
2. **Check Jobs**: View assigned jobs in the Jobs tab
3. **Accept**: Tap a job and start working
4. **Document**: Take before photos, fill checklist
5. **Work**: Complete the service
6. **Document**: Take after photos, add notes
7. **Sign**: Get customer signature
8. **Submit**: Mark job as completed
9. **Clock Out**: Tap clock out when done for the day

### Client Workflow

1. **Access Portal**: Enter Client ID at `portal.html`
2. **View History**: See all past service records
3. **Check Warranty**: Verify active warranties
4. **Review Billing**: Check invoices and payments
5. **Approve Quote**: Review and sign quotations online

---

*Last updated: August 2026*  
*KosAI Field Service Management System v2.0*
