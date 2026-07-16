PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS roles (
    name TEXT PRIMARY KEY,
    permissions TEXT NOT NULL
);

-- Seed default roles
INSERT OR REPLACE INTO roles (name, permissions) VALUES ('Admin', '{"clients":"write","technicians":"write","jobs":"write","service_fees":"write","cash_safe":"write","pos":"write","inventory":"write","pdf_builder":"write"}');
INSERT OR REPLACE INTO roles (name, permissions) VALUES ('Sales', '{"clients":"write","technicians":"none","jobs":"read","service_fees":"read","cash_safe":"none","pos":"write","inventory":"read","pdf_builder":"none"}');
INSERT OR REPLACE INTO roles (name, permissions) VALUES ('Technician', '{"clients":"read","technicians":"none","jobs":"write","service_fees":"none","cash_safe":"none","pos":"none","inventory":"read","pdf_builder":"none"}');

-- Recreate technicians table to remove role CHECK constraint
CREATE TABLE IF NOT EXISTS technicians_new (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    role TEXT NOT NULL REFERENCES roles(name),
    phone TEXT,
    active INTEGER DEFAULT 1,
    email TEXT,
    username TEXT,
    password TEXT,
    pin TEXT DEFAULT '1234',
    photo TEXT,
    permissions TEXT DEFAULT 'read_write'
);

-- Copy data
INSERT INTO technicians_new (id, name, nickname, role, phone, active, email, username, password, pin, photo, permissions)
SELECT id, name, nickname, role, phone, active, email, username, password, pin, photo, permissions FROM technicians;

-- Replace table
DROP TABLE technicians;
ALTER TABLE technicians_new RENAME TO technicians;

PRAGMA foreign_keys = ON;
