---
name: survey-quotation-flow
description: Rules and guidance for the redesigned survey-to-quotation pipeline, including line items, photo capture, portal approval with signature, BOM-to-quote automation, versioning, stock deduction, PDF generation, and email delivery.
---

# Survey & Quotation Flow — Redesigned v2

This skill documents the integrated survey→quotation pipeline with line items, photo management, portal approval, AI BOM estimation, versioning, stock deduction, PDF generation, and email delivery.

## Architecture

### Service Layer

Business logic lives in `src/modules/services/`:
- **`survey.service.ts`** — `SurveyService` class: CRUD, photos, status counts
- **`quotation.service.ts`**** — `QuotationService` class: CRUD, line items, totals, portal, revisions, stock deduction, conversion

Route handlers in `src/modules/routes/surveys.ts` are thin HTTP handlers that delegate to services. Services accept `db: D1Database` via constructor.

### Frontend Module Split

Admin.js was split into 4 files:
- **`admin-core.js`** (555 lines) — escapeHTML, loading spinner, event delegation, fetch interceptor, login, sidebar, switchTab
- **`admin-surveys.js`** (748 lines) — All survey/quotation CRUD, line items, bulk ops, BOM
- **`admin-receipt.js`** (259 lines) — Receipt builder settings, preview, print
- **`admin.js`** (8,864 lines remaining) — init, dashboard, inventory, jobs, clients, etc.

## Pipeline Overview

```
New Survey → [Technician: Site Visit + Photos] → Completed → [Admin: Generate Quote] → Quoted
  → [Admin: Send to Client] → Sent → [Client: Portal Approval] → Approved/Rejected
  → [Admin: Convert to Job/Invoice]
```

## Key Design Decisions

### 1. Line Items as Separate Table (`quotation_items`)

Quotation items are stored in a dedicated `quotation_items` table, NOT as JSON in the `quotations.items` column.

**Why:**
- Enables per-item CRUD operations
- Allows sorting, filtering, and aggregation
- Supports atomic updates without reading/writing entire JSON blob
- Enables future features like inventory linking per item

**Schema:**
```sql
CREATE TABLE quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_code TEXT,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('hardware', 'cable', 'labor', 'software', 'other')) NOT NULL DEFAULT 'hardware',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pc',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  inventory_item_id TEXT,
  stock_deducted INTEGER DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Rules:**
- Always use `quotationService.recalculateTotals()` after any item add/edit/delete
- `subtotal`, `discount`, `tax`, `total_amount` on `quotations` are computed values
- Never manually set quotation totals — always derive from line items

### 2. Portal Token Authentication (`portal_token`)

Customer-facing quotation URLs use a UUID-based `portal_token`, NOT the quotation ID.

**Why:**
- Prevents enumeration attacks (guessing QUO-001, QUO-002)
- Clients cannot access other quotations
- Token is generated on first send, remains stable

**Flow:**
1. Admin clicks "Send to Client" → generates `portal_token` UUID
2. URL: `https://awesomemyanmar.pages.dev/portal.html?quote={portal_token}`
3. Telegram message includes this URL
4. Client opens URL → quotation loads via `GET /api/portal/quote/:token`
5. Client approves → `POST /api/portal/quote/:token/approve`

**Rules:**
- Never expose `portal_token` in API responses to non-admin users
- Regenerate token only if explicitly requested (e.g., re-send)
- Store token in `quotations.portal_token` column (conditional UNIQUE constraint)

### 3. Photo Management (`survey_photos`)

Site photos are stored in a dedicated `survey_photos` table with typed categories.

**Photo Types:**
- `server_room` — Server room / rack area
- `cable_path` — Cable routing paths
- `power_source` — Power outlets / UPS
- `camera_fov` — Camera field of view
- `exterior` — Building exterior
- `general` — General site photos

**Rules:**
- Photos uploaded via `POST /api/surveys/:id/photos`
- Each photo requires `photo_url` and `photo_type`
- Photos are stored in Google Drive (reuse existing `uploadFileToGoogleDrive`)
- Preview thumbnails in admin UI via direct `photo_url`

### 4. Signature Pad (Canvas-based)

Approval signatures are stored as base64 data URIs from HTML5 Canvas.

**Why Canvas (not image input):**
- Smooth drawing experience on touch devices
- Vector-based (not pixelated)
- Supports pressure sensitivity on supported devices
- Easy to clear and re-draw

**Storage:**
- `quotations.client_signature` — base64 data URI of canvas drawing
- `quotations.client_signature_url` — optional Google Drive URL for signature image

