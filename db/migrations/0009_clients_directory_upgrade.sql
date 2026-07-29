-- Migration 0009: Clients Directory upgrade
-- Adds email, notes, tags, client_type, priority, last_contact, job_count, total_revenue

-- 1. New columns (constant defaults only — SQLite limitation)
ALTER TABLE clients ADD COLUMN email TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN notes TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN tags TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN client_type TEXT NOT NULL DEFAULT 'Corporate';
ALTER TABLE clients ADD COLUMN priority TEXT NOT NULL DEFAULT 'Normal' CHECK(priority IN ('Low', 'Normal', 'High', 'VIP'));
ALTER TABLE clients ADD COLUMN last_contact TEXT DEFAULT '';
ALTER TABLE clients ADD COLUMN job_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN total_revenue REAL NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE clients ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- 2. Backfill timestamps for existing rows
UPDATE clients SET created_at = datetime('now'), updated_at = datetime('now') WHERE created_at = '';
UPDATE clients SET client_type = 'Corporate' WHERE amc_status != 'Individual';
UPDATE clients SET client_type = 'Individual' WHERE amc_status = 'Individual';

-- 3. Backfill job_count from service_records
UPDATE clients SET job_count = (
  SELECT COUNT(*) FROM service_records WHERE service_records.client_id = clients.id
);

-- 4. Seed some tag examples
UPDATE clients SET tags = 'priority,amc-active' WHERE amc_status = 'Active';
UPDATE clients SET tags = 'expired,renewal-needed' WHERE amc_status = 'Expired';
