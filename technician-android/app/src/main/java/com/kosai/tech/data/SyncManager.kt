package com.kosai.tech.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.google.gson.Gson
import com.kosai.tech.data.local.AppDatabase
import com.kosai.tech.data.model.*
import com.kosai.tech.data.remote.ApiClient
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

class SyncManager(private val context: Context) {
    private val db = AppDatabase.getDatabase(context)
    private val api = ApiClient.getApiService()
    private val gson = Gson()
    private var syncJob: Job? = null

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val PREFS_NAME = "kosai_sync"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_CLIENT_ID = "client_id"
        private const val KEY_LAST_PULL = "last_pull_timestamp"
        private const val AUTO_SYNC_INTERVAL = 5 * 60 * 1000L // 5 minutes

        @Volatile
        private var INSTANCE: SyncManager? = null

        fun getInstance(context: Context): SyncManager {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: SyncManager(context).also { INSTANCE = it }
            }
        }
    }

    private fun getAuthToken(): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_AUTH_TOKEN, "") ?: ""
    }

    fun setAuthToken(token: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_AUTH_TOKEN, token).apply()
    }

    fun getClientId(): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        var clientId = prefs.getString(KEY_CLIENT_ID, null)
        if (clientId == null) {
            clientId = "android-${UUID.randomUUID().toString().take(8)}"
            prefs.edit().putString(KEY_CLIENT_ID, clientId).apply()
        }
        return clientId
    }

    fun getLastPullTimestamp(): String? {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_PULL, null)
    }

    private fun setLastPullTimestamp(ts: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_PULL, ts).apply()
    }

    fun isOnline(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    // ── Push ──────────────────────────────────────────────────────────────

    suspend fun pushChanges(): SyncPushResponse? {
        if (!isOnline()) return null

        val token = getAuthToken()
        if (token.isBlank()) return null

        val unsyncedOps = db.syncDao().getUnsyncedOperations()
        if (unsyncedOps.isEmpty()) return null

        val records = unsyncedOps.map { op ->
            SyncPushRecord(
                tableName = op.tableName,
                recordId = op.recordId,
                operation = op.operationType,
                payload = gson.fromJson(op.payload, Map::class.java) as Map<String, Any>,
                clientTimestamp = op.createdAt
            )
        }

        val request = SyncPushRequest(
            clientId = getClientId(),
            records = records,
            lastPullTimestamp = getLastPullTimestamp()
        )

        return try {
            val response = api.syncPush("Bearer $token", request)
            if (response.isSuccessful && response.body()?.success == true) {
                val result = response.body()!!.data!!
                // Mark operations as synced
                unsyncedOps.forEach { op ->
                    db.syncDao().markOperationSynced(op.id)
                }
                result
            } else null
        } catch (e: Exception) {
            null
        }
    }

    // ── Pull ──────────────────────────────────────────────────────────────

    suspend fun pullChanges(): SyncPullResponse? {
        if (!isOnline()) return null

        val token = getAuthToken()
        if (token.isBlank()) return null

        return try {
            val response = api.syncPull(
                token = "Bearer $token",
                clientId = getClientId(),
                since = getLastPullTimestamp()
            )
            if (response.isSuccessful && response.body()?.success == true) {
                val result = response.body()!!.data!!
                applyPullRecords(result.records)
                setLastPullTimestamp(result.serverTimestamp)
                result
            } else null
        } catch (e: Exception) {
            null
        }
    }

    private suspend fun applyPullRecords(records: List<SyncPullRecord>) {
        for (record in records) {
            when (record.tableName) {
                "service_records" -> {
                    val job = gson.fromJson(gson.toJson(record.payload), ServiceRecord::class.java)
                    db.jobDao().insertJob(job)
                }
                "clients" -> {
                    val client = gson.fromJson(gson.toJson(record.payload), Client::class.java)
                    db.clientDao().insertClient(client)
                }
                "technicians" -> {
                    val tech = gson.fromJson(gson.toJson(record.payload), Technician::class.java)
                    db.technicianDao().insertTechnician(tech)
                }
                "inventory_stock" -> {
                    val item = gson.fromJson(gson.toJson(record.payload), InventoryItem::class.java)
                    db.inventoryDao().insertItem(item)
                }
            }
        }
    }

    // ── Full Sync ─────────────────────────────────────────────────────────

    suspend fun fullSync(): Pair<SyncPushResponse?, SyncPullResponse?> {
        val pushResult = pushChanges()
        val pullResult = pullChanges()
        return Pair(pushResult, pullResult)
    }

    // ── Queue Operations ──────────────────────────────────────────────────

    suspend fun queueJobUpdate(jobId: String, updates: Map<String, Any>) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        db.syncDao().insertPendingOperation(
            PendingOperation(
                operationType = "UPDATE",
                tableName = "service_records",
                recordId = jobId,
                payload = gson.toJson(updates),
                createdAt = timestamp
            )
        )
    }

    suspend fun queueAttendanceClockIn(data: Map<String, Any>) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        db.syncDao().insertPendingOperation(
            PendingOperation(
                operationType = "INSERT",
                tableName = "attendance_log",
                recordId = "att-${UUID.randomUUID().toString().take(8)}",
                payload = gson.toJson(data),
                createdAt = timestamp
            )
        )
    }

    suspend fun queueAttendanceClockOut(data: Map<String, Any>) {
        val timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
        db.syncDao().insertPendingOperation(
            PendingOperation(
                operationType = "UPDATE",
                tableName = "attendance_log",
                recordId = data["id"]?.toString() ?: "",
                payload = gson.toJson(data),
                createdAt = timestamp
            )
        )
    }

    // ── Auto Sync ─────────────────────────────────────────────────────────

    fun startAutoSync() {
        syncJob?.cancel()
        syncJob = scope.launch {
            while (isActive) {
                delay(AUTO_SYNC_INTERVAL)
                if (isOnline()) {
                    try {
                        fullSync()
                    } catch (e: Exception) {
                        // Silent retry on next interval
                    }
                }
            }
        }
    }

    fun stopAutoSync() {
        syncJob?.cancel()
        syncJob = null
    }

    // ── Status ────────────────────────────────────────────────────────────

    suspend fun getPendingCount(): Int {
        return db.syncDao().getPendingCount()
    }

    fun destroy() {
        stopAutoSync()
        scope.cancel()
    }
}
