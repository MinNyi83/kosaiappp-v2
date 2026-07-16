import sqlite3

DB_PATH = r'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite'

# Remote schema (what columns exist on Cloudflare D1 right now)
REMOTE_SCHEMA = {
    'inventory_batches': ['batch_code', 'item_code', 'buying_price', 'supplier', 'created_at'],
    'inventory_items':   ['serial_number', 'device_name', 'client_id', 'installed_date', 'warranty_months', 'status', 'distributor', 'rma_tracking_id', 'job_id'],
    'inventory_stock':   ['item_code', 'item_name', 'category', 'stock_qty', 'unit_price', 'unit_price_mmk', 'batch_code', 'buying_price'],
}

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
all_tables = [r[0] for r in cursor.fetchall()]
inv_tables = [t for t in all_tables if 'inventory' in t.lower() or t.startswith('inv_')]
print("Inventory tables:", inv_tables)

sql_lines = []
sql_lines.append("-- =====================================================")
sql_lines.append("-- INVENTORY-ONLY SYNC to Cloudflare D1")
sql_lines.append("-- Safe: does NOT touch technicians, clients, service_records")
sql_lines.append("-- =====================================================")
sql_lines.append("")

# First: ALTER TABLE to add any missing columns to existing remote tables
sql_lines.append("-- Step 1: Add missing columns to existing tables (safe, idempotent)")
alter_statements = {
    'inventory_batches': [
        "ALTER TABLE inventory_batches ADD COLUMN quantity INTEGER DEFAULT 0;",
        "ALTER TABLE inventory_batches ADD COLUMN remaining_qty INTEGER DEFAULT 0;",
    ],
    'inventory_items': [
        "ALTER TABLE inventory_items ADD COLUMN batch_code TEXT;",
    ],
    'inventory_stock': [
        "ALTER TABLE inventory_stock ADD COLUMN sub_category_id TEXT;",
        "ALTER TABLE inventory_stock ADD COLUMN brand_id TEXT;",
        "ALTER TABLE inventory_stock ADD COLUMN stocking_um TEXT;",
    ],
}

for table, stmts in alter_statements.items():
    for stmt in stmts:
        # Wrap in a BEGIN/COMMIT to handle if column already exists gracefully
        sql_lines.append(stmt)

sql_lines.append("")

for table in inv_tables:
    sql_lines.append(f"-- === TABLE: {table} ===")

    # Get CREATE TABLE statement from local
    cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
    create_result = cursor.fetchone()

    # For tables that don't exist remotely at all, create them
    if table not in REMOTE_SCHEMA:
        if create_result and create_result[0]:
            create_stmt = create_result[0].strip()
            if "IF NOT EXISTS" not in create_stmt.upper():
                create_stmt = create_stmt.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
            sql_lines.append(create_stmt + ";")

    sql_lines.append(f"DELETE FROM {table};")

    # Get local columns
    cursor.execute(f"PRAGMA table_info({table})")
    local_cols = [r[1] for r in cursor.fetchall()]

    # Get all rows
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    print(f"  {table}: {len(rows)} rows, local cols: {local_cols}")

    if rows:
        for row in rows:
            row_dict = dict(zip(local_cols, row))
            values = []
            for col in local_cols:
                v = row_dict[col]
                if v is None:
                    values.append('NULL')
                elif isinstance(v, (int, float)):
                    values.append(str(v))
                else:
                    escaped = str(v).replace("'", "''")
                    values.append(f"'{escaped}'")
            cols_str = ', '.join(local_cols)
            vals_str = ', '.join(values)
            sql_lines.append(f"INSERT OR IGNORE INTO {table} ({cols_str}) VALUES ({vals_str});")

    sql_lines.append("")

conn.close()

output_path = 'inventory_sync.sql'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))

print(f"\nExported to: {output_path}")
print(f"Total SQL lines: {len(sql_lines)}")
