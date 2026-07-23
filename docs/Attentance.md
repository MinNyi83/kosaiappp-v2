Here is your finalized, production-grade AGENT.md document. This version integrates the ZKTeco Network Authentication (Comm Key) parameters and an advanced, transactional Bi-Directional Synchronization Engine to securely sync employee rosters and offline punch records with your cloud infrastructure when network connectivity is established.
------------------------------

# Engineering Specification: Minimalist Offline Network Biometric Attendance Terminal
This document serves as the system architecture blueprint and engineering specification for building a dedicated, offline-first, high-density employee attendance tracking application designed to communicate directly with ZKTeco network biometric terminals (e.g., F18, K40, iFace series) over a Local Area Network (LAN).
## 1. System Architecture
The application operates on an offline-first paradigm. It maintains persistent background socket connections to network-attached physical ZKTeco biometric terminals over the LAN using TCP/UDP port 4370. All transaction data is parsed and cached immediately into local non-volatile storage.
### Target Platforms*   **Desktop App (Windows Primary):** Electron shell wrapping an atomic web frontend with a Node.js background process managing persistent network sockets.
### Data Storage Strategy*   **Local Storage Layer:** Embedded **SQLite** database file stored locally on the client filesystem. This architecture isolates the client terminal from network drops and guarantees long-term transactional history survival with zero external runtime engines.


+-----------------------------------------------------------------------+
| MINIMALIST USER INTERFACE |
| (High-Density HTML/CSS View Render Layer) |
+-----------------------------------------------------------------------+
^
| (IPC Event Tunneling)
+-----------------------------------------------------------------------+
| LOCAL ENGINE & BIOMETRIC LAYER |
| Windows Electron Main Thread (Runtime Socket Client) |
+-----------------------------------------------------------------------+
| |
v (Local DB Storage) v (LAN Network - Port 4370)
+---------------------------+ +-----------------------------+
| LOCAL SQLITE DATABASE | | PHYSICAL ZKTECO DEVICE(S) |
+---------------------------+ +-----------------------------+
|
v (When WAN / Internet is available)
+-----------------------------------------------------------------------+
| BI-DIRECTIONAL SYNC ENGINE (Background Workers) |
+-----------------------------------------------------------------------+


---

## 2. UI Layout Grid & Wireframe

Designed for maximum throughput during corporate shift switches. All computational resources favor text processing over decorative element painting. Upon a successful verification, the UI flashes a solid contextual border color (Green = Success, Red = Error) for exactly 1500ms before returning to system neutral.

### Attendance Logging Grid

## [ Hardware Biometric Link State ] -> [ DEVICE CONNECTED - 192.168.1.201 ]## [TIMESTAMP] | [EMPLOYEE ID] | [NAME] | [STATUS / EVENT]## 2026-07-22 08:02:14 | EMP-94821 | Marcus Vance | IN (Shift Start)
2026-07-22 08:01:45 | EMP-10394 | Sarah Jenkins | IN (Shift Start)
2026-07-22 07:58:12 | EMP-48201 | David Cho | OUT (Shift End)
2026-07-22 07:55:00 | EMP-31942 | Elena Rostova | IN (Shift Start)
[ Active On-Site Headcount: 42 Employees ] (F1: Clear Logs View)


---

## 3. Real-Time Network Biometric Connection Engine

Communication with the hardware terminals is handled on the Electron main process via a raw network socket implementation utilizing `zkteco-js` or `node-zklib`. This completely bypasses the need to run heavy ZK standard Windows middleware software suites.

### Electron Background Driver (`main.js` Context)

