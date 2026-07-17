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

## Migration Checklist

1. Check if table/column exists: `PRAGMA table_info(tablename)`
2. Create/alter if missing
3. Verify the change: `SELECT * FROM tablename LIMIT 1`
4. Test the feature that depends on the schema

## Rules
- Always use `--remote` flag for production database
- Always check existing schema before adding columns (avoids duplicates)
- Never drop tables without explicit user confirmation
