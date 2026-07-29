/**
 * KosAI Admin Desktop — Main App Logic
 * Uses Tauri invoke for native operations
 */

const API_BASE = 'https://cctv-service-system.nyinyimin2007.workers.dev';

let currentView = 'dashboard';
let authToken = localStorage.getItem('admin_token') || '';
let syncInterval = null;

// ── Toast Notifications ──────────────────────────────────────────────────

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── View Switching ───────────────────────────────────────────────────────

function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-menu li').forEach(li => li.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  if (view) {
    view.classList.add('active');
    currentView = viewId;
  }

  const navItem = document.querySelector(`[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');

  loadViewData(viewId);
}

// ── Data Loading ─────────────────────────────────────────────────────────

async function loadViewData(viewId) {
  switch (viewId) {
    case 'dashboard': await loadDashboard(); break;
    case 'tickets': await loadTickets(); break;
    case 'clients': await loadClients(); break;
    case 'inventory': await loadInventory(); break;
    case 'sync': await loadSyncStatus(); break;
  }
}

async function loadDashboard() {
  const container = document.getElementById('view-dashboard');
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const jobs = await invokeTauri('get_jobs');
    const clients = await invokeTauri('get_clients');
    const inventory = await invokeTauri('get_inventory');

    const pendingJobs = jobs.filter(j => j.status === 'Pending').length;
    const activeJobs = jobs.filter(j => j.status === 'In Progress').length;
    const completedJobs = jobs.filter(j => j.status === 'Completed').length;

    container.innerHTML = `
      <h2 style="margin-bottom:20px">Dashboard</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${jobs.length}</div>
          <div class="stat-label">Total Jobs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--warning)">${pendingJobs}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--info)">${activeJobs}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--success)">${completedJobs}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${clients.length}</div>
          <div class="stat-label">Clients</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${inventory.length}</div>
          <div class="stat-label">Inventory Items</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h2>Recent Jobs</h2>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            ${jobs.slice(0, 10).map(j => `
              <tr>
                <td>${j.id}</td>
                <td>${j.service_type}</td>
                <td><span class="badge badge-${statusClass(j.status)}">${j.status}</span></td>
                <td>${formatDate(j.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Error loading dashboard: ${err}</p></div>`;
  }
}

async function loadTickets() {
  const container = document.getElementById('view-tickets');
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const jobs = await invokeTauri('get_jobs');
    container.innerHTML = `
      <div class="card-header">
        <h2>Service Tickets</h2>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Client</th>
            <th>Type</th>
            <th>Status</th>
            <th>Technician</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map(j => `
            <tr>
              <td>${j.id}</td>
              <td>${j.client_id || '-'}</td>
              <td>${j.service_type}</td>
              <td><span class="badge badge-${statusClass(j.status)}">${j.status}</span></td>
              <td>${j.technician_id || '-'}</td>
              <td>${formatDate(j.created_at)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Error: ${err}</p></div>`;
  }
}

async function loadClients() {
  const container = document.getElementById('view-clients');
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const clients = await invokeTauri('get_clients');
    container.innerHTML = `
      <div class="card-header">
        <h2>Clients</h2>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Company</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>AMC Status</th>
          </tr>
        </thead>
        <tbody>
          ${clients.map(c => `
            <tr>
              <td>${c.id}</td>
              <td>${c.company_name}</td>
              <td>${c.contact_person || '-'}</td>
              <td>${c.phone || '-'}</td>
              <td><span class="badge badge-${amcClass(c.amc_status)}">${c.amc_status || 'N/A'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Error: ${err}</p></div>`;
  }
}

async function loadInventory() {
  const container = document.getElementById('view-inventory');
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const items = await invokeTauri('get_inventory');
    container.innerHTML = `
      <div class="card-header">
        <h2>Inventory</h2>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Name</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td>${i.item_code}</td>
              <td>${i.item_name}</td>
              <td>${i.category}</td>
              <td>${i.stock_qty}</td>
              <td>$${i.unit_price.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Error: ${err}</p></div>`;
  }
}

async function loadSyncStatus() {
  const container = document.getElementById('view-sync');
  container.innerHTML = '<div class="spinner" style="margin:40px auto"></div>';

  try {
    const status = await invokeTauri('get_sync_status');
    container.innerHTML = `
      <h2 style="margin-bottom:20px">Sync Status</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${status.jobs_count}</div>
          <div class="stat-label">Local Jobs</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${status.clients_count}</div>
          <div class="stat-label">Local Clients</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${status.inventory_count}</div>
          <div class="stat-label">Local Inventory</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color:var(--warning)">${status.unsynced_records}</div>
          <div class="stat-label">Unsynced</div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h2>Pending Operations</h2>
        </div>
        <p style="color:var(--text-muted)">${status.pending_operations} operations waiting to sync</p>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="card"><p>Error: ${err}</p></div>`;
  }
}

// ── Sync Operations ──────────────────────────────────────────────────────

async function performSync() {
  const btn = document.getElementById('btn-sync');
  const indicator = document.getElementById('sync-status');

  btn.disabled = true;
  btn.textContent = 'Syncing...';

  try {
    const result = await invokeTauri('sync_full', {
      apiBase: API_BASE,
      authToken: authToken,
      clientId: `desktop-${getDeviceId()}`,
    });

    indicator.classList.add('online');
    indicator.querySelector('.text').textContent = 'Online';
    showToast(`Sync complete: pushed ${result[0].accepted}, pulled ${result[1].records.length}`, 'success');
  } catch (err) {
    indicator.classList.remove('online');
    indicator.querySelector('.text').textContent = 'Offline';
    showToast(`Sync failed: ${err}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync Now';
  }
}

// ── Tauri Bridge ─────────────────────────────────────────────────────────

async function invokeTauri(command, args = {}) {
  if (window.__TAURI__) {
    return window.__TAURI__.invoke(command, args);
  }
  // Fallback to API calls for web mode
  return apiFallback(command, args);
}

async function apiFallback(command, args) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  const endpointMap = {
    'get_jobs': '/api/jobs',
    'get_clients': '/api/clients',
    'get_inventory': '/api/inventory/stock',
    'get_technicians': '/api/technicians',
    'get_sync_status': '/api/sync/status',
  };

  const endpoint = endpointMap[command];
  if (!endpoint) throw new Error(`Unknown command: ${command}`);

  const res = await fetch(`${API_BASE}${endpoint}`, { headers });
  const data = await res.json();
  return data.data || data;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function statusClass(status) {
  const map = { 'Pending': 'pending', 'In Progress': 'progress', 'Completed': 'completed', 'Cancelled': 'cancelled' };
  return map[status] || 'pending';
}

function amcClass(status) {
  const map = { 'Active': 'completed', 'Inactive': 'pending', 'Expired': 'cancelled' };
  return map[status] || 'pending';
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDeviceId() {
  let id = localStorage.getItem('device_id');
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('device_id', id);
  }
  return id;
}

// ── Init ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Nav menu click handlers
  document.querySelectorAll('.nav-menu li').forEach(li => {
    li.addEventListener('click', () => {
      const view = li.getAttribute('data-view');
      if (view) switchView(view);
    });
  });

  // Sync button
  document.getElementById('btn-sync').addEventListener('click', performSync);

  // Load initial view
  switchView('dashboard');

  // Auto-sync every 5 minutes
  syncInterval = setInterval(performSync, 300000);
});
