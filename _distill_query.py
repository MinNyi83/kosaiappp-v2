import sqlite3
import json
import sys

DB = "C:/Users/WinMyintHan/.local/share/mimocode/mimocode.db"
db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row
c = db.cursor()

# Schema
c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
tables = [r[0] for r in c.fetchall()]
print("=== TABLES ===")
print(tables)

for t in tables:
    c.execute(f"PRAGMA table_info({t})")
    cols = [r[1] for r in c.fetchall()]
    print(f"\n{t}: {cols}")

# Recent sessions (last 30 days)
print("\n\n=== RECENT SESSIONS (last 30 days) ===")
c.execute("""
    SELECT id, title, directory, time_created 
    FROM session 
    WHERE time_created > strftime('%s','now') * 1000 - 30*24*60*60*1000
    ORDER BY time_created DESC
""")
for r in c.fetchall():
    print(f"  {r['id']} | {r['title']} | dir={r['directory'][:50] if r['directory'] else 'None'} | ts={r['time_created']}")

# Check message/part tables
print("\n\n=== MESSAGE SCHEMA ===")
c.execute("PRAGMA table_info(message)")
print([r[1] for r in c.fetchall()])

print("\n=== PART SCHEMA ===")
c.execute("PRAGMA table_info(part)")
print([r[1] for r in c.fetchall()])

db.close()
