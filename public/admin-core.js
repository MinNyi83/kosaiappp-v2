function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHTML = escapeHTML;

// ── Loading Spinner Utility ─────────────────────────────────────────────────
let _activeSpinner = null;
function showLoading(msg = 'Loading...') {
  hideLoading();
  const overlay = document.createElement('div');
  overlay.id = '__loading_overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:99999;';
  overlay.innerHTML = `<div style="background:#1e293b;border:1px solid #334155;border-radius:16px;padding:24px 32px;display:flex;align-items:center;gap:12px;color:#e2e8f0;font-size:14px;font-weight:600;">
    <svg class="animate-spin" style="width:20px;height:20px;color:#6366f1;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle style="opacity:0.25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path style="opacity:0.75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
    <span>${escapeHTML(msg)}</span>
  </div>`;
  document.body.appendChild(overlay);
  _activeSpinner = overlay;
}
function hideLoading() {
  if (_activeSpinner) { _activeSpinner.remove(); _activeSpinner = null; }
  const el = document.getElementById('__loading_overlay');
  if (el) el.remove();
}
window.showLoading = showLoading;
window.hideLoading = hideLoading;

// ── Toast Notification ────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3000) {
  const colors = {
    success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    error: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    info: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  };
  const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[99999] px-4 py-3 rounded-xl border font-semibold text-sm shadow-lg transition-all duration-300 ${colors[type] || colors.info}`;
  toast.style.cssText = 'opacity:0;transform:translate(-50%,-10px);transition:all 0.3s ease';
  toast.innerHTML = `<span class="mr-2">${icons[type] || icons.info}</span>${escapeHTML(message)}`;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translate(-50%, 0)'; });
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -10px)'; setTimeout(() => toast.remove(), 300); }, duration);
}
window.showToast = showToast;

// ── Event Delegation for Dynamic Content ──────────────────────────────────
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (action && typeof window[action] === 'function') {
    e.preventDefault();
    window[action](id);
  }
});

// Intercept global fetch to automatically inject Authorization token
const apiInput = document.getElementById('api-base');
if (apiInput && !apiInput.value) {
  const hostname = window.location.hostname;
  if (
    hostname.includes('pages.dev') ||
    hostname === 'tauri.localhost' ||
    (hostname === 'localhost' && window.location.port === '')
  ) {
    // Cloudflare Pages or Tauri desktop app -> use remote Worker
    apiInput.value = 'https://cctv-service-system.nyinyimin2007.workers.dev';
  } else {
    // Local dev (127.0.0.1:8787) -> use local origin
    apiInput.value = window.location.origin;
  }
}

const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  let finalUrl = url;
  if (finalUrl) {
    if (finalUrl.includes('/api/admin/inventory/list'))
      finalUrl = finalUrl.replace('/api/admin/inventory/list', '/api/inventory');
    if (finalUrl.includes('/api/admin/clients/list'))
      finalUrl = finalUrl.replace('/api/admin/clients/list', '/api/clients');

    if (finalUrl.includes('/api/')) {
      options.headers = options.headers || {};
      const token = localStorage.getItem('admin_token');
      if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  const res = await originalFetch(finalUrl, options);
  if (res.status === 401) {
    const urlStr = typeof finalUrl === 'string' ? finalUrl : finalUrl.url || '';
    if (urlStr.includes('/api/auth/') || urlStr.includes('/api/admin/config')) {
      handleLogout();
    }
  }

  if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
    const originalJson = res.json.bind(res);
    res.json = async function () {
      const data = await originalJson();
      if (data && typeof data === 'object' && data.success === true && 'data' in data) {
        if (finalUrl.includes('/api/jobs') && data.data && Array.isArray(data.data.jobs))
          return data.data.jobs;
        if (finalUrl.includes('/api/clients') && data.data && Array.isArray(data.data.clients))
          return data.data.clients;
        if (finalUrl.includes('/api/inventory') && data.data && Array.isArray(data.data.items))
          return data.data.items;
        return data.data;
      }
      return data;
    };
  }

  return res;
};

let map;
let mapMarkers = [];
let statusChartInstance;
let categoryChartInstance;
let calendarInstance = null;

let cashTransactions = [];
let cashPage = 1;
const cashPerPage = 10;

let inventoryItems = [];
let stockPage = 1;
const stockPerPage = 10;
let catalogPage = 1;
let catalogTotalPages = 1;
let catalogTotal = 0;
const catalogPerPage = 100;
let pricingPage = 1;
let pricingTotalPages = 1;
let pricingTotal = 0;
const pricingPerPage = 100;
let clientsList = [];

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
function toggleSidebarCollapse() {
  const sidebar = document.getElementById('sidebar');
  sidebar.classList.toggle('collapsed');
  localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
}
function initAdmin() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
    sidebar.classList.add('collapsed');
  }

  // Touch swipe support for mobile sidebar
  let touchStartX = 0;
  let touchCurrentX = 0;
  const overlay = document.getElementById('sidebar-overlay');

  if (sidebar && overlay) {
    document.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
      touchCurrentX = e.touches[0].clientX;
      const diff = touchStartX - touchCurrentX;

      // Swipe left to close
      if (sidebar.classList.contains('open') && diff > 50) {
        closeSidebar();
      }
    }, { passive: true });

    // Close sidebar on overlay click
    overlay.addEventListener('click', closeSidebar);
  }

  const loginForm = document.getElementById('login-password-container');
  if (loginForm) {
    loginForm.addEventListener('submit', handlePasswordLogin);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
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

    const responseData = data.data || data;
    const user = responseData.user || responseData.technician;
    if (!user || user.role !== 'Admin') {
      throw new Error('Your account does not have Admin privileges.');
    }

    localStorage.setItem('admin_user', JSON.stringify(user));
    localStorage.setItem('admin_token', responseData.token);
    const authScreen = document.getElementById('auth-screen');
    authScreen.classList.remove('flex');
    authScreen.classList.add('hidden');
    initializeAdminDesk();
  } catch (err) {
    console.error('Login failed:', err);
    showToast(err.message || 'Error', 'error');
  }
}
window.handlePasswordLogin = handlePasswordLogin;

async function submitNewUser(e) {
  e.preventDefault();
  const id = document.getElementById('new-user-id').value.trim();
  const username = document.getElementById('new-user-username').value.trim();
  const password = document.getElementById('new-user-password').value.trim();
  const name = document.getElementById('new-user-name').value.trim();
  const nickname = document.getElementById('new-user-nickname').value.trim();
  const role = document.getElementById('new-user-role').value;
  const phone = document.getElementById('new-user-phone').value.trim();
  const email = document.getElementById('new-user-email').value.trim();
  const pin = document.getElementById('new-user-pin').value.trim();
  const telegram_username =
    document.getElementById('new-user-telegram-username')?.value?.trim() || '';

  const baseUrl = document.getElementById('api-base').value;
  const secret = document.getElementById('admin-secret').value;

  try {
    const res = await fetch(`${baseUrl}/api/admin/technicians/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
      body: JSON.stringify({
        id,
        username,
        password,
        name,
        nickname,
        role,
        phone,
        email,
        pin,
        telegram_username,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('User account created successfully!', 'success');
      e.target.reset();
      refreshDashboardData();
    } else {
      showToast('Error: ' + data.error, 'error');
    }
  } catch (err) {
    showToast('Connection error', 'error');
  }
}

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
  const cachedToken = localStorage.getItem('admin_token');
  if (cachedUser && cachedToken && cachedToken.split('.').length === 3) {
    const user = JSON.parse(cachedUser);
    if (user.role === 'Admin') {
      document.getElementById('auth-screen').classList.add('hidden');
      initializeAdminDesk();
    }
  } else {
    handleLogout();
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

    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Google auth rejected');

    if (result.data.technician.role !== 'Admin') {
      throw new Error('Your account does not have Admin privileges.');
    }

    localStorage.setItem('admin_user', JSON.stringify(result.data.technician));
    localStorage.setItem('admin_token', result.data.token);
    document.getElementById('auth-screen').classList.add('hidden');
    initializeAdminDesk();
  } catch (err) {
    showToast('Access Denied', 'error');
  }
}

