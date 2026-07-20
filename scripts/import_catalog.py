#!/usr/bin/env python3
"""Import device catalog from Excel to D1 database"""
import pandas as pd
import subprocess
import json

# Read Excel file
df = pd.read_excel(r'D:\kosai-project\v2\Excel\device_catalog_all_2026-07-14.xlsx', sheet_name='Data')
print(f"Loaded {len(df)} rows from Excel")

# Clean data
df = df.dropna(subset=['SKU', 'Model Name'])
df['Stock Qty'] = df['Stock Qty'].fillna(0).astype(int)
df['Category'] = df['Category'].fillna('')
df['Sub-Cat'] = df['Sub-Cat'].fillna('')
df['Brand'] = df['Brand'].fillna('')
df['U/M'] = df['U/M'].fillna('pcs')

print(f"Cleaned to {len(df)} rows")

# Get unique values
categories = df['Category'].dropna().unique().tolist()
sub_cat_df = df[['Sub-Cat', 'Category']].dropna(subset=['Sub-Cat']).drop_duplicates()
sub_categories = [tuple(row) for row in sub_cat_df.values.tolist()]
brands = df['Brand'].dropna().unique().tolist()
units = df['U/M'].dropna().unique().tolist()

print(f"Found {len(categories)} categories, {len(sub_categories)} sub-categories, {len(brands)} brands, {len(units)} units")

# Build SQL commands
sql_commands = []

# Insert categories
for i, cat in enumerate(categories, 1):
    cat = cat.strip().replace("'", "''")
    sql_commands.append(f"INSERT OR IGNORE INTO inv_categories (id, name, code) VALUES ({i}, '{cat}', '{str(i).zfill(2)}');")

# Insert sub-categories
for i, (subcat, cat) in enumerate(sub_categories, 1):
    subcat = subcat.strip().replace("'", "''")
    cat = cat.strip().replace("'", "''")
    sql_commands.append(f"INSERT OR IGNORE INTO inv_sub_categories (name, category_id, code) SELECT '{subcat}', id, '{str(i).zfill(3)}' FROM inv_categories WHERE name = '{cat}' LIMIT 1;")

# Insert brands
for i, brand in enumerate(brands, 1):
    brand = brand.strip().replace("'", "''")
    sql_commands.append(f"INSERT OR IGNORE INTO inv_brands (id, name, code) VALUES ({i}, '{brand}', '{str(i).zfill(2)}');")

# Insert stock units
for i, unit in enumerate(units, 1):
    unit = unit.strip().replace("'", "''")
    sql_commands.append(f"INSERT OR IGNORE INTO inv_stock_units (name, abbreviation) VALUES ('{unit}', '{unit}');")

# Insert inventory items
for _, row in df.iterrows():
    sku = str(row['SKU']).strip().replace("'", "''")
    name = str(row['Model Name']).strip().replace("'", "''")
    category = str(row['Category']).strip().replace("'", "''")
    sub_cat = str(row['Sub-Cat']).strip().replace("'", "''")
    brand = str(row['Brand']).strip().replace("'", "''")
    unit = str(row['U/M']).strip().replace("'", "''")
    qty = int(row['Stock Qty']) if pd.notna(row['Stock Qty']) else 0
    
    sql_commands.append(f"INSERT OR IGNORE INTO inventory_stock (item_code, item_name, category, stock_qty, unit_price) VALUES ('{sku}', '{name}', '{category}', {qty}, 0);")

# Write SQL file
sql_content = "\n".join(sql_commands)
with open(r'D:\kosai-project\v2\db\migrations\import_catalog.sql', 'w') as f:
    f.write(sql_content)

print(f"Generated {len(sql_commands)} SQL commands")
print("SQL file saved to db/migrations/import_catalog.sql")
