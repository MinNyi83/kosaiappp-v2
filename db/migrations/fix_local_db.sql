-- Create missing tables for local development

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    name TEXT PRIMARY KEY,
    permissions TEXT NOT NULL
);

INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Admin', '{"clients":"write","technicians":"write","jobs":"write","service_fees":"write","cash_safe":"write","pos":"write","inventory":"write","pdf_builder":"write"}');
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Sales', '{"clients":"write","technicians":"none","jobs":"read","service_fees":"read","cash_safe":"none","pos":"write","inventory":"read","pdf_builder":"none"}');
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Technician', '{"clients":"read","technicians":"none","jobs":"write","service_fees":"none","cash_safe":"none","pos":"none","inventory":"read","pdf_builder":"none"}');

-- Inventory categories
CREATE TABLE IF NOT EXISTS inv_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    code TEXT
);

-- Inventory sub-categories
CREATE TABLE IF NOT EXISTS inv_sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category_id INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    code TEXT
);

-- Inventory brands
CREATE TABLE IF NOT EXISTS inv_brands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    code TEXT
);

-- Inventory stock units
CREATE TABLE IF NOT EXISTS inv_stock_units (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Distributors
CREATE TABLE IF NOT EXISTS distributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    product_lines TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Warranties
CREATE TABLE IF NOT EXISTS warranties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT,
    device_name TEXT,
    client_id TEXT,
    installed_date TEXT,
    warranty_months INTEGER DEFAULT 12,
    status TEXT DEFAULT 'Active',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- RMA Claims
CREATE TABLE IF NOT EXISTS rma_claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    serial_number TEXT,
    device_name TEXT,
    client_id TEXT,
    distributor TEXT,
    rma_id TEXT,
    sent_date TEXT,
    status TEXT DEFAULT 'Pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Service fees
CREATE TABLE IF NOT EXISTS service_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT NOT NULL,
    fee_amount REAL NOT NULL,
    currency TEXT NOT NULL,
    description TEXT
);

-- System config
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT
);

-- Landing page content
CREATE TABLE IF NOT EXISTS landing_page (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE,
    config_value TEXT
);

-- Seed some inventory categories
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (1, 'Camera', '01');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (2, 'Switch', '02');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (3, 'DVR', '03');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (4, 'NVR', '04');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (5, 'Cable', '05');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (6, 'Router / Gateway', '06');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (7, 'Fiber', '07');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (8, 'Computer & Accessories', '08');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (9, 'CPE/Access Point', '09');
INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES (10, 'Access Control', '10');

-- Seed some brands
INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES (1, 'Dahua', '01');
INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES (2, 'Hikvision', '02');
INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES (3, 'Ubiquiti', '03');
INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES (4, 'Mikrotik', '04');
INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES (5, 'TP-Link', '05');

-- Seed some units
INSERT OR IGNORE INTO inv_stock_units (id, name, abbreviation) VALUES (1, 'Pieces', 'pcs');
INSERT OR IGNORE INTO inv_stock_units (id, name, abbreviation) VALUES (2, 'Meters', 'meter');
INSERT OR IGNORE INTO inv_stock_units (id, name, abbreviation) VALUES (3, 'Packs', 'pack');
INSERT OR IGNORE INTO inv_stock_units (id, name, abbreviation) VALUES (4, 'Boxes', 'box');
INSERT OR IGNORE INTO inv_stock_units (id, name, abbreviation) VALUES (5, 'Sets', 'set');
