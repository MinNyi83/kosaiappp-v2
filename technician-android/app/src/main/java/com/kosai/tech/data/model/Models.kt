package com.kosai.tech.data.model

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.google.gson.annotations.SerializedName

// ── Service Record (Job) ──────────────────────────────────────────────────

@Entity(tableName = "service_records")
data class ServiceRecord(
    @PrimaryKey val id: String,
    @SerializedName("client_id") val clientId: String? = null,
    @SerializedName("technician_id") val technicianId: String? = null,
    @SerializedName("service_type") val serviceType: String = "General Maintenance",
    val status: String = "Pending",
    @SerializedName("job_description") val jobDescription: String = "",
    @SerializedName("technician_notes") val technicianNotes: String? = null,
    @SerializedName("equipment_used") val equipmentUsed: String? = null,
    @SerializedName("before_photo") val beforePhoto: String? = null,
    @SerializedName("after_photo") val afterPhoto: String? = null,
    @SerializedName("arrival_time") val arrivalTime: String? = null,
    @SerializedName("completion_time") val completionTime: String? = null,
    @SerializedName("arrival_lat") val arrivalLat: Double? = null,
    @SerializedName("arrival_lng") val arrivalLng: Double? = null,
    @SerializedName("completion_lat") val completionLat: Double? = null,
    @SerializedName("completion_lng") val completionLng: Double? = null,
    @SerializedName("maps_url") val mapsUrl: String? = null,
    val signature: String? = null,
    @SerializedName("checklist_data") val checklistData: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    @SerializedName("updated_at") val updatedAt: String? = null
)

// ── Client ────────────────────────────────────────────────────────────────

@Entity(tableName = "clients")
data class Client(
    @PrimaryKey val id: String,
    @SerializedName("company_name") val companyName: String,
    @SerializedName("contact_person") val contactPerson: String? = null,
    val address: String = "",
    val phone: String? = null,
    @SerializedName("amc_start") val amcStart: String? = null,
    @SerializedName("amc_end") val amcEnd: String? = null,
    @SerializedName("amc_status") val amcStatus: String? = null
)

// ── Technician ────────────────────────────────────────────────────────────

@Entity(tableName = "technicians")
data class Technician(
    @PrimaryKey val id: String,
    val name: String,
    val nickname: String? = null,
    val role: String = "Technician",
    val phone: String? = null,
    val active: Boolean = true,
    val email: String? = null,
    val username: String? = null,
    val photo: String? = null
)

// ── Inventory Stock ───────────────────────────────────────────────────────

@Entity(tableName = "inventory_stock")
data class InventoryItem(
    @PrimaryKey val itemCode: String,
    @SerializedName("item_name") val itemName: String,
    val category: String = "",
    @SerializedName("stock_qty") val stockQty: Int = 0,
    @SerializedName("unit_price") val unitPrice: Double = 0.0,
    @SerializedName("unit_price_mmk") val unitPriceMmk: Double = 0.0,
    @SerializedName("batch_code") val batchCode: String? = null,
    @SerializedName("buying_price") val buyingPrice: Double = 0.0
)

// ── Attendance Log ────────────────────────────────────────────────────────

@Entity(tableName = "attendance_log")
data class AttendanceLog(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val technicianId: String = "",
    @SerializedName("clock_in") val clockIn: String = "",
    @SerializedName("clock_out") val clockOut: String? = null,
    @SerializedName("clock_in_lat") val clockInLat: Double? = null,
    @SerializedName("clock_in_lng") val clockInLng: Double? = null,
    @SerializedName("clock_out_lat") val clockOutLat: Double? = null,
    @SerializedName("clock_out_lng") val clockOutLng: Double? = null,
    @SerializedName("total_hours") val totalHours: Double? = null,
    val synced: Boolean = false
)

// ── Pending Operation (Offline Queue) ─────────────────────────────────────

@Entity(tableName = "pending_operations")
data class PendingOperation(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @SerializedName("operation_type") val operationType: String,
    @SerializedName("table_name") val tableName: String,
    @SerializedName("record_id") val recordId: String,
    val payload: String = "{}",
    @SerializedName("created_at") val createdAt: String = "",
    val synced: Boolean = false
)

// ── Sync Meta ─────────────────────────────────────────────────────────────

@Entity(tableName = "sync_meta")
data class SyncMeta(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @SerializedName("table_name") val tableName: String,
    @SerializedName("record_id") val recordId: String,
    val operation: String,
    val payload: String,
    @SerializedName("client_id") val clientId: String,
    @SerializedName("client_timestamp") val clientTimestamp: String,
    @SerializedName("server_timestamp") val serverTimestamp: String? = null,
    val synced: Boolean = false,
    @SerializedName("created_at") val createdAt: String = ""
)

// ── API Response Models ───────────────────────────────────────────────────

data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null
)

data class SyncPushRequest(
    @SerializedName("client_id") val clientId: String,
    val records: List<SyncPushRecord>,
    @SerializedName("last_pull_timestamp") val lastPullTimestamp: String? = null
)

data class SyncPushRecord(
    @SerializedName("table_name") val tableName: String,
    @SerializedName("record_id") val recordId: String,
    val operation: String,
    val payload: Map<String, Any>,
    @SerializedName("client_timestamp") val clientTimestamp: String
)

data class SyncPushResponse(
    val accepted: Int,
    val rejected: Int,
    val conflicts: List<Any>,
    @SerializedName("server_timestamp") val serverTimestamp: String
)

data class SyncPullResponse(
    val records: List<SyncPullRecord>,
    @SerializedName("server_timestamp") val serverTimestamp: String,
    @SerializedName("has_more") val hasMore: Boolean
)

data class SyncPullRecord(
    @SerializedName("table_name") val tableName: String,
    @SerializedName("record_id") val recordId: String,
    val operation: String,
    val payload: Map<String, Any>,
    @SerializedName("server_timestamp") val serverTimestamp: String
)

data class SyncStatusResponse(
    @SerializedName("pending_operations") val pendingOperations: Int,
    @SerializedName("unsynced_records") val unsyncedRecords: Int,
    @SerializedName("jobs_count") val jobsCount: Int,
    @SerializedName("clients_count") val clientsCount: Int,
    @SerializedName("inventory_count") val inventoryCount: Int
)
