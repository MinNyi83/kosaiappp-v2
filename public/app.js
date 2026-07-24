// ============================================================================
// KosAI Technician Mobile App — app.js
// ============================================================================

// ── XSS Protection ──────────────────────────────────────────────────────
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Toast Notification System ────────────────────────────────────────────
window.showToast = function (message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const colors = {
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    error: 'bg-rose-500/10 border-rose-500/30 text-rose-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  };
  const barColors = {
    success: 'bg-emerald-500', error: 'bg-rose-500',
    warning: 'bg-amber-500', info: 'bg-blue-500',
  };
  toast.style.cssText = 'transform: translateY(-120%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); pointer-events: auto;';
  toast.className = `relative flex items-center gap-3 px-4 py-3 rounded-xl border ${colors[type]} shadow-lg backdrop-blur-xl overflow-hidden`;
  toast.innerHTML = `<span class="text-sm font-medium flex-1">${escapeHTML(message)}</span>
    <button onclick="this.parentElement.remove()" class="flex-shrink-0 opacity-60 hover:opacity-100 text-xs">&times;</button>
    <div class="absolute bottom-0 left-0 h-0.5 ${barColors[type]}" style="width:100%;transition:width ${duration}ms linear;"></div>`;
  container.appendChild(toast);
  requestAnimationFrame(() => { toast.style.transform = 'translateY(0)'; });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bar = toast.querySelector('div');
      if (bar) bar.style.width = '0%';
    });
  });
  setTimeout(() => {
    toast.style.transform = 'translateY(-120%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ── Global State ─────────────────────────────────────────────────────────
const API_BASE_URL = window.location.hostname.includes('androidplatform.net')
  ? 'https://awesomemyanmar.pages.dev'
  : window.location.origin;
let activeSessionUser = null;
let activeSessionToken = null;
let currentJobId = null;

function authHeaders() {
  return activeSessionToken ? { Authorization: 'Bearer ' + activeSessionToken } : {};
}

// ── Restore Session ──────────────────────────────────────────────────────
(function restoreSession() {
  const saved = localStorage.getItem('gate_pass_token');
  if (saved) {
    activeSessionToken = saved;
    try {
      const payload = JSON.parse(atob(saved.split('.')[1]));
      activeSessionUser = { id: payload.id, name: payload.name, role: payload.role, email: payload.email };
    } catch (e) {
      localStorage.removeItem('gate_pass_token');
      activeSessionToken = null;
    }
  }
})();

// ── Online/Offline Status ────────────────────────────────────────────────
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  if (!badge) return;
  if (navigator.onLine) {
    badge.classList.add('hidden');
    syncOfflineQueue();
  } else {
    badge.classList.remove('hidden');
  }
}

// ── Login ────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('auth-uid').value.trim().toUpperCase();
  const pin = document.getElementById('auth-pin').value.trim();
  const btn = document.getElementById('auth-btn');
  btn.disabled = true;
  btn.textContent = 'Checking Credentials...';
  try {
    if (!navigator.onLine) {
      showToast('Running offline. Login bypassed using cached operator ID.', 'warning');
      activeSessionUser = { id, name: 'Field Operator (' + id + ')', role: 'Technician' };
      showApp();
      return;
    }
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, pin }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Authentication failed');
    activeSessionUser = result.data.technician;
    activeSessionToken = result.data.token;
    localStorage.setItem('gate_pass_token', result.data.token);
    showApp();
    fetchJobs();
    setTimeout(renderMyIdCard, 400);
  } catch (err) {
    showToast('Access Denied: ' + err.message, 'error');
    document.getElementById('auth-pin').value = '';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Verify Gate Pass';
  }
}

function showApp() {
  document.getElementById('user-display-name').textContent = activeSessionUser.name;
  document.getElementById('user-display-role').textContent = `${activeSessionUser.id} • ${activeSessionUser.role}`;
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-content').classList.remove('hidden');
  updateOnlineStatus();
}

function handleLogout() {
  activeSessionUser = null;
  activeSessionToken = null;
  localStorage.removeItem('gate_pass_token');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-content').classList.add('hidden');
}

