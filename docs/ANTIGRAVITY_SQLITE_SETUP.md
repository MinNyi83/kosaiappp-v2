# Stock Code SQLite Database — Antigravity Setup

## Database file

Open `stock_codes.sqlite` in your Antigravity project. It includes:

| Database object | Purpose |
| --- | --- |
| `stock` | Current stock-code catalog from **Stock New** |
| `stock_legacy` | Original catalog from **Stock** |
| `stock_code_map` | Old-to-new stock-code mapping |
| `categories`, `subcategories`, `brands` | Lookup lists |
| `stock_catalog` | Query-ready catalog view with category and brand descriptions |
| `import_metadata` | Source and import details |

All code fields are stored as text, preserving leading zeros such as `01`, `001`, and `000123`.

## Antigravity IDE

1. Create or open your project folder in Antigravity.
2. Copy `stock_codes.sqlite` into the project, for example `data/stock_codes.sqlite`.
3. Install a SQLite viewer extension if Antigravity does not already display database files.
4. Open the database and inspect the `stock_catalog` view for the most useful stock search results.

## Example queries

```sql
-- Search by stock code or description
SELECT stock_id, stock_description, category_description, brand_description
FROM stock_catalog
WHERE stock_id LIKE '%CAM20101001%'
   OR stock_description LIKE '%camera%'
ORDER BY stock_id;

-- Convert an old stock code to its new code
SELECT new_stock_code
FROM stock_code_map
WHERE old_stock_code = 'CAM100009';

-- Show all products for a category
SELECT stock_id, stock_description, brand_description
FROM stock_catalog
WHERE category_id = '01'
ORDER BY stock_id;
```

## Python connection

```python
import sqlite3

connection = sqlite3.connect("data/stock_codes.sqlite")
rows = connection.execute(
    "SELECT stock_id, stock_description FROM stock_catalog WHERE stock_id = ?",
    ("CAM20101001",),
).fetchall()
print(rows)
connection.close()
```

## Updating later

Run the supplied importer again with a newer workbook, then replace the database file in your project. Keep the column headers unchanged so your queries remain compatible.
