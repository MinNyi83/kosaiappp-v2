import sqlite3
import json
from collections import Counter

DB = "C:/Users/WinMyintHan/.local/share/mimocode/mimocode.db"
db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row
c = db.cursor()

# 1. Most common tool calls across all sessions in this project (last 30 days)
cutoff = 1783999000000  # ~Jul 10

print("=== TOP TOOL CALLS (all sessions) ===")
c.execute("""
    SELECT json_extract(p.data, '$.tool') as tool,
           substr(json_extract(p.data, '$.state.input'), 1, 150) as input_preview,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(m.data, '$.role') = 'assistant'
      AND json_extract(p.data, '$.type') = 'tool'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY tool, input_preview
    ORDER BY n DESC
    LIMIT 30
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['tool']}: {r['input_preview'][:100]}")

# 2. Most common user message patterns
print("\n\n=== USER MESSAGE PATTERNS ===")
c.execute("""
    SELECT substr(json_extract(m.data, '$.content'), 1, 200) as msg,
           count(*) as n
    FROM message m
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(m.data, '$.role') = 'user'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY msg
    HAVING n > 1
    ORDER BY n DESC
    LIMIT 20
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['msg'][:120]}")

# 3. Sessions with real work (not checkpoint-writers) in last 30 days
print("\n\n=== WORK SESSIONS (non-checkpoint) ===")
c.execute("""
    SELECT id, title, time_created
    FROM session 
    WHERE directory LIKE '%kosai-project%'
      AND title NOT LIKE '%checkpoint-writer%'
      AND time_created > ?
    ORDER BY time_created DESC
    LIMIT 25
""")
for r in c.fetchall():
    print(f"  {r['id']} | {r['title']} | ts={r['time_created']}")

# 4. Repeated wrangler/d1 commands
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
    print(f"  {r['n']:3d}x  {r['cmd'][:150]}")

# 5. Repeated npx/npm commands
print("\n\n=== NPM/NPX COMMANDS ===")
c.execute("""
    SELECT substr(json_extract(p.data, '$.state.input'), 1, 300) as cmd,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'bash'
      AND (json_extract(p.data, '$.state.input') LIKE '%npx%' OR json_extract(p.data, '$.state.input') LIKE '%npm run%')
      AND s.directory LIKE '%kosai-project%'
    GROUP BY cmd
    ORDER BY n DESC
    LIMIT 15
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['cmd'][:150]}")

# 6. Repeated PowerShell Invoke-WebRequest calls
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

# 7. Repeated edit patterns (what files get edited most)
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
    # Extract file_path from the JSON input
    try:
        inp_data = json.loads(r['inp'])
        fp = inp_data.get('file_path', '?')
        print(f"  {r['n']:3d}x  {fp}")
    except:
        print(f"  {r['n']:3d}x  (parse error)")

db.close()
