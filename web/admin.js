// XSS Protection
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Toast notification system - replaces alert()
window.showToast = function(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container') || createToastContainer();
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400'
  };
  const icons = {
    success: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>',
    warning: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>',
    info: '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };
  toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} shadow-lg backdrop-blur-xl transform translate-y-[-100%] transition-transform duration-300 pointer-events-auto`;
  toast.innerHTML = `
    <span class="flex-shrink-0">${icons[type]}</span>
    <span class="text-sm font-medium flex-1">${escapeHTML(message)}</span>
    <button onclick="this.parentElement.remove()" class="flex-shrink-0 opacity-60 hover:opacity-100">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
    </button>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('translate-y-[-100%]'));
  setTimeout(() => {
    toast.classList.add('translate-y-[-100%]');
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[100] space-y-2 max-w-sm';
  document.body.appendChild(container);
  return container;
}

// Override alert() to use toast for backward compatibility
window._originalAlert = window.alert;
window.alert = function(message) {
  window.showToast(message, 'info', 4000);
};

let map;
let mapMarkers = [];
let statusChartInstance;
let categoryChartInstance;
let chatInterval;

let cashTransactions = [];
let cashPage = 1;
const cashPerPage = 10;

let inventoryItems = [];
let stockPage = 1;
const stockPerPage = 10;

// Safe fetch interceptor — only adds auth to same-origin /api/ calls
const _originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const finalUrl = typeof url === 'string' ? url : url?.url || '';
  // Only intercept same-origin API calls
  if (finalUrl.startsWith('/api/') || finalUrl.includes(window.location.origin + '/api/')) {
    options.headers = options.headers || {};
    const token = localStorage.getItem('admin_token');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return _originalFetch.call(this, url, options);
};

// Mobile sidebar controls
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// Login view tabs switcher
function setLoginTab(tab) {
  const googleBtn = document.getElementById('tab-google');
  const passBtn = document.getElementById('tab-password');
  const googleContainer = document.getElementById('login-google-container');
  const passContainer = document.getElementById('login-password-container');

  if (tab === 'google') {
    googleBtn.classList.add('text-white', 'font-bold', 'border-b-2', 'border-amber-500');
    googleBtn.classList.remove('text-slate-400');
    passBtn.classList.remove('text-white', 'font-bold', 'border-b-2', 'border-amber-500');
    passBtn.classList.add('text-slate-400');
    googleContainer.classList.remove('hidden');
    passContainer.classList.add('hidden');
  } else {
    passBtn.classList.add('text-white', 'font-bold', 'border-b-2', 'border-amber-500');
    passBtn.classList.remove('text-slate-400');
    googleBtn.classList.remove('text-white', 'font-bold', 'border-b-2', 'border-amber-500');
    googleBtn.classList.add('text-slate-400');
    passContainer.classList.remove('hidden');
    googleContainer.classList.add('hidden');
  }
}

async function handlePasswordLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const baseUrl = document.getElementById('api-base').value;

  try {
    const res = await fetch(`${baseUrl}/api/auth/login-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Authentication failed');

    const user = data.technician || data.user;
    if (!user || user.role !== 'Admin') {
      throw new Error('Your account does not have Admin privileges.');
    }

    localStorage.setItem('admin_user', JSON.stringify(user));
    localStorage.setItem('admin_token', data.token);
    document.getElementById('auth-screen').classList.add('hidden');
    initializeAdminDesk();
  } catch (err) {
    alert('Access Denied: ' + err.message);
  }
}

// submitNewUser is defined later in the file

// Auto check Google user cache on load
window.addEventListener('load', () => {
  google.accounts.id.initialize({
    client_id: '609507528219-2foc0ch65rkqkgdlvlihqagb6dqbmpcm.apps.googleusercontent.com', // Google OAuth Client ID binding
    callback: handleGoogleLogin,
  });
  google.accounts.id.renderButton(document.getElementById('g-signin-btn'), {
    theme: 'dark',
    size: 'large',
    type: 'standard',
    shape: 'rectangular',
  });

  const cachedUser = localStorage.getItem('admin_user');
  if (cachedUser) {
    const user = JSON.parse(cachedUser);
    if (user.role === 'Admin') {
      document.getElementById('auth-screen').classList.add('hidden');
      initializeAdminDesk();
    }
  }
});

async function handleGoogleLogin(response) {
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: response.credential }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Google auth rejected');

    if (data.user.role !== 'Admin') {
      throw new Error('Your account does not have Admin privileges.');
    }

    localStorage.setItem('admin_user', JSON.stringify(data.user));
    localStorage.setItem('admin_token', data.token);
    document.getElementById('auth-screen').classList.add('hidden');
    initializeAdminDesk();
  } catch (err) {
    alert('Access Denied: ' + err.message);
  }
}

function handleLogout() {
  localStorage.removeItem('admin_user');
  localStorage.removeItem('admin_token');
  document.getElementById('auth-screen').classList.remove('hidden');
}

async function triggerBackup() {
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/backup`, {
      headers: { 'X-Admin-Secret': secret },
    });
    if (!res.ok) throw new Error('Could not download backup file.');
    const data = await res.json();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `awesomemyanmar_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert('Database backup file generated and downloaded successfully!');
  } catch (e) {
    alert('Backup failed: ' + e.message);
  }
}

function triggerRestore() {
  document.getElementById('restore-file-input').click();
}

async function handleRestoreFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  const confirmRestore = confirm(
    'CRITICAL WARNING: This action will completely erase all current client profiles, technician registries, tickets, ledger entries, and transaction histories, replacing them with the backup state. Do you want to proceed?'
  );
  if (!confirmRestore) {
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    const baseUrl = document.getElementById('api-base').value;
    const secret = document.getElementById('admin-secret').value;
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.data) throw new Error('Invalid backup file structure.');

      const res = await fetch(`${baseUrl}/api/admin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
        body: JSON.stringify(parsed),
      });
      const resData = await res.json();
      if (res.ok) {
        alert('Database restored successfully! Reloading dashboard metrics...');
        refreshDashboardData();
      } else {
        throw new Error(resData.error || 'Restoration failed.');
      }
    } catch (err) {
      alert('Restoration process aborted: ' + err.message);
    } finally {
      event.target.value = '';
    }
  };
  reader.readAsText(file);
}

function syncExchangeRate(val) {
  const globalRate = document.getElementById('cash-rate-global');
  if (globalRate) globalRate.value = val;
  const cashRate = document.getElementById('cash-rate');
  if (cashRate) cashRate.value = val;
  document.getElementById('cash-rate-local').value = val;
}

function switchTab(tabId) {
  // Hide all views
  document.querySelectorAll('.tab-view').forEach((view) => {
    view.classList.add('hidden');
  });
  // Show selected view
  const selectedView = document.getElementById(`view-${tabId}`);
  if (selectedView) selectedView.classList.remove('hidden');

  // Update path display
  const pathNames = {
    'system-settings': 'System Settings',
    'pos': 'POS Terminal',
  };
  const pathName = pathNames[tabId] || (tabId.charAt(0).toUpperCase() + tabId.slice(1));
  document.getElementById('current-path-display').textContent =
    pathName === 'Dashboard' ? 'Dashboard' : `Dashboard / ${pathName}`;

  // Highlight sidebar tab
  document.querySelectorAll('.tab-link').forEach((link) => {
    link.classList.remove('bg-amber-500/10', 'text-amber-500');
    link.classList.add('text-slate-400');
  });
  // Find clicking source link (simplified matching)
  const activeLink = Array.from(document.querySelectorAll('.tab-link')).find((link) =>
    link.getAttribute('onclick').includes(tabId)
  );
  if (activeLink) {
    activeLink.classList.remove('text-slate-400');
    activeLink.classList.add('bg-amber-500/10', 'text-amber-500');
  }
}

// Auto refresh interval ID (prevents stacking)
let _dashboardRefreshInterval = null;

function initializeAdminDesk() {
  initLeafletMap();
  setupSearchableClientsListeners();
  refreshDashboardData();
  // Clear any existing interval to prevent stacking
  if (_dashboardRefreshInterval) clearInterval(_dashboardRefreshInterval);
  _dashboardRefreshInterval = setInterval(refreshDashboardData, 60000);
}

let hqMarker = null;

function loadHQConfig() {
  const hq = JSON.parse(localStorage.getItem('hq_config')) || {
    name: 'AwesomeMyanmar Head Office',
    lat: 16.774687,
    lng: 96.163438,
    address: 'Q5F7+V9 Yangon, Myanmar (Burma)',
    maps_url: 'https://maps.app.goo.gl/EynEhHxGX42CpHvr5',
  };

  if (document.getElementById('hq-name')) document.getElementById('hq-name').value = hq.name;
  if (document.getElementById('hq-maps-url'))
    document.getElementById('hq-maps-url').value = hq.maps_url || '';
  if (document.getElementById('hq-lat')) document.getElementById('hq-lat').value = hq.lat;
  if (document.getElementById('hq-lng')) document.getElementById('hq-lng').value = hq.lng;
  if (document.getElementById('hq-address'))
    document.getElementById('hq-address').value = hq.address;

  return hq;
}

async function resolveMapsUrlToCoords(url) {
  const statusEl = document.getElementById('hq-resolve-status');
  if (!url || !url.startsWith('http')) {
    statusEl.textContent = 'Default coordinates preloaded';
    statusEl.className = 'block text-[8px] text-slate-500 mt-1';
    return;
  }

  statusEl.textContent = 'Resolving Google Maps URL...';
  statusEl.className = 'block text-[8px] text-amber-400 mt-1 animate-pulse';

  try {
    const baseUrl = document.getElementById('api-base').value;
    const res = await fetch(`${baseUrl}/api/admin/resolve-coords?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (res.ok && data.success) {
      document.getElementById('hq-lat').value = data.lat;
      document.getElementById('hq-lng').value = data.lng;
      statusEl.textContent = `Successfully resolved coordinates: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
      statusEl.className = 'block text-[8px] text-emerald-400 mt-1 font-bold';
    } else {
      statusEl.textContent = 'Failed to resolve coordinates: ' + (data.error || 'Invalid response');
      statusEl.className = 'block text-[8px] text-rose-400 mt-1 font-bold';
    }
  } catch (err) {
    statusEl.textContent = 'Resolution network error: ' + err.message;
    statusEl.className = 'block text-[8px] text-rose-400 mt-1 font-bold';
  }
}

