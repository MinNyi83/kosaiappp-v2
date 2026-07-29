package com.kosai.tech.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.kosai.tech.data.model.*

@Database(
    entities = [
        ServiceRecord::class,
        Client::class,
        Technician::class,
        InventoryItem::class,
        AttendanceLog::class,
        PendingOperation::class,
        SyncMeta::class
    ],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun jobDao(): JobDao
    abstract fun clientDao(): ClientDao
    abstract fun technicianDao(): TechnicianDao
    abstract fun inventoryDao(): InventoryDao
    abstract fun attendanceDao(): AttendanceDao
    abstract fun syncDao(): SyncDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "kosai_technician.db"
                ).build()
                INSTANCE = instance
                instance
            }
        }
    }
}