function handleLogout() {
  localStorage.removeItem('admin_user');
  localStorage.removeItem('admin_token');
  const authScreen = document.getElementById('auth-screen');
  authScreen.classList.remove('hidden');
  authScreen.classList.add('flex');
}

async function triggerBackup() {
  const baseUrl = document.getElementById('api-base').value;
  const token = localStorage.getItem('admin_token');
  try {
    showToast('Creating backup...', 'info');
    const res = await fetch(`${baseUrl}/api/admin/backup`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not download backup file.');
    const resp = await res.json();
    const data = resp.data || resp;

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kosai_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded successfully!', 'success');
  } catch (e) {
    showToast('Backup failed: ' + e.message, 'error');
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
    const token = localStorage.getItem('admin_token');
    try {
      const parsed = JSON.parse(e.target.result);
      // Unwrap if wrapped in {success, data} envelope
      const backupData = parsed.data || parsed;
      if (!backupData._exported_at) throw new Error('Invalid backup file structure.');

      const res = await fetch(`${baseUrl}/api/admin/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(backupData),
      });
      const resData = await res.json();
      if (res.ok) {
        showToast('Database restored successfully!', 'success');
        refreshDashboardData();
      } else {
        throw new Error(resData.error || 'Restoration failed.');
      }
    } catch (err) {
      showToast('Restore failed: ' + err.message, 'error');
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

  // Tab-specific initialization
  if (tabId === 'receipt-builder') {
    rbInitReceiptBuilder();
  }

  // Update path display
  const pathName =
    tabId === 'system-settings'
      ? 'System Settings'
      : tabId === 'user-management'
        ? 'User Management'
        : tabId.charAt(0).toUpperCase() + tabId.slice(1);
  document.getElementById('current-path-display').textContent =
    pathName === 'Dashboard' ? 'Dashboard' : `Dashboard / ${pathName}`;

  // Highlight sidebar tab
  document.querySelectorAll('.tab-link').forEach((link) => {
    link.classList.remove('bg-amber-500/10', 'text-amber-500');
    link.classList.add('text-slate-400');
  });
  // Find clicking source link (simplified matching)
  const activeLink = Array.from(document.querySelectorAll('.tab-link')).find((link) => {
    const onclickAttr = link.getAttribute('onclick');
    return onclickAttr && onclickAttr.includes(tabId);
  });
  if (activeLink) {
    activeLink.classList.remove('text-slate-400');
    activeLink.classList.add('bg-amber-500/10', 'text-amber-500');
  }

  // Update mobile bottom nav
  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
    btn.classList.remove('active-mobile-nav');
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active-mobile-nav');
    }
  });

  // Fix Leaflet rendering delay when opening a previously hidden container
  if (tabId === 'dispatch-map') {
    initLeafletMap();
    setTimeout(() => {
      if (map) {
        map.invalidateSize(true);
        // Also trigger redraw of markers
        loadJobsData();
      }
    }, 100);
  }

  if (tabId === 'jobs') {
    loadJobsDashboardData();
  }

  if (tabId === 'dashboard') {
    dbInitDashboard();
  }

  if (tabId === 'attendance' && typeof window.loadAttendance === 'function') {
    window.loadAttendance();
  }

  if (tabId === 'portfolio' && typeof loadPortfolioProjects === 'function') {
    loadPortfolioProjects();
  }

  if (tabId === 'tickets' && typeof tkInit === 'function') {
    tkInit();
  }

  if (tabId === 'landing-page' && typeof loadLandingPageContent === 'function') {
    loadLandingPageContent();
  }

  if (tabId === 'pos') {
    window.loadPosData();
    setTimeout(() => {
      const searchInput = document.getElementById('pos-stock-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, 150);
  }

  if (tabId === 'inventory') {
    window.loadInventoryData();
  }

  if (tabId === 'currency') {
    window.loadCashSafeData();
  }

  if (tabId === 'amc') {
    cdInitClients();
  }

  if (tabId === 'distributors') {
    window.loadDistributorsData();
  }

  if (tabId === 'warranty') {
    window.loadRMAData();
  }

  if (tabId === 'service-fees') {
    sfInitServiceFees();
  }

  if (tabId === 'surveys') {
    window.populateSurveyClientDropdown();
    window.loadSurveysData();
    window.loadQuotationsData();
  }

  if (tabId === 'system-settings') {
    window.loadPdfBuilderConfig();
  }
}

// ── Shared Client Dropdown Utility ──────────────────────────────────────────

/**
 * Load clients from API and populate a select element.
 * @param {string} selectId - The ID of the select element
 * @param {object} options - Optional config: { includeNew: boolean, placeholder: string }
 * @returns {Promise<Array>} The clients array
 */
async function loadClientsForDropdown(selectId, options = {}) {
  const { includeNew = false, placeholder = '-- Select Client --' } = options;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const sel = document.getElementById(selectId);
  if (!sel) return [];

  try {
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const clients = Array.isArray(data) ? data : (data?.clients || data?.data?.clients || data?.data || []);

    sel.innerHTML = `<option value="">${placeholder}</option>`;
    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.company_name}${c.amc_status ? ' (' + c.amc_status + ')' : ''}`;
      sel.appendChild(opt);
    });

    if (includeNew) {
      const o = document.createElement('option');
      o.value = '__NEW__';
      o.textContent = '➕ Create New...';
      sel.appendChild(o);
    }

    return clients;
  } catch (e) {
    console.warn('Failed to load clients for dropdown:', selectId, e);
    return [];
  }
}
window.loadClientsForDropdown = loadClientsForDropdown;