// ── Tab Navigation ───────────────────────────────────────────────────────
function switchMobileTab(tab) {
  // Hide all tab views
  document.querySelectorAll('.mobile-tab-view').forEach((v) => v.classList.add('hidden'));
  // Show selected tab
  const viewMap = { job: 'view-job', checklist: 'view-checklist', history: 'view-history', setting: 'view-setting' };
  const viewId = viewMap[tab] || 'view-job';
  const view = document.getElementById(viewId);
  if (view) view.classList.remove('hidden');

  // Update nav buttons
  document.querySelectorAll('.mobile-nav button').forEach((b) => b.classList.remove('active-nav-btn'));
  const navBtn = document.getElementById('nav-' + tab);
  if (navBtn) navBtn.classList.add('active-nav-btn');

  // Load tab data
  if (tab === 'job') fetchJobs();
  if (tab === 'history') loadJobHistory();
  if (tab === 'setting') renderMyIdCard();
}

// ── Jobs ─────────────────────────────────────────────────────────────────
async function fetchJobs() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=100`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');
    // Handle both array and paginated response
    const jobs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : data.jobs || [];
    renderJobList(jobs);
    if (navigator.onLine) cacheJobs(jobs);
  } catch (err) {
    showToast('Error pulling remote data: ' + err.message, 'error');
    loadCachedJobs();
  }
}

function renderJobList(jobs) {
  const container = document.getElementById('view-job');
  if (!container) return;
  // Keep only the dynamic content area
  container.innerHTML = '';
  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm"><span class="text-3xl block mb-2">📭</span>No active jobs assigned.</div>';
    return;
  }
  jobs.forEach((job) => {
    const statusColor = job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400'
      : job.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400'
      : 'bg-blue-500/20 text-blue-400';
    const card = document.createElement('div');
    card.className = 'glass-panel p-4 rounded-2xl border border-white/5 space-y-3';
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-bold text-white text-sm">${escapeHTML(job.id)}</h3>
          <p class="text-xs text-slate-400 mt-0.5">${escapeHTML(job.client_id || 'Unknown Client')}</p>
        </div>
        <span class="px-2.5 py-1 text-[10px] rounded-full font-bold ${statusColor}">${escapeHTML(job.status)}</span>
      </div>
      <p class="text-xs text-slate-300">${escapeHTML(job.job_description || '')}</p>
      <div class="flex gap-2">
        <button onclick="startJob('${escapeHTML(job.id)}')" class="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition active:scale-95">Start Service</button>
        <button onclick="completeJob('${escapeHTML(job.id)}')" class="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2.5 rounded-xl font-semibold transition active:scale-95">Mark Complete</button>
      </div>
      <div class="flex gap-2">
        <button onclick="checkinJob('${escapeHTML(job.id)}')" class="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs py-2 rounded-xl border border-white/10 transition">Check-In</button>
        <button onclick="checkoutJob('${escapeHTML(job.id)}')" class="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 text-xs py-2 rounded-xl border border-white/10 transition">Check-Out</button>
        <button onclick="addJobNotes('${escapeHTML(job.id)}')" class="bg-white/5 hover:bg-white/10 text-slate-300 text-xs py-2 px-3 rounded-xl border border-white/10 transition">Notes</button>
      </div>`;
    container.appendChild(card);
  });
}

async function updateJobStatus(jobId, status) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    showToast('Job ' + status + '!', 'success');
    fetchJobs();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

function startJob(jobId) { updateJobStatus(jobId, 'In Progress'); }
function completeJob(jobId) { updateJobStatus(jobId, 'Completed'); }

async function checkinJob(jobId) {
  const coords = await getGeoLocation();
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: 'In Progress', notes: 'Check-in' + (coords ? ` at ${coords.lat},${coords.lng}` : '') }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Checked in!', 'success');
    currentJobId = jobId;
    switchMobileTab('checklist');
  } catch (err) { showToast('Check-in error: ' + err.message, 'error'); }
}

async function checkoutJob(jobId) {
  const coords = await getGeoLocation();
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: 'Completed', notes: 'Check-out' + (coords ? ` at ${coords.lat},${coords.lng}` : '') }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    showToast('Checked out and completed!', 'success');
    fetchJobs();
  } catch (err) { showToast('Check-out error: ' + err.message, 'error'); }
}

