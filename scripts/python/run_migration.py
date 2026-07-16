import sqlite3
import os

db_path = r"D:\kosai-project\v2\.wrangler\state\v3\d1\miniflare-D1DatabaseObject\1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite"

if not os.path.exists(db_path):
    print(f"Error: DB file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    print("Disabling foreign keys...")
    cursor.execute("PRAGMA foreign_keys = OFF;")
    
    print("Creating roles table...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS roles (
        name TEXT PRIMARY KEY,
        permissions TEXT NOT NULL
    );
    """)
    
    print("Seeding roles...")
    cursor.executemany(
        "INSERT OR REPLACE INTO roles (name, permissions) VALUES (?, ?);",
        [
            ('Admin', '{"clients":"write","technicians":"write","jobs":"write","service_fees":"write","cash_safe":"write","pos":"write","inventory":"write","pdf_builder":"write"}'),
            ('Sales', '{"clients":"write","technicians":"none","jobs":"read","service_fees":"read","cash_safe":"none","pos":"write","inventory":"read","pdf_builder":"none"}'),
            ('Technician', '{"clients":"read","technicians":"none","jobs":"write","service_fees":"none","cash_safe":"none","pos":"none","inventory":"read","pdf_builder":"none"}')
        ]
    )

    print("Recreating technicians table to drop CHECK constraint...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS technicians_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nickname TEXT,
        role TEXT NOT NULL REFERENCES roles(name),
        phone TEXT,
        active INTEGER DEFAULT 1,
        email TEXT,
        username TEXT,
        password TEXT,
        pin TEXT DEFAULT '1234',
        photo TEXT,
        permissions TEXT DEFAULT 'read_write'
    );
    """)

    print("Copying technicians data...")
    cursor.execute("""
    INSERT INTO technicians_new (id, name, nickname, role, phone, active, email, username, password, pin, photo, permissions)
    SELECT id, name, nickname, role, phone, active, email, username, password, pin, photo, permissions FROM technicians;
    """)

    print("Swapping technicians tables...")
    cursor.execute("DROP TABLE technicians;")
    cursor.execute("ALTER TABLE technicians_new RENAME TO technicians;")
    
    conn.commit()
    print("Enabling foreign keys and verifying integrity...")
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Verify
    cursor.execute("SELECT * FROM roles;")
    print("Roles in DB:", cursor.fetchall())
    cursor.execute("SELECT id, name, role FROM technicians LIMIT 5;")
    print("Technicians in DB:", cursor.fetchall())
    
    print("Migration completed successfully!")
except Exception as e:
    conn.rollback()
    print("Migration failed:", e)
finally:
    conn.close()