**Rules:**
- Canvas dimensions: 100% width × 150px height
- Stroke: indigo (#6366f1), 2.5px width, round line caps
- Clear button: top-right corner, labeled "Clear"
- Hint text: "Draw signature above" when canvas is empty
- Store as `data:image/png;base64,...` format

### 5. BOM-to-Quote Automation

The `POST /api/surveys/:id/generate-bom` endpoint creates a quotation from survey data using AI estimation.

**Flow:**
1. Admin clicks "Generate Quote" on completed survey
2. Backend calls Gemini AI with survey data (camera count, cable type, estimated meters)
3. AI returns categorized BOM items (hardware, cable, labor, software)
4. Items inserted into `quotation_items` table
5. `quotationService.recalculateTotals()` called
6. Quotation returned with line items

**BOM Generator Output:**
```typescript
interface BOMItem {
  category: 'hardware' | 'cable' | 'labor' | 'software' | 'other';
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  notes?: string;
}
```

**Rules:**
- Always generate quotation with `survey_id_link` referencing the source survey
- Set initial status to `Draft`
- Auto-populate `client_id` from survey's client
- Auto-populate `prepared_by` from authenticated user

### 6. Quotation Versioning (`quotation_revisions`)

Quotations support save/restore revision history.

**Schema:**
```sql
CREATE TABLE quotation_revisions (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id),
  revision_number INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  revised_by TEXT,
  change_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**Flow:**
1. Admin clicks "Save Revision" → snapshots current quotation + line items
2. `current_revision` counter incremented on quotation
3. Admin can browse revision history
4. Admin can restore → auto-saves current state before restoring

### 7. Inventory Stock Deduction

Quotation items can link to inventory items via `inventory_item_id`.

**Flow:**
1. Admin links quotation item to inventory item
2. Admin clicks "Deduct Stock" → `POST /api/quotations/:id/deduct-stock`
3. Service checks stock availability for each linked item
4. Deducts from `inventory_stock.quantity_in_stock`
5. Marks `quotation_items.stock_deducted = 1`
6. Returns deductions and any errors

### 8. PDF Generation

Server-side PDF via `GET /api/quotations/:id/pdf` — generates styled HTML quotation.

### 9. Email Delivery

`POST /api/quotations/:id/send-email` — sends quotation via Resend API with Telegram backup.

## API Endpoints

### Survey Management

| Method | Endpoint | Auth | CSRF | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/surveys` | Any authenticated | - | List surveys with pipeline counts |
| `GET` | `/api/surveys/:id` | Any authenticated | - | Get survey with photos |
| `POST` | `/api/surveys` | Admin only | Yes | Create new survey |
| `PUT` | `/api/surveys/:id/complete` | Admin only | Yes | Complete survey with field data |
| `POST` | `/api/surveys/:id/approve` | Admin only | Yes | Approve survey |
| `POST` | `/api/surveys/:id/photos` | Admin only | Yes | Upload site photo |
| `DELETE` | `/api/surveys/:id/photos/:photoId` | Admin only | Yes | Remove photo |
| `POST` | `/api/surveys/:id/generate-bom` | Admin only | Yes | AI-generate BOM from survey |

### Quotation Management

| Method | Endpoint | Auth | CSRF | Description |
|--------|----------|------|------|-------------|
| `GET` | `/api/quotations` | Any authenticated | - | List quotations |
| `GET` | `/api/quotations/:id` | Any authenticated | - | Get quotation with line items |
| `POST` | `/api/quotations` | Admin only | Yes | Create new quotation |
| `PUT` | `/api/quotations/:id` | Admin only | Yes | Update quotation (optimistic locking) |
| `POST` | `/api/quotations/bulk` | Admin only | Yes | Bulk send/convert/delete/export |
| `POST` | `/api/quotations/:id/items` | Admin only | Yes | Add line item |
| `PUT` | `/api/quotations/:id/items/:itemId` | Admin only | Yes | Update line item |
| `DELETE` | `/api/quotations/:id/items/:itemId` | Admin only | Yes | Remove line item |
| `POST` | `/api/quotations/:id/recalculate` | Admin only | Yes | Recalculate totals |
| `POST` | `/api/quotations/:id/send` | Admin only | Yes | Send via Telegram + generate portal token |
| `POST` | `/api/quotations/:id/send-email` | Admin only | Yes | Send via email (Resend + Telegram backup) |
| `GET` | `/api/quotations/:id/pdf` | Admin only | - | Generate PDF quotation |
| `POST` | `/api/quotations/:id/convert-job` | Admin only | Yes | Convert to service job |
| `POST` | `/api/quotations/:id/convert-invoice` | Admin only | Yes | Convert to POS invoice |
| `POST` | `/api/quotations/:id/save-drive` | Admin only | Yes | Save to Google Drive |
| `POST` | `/api/quotations/:id/deduct-stock` | Admin only | Yes | Deduct inventory stock |
| `POST` | `/api/quotations/:id/save-revision` | Admin only | Yes | Save revision snapshot |
| `POST` | `/api/quotations/:id/restore-revision` | Admin only | Yes | Restore from revision |
| `GET` | `/api/quotations/:id/revisions` | Any authenticated | - | List revision history |
| `POST` | `/api/ai/estimate-quotation` | Admin only | Yes | AI BOM & cable estimator |
| `POST` | `/api/enterprise/matrix/commit` | Admin only | Yes | Enterprise matrix commit |

### Customer Portal (Public — token-based, no auth/CSRF)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/portal/quote/:token` | None (portal_token) | View quotation |
| `POST` | `/api/portal/quote/:token/approve` | None (portal_token) | Approve with signature |
| `POST` | `/api/portal/quote/:token/reject` | None (portal_token) | Reject with reason |

## Frontend Components

### Admin Surveys View (`admin-surveys.js`)

- **Pipeline Status Bar**: Stat cards showing Draft/Completed/Quoted/Cancelled counts
- **Tabbed View**: Surveys tab + Quotations tab
- **Detail Panel**: Opens on row click with full details and actions
- **Line Items Table**: Editable grid in quotation detail
- **Add/Edit Item Modal**: Category, name, qty, unit, price fields
- **Bulk Action Bar**: Select multiple quotations → send/convert/delete/export
- **Event Delegation**: All click handlers use `data-action` attributes with `document.addEventListener('click')`

### Technician Survey Checklist (`app.html`)

- **Expanded Modal**: Site info + survey details + photo capture
- **Photo Capture Grid**: 5 typed slots with camera API (gallery fallback, no `capture="environment"`)
- **Submit Assessment**: Calls `PUT /api/surveys/:id/complete`

### Customer Portal (`portal.html`)

- **Read-only Quotation**: Client cannot edit items
- **Canvas Signature Pad**: Touch/mouse drawing
- **Approve/Reject Buttons**: With optional rejection reason
- **PDF/Excel Download**: Portal users can download quotation as PDF or Excel
- **Dark/Light Mode**: Theme toggle with CSS variables

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Missing or invalid JWT | Re-authenticate |
| `403 Forbidden` | Non-admin accessing admin endpoint or invalid CSRF | Check user role + CSRF token |
| `404 Survey not found` | Invalid survey ID | Verify ID exists |
| `404 Quotation not found` | Invalid quotation ID | Verify ID exists |
| `409 Conflict` | Quotation modified by another user (optimistic locking) | Refresh and retry |
| `400 photo_url is required` | Missing photo URL in request body | Include `photo_url` |
| `400 client_id is required` | Missing client ID when creating survey | Include `client_id` |

### Validation Rules

- `quotation_items.quantity` must be > 0
- `quotation_items.unit_price` must be >= 0
- `quotation_items.category` must be one of: hardware, cable, labor, software, other
- `survey_photos.photo_type` must be one of: server_room, cable_path, power_source, camera_fov, exterior, general
- `quotations.portal_token` must be unique across all quotations
- `quotations.discount_pct` and `quotations.tax_pct` are percentages (0-100)

## Testing Checklist

1. **Survey CRUD**: Create, read, update, complete survey
2. **Photo Upload**: Upload photos with different types, verify in survey detail
3. **Quotation CRUD**: Create quotation, add/edit/remove line items
4. **Totals Recalculation**: Verify totals update after every item change
5. **Portal Token**: Generate token, access quotation via portal URL
6. **Approval Flow**: Client approves with signature, verify signature stored
7. **Rejection Flow**: Client rejects with reason, verify reason stored
8. **Convert to Job**: 1-click convert quotation to service job
9. **Convert to Invoice**: 1-click convert quotation to POS invoice
10. **AI BOM Estimation**: Generate quotation from survey data
11. **Telegram Notification**: Verify quotation sent via Telegram with portal link
12. **Pipeline Counts**: Verify status bar counts update correctly
13. **Bulk Operations**: Select multiple → send/convert/delete/export
14. **Revision History**: Save revision, browse history, restore
15. **Stock Deduction**: Link item to inventory, deduct stock
16. **PDF Generation**: Download PDF from quotation detail
17. **Email Delivery**: Send quotation via email
18. **Optimistic Locking**: Concurrent edits detected
