-- Config & Roles sync to Cloudflare D1
PRAGMA foreign_keys = OFF;

-- === TABLE: roles ===
CREATE TABLE IF NOT EXISTS roles (
    name TEXT PRIMARY KEY,
    permissions TEXT NOT NULL
);
DELETE FROM roles;
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Admin', '{"clients":"write","technicians":"write","jobs":"write","service_fees":"write","cash_safe":"write","pos":"write","inventory":"write","pdf_builder":"write"}');
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Sales', '{"clients":"write","technicians":"none","jobs":"read","service_fees":"read","cash_safe":"none","pos":"write","inventory":"read","pdf_builder":"none"}');
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Technician', '{"clients":"read","technicians":"none","jobs":"write","service_fees":"none","cash_safe":"none","pos":"none","inventory":"read","pdf_builder":"none"}');
INSERT OR IGNORE INTO roles (name, permissions) VALUES ('Manager', '{"clients":"read","technicians":"read","jobs":"read","service_fees":"read","cash_safe":"read","pos":"read","inventory":"read","pdf_builder":"read"}');

-- === TABLE: system_config ===
CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT
);
DELETE FROM system_config;

-- === TABLE: service_fees ===
CREATE TABLE IF NOT EXISTS service_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT NOT NULL,
    fee_amount REAL NOT NULL,
    currency TEXT CHECK(currency IN ('USD', 'MMK')) NOT NULL,
    description TEXT
);
DELETE FROM service_fees;

PRAGMA foreign_keys = ON;