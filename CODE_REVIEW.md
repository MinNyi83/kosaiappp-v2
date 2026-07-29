# Codebase Review: KosAI v2
**Date:** 2026-07-28 (Updated: 2026-07-28)

---

## CRITICAL (Fix Immediately)

1. **Hardcoded admin secret in public JS** — `public/index.html:1290` has `'X-Admin-Secret': 'SuperSecureAdminPass123!'` exposed client-side. Anyone can see it.

2. **Inconsistent XSS escaping** — `escapeHTML()` exists in `admin-core.js` but isn't used in dozens of template literals across `admin.js`. Values like `company_name`, `tech_name`, `service_type`, `status`, `job_description`, `technician_notes` are injected raw into HTML.

3. **SQL string interpolation** — `src/modules/routes/admin.ts:726` interpolates user input directly into SQL via `${techId}` instead of using parameterized `.bind()`.

---

## HIGH Priority

4. **Missing database tables** — `attendance`, `exchange_rates`, `landing_page_content`, `contact_submissions` are queried but have no `CREATE TABLE` in any migration.

5. **Schema column mismatches** — `service_fees` queries columns (`active`, `category`, `name`) that don't exist in the schema. `technicians` queries `telegram_username`, `specialties`, `created_at` which are also missing.

6. **TypeScript strict mode disabled** — `tsconfig.json` has `strict: false`. No `noImplicitAny`, no `strictNullChecks`. A 40+ file codebase with no type safety.

7. **No lint/typecheck in CI/CD** — `deploy.yml` goes straight from `npm test` to `deploy`. No `tsc --noEmit`, no `prettier --check`, no linting.

8. **CSRF and JWT share the same secret** — `csrf.ts:7` falls back to `JWT_SECRET` if `CSRF_SECRET` is unset.

9. **Plain-text PIN comparison** — `auth.ts:182` compares PINs with `===` without an environment guard. Default PIN for all technicians is `1234`.

---

## MEDIUM Priority

10. **Massive monolithic files** — `admin.js` is **8,864 lines** (reduced from 9,466 after module split). Still large but now split into 4 files.

11. **Global namespace pollution** — 100+ functions assigned to `window.*`, including a `window.fetch` override that intercepts ALL fetch calls site-wide.

12. **Pagination boilerplate duplicated** across 4+ route files. Should be a shared utility.

13. **Auth check boilerplate** repeated 35+ times (`const user = await authenticate(request); if (!user) return error(...)`) with no middleware support in the router.

14. **Missing database indexes** — `technicians.email`, `technicians.telegram_username`, `attendance(technician_id, date)`, `cash_transactions.transaction_type` are frequently queried with no index.

15. **Foreign keys disabled during schema creation** — `PRAGMA foreign_keys = OFF` at top of `schema.sql` means all `REFERENCES` clauses are unenforced.

16. **Frontend accessibility gaps** — Missing `aria-labels`, no skip-to-content link, `user-scalable=no` preventing zoom, keyboard-unfriendly `onclick` on divs.

17. **No SEO metadata** — `index.html` has no `<meta description>`, no Open Graph tags, no structured data.

18. **View partials loaded sequentially** — `admin.js` fetches 19 HTML views in a `for` loop with `await`. Should use `Promise.all()`.

---

## LOW Priority

19. **Stale files** — `admin.js.bak_emoji` backup in production, `"main": "admin.js"` in `package.json` pointing nowhere, `add_performance_indexes.sql` is redundant with `schema.sql`.

20. **`ADMIN_EMAIL` hardcoded** in `wrangler.toml`.

21. **`dotenv` dependency unnecessary** for Cloudflare Workers.

22. **Service worker has no offline fallback** and isn't registered in `admin.html`.

23. **`manifest.json`** uses same image for 192x192 and 512x512 icons.

---

## RESOLVED (Fixed 2026-07-28)

### ✅ Duplicate script loading
`admin.html` was loading `admin.js` twice. Now loads 4 module files in order: `admin-core.js`, `admin-surveys.js`, `admin-receipt.js`, `admin.js`.

### ✅ CSRF protection missing on most endpoints
**Before:** Only `clients.ts` consistently used `requireCsrf()`.
**After:** All 142 endpoints audited. 58 state-changing endpoints now have CSRF protection. All POST/PUT/DELETE endpoints (except login and portal) have `requireCsrf()`.

### ✅ Access permission audit
**Before:** 3 endpoints missing auth, 9 admin paths missing role check.
**After:** All 142 endpoints verified:
- 0 missing auth
- 0 missing CSRF on state-changing endpoints
- 0 admin paths without role check
- Portal endpoints intentionally use token-based auth (no auth/CSRF)

### ✅ Admin.js module split
**Before:** Single 9,466-line file.
**After:** Split into 4 files:
- `admin-core.js` (555 lines) — shared utilities, event delegation, fetch interceptor
- `admin-surveys.js` (748 lines) — survey/quotation CRUD, line items, bulk ops, BOM
- `admin-receipt.js` (259 lines) — receipt builder settings, preview, print
- `admin.js` (8,864 lines remaining) — init, dashboard, inventory, jobs, clients

### ✅ Event delegation
**Before:** Inline `onclick` attributes everywhere.
**After:** `data-action` attributes + `document.addEventListener('click')` in `admin-core.js`.

### ✅ Service layer extraction (modular monolith)
**Before:** All business logic in route handlers (1,532 lines in surveys.ts).
**After:** Services extracted:
- `survey.service.ts` (136 lines) — SurveyService class
- `quotation.service.ts` (402 lines) — QuotationService class
- `surveys.ts` reduced to 1,089 lines (-29%)

### ✅ Camera gallery fallback
**Before:** `capture="environment"` forced camera-only on mobile.
**After:** Removed from all file inputs in `app.html` and `app.js` — users can choose gallery or camera.

### ✅ Receipt template persistence
**Before:** Receipt template reset on page reload.
**After:** Saves to `system_config` API + localStorage fallback.

### ✅ Quotation versioning
**After:** `quotation_revisions` table with save/restore revision endpoints.

### ✅ Bulk operations
**After:** `POST /api/quotations/bulk` for send/convert/delete/export with checkbox UI.

### ✅ Portal PDF/Excel
**After:** Portal users can download quotation as PDF or Excel.

### ✅ Loading spinners
**After:** `showLoading()`/`hideLoading()` on all major async operations.

### ✅ Optimistic locking
**After:** Quotation PUT checks `_client_updated_at` vs `updated_at`.

### ✅ Inventory stock linkage
**After:** `quotation_items.inventory_item_id` + `POST /api/quotations/:id/deduct-stock`.

### ✅ Email delivery
**After:** `POST /api/quotations/:id/send-email` via Resend API + Telegram backup.

### ✅ Server-side PDF
**After:** `GET /api/quotations/:id/pdf` — styled HTML quotation generator.