async function resolveJobMapsUrlToCoords(url) {
  const statusEl = document.getElementById('job-resolve-status');
  if (!url || !url.startsWith('http')) {
    statusEl.textContent = 'Coordinates: Not resolved yet';
    statusEl.className = 'block text-[8px] text-slate-500 mt-1';
    document.getElementById('job-lat').value = '';
    document.getElementById('job-lng').value = '';
    return;
  }

  statusEl.textContent = 'Resolving Google Maps URL...';
  statusEl.className = 'block text-[8px] text-amber-400 mt-1 animate-pulse';

  try {
    const baseUrl = document.getElementById('api-base').value;
    const res = await fetch(`${baseUrl}/api/admin/resolve-coords?url=${encodeURIComponent(url)}`);
    const data = await res.json();

    if (res.ok && data.success) {
      document.getElementById('job-lat').value = data.lat;
      document.getElementById('job-lng').value = data.lng;
      statusEl.textContent = `Successfully resolved coordinates: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
      statusEl.className = 'block text-[8px] text-emerald-400 mt-1 font-bold';
    } else {
      statusEl.textContent = 'Failed to resolve coordinates: ' + (data.error || 'Invalid response');
      statusEl.className = 'block text-[8px] text-rose-400 mt-1 font-bold';
    }
  } catch (err) {
    statusEl.textContent = 'Resolution network error: ' + err.message;
    statusEl.className = 'block text-[8px] text-rose-400 mt-1 font-bold';
  }
}

function saveHQConfig(e) {
  e.preventDefault();
  const latVal = parseFloat(document.getElementById('hq-lat').value);
  const lngVal = parseFloat(document.getElementById('hq-lng').value);
  const hq = {
    name: document.getElementById('hq-name').value,
    lat: isNaN(latVal) ? 16.774687 : latVal,
    lng: isNaN(lngVal) ? 96.163438 : lngVal,
    address: document.getElementById('hq-address').value,
    maps_url: document.getElementById('hq-maps-url').value,
  };
  localStorage.setItem('hq_config', JSON.stringify(hq));
  alert('Head Office Location settings saved! Redrawing map...');

  if (map) {
    map.setView([hq.lat, hq.lng], 12);
    refreshDashboardData();
  }
}

function toggleCustomerTypeFields(val) {
  const corpField = document.getElementById('corporate-client-field');
  const indField = document.getElementById('individual-customer-fields');
  if (val === 'Individual') {
    corpField.classList.add('hidden');
    indField.classList.remove('hidden');
    indField.querySelectorAll('input').forEach((i) => (i.required = true));
    const searchInput = document.getElementById('lookup-client-search');
    if (searchInput) searchInput.required = false;
  } else {
    corpField.classList.remove('hidden');
    indField.classList.add('hidden');
    indField.querySelectorAll('input').forEach((i) => {
      i.required = false;
      i.value = '';
    });
    const searchInput = document.getElementById('lookup-client-search');
    if (searchInput) searchInput.required = true;
    const hiddenInput = document.getElementById('lookup-client');
    if (hiddenInput) hiddenInput.value = '';
    if (searchInput) searchInput.value = '';
  }
}

function setupSearchableClientsListeners() {
  const corpSearch = document.getElementById('lookup-client-search');
  const corpIdHidden = document.getElementById('lookup-client');
  if (corpSearch) {
    corpSearch.addEventListener('input', (e) => {
      const val = e.target.value;
      const match = val.match(/\[(CLI-[A-Z0-9-]+)\]/);
      if (match && match[1]) {
        corpIdHidden.value = match[1];
      } else {
        const client = window.allClientsList?.find((c) => c.company_name === val);
        corpIdHidden.value = client ? client.id : '';
      }
    });
  }

  const indSearch = document.getElementById('lookup-individual-search');
  if (indSearch) {
    indSearch.addEventListener('input', (e) => {
      const val = e.target.value;
      const match = val.match(/\[(CLI-IND-[A-Z0-9-]+)\]/) || val.match(/\[(CLI-[A-Z0-9-]+)\]/);
      let selectedClient = null;

      if (match && match[1]) {
        selectedClient = window.allClientsList?.find((c) => c.id === match[1]);
      } else {
        selectedClient = window.allClientsList?.find(
          (c) => c.company_name === val && c.amc_status === 'Individual'
        );
      }

      const phoneInput = document.querySelector('input[name="customer_phone"]');
      const addressInput = document.querySelector('input[name="customer_address"]');

      if (selectedClient) {
        corpIdHidden.value = selectedClient.id;
        if (phoneInput) phoneInput.value = selectedClient.phone || '';
        if (addressInput) addressInput.value = selectedClient.address || '';
      } else {
        corpIdHidden.value = '';
      }
    });

    indSearch.addEventListener('blur', (e) => {
      const val = e.target.value;
      const cleanVal = val.replace(/\s*\[(CLI-IND-[A-Z0-9-]+|CLI-[A-Z0-9-]+)\]$/, '');
      if (cleanVal !== val) {
        e.target.value = cleanVal;
      }
    });
  }
}

function initLeafletMap() {
  if (map) return;
  const hq = loadHQConfig();
  map = L.map('map').setView([hq.lat, hq.lng], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
  }).addTo(map);
}

async function refreshDashboardData() {
  await populateLookupDropdowns();
  await loadJobsData();
  await loadInventoryData();
  await loadRMAData();
  await loadCashSafeData();
  await loadTechniciansData();
  await populateReports();
  await refreshDashboard();
}

async function refreshDashboard() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const [jobsRes, lookupsRes, safeRes] = await Promise.all([
      fetch(`${baseUrl}/api/jobs`),
      fetch(`${baseUrl}/api/admin/lookups`),
      fetch(`${baseUrl}/api/admin/cash/safe`),
    ]);

    const jobs = await jobsRes.json();
    const lookups = await lookupsRes.json();
    const safe = await safeRes.json();

    const totalTickets = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'Completed').length;
    const pendingJobs = jobs.filter(j => j.status === 'Pending').length;
    const inProgressJobs = jobs.filter(j => j.status === 'In Progress').length;
    const completionRate = totalTickets > 0 ? Math.round((completedJobs / totalTickets) * 100) : 0;

    const totalClients = (lookups.clients || []).length;
    const totalTechs = (lookups.technicians || []).length;
    const activeTechs = new Set(jobs.filter(j => j.status !== 'Completed' && j.technician_id).map(j => j.technician_id)).size;

    const inventoryStock = lookups.inventory_stock || [];
    const lowStock = inventoryStock.filter(i => (i.stock_qty || 0) > 0 && (i.stock_qty || 0) <= 5).length;

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const todayJobs = jobs.filter(j => j.created_at && j.created_at.startsWith(today));
    const todayCompleted = todayJobs.filter(j => j.status === 'Completed').length;
    const todayInProgress = todayJobs.filter(j => j.status === 'In Progress').length;

    // Update Today's Quick Stats
    const todayDateEl = document.getElementById('stat-today-date');
    if (todayDateEl) {
      todayDateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    }
    document.getElementById('stat-today-jobs').textContent = todayJobs.length;
    document.getElementById('stat-today-completed').textContent = todayCompleted;
    document.getElementById('stat-today-inprogress').textContent = todayInProgress;

    // Update KPI Cards
    const statElements = {
      'stat-active-tickets': totalTickets,
      'stat-completion-rate': `${completionRate}%`,
      'stat-completed-label': `${completedJobs} completed`,
      'stat-pending-label': `${pendingJobs} pending, ${inProgressJobs} in progress`,
      'stat-total-revenue': `$${(safe.usd_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      'stat-mmk-revenue': `${(safe.mmk_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })} Ks`,
      'stat-techs-onsite': activeTechs,
      'stat-techs-total': `${activeTechs} of ${totalTechs} total`,
      'stat-low-stock': lowStock,
      'stat-cash-usd': `$${(safe.usd_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      'stat-cash-mmk': `${(safe.mmk_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 0 })}`,
      'stat-clients': totalClients,
      'stat-inventory': inventoryStock.length,
    };

    Object.entries(statElements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = value;
    });

    // Populate Recent Tickets Table
    const ticketsBody = document.getElementById('dashboard-tickets-body');
    if (ticketsBody) {
      const recentJobs = jobs.slice(0, 8);
      if (recentJobs.length === 0) {
        ticketsBody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">No tickets yet</td></tr>';
      } else {
        ticketsBody.innerHTML = recentJobs.map(j => {
          const client = (lookups.clients || []).find(c => c.id === j.client_id);
          const tech = (lookups.technicians || []).find(t => t.id === j.technician_id);
          let statusClass = 'bg-slate-500/20 text-slate-400';
          if (j.status === 'Completed') statusClass = 'bg-emerald-500/20 text-emerald-400';
          else if (j.status === 'Pending') statusClass = 'bg-amber-500/20 text-amber-400';
          else if (j.status === 'In Progress') statusClass = 'bg-blue-500/20 text-blue-400';

          return `
            <tr class="hover:bg-white/5 transition-all">
              <td class="p-3 font-mono text-amber-400">${escapeHTML(j.id || 'N/A')}</td>
              <td class="p-3 text-white truncate max-w-[120px]">${escapeHTML(client?.company_name || 'Unknown')}</td>
              <td class="p-3 text-slate-300">${escapeHTML(j.service_type || 'N/A')}</td>
              <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${escapeHTML(j.status)}</span></td>
              <td class="p-3 text-slate-300">${escapeHTML(tech?.name || 'Unassigned')}</td>
              <td class="p-3 text-right text-slate-400 text-[10px]">${j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Populate Activity Feed
    const activityFeed = document.getElementById('dashboard-activity-feed');
    if (activityFeed) {
      const activities = [];
      jobs.slice(0, 5).forEach(j => {
        const client = (lookups.clients || []).find(c => c.id === j.client_id);
        activities.push({
          type: j.status === 'Completed' ? 'success' : j.status === 'Pending' ? 'warning' : 'info',
          icon: j.status === 'Completed' ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>' : '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
          text: `Job ${j.id} ${j.status.toLowerCase()}`,
          detail: client?.company_name || 'Unknown client',
          time: j.created_at ? new Date(j.created_at).toLocaleTimeString() : '',
        });
      });

      activityFeed.innerHTML = activities.length > 0 ? activities.map(a => `
        <div class="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition">
          <div class="w-8 h-8 rounded-lg ${a.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : a.type === 'warning' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'} flex items-center justify-center flex-shrink-0">
            ${a.icon}
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] font-semibold text-white">${a.text}</div>
            <div class="text-[10px] text-slate-400 truncate">${a.detail}</div>
          </div>
          <span class="text-[9px] text-slate-500 flex-shrink-0">${a.time}</span>
        </div>
      `).join('') : '<div class="text-center text-slate-500 text-xs py-8">No recent activity</div>';
    }

    // Render Charts
    renderDashboardCharts(jobs, lookups);

  } catch (e) {
    console.error('Failed to refresh dashboard:', e);
  }
}

function renderDashboardCharts(jobs, lookups) {
  if (typeof Chart === 'undefined') return;

  // Job Status Chart (Doughnut)
  const statusCanvas = document.getElementById('chart-status');
  if (statusCanvas) {
    const existing = Chart.getChart(statusCanvas);
    if (existing) existing.destroy();

    new Chart(statusCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'Pending', 'In Progress', 'Cancelled'],
        datasets: [{
          data: [
            jobs.filter(j => j.status === 'Completed').length,
            jobs.filter(j => j.status === 'Pending').length,
            jobs.filter(j => j.status === 'In Progress').length,
            jobs.filter(j => j.status === 'Cancelled').length,
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, padding: 8 } } },
        cutout: '65%',
      },
    });
  }

  // Service Type Chart (Bar)
  const categoryCanvas = document.getElementById('chart-category');
  if (categoryCanvas) {
    const existing = Chart.getChart(categoryCanvas);
    if (existing) existing.destroy();

    const typeCounts = {};
    jobs.forEach(j => { typeCounts[j.service_type || 'Other'] = (typeCounts[j.service_type || 'Other'] || 0) + 1; });

    new Chart(categoryCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: Object.keys(typeCounts),
        datasets: [{
          data: Object.values(typeCounts),
          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'],
          borderWidth: 0,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 45 }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }

  // Revenue Trend Chart (Line)
  const revenueCanvas = document.getElementById('chart-revenue');
  if (revenueCanvas) {
    const existing = Chart.getChart(revenueCanvas);
    if (existing) existing.destroy();

    const monthlyData = {};
    jobs.forEach(j => {
      if (j.created_at) {
        const month = new Date(j.created_at).toLocaleDateString('en-US', { month: 'short' });
        monthlyData[month] = (monthlyData[month] || 0) + 1;
      }
    });

    new Chart(revenueCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: Object.keys(monthlyData).slice(-6),
        datasets: [{
          label: 'Jobs',
          data: Object.values(monthlyData).slice(-6),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#f59e0b',
          pointBorderColor: '#f59e0b',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }

  // Technician Performance Chart (Horizontal Bar)
  const techPerfCanvas = document.getElementById('chart-tech-performance');
  if (techPerfCanvas) {
    const existing = Chart.getChart(techPerfCanvas);
    if (existing) existing.destroy();

    const techData = {};
    (lookups.technicians || []).forEach(t => {
      techData[t.name] = { total: 0, completed: 0 };
    });
    jobs.forEach(j => {
      const tech = (lookups.technicians || []).find(t => t.id === j.technician_id);
      if (tech && techData[tech.name]) {
        techData[tech.name].total++;
        if (j.status === 'Completed') techData[tech.name].completed++;
      }
    });

    const sortedTechs = Object.entries(techData)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 6);

    new Chart(techPerfCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: sortedTechs.map(([name]) => name),
        datasets: [
          {
            label: 'Completed',
            data: sortedTechs.map(([, data]) => data.completed),
            backgroundColor: '#10b981',
            borderRadius: 4,
          },
          {
            label: 'Pending',
            data: sortedTechs.map(([, data]) => data.total - data.completed),
            backgroundColor: '#f59e0b',
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } } },
        scales: {
          x: { stacked: true, ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { stacked: true, ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
        },
      },
    });
  }

  // Monthly Jobs Trend (Area Chart)
  const monthlyJobsCanvas = document.getElementById('chart-monthly-jobs');
  if (monthlyJobsCanvas) {
    const existing = Chart.getChart(monthlyJobsCanvas);
    if (existing) existing.destroy();

    const monthlyJobs = {};
    jobs.forEach(j => {
      if (j.created_at) {
        const month = new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyJobs[month]) monthlyJobs[month] = { total: 0, completed: 0 };
        monthlyJobs[month].total++;
        if (j.status === 'Completed') monthlyJobs[month].completed++;
      }
    });

    const sortedMonths = Object.entries(monthlyJobs).slice(-8);

    new Chart(monthlyJobsCanvas.getContext('2d'), {
      type: 'line',
      data: {
        labels: sortedMonths.map(([month]) => month),
        datasets: [
          {
            label: 'Total Jobs',
            data: sortedMonths.map(([, data]) => data.total),
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#3b82f6',
            pointRadius: 4,
          },
          {
            label: 'Completed',
            data: sortedMonths.map(([, data]) => data.completed),
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            fill: true,
            tension: 0.4,
            pointBackgroundColor: '#10b981',
            pointRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } } },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 9 }, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }
}

async function populateReports() {
  const baseUrl = document.getElementById('api-base').value;
  try {
    const jobsRes = await fetch(`${baseUrl}/api/jobs`);
    const jobs = await jobsRes.json();

    const lookupsRes = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await lookupsRes.json();

    const safeRes = await fetch(`${baseUrl}/api/admin/cash/safe`);
    const safe = await safeRes.json();

    // ── KPI Cards ──
    const totalTickets = jobs.length;
    const completedJobs = jobs.filter((j) => j.status === 'Completed').length;
    const pendingJobs = jobs.filter((j) => j.status === 'Pending').length;
    const inProgressJobs = jobs.filter((j) => j.status === 'In Progress').length;
    const completionRate = totalTickets > 0 ? Math.round((completedJobs / totalTickets) * 100) : 0;

    const totalClients = (lookups.clients || []).length;
    const activeAMC = (lookups.clients || []).filter((c) => c.amc_status === 'Active').length;
    const activeTechs = new Set(jobs.filter((j) => j.status !== 'Completed' && j.technician_id).map((j) => j.technician_id)).size;

    const inventoryStock = lookups.inventory_stock || [];
    const inventoryValue = inventoryStock.reduce((sum, item) => sum + (item.stock_qty || 0) * (item.unit_price || 0), 0);

    document.getElementById('report-total-tickets').textContent = totalTickets;
    document.getElementById('report-completion-rate').textContent = `${completionRate}%`;
    document.getElementById('report-total-clients').textContent = totalClients;
    document.getElementById('report-active-amc').textContent = `${activeAMC} active AMC`;
    document.getElementById('report-active-techs').textContent = activeTechs;
    document.getElementById('report-usd-safe').textContent = `$${safe.usd_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('report-mmk-safe').textContent = `${safe.mmk_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ks`;
    document.getElementById('report-inventory-value').textContent = `$${inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // ── AMC Status Table ──
    const amcCounts = { Active: 0, Inactive: 0, Expired: 0, 'No AMC': 0, Individual: 0 };
    (lookups.clients || []).forEach((c) => {
      const status = c.amc_status || 'Inactive';
      if (amcCounts[status] !== undefined) {
        amcCounts[status]++;
      }
    });

    const amcBody = document.getElementById('report-amc-body');
    if (amcBody) {
      amcBody.innerHTML = '';
      const totalClientCount = Object.values(amcCounts).reduce((a, b) => a + b, 0);
      Object.entries(amcCounts).forEach(([status, count]) => {
        const pct = totalClientCount > 0 ? Math.round((count / totalClientCount) * 100) : 0;
        let statusColor = 'text-slate-400';
        let barColor = 'bg-slate-500';
        if (status === 'Active') { statusColor = 'text-emerald-400'; barColor = 'bg-emerald-500'; }
        else if (status === 'Expired') { statusColor = 'text-rose-400'; barColor = 'bg-rose-500'; }
        else if (status === 'No AMC') { statusColor = 'text-amber-400'; barColor = 'bg-amber-500'; }
        else if (status === 'Individual') { statusColor = 'text-indigo-400'; barColor = 'bg-indigo-500'; }

        amcBody.innerHTML += `
          <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
            <td class="py-2.5">
              <div class="flex items-center gap-2">
                <div class="w-2 h-2 rounded-full ${barColor}"></div>
                <span class="font-semibold ${statusColor}">${status}</span>
              </div>
            </td>
            <td class="py-2.5 text-right font-mono font-bold text-white">${count}</td>
            <td class="py-2.5 text-right">
              <div class="flex items-center justify-end gap-2">
                <div class="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div class="${barColor} h-full rounded-full" style="width: ${pct}%"></div>
                </div>
                <span class="text-[10px] text-slate-400 font-mono w-8">${pct}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }

    // ── Engineer Performance Table ──
    const techLoad = {};
    (lookups.technicians || []).forEach((t) => {
      techLoad[t.id] = { name: t.name, role: t.role, assigned: 0, completed: 0, pending: 0, in_progress: 0 };
    });

    jobs.forEach((j) => {
      if (techLoad[j.technician_id]) {
        techLoad[j.technician_id].assigned++;
        if (j.status === 'Completed') techLoad[j.technician_id].completed++;
        if (j.status === 'Pending') techLoad[j.technician_id].pending++;
        if (j.status === 'In Progress') techLoad[j.technician_id].in_progress++;
      }
    });

    const techsBody = document.getElementById('report-techs-body');
    if (techsBody) {
      techsBody.innerHTML = '';
      const sortedTechs = Object.values(techLoad).sort((a, b) => b.assigned - a.assigned);
      sortedTechs.forEach((t) => {
        const rate = t.assigned > 0 ? Math.round((t.completed / t.assigned) * 100) : 0;
        let rateColor = 'text-slate-400';
        if (rate >= 80) rateColor = 'text-emerald-400';
        else if (rate >= 50) rateColor = 'text-amber-400';
        else rateColor = 'text-rose-400';

        techsBody.innerHTML += `
          <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
            <td class="py-2.5">
              <div class="font-semibold text-white">${t.name}</div>
              <div class="text-[10px] text-slate-500">${t.role || 'Technician'}</div>
            </td>
            <td class="py-2.5 text-center font-mono text-white">${t.assigned}</td>
            <td class="py-2.5 text-center">
              <span class="font-mono ${rateColor}">${t.completed}</span>
              <span class="text-slate-500">/${t.assigned}</span>
            </td>
            <td class="py-2.5 text-right">
              <div class="flex items-center justify-end gap-2">
                <div class="w-12 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div class="${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'} h-full rounded-full" style="width: ${rate}%"></div>
                </div>
                <span class="text-xs font-bold ${rateColor} font-mono">${rate}%</span>
              </div>
            </td>
          </tr>
        `;
      });
    }

    // ── Recent Jobs Table ──
    const recentJobsBody = document.getElementById('report-recent-jobs');
    if (recentJobsBody) {
      recentJobsBody.innerHTML = '';
      const recentJobs = jobs.slice(0, 10);
      if (recentJobs.length === 0) {
        recentJobsBody.innerHTML = '<tr><td colspan="6" class="py-8 text-center text-slate-500">No jobs found</td></tr>';
      } else {
        recentJobs.forEach((j) => {
          const client = (lookups.clients || []).find((c) => c.id === j.client_id);
          const tech = (lookups.technicians || []).find((t) => t.id === j.technician_id);
          let statusClass = 'bg-slate-500/20 text-slate-400';
          if (j.status === 'Completed') statusClass = 'bg-emerald-500/20 text-emerald-400';
          else if (j.status === 'Pending') statusClass = 'bg-amber-500/20 text-amber-400';
          else if (j.status === 'In Progress') statusClass = 'bg-blue-500/20 text-blue-400';

          recentJobsBody.innerHTML += `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
              <td class="py-2.5 font-mono text-amber-400">${j.id || 'N/A'}</td>
              <td class="py-2.5 text-white truncate max-w-[150px]">${client?.company_name || j.client_id || 'Unknown'}</td>
              <td class="py-2.5 text-slate-300">${j.service_type || 'N/A'}</td>
              <td class="py-2.5 text-center">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${j.status}</span>
              </td>
              <td class="py-2.5 text-slate-300">${tech?.name || j.technician_id || 'Unassigned'}</td>
              <td class="py-2.5 text-right text-slate-400 text-[10px]">${j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A'}</td>
            </tr>
          `;
        });
      }
    }

    // ── Charts ──
    renderReportCharts(jobs, lookups);

  } catch (e) {
    console.error('Failed to populate reports:', e);
  }
}

function renderReportCharts(jobs, lookups) {
  // Job Status Chart
  const statusCanvas = document.getElementById('jobStatusCanvas');
  if (statusCanvas && typeof Chart !== 'undefined') {
    const statusCtx = statusCanvas.getContext('2d');
    const statusData = {
      labels: ['Completed', 'Pending', 'In Progress', 'Cancelled'],
      datasets: [{
        data: [
          jobs.filter((j) => j.status === 'Completed').length,
          jobs.filter((j) => j.status === 'Pending').length,
          jobs.filter((j) => j.status === 'In Progress').length,
          jobs.filter((j) => j.status === 'Cancelled').length,
        ],
        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'],
        borderWidth: 0,
      }],
    };

    // Destroy existing chart if any
    const existingChart = Chart.getChart(statusCanvas);
    if (existingChart) existingChart.destroy();

    new Chart(statusCtx, {
      type: 'doughnut',
      data: statusData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, padding: 10 } },
        },
        cutout: '60%',
      },
    });
  }

  // Service Type Chart
  const typeCanvas = document.getElementById('serviceTypeCanvas');
  if (typeCanvas && typeof Chart !== 'undefined') {
    const typeCtx = typeCanvas.getContext('2d');
    const typeCounts = {};
    jobs.forEach((j) => {
      const type = j.service_type || 'Other';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const typeData = {
      labels: Object.keys(typeCounts),
      datasets: [{
        data: Object.values(typeCounts),
        backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'],
        borderWidth: 0,
      }],
    };

    const existingChart = Chart.getChart(typeCanvas);
    if (existingChart) existingChart.destroy();

    new Chart(typeCtx, {
      type: 'bar',
      data: typeData,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
        },
        scales: {
          x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { display: false } },
          y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
      },
    });
  }
}

// ============================================================================
// POS TERMINAL FUNCTIONS
// ============================================================================

let posCart = [];
let posProducts = [];
let posPaymentMethod = 'USD';
let posDiscount = 0;
let posSalesHistory = [];
let posCurrentCategory = 'all';

async function loadPOSProducts() {
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await res.json();
    posProducts = (lookups.inventory_stock || []).map((item) => ({
      code: item.item_code,
      name: item.item_name,
      category: item.category,
      price_usd: item.unit_price || 0,
      price_mmk: item.unit_price_mmk || 0,
      stock: item.stock_qty || 0,
      batch: item.batch_code || '',
    }));
    renderPOSProducts(posProducts);
  } catch (e) {
    console.error('Failed to load POS products:', e);
  }
}

function renderPOSProducts(products) {
  const grid = document.getElementById('pos-product-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">🔍</div>
        <p class="text-sm">No products found</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products
    .map(
      (p) => `
    <button
      onclick="addPOSProduct('${p.code}')"
      class="pos-catalog-card bg-black/30 hover:bg-emerald-500/5 border border-white/5 rounded-xl p-3 text-left transition-all duration-200 ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}"
      ${p.stock <= 0 ? 'disabled' : ''}
    >
      <div class="flex items-start justify-between mb-2">
        <span class="text-[9px] font-mono text-slate-500 bg-black/40 px-1.5 py-0.5 rounded">${p.code}</span>
        ${p.stock > 0 ? `<span class="text-[9px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">${p.stock}</span>` : `<span class="text-[9px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">OUT</span>`}
      </div>
      <div class="text-[11px] font-semibold text-white leading-tight line-clamp-2 mb-2 min-h-[30px]">${p.name}</div>
      <div class="flex items-end justify-between">
        <div>
          <div class="text-sm font-black text-emerald-400">$${p.price_usd.toFixed(2)}</div>
          <div class="text-[9px] text-slate-500 font-mono">${p.price_mmk > 0 ? p.price_mmk.toLocaleString() + ' Ks' : ''}</div>
        </div>
        <div class="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg class="w-3 h-3 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </div>
      </div>
    </button>
  `
    )
    .join('');
}

function filterPOSProducts() {
  // Support both old and new search inputs
  const searchInput = document.getElementById('pos-stock-search') || document.getElementById('pos-search');
  const search = (searchInput?.value || '').toLowerCase();

  // Support category dropdown
  const catDropdown = document.getElementById('pos-stock-cat');
  const selectedCategory = catDropdown?.value || 'All';

  // Support in-stock checkbox
  const inStockOnly = document.getElementById('pos-filter-instock')?.checked ?? true;

  const filtered = posProducts.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search) ||
      p.code.toLowerCase().includes(search) ||
      (p.batch && p.batch.toLowerCase().includes(search));
    const matchCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchStock = !inStockOnly || p.stock > 0;
    return matchSearch && matchCategory && matchStock;
  });
  renderPOSProducts(filtered);
}

function filterPOSByCategory(category, event) {
  posCurrentCategory = category;
  document.querySelectorAll('.pos-cat-btn').forEach((btn) => {
    btn.classList.remove('bg-amber-500', 'text-black', 'active');
    btn.classList.add('bg-white/5', 'text-slate-400');
  });
  if (event && event.target) {
    event.target.classList.remove('bg-white/5', 'text-slate-400');
    event.target.classList.add('bg-amber-500', 'text-black', 'active');
  }
  filterPOSProducts();
}

function clearPOSSearch() {
  document.getElementById('pos-search').value = '';
  filterPOSProducts();
}

function addPOSProduct(code) {
  const product = posProducts.find((p) => p.code === code);
  if (!product || product.stock <= 0) return;

  const existing = posCart.find((item) => item.code === code);
  if (existing) {
    if (existing.qty < product.stock) {
      existing.qty++;
    }
  } else {
    posCart.push({
      code: product.code,
      name: product.name,
      price_usd: product.price_usd,
      price_mmk: product.price_mmk,
      qty: 1,
      max_stock: product.stock,
    });
  }
  renderPOSCart();
}

function removePOSProduct(code) {
  posCart = posCart.filter((item) => item.code !== code);
  renderPOSCart();
}

function updatePOSQty(code, delta) {
  const item = posCart.find((i) => i.code === code);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    removePOSProduct(code);
  } else if (item.qty > item.max_stock) {
    item.qty = item.max_stock;
  }
  renderPOSCart();
}

function clearPOSCart() {
  posCart = [];
  posDiscount = 0;
  document.getElementById('pos-discount-input').value = '';
  renderPOSCart();
}

function renderPOSCart() {
  const container = document.getElementById('pos-cart-items');
  const checkoutBtn = document.getElementById('pos-checkout-btn');

  if (posCart.length === 0) {
    container.innerHTML = `
      <div class="text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">🛒</div>
        <p class="text-sm">Cart is empty</p>
      </div>
    `;
    if (checkoutBtn) checkoutBtn.disabled = true;
    calculatePOSTotals();
    return;
  }

  container.innerHTML = posCart
    .map(
      (item) => `
    <div class="bg-black/30 rounded-lg p-2.5 flex gap-2 items-center border border-white/5 group hover:border-white/10 transition-all">
      <div class="flex-1 min-w-0">
        <div class="text-[11px] font-semibold text-white truncate">${item.name}</div>
        <div class="text-[9px] text-slate-500 font-mono">${item.code}</div>
      </div>
      <div class="flex items-center gap-1">
        <button onclick="updatePOSQty('${item.code}', -1)" class="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] flex items-center justify-center transition">-</button>
        <span class="text-[11px] font-bold text-white w-5 text-center">${item.qty}</span>
        <button onclick="updatePOSQty('${item.code}', 1)" class="w-5 h-5 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] flex items-center justify-center transition">+</button>
      </div>
      <div class="text-right w-16">
        <div class="text-[11px] font-bold text-emerald-400">$${(item.price_usd * item.qty).toFixed(2)}</div>
        <button onclick="removePOSProduct('${item.code}')" class="text-[9px] text-rose-400/70 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition">remove</button>
      </div>
    </div>
  `
    )
    .join('');

  // Enable checkout button and calculate totals
  if (checkoutBtn) checkoutBtn.disabled = false;
  calculatePOSTotals();
}

function applyPOSDiscount() {
  const input = document.getElementById('pos-discount-input');
  const value = parseFloat(input.value) || 0;
  posDiscount = Math.min(Math.max(value, 0), 100);
  renderPOSCart();
}

function setPOSPayment(method) {
  posPaymentMethod = method;
  ['usd', 'mmk', 'both'].forEach((m) => {
    const btn = document.getElementById(`pos-pay-${m}`);
    if (m === method.toLowerCase()) {
      btn.classList.remove('bg-white/5', 'text-slate-400');
      btn.classList.add('bg-amber-500', 'text-black');
    } else {
      btn.classList.remove('bg-amber-500', 'text-black');
      btn.classList.add('bg-white/5', 'text-slate-400');
    }
  });
}

async function processPOSCheckout() {
  if (posCart.length === 0) return;

  const subtotal = posCart.reduce((sum, item) => sum + item.price_usd * item.qty, 0);
  const discountPct = parseFloat(document.getElementById('pos-discount-input')?.value) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const total = subtotal - discountAmt;

  const customer = document.getElementById('pos-customer')?.value || 'Walk-in Customer';
  const clientId = document.getElementById('pos-client-id')?.value || '';
  const linkedJob = document.getElementById('pos-link-job')?.value || '';
  const exchangeRate = parseFloat(document.getElementById('pos-exchange-rate')?.value) || 2100;
  const payCurrency = document.getElementById('pos-pay-currency')?.value || 'USD';
  const paidA = parseFloat(document.getElementById('pos-paid-amount-a')?.value) || 0;
  const paidB = parseFloat(document.getElementById('pos-paid-amount-b')?.value) || 0;
  const methodA = document.getElementById('pos-pay-method-a')?.value || 'Cash';
  const methodB = document.getElementById('pos-paid-amount-b')?.value || '';
  const totalPaid = paidA + paidB;
  const creditDue = Math.max(0, total - totalPaid);

  const receiptNo = `INV-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date();

  const sale = {
    receipt_no: receiptNo,
    date: now.toISOString(),
    customer: customer,
    client_id: clientId,
    linked_job: linkedJob,
    items: [...posCart],
    subtotal: subtotal,
    discount_pct: discountPct,
    discount_amt: discountAmt,
    total: total,
    exchange_rate: exchangeRate,
    total_mmk: total * exchangeRate,
    paid_a: paidA,
    method_a: methodA,
    paid_b: paidB,
    method_b: methodB,
    total_paid: totalPaid,
    credit_due: creditDue,
    payment_currency: payCurrency,
  };

  posSalesHistory.unshift(sale);
  showPOSReceipt(sale);

  // Save to backend
  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    // Save cash transaction for Method A
    if (paidA > 0) {
      await fetch(`${baseUrl}/api/admin/cash/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'Deposit',
          primary_currency: methodA === 'USD' || payCurrency === 'USD' ? 'USD' : 'MMK',
          amount: paidA,
          exchange_rate: exchangeRate,
          equivalent_amount: paidA * exchangeRate,
          notes: `POS Sale ${receiptNo} - ${methodA} - ${customer}`,
        }),
      });
    }
    // Save cash transaction for Method B
    if (paidB > 0) {
      await fetch(`${baseUrl}/api/admin/cash/transaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_type: 'Deposit',
          primary_currency: methodB === 'USD' ? 'USD' : 'MMK',
          amount: paidB,
          exchange_rate: exchangeRate,
          equivalent_amount: paidB * exchangeRate,
          notes: `POS Sale ${receiptNo} - ${methodB} - ${customer}`,
        }),
      });
    }
  } catch (e) {
    console.error('Failed to save transaction:', e);
  }

  // Clear cart
  posCart = [];
  document.getElementById('pos-discount-input').value = '0';
  document.getElementById('pos-customer').value = '';
  document.getElementById('pos-client-id').value = '';
  document.getElementById('pos-link-job').value = '';
  document.getElementById('pos-paid-amount-a').value = '';
  document.getElementById('pos-paid-amount-b').value = '';
  renderPOSCart();
}

function showPOSReceipt(sale) {
  const modal = document.getElementById('pos-receipt-modal');
  const content = document.getElementById('receipt-content');
  const receiptNum = document.getElementById('receipt-number');

  receiptNum.textContent = sale.receipt_no;

  content.innerHTML = `
    <div class="text-center text-xs text-slate-400 mb-4">
      <p class="font-bold text-white">KosAI Technologies</p>
      <p>${new Date(sale.date).toLocaleString()}</p>
      <p>Invoice: ${escapeHTML(sale.receipt_no)}</p>
      <p>Customer: ${escapeHTML(sale.customer)}</p>
      ${sale.linked_job ? `<p>Job ID: ${escapeHTML(sale.linked_job)}</p>` : ''}
    </div>
    <div class="space-y-2">
      ${sale.items
        .map(
          (item) => `
        <div class="flex justify-between text-xs">
          <span class="text-slate-300">${escapeHTML(item.name)} x${item.qty}</span>
          <span class="text-white font-bold">$${(item.price_usd * item.qty).toFixed(2)}</span>
        </div>
      `
        )
        .join('')}
    </div>
    <div class="border-t border-white/10 mt-4 pt-4 space-y-2">
      <div class="flex justify-between text-xs text-slate-400">
        <span>Subtotal</span>
        <span>$${sale.subtotal.toFixed(2)} / ${(sale.total_mmk || 0).toLocaleString()} Ks</span>
      </div>
      ${
        sale.discount_amt > 0
          ? `
        <div class="flex justify-between text-xs text-emerald-400">
          <span>Discount (${sale.discount_pct}%)</span>
          <span>-$${sale.discount_amt.toFixed(2)}</span>
        </div>
      `
          : ''
      }
      <div class="flex justify-between text-sm font-bold">
        <span class="text-white">Total</span>
        <span class="text-emerald-400">$${sale.total.toFixed(2)}</span>
      </div>
      <div class="border-t border-white/5 pt-2 mt-2 space-y-1">
        <div class="text-[10px] text-slate-500 uppercase font-bold">Payment Details</div>
        ${sale.paid_a > 0 ? `<div class="flex justify-between text-xs text-slate-400"><span>${sale.method_a}</span><span>$${sale.paid_a.toFixed(2)}</span></div>` : ''}
        ${sale.paid_b > 0 ? `<div class="flex justify-between text-xs text-slate-400"><span>${sale.method_b}</span><span>$${sale.paid_b.toFixed(2)}</span></div>` : ''}
        ${sale.total_paid > 0 ? `<div class="flex justify-between text-xs font-bold text-white"><span>Total Paid</span><span>$${sale.total_paid.toFixed(2)}</span></div>` : ''}
        ${sale.credit_due > 0 ? `<div class="flex justify-between text-xs font-bold text-rose-400"><span>Credit Due</span><span>$${sale.credit_due.toFixed(2)}</span></div>` : ''}
      </div>
      <div class="text-[10px] text-slate-500 text-right mt-2">
        Exchange Rate: ${sale.exchange_rate || 2100} Ks/USD
      </div>
    </div>
  `;

  modal.classList.remove('hidden');
}

function closePOSReceiptModal() {
  document.getElementById('pos-receipt-modal').classList.add('hidden');
}

function printPOSReceipt() {
  window.print();
}

function renderPOSSalesHistory() {
  const tbody = document.getElementById('pos-sales-history');
  if (!tbody) return;

  if (posSalesHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="py-4 text-center text-slate-600">No sales yet</td></tr>`;
    return;
  }

  tbody.innerHTML = posSalesHistory
    .slice(0, 20)
    .map(
      (sale) => `
    <tr class="border-b border-white/5 hover:bg-white/5 transition">
      <td class="py-2 font-mono text-amber-400">${sale.receipt_no}</td>
      <td class="py-2 text-slate-300">${new Date(sale.date).toLocaleDateString()}</td>
      <td class="py-2 text-slate-300">${sale.customer}</td>
      <td class="py-2 text-slate-300">${sale.items.reduce((s, i) => s + i.qty, 0)} items</td>
      <td class="py-2 text-white font-bold">$${sale.total.toFixed(2)}</td>
      <td class="py-2 text-slate-400">${sale.payment_method}</td>
      <td class="py-2 text-right">
        <button onclick="showPOSReceipt(posSalesHistory.find(s => s.receipt_no === '${sale.receipt_no}'))" class="text-xs text-amber-400 hover:text-amber-300">View</button>
      </td>
    </tr>
  `
    )
    .join('');
}

function loadPOSSalesHistory() {
  renderPOSSalesHistory();
}

// ============================================================================
// POS MODULE SWITCHING
// ============================================================================

function switchPosModule(module) {
  // Hide all panels
  document.getElementById('pos-panel-checkout').classList.add('hidden');
  document.getElementById('pos-panel-credits').classList.add('hidden');

  // Show selected panel
  document.getElementById(`pos-panel-${module}`).classList.remove('hidden');

  // Update button states
  document.querySelectorAll('.pos-mod-btn').forEach((btn) => {
    btn.classList.remove('active-pos-mod');
    btn.classList.add('text-slate-400', 'hover:text-white');
    btn.querySelector('.pos-mod-label').classList.remove('text-emerald-400');
    btn.querySelector('.pos-mod-icon').style.background = 'rgba(255, 255, 255, 0.05)';
    btn.querySelector('.pos-mod-icon').style.border = '1px solid rgba(255, 255, 255, 0.05)';
    btn.querySelector('svg').classList.remove('text-emerald-400');
    btn.querySelector('svg').classList.add('text-slate-400', 'group-hover:text-white');
  });

  // Activate selected button
  const activeBtn = document.getElementById(`pos-mod-${module}`);
  activeBtn.classList.add('active-pos-mod');
  activeBtn.classList.remove('text-slate-400', 'hover:text-white');
  activeBtn.querySelector('.pos-mod-label').classList.add('text-emerald-400');
  activeBtn.querySelector('.pos-mod-icon').style.background = 'rgba(16, 185, 129, 0.2)';
  activeBtn.querySelector('.pos-mod-icon').style.border = '1px solid rgba(16, 185, 129, 0.3)';
  activeBtn.querySelector('svg').classList.add('text-emerald-400');
  activeBtn.querySelector('svg').classList.remove('text-slate-400', 'group-hover:text-white');
}

// ============================================================================
// POS CALCULATE TOTALS
// ============================================================================

function calculatePOSTotals() {
  const subtotal = posCart.reduce((sum, item) => sum + item.price_usd * item.qty, 0);
  const discountPct = parseFloat(document.getElementById('pos-discount-input')?.value) || 0;
  const discountAmt = subtotal * (discountPct / 100);
  const totalUSD = subtotal - discountAmt;

  const exchangeRate = parseFloat(document.getElementById('pos-exchange-rate')?.value) || 2100;
  const totalMMK = totalUSD * exchangeRate;

  // Custom rate handling
  const payCurrency = document.getElementById('pos-pay-currency')?.value || 'USD';
  const customRateContainer = document.getElementById('pos-custom-rate-container');
  if (payCurrency === 'USD_CUSTOM') {
    customRateContainer?.classList.remove('hidden');
  } else {
    customRateContainer?.classList.add('hidden');
  }

  // Payment amounts
  const paidA = parseFloat(document.getElementById('pos-paid-amount-a')?.value) || 0;
  const paidB = parseFloat(document.getElementById('pos-paid-amount-b')?.value) || 0;
  const totalPaid = paidA + paidB;

  // Calculate change or credit
  const changeDue = Math.max(0, totalPaid - totalUSD);
  const creditDue = Math.max(0, totalUSD - totalPaid);

  // Update UI
  document.getElementById('pos-subtotal').textContent = `$${totalUSD.toFixed(2)} / ${totalMMK.toLocaleString()} Ks`;
  document.getElementById('pos-total').textContent = `$${totalUSD.toFixed(2)}`;
  document.getElementById('pos-total-mmk').textContent = `${totalMMK.toLocaleString()} Ks`;
  document.getElementById('pos-credit-due').textContent = `$${creditDue.toFixed(2)} / ${(creditDue * exchangeRate).toLocaleString()} Ks`;
  document.getElementById('pos-change-due').textContent = `$${changeDue.toFixed(2)} / ${(changeDue * exchangeRate).toLocaleString()} Ks`;

  // Enable/disable checkout
  const checkoutBtn = document.getElementById('pos-checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.disabled = posCart.length === 0;
  }
}

// ============================================================================
// POS CLIENT MANAGEMENT
// ============================================================================

function posCreateWalkinClient() {
  document.getElementById('pos-customer').value = 'Walk-in Customer';
  document.getElementById('pos-client-id').value = '';
}

async function loadPOSClients() {
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await res.json();
    const clients = lookups.clients || [];

    const datalist = document.getElementById('pos-clients-datalist');
    if (datalist) {
      datalist.innerHTML = '';
      clients.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = `${c.company_name} [${c.id}]`;
        datalist.appendChild(opt);
      });
    }

    // Load jobs for ticket linking
    const jobsRes = await fetch(`${baseUrl}/api/jobs`);
    const jobs = await jobsRes.json();
    const jobSelect = document.getElementById('pos-link-job');
    if (jobSelect) {
      jobSelect.innerHTML = '<option value="">-- Select Ticket --</option>';
      jobs.forEach((j) => {
        const opt = document.createElement('option');
        opt.value = j.id;
        opt.textContent = `${j.id} - ${j.service_type} (${j.status})`;
        jobSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load POS clients:', e);
  }
}

// ============================================================================
// POS MODULE SWITCHING STYLES
// ============================================================================

const posStyles = document.createElement('style');
posStyles.textContent = `
  .active-pos-mod {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.05)) !important;
    border: 1px solid rgba(16, 185, 129, 0.2) !important;
  }
  .active-pos-mod .pos-mod-label {
    color: #34d399 !important;
  }
  .pos-mod-btn {
    border: 1px solid transparent;
  }
  .pos-catalog-card:hover {
    border-color: rgba(255, 255, 255, 0.12) !important;
    transform: translateY(-1px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
  .pos-catalog-card:active {
    transform: translateY(0);
  }
`;
document.head.appendChild(posStyles);

// ============================================================================
// CLIENT MANAGEMENT FUNCTIONS
// ============================================================================

let clientsData = [];
let currentClientTab = 'clients';

function switchClientTab(tab) {
  currentClientTab = tab;

  // Update tab buttons
  document.querySelectorAll('.client-tab').forEach(btn => {
    btn.classList.remove('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    btn.classList.add('text-slate-400', 'border-transparent');
  });
  const activeBtn = document.getElementById(`client-tab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    activeBtn.classList.remove('text-slate-400', 'border-transparent');
  }

  // Show/hide panels
  document.getElementById('clients-panel').classList.toggle('hidden', tab !== 'clients');
  document.getElementById('distributors-panel').classList.toggle('hidden', tab !== 'distributors');
}

async function loadClients() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await res.json();
    clientsData = lookups.clients || [];
    updateClientKPIs();
    filterClients();
  } catch (e) {
    console.error('Failed to load clients:', e);
  }
}

function updateClientKPIs() {
  const total = clientsData.length;
  const activeAMC = clientsData.filter(c => c.amc_status === 'Active').length;
  const expiredAMC = clientsData.filter(c => c.amc_status === 'Expired').length;

  document.getElementById('stat-total-clients').textContent = total;
  document.getElementById('stat-active-amc').textContent = activeAMC;
  document.getElementById('stat-expired-amc').textContent = expiredAMC;
}

function filterClients() {
  const search = (document.getElementById('client-search-input')?.value || '').toLowerCase();
  const amcFilter = document.getElementById('client-amc-filter')?.value || 'All';

  const filtered = clientsData.filter(c => {
    const matchSearch = !search ||
      (c.company_name || '').toLowerCase().includes(search) ||
      (c.contact_person || '').toLowerCase().includes(search) ||
      (c.phone || '').toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search);
    const matchAMC = amcFilter === 'All' || c.amc_status === amcFilter;
    return matchSearch && matchAMC;
  });

  renderClientsGrid(filtered);
}

function renderClientsGrid(clients) {
  const grid = document.getElementById('clients-panel');
  if (!grid) return;

  if (clients.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">👥</div>
        <p class="text-sm">No clients found</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = clients.map(c => {
    let statusClass = 'bg-slate-500/20 text-slate-400';
    let statusLabel = c.amc_status || 'Unknown';
    if (c.amc_status === 'Active') { statusClass = 'bg-emerald-500/20 text-emerald-400'; }
    else if (c.amc_status === 'Expired') { statusClass = 'bg-rose-500/20 text-rose-400'; }
    else if (c.amc_status === 'No AMC') { statusClass = 'bg-amber-500/20 text-amber-400'; }
    else if (c.amc_status === 'Individual') { statusClass = 'bg-indigo-500/20 text-indigo-400'; }

    const initials = (c.company_name || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    return `
      <div class="glass-panel rounded-xl p-4 hover:border-white/10 transition-all group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 font-bold text-sm border border-amber-500/20">
              ${initials}
            </div>
            <div>
              <div class="text-sm font-bold text-white group-hover:text-amber-400 transition truncate max-w-[180px]">${escapeHTML(c.company_name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHTML(c.contact_person || 'No contact')}</div>
            </div>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${statusClass}">${statusLabel}</span>
        </div>
        <div class="space-y-2 text-[10px]">
          ${c.phone ? `<div class="flex items-center gap-2 text-slate-400"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${escapeHTML(c.phone)}</div>` : ''}
          ${c.address ? `<div class="flex items-start gap-2 text-slate-400"><svg class="w-3 h-3 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span class="truncate">${escapeHTML(c.address)}</span></div>` : ''}
          ${c.amc_end ? `<div class="flex items-center gap-2 text-slate-400"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/></svg>AMC: ${escapeHTML(c.amc_end)}</div>` : ''}
        </div>
        <div class="mt-3 pt-3 border-t border-white/5 flex gap-2">
          <button onclick="viewClientJobs('${c.id}')" class="flex-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold py-1.5 rounded-lg transition">View Jobs</button>
          <button onclick="editClient('${c.id}')" class="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-[10px] text-amber-400 font-bold py-1.5 rounded-lg transition">Edit</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddClientModal() {
  document.getElementById('modal-add-client').classList.remove('hidden');
}

function closeAddClientModal() {
  document.getElementById('modal-add-client').classList.add('hidden');
}

async function submitAddClient(event) {
  event.preventDefault();
  const form = event.target;
  const data = {
    company_name: form.company_name.value,
    contact_person: form.contact_person.value,
    phone: form.phone.value,
    address: form.address.value,
    amc_status: form.amc_status.value,
    amc_end: form.amc_end.value,
  };

  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      showToast('Client added successfully', 'success');
      closeAddClientModal();
      form.reset();
      loadClients();
    } else {
      showToast('Failed to add client', 'error');
    }
  } catch (e) {
    console.error('Failed to add client:', e);
    showToast('Error adding client', 'error');
  }
}

function viewClientJobs(clientId) {
  switchTab('tickets');
  setTimeout(() => {
    const searchInput = document.getElementById('job-search-input');
    if (searchInput) {
      searchInput.value = clientId;
      filterJobs();
    }
  }, 500);
}

function editClient(clientId) {
  showToast('Edit client feature - click to modify details', 'info');
}

function loadDistributors() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  fetch(`${baseUrl}/api/admin/lookups`)
    .then(res => res.json())
    .then(lookups => {
      const tbody = document.getElementById('distributors-list-body');
      if (!tbody) return;

      const distributors = lookups.distributors || [];
      document.getElementById('stat-distributors').textContent = distributors.length;

      if (distributors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-500">No distributors found</td></tr>';
        return;
      }

      tbody.innerHTML = distributors.map(d => `
        <tr class="hover:bg-white/5 transition-all">
          <td class="p-4">
            <div class="font-bold text-white">${escapeHTML(d.name || 'N/A')}</div>
          </td>
          <td class="p-4 text-slate-300">${escapeHTML(d.contact_person || 'N/A')}</td>
          <td class="p-4 text-slate-300">${escapeHTML(d.phone || 'N/A')}</td>
          <td class="p-4 text-slate-300">${escapeHTML(d.email || 'N/A')}</td>
          <td class="p-4">
            <span class="text-[10px] text-slate-400 bg-black/30 px-2 py-1 rounded">${escapeHTML(d.product_lines || 'N/A')}</span>
          </td>
          <td class="p-4 text-right">
            <button class="text-xs text-amber-400 hover:text-amber-300">Edit</button>
          </td>
        </tr>
      `).join('');
    })
    .catch(e => console.error('Failed to load distributors:', e));
}

// Initialize clients on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    loadClients();
    loadDistributors();
  }, 2000);
});

// Initialize POS on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    loadPOSProducts();
    loadPOSClients();
  }, 1000);
});

