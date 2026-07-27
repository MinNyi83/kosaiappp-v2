-- Migration: Add site_surveys and quotations tables
CREATE TABLE IF NOT EXISTS site_surveys (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    technician_id TEXT REFERENCES technicians(id),
    survey_date TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('Draft', 'Completed', 'Quoted', 'Cancelled')) DEFAULT 'Draft',
    building_type TEXT,
    camera_count INTEGER DEFAULT 0,
    cable_type TEXT,
    estimated_cable_meters REAL DEFAULT 0,
    power_source_notes TEXT,
    mounting_type TEXT,
    site_photos TEXT DEFAULT '[]',
    layout_diagram_url TEXT,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotations (
    id TEXT PRIMARY KEY,
    survey_id TEXT REFERENCES site_surveys(id),
    client_id TEXT REFERENCES clients(id) NOT NULL,
    prepared_by TEXT REFERENCES technicians(id) NOT NULL,
    quotation_date TEXT DEFAULT CURRENT_TIMESTAMP,
    valid_until TEXT,
    status TEXT CHECK(status IN ('Draft', 'Sent', 'Approved', 'Rejected', 'Converted')) DEFAULT 'Draft',
    items TEXT NOT NULL DEFAULT '[]',
    subtotal REAL DEFAULT 0.00,
    discount REAL DEFAULT 0.00,
    tax REAL DEFAULT 0.00,
    total_amount REAL DEFAULT 0.00,
    currency TEXT CHECK(currency IN ('USD', 'MMK')) DEFAULT 'USD',
    exchange_rate REAL DEFAULT 1.0,
    terms_conditions TEXT,
    drive_file_id TEXT,
    drive_url TEXT,
    converted_job_id TEXT REFERENCES service_records(id),
    converted_invoice_id TEXT REFERENCES invoices(id),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
