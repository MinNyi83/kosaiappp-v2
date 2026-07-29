-- Migration 0007: Quotation Improvements v2
-- Adds: quotation_revisions table, inventory linkage, email fields

-- ── New Table: quotation_revisions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotation_revisions (
  id TEXT PRIMARY KEY,
  quotation_id TEXT NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL DEFAULT 1,
  snapshot_json TEXT NOT NULL,
  revised_by TEXT REFERENCES technicians(id),
  change_notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_quotation_revisions_quote ON quotation_revisions(quotation_id);

-- ── Extend quotation_items ────────────────────────────────────────────────────
ALTER TABLE quotation_items ADD COLUMN inventory_item_id TEXT;
ALTER TABLE quotation_items ADD COLUMN stock_deducted INTEGER DEFAULT 0;

-- ── Extend quotations ───────────────────────────────────────────────────────
ALTER TABLE quotations ADD COLUMN email_sent_to TEXT;
ALTER TABLE quotations ADD COLUMN email_sent_at TEXT;
ALTER TABLE quotations ADD COLUMN current_revision INTEGER DEFAULT 1;
ALTER TABLE quotations ADD COLUMN last_updated_by TEXT REFERENCES technicians(id);
