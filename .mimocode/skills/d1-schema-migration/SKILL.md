---
name: d1-schema-migration
description: Patterns for adding tables, columns, and schema changes to the production Cloudflare D1 database via wrangler CLI.
---

# D1 Database Schema Migration

Standard workflow for modifying the production D1 database schema.

## When to Use

- Adding new tables needed by features (e.g., attendance table for Telegram commands)
- Adding missing columns to existing tables
- Fixing schema mismatches between local and production

## Quick Commands

### Check existing tables

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
```

### Check table columns

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "PRAGMA table_info(TableName)"
```

### Create a new table

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "CREATE TABLE IF NOT EXISTS tablename (id TEXT PRIMARY KEY, column1 TEXT, column2 TEXT)"
```

### Add missing columns

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "ALTER TABLE tablename ADD COLUMN newcolumn TEXT"
```

### Query data

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "SELECT * FROM tablename LIMIT 10"
```

## Known Tables & Required Columns

### technicians

- id, name, nickname, role, phone, active, email, username, password, pin, photo, permissions, telegram_username, last_login
- NO `specialties` column exists

### service_records

- id, client_id, technician_id, service_type, status, job_description, technician_notes, equipment_used, before_photo, after_photo, arrival_time, completion_time, arrival_lat, arrival_lng, completion_lat, completion_lng, maps_url, signature, checklist_data, created_at, updated_at
- **Telegram-needed**: company_name, client_name, client_phone, address, completed_at

### attendance

- id, technician_id, date, clock_in, clock_out, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, notes

### system_config

- config_key (TEXT, PRIMARY KEY), config_value (TEXT), description (TEXT), updated_by (TEXT), updated_at (TEXT)
- Stores Google Drive refresh token, landing page config, and other key-value settings

## Migration Checklist

1. Check if table/column exists: `PRAGMA table_info(tablename)`
2. Create/alter if missing
3. Verify the change: `SELECT * FROM tablename LIMIT 1`
4. Test the feature that depends on the schema

## Local ↔ Remote Schema Sync

Local `wrangler dev` uses a separate D1 database file. Production uses `--remote`. Schemas can drift apart.

### Detect drift

Compare local vs remote schemas:

```bash
# Local (no --remote flag)
npx wrangler d1 execute cctv-fsm-db --command "PRAGMA table_info(technicians)"

# Remote (production)
npx wrangler d1 execute cctv-fsm-db --remote --command "PRAGMA table_info(technicians)"
```

If columns differ, ALTER the one that's behind:

```bash
# Add missing column to local
npx wrangler d1 execute cctv-fsm-db --command "ALTER TABLE technicians ADD COLUMN telegram_username TEXT"

# Add missing column to remote
npx wrangler d1 execute cctv-fsm-db --remote --command "ALTER TABLE technicians ADD COLUMN telegram_username TEXT"
```

### Restart wrangler dev after schema changes

`wrangler dev` caches the DB schema on startup. After any `ALTER TABLE` or `CREATE TABLE`, you must **fully stop and restart** the dev server:

```powershell
Stop-Process -Name "node" -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
npx wrangler dev --port 8787
```

Browser refresh alone is NOT sufficient.

## Rules

- Always use `--remote` flag for production database
- Always check existing schema before adding columns (avoids duplicates)
- Never drop tables without explicit user confirmation
- **D1 rejects non-constant defaults in ALTER TABLE**: `ALTER TABLE ... ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))` fails. Add column without DEFAULT, let application code set values on INSERT.
