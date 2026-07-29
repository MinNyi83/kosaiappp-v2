mod db;
mod notifications;
mod sync;

use db::LocalDb;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use sync::{SyncConfig, SyncManager};
use tauri::State;

struct AppState {
    db: Arc<LocalDb>,
    sync_manager: SyncManager,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

// ── Database Commands ─────────────────────────────────────────────────────

#[tauri::command]
fn get_jobs(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM service_records ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "client_id": row.get::<_, Option<String>>(1)?,
                "technician_id": row.get::<_, Option<String>>(2)?,
                "service_type": row.get::<_, String>(3)?,
                "status": row.get::<_, String>(4)?,
                "job_description": row.get::<_, String>(5)?,
                "technician_notes": row.get::<_, Option<String>>(6)?,
                "equipment_used": row.get::<_, Option<String>>(7)?,
                "created_at": row.get::<_, Option<String>>(15)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).collect::<Vec<_>>().pipe(Ok)
}

#[tauri::command]
fn get_clients(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM clients ORDER BY company_name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "company_name": row.get::<_, String>(1)?,
                "contact_person": row.get::<_, Option<String>>(2)?,
                "address": row.get::<_, String>(3)?,
                "phone": row.get::<_, Option<String>>(4)?,
                "amc_status": row.get::<_, Option<String>>(7)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).collect::<Vec<_>>().pipe(Ok)
}

#[tauri::command]
fn get_inventory(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM inventory_stock ORDER BY item_name")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "item_code": row.get::<_, String>(0)?,
                "item_name": row.get::<_, String>(1)?,
                "category": row.get::<_, String>(2)?,
                "stock_qty": row.get::<_, i32>(3)?,
                "unit_price": row.get::<_, f64>(4)?,
            }))
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).collect::<Vec<_>>().pipe(Ok)
}

#[tauri::command]
fn get_technicians(state: State<AppState>) -> Result<Vec<serde_json::Value>, String> {
    let conn = state.db.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, role, phone, active FROM technicians WHERE active = 1")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "name": row.get::<_, String>(1)?,
                "role": row.get::<_, String>(2)?,
                "phone": row.get::<_, Option<String>>(3)?,
                "active": row.get::<_, i32>(4)? == 1,
            }))
        })
        .map_err(|e| e.to_string())?;
    rows.filter_map(|r| r.ok()).collect::<Vec<_>>().pipe(Ok)
}

// ── Sync Commands ─────────────────────────────────────────────────────────

#[tauri::command]
async fn sync_push(
    state: State<'_, AppState>,
    api_base: String,
    auth_token: String,
    client_id: String,
) -> Result<sync::SyncPushData, String> {
    let config = SyncConfig {
        api_base,
        auth_token,
        client_id,
    };
    state.sync_manager.push_changes(&config).await
}

#[tauri::command]
async fn sync_pull(
    state: State<'_, AppState>,
    api_base: String,
    auth_token: String,
    client_id: String,
    since: Option<String>,
) -> Result<sync::SyncPullData, String> {
    let config = SyncConfig {
        api_base,
        auth_token,
        client_id,
    };
    state.sync_manager.pull_changes(&config, since.as_deref()).await
}

#[tauri::command]
async fn sync_full(
    state: State<'_, AppState>,
    api_base: String,
    auth_token: String,
    client_id: String,
) -> Result<(sync::SyncPushData, sync::SyncPullData), String> {
    let config = SyncConfig {
        api_base,
        auth_token,
        client_id,
    };
    state.sync_manager.full_sync(&config).await
}

#[tauri::command]
fn get_sync_status(state: State<AppState>) -> Result<serde_json::Value, String> {
    let pending = state.db.get_pending_operations().map_err(|e| e.to_string())?;
    let unsynced = state.db.get_unsynced_metas().map_err(|e| e.to_string())?;
    Ok(serde_json::json!({
        "pending_operations": pending.len(),
        "unsynced_records": unsynced.len(),
        "jobs_count": state.db.get_record_count("service_records").unwrap_or(0),
        "clients_count": state.db.get_record_count("clients").unwrap_or(0),
        "inventory_count": state.db.get_record_count("inventory_stock").unwrap_or(0),
    }))
}

// ── Notification Commands ─────────────────────────────────────────────────

#[tauri::command]
fn notify_job_assigned(
    app: tauri::AppHandle,
    job_id: String,
    client: String,
) -> Result<(), String> {
    notifications::notify_job_assigned(&app, &job_id, &client)
}

#[tauri::command]
fn notify_job_completed(app: tauri::AppHandle, job_id: String) -> Result<(), String> {
    notifications::notify_job_completed(&app, &job_id)
}

#[tauri::command]
fn notify_new_message(app: tauri::AppHandle, from: String, preview: String) -> Result<(), String> {
    notifications::notify_new_message(&app, &from, &preview)
}

// ── Entry Point ───────────────────────────────────────────────────────────

trait ResultExt<T> {
    fn pipe<U, F: FnOnce(T) -> U>(self, f: F) -> U;
}

impl<T> ResultExt<T> for Result<T, String> {
    fn pipe<U, F: FnOnce(T) -> U>(self, f: F) -> U {
        match self {
            Ok(v) => f(v),
            Err(e) => panic!("Unexpected error: {}", e),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = dirs_next::data_local_dir()
        .unwrap_or_default()
        .join("kosai-admin")
        .join("local.db");

    std::fs::create_dir_all(db_path.parent().unwrap()).ok();

    let local_db = Arc::new(LocalDb::new(db_path.to_str().unwrap()).expect("Failed to open local DB"));
    let sync_manager = SyncManager::new(local_db.clone());

    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            db: local_db,
            sync_manager,
        })
        .invoke_handler(tauri::generate_handler![
            get_jobs,
            get_clients,
            get_inventory,
            get_technicians,
            sync_push,
            sync_pull,
            sync_full,
            get_sync_status,
            notify_job_assigned,
            notify_job_completed,
            notify_new_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
