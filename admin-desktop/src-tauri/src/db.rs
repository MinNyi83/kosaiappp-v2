use rusqlite::{Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SyncMeta {
    pub id: Option<i64>,
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub payload: String,
    pub client_id: String,
    pub client_timestamp: String,
    pub server_timestamp: Option<String>,
    pub synced: bool,
    pub created_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushRecord {
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub payload: serde_json::Value,
    pub client_timestamp: String,
}

pub struct LocalDb {
    conn: Mutex<Connection>,
}

impl LocalDb {
    pub fn new(db_path: &str) -> SqlResult<Self> {
        let conn = Connection::open(db_path)?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn init_tables(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS sync_meta (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                payload TEXT NOT NULL,
                client_id TEXT NOT NULL,
                client_timestamp TEXT NOT NULL,
                server_timestamp TEXT,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_sync_meta_synced ON sync_meta(synced);
            CREATE INDEX IF NOT EXISTS idx_sync_meta_table ON sync_meta(table_name);

            CREATE TABLE IF NOT EXISTS service_records (
                id TEXT PRIMARY KEY,
                client_id TEXT,
                technician_id TEXT,
                service_type TEXT NOT NULL,
                status TEXT DEFAULT 'Pending',
                job_description TEXT NOT NULL,
                technician_notes TEXT,
                equipment_used TEXT,
                before_photo TEXT,
                after_photo TEXT,
                arrival_time TEXT,
                completion_time TEXT,
                arrival_lat REAL,
                arrival_lng REAL,
                completion_lat REAL,
                completion_lng REAL,
                maps_url TEXT,
                signature TEXT,
                checklist_data TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS clients (
                id TEXT PRIMARY KEY,
                company_name TEXT NOT NULL,
                contact_person TEXT,
                address TEXT NOT NULL,
                phone TEXT,
                amc_start TEXT,
                amc_end TEXT,
                amc_status TEXT DEFAULT 'Inactive'
            );

            CREATE TABLE IF NOT EXISTS technicians (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                nickname TEXT,
                role TEXT NOT NULL,
                phone TEXT,
                active INTEGER DEFAULT 1,
                email TEXT,
                username TEXT,
                password TEXT,
                pin TEXT DEFAULT '1234',
                photo TEXT
            );

            CREATE TABLE IF NOT EXISTS inventory_stock (
                item_code TEXT PRIMARY KEY,
                item_name TEXT NOT NULL,
                category TEXT NOT NULL,
                stock_qty INTEGER DEFAULT 0,
                unit_price REAL DEFAULT 0.00,
                unit_price_mmk REAL DEFAULT 0.00,
                batch_code TEXT,
                buying_price REAL DEFAULT 0.00
            );

            CREATE TABLE IF NOT EXISTS pending_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                synced INTEGER DEFAULT 0
            );
            ",
        )?;
        Ok(())
    }

    pub fn insert_sync_meta(&self, meta: &SyncMeta) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO sync_meta (table_name, record_id, operation, payload, client_id, client_timestamp, synced)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                meta.table_name,
                meta.record_id,
                meta.operation,
                meta.payload,
                meta.client_id,
                meta.client_timestamp,
                meta.synced as i32,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_unsynced_metas(&self) -> SqlResult<Vec<SyncMeta>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, table_name, record_id, operation, payload, client_id, client_timestamp, server_timestamp, synced, created_at
             FROM sync_meta WHERE synced = 0 ORDER BY id ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(SyncMeta {
                id: row.get(0)?,
                table_name: row.get(1)?,
                record_id: row.get(2)?,
                operation: row.get(3)?,
                payload: row.get(4)?,
                client_id: row.get(5)?,
                client_timestamp: row.get(6)?,
                server_timestamp: row.get(7)?,
                synced: row.get::<_, i32>(8)? == 1,
                created_at: row.get(9)?,
            })
        })?;
        rows.collect()
    }

    pub fn mark_synced(&self, id: i64, server_timestamp: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE sync_meta SET synced = 1, server_timestamp = ?1 WHERE id = ?2",
            rusqlite::params![server_timestamp, id],
        )?;
        Ok(())
    }

    pub fn upsert_record(&self, table: &str, id: &str, payload: &serde_json::Value) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        if let serde_json::Value::Object(map) = payload {
            let columns: Vec<String> = map.keys().cloned().collect();
            let values: Vec<&serde_json::Value> = columns.iter().map(|k| &map[k]).collect();
            let placeholders: Vec<String> = (0..columns.len()).map(|_| "?".to_string()).collect();

            let existing: bool = conn
                .prepare(&format!("SELECT 1 FROM {} WHERE id = ?1", table))?
                .exists(rusqlite::params![id])?;

            if existing {
                let set_clause: String = columns.iter().map(|c| format!("{} = ?", c)).collect::<Vec<_>>().join(", ");
                conn.execute(
                    &format!("UPDATE {} SET {} WHERE id = ?", table, set_clause),
                    rusqlite::params_from_iter(values.into_iter().chain(std::iter::once(&serde_json::Value::String(id.to_string())))),
                )?;
            } else {
                let all_cols = format!("id, {}", columns.join(", "));
                let all_ph = format!("?, {}", placeholders.join(", "));
                let mut params: Vec<&dyn rusqlite::ToSql> = Vec::new();
                params.push(&id);
                for v in &values {
                    params.push(v);
                }
                conn.execute(
                    &format!("INSERT INTO {} ({}) VALUES ({})", table, all_cols, all_ph),
                    params.as_slice(),
                )?;
            }
        }
        Ok(())
    }

    pub fn delete_record(&self, table: &str, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            &format!("DELETE FROM {} WHERE id = ?1", table),
            rusqlite::params![id],
        )?;
        Ok(())
    }

    pub fn get_pending_operations(&self) -> SqlResult<Vec<serde_json::Value>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, operation_type, table_name, record_id, payload, created_at FROM pending_operations WHERE synced = 0",
        )?;
        let rows = stmt.query_map([], |row| {
            let id: i64 = row.get(0)?;
            let op: String = row.get(1)?;
            let table: String = row.get(2)?;
            let record_id: String = row.get(3)?;
            let payload: String = row.get(4)?;
            let created: String = row.get(5)?;
            Ok(serde_json::json!({
                "id": id,
                "operation_type": op,
                "table_name": table,
                "record_id": record_id,
                "payload": serde_json::from_str::<serde_json::Value>(&payload).unwrap_or(serde_json::Value::Null),
                "created_at": created,
            }))
        })?;
        rows.collect()
    }

    pub fn add_pending_operation(
        &self,
        op_type: &str,
        table: &str,
        record_id: &str,
        payload: &serde_json::Value,
    ) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO pending_operations (operation_type, table_name, record_id, payload) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![op_type, table, record_id, serde_json::to_string(payload).unwrap_or_default()],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn mark_operation_synced(&self, id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE pending_operations SET synced = 1 WHERE id = ?1", rusqlite::params![id])?;
        Ok(())
    }

    pub fn get_record_count(&self, table: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let count: i64 = conn.query_row(
            &format!("SELECT COUNT(*) FROM {}", table),
            [],
            |row| row.get(0),
        )?;
        Ok(count)
    }
}
