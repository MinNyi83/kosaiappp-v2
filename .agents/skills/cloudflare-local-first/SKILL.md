---
name: cloudflare-local-first
description: Enforces running and testing in the local environment first and defers cloud/Cloudflare deployment until the user explicitly requests it.
---

# Cloudflare Local-First Development & Deployment

This skill ensures that all development, running, and testing tasks are performed exclusively in the local environment. Cloudflare production deployment should only be executed when the user explicitly requests it.

## Rules & Guidelines

1. **Local Environment Only**:
   - Always run and test application code locally using Wrangler's local development server (e.g., `npx wrangler dev` or `npm run dev`).
   - Do NOT run production deployment commands like `npx wrangler deploy` or `npm run deploy` unless specifically instructed.

2. **Wait for Deployment Trigger**:
   - Defer Cloudflare cloud deployment until the user explicitly says: **"deploy cloudflare"** or **"deploy to cloudflare"**.
   - If changes need to be verified, prompt the user with local verification steps first.

## Local Development Commands

```bash
# Start development server
npx wrangler dev

# Run tests
npm run test

# Run type checking
npm run typecheck

# Format code
npm run format

# Build CSS
npm run build:css

# Watch CSS changes
npm run watch:css
```

## Deployed Environments

When deployment is explicitly requested, deploy the respective layers using these target endpoints:

### 1. Backend API (Cloudflare Workers)

- **Target URL**: `https://cctv-service-system.nyinyimin2007.workers.dev/`
- **Deployment Command**: `npx wrangler deploy`
- **Logs**: `npx wrangler tail`

### 2. Frontend Console (Cloudflare Pages)

- **Target URL**: `https://awesomemyanmar.pages.dev/`
- **Deployment Command**: `npx wrangler pages deploy ./public --project-name awesomemyanmar`
- **Project Name**: `awesomemyanmar`

### 3. Database (Cloudflare D1)

- **Target Database**: `cctv-fsm-db`
- **Database ID**: `a887d01b-41ac-4ef7-9e9d-464a3f52f15b`

## D1 Database Management

### Local Database Operations

```bash
# Run schema migration locally
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/schema.sql

# Seed mock data locally
npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/mock_data.sql

# Query local database
npx wrangler d1 execute cctv-fsm-db --local --command="SELECT * FROM clients LIMIT 10"

# Backup local database
npx wrangler d1 export cctv-fsm-db --local > local_backup.sql
```

### Remote Database Operations

```bash
# Run schema migration remotely
npx wrangler d1 execute cctv-fsm-db --remote --file=db/migrations/schema.sql

# Query remote database
npx wrangler d1 execute cctv-fsm-db --remote --command="SELECT * FROM clients LIMIT 10"

# Backup remote database
npx wrangler d1 export cctv-fsm-db --remote > remote_backup.sql
```

### D1 Migration Rules

1. **SQLITE_TOOBIG Limit (100KB)**: Cloudflare D1 restricts single SQL statements to 100KB.
   - Large tables (like `technicians` with base64 profiles) must have their base64 image strings replaced with `NULL` during data migration/sync scripts.
   - Bulk inserts must be split into individual `INSERT OR IGNORE` statement lines.

2. **Foreign Key Dependencies**: Drop and recreate tables in order:
   ```sql
   -- Drop in reverse dependency order
   DROP TABLE IF EXISTS quotation_items;
   DROP TABLE IF EXISTS survey_photos;
   DROP TABLE IF EXISTS cost_quotations_enterprise;
   DROP TABLE IF EXISTS target_camera_locations;
   DROP TABLE IF EXISTS core_projects;
   DROP TABLE IF EXISTS camera_placements;
   DROP TABLE IF EXISTS server_rooms;
   DROP TABLE IF EXISTS cash_transactions;
   DROP TABLE IF EXISTS inventory_items;
   DROP TABLE IF EXISTS service_records;
   DROP TABLE IF EXISTS quotations;
   DROP TABLE IF EXISTS site_surveys;
   DROP TABLE IF EXISTS inventory_stock;
   DROP TABLE IF EXISTS inventory_batches;
   DROP TABLE IF EXISTS clients;
   DROP TABLE IF EXISTS technicians;
   
   -- Create in dependency order
   CREATE TABLE technicians (...);
   CREATE TABLE clients (...);
   CREATE TABLE site_surveys (...);
   CREATE TABLE quotations (...);
   CREATE TABLE survey_photos (...);
   CREATE TABLE quotation_items (...);
   ```

3. **Missing Column Alignments**: Always cross-reference table column structures between local SQLite and remote D1 schemas. Run `ALTER TABLE` to align if missing.

4. **Schema File Location**: Use `db/migrations/schema.sql` as the source of truth (not the legacy `schema.sql` in root).

5. **Migration Files**: Use numbered migration files in `db/migrations/` (e.g., `0006_survey_quotation_redesign.sql`). Apply in order:
   ```bash
   # Apply specific migration locally
   npx wrangler d1 execute cctv-fsm-db --local --file=db/migrations/0006_survey_quotation_redesign.sql
   
   # Apply specific migration remotely
   npx wrangler d1 execute cctv-fsm-db --remote --file=db/migrations/0006_survey_quotation_redesign.sql
   ```

## Testing Workflow

1. **Make changes** to source code
2. **Run locally** with `npx wrangler dev`
3. **Test endpoints** using curl or browser
4. **Run unit tests** with `npm run test`
5. **Verify database** with local D1 queries
6. **Request deployment** only when user says "deploy cloudflare"