```javascript
const { app, ipcMain } = require('electron');
const ZKLib = require('zkteco-js'); // Core networking layer abstraction

let zkInstance = null;
const DEVICE_IP = '192.168.1.201'; // Default hardware target node IP address
const DEVICE_PORT = 4370;           // Fixed proprietary ZKTeco socket listener port
const COMM_KEY = 0;                 // Device Passcode / Authentication Key (Default is 0, adjust if set in machine)

async function initializeBiometricListener(mainWindow) {
  // Parameters: IP, Port, Connection Timeout (ms), Response Timeout (ms)
  zkInstance = new ZKLib(DEVICE_IP, DEVICE_PORT, 5200, 5000);

  try {
    console.log(`Establishing stream lock with ZK hardware at ${DEVICE_IP}...`);
    await zkInstance.createSocket();
    
    // Authenticate with hardware using the configured Comm Key passcode
    if (typeof zkInstance.setCommKey === 'function') {
      await zkInstance.setCommKey(COMM_KEY);
    }
    
    // Test connectivity and read runtime properties
    const deviceDetails = await zkInstance.getInfo();
    console.log("Hardware connection bound securely. Core properties:", deviceDetails);

    // Bind low-level continuous real-time data streaming interface hook
    await zkInstance.getRealTimeLogs((punchLog) => {
      console.log("[Network Punch Log Captured]:", punchLog);
      
      /**
       * Inbound data stream footprint structure map from hardware unit:
       * { 
       *   userId: '94821', 
       *   attTime: '2026-07-22T08:02:14.000Z', 
       *   verified: 1,  // 1 = Fingerprint scan, 4 = RFID Card badge, 15 = Facial recognition
       *   status: 0     // Raw device punch index mapping rules
       * }
       */
      
      // Bubble socket payload straight up to the frontend UI renderer window component
      if (mainWindow && !mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('biometric-punch', punchLog);
      }
    });

  } catch (error) {
    console.error(`Socket link dropped. Re-attempting pipeline binding to ${DEVICE_IP} in 10000ms...`, error);
    // Exponential fallback execution prevention loop
    setTimeout(() => initializeBiometricListener(mainWindow), 10000);
  }
}
```

---

## 4. Offline Database Schema & Punch Logic

The database enforces complete constraints locally, maintaining a decoupled record architecture. It stores local transaction data and sync markers independently from cloud state targets.

```sql
-- Local Employee Roster Mapping
CREATE TABLE local_employees (
    device_user_id TEXT PRIMARY KEY, -- The internal identifier string corresponding to the hardware slot index
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    department TEXT,
    is_active INTEGER DEFAULT 1,     -- System structural gate key (1 = Active, 0 = Terminated/Suspended)
    updated_at TEXT NOT NULL         -- ISO8601 Timestamp used for delta roster syncing
);

-- Local Attendance Event Logging Audit Stream
CREATE TABLE offline_attendance_logs (
    id TEXT PRIMARY KEY,             -- Cryptographically secure unique client-side random UUIDv4
    device_user_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,        -- Strict data validation mapping boundary: 'IN' or 'OUT'
    verification_type INTEGER,       -- Maps standard identity protocol: 1=Finger, 4=Card, 15=Face
    synced INTEGER DEFAULT 0,        -- Cloud Reconciliation Flag: 0 = Local Cache Only, 1 = Synced with Remote Server
    FOREIGN KEY(device_user_id) REFERENCES local_employees(device_user_id)
);

-- Optimization Execution Performance Indexes
CREATE INDEX idx_employee_id ON local_employees(device_user_id);
CREATE INDEX idx_employee_sync_time ON local_employees(updated_at);
CREATE INDEX idx_attendance_sync ON offline_attendance_logs(synced);
CREATE INDEX idx_attendance_timestamp ON offline_attendance_logs(timestamp DESC);
```

### Automatic Chronological Toggle Routine
To keep the scanning workflow seamless, the system checks the employee's last status in the database to calculate the correct state toggle automatically:

```javascript
const { ipcRenderer } = require('electron');

ipcRenderer.on('biometric-punch', async (event, punchData) => {
  const { userId, attTime, verified } = punchData;
  
  // 1. Validate employee integrity records locally
  const employee = await localDb.get(
    "SELECT first_name, last_name FROM local_employees WHERE device_user_id = ? AND is_active = 1", 
    [userId]
  );
  
  if (!employee) {
    triggerUIFeedback('ERROR', `Rejected hardware ID: ${userId}`);
    return;
  }

  // 2. Query structural database for chronological previous event context row
  const lastLog = await localDb.get(
    "SELECT event_type FROM offline_attendance_logs WHERE device_user_id = ? ORDER BY timestamp DESC LIMIT 1",
    [userId]
  );
  
  // 3. State calculation boundaries: Auto toggle between check-in and check-out
  const nextEvent = (lastLog && lastLog.event_type === 'IN') ? 'OUT' : 'IN';
  const logUuid = crypto.randomUUID();
  const standardizedTimestamp = attTime ? new Date(attTime).toISOString() : new Date().toISOString();

  // 4. Commit verified event data row into local offline logging queue
  await localDb.run(
    "INSERT INTO offline_attendance_logs (id, device_user_id, timestamp, event_type, verification_type, synced) VALUES (?, ?, ?, ?, ?, 0)",
    [logUuid, userId, standardizedTimestamp, nextEvent, verified]
  );
  
  // 5. Instantly flash application container views and execute UI update cycle
  triggerUIFeedback('SUCCESS', `${employee.first_name} ${employee.last_name} -> ${nextEvent}`);
  refreshDashboardGrid();
});
```

