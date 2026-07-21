import sqlite3
import json
from collections import Counter

DB = "C:/Users/WinMyintHan/.local/share/mimocode/mimocode.db"
db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row
c = db.cursor()

# 1. User message patterns - handle None content
print("=== USER MESSAGE PATTERNS (repeated) ===")
c.execute("""
    SELECT json_extract(m.data, '$.content') as msg,
           count(*) as n
    FROM message m
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(m.data, '$.role') = 'user'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY msg
    HAVING n > 1
    ORDER BY n DESC
    LIMIT 30
""")
for r in c.fetchall():
    msg = r['msg'] or '(none)'
    print(f"  {r['n']:3d}x  {msg[:150]}")

# 2. Sessions with real work (non-checkpoint) in last 30 days
print("\n\n=== WORK SESSIONS (non-checkpoint) ===")
c.execute("""
    SELECT id, title, time_created
    FROM session 
    WHERE directory LIKE '%kosai-project%'
      AND title NOT LIKE '%checkpoint-writer%'
      AND time_created > 1783999000000
    ORDER BY time_created DESC
    LIMIT 25
""")
for r in c.fetchall():
    print(f"  {r['id']} | {r['title']} | ts={r['time_created']}")

# 3. Repeated wrangler/d1 commands
print("\n\n=== WRANGLER/D1 COMMANDS ===")
c.execute("""
    SELECT substr(json_extract(p.data, '$.state.input'), 1, 300) as cmd,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'bash'
      AND json_extract(p.data, '$.state.input') LIKE '%wrangler%'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY cmd
    ORDER BY n DESC
    LIMIT 15
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['cmd'][:180]}")

# 4. Repeated PowerShell Invoke-WebRequest calls
print("\n\n=== POWERSHELL INVOKE-WEBREQUEST ===")
c.execute("""
    SELECT substr(json_extract(p.data, '$.state.input'), 1, 400) as cmd,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'bash'
      AND json_extract(p.data, '$.state.input') LIKE '%Invoke-WebRequest%'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY cmd
    ORDER BY n DESC
    LIMIT 15
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['cmd'][:200]}")

# 5. Most-edited files
print("\n\n=== MOST-EDITED FILES ===")
c.execute("""
    SELECT json_extract(p.data, '$.state.input') as inp,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'edit'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY inp
    ORDER BY n DESC
    LIMIT 20
""")
for r in c.fetchall():
    try:
        inp_data = json.loads(r['inp'])
        fp = inp_data.get('file_path', '?')
        print(f"  {r['n']:3d}x  {fp}")
    except:
        print(f"  {r['n']:3d}x  (parse error)")

# 6. Search for repeated keywords in user messages
print("\n\n=== USER KEYWORD SEARCH ===")
for keyword in ['deploy', 'test', 'fix', 'add', 'create', 'backup', 'migrate', 'schema', 'telegram', 'inventory']:
    c.execute("""
        SELECT count(*) as n
        FROM message m
        JOIN session s ON m.session_id = s.id
        WHERE json_extract(m.data, '$.role') = 'user'
          AND s.directory LIKE '%kosai-project%'
          AND lower(json_extract(m.data, '$.content')) LIKE ?
    """, (f'%{keyword}%',))
    r = c.fetchone()
    if r['n'] > 0:
        print(f"  '{keyword}': {r['n']} mentions")

db.close()
