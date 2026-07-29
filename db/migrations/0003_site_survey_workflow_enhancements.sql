-- Migration 0003: Site Survey & Quotation Workflow Enhancements
ALTER TABLE site_surveys ADD COLUMN scheduled_date TEXT;
ALTER TABLE site_surveys ADD COLUMN checklist_data TEXT DEFAULT '{}';
ALTER TABLE site_surveys ADD COLUMN approval_status TEXT DEFAULT 'Pending';
ALTER TABLE site_surveys ADD COLUMN approved_by TEXT REFERENCES technicians(id);

ALTER TABLE quotations ADD COLUMN approval_status TEXT DEFAULT 'Pending';
ALTER TABLE quotations ADD COLUMN approved_by TEXT REFERENCES technicians(id);
ALTER TABLE quotations ADD COLUMN margin_notes TEXT;
