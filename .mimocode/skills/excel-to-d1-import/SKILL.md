---
name: excel-to-d1-import
description: Import Excel spreadsheet data into Cloudflare D1 production database via pandas parsing and SQL file execution. Use when user provides an Excel file to import.
---

# Excel → D1 Import Workflow

Standard workflow for importing Excel data into the production Cloudflare D1 database.

## When to Use

- User provides an Excel file (.xlsx) and wants the data in the database
- User says "import", "add data from Excel", "import stock/catalog/anything"
- Any CSV or Excel file that needs to go into D1 tables

## Import Steps

### 1. Inspect the Excel file

```python
import pandas as pd
df = pd.read_excel('path/to/file.xlsx')
print(f"Rows: {len(df)}, Columns: {list(df.columns)}")
print(df.head())
print(f"\nUnique values per column:")
for col in df.columns:
    print(f"  {col}: {df[col].nunique()} unique")
```

### 2. Map columns to D1 table schema

Check existing table structure first:

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "PRAGMA table_info(tablename)"
```

### 3. Generate SQL file (NOT inline commands)

**Critical**: Use `--file` parameter, NOT `--command`. Windows command line length limits cause hangs with large datasets.

```python
import pandas as pd

df = pd.read_excel('path/to/file.xlsx')
sql_lines = []
sql_lines.append("BEGIN TRANSACTION;")

for _, row in df.iterrows():
    # Escape single quotes
    vals = [str(v).replace("'", "''") if pd.notna(v) else "NULL" for v in row]
    sql_lines.append(
        f"INSERT OR IGNORE INTO tablename (col1, col2) VALUES ('{vals[0]}', '{vals[1]}');"
    )

sql_lines.append("COMMIT;")

with open('db/migrations/import_data.sql', 'w') as f:
    f.write('\n'.join(sql_lines))

print(f"Generated {len(sql_lines) - 2} INSERT statements")
```

### 4. Execute SQL file against D1

```bash
npx wrangler d1 execute cctv-fsm-db --file="db/migrations/import_data.sql"
```

For production remote database, add `--remote`:

```bash
npx wrangler d1 execute cctv-fsm-db --remote --file="db/migrations/import_data.sql"
```

### 5. Verify import

```bash
npx wrangler d1 execute cctv-fsm-db --remote --command "SELECT COUNT(*) FROM tablename"
```

## Rules

- **Always use `--file` for large imports** (more than ~20 rows). Inline `--command` hits Windows command line length limits and causes computer hangs.
- **Always use `INSERT OR IGNORE`** for idempotent imports (safe to re-run).
- **Always wrap in BEGIN/COMMIT TRANSACTION** for performance (2352 inserts in 74ms vs minutes individually).
- **Check local vs production DB are separate**: `wrangler dev` uses local D1 (separate file), production uses `--remote`.
- **Clean up temp scripts** after import: remove `scripts/import_*.py` and `db/migrations/import_*.sql` when done.
- **If pandas f-strings fail in PowerShell**: Write Python to a `.py` file and run `python file.py` instead of inline `python -c "..."`.

## Known Gotchas

- `wrangler dev` local D1 has different data than production remote D1. Importing to local doesn't affect production.
- Excel files may have summary views with few rows. Always check all sheets and the actual data sheet.
- Sub-category → category linking relies on name matching. Verify FK relationships after import.
