import sqlite3
import json

DB = "C:/Users/WinMyintHan/.local/share/mimocode/mimocode.db"
db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row
c = db.cursor()

# Get assistant messages from key sessions to understand repeated workflows
key_sessions = [
    'ses_091afc610ffepKHgnwXxrFB76U',  # Initialization
    'ses_090416913ffen4653sw69U56kf',  # Bot commands
    'ses_087106036ffeme5E6bTqxQ28YW',  # Big session
    'ses_084ed6352ffeVD5LVRtFEcXMJE',  # Deploy and test
    'ses_08ef7be15ffeG3ZzcPNOQNY0PN',  # Auto backup
    'ses_084badc51ffe43zDWgQ5VXnsX4',  # OAuth D1 error
    'ses_0849a1b4fffeb2iXRkcZjTCBUL',  # Sales Pricing
]

for sid in key_sessions:
    c.execute("""
        SELECT substr(json_extract(m.data, '$.content'), 1, 300) as content,
               json_extract(m.data, '$.role') as role
        FROM message m
        WHERE m.session_id = ?
          AND json_extract(m.data, '$.role') = 'user'
        ORDER BY m.time_created
        LIMIT 5
    """, (sid,))
    rows = c.fetchall()
    if rows:
        print(f"\n=== {sid} ===")
        for r in rows:
            content = r['content'] or '(none)'
            print(f"  USER: {content[:200]}")

# Also check: how many times each pattern of bash command was run
print("\n\n=== BASH COMMAND PATTERNS (grouped) ===")
c.execute("""
    SELECT 
        CASE
            WHEN json_extract(p.data, '$.state.input') LIKE '%wrangler deploy%' THEN 'wrangler deploy'
            WHEN json_extract(p.data, '$.state.input') LIKE '%wrangler d1 execute%' AND json_extract(p.data, '$.state.input') LIKE '%--remote%' THEN 'wrangler d1 (remote)'
            WHEN json_extract(p.data, '$.state.input') LIKE '%wrangler d1 execute%' THEN 'wrangler d1 (local)'
            WHEN json_extract(p.data, '$.state.input') LIKE '%tsc --noEmit%' THEN 'tsc --noEmit'
            WHEN json_extract(p.data, '$.state.input') LIKE '%npm run deploy%' THEN 'npm run deploy'
            WHEN json_extract(p.data, '$.state.input') LIKE '%wrangler dev%' THEN 'wrangler dev'
            WHEN json_extract(p.data, '$.state.input') LIKE '%Invoke-WebRequest%webhook%' THEN 'telegram webhook test'
            WHEN json_extract(p.data, '$.state.input') LIKE '%Invoke-WebRequest%login-password%' THEN 'login-password test'
            WHEN json_extract(p.data, '$.state.input') LIKE '%Invoke-WebRequest%admin%' THEN 'admin API test'
            WHEN json_extract(p.data, '$.state.input') LIKE '%node -c%' THEN 'node syntax check'
            WHEN json_extract(p.data, '$.state.input') LIKE '%Stop-Process%node%' THEN 'restart wrangler dev'
            WHEN json_extract(p.data, '$.state.input') LIKE '%python%sqlite3%' THEN 'python D1 query'
            WHEN json_extract(p.data, '$.state.input') LIKE '%Get-ChildItem%' THEN 'batch file edit (PS)'
            ELSE 'other'
        END as pattern,
        count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'bash'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY pattern
    ORDER BY n DESC
""")
for r in c.fetchall():
    print(f"  {r['n']:3d}x  {r['pattern']}")

# Check write calls (file creation)
print("\n\n=== MOST-WRITTEN FILES ===")
c.execute("""
    SELECT json_extract(p.data, '$.state.input') as inp,
           count(*) as n
    FROM message m
    JOIN part p ON p.message_id = m.id
    JOIN session s ON m.session_id = s.id
    WHERE json_extract(p.data, '$.type') = 'tool'
      AND json_extract(p.data, '$.tool') = 'write'
      AND s.directory LIKE '%kosai-project%'
    GROUP BY inp
    ORDER BY n DESC
    LIMIT 15
""")
for r in c.fetchall():
    try:
        inp_data = json.loads(r['inp'])
        fp = inp_data.get('file_path', '?')
        print(f"  {r['n']:3d}x  {fp}")
    except:
        print(f"  {r['n']:3d}x  (parse error)")

db.close()