// ============================================================================
// BARCODE SCANNER FUNCTIONS
// ============================================================================

let barcodeStream = null;
let barcodeScannerMode = 'inventory'; // 'inventory' or 'pos'

function openBarcodeScanner(mode = 'inventory') {
  barcodeScannerMode = mode;
  document.getElementById('barcode-scanner-modal').classList.remove('hidden');
  document.getElementById('barcode-result').classList.add('hidden');
  document.getElementById('barcode-manual-input').value = '';
  document.getElementById('barcode-manual-input').focus();
}

function closeBarcodeScanner() {
  stopCameraScan();
  document.getElementById('barcode-scanner-modal').classList.add('hidden');
}

async function startCameraScan() {
  try {
    const video = document.getElementById('barcode-video');
    barcodeStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = barcodeStream;
    showToast('Camera started. Point at barcode.', 'info');
  } catch (e) {
    console.error('Camera error:', e);
    showToast('Camera access denied. Use manual input.', 'error');
  }
}

function stopCameraScan() {
  if (barcodeStream) {
    barcodeStream.getTracks().forEach(track => track.stop());
    barcodeStream = null;
    const video = document.getElementById('barcode-video');
    if (video) video.srcObject = null;
  }
}

function submitBarcode() {
  const code = document.getElementById('barcode-manual-input').value.trim();
  if (!code) {
    showToast('Please enter a barcode', 'warning');
    return;
  }
  handleBarcodeResult(code);
}

