import sqlite3
conn = sqlite3.connect(r'C:\Users\WinMyintHan\.local\share\mimocode\mimocode.db')
cur = conn.cursor()

# List recent sessions
cur.execute("SELECT s.id, s.title, s.time_created, s.directory FROM session s ORDER BY s.time_created DESC LIMIT 15")
sessions = cur.fetchall()
print("=== Recent sessions ===")
for r in sessions:
    print(f"  {r[0]} | {r[1]} | {r[2]} | {r[3]}")

print()

# Count messages per session
cur.execute("""
    SELECT s.id, s.title, COUNT(m.id) as msg_count
    FROM session s
    LEFT JOIN message m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.time_created DESC
    LIMIT 15
""")
for r in cur.fetchall():
    print(f"  {r[0]} | {r[1]} | {r[2]} msgs")

conn.close()
