import sqlite3
import os

source_db = r"d:\kosai-project\v2\Data\stock_codes.sqlite"
dest_db = r"D:\kosai-project\v2\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite"

if not os.path.exists(source_db):
    print(f"Error: Source database {source_db} does not exist!")
    exit(1)

if not os.path.exists(dest_db):
    print(f"Error: Destination database {dest_db} does not exist!")
    exit(1)

conn_src = sqlite3.connect(source_db)
c_src = conn_src.cursor()

conn_dst = sqlite3.connect(dest_db)
c_dst = conn_dst.cursor()

# 1. Import stock items from stock_catalog
c_src.execute("""
    SELECT stock_id, stock_description, category_description, selling_price, purchase_price 
    FROM stock_catalog
""")
stock_items = c_src.fetchall()

print(f"Read {len(stock_items)} items from stock_catalog in SQLite.")

inserted_stock = 0
for stock_id, desc, category, sell_p, buy_p in stock_items:
    if not stock_id:
        continue
    
    # Map pricing defaults
    try:
        unit_price = float(sell_p) if sell_p is not None else 120.00
    except:
        unit_price = 120.00
        
    try:
        buying_price = float(buy_p) if buy_p is not None else 85.00
    except:
        buying_price = 85.00

    if unit_price <= 0:
        unit_price = 120.00
    if buying_price <= 0:
        buying_price = 85.00

    unit_price_mmk = unit_price * 4500.00 # exchange rate multiplier
    
    # We use INSERT OR IGNORE to not overwrite mockup seeds
    c_dst.execute("""
        INSERT OR IGNORE INTO inventory_stock (item_code, item_name, category, stock_qty, unit_price, unit_price_mmk, buying_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (stock_id, desc, category or "Spare Hardware Parts", 150, unit_price, unit_price_mmk, buying_price))
    inserted_stock += 1

# 2. Import old-to-new mapping table stock_code_map
c_src.execute("SELECT old_stock_code, new_stock_code FROM stock_code_map")
mappings = c_src.fetchall()
print(f"Read {len(mappings)} mappings from stock_code_map in SQLite.")

inserted_maps = 0
for old_code, new_code in mappings:
    if not old_code or not new_code:
        continue
    c_dst.execute("""
        INSERT OR IGNORE INTO stock_code_map (old_stock_code, new_stock_code)
        VALUES (?, ?)
    """, (old_code, new_code))
    inserted_maps += 1

conn_dst.commit()
conn_src.close()
conn_dst.close()

print(f"Import complete! Inserted {inserted_stock} stock items and {inserted_maps} mapping rules into D1.")