function handleBarcodeResult(code) {
  const resultDiv = document.getElementById('barcode-result');
  resultDiv.classList.remove('hidden');

  // Search for product in inventory
  const baseUrl = document.getElementById('api-base')?.value || '';
  fetch(`${baseUrl}/api/admin/lookups`)
    .then(res => res.json())
    .then(lookups => {
      const stock = lookups.inventory_stock || [];
      const item = stock.find(s => s.item_code === code || s.item_code.toLowerCase() === code.toLowerCase());

      if (item) {
        resultDiv.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold text-white">${escapeHTML(item.item_name)}</div>
              <div class="text-[10px] text-slate-400">${escapeHTML(item.item_code)} | ${escapeHTML(item.category)}</div>
            </div>
            <div class="text-right">
              <div class="text-sm font-bold text-emerald-400">$${(item.unit_price || 0).toFixed(2)}</div>
              <div class="text-[10px] ${item.stock_qty > 0 ? 'text-emerald-400' : 'text-rose-400'}">${item.stock_qty || 0} in stock</div>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button onclick="quickRestock('${escapeHTML(item.item_code)}')" class="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold py-2 rounded-lg hover:bg-amber-500/30 transition">Quick Restock</button>
            <button onclick="addToPOSFromScanner('${escapeHTML(item.item_code)}')" class="flex-1 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-2 rounded-lg hover:bg-emerald-500/30 transition">Add to POS</button>
          </div>
        `;
        showToast(`Found: ${item.item_name}`, 'success');
      } else {
        resultDiv.innerHTML = `
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <svg class="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div class="flex-1">
              <div class="text-xs font-bold text-amber-400">Item Not Found</div>
              <div class="text-[10px] text-slate-400">Code: ${code}</div>
            </div>
          </div>
          <div class="mt-3">
            <button onclick="addNewItemFromBarcode('${code}')" class="w-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold py-2 rounded-lg hover:bg-emerald-500/30 transition">Add as New Item</button>
          </div>
        `;
        showToast('Item not found. Add as new?', 'warning');
      }
    })
    .catch(e => {
      console.error('Lookup failed:', e);
      showToast('Failed to lookup item', 'error');
    });
}

function quickRestock(code) {
  closeBarcodeScanner();
  setInvTab('restock');
  document.getElementById('restock-code').value = code;
  document.getElementById('restock-qty').focus();
  showToast(`Ready to restock ${code}`, 'info');
}

function addToPOSFromScanner(code) {
  closeBarcodeScanner();
  switchTab('pos');
  setTimeout(() => {
    addPOSProduct(code);
    showToast(`Added ${code} to POS cart`, 'success');
  }, 500);
}

function addNewItemFromBarcode(code) {
  closeBarcodeScanner();
  switchTab('inventory');
  setInvTab('add');
  document.getElementById('new-item-code').value = code;
  document.getElementById('new-item-name').focus();
  showToast(`Enter details for ${code}`, 'info');
}

function scanForNewItem() {
  openBarcodeScanner('inventory');
  window._barcodeCallback = (code) => {
    document.getElementById('new-item-code').value = code;
    closeBarcodeScanner();
  };
}

function scanForRestock() {
  openBarcodeScanner('inventory');
  window._barcodeCallback = (code) => {
    document.getElementById('restock-code').value = code;
    closeBarcodeScanner();
    // Preview item
    previewRestockItem(code);
  };
}

function openBarcodeScannerForLookup() {
  openBarcodeScanner('inventory');
  window._barcodeCallback = (code) => {
    document.getElementById('inv-lookup-input').value = code;
    closeBarcodeScanner();
    lookupInventoryItem();
  };
}

function previewRestockItem(code) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  fetch(`${baseUrl}/api/admin/lookups`)
    .then(res => res.json())
    .then(lookups => {
      const item = (lookups.inventory_stock || []).find(s => s.item_code === code);
      const preview = document.getElementById('restock-item-preview');
      if (item) {
        preview.classList.remove('hidden');
        document.getElementById('restock-item-name').textContent = item.item_name;
        document.getElementById('restock-item-stock').textContent = `Current stock: ${item.stock_qty || 0} units`;
      } else {
        preview.classList.add('hidden');
      }
    });
}

// ============================================================================
// INVENTORY MANAGEMENT FUNCTIONS
// ============================================================================

let inventoryData = [];
let inventoryPage = 1;
const inventoryPerPage = 20;

function setInvTab(tab) {
  document.querySelectorAll('.inv-tab').forEach(t => {
    t.classList.remove('text-white', 'border-amber-500', 'bg-amber-500/5');
    t.classList.add('text-slate-400', 'border-transparent');
  });
  const activeTab = document.getElementById(`inv-tab-${tab}`);
  if (activeTab) {
    activeTab.classList.add('text-white', 'border-amber-500', 'bg-amber-500/5');
    activeTab.classList.remove('text-slate-400', 'border-transparent');
  }

  document.getElementById('inv-form-add').classList.add('hidden');
  document.getElementById('inv-form-restock').classList.add('hidden');
  document.getElementById('inv-form-search').classList.add('hidden');

  document.getElementById(`inv-form-${tab}`).classList.remove('hidden');
}

async function loadInventory() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await res.json();
    inventoryData = lookups.inventory_stock || [];
    updateInventoryKPIs();
    filterInventory();
  } catch (e) {
    console.error('Failed to load inventory:', e);
  }
}

function updateInventoryKPIs() {
  const total = inventoryData.length;
  const inStock = inventoryData.filter(i => (i.stock_qty || 0) > 5).length;
  const lowStock = inventoryData.filter(i => (i.stock_qty || 0) > 0 && (i.stock_qty || 0) <= 5).length;
  const totalQty = inventoryData.reduce((sum, i) => sum + (i.stock_qty || 0), 0);
  const totalValue = inventoryData.reduce((sum, i) => sum + (i.stock_qty || 0) * (i.unit_price || 0), 0);

  document.getElementById('inv-total-items').textContent = total;
  document.getElementById('inv-in-stock').textContent = inStock;
  document.getElementById('inv-low-stock').textContent = lowStock;
  document.getElementById('inv-total-qty').textContent = totalQty.toLocaleString();
  document.getElementById('inv-total-value').textContent = `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function filterInventory() {
  const search = (document.getElementById('inv-search')?.value || '').toLowerCase();
  const category = document.getElementById('inv-category-filter')?.value || 'All';
  const stockFilter = document.getElementById('inv-stock-filter')?.value || 'All';

  const filtered = inventoryData.filter(item => {
    const matchSearch = !search ||
      (item.item_code || '').toLowerCase().includes(search) ||
      (item.item_name || '').toLowerCase().includes(search) ||
      (item.category || '').toLowerCase().includes(search);
    const matchCategory = category === 'All' || item.category === category;
    const qty = item.stock_qty || 0;
    let matchStock = true;
    if (stockFilter === 'in-stock') matchStock = qty > 5;
    else if (stockFilter === 'low-stock') matchStock = qty > 0 && qty <= 5;
    else if (stockFilter === 'out-of-stock') matchStock = qty === 0;

    return matchSearch && matchCategory && matchStock;
  });

  renderInventoryGrid(filtered);
}

function renderInventoryGrid(items) {
  const grid = document.getElementById('inv-product-grid');
  if (!grid) return;

  const start = (inventoryPage - 1) * inventoryPerPage;
  const paged = items.slice(start, start + inventoryPerPage);

  document.getElementById('inv-result-count').textContent = `${items.length} items`;
  document.getElementById('stock-page-indicator').textContent = `Page ${inventoryPage} of ${Math.ceil(items.length / inventoryPerPage) || 1}`;

  if (paged.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">📦</div>
        <p class="text-sm">No items found</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = paged.map(item => {
    const qty = item.stock_qty || 0;
    const value = qty * (item.unit_price || 0);
    let stockClass = 'bg-emerald-500/10 text-emerald-400';
    let stockLabel = 'In Stock';
    if (qty === 0) { stockClass = 'bg-rose-500/10 text-rose-400'; stockLabel = 'Out of Stock'; }
    else if (qty <= 5) { stockClass = 'bg-amber-500/10 text-amber-400'; stockLabel = 'Low Stock'; }

    return `
      <div class="bg-black/30 border border-white/5 rounded-xl p-3 hover:border-white/10 transition-all group cursor-pointer" onclick="selectInventoryItem('${item.item_code}')">
        <div class="flex items-start justify-between mb-2">
          <span class="text-[9px] font-mono text-slate-500 bg-black/40 px-1.5 py-0.5 rounded">${item.item_code}</span>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${stockClass}">${qty}</span>
        </div>
        <div class="text-[11px] font-semibold text-white leading-tight line-clamp-2 mb-2 min-h-[30px]">${item.item_name}</div>
        <div class="flex items-center justify-between">
          <span class="text-[9px] text-slate-500">${item.category}</span>
          <span class="text-[10px] font-bold text-emerald-400">$${(item.unit_price || 0).toFixed(2)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function selectInventoryItem(code) {
  const item = inventoryData.find(i => i.item_code === code);
  if (!item) return;

  setInvTab('restock');
  document.getElementById('restock-code').value = code;
  previewRestockItem(code);
  showToast(`Selected: ${item.item_name}`, 'info');
}

function changeStockPage(delta) {
  inventoryPage = Math.max(1, inventoryPage + delta);
  filterInventory();
}

function lookupInventoryItem() {
  const query = (document.getElementById('inv-lookup-input')?.value || '').toLowerCase();
  const resultDiv = document.getElementById('inv-lookup-result');

  if (!query) {
    resultDiv.classList.add('hidden');
    return;
  }

  const item = inventoryData.find(i =>
    i.item_code.toLowerCase().includes(query) ||
    (i.item_name || '').toLowerCase().includes(query)
  );

  if (item) {
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
      <div class="bg-black/30 rounded-lg p-4 border border-white/5">
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="text-xs font-bold text-white">${item.item_name}</div>
            <div class="text-[10px] text-slate-400 font-mono">${item.item_code}</div>
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold ${(item.stock_qty || 0) > 5 ? 'bg-emerald-500/20 text-emerald-400' : (item.stock_qty || 0) > 0 ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}">${item.stock_qty || 0} in stock</span>
        </div>
        <div class="grid grid-cols-2 gap-2 text-[10px]">
          <div class="bg-black/20 rounded p-2"><span class="text-slate-500">Category:</span> <span class="text-white">${item.category}</span></div>
          <div class="bg-black/20 rounded p-2"><span class="text-slate-500">Price:</span> <span class="text-emerald-400">$${(item.unit_price || 0).toFixed(2)}</span></div>
          <div class="bg-black/20 rounded p-2"><span class="text-slate-500">Value:</span> <span class="text-white">$${((item.stock_qty || 0) * (item.unit_price || 0)).toFixed(2)}</span></div>
          <div class="bg-black/20 rounded p-2"><span class="text-slate-500">Batch:</span> <span class="text-white">${item.batch_code || 'N/A'}</span></div>
        </div>
        <div class="mt-3 flex gap-2">
          <button onclick="quickRestock('${item.item_code}')" class="flex-1 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold py-2 rounded-lg hover:bg-amber-500/30 transition">Restock</button>
          <button onclick="deleteInventoryItem('${item.item_code}')" class="bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[10px] font-bold py-2 px-3 rounded-lg hover:bg-rose-500/30 transition">Delete</button>
        </div>
      </div>
    `;
  } else {
    resultDiv.classList.remove('hidden');
    resultDiv.innerHTML = `
      <div class="bg-black/30 rounded-lg p-4 border border-white/5 text-center">
        <div class="text-amber-400 text-xs font-bold">Item not found</div>
        <div class="text-[10px] text-slate-400 mt-1">Try a different search term or scan a barcode</div>
      </div>
    `;
  }
}

function exportInventoryExcel() {
  // Trigger Excel export from reports
  switchTab('reports');
  setTimeout(() => exportAllReports(), 500);
}

function importInventoryExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  showToast('Import feature requires Excel parsing library. Use POS or Reports export.', 'info');
  event.target.value = '';
}

function deleteInventoryItem(code) {
  if (!confirm(`Delete item ${code}?`)) return;
  showToast(`Delete ${code} - Feature requires API endpoint`, 'warning');
}

// Initialize inventory on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadInventory, 1500);
});

// ============================================================================
// REPORT EXPORT FUNCTIONS
// ============================================================================

let currentReportStyle = 'professional';

const reportStyles = {
  professional: {
    primary: '1F4E79',
    secondary: '2E75B6',
    accent: 'FFC000',
    headerBg: '1F4E79',
    headerFont: 'FFFFFF',
    altRow: 'D6E4F0',
  },
  modern: {
    primary: '2E7D32',
    secondary: '4CAF50',
    accent: '81C784',
    headerBg: '2E7D32',
    headerFont: 'FFFFFF',
    altRow: 'E8F5E9',
  },
  corporate: {
    primary: '424242',
    secondary: '757575',
    accent: '9E9E9E',
    headerBg: '424242',
    headerFont: 'FFFFFF',
    altRow: 'F5F5F5',
  },
  warm: {
    primary: 'E65100',
    secondary: 'FF9800',
    accent: 'FFB74D',
    headerBg: 'E65100',
    headerFont: 'FFFFFF',
    altRow: 'FFF3E0',
  },
};

function setReportStyle(style, event) {
  currentReportStyle = style;
  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.classList.remove('ring-2', 'ring-white');
  });
  if (event && event.target) {
    event.target.classList.add('ring-2', 'ring-white');
  }
}

function selectAllReports() {
  document.querySelectorAll('.report-checkbox').forEach((cb) => (cb.checked = true));
}

function deselectAllReports() {
  document.querySelectorAll('.report-checkbox').forEach((cb) => (cb.checked = false));
}

function openReportCustomizer() {
  document.getElementById('report-customizer-modal').classList.remove('hidden');
}

function closeReportCustomizer() {
  document.getElementById('report-customizer-modal').classList.add('hidden');
}

async function exportAllReports() {
  const baseUrl = document.getElementById('api-base').value;
  showExportLoading();

  try {
    const [jobsRes, lookupsRes, safeRes] = await Promise.all([
      fetch(`${baseUrl}/api/jobs`),
      fetch(`${baseUrl}/api/admin/lookups`),
      fetch(`${baseUrl}/api/admin/cash/safe`),
    ]);

    const jobs = await jobsRes.json();
    const lookups = await lookupsRes.json();
    const safe = await safeRes.json();

    const wb = generateExcelWorkbook(jobs, lookups, safe, reportStyles[currentReportStyle]);
    downloadWorkbook(wb, `KosAI_All_Reports_${getDateStr()}.xlsx`);
  } catch (e) {
    console.error('Export failed:', e);
    alert('Export failed: ' + e.message);
  } finally {
    hideExportLoading();
  }
}

async function exportCustomReports() {
  const selectedReports = Array.from(document.querySelectorAll('.report-checkbox:checked')).map(
    (cb) => cb.value
  );

  if (selectedReports.length === 0) {
    alert('Please select at least one report');
    return;
  }

  const baseUrl = document.getElementById('api-base').value;
  showExportLoading();
  closeReportCustomizer();

  try {
    const [jobsRes, lookupsRes, safeRes] = await Promise.all([
      fetch(`${baseUrl}/api/jobs`),
      fetch(`${baseUrl}/api/admin/lookups`),
      fetch(`${baseUrl}/api/admin/cash/safe`),
    ]);

    const jobs = await jobsRes.json();
    const lookups = await lookupsRes.json();
    const safe = await safeRes.json();

    const prefix = document.getElementById('export-filename').value || 'KosAI_Reports';
    const wb = generateExcelWorkbook(jobs, lookups, safe, reportStyles[currentReportStyle], selectedReports);
    downloadWorkbook(wb, `${prefix}_${getDateStr()}.xlsx`);
  } catch (e) {
    console.error('Export failed:', e);
    alert('Export failed: ' + e.message);
  } finally {
    hideExportLoading();
  }
}

function getDateStr() {
  return new Date().toISOString().split('T')[0];
}

function showExportLoading() {
  const overlay = document.createElement('div');
  overlay.id = 'export-loading';
  overlay.className = 'fixed inset-0 bg-black/70 z-50 flex items-center justify-center';
  overlay.innerHTML = `
    <div class="glass-panel p-8 rounded-2xl text-center">
      <div class="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-white font-bold">Generating Excel Report...</p>
      <p class="text-slate-400 text-sm mt-1">Please wait</p>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideExportLoading() {
  const el = document.getElementById('export-loading');
  if (el) el.remove();
}

// ============================================================================
// REPORT TAB SWITCHING & CSV EXPORT
// ============================================================================

let currentReportTab = 'overview';

function switchReportTab(tab) {
  currentReportTab = tab;

  // Update tab buttons
  document.querySelectorAll('.report-tab').forEach(btn => {
    btn.classList.remove('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    btn.classList.add('text-slate-400', 'border-transparent');
  });
  const activeBtn = document.getElementById(`report-tab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    activeBtn.classList.remove('text-slate-400', 'border-transparent');
  }

  // Show/hide panels
  ['overview', 'jobs', 'clients', 'inventory', 'financial', 'technicians'].forEach(p => {
    const panel = document.getElementById(`report-panel-${p}`);
    if (panel) panel.classList.toggle('hidden', p !== tab);
  });

  // Load data for the tab
  loadReportTabData(tab);
}

function loadReportTabData(tab) {
  const baseUrl = document.getElementById('api-base')?.value || '';

  Promise.all([
    fetch(`${baseUrl}/api/jobs`).then(r => r.json()),
    fetch(`${baseUrl}/api/admin/lookups`).then(r => r.json()),
    fetch(`${baseUrl}/api/admin/cash/safe`).then(r => r.json()),
  ]).then(([jobs, lookups, safe]) => {
    renderReportTabData(tab, jobs, lookups, safe);
  }).catch(err => console.error('Failed to load report data:', err));
}

function renderReportTabData(tab, jobs, lookups, safe) {
  switch (tab) {
    case 'jobs':
      renderJobsReport(jobs, lookups);
      break;
    case 'clients':
      renderClientsReport(jobs, lookups);
      break;
    case 'inventory':
      renderInventoryReport(lookups);
      break;
    case 'financial':
      renderFinancialReport(safe);
      break;
    case 'technicians':
      renderTechniciansReport(jobs, lookups);
      break;
  }
}

function renderJobsReport(jobs, lookups) {
  // Status breakdown
  const statusBody = document.getElementById('report-jobs-status-body');
  if (statusBody) {
    const statusCounts = {};
    jobs.forEach(j => { statusCounts[j.status] = (statusCounts[j.status] || 0) + 1; });
    const total = jobs.length;

    statusBody.innerHTML = Object.entries(statusCounts).map(([status, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      let statusClass = 'text-slate-400';
      if (status === 'Completed') statusClass = 'text-emerald-400';
      else if (status === 'Pending') statusClass = 'text-amber-400';
      else if (status === 'In Progress') statusClass = 'text-blue-400';

      return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold ${statusClass}">${status}</td><td class="py-2 text-right font-mono">${count}</td><td class="py-2 text-right text-slate-400">${pct}%</td></tr>`;
    }).join('');
  }

  // Type breakdown
  const typeBody = document.getElementById('report-jobs-type-body');
  if (typeBody) {
    const typeCounts = {};
    jobs.forEach(j => {
      if (!typeCounts[j.service_type]) typeCounts[j.service_type] = { total: 0, completed: 0 };
      typeCounts[j.service_type].total++;
      if (j.status === 'Completed') typeCounts[j.service_type].completed++;
    });

    typeBody.innerHTML = Object.entries(typeCounts).map(([type, data]) => {
      return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold text-white">${type}</td><td class="py-2 text-right font-mono">${data.total}</td><td class="py-2 text-right text-emerald-400">${data.completed}</td></tr>`;
    }).join('');
  }

  // Recent jobs
  renderRecentJobs(jobs, lookups);
}

function renderClientsReport(jobs, lookups) {
  const clients = lookups.clients || [];

  // AMC breakdown
  const amcBody = document.getElementById('report-amc-body');
  if (amcBody) {
    const amcCounts = {};
    clients.forEach(c => { amcCounts[c.amc_status] = (amcCounts[c.amc_status] || 0) + 1; });
    const total = clients.length;

    amcBody.innerHTML = Object.entries(amcCounts).map(([status, count]) => {
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      let statusClass = 'text-slate-400';
      if (status === 'Active') statusClass = 'text-emerald-400';
      else if (status === 'Expired') statusClass = 'text-rose-400';

      return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold ${statusClass}">${status}</td><td class="py-2 text-right font-mono">${count}</td><td class="py-2 text-right text-slate-400">${pct}%</td></tr>`;
    }).join('');
  }

  // Client jobs summary
  const clientJobsBody = document.getElementById('report-client-jobs-body');
  if (clientJobsBody) {
    const clientJobs = {};
    clients.forEach(c => { clientJobs[c.company_name] = { total: 0, completed: 0 }; });
    jobs.forEach(j => {
      const client = clients.find(c => c.id === j.client_id);
      if (client && clientJobs[client.company_name]) {
        clientJobs[client.company_name].total++;
        if (j.status === 'Completed') clientJobs[client.company_name].completed++;
      }
    });

    clientJobsBody.innerHTML = Object.entries(clientJobs)
      .filter(([, data]) => data.total > 0)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([name, data]) => {
        return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold text-white truncate max-w-[150px]">${name}</td><td class="py-2 text-right font-mono">${data.total}</td><td class="py-2 text-right text-emerald-400">${data.completed}</td></tr>`;
      }).join('');
  }
}

function renderInventoryReport(lookups) {
  const stock = lookups.inventory_stock || [];

  // Category breakdown
  const catBody = document.getElementById('report-inventory-cat-body');
  if (catBody) {
    const catData = {};
    stock.forEach(s => {
      if (!catData[s.category]) catData[s.category] = { items: 0, qty: 0, value: 0 };
      catData[s.category].items++;
      catData[s.category].qty += s.stock_qty || 0;
      catData[s.category].value += (s.stock_qty || 0) * (s.unit_price || 0);
    });

    catBody.innerHTML = Object.entries(catData)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([cat, data]) => {
        return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold text-white">${cat}</td><td class="py-2 text-right font-mono">${data.items}</td><td class="py-2 text-right font-mono">${data.qty}</td><td class="py-2 text-right text-emerald-400 font-mono">$${data.value.toFixed(2)}</td></tr>`;
      }).join('');
  }

  // Low stock items
  const lowStockBody = document.getElementById('report-low-stock-body');
  if (lowStockBody) {
    const lowStock = stock.filter(s => (s.stock_qty || 0) <= 5).sort((a, b) => (a.stock_qty || 0) - (b.stock_qty || 0));

    lowStockBody.innerHTML = lowStock.slice(0, 15).map(s => {
      const statusClass = s.stock_qty === 0 ? 'text-rose-400' : 'text-amber-400';
      const statusText = s.stock_qty === 0 ? 'OUT' : 'LOW';
      return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold text-white truncate max-w-[150px]">${s.item_name}</td><td class="py-2 font-mono text-slate-400">${s.item_code}</td><td class="py-2 text-right font-mono">${s.stock_qty || 0}</td><td class="py-2 text-right font-bold ${statusClass}">${statusText}</td></tr>`;
    }).join('');
  }
}

