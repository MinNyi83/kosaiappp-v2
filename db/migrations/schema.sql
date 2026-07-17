PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS cash_transactions;
DROP TABLE IF EXISTS cash_safes;
DROP TABLE IF EXISTS inventory_items;
DROP TABLE IF EXISTS inventory_batches;
DROP TABLE IF EXISTS stock_code_map;
DROP TABLE IF EXISTS inventory_stock;
DROP TABLE IF EXISTS service_records;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS technicians;
DROP TABLE IF EXISTS system_config;
DROP TABLE IF EXISTS service_fees;


CREATE TABLE technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    role TEXT CHECK(role IN ('Sales', 'Technician', 'Admin')) NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1,
    email TEXT,
    username TEXT,
    password TEXT,
    pin TEXT DEFAULT '1234',
    photo TEXT,
    last_login TEXT,
    permissions TEXT CHECK(permissions IN ('read', 'read_write')) DEFAULT 'read_write'
);


CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    address TEXT NOT NULL,
    phone TEXT,
    amc_start TEXT,
    amc_end TEXT,
    amc_status TEXT CHECK(amc_status IN ('Active', 'Inactive', 'Expired', 'No AMC', 'Individual')) DEFAULT 'Inactive'
);

CREATE TABLE service_records (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    technician_id TEXT REFERENCES technicians(id),
    service_type TEXT CHECK(service_type IN ('CCTV', 'Networking', 'WiFi', 'NAS', 'General Maintenance')) NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')) DEFAULT 'Pending',
    job_description TEXT NOT NULL,
    technician_notes TEXT,
    equipment_used TEXT,
    before_photo TEXT,
    after_photo TEXT,
    arrival_time TEXT,
    completion_time TEXT,
    arrival_lat REAL,
    arrival_lng REAL,
    completion_lat REAL,
    completion_lng REAL,
    maps_url TEXT,
    signature TEXT,
    checklist_data TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_stock (
    item_code TEXT PRIMARY KEY,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    stock_qty INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0.00,
    unit_price_mmk REAL DEFAULT 0.00,
    batch_code TEXT,
    buying_price REAL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS stock_code_map (
    new_stock_code TEXT NOT NULL,
    old_stock_code TEXT PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    batch_code TEXT PRIMARY KEY,
    item_code TEXT REFERENCES inventory_stock(item_code),
    buying_price REAL DEFAULT 0.00,
    supplier TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    serial_number TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    client_id TEXT REFERENCES clients(id),
    installed_date TEXT DEFAULT CURRENT_TIMESTAMP,
    warranty_months INTEGER DEFAULT 12,
    status TEXT CHECK(status IN ('Active', 'Defective', 'RMA Sent', 'RMA Completed', 'Replaced')) DEFAULT 'Active',
    distributor TEXT,
    rma_tracking_id TEXT,
    job_id TEXT REFERENCES service_records(id),
    batch_code TEXT REFERENCES inventory_batches(batch_code)
);

CREATE TABLE IF NOT EXISTS cash_safes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usd_balance REAL DEFAULT 0.00,
    mmk_balance REAL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS cash_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT REFERENCES service_records(id),
    transaction_type TEXT CHECK(transaction_type IN ('Deposit', 'Withdrawal')) NOT NULL,
    primary_currency TEXT CHECK(primary_currency IN ('USD', 'MMK')) NOT NULL,
    amount REAL NOT NULL,
    exchange_rate REAL NOT NULL,
    equivalent_amount REAL NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    receive_mmk INTEGER DEFAULT 0,
    linked_batch TEXT
);

CREATE TABLE IF NOT EXISTS service_fees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_type TEXT NOT NULL,
    fee_amount REAL NOT NULL,
    currency TEXT CHECK(currency IN ('USD', 'MMK')) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT
);

PRAGMA foreign_keys = ON;
