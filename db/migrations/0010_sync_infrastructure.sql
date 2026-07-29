-- 0010: Sync infrastructure for offline-first desktop and mobile apps
-- Tracks all changes across key tables for delta sync

CREATE TABLE IF NOT EXISTS sync_meta (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT CHECK(operation IN ('INSERT', 'UPDATE', 'DELETE')) NOT NULL,
    payload TEXT NOT NULL,
    client_id TEXT NOT NULL,
    client_timestamp TEXT NOT NULL,
    server_timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    synced INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sync_meta_table_name ON sync_meta(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_meta_record_id ON sync_meta(record_id);
CREATE INDEX IF NOT EXISTS idx_sync_meta_client_id ON sync_meta(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_meta_synced ON sync_meta(synced);
CREATE INDEX IF NOT EXISTS idx_sync_meta_server_timestamp ON sync_meta(server_timestamp);

-- Tracked tables: service_records, clients, technicians, inventory_stock,
-- inventory_items, attendance, expenses, invoices, cash_transactions

CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('push', 'pull')) NOT NULL,
    records_synced INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    status TEXT CHECK(status IN ('success', 'partial', 'failed')) DEFAULT 'success'
);

CREATE INDEX IF NOT EXISTS idx_sync_log_client_id ON sync_log(client_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_timestamp ON sync_log(timestamp);