function renderFinancialReport(safe) {
  const safeBody = document.getElementById('report-cash-safe-body');
  if (safeBody) {
    safeBody.innerHTML = `
      <tr class="hover:bg-white/5"><td class="py-2 font-semibold text-amber-400">USD</td><td class="py-2 text-right font-mono font-bold">$${(safe.usd_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
      <tr class="hover:bg-white/5"><td class="py-2 font-semibold text-indigo-400">MMK</td><td class="py-2 text-right font-mono font-bold">${(safe.mmk_balance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} Ks</td></tr>
      <tr class="hover:bg-white/5 bg-white/5"><td class="py-2 font-bold text-white">Total (USD)</td><td class="py-2 text-right font-mono font-bold text-emerald-400">$${((safe.usd_balance || 0) + (safe.mmk_balance || 0) / 2100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>
    `;
  }

  // Recent transactions
  const transBody = document.getElementById('report-transactions-body');
  if (transBody) {
    const baseUrl = document.getElementById('api-base')?.value || '';
    fetch(`${baseUrl}/api/admin/cash/transactions`)
      .then(res => res.json())
      .then(transactions => {
        transBody.innerHTML = (transactions || []).slice(0, 10).map(t => {
          const typeClass = t.transaction_type === 'Deposit' ? 'text-emerald-400' : 'text-rose-400';
          return `<tr class="hover:bg-white/5"><td class="py-2 text-slate-400">${t.created_at ? new Date(t.created_at).toLocaleDateString() : 'N/A'}</td><td class="py-2 font-semibold ${typeClass}">${t.transaction_type}</td><td class="py-2 text-right font-mono">${t.primary_currency === 'USD' ? '$' : ''}${(t.amount || 0).toLocaleString()}</td><td class="py-2 text-slate-400 truncate max-w-[150px]">${t.notes || ''}</td></tr>`;
        }).join('');
      });
  }
}

function renderTechniciansReport(jobs, lookups) {
  const techsBody = document.getElementById('report-techs-body');
  if (!techsBody) return;

  const techData = {};
  (lookups.technicians || []).forEach(t => {
    techData[t.id] = { name: t.name, total: 0, completed: 0, inProgress: 0 };
  });

  jobs.forEach(j => {
    if (techData[j.technician_id]) {
      techData[j.technician_id].total++;
      if (j.status === 'Completed') techData[j.technician_id].completed++;
      if (j.status === 'In Progress') techData[j.technician_id].inProgress++;
    }
  });

  techsBody.innerHTML = Object.values(techData)
    .sort((a, b) => b.total - a.total)
    .map(t => {
      const rate = t.total > 0 ? Math.round((t.completed / t.total) * 100) : 0;
      let rateClass = 'text-slate-400';
      if (rate >= 80) rateClass = 'text-emerald-400';
      else if (rate >= 50) rateClass = 'text-amber-400';

      return `<tr class="hover:bg-white/5"><td class="py-2 font-semibold text-white">${t.name}</td><td class="py-2 text-center font-mono">${t.total}</td><td class="py-2 text-center text-emerald-400 font-mono">${t.completed}</td><td class="py-2 text-center text-blue-400 font-mono">${t.inProgress}</td><td class="py-2 text-right font-bold ${rateClass}">${rate}%</td></tr>`;
    }).join('');
}

function renderRecentJobs(jobs, lookups) {
  const tbody = document.getElementById('report-recent-jobs');
  if (!tbody) return;

  tbody.innerHTML = jobs.slice(0, 10).map(j => {
    const client = (lookups.clients || []).find(c => c.id === j.client_id);
    const tech = (lookups.technicians || []).find(t => t.id === j.technician_id);
    let statusClass = 'bg-slate-500/20 text-slate-400';
    if (j.status === 'Completed') statusClass = 'bg-emerald-500/20 text-emerald-400';
    else if (j.status === 'Pending') statusClass = 'bg-amber-500/20 text-amber-400';
    else if (j.status === 'In Progress') statusClass = 'bg-blue-500/20 text-blue-400';

    return `<tr class="hover:bg-white/5"><td class="py-2 font-mono text-amber-400">${j.id}</td><td class="py-2 text-white truncate max-w-[120px]">${client?.company_name || 'Unknown'}</td><td class="py-2 text-slate-300">${j.service_type}</td><td class="py-2 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${statusClass}">${j.status}</span></td><td class="py-2 text-slate-300">${tech?.name || 'Unassigned'}</td><td class="py-2 text-right text-slate-400 text-[10px]">${j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A'}</td></tr>`;
  }).join('');
}

function filterReportsByDate() {
  // Date filter functionality
  showToast('Date filter applied', 'info');
  populateReports();
}

function resetReportDates() {
  document.getElementById('report-date-from').value = '';
  document.getElementById('report-date-to').value = '';
  showToast('Date filter reset', 'info');
  populateReports();
}

function exportReportsCSV() {
  const baseUrl = document.getElementById('api-base')?.value || '';

  fetch(`${baseUrl}/api/jobs`)
    .then(res => res.json())
    .then(jobs => {
      fetch(`${baseUrl}/api/admin/lookups`)
        .then(res => res.json())
        .then(lookups => {
          // Generate CSV content
          let csv = 'Job ID,Client,Service Type,Status,Technician,Created Date\n';
          jobs.forEach(j => {
            const client = (lookups.clients || []).find(c => c.id === j.client_id);
            const tech = (lookups.technicians || []).find(t => t.id === j.technician_id);
            csv += `"${j.id}","${client?.company_name || ''}","${j.service_type}","${j.status}","${tech?.name || ''}","${j.created_at || ''}"\n`;
          });

          // Download CSV
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `KosAI_Jobs_Report_${getDateStr()}.csv`;
          link.click();
          URL.revokeObjectURL(link.href);
          showToast('CSV exported successfully', 'success');
        });
    });
}

function generateExcelWorkbook(jobs, lookups, safe, style, selectedReports = null) {
  // Simple client-side Excel generation using SheetJS-like approach
  // For full feature, we'll use a basic CSV-to-Excel approach
  const wb = {
    sheets: [],
    style: style,
  };

  const allReports = {
    // Inventory Reports
    inventory_summary: () => generateInventoryReport(lookups),
    inventory_category: () => generateInventoryCategoryReport(lookups),
    inventory_value: () => generateInventoryValueReport(lookups),
    low_stock: () => generateLowStockReport(lookups),
    batch_purchase: () => generateBatchPurchaseReport(lookups),

    // Client Reports
    client_summary: () => generateClientReport(lookups),
    amc_breakdown: () => generateAMCReport(lookups),
    client_revenue: () => generateClientRevenueReport(jobs, lookups),
    amc_expiry: () => generateClientAMCExpiryReport(lookups),

    // Service/Job Reports
    service_summary: () => generateServiceReport(jobs, lookups),
    services_by_type: () => generateServiceTypeReport(jobs),
    monthly_jobs: () => generateMonthlyJobReport(jobs),
    job_duration: () => generateJobDurationReport(jobs, lookups),
    service_timeline: () => generateServiceStatusTimelineReport(jobs),
    service_fees: () => generateServiceFeeReport(lookups),

    // Technician Reports
    technician_perf: () => generateTechnicianReport(jobs, lookups),
    technician_workload: () => generateTechnicianWorkloadReport(jobs, lookups),

    // Financial Reports
    cash_transactions: () => generateCashReport(safe),
    cash_safe: () => generateCashSafeReport(safe),

    // Warranty & Device Reports
    warranty_status: () => generateWarrantyReport(lookups),
    warranty_expiry: () => generateWarrantyExpiryReport(lookups),
    device_status: () => generateDeviceStatusReport(lookups),
    rma_tracking: () => generateRMAReport(lookups),
  };

  const reportsToGenerate = selectedReports || Object.keys(allReports);

  reportsToGenerate.forEach((key) => {
    if (allReports[key]) {
      wb.sheets.push(allReports[key]());
    }
  });

  return wb;
}

function generateInventoryReport(lookups) {
  const stock = lookups.inventory_stock || [];
  return {
    name: 'Inventory Summary',
    headers: ['Item Code', 'Item Name', 'Category', 'Qty', 'Price USD', 'Price MMK', 'Batch'],
    data: stock.map((s) => [
      s.item_code,
      s.item_name,
      s.category,
      s.stock_qty,
      s.unit_price,
      s.unit_price_mmk,
      s.batch_code,
    ]),
    summary: {
      'Total Items': stock.length,
      'Total Stock': stock.reduce((a, b) => a + (b.stock_qty || 0), 0),
    },
  };
}

function generateInventoryCategoryReport(lookups) {
  const stock = lookups.inventory_stock || [];
  const cats = {};
  stock.forEach((s) => {
    const cat = s.category || 'Unknown';
    if (!cats[cat]) cats[cat] = { count: 0, qty: 0, value: 0 };
    cats[cat].count++;
    cats[cat].qty += s.stock_qty || 0;
    cats[cat].value += (s.stock_qty || 0) * (s.unit_price || 0);
  });
  return {
    name: 'Inventory by Category',
    headers: ['Category', 'Item Count', 'Total Qty', 'Total Value USD'],
    data: Object.entries(cats).map(([cat, v]) => [cat, v.count, v.qty, v.value]),
    summary: { 'Total Categories': Object.keys(cats).length },
  };
}

function generateLowStockReport(lookups) {
  const stock = lookups.inventory_stock || [];
  const low = stock.filter((s) => (s.stock_qty || 0) <= 5);
  return {
    name: 'Low Stock Alert',
    headers: ['Item Code', 'Item Name', 'Category', 'Current Stock', 'Status'],
    data: low.map((s) => [
      s.item_code,
      s.item_name,
      s.category,
      s.stock_qty,
      s.stock_qty === 0 ? 'OUT OF STOCK' : 'LOW',
    ]),
    summary: { 'Total Low Stock': low.length },
  };
}

function generateClientReport(lookups) {
  const clients = lookups.clients || [];
  return {
    name: 'Client Summary',
    headers: ['Company', 'Contact', 'Phone', 'AMC Status', 'AMC Start', 'AMC End'],
    data: clients.map((c) => [
      c.company_name,
      c.contact_person,
      c.phone,
      c.amc_status,
      c.amc_start,
      c.amc_end,
    ]),
    summary: {
      'Total Clients': clients.length,
      'Active AMC': clients.filter((c) => c.amc_status === 'Active').length,
    },
  };
}

function generateAMCReport(lookups) {
  const clients = lookups.clients || [];
  const amc = {};
  clients.forEach((c) => {
    const status = c.amc_status || 'Unknown';
    amc[status] = (amc[status] || 0) + 1;
  });
  return {
    name: 'AMC Breakdown',
    headers: ['Status', 'Client Count'],
    data: Object.entries(amc).map(([status, count]) => [status, count]),
    summary: { 'Total Clients': clients.length },
  };
}

function generateServiceReport(jobs, lookups) {
  return {
    name: 'Service Records',
    headers: ['Job ID', 'Type', 'Status', 'Client', 'Technician', 'Created'],
    data: jobs.map((j) => {
      const client = (lookups.clients || []).find((c) => c.id === j.client_id);
      const tech = (lookups.technicians || []).find((t) => t.id === j.technician_id);
      return [
        j.id,
        j.service_type,
        j.status,
        client?.company_name || j.client_id,
        tech?.name || j.technician_id,
        j.created_at,
      ];
    }),
    summary: {
      'Total Jobs': jobs.length,
      'Completed': jobs.filter((j) => j.status === 'Completed').length,
      'Pending': jobs.filter((j) => j.status === 'Pending').length,
    },
  };
}

function generateServiceTypeReport(jobs) {
  const types = {};
  jobs.forEach((j) => {
    const type = j.service_type || 'Unknown';
    if (!types[type]) types[type] = { total: 0, completed: 0, pending: 0 };
    types[type].total++;
    if (j.status === 'Completed') types[type].completed++;
    if (j.status === 'Pending') types[type].pending++;
  });
  return {
    name: 'Services by Type',
    headers: ['Service Type', 'Total', 'Completed', 'Pending'],
    data: Object.entries(types).map(([type, v]) => [type, v.total, v.completed, v.pending]),
    summary: { 'Total Jobs': jobs.length },
  };
}

function generateTechnicianReport(jobs, lookups) {
  const techs = {};
  (lookups.technicians || []).forEach((t) => {
    techs[t.id] = { name: t.name, assigned: 0, completed: 0 };
  });
  jobs.forEach((j) => {
    if (techs[j.technician_id]) {
      techs[j.technician_id].assigned++;
      if (j.status === 'Completed') techs[j.technician_id].completed++;
    }
  });
  return {
    name: 'Technician Performance',
    headers: ['Technician', 'Assigned', 'Completed', 'Completion Rate'],
    data: Object.values(techs).map((t) => [
      t.name,
      t.assigned,
      t.completed,
      t.assigned > 0 ? `${Math.round((t.completed / t.assigned) * 100)}%` : '0%',
    ]),
    summary: { 'Total Technicians': Object.keys(techs).length },
  };
}

function generateCashReport(safe) {
  return {
    name: 'Cash Safe Summary',
    headers: ['Currency', 'Balance'],
    data: [
      ['USD', safe.usd_balance || 0],
      ['MMK', safe.mmk_balance || 0],
    ],
    summary: {},
  };
}

function generateCashSafeReport(safe) {
  return {
    name: 'Cash Safe Details',
    headers: ['Metric', 'Value'],
    data: [
      ['USD Balance', `$${(safe.usd_balance || 0).toLocaleString()}`],
      ['MMK Balance', `${(safe.mmk_balance || 0).toLocaleString()} Ks`],
      ['Est. Total USD', `$${((safe.usd_balance || 0) + (safe.mmk_balance || 0) / 3500).toFixed(2)}`],
    ],
    summary: {},
  };
}

function generateWarrantyReport(lookups) {
  const items = lookups.inventory_items || [];
  return {
    name: 'Warranty Status',
    headers: ['Serial Number', 'Device', 'Client', 'Status', 'Warranty Months'],
    data: items.map((i) => {
      const client = (lookups.clients || []).find((c) => c.id === i.client_id);
      return [i.serial_number, i.device_name, client?.company_name || i.client_id, i.status, i.warranty_months];
    }),
    summary: { 'Total Devices': items.length },
  };
}

function generateRMAReport(lookups) {
  const items = (lookups.inventory_items || []).filter((i) =>
    ['Defective', 'RMA Sent', 'RMA Completed', 'Replaced'].includes(i.status)
  );
  return {
    name: 'RMA Tracking',
    headers: ['Serial Number', 'Device', 'Status', 'RMA ID', 'Distributor'],
    data: items.map((i) => [i.serial_number, i.device_name, i.status, i.rma_tracking_id, i.distributor]),
    summary: { 'Total RMA': items.length },
  };
}

// ============================================================================
// ADDITIONAL REPORTS
// ============================================================================

function generateMonthlyJobReport(jobs) {
  const monthly = {};
  jobs.forEach((j) => {
    const date = j.created_at ? new Date(j.created_at) : null;
    if (!date) return;
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[month]) monthly[month] = { total: 0, completed: 0, pending: 0, in_progress: 0 };
    monthly[month].total++;
    if (j.status === 'Completed') monthly[month].completed++;
    if (j.status === 'Pending') monthly[month].pending++;
    if (j.status === 'In Progress') monthly[month].in_progress++;
  });
  return {
    name: 'Monthly Job Trend',
    headers: ['Month', 'Total Jobs', 'Completed', 'Pending', 'In Progress', 'Completion Rate'],
    data: Object.entries(monthly)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, v]) => [
        month,
        v.total,
        v.completed,
        v.pending,
        v.in_progress,
        v.total > 0 ? `${Math.round((v.completed / v.total) * 100)}%` : '0%',
      ]),
    summary: {
      'Total Months': Object.keys(monthly).length,
      'Total Jobs': jobs.length,
    },
  };
}

function generateClientRevenueReport(jobs, lookups) {
  const clients = {};
  jobs.forEach((j) => {
    const client = (lookups.clients || []).find((c) => c.id === j.client_id);
    const name = client?.company_name || j.client_id || 'Unknown';
    if (!clients[name]) clients[name] = { total: 0, completed: 0, pending: 0 };
    clients[name].total++;
    if (j.status === 'Completed') clients[name].completed++;
    if (j.status === 'Pending') clients[name].pending++;
  });
  return {
    name: 'Client-wise Job Summary',
    headers: ['Client', 'Total Jobs', 'Completed', 'Pending', 'Status'],
    data: Object.entries(clients)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, v]) => [name, v.total, v.completed, v.pending, v.pending > 0 ? 'Active' : 'Completed']),
    summary: {
      'Total Clients': Object.keys(clients).length,
      'Total Jobs': jobs.length,
    },
  };
}

function generateTechnicianWorkloadReport(jobs, lookups) {
  const techs = {};
  (lookups.technicians || []).forEach((t) => {
    techs[t.id] = { name: t.name, role: t.role, pending: 0, in_progress: 0, completed: 0, cancelled: 0 };
  });
  jobs.forEach((j) => {
    if (techs[j.technician_id]) {
      if (j.status === 'Pending') techs[j.technician_id].pending++;
      if (j.status === 'In Progress') techs[j.technician_id].in_progress++;
      if (j.status === 'Completed') techs[j.technician_id].completed++;
      if (j.status === 'Cancelled') techs[j.technician_id].cancelled++;
    }
  });
  return {
    name: 'Technician Workload',
    headers: ['Technician', 'Role', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Total'],
    data: Object.values(techs).map((t) => {
      const total = t.pending + t.in_progress + t.completed + t.cancelled;
      return [t.name, t.role, t.pending, t.in_progress, t.completed, t.cancelled, total];
    }),
    summary: {
      'Total Technicians': Object.keys(techs).length,
    },
  };
}

function generateInventoryValueReport(lookups) {
  const stock = lookups.inventory_stock || [];
  const categories = {};
  stock.forEach((s) => {
    const cat = s.category || 'Unknown';
    if (!categories[cat]) categories[cat] = { items: 0, qty: 0, value_usd: 0, value_mmk: 0 };
    categories[cat].items++;
    categories[cat].qty += s.stock_qty || 0;
    categories[cat].value_usd += (s.stock_qty || 0) * (s.unit_price || 0);
    categories[cat].value_mmk += (s.stock_qty || 0) * (s.unit_price_mmk || 0);
  });
  const sorted = Object.entries(categories).sort((a, b) => b[1].value_usd - a[1].value_usd);
  return {
    name: 'Inventory Value by Category',
    headers: ['Category', 'Items', 'Total Qty', 'Value USD', 'Value MMK', '% of Total'],
    data: sorted.map(([cat, v]) => {
      const totalVal = sorted.reduce((sum, [, cv]) => sum + cv.value_usd, 0);
      const pct = totalVal > 0 ? ((v.value_usd / totalVal) * 100).toFixed(1) : '0';
      return [cat, v.items, v.qty, v.value_usd, v.value_mmk, `${pct}%`];
    }),
    summary: {
      'Total Categories': sorted.length,
      'Total Value USD': sorted.reduce((sum, [, v]) => sum + v.value_usd, 0),
      'Total Value MMK': sorted.reduce((sum, [, v]) => sum + v.value_mmk, 0),
    },
  };
}

function generateServiceFeeReport(lookups) {
  const fees = lookups.service_fees || [];
  return {
    name: 'Service Fee Schedule',
    headers: ['Service Type', 'Fee Amount', 'Currency', 'Description'],
    data: fees.map((f) => [f.service_type, f.fee_amount, f.currency, f.description]),
    summary: {
      'Total Fee Types': fees.length,
    },
  };
}

function generateWarrantyExpiryReport(lookups) {
  const items = lookups.inventory_items || [];
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const expirySoon = [];

  items.forEach((i) => {
    if (!i.installed_date || !i.warranty_months) return;
    const installed = new Date(i.installed_date);
    const expiry = new Date(installed.getTime() + i.warranty_months * 30 * 24 * 60 * 60 * 1000);
    const daysUntilExpiry = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 30 && daysUntilExpiry >= -30) {
      const client = (lookups.clients || []).find((c) => c.id === i.client_id);
      expirySoon.push({
        serial: i.serial_number,
        device: i.device_name,
        client: client?.company_name || i.client_id,
        expiry: expiry.toISOString().split('T')[0],
        days: daysUntilExpiry,
        status: daysUntilExpiry < 0 ? 'EXPIRED' : daysUntilExpiry <= 7 ? 'CRITICAL' : 'WARNING',
      });
    }
  });

  return {
    name: 'Warranty Expiry Alert',
    headers: ['Serial Number', 'Device', 'Client', 'Expiry Date', 'Days Left', 'Status'],
    data: expirySoon.sort((a, b) => a.days - b.days).map((i) => [i.serial, i.device, i.client, i.expiry, i.days, i.status]),
    summary: {
      'Expiring Soon': expirySoon.filter((i) => i.days >= 0).length,
      'Already Expired': expirySoon.filter((i) => i.days < 0).length,
    },
  };
}

function generateClientAMCExpiryReport(lookups) {
  const clients = lookups.clients || [];
  const now = new Date();
  const expiring = [];

  clients.forEach((c) => {
    if (!c.amc_end) return;
    const endDate = new Date(c.amc_end);
    const daysUntilExpiry = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

    if (c.amc_status === 'Active' && daysUntilExpiry <= 60) {
      expiring.push({
        company: c.company_name,
        contact: c.contact_person,
        phone: c.phone,
        end: c.amc_end,
        days: daysUntilExpiry,
        status: daysUntilExpiry <= 0 ? 'EXPIRED' : daysUntilExpiry <= 14 ? 'CRITICAL' : 'WARNING',
      });
    }
  });

  return {
    name: 'AMC Expiry Alert',
    headers: ['Company', 'Contact', 'Phone', 'AMC End Date', 'Days Left', 'Status'],
    data: expiring.sort((a, b) => a.days - b.days).map((c) => [c.company, c.contact, c.phone, c.end, c.days, c.status]),
    summary: {
      'Expiring Soon': expiring.filter((i) => i.days >= 0).length,
      'Already Expired': expiring.filter((i) => i.days < 0).length,
    },
  };
}

