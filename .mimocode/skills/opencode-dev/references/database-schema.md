# Database Schema Reference

## Core Tables

### technicians
User accounts for technicians and admins.
```sql
id              TEXT PRIMARY KEY     -- TECH-{timestamp}
name            TEXT NOT NULL
nickname        TEXT
email           TEXT UNIQUE
phone           TEXT
role            TEXT DEFAULT 'technician'  -- admin, technician
active          INTEGER DEFAULT 1
username        TEXT UNIQUE
pin             TEXT                 -- Salted SHA-256: $sha256$<salt>$<hash>
password        TEXT
photo           TEXT                 -- Google Drive URL
specialties     TEXT                 -- JSON array
permissions     TEXT                 -- read_write, etc.
google_id       TEXT                 -- Google OAuth ID
telegram_username TEXT
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
last_login      DATETIME
```

### clients
Customer records.
```sql
id              TEXT PRIMARY KEY     -- CLT-{timestamp}
company_name    TEXT NOT NULL
contact_person  TEXT
address         TEXT
phone           TEXT
amc_start       TEXT                 -- AMC start date
amc_end         TEXT                 -- AMC end date
amc_status      TEXT DEFAULT 'Inactive'  -- Active, Inactive
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### service_records
Job/ticket records.
```sql
id              TEXT PRIMARY KEY     -- JOB-{timestamp}
client_id       TEXT REFERENCES clients(id)
technician_id   TEXT REFERENCES technicians(id)
service_type    TEXT                 -- CCTV, Networking, WiFi, NAS, General
status          TEXT DEFAULT 'Pending'  -- Pending, In Progress, Completed, Cancelled
job_description TEXT
technician_notes TEXT
equipment_used  TEXT                 -- JSON array
before_photo    TEXT                 -- Google Drive URL
after_photo     TEXT                 -- Google Drive URL
checklist_data  TEXT                 -- JSON object
arrival_time    DATETIME
completion_time DATETIME
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### inventory_stock
Product catalog.
```sql
item_code       TEXT PRIMARY KEY
item_name       TEXT NOT NULL
category        TEXT
sub_category    TEXT
brand           TEXT
unit            TEXT
stock_qty       INTEGER DEFAULT 0
unit_price      REAL
cost_price      REAL
description     TEXT
```

### inventory_items
Installed devices/warranties.
```sql
id              TEXT PRIMARY KEY
serial_number   TEXT UNIQUE
device_name     TEXT
client_id       TEXT REFERENCES clients(id)
job_id          TEXT REFERENCES service_records(id)
installed_date  TEXT
warranty_months INTEGER
warranty_end    TEXT
status          TEXT DEFAULT 'Active'  -- Active, Expired, RMA
```

### inventory_batches
Purchase batches.
```sql
id              TEXT PRIMARY KEY
batch_number    TEXT
purchase_date   TEXT
supplier        TEXT
total_cost      REAL
status          TEXT DEFAULT 'Received'
```

## Financial Tables

### cash_safes
Cash balance.
```sql
id              TEXT PRIMARY KEY     -- SAFE-1
usd_balance     REAL DEFAULT 0
mmk_balance     REAL DEFAULT 0
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### cash_transactions
Transaction history.
```sql
id              TEXT PRIMARY KEY
transaction_type TEXT                -- Deposit, Withdrawal, Sale, Income
amount          REAL
currency        TEXT DEFAULT 'USD'   -- USD, MMK
category        TEXT
notes           TEXT
linked_batch    TEXT                 -- Job or batch reference
created_by      TEXT
created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### service_fees
Fee schedule.
```sql
id              TEXT PRIMARY KEY
service_type    TEXT
description     TEXT
amount          REAL
currency        TEXT DEFAULT 'USD'
```

## Config Tables

### system_config
Key-value settings.
```sql
config_key      TEXT PRIMARY KEY
config_value    TEXT
description     TEXT
updated_by      TEXT
updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
```

### roles
Role definitions with permissions.
```sql
id              TEXT PRIMARY KEY     -- ROLE-{timestamp}
name            TEXT UNIQUE NOT NULL
permissions     TEXT                 -- JSON array
description     TEXT
```

### landing_page
Public landing page config.
```sql
id              INTEGER PRIMARY KEY DEFAULT 1
map_lat         REAL
map_lng         REAL
contact_address TEXT
contact_phone   TEXT
contact_email   TEXT
```

## Common Queries

### Get jobs with client info
```sql
SELECT sr.*, c.company_name, t.name as tech_name
FROM service_records sr
LEFT JOIN clients c ON sr.client_id = c.id
LEFT JOIN technicians t ON sr.technician_id = t.id
WHERE sr.status = 'Pending'
ORDER BY sr.created_at DESC
```

### Get inventory with stock
```sql
SELECT i.*, s.stock_qty, s.unit_price
FROM inventory_items i
LEFT JOIN inventory_stock s ON i.device_name = s.item_name
WHERE i.client_id = ?
```

### Dashboard stats
```sql
SELECT
  (SELECT COUNT(*) FROM service_records) as total_jobs,
  (SELECT COUNT(*) FROM service_records WHERE status IN ('Pending', 'In Progress')) as active_jobs,
  (SELECT COUNT(*) FROM clients) as total_clients,
  (SELECT COUNT(*) FROM technicians WHERE active = 1) as active_techs
```
