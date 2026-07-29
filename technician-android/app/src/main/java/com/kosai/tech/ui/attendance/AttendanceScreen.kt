package com.kosai.tech.ui.attendance

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.kosai.tech.data.SyncManager
import com.kosai.tech.data.local.AppDatabase
import com.kosai.tech.data.model.AttendanceLog
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun AttendanceScreen(
    db: AppDatabase,
    syncManager: SyncManager
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val attendance by db.attendanceDao().getAllAttendance().collectAsState(initial = emptyList())
    var isClockedIn by remember { mutableStateOf(false) }
    var currentLog by remember { mutableStateOf<AttendanceLog?>(null) }

    // Check if currently clocked in
    LaunchedEffect(Unit) {
        val techId = syncManager.getClientId()
        currentLog = db.attendanceDao().getActiveClockIn(techId)
        isClockedIn = currentLog != null
    }

    val locationClient = remember {
        LocationServices.getFusedLocationProviderClient(context)
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            // Permission granted, can get location
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "Attendance",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(bottom = 24.dp)
        )

        // Clock In/Out Card
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(
                containerColor = if (isClockedIn)
                    MaterialTheme.colorScheme.primaryContainer
                else
                    MaterialTheme.colorScheme.surface
            )
        ) {
            Column(
                modifier = Modifier
                    .padding(24.dp)
                    .fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Icon(
                    if (isClockedIn) Icons.Default AccessTime else Icons.Default.Schedule,
                    contentDescription = null,
                    modifier = Modifier.size(48.dp),
                    tint = MaterialTheme.colorScheme.primary
                )

                Spacer(modifier = Modifier.height(16.dp))

                Text(
                    text = if (isClockedIn) "Clocked In" else "Not Clocked In",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.Bold
                )

                if (isClockedIn && currentLog != null) {
                    Text(
                        text = "Since ${currentLog!!.clockIn}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Button(
                    onClick = {
                        scope.launch {
                            if (ContextCompat.checkSelfPermission(
                                    context, Manifest.permission.ACCESS_FINE_LOCATION
                                ) == PackageManager.PERMISSION_GRANTED
                            ) {
                                locationClient.lastLocation.addOnSuccessListener { location: Location? ->
                                    scope.launch {
                                        val timestamp = SimpleDateFormat(
                                            "yyyy-MM-dd'T'HH:mm:ss'Z'",
                                            Locale.US
                                        ).format(Date())

                                        if (isClockedIn) {
                                            // Clock Out
                                            currentLog?.let { log ->
                                                db.attendanceDao().clockOut(
                                                    id = log.id,
                                                    clockOut = timestamp,
                                                    lat = location?.latitude,
                                                    lng = location?.longitude,
                                                    hours = null
                                                )
                                                syncManager.queueAttendanceClockOut(
                                                    mapOf(
                                                        "id" to log.id.toString(),
                                                        "clock_out" to timestamp,
                                                        "clock_out_lat" to location?.latitude,
                                                        "clock_out_lng" to location?.longitude
                                                    )
                                                )
                                            }
                                            isClockedIn = false
                                            currentLog = null
                                        } else {
                                            // Clock In
                                            val newLog = AttendanceLog(
                                                technicianId = syncManager.getClientId(),
                                                clockIn = timestamp,
                                                clockInLat = location?.latitude,
                                                clockInLng = location?.longitude
                                            )
                                            db.attendanceDao().insertAttendance(newLog)
                                            syncManager.queueAttendanceClockIn(
                                                mapOf(
                                                    "technician_id" to syncManager.getClientId(),
                                                    "clock_in" to timestamp,
                                                    "clock_in_lat" to location?.latitude,
                                                    "clock_in_lng" to location?.longitude
                                                )
                                            )
                                            isClockedIn = true
                                            currentLog = newLog
                                        }
                                    }
                                }
                            } else {
                                permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isClockedIn)
                            MaterialTheme.colorScheme.error
                        else
                            MaterialTheme.colorScheme.primary
                    )
                ) {
                    Icon(
                        if (isClockedIn) Icons.Default.Stop else Icons.Default.PlayArrow,
                        contentDescription = null,
                        modifier = Modifier.padding(end = 8.dp)
                    )
                    Text(if (isClockedIn) "Clock Out" else "Clock In")
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // History
        Text(
            text = "Recent History",
            style = MaterialTheme.typography.titleMedium,
            modifier = Modifier.padding(bottom = 12.dp)
        )

        if (attendance.isEmpty()) {
            Text(
                text = "No attendance records",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        } else {
            LazyColumn {
                items(attendance.take(20)) { log ->
                    AttendanceRow(log)
                }
            }
        }
    }
}

@Composable
fun AttendanceRow(log: AttendanceLog) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
    ) {
        Row(
            modifier = Modifier
                .padding(16.dp)
                .fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(
                    text = log.clockIn,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium
                )
                if (log.clockOut != null) {
                    Text(
                        text = "to ${log.clockOut}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (log.totalHours != null) {
                Surface(
                    color = MaterialTheme.colorScheme.primaryContainer,
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = String.format("%.1f hrs", log.totalHours),
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
            } else if (log.clockOut == null) {
                Surface(
                    color = Color(0xFF10B981).copy(alpha = 0.15f),
                    shape = MaterialTheme.shapes.small
                ) {
                    Text(
                        text = "Active",
                        modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFF10B981)
                    )
                }
            }
        }
    }
}
