-- Migration 0008: Service Fee Catalog upgrade
-- Adds category, unit, min_charge, active, sort_order, created_at, updated_at

-- 1. New columns (constant defaults only — SQLite limitation)
ALTER TABLE service_fees ADD COLUMN category TEXT NOT NULL DEFAULT 'General';
ALTER TABLE service_fees ADD COLUMN unit TEXT NOT NULL DEFAULT 'per job';
ALTER TABLE service_fees ADD COLUMN min_charge REAL DEFAULT 0;
ALTER TABLE service_fees ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE service_fees ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE service_fees ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
ALTER TABLE service_fees ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

-- 2. Backfill timestamps for existing rows
UPDATE service_fees SET created_at = datetime('now'), updated_at = datetime('now') WHERE created_at = '';

-- 3. Seed some default categories for existing data
UPDATE service_fees SET category = 'CCTV' WHERE service_type = 'CCTV';
UPDATE service_fees SET category = 'Networking' WHERE service_type = 'Networking';
UPDATE service_fees SET category = 'WiFi' WHERE service_type = 'WiFi';
UPDATE service_fees SET category = 'NAS' WHERE service_type = 'NAS';
UPDATE service_fees SET category = 'Maintenance' WHERE service_type = 'General Maintenance';

-- 4. Seed sample service fee catalog
INSERT INTO service_fees (service_type, fee_amount, currency, description, category, unit, min_charge, active, sort_order, created_at, updated_at) VALUES
  ('CCTV Installation', 50000, 'MMK', 'Standard CCTV camera installation per device', 'CCTV', 'per device', 50000, 1, 1, datetime('now'), datetime('now')),
  ('CCTV Maintenance Visit', 30000, 'MMK', 'Quarterly maintenance check per visit', 'Maintenance', 'per trip', 30000, 1, 2, datetime('now'), datetime('now')),
  ('Network Cabling (per meter)', 5000, 'MMK', 'CAT6/CAT7 cable installation per meter', 'Networking', 'per meter', 5000, 1, 3, datetime('now'), datetime('now')),
  ('WiFi Mesh Setup', 80000, 'MMK', 'Full WiFi mesh network deployment', 'WiFi', 'per job', 80000, 1, 4, datetime('now'), datetime('now')),
  ('NAS Configuration', 120000, 'MMK', 'NAS storage setup and configuration', 'NAS', 'per job', 120000, 1, 5, datetime('now'), datetime('now')),
  ('On-site Troubleshooting', 25000, 'MMK', 'Hourly rate for on-site technical support', 'Maintenance', 'per hour', 25000, 1, 6, datetime('now'), datetime('now')),
  ('System Health Check', 40000, 'MMK', 'Full system diagnostics and report', 'Maintenance', 'fixed', 40000, 1, 7, datetime('now'), datetime('now')),
  ('Camera Relocation', 20000, 'MMK', 'Move and reinstall existing camera', 'CCTV', 'per device', 20000, 1, 8, datetime('now'), datetime('now'));
