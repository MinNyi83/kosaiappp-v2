use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationPayload {
    pub title: String,
    pub body: String,
    pub icon: Option<String>,
    pub sound: Option<bool>,
}

pub fn send_notification(app: &AppHandle, payload: &NotificationPayload) -> Result<(), String> {
    let mut builder = app.notification().builder();
    builder = builder
        .title(&payload.title)
        .body(&payload.body);

    if let Some(sound) = payload.sound {
        if sound {
            builder = builder.sound(None);
        }
    }

    builder.show().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn notify_job_assigned(app: &AppHandle, job_id: &str, client: &str) -> Result<(), String> {
    send_notification(
        app,
        &NotificationPayload {
            title: "New Job Assigned".to_string(),
            body: format!("Job {} for {} has been assigned to you", job_id, client),
            icon: None,
            sound: Some(true),
        },
    )
}

pub fn notify_job_completed(app: &AppHandle, job_id: &str) -> Result<(), String> {
    send_notification(
        app,
        &NotificationPayload {
            title: "Job Completed".to_string(),
            body: format!("Job {} marked as completed", job_id),
            icon: None,
            sound: Some(false),
        },
    )
}

pub fn notify_sync_complete(app: &AppHandle, pushed: u32, pulled: u32) -> Result<(), String> {
    send_notification(
        app,
        &NotificationPayload {
            title: "Sync Complete".to_string(),
            body: format!("Pushed {} records, pulled {} records", pushed, pulled),
            icon: None,
            sound: Some(false),
        },
    )
}

pub fn notify_new_message(app: &AppHandle, from: &str, preview: &str) -> Result<(), String> {
    send_notification(
        app,
        &NotificationPayload {
            title: format!("Message from {}", from),
            body: preview.to_string(),
            icon: None,
            sound: Some(true),
        },
    )
}
