package com.kosai.tech.data.local

import androidx.room.*
import com.kosai.tech.data.model.*
import kotlinx.coroutines.flow.Flow

@Dao
interface JobDao {
    @Query("SELECT * FROM service_records ORDER BY created_at DESC")
    fun getAllJobs(): Flow<List<ServiceRecord>>

    @Query("SELECT * FROM service_records WHERE id = :id")
    suspend fun getJobById(id: String): ServiceRecord?

    @Query("SELECT * FROM service_records WHERE technician_id = :techId AND status != 'Completed' ORDER BY created_at DESC")
    fun getActiveJobsForTech(techId: String): Flow<List<ServiceRecord>>

    @Query("SELECT * FROM service_records WHERE technician_id = :techId AND status = 'Completed' ORDER BY created_at DESC")
    fun getCompletedJobsForTech(techId: String): Flow<List<ServiceRecord>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJob(job: ServiceRecord)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertJobs(jobs: List<ServiceRecord>)

    @Update
    suspend fun updateJob(job: ServiceRecord)

    @Query("UPDATE service_records SET status = :status, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateJobStatus(id: String, status: String, updatedAt: String)

    @Query("DELETE FROM service_records WHERE id = :id")
    suspend fun deleteJob(id: String)
}

@Dao
interface ClientDao {
    @Query("SELECT * FROM clients ORDER BY company_name")
    fun getAllClients(): Flow<List<Client>>

    @Query("SELECT * FROM clients WHERE id = :id")
    suspend fun getClientById(id: String): Client?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClient(client: Client)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertClients(clients: List<Client>)
}

@Dao
interface TechnicianDao {
    @Query("SELECT * FROM technicians WHERE active = 1")
    fun getActiveTechnicians(): Flow<List<Technician>>

    @Query("SELECT * FROM technicians WHERE id = :id")
    suspend fun getTechnicianById(id: String): Technician?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTechnician(tech: Technician)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTechnicians(techs: List<Technician>)
}

@Dao
interface InventoryDao {
    @Query("SELECT * FROM inventory_stock ORDER BY item_name")
    fun getAllInventory(): Flow<List<InventoryItem>>

    @Query("SELECT * FROM inventory_stock WHERE item_code = :code")
    suspend fun getItemByCode(code: String): InventoryItem?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItem(item: InventoryItem)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<InventoryItem>)
}

@Dao
interface AttendanceDao {
    @Query("SELECT * FROM attendance_log ORDER BY clock_in DESC")
    fun getAllAttendance(): Flow<List<AttendanceLog>>

    @Query("SELECT * FROM attendance_log WHERE technicianId = :techId ORDER BY clock_in DESC LIMIT 10")
    fun getAttendanceForTech(techId: String): Flow<List<AttendanceLog>>

    @Query("SELECT * FROM attendance_log WHERE technicianId = :techId AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1")
    suspend fun getActiveClockIn(techId: String): AttendanceLog?

    @Insert
    suspend fun insertAttendance(log: AttendanceLog)

    @Update
    suspend fun updateAttendance(log: AttendanceLog)

    @Query("UPDATE attendance_log SET clock_out = :clockOut, clock_out_lat = :lat, clock_out_lng = :lng, total_hours = :hours WHERE id = :id")
    suspend fun clockOut(id: Long, clockOut: String, lat: Double?, lng: Double?, hours: Double?)
}

@Dao
interface SyncDao {
    @Query("SELECT * FROM pending_operations WHERE synced = 0 ORDER BY id ASC")
    suspend fun getUnsyncedOperations(): List<PendingOperation>

    @Insert
    suspend fun insertPendingOperation(op: PendingOperation)

    @Query("UPDATE pending_operations SET synced = 1 WHERE id = :id")
    suspend fun markOperationSynced(id: Long)

    @Query("SELECT COUNT(*) FROM pending_operations WHERE synced = 0")
    suspend fun getPendingCount(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSyncMeta(meta: SyncMeta)

    @Query("SELECT * FROM sync_meta WHERE synced = 0 ORDER BY id ASC")
    suspend fun getUnsyncedMeta(): List<SyncMeta>

    @Query("UPDATE sync_meta SET synced = 1, server_timestamp = :serverTimestamp WHERE id = :id")
    suspend fun markMetaSynced(id: Long, serverTimestamp: String)
}