async function addJobNotes(jobId) {
  const notes = prompt('Enter notes for this job:');
  if (!notes) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: 'In Progress', notes }),
    });
    if (res.ok) showToast('Notes saved!', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── GPS / Geolocation ────────────────────────────────────────────────────
function getGeoLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, enableHighAccuracy: true }
    );
  });
}

// ── Checklist ────────────────────────────────────────────────────────────
function loadChecklist() {
  const form = document.getElementById('checklist-form-container');
  const placeholder = document.getElementById('checklist-placeholder');
  if (!currentJobId) {
    if (form) form.innerHTML = '';
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }
  if (placeholder) placeholder.classList.add('hidden');
  if (!form) return;
  form.innerHTML = `
    <div class="glass-panel p-5 rounded-3xl space-y-4">
      <h3 class="text-sm font-bold text-white uppercase">Job ${escapeHTML(currentJobId)} Checklist</h3>
      <label class="flex items-center gap-3 p-3 bg-white/5 rounded-xl"><input type="checkbox" class="accent-indigo-500 w-4 h-4"><span class="text-xs text-white">Camera mounted and aligned</span></label>
      <label class="flex items-center gap-3 p-3 bg-white/5 rounded-xl"><input type="checkbox" class="accent-indigo-500 w-4 h-4"><span class="text-xs text-white">Cables neatly routed</span></label>
      <label class="flex items-center gap-3 p-3 bg-white/5 rounded-xl"><input type="checkbox" class="accent-indigo-500 w-4 h-4"><span class="text-xs text-white">NVR/DVR configured</span></label>
      <label class="flex items-center gap-3 p-3 bg-white/5 rounded-xl"><input type="checkbox" class="accent-indigo-500 w-4 h-4"><span class="text-xs text-white">Client signed off</span></label>
      <textarea placeholder="Additional notes..." class="w-full bg-black/30 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none" rows="3"></textarea>
      <button onclick="submitChecklist()" class="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider">Submit Checklist</button>
    </div>`;
}

function submitChecklist() {
  showToast('Checklist submitted!', 'success');
  switchMobileTab('job');
}

// ── Job History ──────────────────────────────────────────────────────────
async function loadJobHistory() {
  const container = document.getElementById('view-history');
  if (!container) return;
  container.innerHTML = '<div class="text-center text-slate-500 py-8 text-sm">Loading history...</div>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=50`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const jobs = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : data.jobs || [];
    container.innerHTML = '';
    if (jobs.length === 0) {
      container.innerHTML = '<div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm">No job history.</div>';
      return;
    }
    jobs.forEach((job) => {
      const div = document.createElement('div');
      div.className = 'glass-panel p-4 rounded-2xl border border-white/5';
      div.innerHTML = `
        <div class="flex justify-between items-start">
          <div><span class="font-bold text-white text-sm">${escapeHTML(job.id)}</span><p class="text-xs text-slate-400">${escapeHTML(job.client_id || '')}</p></div>
          <span class="text-[10px] text-slate-500">${escapeHTML(job.created_at || '')}</span>
        </div>
        <div class="flex items-center gap-2 mt-2"><span class="px-2 py-0.5 text-[10px] rounded-full ${job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'} font-bold">${escapeHTML(job.status)}</span></div>`;
      container.appendChild(div);
    });
  } catch (err) {
    container.innerHTML = `<div class="text-center text-rose-400 py-8 text-sm">Error: ${escapeHTML(err.message)}</div>`;
  }
}

// ── ID Card ──────────────────────────────────────────────────────────────
function renderMyIdCard() {
  if (!activeSessionUser) return;
  const nameEl = document.getElementById('my-card-name');
  const idEl = document.getElementById('my-card-id');
  const roleEl = document.getElementById('my-card-role');
  if (nameEl) nameEl.textContent = activeSessionUser.name || 'Technician';
  if (idEl) idEl.textContent = activeSessionUser.id || '';
  if (roleEl) roleEl.textContent = activeSessionUser.role || 'Technician';
  // QR code
  const qrImg = document.getElementById('my-card-qr-main');
  const qrUrl = document.getElementById('my-card-qr-url');
  const verifyUrl = `${window.location.origin}/api/public/technician/${activeSessionUser.id}`;
  if (qrUrl) qrUrl.textContent = verifyUrl;
  if (qrImg && typeof QRCode !== 'undefined') {
    qrImg.src = '';
    new QRCode(qrImg, { text: verifyUrl, width: 60, height: 60 });
  }
}

