package com.kosai.tech.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.kosai.tech.data.SyncManager
import com.kosai.tech.data.local.AppDatabase
import com.kosai.tech.ui.attendance.AttendanceScreen
import com.kosai.tech.ui.jobs.JobListScreen
import com.kosai.tech.ui.settings.SettingsScreen

sealed class Screen(val route: String, val title: String, val icon: ImageVector) {
    object Jobs : Screen("jobs", "Jobs", Icons.Default.Work)
    object Attendance : Screen("attendance", "Attendance", Icons.Default.AccessTime)
    object Settings : Screen("settings", "Settings", Icons.Default.Settings)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KosaiApp(
    db: AppDatabase,
    syncManager: SyncManager
) {
    var currentScreen by remember { mutableStateOf(Screen.Jobs.route) }
    var isLoggedIn by remember { mutableStateOf(false) }
    var authToken by remember { mutableStateOf(syncManager.getAuthToken()) }

    if (!isLoggedIn && authToken.isBlank()) {
        LoginScreen(
            onLoginSuccess = { token ->
                authToken = token
                syncManager.setAuthToken(token)
                isLoggedIn = true
            }
        )
    } else {
        isLoggedIn = true
        MainContent(
            db = db,
            syncManager = syncManager,
            currentScreen = currentScreen,
            onScreenChange = { currentScreen = it }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainContent(
    db: AppDatabase,
    syncManager: SyncManager,
    currentScreen: String,
    onScreenChange: (String) -> Unit
) {
    val screens = listOf(Screen.Jobs, Screen.Attendance, Screen.Settings)

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("KosAI Technician") },
                actions = {
                    IconButton(onClick = { /* Sync */ }) {
                        Icon(Icons.Default.Sync, contentDescription = "Sync")
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                screens.forEach { screen ->
                    NavigationBarItem(
                        icon = { Icon(screen.icon, contentDescription = screen.title) },
                        label = { Text(screen.title) },
                        selected = currentScreen == screen.route,
                        onClick = { onScreenChange(screen.route) }
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.padding(paddingValues)) {
            when (currentScreen) {
                Screen.Jobs.route -> JobListScreen(db = db, syncManager = syncManager)
                Screen.Attendance.route -> AttendanceScreen(db = db, syncManager = syncManager)
                Screen.Settings.route -> SettingsScreen(syncManager = syncManager)
            }
        }
    }
}

@Composable
fun LoginScreen(onLoginSuccess: (String) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "KosAI Technician",
            style = MaterialTheme.typography.headlineLarge,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            label = { Text("Username") },
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(12.dp))

        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth()
        )

        if (error.isNotBlank()) {
            Text(
                text = error,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 8.dp)
            )
        }

        Button(
            onClick = {
                loading = true
                // TODO: Call API
                loading = false
            },
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp),
            enabled = !loading && username.isNotBlank() && password.isNotBlank()
        ) {
            if (loading) {
                CircularProgressIndicator(modifier = Modifier.size(20.dp))
            } else {
                Text("Sign In")
            }
        }
    }
}
