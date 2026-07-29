package com.kosai.tech.data.remote

import com.kosai.tech.data.model.*
import retrofit2.Response
import retrofit2.http.*

interface ApiService {

    // ── Auth ──────────────────────────────────────────────────────────────

    @POST("api/auth/login-password")
    suspend fun login(@Body body: Map<String, String>): Response<ApiResponse<Map<String, Any>>>

    @GET("api/auth/verify")
    suspend fun verifyToken(@Header("Authorization") token: String): Response<ApiResponse<Map<String, Any>>>

    // ── Jobs ──────────────────────────────────────────────────────────────

    @GET("api/jobs")
    suspend fun getJobs(@Header("Authorization") token: String): Response<ApiResponse<List<ServiceRecord>>>

    @GET("api/jobs/{id}")
    suspend fun getJobById(
        @Header("Authorization") token: String,
        @Path("id") id: String
    ): Response<ApiResponse<ServiceRecord>>

    @PUT("api/jobs/{id}")
    suspend fun updateJob(
        @Header("Authorization") token: String,
        @Path("id") id: String,
        @Body body: Map<String, Any>
    ): Response<ApiResponse<ServiceRecord>>

    // ── Clients ───────────────────────────────────────────────────────────

    @GET("api/clients")
    suspend fun getClients(@Header("Authorization") token: String): Response<ApiResponse<List<Client>>>

    // ── Inventory ─────────────────────────────────────────────────────────

    @GET("api/inventory/stock")
    suspend fun getInventory(@Header("Authorization") token: String): Response<ApiResponse<List<InventoryItem>>>

    // ── Attendance ────────────────────────────────────────────────────────

    @POST("api/attendance/clock-in")
    suspend fun clockIn(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>
    ): Response<ApiResponse<Map<String, Any>>>

    @POST("api/attendance/clock-out")
    suspend fun clockOut(
        @Header("Authorization") token: String,
        @Body body: Map<String, Any>
    ): Response<ApiResponse<Map<String, Any>>>

    // ── Sync ──────────────────────────────────────────────────────────────

    @POST("api/sync/push")
    suspend fun syncPush(
        @Header("Authorization") token: String,
        @Body body: SyncPushRequest
    ): Response<ApiResponse<SyncPushResponse>>

    @GET("api/sync/pull")
    suspend fun syncPull(
        @Header("Authorization") token: String,
        @Query("client_id") clientId: String,
        @Query("since") since: String? = null,
        @Query("tables") tables: String? = null,
        @Query("limit") limit: Int = 500
    ): Response<ApiResponse<SyncPullResponse>>

    @GET("api/sync/status")
    suspend fun syncStatus(
        @Header("Authorization") token: String,
        @Query("client_id") clientId: String
    ): Response<ApiResponse<SyncStatusResponse>>

    // ── Reports ───────────────────────────────────────────────────────────

    @GET("api/reports/dashboard")
    suspend fun getDashboard(@Header("Authorization") token: String): Response<ApiResponse<Map<String, Any>>>
}
