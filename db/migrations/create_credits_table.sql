CREATE TABLE IF NOT EXISTS client_credits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT REFERENCES clients(id),
    invoice_id TEXT,
    total_amount REAL,
    paid_amount REAL,
    credit_amount REAL,
    currency TEXT,
    status TEXT CHECK(status IN ('Unpaid', 'Partially Paid', 'Paid')) DEFAULT 'Unpaid',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
