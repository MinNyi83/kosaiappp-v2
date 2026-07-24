-- Performance indexes for frequently queried columns
-- Run: npx wrangler d1 execute cctv-fsm-db --file=db/migrations/add_performance_indexes.sql

CREATE INDEX IF NOT EXISTS idx_service_records_status ON service_records(status);
CREATE INDEX IF NOT EXISTS idx_service_records_technician_id ON service_records(technician_id);
CREATE INDEX IF NOT EXISTS idx_service_records_client_id ON service_records(client_id);
CREATE INDEX IF NOT EXISTS idx_service_records_created_at ON service_records(created_at);
CREATE INDEX IF NOT EXISTS idx_service_records_status_technician ON service_records(status, technician_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_category ON inventory_stock(category);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_item_name ON inventory_stock(item_name);
CREATE INDEX IF NOT EXISTS idx_inventory_items_client_id ON inventory_items(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_job_id ON inventory_items(job_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_job_id ON cash_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_created_at ON cash_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_submitted_by ON expenses(submitted_by);
CREATE INDEX IF NOT EXISTS idx_client_credits_client_id ON client_credits(client_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_item_id ON serial_numbers(item_id);
CREATE INDEX IF NOT EXISTS idx_serial_numbers_status ON serial_numbers(status);