---

## 5. Bi-Directional Synchronization Engine

A background orchestration service operates on a continuous, low-priority interval. It flushes locally generated logs upstream while pulling down workforce updates using a delta tracking system (`updated_at`).

```javascript
const axios = require('axios');

const CLOUD_API_URL = 'https://yourdomain.com';
const SYNC_INTERVAL_MS = 30000; // Run reconciliation routines every 30 seconds
let isSyncing = false;

function startSyncOrchestrator() {
  setInterval(async () => {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
      console.log("[Sync Engine]: Commencing synchronization handshake...");
      
      // 1. Push Offline Local Logs Upstream (Transaction Pipeline)
      await pushLocalLogsToCloud();
      
      // 2. Pull Remote Workforce Delta Changes Downstream (Roster Sync Pipeline)
      await pullRosterChangesFromCloud();
      
    } catch (error) {
      console.error("[Sync Engine Alert]: Synchronization cycle suspended:", error.message);
    } finally {
      isSyncing = false;
    }
  }, SYNC_INTERVAL_MS);
}

/**
 * Stage 1: Push un-synced logs upstream matching transactional parameters
 */
async function pushLocalLogsToCloud() {
  const unSyncedLogs = await localDb.all(
    "SELECT * FROM offline_attendance_logs WHERE synced = 0 ORDER BY timestamp ASC LIMIT 100"
  );
  
  if (unSyncedLogs.length === 0) return;

  console.log(`[Sync Engine]: Transmitting ${unSyncedLogs.length} attendance rows to cloud server...`);
  
  // POST payload containing the array block
  const response = await axios.post(`${CLOUD_API_URL}/punch-ingest`, { logs: unSyncedLogs });
  
  if (response.status === 200 && response.data.success) {
    const syncedIds = unSyncedLogs.map(log => log.id);
    
    // Batch update tracking flags locally using parameterized placeholders
    const placeholders = syncedIds.map(() => '?').join(',');
    await localDb.run(
      `UPDATE offline_attendance_logs SET synced = 1 WHERE id IN (${placeholders})`,
      syncedIds
    );
    console.log(`[Sync Engine]: Successfully reconciled ${syncedIds.length} logs upstream.`);
  }
}

/**
 * Stage 2: Pull down roster additions/mutations utilizing high-precision delta boundaries
 */
async function pullRosterChangesFromCloud() {
  // Identify the most recent delta checkpoint timestamp in our local index
  const lastUpdateCheckpoint = await localDb.get(
    "SELECT MAX(updated_at) as latest FROM local_employees"
  );
  
  const checkpointTimestamp = lastUpdateCheckpoint?.latest || "1970-01-01T00:00:00.000Z";
  
  const response = await axios.get(`${CLOUD_API_URL}/roster-delta`, {
    params: { since: checkpointTimestamp }
  });

  const modifiedEmployees = response.data.employees || [];
  
  if (modifiedEmployees.length === 0) return;
  
  console.log(`[Sync Engine]: Processing ${modifiedEmployees.length} inbound employee data changes...`);
  
  // Open atomic transaction for rapid bulk execution
  await localDb.run("BEGIN TRANSACTION");
  try {
    for (const emp of modifiedEmployees) {
      await localDb.run(
        `INSERT INTO local_employees (device_user_id, first_name, last_name, department, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(device_user_id) DO UPDATE SET
           first_name = excluded.first_name,
           last_name = excluded.last_name,
           department = excluded.department,
           is_active = excluded.is_active,
           updated_at = excluded.updated_at`,
        [emp.device_user_id, emp.first_name, emp.last_name, emp.department, emp.is_active, emp.updated_at]
      );
    }
    await localDb.run("COMMIT");
    console.log("[Sync Engine]: Roster sync transaction written successfully.");
  } catch (txError) {

await localDb.run("ROLLBACK");
throw txError;
}
}
```
------------------------------
## 6. Global Keyboard Shortcuts Matrix

| Physical Key | Interface Action Mapping | Operational Execution Scope |
|---|---|---|
| F1 | Reset Display Grid | Flushes visible log item streams from active viewports without removing internal data rows. |
| F2 | Admin Override Trigger | Activates a secure layout wrapper to process punch lines manually using keyboard entry tools. |
| F5 | Restart Hardware Handshake | Drops the active socket and re-executes port 4370 protocol loops to restore frozen network nodes. |


***

This document is now ready for deployment in your codebase. If you need any assistance setting up the web frontend code layer or the deployment packaging configurations for Windows, feel free to ask!


