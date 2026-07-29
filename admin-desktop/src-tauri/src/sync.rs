use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::db::{LocalDb, SyncMeta, SyncPushRecord};

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncConfig {
    pub api_base: String,
    pub auth_token: String,
    pub client_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushRequest {
    pub client_id: String,
    pub records: Vec<SyncPushRecord>,
    pub last_pull_timestamp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushResponse {
    pub success: bool,
    pub data: SyncPushData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPushData {
    pub accepted: u32,
    pub rejected: u32,
    pub conflicts: Vec<serde_json::Value>,
    pub server_timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPullResponse {
    pub success: bool,
    pub data: SyncPullData,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPullData {
    pub records: Vec<SyncPullRecord>,
    pub server_timestamp: String,
    pub has_more: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SyncPullRecord {
    pub table_name: String,
    pub record_id: String,
    pub operation: String,
    pub payload: serde_json::Value,
    pub server_timestamp: String,
}

pub struct SyncManager {
    db: std::sync::Arc<LocalDb>,
    client: Client,
}

impl SyncManager {
    pub fn new(db: std::sync::Arc<LocalDb>) -> Self {
        Self {
            db,
            client: Client::new(),
        }
    }

    /// Push all unsynced local changes to the server
    pub async fn push_changes(&self, config: &SyncConfig) -> Result<SyncPushData, String> {
        let unsynced = self.db.get_unsynced_metas().map_err(|e| e.to_string())?;
        if unsynced.is_empty() {
            return Ok(SyncPushData {
                accepted: 0,
                rejected: 0,
                conflicts: vec![],
                server_timestamp: chrono::Utc::now().to_rfc3339(),
            });
        }

        let records: Vec<SyncPushRecord> = unsynced
            .iter()
            .map(|m| SyncPushRecord {
                table_name: m.table_name.clone(),
                record_id: m.record_id.clone(),
                operation: m.operation.clone(),
                payload: serde_json::from_str(&m.payload).unwrap_or(serde_json::Value::Null),
                client_timestamp: m.client_timestamp.clone(),
            })
            .collect();

        let request = SyncPushRequest {
            client_id: config.client_id.clone(),
            records,
            last_pull_timestamp: None,
        };

        let response = self
            .client
            .post(format!("{}/api/sync/push", config.api_base))
            .header("Authorization", format!("Bearer {}", config.auth_token))
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let sync_response: SyncPushResponse = response.json().await.map_err(|e| e.to_string())?;

        if sync_response.success {
            for meta in &unsynced {
                self.db
                    .mark_synced(meta.id.unwrap_or(0), &sync_response.data.server_timestamp)
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(sync_response.data)
    }

    /// Pull latest changes from server and apply to local DB
    pub async fn pull_changes(&self, config: &SyncConfig, since: Option<&str>) -> Result<SyncPullData, String> {
        let mut url = format!(
            "{}/api/sync/pull?client_id={}",
            config.api_base, config.client_id
        );
        if let Some(s) = since {
            url.push_str(&format!("&since={}", s));
        }

        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {}", config.auth_token))
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let sync_response: SyncPullResponse = response.json().await.map_err(|e| e.to_string())?;

        if sync_response.success {
            for record in &sync_response.data.records {
                match record.operation.as_str() {
                    "INSERT" | "UPDATE" => {
                        self.db
                            .upsert_record(&record.table_name, &record.record_id, &record.payload)
                            .map_err(|e| e.to_string())?;
                    }
                    "DELETE" => {
                        self.db
                            .delete_record(&record.table_name, &record.record_id)
                            .map_err(|e| e.to_string())?;
                    }
                    _ => {}
                }
            }
        }

        Ok(sync_response.data)
    }

    /// Full bidirectional sync: push then pull
    pub async fn full_sync(&self, config: &SyncConfig) -> Result<(SyncPushData, SyncPullData), String> {
        let push_result = self.push_changes(config).await?;
        let pull_result = self.pull_changes(config, Some(&push_result.server_timestamp)).await?;
        Ok((push_result, pull_result))
    }
}
