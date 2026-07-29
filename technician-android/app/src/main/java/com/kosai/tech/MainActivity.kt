package com.kosai.tech

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.kosai.tech.data.SyncManager
import com.kosai.tech.data.local.AppDatabase
import com.kosai.tech.ui.KosaiApp
import com.kosai.tech.ui.theme.KosaiTheme
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var syncManager: SyncManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        syncManager = SyncManager.getInstance(applicationContext)
        syncManager.startAutoSync()

        val db = AppDatabase.getDatabase(applicationContext)

        setContent {
            KosaiTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    KosaiApp(
                        db = db,
                        syncManager = syncManager
                    )
                }
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        syncManager.stopAutoSync()
    }
}
