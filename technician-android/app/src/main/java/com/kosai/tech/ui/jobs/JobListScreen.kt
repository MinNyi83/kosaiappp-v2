package com.kosai.tech.ui.jobs

import androidx.compose.foundation.clickable
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.kosai.tech.data.SyncManager
import com.kosai.tech.data.local.AppDatabase
import com.kosai.tech.data.model.ServiceRecord
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobListScreen(
    db: AppDatabase,
    syncManager: SyncManager
) {
    val jobs by db.jobDao().getAllJobs().collectAsState(initial = emptyList())
    var selectedJob by remember { mutableStateOf<ServiceRecord?>(null) }
    var showDetail by remember { mutableStateOf(false) }

    Column(modifier = Modifier.padding(16.dp)) {
        Text(
            text = "Service Jobs",
            style = MaterialTheme.typography.headlineSmall,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        if (jobs.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(
                        Icons.Default.WorkOff,
                        contentDescription = null,
                        modifier = Modifier.size(48.dp),
                        tint = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "No jobs yet",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = "Pull to sync or wait for assignments",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        } else {
            LazyColumn {
                items(jobs) { job ->
                    JobCard(
                        job = job,
                        onClick = {
                            selectedJob = job
                            showDetail = true
                        }
                    )
                }
            }
        }
    }

    if (showDetail && selectedJob != null) {
        JobDetailSheet(
            job = selectedJob!!,
            db = db,
            syncManager = syncManager,
            onDismiss = { showDetail = false }
        )
    }
}

@Composable
fun JobCard(
    job: ServiceRecord,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 8.dp)
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = job.id,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold
                )
                StatusBadge(status = job.status)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = job.serviceType,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Text(
                text = job.jobDescription.take(100),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp)
            )
        }
    }
}

@Composable
fun StatusBadge(status: String) {
    val color = when (status) {
        "Pending" -> Color(0xFFF59E0B)
        "In Progress" -> Color(0xFF3B82F6)
        "Completed" -> Color(0xFF10B981)
        "Cancelled" -> Color(0xFFEF4444)
        else -> Color.Gray
    }

    Surface(
        color = color.copy(alpha = 0.15f),
        shape = MaterialTheme.shapes.small
    ) {
        Text(
            text = status,
            color = color,
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JobDetailSheet(
    job: ServiceRecord,
    db: AppDatabase,
    syncManager: SyncManager,
    onDismiss: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var updating by remember { mutableStateOf(false) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState()
    ) {
        Column(
            modifier = Modifier
                .padding(24.dp)
                .fillMaxWidth()
        ) {
            Text(
                text = job.id,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(modifier = Modifier.height(16.dp))

            DetailRow("Type", job.serviceType)
            DetailRow("Status", job.status)
            DetailRow("Description", job.jobDescription)
            job.technicianNotes?.let { DetailRow("Notes", it) }
            job.equipmentUsed?.let { DetailRow("Equipment", it) }

            Spacer(modifier = Modifier.height(24.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (job.status == "Pending") {
                    Button(
                        onClick = {
                            scope.launch {
                                updating = true
                                val timestamp = java.text.SimpleDateFormat(
                                    "yyyy-MM-dd'T'HH:mm:ss'Z'",
                                    java.util.Locale.US
                                ).format(java.util.Date())

                                db.jobDao().updateJobStatus(job.id, "In Progress", timestamp)
                                syncManager.queueJobUpdate(
                                    job.id,
                                    mapOf("status" to "In Progress", "updated_at" to timestamp)
                                )
                                updating = false
                                onDismiss()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        enabled = !updating
                    ) {
                        Text("Accept Job")
                    }
                }

                if (job.status == "In Progress") {
                    Button(
                        onClick = {
                            scope.launch {
                                updating = true
                                val timestamp = java.text.SimpleDateFormat(
                                    "yyyy-MM-dd'T'HH:mm:ss'Z'",
                                    java.util.Locale.US
                                ).format(java.util.Date())

                                db.jobDao().updateJobStatus(job.id, "Completed", timestamp)
                                syncManager.queueJobUpdate(
                                    job.id,
                                    mapOf("status" to "Completed", "completion_time" to timestamp)
                                )
                                updating = false
                                onDismiss()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MaterialTheme.colorScheme.primary
                        ),
                        enabled = !updating
                    ) {
                        Text("Complete")
                    }
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun DetailRow(label: String, value: String) {
    Column(modifier = Modifier.padding(bottom = 12.dp)) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}
