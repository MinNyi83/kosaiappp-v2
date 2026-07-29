-- Migration 0006: Survey & Quotation System Redesign
-- Adds: survey_photos, quotation_items tables
-- Extends: site_surveys, quotations with new columns

-- ── New Table: survey_photos ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS survey_photos (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL REFERENCES site_surveys(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  photo_type TEXT CHECK (photo_type IN (
    'server_room', 'cable_path', 'power_source',
    'camera_fov', 'exterior', 'general'
  )) NOT NULL DEFAULT 'general',
  caption TEXT,
  uploaded_by TEXT REFERENCES technicians(id),
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_survey_photos_survey ON survey_photos(survey_id);

-- ── New Table: quotation_items ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_code TEXT,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN (
    'hardware', 'cable', 'labor', 'software', 'other'
  )) NOT NULL DEFAULT 'hardware',
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pc',
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quote ON quotation_items(quotation_id);

-- ── Extend site_surveys ─────────────────────────────────────────────────────
ALTER TABLE site_surveys ADD COLUMN site_type TEXT;
ALTER TABLE site_surveys ADD COLUMN site_address TEXT;
ALTER TABLE site_surveys ADD COLUMN contact_name TEXT;
ALTER TABLE site_surveys ADD COLUMN contact_phone TEXT;
ALTER TABLE site_surveys ADD COLUMN existing_infrastructure TEXT;
ALTER TABLE site_surveys ADD COLUMN special_requirements TEXT;

-- ── Extend quotations ───────────────────────────────────────────────────────
ALTER TABLE quotations ADD COLUMN survey_id_link TEXT REFERENCES site_surveys(id);
ALTER TABLE quotations ADD COLUMN discount_pct REAL DEFAULT 0;
ALTER TABLE quotations ADD COLUMN discount_amount REAL DEFAULT 0;
ALTER TABLE quotations ADD COLUMN tax_pct REAL DEFAULT 0;
ALTER TABLE quotations ADD COLUMN client_signature TEXT;
ALTER TABLE quotations ADD COLUMN client_signature_url TEXT;
ALTER TABLE quotations ADD COLUMN portal_token TEXT;
ALTER TABLE quotations ADD COLUMN quotation_notes TEXT;
ALTER TABLE quotations ADD COLUMN sent_at TEXT;
ALTER TABLE quotations ADD COLUMN viewed_at TEXT;
ALTER TABLE quotations ADD COLUMN approved_at TEXT;
ALTER TABLE quotations ADD COLUMN rejected_at TEXT;
ALTER TABLE quotations ADD COLUMN rejection_reason TEXT;

-- UNIQUE constraint via index (SQLite doesn't support ALTER TABLE ADD COLUMN ... UNIQUE)
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_portal_token ON quotations(portal_token) WHERE portal_token IS NOT NULL;
