import sqlite3

DB_PATH = r'.wrangler/state/v3/d1/miniflare-D1DatabaseObject/1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite'

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Tables to sync (non-user, non-sensitive config tables)
SYNC_TABLES = ['roles', 'system_config', 'service_fees']

sql_lines = []
sql_lines.append("-- Config & Roles sync to Cloudflare D1")
sql_lines.append("PRAGMA foreign_keys = OFF;")
sql_lines.append("")

for table in SYNC_TABLES:
    # Check if table exists locally
    cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table}'")
    if not cursor.fetchone():
        print(f"  Skipping {table} - not found locally")
        continue

    # Get CREATE TABLE SQL
    cursor.execute(f"SELECT sql FROM sqlite_master WHERE type='table' AND name='{table}'")
    create_result = cursor.fetchone()

    sql_lines.append(f"-- === TABLE: {table} ===")
    if create_result and create_result[0]:
        create_stmt = create_result[0].strip()
        if "IF NOT EXISTS" not in create_stmt.upper():
            create_stmt = create_stmt.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ", 1)
        sql_lines.append(create_stmt + ";")

    sql_lines.append(f"DELETE FROM {table};")

    cursor.execute(f"PRAGMA table_info({table})")
    cols = [r[1] for r in cursor.fetchall()]

    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    print(f"  {table}: {len(rows)} rows, cols: {cols}")

    for row in rows:
        values = []
        for v in row:
            if v is None:
                values.append('NULL')
            elif isinstance(v, (int, float)):
                values.append(str(v))
            else:
                escaped = str(v).replace("'", "''")
                values.append(f"'{escaped}'")
        cols_str = ', '.join(cols)
        vals_str = ', '.join(values)
        sql_lines.append(f"INSERT OR IGNORE INTO {table} ({cols_str}) VALUES ({vals_str});")

    sql_lines.append("")

sql_lines.append("PRAGMA foreign_keys = ON;")
conn.close()

output = 'roles_config_sync.sql'
with open(output, 'w', encoding='utf-8') as f:
    f.write('\n'.join(sql_lines))
print(f"\nExported to: {output} ({len(sql_lines)} lines)")