function generateBatchPurchaseReport(lookups) {
  const batches = lookups.inventory_batches || [];
  const stock = lookups.inventory_stock || [];

  const batchData = {};
  batches.forEach((b) => {
    batchData[b.batch_code] = {
      supplier: b.supplier,
      buying_price: b.buying_price,
      created: b.created_at,
      items: 0,
      total_qty: 0,
    };
  });

  stock.forEach((s) => {
    if (s.batch_code && batchData[s.batch_code]) {
      batchData[s.batch_code].items++;
      batchData[s.batch_code].total_qty += s.stock_qty || 0;
    }
  });

  return {
    name: 'Batch Purchase Report',
    headers: ['Batch Code', 'Supplier', 'Buying Price', 'Items', 'Total Qty', 'Created'],
    data: Object.entries(batchData).map(([code, v]) => [
      code,
      v.supplier,
      v.buying_price,
      v.items,
      v.total_qty,
      v.created,
    ]),
    summary: {
      'Total Batches': Object.keys(batchData).length,
    },
  };
}

function generateJobDurationReport(jobs, lookups) {
  const completed = jobs.filter((j) => j.status === 'Completed' && j.arrival_time && j.completion_time);
  const durations = completed.map((j) => {
    const start = new Date(j.arrival_time);
    const end = new Date(j.completion_time);
    const hours = Math.round((end - start) / (1000 * 60 * 60) * 10) / 10;
    const client = (lookups.clients || []).find((c) => c.id === j.client_id);
    const tech = (lookups.technicians || []).find((t) => t.id === j.technician_id);
    return {
      job: j.id,
      type: j.service_type,
      client: client?.company_name || j.client_id,
      tech: tech?.name || j.technician_id,
      hours,
    };
  });

  return {
    name: 'Job Duration Analysis',
    headers: ['Job ID', 'Type', 'Client', 'Technician', 'Duration (Hours)'],
    data: durations.sort((a, b) => b.hours - a.hours).map((d) => [d.job, d.type, d.client, d.tech, d.hours]),
    summary: {
      'Total Jobs': durations.length,
      'Avg Duration (hrs)': durations.length > 0
        ? (durations.reduce((sum, d) => sum + d.hours, 0) / durations.length).toFixed(1)
        : 0,
      'Max Duration (hrs)': durations.length > 0 ? Math.max(...durations.map((d) => d.hours)) : 0,
    },
  };
}

function generateServiceStatusTimelineReport(jobs) {
  const statusCounts = { Pending: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
  const monthly = {};

  jobs.forEach((j) => {
    statusCounts[j.status] = (statusCounts[j.status] || 0) + 1;
    const date = j.created_at ? new Date(j.created_at) : null;
    if (!date) return;
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthly[month]) monthly[month] = {};
    monthly[month][j.status] = (monthly[month][j.status] || 0) + 1;
  });

  return {
    name: 'Service Status Timeline',
    headers: ['Month', 'Pending', 'In Progress', 'Completed', 'Cancelled', 'Total'],
    data: Object.entries(monthly)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, statuses]) => [
        month,
        statuses.Pending || 0,
        statuses['In Progress'] || 0,
        statuses.Completed || 0,
        statuses.Cancelled || 0,
        Object.values(statuses).reduce((a, b) => a + b, 0),
      ]),
    summary: {
      'Overall Pending': statusCounts.Pending,
      'Overall In Progress': statusCounts['In Progress'],
      'Overall Completed': statusCounts.Completed,
      'Overall Cancelled': statusCounts.Cancelled,
    },
  };
}

function generateDeviceStatusReport(lookups) {
  const items = lookups.inventory_items || [];
  const statusCounts = {};
  items.forEach((i) => {
    const status = i.status || 'Unknown';
    if (!statusCounts[status]) statusCounts[status] = { count: 0, devices: [] };
    statusCounts[status].count++;
    if (statusCounts[status].devices.length < 5) {
      statusCounts[status].devices.push(i.device_name);
    }
  });

  return {
    name: 'Device Status Overview',
    headers: ['Status', 'Count', 'Sample Devices'],
    data: Object.entries(statusCounts).map(([status, v]) => [
      status,
      v.count,
      v.devices.join(', ') + (v.count > 5 ? '...' : ''),
    ]),
    summary: {
      'Total Devices': items.length,
      'Active': statusCounts.Active?.count || 0,
      'Defective': statusCounts.Defective?.count || 0,
      'RMA Sent': statusCounts['RMA Sent']?.count || 0,
    },
  };
}

function downloadWorkbook(wb, filename) {
  // Use SheetJS for proper Excel generation
  if (typeof XLSX === 'undefined') {
    alert('Excel library not loaded. Please refresh the page.');
    return;
  }

  const newWorkbook = XLSX.utils.book_new();
  const style = wb.style || reportStyles.professional;

  wb.sheets.forEach((sheet) => {
    // Create worksheet data with headers
    const wsData = [sheet.headers, ...sheet.data];

    // Add summary if exists
    if (sheet.summary && Object.keys(sheet.summary).length > 0) {
      wsData.push([]); // Empty row
      wsData.push(['SUMMARY']);
      Object.entries(sheet.summary).forEach(([key, val]) => {
        wsData.push([key, val]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = sheet.headers.map((h, i) => ({
      wch: Math.max(h.length + 5, 15),
    }));
    ws['!cols'] = colWidths;

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(newWorkbook, ws, sheet.name.substring(0, 31));
  });

  // Generate and download
  XLSX.writeFile(newWorkbook, filename);
}

async function populateLookupDropdowns() {
  const baseUrl = document.getElementById('api-base').value;
  const techSelect = document.getElementById('lookup-tech');

  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    if (!res.ok) throw new Error('Could not capture dynamic dataset listings.');
    const data = await res.json();

    // Cache globally
    window.allClientsList = data.clients || [];

    // Populate corporate datalist (amc_status !== 'Individual')
    const corpDatalist = document.getElementById('corporate-clients-datalist');
    if (corpDatalist) {
      corpDatalist.innerHTML = '';
      window.allClientsList
        .filter((c) => c.amc_status !== 'Individual')
        .forEach((c) => {
          const opt = document.createElement('option');
          opt.value = `${c.company_name} [${c.id}]`;
          corpDatalist.appendChild(opt);
        });
    }

    // Populate individual datalist (amc_status === 'Individual')
    const indDatalist = document.getElementById('individual-clients-datalist');
    if (indDatalist) {
      indDatalist.innerHTML = '';
      window.allClientsList
        .filter((c) => c.amc_status === 'Individual')
        .forEach((c) => {
          const opt = document.createElement('option');
          opt.value = `${c.company_name} [${c.id}]`;
          indDatalist.appendChild(opt);
        });
    }

    techSelect.innerHTML = '';
    data.technicians.forEach((t) => {
      techSelect.innerHTML += `<option value="${escapeHTML(t.id)}" class="bg-slate-900">${escapeHTML(t.name)} [${escapeHTML(t.id)}]</option>`;
    });
  } catch (err) {
    console.error('Error populating lookups:', err);
  }
}

let activeCatalogList = [];
let activeBatchesList = [];

async function loadInventoryData() {
  const baseUrl = document.getElementById('api-base').value;
  const token = localStorage.getItem('admin_token');
  try {
    // 1. Fetch catalog
    const catRes = await fetch(`${baseUrl}/api/admin/inventory/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (catRes.ok) {
      activeCatalogList = await catRes.json();
    }

    // 2. Fetch batches
    const batRes = await fetch(`${baseUrl}/api/admin/inventory/batches`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (batRes.ok) {
      activeBatchesList = await batRes.json();
    }

    renderBatchesTable();
    renderSalesPricing();
  } catch (e) {
    console.error('Inventory fetch exception', e);
  }
}

window.switchInvModule = function (module) {
  const panels = ['batches', 'pricing', 'catalog', 'add-batch', 'add-model', 'update-price'];
  panels.forEach((p) => {
    const el = document.getElementById(`inv-panel-${p}`);
    if (el) el.classList.add('hidden');
  });
  const active = document.getElementById(`inv-panel-${module}`);
  if (active) active.classList.remove('hidden');
  const mainMods = ['batches', 'pricing', 'catalog'];
  mainMods.forEach((m) => {
    const btn = document.getElementById(`inv-mod-${m}`);
    if (btn) {
      if (m === module) {
        btn.classList.add('active-inv-mod');
        btn.classList.remove('text-slate-400', 'hover:text-white', 'hover:bg-white/5');
      } else {
        btn.classList.remove('active-inv-mod');
        btn.classList.add('text-slate-400', 'hover:text-white', 'hover:bg-white/5');
      }
    }
  });
};
window.setInventoryTab = window.switchInvModule;

function renderBatchesTable() {
  const tbody = document.getElementById('batches-stock-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (activeBatchesList.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-600 text-[11px]">No stock batches registered yet.</td></tr>';
    return;
  }
  activeBatchesList.forEach((b, idx) => {
    const totalUnits = b.serials ? b.serials.length : 0;
    const availableUnits = b.serials ? b.serials.filter((s) => s.status === 'Active').length : 0;
    const soldUnits = totalUnits - availableUnits;
    const importDate = b.created_at ? b.created_at.substring(0, 10) : '—';
    let serialsHtml = '';
    if (b.serials && b.serials.length > 0) {
      b.serials.forEach((s) => {
        if (s.status === 'Active') {
          serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center"><span class="font-mono text-slate-300 text-[10px] truncate">${s.serial_number}</span><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 shrink-0"></span></div>`;
        } else {
          const details = s.job_id ? `Job: ${s.job_id}` : 'SOLD';
          serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center opacity-40"><span class="font-mono text-slate-500 text-[10px] line-through truncate" title="${details}">${s.serial_number}</span><span class="text-[8px] text-amber-500 font-bold ml-1 shrink-0">SOLD</span></div>`;
        }
      });
    } else {
      serialsHtml =
        '<div class="col-span-4 text-slate-500 italic text-[10px]">No serials registered.</div>';
    }
    tbody.innerHTML += `
                    <tr class="clickable-row group cursor-pointer border-b border-white/5 hover:bg-white/5 transition-all align-middle"
                        onclick="document.getElementById('serials-row-${idx}').classList.toggle('hidden'); const a = this.querySelector('.expand-arrow'); if(a) a.style.transform = a.style.transform === 'rotate(90deg)' ? '' : 'rotate(90deg)';">
                        <td class="px-4 py-2.5"><span class="expand-arrow text-emerald-500 text-[11px] inline-block transition-transform duration-200">›</span></td>
                        <td class="px-4 py-2.5 font-mono text-[11px] font-semibold text-white">${b.batch_code}</td>
                        <td class="px-4 py-2.5 text-[11px] text-slate-300">${b.item_name || '—'}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${b.category || '—'}</td>
                        <td class="px-4 py-2.5 font-mono text-[11px] text-sky-400">$${parseFloat(b.buying_price || 0).toFixed(2)}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-400">${b.supplier || '—'}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] font-bold text-white">${totalUnits}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] font-bold text-emerald-400">${availableUnits}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] text-rose-400">${soldUnits > 0 ? soldUnits : '—'}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${importDate}</td>
                    </tr>
                    <tr id="serials-row-${idx}" class="hidden bg-black/30">
                        <td colspan="10" class="px-6 py-3">
                            <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Serial Numbers · ${b.batch_code}</p>
                            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">${serialsHtml}</div>
                        </td>
                    </tr>
                `;
  });
}