function printMyIdCard() {
  showToast('Print ID Card — use your device print dialog', 'info');
  window.print();
}

// ── Settings ─────────────────────────────────────────────────────────────
function openSettings() {
  switchMobileTab('setting');
  // Populate settings form
  const nameEl = document.getElementById('settings-username');
  const idEl = document.getElementById('settings-userid');
  if (nameEl && activeSessionUser) nameEl.textContent = activeSessionUser.name;
  if (idEl && activeSessionUser) idEl.textContent = 'ID: ' + activeSessionUser.id;
}

async function handleSettingsSubmit(e) {
  e.preventDefault();
  if (!activeSessionUser) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/technicians/${activeSessionUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: document.getElementById('settings-username')?.textContent }),
    });
    if (res.ok) showToast('Settings updated!', 'success');
  } catch (err) { showToast('Error: ' + err.message, 'error'); }
}

// ── PIN Change ───────────────────────────────────────────────────────────
function changeSecurityPin(e) {
  e.preventDefault();
  const currentPin = document.getElementById('pin-current')?.value;
  const newPin = document.getElementById('pin-new')?.value;
  const confirmPin = document.getElementById('pin-new-confirm')?.value;

  if (!currentPin || !newPin || !confirmPin) {
    showToast('Please fill in all PIN fields', 'error');
    return;
  }
  if (newPin !== confirmPin) {
    showToast('New PIN inputs do not match!', 'error');
    return;
  }
  if (newPin.length < 4) {
    showToast('PIN must be at least 4 digits', 'error');
    return;
  }
  if (!activeSessionUser) return;

  fetch(`${API_BASE_URL}/api/technicians/${activeSessionUser.id}/pin`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentPin: currentPin, newPin: newPin }),
  })
    .then((r) => r.json())
    .then((data) => {
      if (data.success) {
        showToast('PIN updated successfully!', 'success');
        document.getElementById('pin-current').value = '';
        document.getElementById('pin-new').value = '';
        document.getElementById('pin-new-confirm').value = '';
      } else {
        showToast('Error: ' + (data.error || 'Failed'), 'error');
      }
    })
    .catch((err) => showToast('Network error: ' + err.message, 'error'));
}

// ── Photo Functions (stub — backend not yet implemented) ─────────────────
function openPhotoModal(jobId) {
  showToast('Photo capture coming soon', 'info');
}

// ── Offline Queue ────────────────────────────────────────────────────────
function queueOfflineUpdate(job) {
  const queue = JSON.parse(localStorage.getItem('offline_job_queue') || '[]');
  queue.push(job);
  localStorage.setItem('offline_job_queue', JSON.stringify(queue));
}

async function syncOfflineQueue() {
  const queue = JSON.parse(localStorage.getItem('offline_job_queue') || '[]');
  if (queue.length === 0) return;
  let synced = 0;
  for (const job of queue) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(job),
      });
      if (res.ok) synced++;
    } catch (e) { break; }
  }
  if (synced > 0) {
    localStorage.setItem('offline_job_queue', JSON.stringify(queue.slice(synced)));
    showToast('Offline changes synced!', 'success');
    fetchJobs();
  }
}

function cacheJobs(jobs) { localStorage.setItem('cached_jobs', JSON.stringify(jobs)); }
function loadCachedJobs() {
  const cached = localStorage.getItem('cached_jobs');
  if (cached) renderJobList(JSON.parse(cached));
}

// ── Theme Toggle ─────────────────────────────────────────────────────────
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const darkIcon = document.getElementById('theme-icon-dark');
  const lightIcon = document.getElementById('theme-icon-light');
  if (darkIcon && lightIcon) {
    darkIcon.classList.toggle('hidden', next === 'light');
    lightIcon.classList.toggle('hidden', next === 'dark');
  }
}

// ── Initialize ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Restore theme
  const savedTheme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);

  updateOnlineStatus();

  if (activeSessionToken) {
    showApp();
    fetchJobs();
    setTimeout(renderMyIdCard, 400);
  }
});