function renderSalesPricing() {
  const pricingBody = document.getElementById('sales-pricing-body');
  const catalogBody = document.getElementById('catalog-models-body');
  const batchSelect = document.getElementById('batch-item-code');
  const updateSelect = document.getElementById('price-update-item-code');
  const filterSelect = document.getElementById('batch-filter-model');
  const prevBatchVal = batchSelect ? batchSelect.value : '';
  const prevUpdateVal = updateSelect ? updateSelect.value : '';
  if (batchSelect) batchSelect.innerHTML = '<option value="">-- Choose Model --</option>';
  if (updateSelect) updateSelect.innerHTML = '<option value="">-- Choose Device --</option>';
  if (filterSelect) filterSelect.innerHTML = '<option value="">— All Models —</option>';
  if (pricingBody) pricingBody.innerHTML = '';
  if (catalogBody) catalogBody.innerHTML = '';
  if (activeCatalogList.length === 0) {
    if (pricingBody)
      pricingBody.innerHTML =
        '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
    if (catalogBody)
      catalogBody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
    return;
  }
  activeCatalogList.forEach((item) => {
    const opt = `<option value="${item.item_code}">${item.item_name} [${item.item_code}]</option>`;
    if (batchSelect) batchSelect.innerHTML += opt;
    if (updateSelect) updateSelect.innerHTML += opt;
    if (filterSelect)
      filterSelect.innerHTML += `<option value="${item.item_code}">${item.item_name}</option>`;
    const priceUSD = item.unit_price
      ? `$${parseFloat(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—';
    const priceMMK = item.unit_price_mmk
      ? `Ks ${parseInt(item.unit_price_mmk).toLocaleString()}`
      : '—';
    const usdColor = item.unit_price ? 'text-emerald-400' : 'text-slate-600';
    const mmkColor = item.unit_price_mmk ? 'text-amber-400' : 'text-slate-600';
    const inStock = activeBatchesList
      .filter((b) => b.item_code === item.item_code)
      .reduce(
        (sum, b) => sum + (b.serials ? b.serials.filter((s) => s.status === 'Active').length : 0),
        0
      );
    const stockColor =
      inStock > 5 ? 'text-emerald-400' : inStock > 0 ? 'text-amber-400' : 'text-rose-400';
    if (pricingBody)
      pricingBody.innerHTML += `<tr class="border-b border-white/5 hover:bg-white/5 transition-all text-[11px]"><td class="px-4 py-2.5 font-mono text-sky-400 font-semibold">${item.item_code}</td><td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td><td class="px-4 py-2.5 text-slate-400">${item.category || '—'}</td><td class="px-4 py-2.5 text-center font-mono font-bold ${stockColor}">${inStock}</td><td class="px-4 py-2.5 text-right font-mono font-bold ${usdColor}">${priceUSD}</td><td class="px-4 py-2.5 text-right font-mono font-bold ${mmkColor}">${priceMMK}</td><td class="px-4 py-2.5 text-center"><button onclick="window.switchInvModule('update-price'); setTimeout(() => { const s = document.getElementById('price-update-item-code'); if(s){ s.value='${item.item_code}'; window.populatePriceFields('${item.item_code}'); } }, 50);" class="px-2.5 py-1 text-[9px] font-bold text-sky-400 border border-sky-500/20 hover:bg-sky-500/10 rounded transition-all">Edit</button></td></tr>`;
    if (catalogBody)
      catalogBody.innerHTML += `<tr class="border-b border-white/5 hover:bg-white/5 transition-all text-[11px]"><td class="px-4 py-2.5 font-mono text-sky-400">${item.item_code}</td><td class="px-4 py-2.5 text-white">${item.item_name}</td><td class="px-4 py-2.5 text-slate-400">${item.category || '—'}</td><td class="px-4 py-2.5 text-center font-mono font-bold ${stockColor}">${inStock}</td><td class="px-4 py-2.5 text-right"><button class="text-[9px] text-rose-400 border border-rose-500/10 hover:bg-rose-500/5 px-2 py-0.5 rounded transition-all">Del</button></td></tr>`;
  });
  if (batchSelect && prevBatchVal) batchSelect.value = prevBatchVal;
  if (updateSelect && prevUpdateVal) updateSelect.value = prevUpdateVal;
}

window.filterBatchTable = function () {
  const q = (document.getElementById('batch-search-input')?.value || '').toLowerCase();
  document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach((row) => {
    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
};
window.filterBatchByModel = function (val) {
  document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach((row) => {
    if (!val) {
      row.style.display = '';
      return;
    }
    const match = activeBatchesList.some(
      (b) => b.item_code === val && row.textContent.includes(b.batch_code)
    );
    row.style.display = match ? '' : 'none';
  });
};

window.populatePriceFields = function (itemCode) {
  const item = activeCatalogList.find((c) => c.item_code === itemCode);
  const usdInput = document.getElementById('price-update-usd');
  const mmkInput = document.getElementById('price-update-mmk');

  if (item) {
    if (usdInput) usdInput.value = item.unit_price || 0;
    if (mmkInput) mmkInput.value = item.unit_price_mmk || 0;
  } else {
    if (usdInput) usdInput.value = '';
    if (mmkInput) mmkInput.value = '';
  }
};

window.submitNewBatch = async function (e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;

  const batch_code = document.getElementById('batch-code').value.trim().toUpperCase();
  const item_code = document.getElementById('batch-item-code').value;
  const buying_price = parseFloat(document.getElementById('batch-buying-price').value) || 0;
  const serialsRaw = document.getElementById('batch-serials').value;

  // Parse serial numbers
  const serials = serialsRaw
    .split(/[\n,;]/)
    .map((sn) => sn.trim())
    .filter((sn) => sn !== '');

  try {
    const res = await fetch(`${baseUrl}/api/admin/inventory/batches/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({ batch_code, item_code, buying_price, serials }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Batch created successfully.');
      e.target.reset();
      loadInventoryData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
};

window.submitPriceUpdate = async function (e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;

  const item_code = document.getElementById('price-update-item-code').value;
  const unit_price = parseFloat(document.getElementById('price-update-usd').value) || 0;
  const unit_price_mmk = parseInt(document.getElementById('price-update-mmk').value) || 0;

  try {
    const res = await fetch(`${baseUrl}/api/admin/inventory/catalog/price`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({ item_code, unit_price, unit_price_mmk }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Selling prices updated successfully.');
      e.target.reset();
      loadInventoryData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
};

window.submitNewCatalogItem = async function (e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;

  const item_name = document.getElementById('catalog-item-name').value.trim();
  const item_code = document.getElementById('catalog-item-code').value.trim().toUpperCase();
  const category = document.getElementById('catalog-item-category').value;

  try {
    const res = await fetch(`${baseUrl}/api/admin/inventory/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({
        item_code,
        item_name,
        category,
        stock_qty: 0,
        unit_price: 0,
        unit_price_mmk: 0,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      alert(data.message || 'Catalog model provisioned successfully.');
      e.target.reset();
      loadInventoryData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
};

// deleteInventoryItem is defined earlier in the file

function openRegisterWarrantyModal() {
  document.getElementById('modal-register-warranty').classList.remove('hidden');
  const baseUrl = document.getElementById('api-base').value;
  fetch(`${baseUrl}/api/admin/lookups`)
    .then((res) => res.json())
    .then((data) => {
      const sel = document.getElementById('modal-warranty-client');
      sel.innerHTML = '';
      data.clients.forEach((c) => {
        sel.innerHTML += `<option value="${escapeHTML(c.id)}" class="bg-slate-900">${escapeHTML(c.company_name)} [${escapeHTML(c.id)}]</option>`;
      });
    })
    .catch(console.error);
}

function closeRegisterWarrantyModal() {
  document.getElementById('modal-register-warranty').classList.add('hidden');
}

function openRaiseRMAModal() {
  document.getElementById('modal-raise-rma').classList.remove('hidden');
  const baseUrl = document.getElementById('api-base').value;
  fetch(`${baseUrl}/api/admin/warranty/list`)
    .then((res) => res.json())
    .then((warranties) => {
      const sel = document.getElementById('modal-rma-serial');
      sel.innerHTML = '';
      if (warranties.length === 0) {
        sel.innerHTML = '<option value="">(No active product warranties registered)</option>';
        return;
      }
      warranties.forEach((w) => {
        sel.innerHTML += `<option value="${w.serial_number}" class="bg-slate-900">${w.serial_number} - ${w.device_name}</option>`;
      });
    })
    .catch(console.error);
}

function closeRaiseRMAModal() {
  document.getElementById('modal-raise-rma').classList.add('hidden');
}

async function submitRegisterWarranty(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const form = e.target;
  const payload = {
    serial_number: form.serial_number.value.trim(),
    device_name: form.device_name.value.trim(),
    client_id: parseInt(form.client_id.value),
    installed_date: form.installed_date.value,
    warranty_months: parseInt(form.warranty_months.value),
  };

  try {
    const res = await fetch(`${baseUrl}/api/admin/warranty/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Customer product warranty registered!');
      closeRegisterWarrantyModal();
      form.reset();
      loadRMAData();
    } else {
      const err = await res.json();
      alert('Error registering warranty: ' + err.error);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

async function submitRaiseRMA(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const form = e.target;
  const payload = {
    serial_number: form.serial_number.value,
    distributor: form.distributor.value.trim(),
    rma_id: form.rma_id.value.trim(),
    sent_date: form.sent_date.value,
  };

  if (!payload.serial_number) {
    alert('Please select a serial number first.');
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/rma/raise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Distributor RMA claim raised!');
      closeRaiseRMAModal();
      form.reset();
      loadRMAData();
    } else {
      const err = await res.json();
      alert('Error raising claim: ' + err.error);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

async function loadRMAData() {
  const baseUrl = document.getElementById('api-base').value;
  const warrantyBody = document.getElementById('warranty-list-body');
  const rmaBody = document.getElementById('rma-list-body');

  try {
    const res = await fetch(`${baseUrl}/api/admin/warranty/list`);
    if (!res.ok) throw new Error();
    const warranties = await res.json();

    warrantyBody.innerHTML = '';
    if (warranties.length === 0) {
      warrantyBody.innerHTML =
        '<tr><td colspan="5" class="py-4 text-center text-slate-600">No active customer warranties registered.</td></tr>';
    } else {
      warranties.forEach((item) => {
        const startDate = item.installed_date ? new Date(item.installed_date) : null;
        const months = parseInt(item.warranty_months) || 12;
        let endDate = null;
        let isExpired = false;
        if (startDate) {
          endDate = new Date(startDate);
          endDate.setMonth(startDate.getMonth() + months);
          isExpired = endDate < new Date();
        }
        const endStr = endDate ? endDate.toISOString().split('T')[0] : 'N/A';
        const statusBadge = isExpired
          ? '<span class="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-semibold text-[10px]">Expired</span>'
          : '<span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold text-[10px]">Active</span>';

        warrantyBody.innerHTML += `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                                <td class="py-2.5 font-mono text-amber-500 font-bold">${item.serial_number}</td>
                                <td class="py-2.5 font-semibold text-white">${item.device_name}</td>
                                <td class="py-2.5">${item.company_name || 'Individual Customer'}</td>
                                <td class="py-2.5 font-mono">${endStr}</td>
                                <td class="py-2.5">${statusBadge}</td>
                            </tr>
                        `;
      });
    }
  } catch (e) {
    console.error('Warranties fetch exception', e);
  }

  try {
    const res = await fetch(`${baseUrl}/api/admin/rma/list`);
    if (!res.ok) throw new Error();
    const rmaList = await res.json();

    rmaBody.innerHTML = '';
    if (rmaList.length === 0) {
      rmaBody.innerHTML =
        '<tr><td colspan="6" class="py-4 text-center text-slate-600">No active distributor claims registered.</td></tr>';
    } else {
      rmaList.forEach((item) => {
        const statusColor = item.status === 'RMA Completed' ? 'text-emerald-400' : 'text-amber-400';
        const sentStr = item.installed_date ? item.installed_date : 'N/A';

        rmaBody.innerHTML += `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                                <td class="py-2.5 font-mono text-amber-500 font-bold">${item.rma_tracking_id || 'RMA-3001'}</td>
                                <td class="py-2.5">
                                    <div class="font-mono text-slate-400">${item.serial_number}</div>
                                    <div class="font-semibold text-white">${item.device_name}</div>
                                </td>
                                <td class="py-2.5">${item.distributor || 'Supplier'}</td>
                                <td class="py-2.5 font-mono">${sentStr}</td>
                                <td class="py-2.5">
                                    <span class="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-bold text-[10px] uppercase ${statusColor}">
                                        ${item.status === 'RMA Sent' ? 'Sent To Supplier' : item.status}
                                    </span>
                                </td>
                                <td class="py-2.5 text-right">
                                    <button onclick="resolveRMAClaim('${item.serial_number}')" class="text-slate-400 hover:text-emerald-400 text-sm" title="Mark Resolved">
                                        ✔
                                    </button>
                                </td>
                            </tr>
                        `;
      });
    }
  } catch (e) {
    console.error('RMA fetch exception', e);
  }
}

async function resolveRMAClaim(serialNumber) {
  if (!confirm('Are you sure this distributor RMA claim has been resolved / replaced?')) return;
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/rma/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial_number: serialNumber,
        status: 'RMA Completed',
        distributor: '',
        rma_tracking_id: '',
      }),
    });
    if (res.ok) {
      alert('RMA claim marked completed.');
      loadRMAData();
    }
  } catch (e) {}
}

let distributorsList = [];

function openAddDistributorModal() {
  document.getElementById('modal-add-distributor').classList.remove('hidden');
}

function closeAddDistributorModal() {
  document.getElementById('modal-add-distributor').classList.add('hidden');
}

async function submitAddDistributor(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const form = e.target;
  const payload = {
    name: form.name.value.trim(),
    contact_person: form.contact_person.value.trim(),
    phone: form.phone.value.trim(),
    email: form.email.value.trim(),
    product_lines: form.product_lines.value.trim(),
  };

  try {
    const res = await fetch(`${baseUrl}/api/admin/distributors/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert('Distributor added successfully!');
      closeAddDistributorModal();
      form.reset();
      loadDistributorsData();
    } else {
      const err = await res.json();
      alert('Error: ' + err.error);
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

async function loadDistributorsData() {
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/distributors/list`);
    if (!res.ok) throw new Error();
    distributorsList = await res.json();
    renderDistributorsTable(distributorsList);
  } catch (err) {
    console.error('Failed to load distributors list', err);
  }
}

function renderDistributorsTable(list) {
  const tbody = document.getElementById('distributors-list-body');
  tbody.innerHTML = '';
  if (list.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" class="py-4 text-center text-slate-600">No distributors registered.</td></tr>';
    return;
  }
  list.forEach((d) => {
    tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                        <td class="py-2.5 font-bold text-amber-500">${d.name}</td>
                        <td class="py-2.5 font-semibold text-white">${d.contact_person}</td>
                        <td class="py-2.5 font-mono">${d.phone}</td>
                        <td class="py-2.5 font-mono text-slate-400">${d.email}</td>
                        <td class="py-2.5 text-slate-400">${d.product_lines}</td>
                        <td class="py-2.5 text-right">
                            <button onclick="deleteDistributor(${d.id})" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 text-xs">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
  });
}

async function deleteDistributor(id) {
  if (!confirm('Are you sure you want to delete this distributor?')) return;
  const baseUrl = document.getElementById('api-base').value;
  try {
    const res = await fetch(`${baseUrl}/api/admin/distributors/delete?id=${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      alert('Distributor deleted.');
      loadDistributorsData();
    }
  } catch (e) {}
}

function filterDistributors() {
  const query = document.getElementById('distributor-search-input').value.toLowerCase().trim();
  const filtered = distributorsList.filter(
    (d) =>
      d.name.toLowerCase().includes(query) ||
      d.product_lines.toLowerCase().includes(query) ||
      d.contact_person.toLowerCase().includes(query)
  );
  renderDistributorsTable(filtered);
}

async function loadCashSafeData() {
  const baseUrl = document.getElementById('api-base').value;
  try {
    // Balance
    const balanceRes = await fetch(`${baseUrl}/api/admin/cash/safe`);
    const safe = await balanceRes.json();
    document.getElementById('safe-usd-balance').textContent =
      `$${safe.usd_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('safe-mmk-balance').textContent =
      `${safe.mmk_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ks`;

    // Transactions
    const txRes = await fetch(`${baseUrl}/api/admin/cash/transactions`);
    cashTransactions = await txRes.json();
    renderCashTable();
  } catch (e) {}
}

function changeCashPage(delta) {
  cashPage += delta;
  renderCashTable();
}

function renderCashTable() {
  const ledgerBody = document.getElementById('cash-ledger-body');
  const totalPages = Math.ceil(cashTransactions.length / cashPerPage) || 1;

  if (cashPage < 1) cashPage = 1;
  if (cashPage > totalPages) cashPage = totalPages;

  document.getElementById('cash-page-indicator').textContent = `Page ${cashPage} of ${totalPages}`;
  document.getElementById('btn-cash-prev').disabled = cashPage === 1;
  document.getElementById('btn-cash-next').disabled = cashPage === totalPages;

  const start = (cashPage - 1) * cashPerPage;
  const end = start + cashPerPage;
  const sliced = cashTransactions.slice(start, end);

  ledgerBody.innerHTML = '';
  sliced.forEach((tx) => {
    const badge =
      tx.transaction_type === 'Deposit'
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-rose-500/10 text-rose-400';
    const amountPrefix = tx.transaction_type === 'Deposit' ? '+' : '-';
    ledgerBody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td class="py-2 text-slate-400 font-mono">${new Date(tx.created_at).toLocaleDateString()}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] ${badge}">${tx.transaction_type}</span></td>
                        <td class="py-2 font-mono font-bold text-amber-500">${amountPrefix}${tx.primary_currency === 'USD' ? '$' : ''}${tx.amount.toLocaleString()} ${tx.primary_currency === 'MMK' ? 'Ks' : ''}</td>
                        <td class="py-2 font-mono text-slate-400">${tx.exchange_rate}</td>
                        <td class="py-2 font-mono text-slate-300">${tx.equivalent_amount.toLocaleString()} Ks</td>
                        <td class="py-2 text-slate-400">${tx.notes || ''} ${tx.job_id ? `[Ref: ${tx.job_id}]` : ''}</td>
                    </tr>
                `;
  });
}

async function submitCashTransaction(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base').value;
  const transaction_type = document.getElementById('cash-type').value;
  const primary_currency = document.getElementById('cash-currency').value;
  const amount = document.getElementById('cash-amount').value;
  const exchange_rate = document.getElementById('cash-rate').value;
  const job_id = document.getElementById('cash-job-id').value.trim();
  const notes = document.getElementById('cash-notes').value;

  try {
    const res = await fetch(`${baseUrl}/api/admin/cash/transact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction_type,
        primary_currency,
        amount,
        exchange_rate,
        job_id,
        notes,
      }),
    });
    if (res.ok) {
      alert('Cash safe reserve ledger transaction recorded.');
      document.getElementById('cash-amount').value = '';
      document.getElementById('cash-notes').value = '';
      document.getElementById('cash-job-id').value = '';
      loadCashSafeData();
    }
  } catch (e) {}
}

async function loadTechniciansData() {
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;
  const tbody = document.getElementById('tech-list-body');

  try {
    const res = await fetch(`${baseUrl}/api/admin/technicians`, {
      headers: { 'X-Admin-Secret': secret },
    });
    if (!res.ok) throw new Error('Unauthorized or server error');
    const techs = await res.json();

    tbody.innerHTML = '';
    if (techs.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="py-4 text-center text-slate-600">No technicians registered in database.</td></tr>';
      return;
    }

    techs.forEach((t) => {
      const statusBadge =
        t.active === 1
          ? '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-emerald-500/10 text-emerald-400">Active</span>'
          : '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-amber-500/10 text-amber-400">Pending Approval</span>';

      const roleSelect = `
                        <select id="role-${t.id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                            <option value="Technician" ${t.role === 'Technician' ? 'selected' : ''}>Technician</option>
                            <option value="Sales" ${t.role === 'Sales' ? 'selected' : ''}>Sales</option>
                            <option value="Admin" ${t.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    `;

      const actionButton =
        t.active === 1
          ? `<button onclick="updateTechnicianStatus('${t.id}', 0)" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Deactivate</button>`
          : `<button onclick="updateTechnicianStatus('${t.id}', 1)" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Approve</button>`;

      tbody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all align-middle">
                            <td class="py-2.5 font-bold">${t.name}</td>
                            <td class="py-2.5 text-slate-400 font-mono">${t.email || (t.username ? '@' + t.username : 'N/A')}</td>
                            <td class="py-2.5">${roleSelect}</td>
                            <td class="py-2.5">${statusBadge}</td>
                            <td class="py-2.5 text-right space-x-1">
                                <button onclick="saveTechnicianRole('${t.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-3 py-1 rounded-lg">Save Role</button>
                                ${actionButton}
                            </td>
                        </tr>
                    `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-rose-400">Failed to load team data: ${err.message}</td></tr>`;
  }
}

async function updateTechnicianStatus(id, active) {
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;
  const role = document.getElementById(`role-${id}`).value;

  try {
    const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({ id, role, active }),
    });
    const data = await res.json();
    if (res.ok) {
      alert('Technician updated successfully.');
      refreshDashboardData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
}

async function saveTechnicianRole(id) {
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;
  const role = document.getElementById(`role-${id}`).value;

  try {
    const tbody = document.getElementById('tech-list-body');
    const row = Array.from(tbody.querySelectorAll('tr')).find((tr) => tr.innerHTML.includes(id));
    const active = row.innerHTML.includes('bg-emerald-500/10') ? 1 : 0;

    const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({ id, role, active }),
    });
    const data = await res.json();
    if (res.ok) {
      alert('Technician role updated successfully.');
      refreshDashboardData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Request failed: ' + err.message);
  }
}

async function loadJobsData() {
  const baseUrl = document.getElementById('api-base').value;

  try {
    const res = await fetch(`${baseUrl}/api/jobs`);
    const jobs = await res.json();

    // 1. Populate map markers
    plotJobsOnMap(jobs);

    // 2. Render Analytics Charts
    renderAnalytics(jobs);

    // 3. Render Dashboard Jobs
    renderDashboardJobs(jobs);

    // 4. Render Full Jobs Log
    renderFullJobsTable(jobs);

    // 5. Update Stats Widgets
    calculateStats(jobs);

    // 6. Initialize drag-and-drop calendar scheduler
    initFullCalendar(jobs);
  } catch (err) {
    console.error('Error pulling remote jobs data:', err);
  }
}

function calculateStats(jobs) {
  // Stats counts
  const activeTickets = jobs.filter(
    (j) => j.status === 'Pending' || j.status === 'In Progress'
  ).length;
  const pendingTickets = jobs.filter((j) => j.status === 'Pending').length;
  document.getElementById('stat-active-tickets').textContent = activeTickets;

  // Assume 4 total engineers for mock display
  const activeTechs = new Set(
    jobs.filter((j) => j.status === 'In Progress').map((j) => j.technician_id)
  ).size;
  document.getElementById('stat-techs-onsite').textContent = activeTechs;

  // Total revenue mock aggregation (could parse USD service receipts)
  let totalUSD = 0;
  jobs.forEach((j) => {
    if (j.status === 'Completed') {
      // Try to extract some service charge (mock values for now)
      totalUSD += j.service_type === 'CCTV' ? 1380 : j.service_type === 'Networking' ? 120 : 250;
    }
  });
  document.getElementById('stat-total-revenue').textContent = `$${totalUSD.toLocaleString()}`;
}

function renderDashboardJobs(jobs) {
  const tbody = document.getElementById('dashboard-tickets-body');
  tbody.innerHTML = '';

  // Slice to first 5 recent jobs
  const sliced = jobs.slice(0, 5);
  sliced.forEach((j) => {
    const statusBadge =
      j.status === 'Completed'
        ? 'bg-emerald-500/10 text-emerald-400'
        : j.status === 'In Progress'
          ? 'bg-indigo-500/10 text-indigo-400'
          : 'bg-amber-500/10 text-amber-500';

    // Mock pricing to match screen reference
    const fee =
      j.service_type === 'CCTV'
        ? '$1,380.00'
        : j.service_type === 'Networking'
          ? '$120.00'
          : '900,000 MMK';

    tbody.innerHTML += `
                    <tr class="hover:bg-white/5 transition-all align-middle text-slate-300">
                        <td class="py-3 font-mono font-bold text-amber-500">${j.id}</td>
                        <td class="py-3 font-medium text-white">${j.company_name || 'Anonymous Client'}</td>
                        <td class="py-3 text-slate-400">${j.service_type}</td>
                        <td class="py-3 font-medium">${j.tech_name || 'Unassigned'}</td>
                        <td class="py-3"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                        <td class="py-3 font-mono font-bold">${fee}</td>
                        <td class="py-3 font-mono text-[10px] text-slate-500">${new Date(j.created_at || Date.now()).toLocaleDateString()}</td>
                    </tr>
                `;
  });
}

function renderFullJobsTable(jobs) {
  const tbody = document.getElementById('full-jobs-body');
  tbody.innerHTML = '';

  jobs.forEach((j) => {
    const statusBadge =
      j.status === 'Completed'
        ? 'bg-emerald-500/10 text-emerald-400'
        : j.status === 'In Progress'
          ? 'bg-indigo-500/10 text-indigo-400'
          : 'bg-amber-500/10 text-amber-500';

    // Construct photos UI — show link for Drive files, inline for data URIs
    let photosHtml = '';
    if (j.before_photo) {
      const isDrive = j.before_photo.includes('drive.google.com');
      photosHtml += `<div class="space-y-1">
                        <span class="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Before Photo</span>
                        ${isDrive
                          ? `<a href="${escapeHTML(j.before_photo)}" target="_blank" class="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View</a>`
                          : `<img src="${escapeHTML(j.before_photo)}" class="w-20 h-16 object-cover rounded-lg border border-white/10 hover:scale-105 transition-all cursor-pointer" loading="lazy">`}
                    </div>`;
    }
    if (j.after_photo) {
      const isDrive = j.after_photo.includes('drive.google.com');
      photosHtml += `<div class="space-y-1">
                        <span class="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">After Photo</span>
                        ${isDrive
                          ? `<a href="${escapeHTML(j.after_photo)}" target="_blank" class="inline-flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300"><svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>View</a>`
                          : `<img src="${escapeHTML(j.after_photo)}" class="w-20 h-16 object-cover rounded-lg border border-white/10 hover:scale-105 transition-all cursor-pointer" loading="lazy">`}
                    </div>`;
    }
    const photosWrapper = photosHtml ? `<div class="flex gap-4 mt-2">${photosHtml}</div>` : '';

    tbody.innerHTML += `
                    <tr class="clickable-row border-b border-white/5 hover:bg-white/5 transition-all text-slate-300 align-middle cursor-pointer" onclick="if(!event.target.closest('img') && !event.target.closest('a')) { this.classList.toggle('expanded'); document.getElementById('details-${j.id}').classList.toggle('hidden'); }">
                        <td class="py-2.5 font-mono text-amber-500 font-bold">
                            <span class="row-expand-arrow">▶</span>${j.id}
                        </td>
                        <td class="py-2.5 font-semibold text-white">${j.company_name || 'Client'}</td>
                        <td class="py-2.5">${j.tech_name || 'Tech'}</td>
                        <td class="py-2.5 text-slate-400">${j.service_type}</td>
                        <td class="py-2.5"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                    </tr>
                    <tr id="details-${j.id}" class="detail-row hidden bg-black/20">
                        <td colspan="5" class="p-4 text-xs text-slate-400 border-b border-white/5 space-y-3">
                            <div class="grid md:grid-cols-2 gap-6">
                                <div class="space-y-2">
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Statement of Scope</span>
                                        <p class="text-slate-300 font-medium leading-relaxed">${j.job_description || 'N/A'}</p>
                                    </div>
                                    ${
                                      j.maps_url
                                        ? `<div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Service Location (Google Maps)</span>
                                        <a href="${j.maps_url}" target="_blank" class="text-amber-500 hover:underline font-mono">${j.maps_url}</a>
                                    </div>`
                                        : ''
                                    }
                                </div>
                                <div class="space-y-2">
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Technician Site Notes</span>
                                        <p class="text-slate-300 italic leading-relaxed">"${j.technician_notes || 'No notes submitted yet.'}"</p>
                                    </div>
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Equipment Used</span>
                                        <p class="text-slate-300 font-mono">${j.equipment_used || 'None recorded'}</p>
                                    </div>
                                </div>
                            </div>
                            ${photosWrapper}
                        </td>
                    </tr>
                `;
  });
}

// ============================================================================
// ENHANCED JOB MANAGEMENT FUNCTIONS
// ============================================================================

let allJobsData = [];
let currentJobStatusFilter = 'All';

function toggleNewTicketForm() {
  const form = document.getElementById('new-ticket-form');
  form.classList.toggle('hidden');
}

function filterJobsByStatus(status, event) {
  currentJobStatusFilter = status;

  // Update button states
  document.querySelectorAll('.job-status-btn').forEach(btn => {
    btn.classList.remove('text-amber-400', 'bg-amber-500/10', 'border-amber-500/20');
    btn.classList.add('text-slate-400', 'border-transparent');
  });
  if (event && event.target) {
    event.target.classList.add('text-amber-400', 'bg-amber-500/10', 'border-amber-500/20');
    event.target.classList.remove('text-slate-400', 'border-transparent');
  }

  filterJobs();
}

function filterJobs() {
  const search = (document.getElementById('job-search-input')?.value || '').toLowerCase();
  const statusFilter = currentJobStatusFilter;
  const typeFilter = document.getElementById('job-type-filter')?.value || 'All';

  const filtered = allJobsData.filter(j => {
    const matchSearch = !search ||
      (j.id || '').toLowerCase().includes(search) ||
      (j.company_name || '').toLowerCase().includes(search) ||
      (j.tech_name || '').toLowerCase().includes(search) ||
      (j.job_description || '').toLowerCase().includes(search);
    const matchStatus = statusFilter === 'All' || j.status === statusFilter;
    const matchType = typeFilter === 'All' || j.service_type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  renderJobsGrid(filtered);
}

function renderJobsGrid(jobs) {
  const grid = document.getElementById('jobs-grid');
  if (!grid) return;

  if (jobs.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">📋</div>
        <p class="text-sm">No jobs found</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = jobs.map(j => {
    let statusClass = 'bg-slate-500/20 text-slate-400';
    let statusIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>';
    if (j.status === 'Completed') { statusClass = 'bg-emerald-500/20 text-emerald-400'; statusIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'; }
    else if (j.status === 'Pending') { statusClass = 'bg-amber-500/20 text-amber-400'; statusIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'; }
    else if (j.status === 'In Progress') { statusClass = 'bg-blue-500/20 text-blue-400'; statusIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>'; }
    else if (j.status === 'Cancelled') { statusClass = 'bg-rose-500/20 text-rose-400'; statusIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>'; }

    let typeClass = 'bg-slate-500/10 text-slate-400';
    if (j.service_type === 'CCTV') typeClass = 'bg-amber-500/10 text-amber-400';
    else if (j.service_type === 'Networking') typeClass = 'bg-blue-500/10 text-blue-400';
    else if (j.service_type === 'WiFi') typeClass = 'bg-cyan-500/10 text-cyan-400';
    else if (j.service_type === 'NAS') typeClass = 'bg-violet-500/10 text-violet-400';

    const createdDate = j.created_at ? new Date(j.created_at).toLocaleDateString() : 'N/A';

    return `
      <div class="glass-panel rounded-xl p-4 hover:border-white/10 transition-all group cursor-pointer" onclick="selectJob('${escapeHTML(j.id)}')">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">${escapeHTML(j.id)}</span>
            <span class="px-2 py-0.5 rounded text-[9px] font-bold ${typeClass}">${escapeHTML(j.service_type)}</span>
          </div>
          <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${statusClass}">
            ${statusIcon}
            ${escapeHTML(j.status)}
          </span>
        </div>
        <div class="text-sm font-bold text-white group-hover:text-amber-400 transition mb-2 truncate">${escapeHTML(j.company_name || 'Unknown Client')}</div>
        <div class="text-[10px] text-slate-400 mb-3 line-clamp-2">${escapeHTML(j.job_description || 'No description')}</div>
        <div class="flex items-center justify-between text-[10px]">
          <div class="flex items-center gap-1 text-slate-400">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${escapeHTML(j.tech_name || 'Unassigned')}
          </div>
          <span class="text-slate-500">${createdDate}</span>
        </div>
      </div>
    `;
  }).join('');
}

function updateJobStats(jobs) {
  const total = jobs.length;
  const pending = jobs.filter(j => j.status === 'Pending').length;
  const inProgress = jobs.filter(j => j.status === 'In Progress').length;
  const completed = jobs.filter(j => j.status === 'Completed').length;
  const cancelled = jobs.filter(j => j.status === 'Cancelled').length;

  document.getElementById('job-stat-total').textContent = total;
  document.getElementById('job-stat-pending').textContent = pending;
  document.getElementById('job-stat-progress').textContent = inProgress;
  document.getElementById('job-stat-completed').textContent = completed;
  document.getElementById('job-stat-cancelled').textContent = cancelled;

  // Update status tab counts
  document.getElementById('job-count-all').textContent = total;
  document.getElementById('job-count-pending').textContent = pending;
  document.getElementById('job-count-progress').textContent = inProgress;
  document.getElementById('job-count-completed').textContent = completed;
  document.getElementById('job-count-cancelled').textContent = cancelled;
}

function selectJob(jobId) {
  document.getElementById('pdf-target-job-id').value = jobId;
  showToast(`Selected job: ${jobId}`, 'info');
}

function loadJobs() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  fetch(`${baseUrl}/api/jobs`)
    .then(res => res.json())
    .then(jobs => {
      allJobsData = jobs;
      updateJobStats(jobs);
      filterJobs();
    })
    .catch(e => console.error('Failed to load jobs:', e));
}

// Initialize jobs on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadJobs, 1800);
});

function plotJobsOnMap(jobs) {
  // Remove previous markers
  mapMarkers.forEach((m) => map.removeLayer(m));
  mapMarkers = [];
  if (hqMarker) {
    map.removeLayer(hqMarker);
    hqMarker = null;
  }

  // 1. Draw HQ Marker
  const hq = loadHQConfig();
  const hqIcon = L.divIcon({
    html: `<div style="background-color: #ef4444; border: 2px solid #f59e0b; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 0 12px #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 9px;">🏢</div>`,
    className: 'custom-leaflet-marker-hq',
    iconSize: [16, 16],
  });
  hqMarker = L.marker([hq.lat, hq.lng], { icon: hqIcon }).addTo(map).bindPopup(`
                    <div class="text-xs space-y-1">
                        <span class="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">HQ</span>
                        <strong class="text-white block font-bold mt-1">${escapeHTML(hq.name)}</strong>
                        <div class="text-slate-400 text-[10px]">${escapeHTML(hq.address)}</div>
                    </div>
                `);

  // 2. Draw jobs
  jobs.forEach((job) => {
    const lat = job.arrival_lat || hq.lat + (Math.random() - 0.5) * 0.05;
    const lng = job.arrival_lng || hq.lng + (Math.random() - 0.5) * 0.05;

    const markerColor =
      job.status === 'Completed' ? '#10b981' : job.status === 'In Progress' ? '#6366f1' : '#f59e0b';

    const customIcon = L.divIcon({
      html: `<div style="background-color: ${markerColor}; border: 2px solid white; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
      className: 'custom-leaflet-marker',
      iconSize: [12, 12],
    });

    const m = L.marker([lat, lng], { icon: customIcon }).addTo(map).bindPopup(`
                        <div class="text-xs space-y-1">
                            <strong class="text-amber-500 font-mono">${escapeHTML(job.id)}</strong>
                            <div class="font-bold text-white">${escapeHTML(job.company_name || 'Client Site')}</div>
                            <div class="text-slate-400">Assigned: ${escapeHTML(job.tech_name || 'N/A')}</div>
                            <div class="font-semibold text-indigo-300">${escapeHTML(job.service_type)} (${escapeHTML(job.status)})</div>
                        </div>
                    `);
    mapMarkers.push(m);
  });
}

function initFullCalendar(jobs) {
  const calendarEl = document.getElementById('calendar');
  const events = jobs.map((j) => {
    const eventColor =
      j.status === 'Completed' ? '#10b981' : j.status === 'In Progress' ? '#6366f1' : '#f59e0b';
    return {
      id: j.id,
      title: `${j.id} - ${j.service_type}`,
      start: j.created_at || new Date().toISOString(),
      backgroundColor: eventColor,
      borderColor: eventColor,
      textColor: '#fff',
    };
  });

  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek',
    },
    themeSystem: 'standard',
    events: events,
    height: 350,
  });
  calendar.render();
}

function renderAnalytics(jobs) {
  // Status counts
  const statuses = { Completed: 0, 'In Progress': 0, Pending: 0 };
  const categories = { CCTV: 0, Networking: 0, WiFi: 0, NAS: 0, 'General Maintenance': 0 };

  jobs.forEach((j) => {
    if (statuses[j.status] !== undefined) statuses[j.status]++;
    if (categories[j.service_type] !== undefined) categories[j.service_type]++;
  });

  // 1. Status Chart
  const ctxStatus = document.getElementById('chart-status').getContext('2d');
  if (statusChartInstance) statusChartInstance.destroy();
  statusChartInstance = new Chart(ctxStatus, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statuses),
      datasets: [
        {
          data: Object.values(statuses),
          backgroundColor: ['#10b981', '#6366f1', '#f59e0b'],
          borderWidth: 1,
          borderColor: '#1e1b4b',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } },
    },
  });

  // 2. Category Chart
  const ctxCategory = document.getElementById('chart-category').getContext('2d');
  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(ctxCategory, {
    type: 'bar',
    data: {
      labels: Object.keys(categories),
      datasets: [
        {
          label: 'Tickets Deployed',
          data: Object.values(categories),
          backgroundColor: '#f59e0b',
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#94a3b8', font: { size: 9 } },
        },
      },
      plugins: { legend: { display: false } },
    },
  });
}

async function sendAdminRequest(endpoint, payload) {
  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;

  try {
    const res = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      alert('Operation executed successfully.');
      refreshDashboardData();
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Communication error with edge: ' + err.message);
  }
}

function submitClient(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  sendAdminRequest('/api/admin/clients', data);
  e.target.reset();
}

function submitJob(e) {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  sendAdminRequest('/api/admin/jobs', data);
  e.target.reset();
}

async function generateServiceReceiptPDF() {
  const jobId = document.getElementById('pdf-target-job-id').value.trim();
  const baseUrl = document.getElementById('api-base').value;

  if (!jobId) return alert('Please specify a targeted ticket parameter entry.');

  try {
    const res = await fetch(`${baseUrl}/api/jobs/receipt?job_id=${jobId}`);
    if (!res.ok) throw new Error('Target service history index mismatch.');
    const job = await res.json();

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Build receipt PDF styles
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setFillColor(79, 70, 229);
    doc.rect(0, 0, 210, 18, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('AWESOMEMYANMAR SERVICE REPORT COMPLIANCE PROTOCOL SHEET', 15, 12);

    let currentY = 28;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(12);
    doc.text(`TICKET IDENTIFIER NO: ${job.id}`, 15, currentY);

    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('DOMAIN SERVICE:', 15, currentY + 6);
    doc.text('CREW MEMBER ID:', 15, currentY + 12);
    doc.text('TICKET CREATED:', 15, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(job.service_type || 'N/A', 50, currentY + 6);
    doc.text(job.technician_id || 'N/A', 50, currentY + 12);
    doc.text(new Date(job.created_at).toLocaleString(), 50, currentY + 18);

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.text('WORK STATUS GATE:', 135, currentY + 6);
    doc.text('ARRIVAL TIMESTAMP:', 135, currentY + 12);
    doc.text('COMPLETION TIMESTAMP:', 135, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(job.status || 'N/A', 178, currentY + 6);
    const arrivalTxt = job.arrival_time ? `${job.arrival_time}` : 'Not Logged';
    const completionTxt = job.completion_time ? `${job.completion_time}` : 'Not Logged';
    doc.text(arrivalTxt, 178, currentY + 12);
    doc.text(completionTxt, 178, currentY + 18);

    // --- Section 1: Client Information Card ---
    currentY += 28;
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('1. ACCOUNT PROFILE METADATA DETAILS', 15, currentY);
    doc.setDrawColor(226, 232, 240);
    doc.line(15, currentY + 2.5, 195, currentY + 2.5);

    currentY += 8;
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Company Account:', 15, currentY);
    doc.text('Primary Manager:', 15, currentY + 6);
    doc.text('Site Address:', 15, currentY + 12);
    doc.text('Contact Line:', 15, currentY + 18);

    doc.setFont('helvetica', 'normal');
    doc.text(job.company_name || 'N/A', 50, currentY);
    doc.text(job.contact_person || 'N/A', 50, currentY + 6);
    doc.text(job.address || 'N/A', 50, currentY + 12);
    doc.text(job.client_phone || 'N/A', 50, currentY + 18);

    // --- Section 2: Technical Statements ---
    currentY += 28;
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('2. OPERATIONAL RESOLUTIONS & DIAGNOSTIC NOTES', 15, currentY);
    doc.line(15, currentY + 2.5, 195, currentY + 2.5);

    currentY += 8;
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('SERVICE STATEMENT SCOPE DEPLOYED:', 15, currentY);

    currentY += 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const scopeLines = doc.splitTextToSize(
      job.job_description || 'No job description provided.',
      180
    );
    doc.text(scopeLines, 15, currentY);
    currentY += scopeLines.length * 4.5 + 4;

    doc.setTextColor(71, 85, 105);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('ENGINEER ACTION & RESOLUTION SUMMARY LOGS:', 15, currentY);

    currentY += 5;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const notesLines = doc.splitTextToSize(
      job.technician_notes || 'No closing action summary logs entered.',
      180
    );
    doc.text(notesLines, 15, currentY);
    currentY += notesLines.length * 4.5 + 4;

    // --- Section 3: Hardware Inventory ---
    doc.setTextColor(245, 158, 11);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('3. HARDWARE DEPLOYMENT TRACKING', 15, currentY);
    doc.line(15, currentY + 2.5, 195, currentY + 2.5);

    currentY += 8;
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let hardwareStr = 'No inventory components allocated to this operational ticket.';
    try {
      const parsedHardware = JSON.parse(job.equipment_used || '[]');
      if (parsedHardware.length > 0) {
        hardwareStr = parsedHardware.join(', ');
      }
    } catch (e) {}
    const hardwareLines = doc.splitTextToSize(hardwareStr, 180);
    doc.text(hardwareLines, 15, currentY);

    // --- Sign-Off Footer section ---
    currentY += hardwareLines.length * 4.5 + 26;

    if (job.signature) {
      try {
        doc.addImage(job.signature, 'PNG', 135, currentY - 14, 45, 12);
      } catch (e) {
        console.error(e);
      }
    }

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(15, currentY, 80, currentY);
    doc.line(125, currentY, 190, currentY);

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`AUTHORIZED TECH LEAD SIGNATURE [${job.technician_id}]`, 15, currentY + 4.5);
    doc.text('CUSTOMER COMPLIANCE VALIDATION SIGN-OFF', 125, currentY + 4.5);

    // Export PDF
    doc.save(`receipt-service-log-${job.id}.pdf`);
  } catch (err) {
    alert('PDF compilation engine process exception encountered: ' + err.message);
  }
}

// ============================================================================
// USER MANAGEMENT FUNCTIONS
// ============================================================================

let allUsersData = [];

function switchSettingsTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.classList.remove('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    btn.classList.add('text-slate-400', 'border-transparent');
  });
  const activeBtn = document.getElementById(`settings-tab-${tab}`);
  if (activeBtn) {
    activeBtn.classList.add('text-white', 'bg-amber-500/10', 'border-amber-500/20');
    activeBtn.classList.remove('text-slate-400', 'border-transparent');
  }

  // Show/hide panels
  ['users', 'system', 'database'].forEach(p => {
    const panel = document.getElementById(`settings-panel-${p}`);
    if (panel) panel.classList.toggle('hidden', p !== tab);
  });
}

async function loadUsers() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/lookups`);
    const lookups = await res.json();
    allUsersData = lookups.technicians || [];
    updateUserStats();
    filterUsers();
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

function updateUserStats() {
  const total = allUsersData.length;
  const active = allUsersData.filter(u => u.active === 1).length;
  const techs = allUsersData.filter(u => u.role === 'Technician').length;
  const admins = allUsersData.filter(u => u.role === 'Admin').length;

  document.getElementById('user-stat-total').textContent = total;
  document.getElementById('user-stat-active').textContent = active;
  document.getElementById('user-stat-techs').textContent = techs;
  document.getElementById('user-stat-admins').textContent = admins;
}

function filterUsers() {
  const search = (document.getElementById('user-search-input')?.value || '').toLowerCase();
  const roleFilter = document.getElementById('user-role-filter')?.value || 'All';
  const statusFilter = document.getElementById('user-status-filter')?.value || 'All';

  const filtered = allUsersData.filter(u => {
    const matchSearch = !search ||
      (u.name || '').toLowerCase().includes(search) ||
      (u.username || '').toLowerCase().includes(search) ||
      (u.email || '').toLowerCase().includes(search) ||
      (u.role || '').toLowerCase().includes(search);
    const matchRole = roleFilter === 'All' || u.role === roleFilter;
    const matchStatus = statusFilter === 'All' ||
      (statusFilter === 'active' && u.active === 1) ||
      (statusFilter === 'inactive' && u.active !== 1);
    return matchSearch && matchRole && matchStatus;
  });

  renderUsersGrid(filtered);
}

function renderUsersGrid(users) {
  const grid = document.getElementById('users-grid');
  if (!grid) return;

  if (users.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 text-slate-500">
        <div class="text-4xl mb-2">👥</div>
        <p class="text-sm">No users found</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = users.map(u => {
    const isActive = u.active === 1;
    const initials = (u.name || u.username || 'U').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    let roleClass = 'bg-slate-500/20 text-slate-400';
    let roleIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    if (u.role === 'Admin') { roleClass = 'bg-violet-500/20 text-violet-400'; roleIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'; }
    else if (u.role === 'Technician') { roleClass = 'bg-blue-500/20 text-blue-400'; roleIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>'; }
    else if (u.role === 'Sales') { roleClass = 'bg-emerald-500/20 text-emerald-400'; roleIcon = '<svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>'; }

    const lastLogin = u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never';

    return `
      <div class="glass-panel rounded-xl p-4 hover:border-white/10 transition-all group">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="relative">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center text-amber-400 font-bold text-sm border border-amber-500/20">
                ${initials}
              </div>
              <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-500'} border-2 border-black"></div>
            </div>
            <div>
              <div class="text-sm font-bold text-white group-hover:text-amber-400 transition">${u.name || u.username}</div>
              <div class="text-[10px] text-slate-400">${u.email || u.username || 'No email'}</div>
            </div>
          </div>
          <span class="flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${roleClass}">
            ${roleIcon}
            ${u.role}
          </span>
        </div>
        <div class="space-y-2 text-[10px]">
          ${u.phone ? `<div class="flex items-center gap-2 text-slate-400"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>${u.phone}</div>` : ''}
          <div class="flex items-center gap-2 text-slate-400"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Last login: ${lastLogin}</div>
          <div class="flex items-center gap-2 text-slate-400"><svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Permissions: ${u.permissions || 'read_write'}</div>
        </div>
        <div class="mt-3 pt-3 border-t border-white/5 flex gap-2">
          <button onclick="editUser('${u.id}')" class="flex-1 bg-white/5 hover:bg-white/10 text-[10px] text-slate-300 font-bold py-1.5 rounded-lg transition">Edit</button>
          <button onclick="toggleUserStatus('${u.id}')" class="flex-1 ${isActive ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'} text-[10px] font-bold py-1.5 rounded-lg transition">${isActive ? 'Deactivate' : 'Activate'}</button>
        </div>
      </div>
    `;
  }).join('');
}

function openAddUserModal() {
  document.getElementById('modal-add-user').classList.remove('hidden');
}

function closeAddUserModal() {
  document.getElementById('modal-add-user').classList.add('hidden');
}

async function submitNewUser(event) {
  event.preventDefault();
  const form = event.target;
  const data = {
    username: document.getElementById('new-user-username').value,
    password: document.getElementById('new-user-password').value,
    name: document.getElementById('new-user-name').value,
    role: document.getElementById('new-user-role').value,
    phone: document.getElementById('new-user-phone').value,
    email: document.getElementById('new-user-email').value,
  };

  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      showToast('User created successfully', 'success');
      closeAddUserModal();
      form.reset();
      loadUsers();
    } else {
      showToast('Failed to create user', 'error');
    }
  } catch (e) {
    console.error('Failed to create user:', e);
    showToast('Error creating user', 'error');
  }
}

function editUser(userId) {
  showToast(`Edit user ${userId} - Feature coming soon`, 'info');
}

async function toggleUserStatus(userId) {
  const user = allUsersData.find(u => u.id === userId);
  if (!user) return;

  const newStatus = user.active === 1 ? 0 : 1;
  const action = newStatus === 0 ? 'deactivate' : 'activate';

  if (!confirm(`Are you sure you want to ${action} ${user.name || user.username}?`)) return;

  const baseUrl = document.getElementById('api-base')?.value || '';
  try {
    const res = await fetch(`${baseUrl}/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: newStatus }),
    });

    if (res.ok) {
      showToast(`User ${action}d successfully`, 'success');
      loadUsers();
    } else {
      showToast(`Failed to ${action} user`, 'error');
    }
  } catch (e) {
    console.error(`Failed to ${action} user:`, e);
    showToast(`Error ${action} user`, 'error');
  }
}

// Initialize users on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadUsers, 2500);
});

// ============================================================================
// ADDITIONAL SETTINGS FUNCTIONS
// ============================================================================

function saveCompanyProfile(event) {
  event.preventDefault();
  const profile = {
    name: document.getElementById('company-name').value,
    reg: document.getElementById('company-reg').value,
    email: document.getElementById('company-email').value,
    phone: document.getElementById('company-phone').value,
    address: document.getElementById('company-address').value,
  };
  localStorage.setItem('company_profile', JSON.stringify(profile));
  showToast('Company profile saved', 'success');
}

function saveTaxSettings() {
  const settings = {
    taxRate: document.getElementById('tax-rate').value,
    serviceFee: document.getElementById('service-fee').value,
  };
  localStorage.setItem('tax_settings', JSON.stringify(settings));
  showToast('Tax settings saved', 'success');
}

function saveNotificationSettings() {
  const settings = {
    sms: document.getElementById('notify-sms').checked,
    email: document.getElementById('notify-email').checked,
    telegram: document.getElementById('notify-telegram').checked,
    lowStock: document.getElementById('notify-low-stock').checked,
  };
  localStorage.setItem('notification_settings', JSON.stringify(settings));
  showToast('Notification settings saved', 'success');
}

function setTheme(theme) {
  localStorage.setItem('theme', theme);
  showToast(`Theme set to ${theme}`, 'info');
}

function setAccentColor(color) {
  localStorage.setItem('accent_color', color);
  showToast(`Accent color set to ${color}`, 'info');
}

function loadSettings() {
  // Load company profile
  const profile = JSON.parse(localStorage.getItem('company_profile') || '{}');
  if (profile.name) document.getElementById('company-name').value = profile.name;
  if (profile.reg) document.getElementById('company-reg').value = profile.reg;
  if (profile.email) document.getElementById('company-email').value = profile.email;
  if (profile.phone) document.getElementById('company-phone').value = profile.phone;
  if (profile.address) document.getElementById('company-address').value = profile.address;

  // Load tax settings
  const tax = JSON.parse(localStorage.getItem('tax_settings') || '{}');
  if (tax.taxRate) document.getElementById('tax-rate').value = tax.taxRate;
  if (tax.serviceFee) document.getElementById('service-fee').value = tax.serviceFee;

  // Load notification settings
  const notif = JSON.parse(localStorage.getItem('notification_settings') || '{}');
  if (notif.sms !== undefined) document.getElementById('notify-sms').checked = notif.sms;
  if (notif.email !== undefined) document.getElementById('notify-email').checked = notif.email;
  if (notif.telegram !== undefined) document.getElementById('notify-telegram').checked = notif.telegram;
  if (notif.lowStock !== undefined) document.getElementById('notify-low-stock').checked = notif.lowStock;
}

// Initialize settings on load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(loadSettings, 3000);
});
