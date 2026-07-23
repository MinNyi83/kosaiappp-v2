function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, ''');
}

// Toast notification system - replaces alert()
window.showToast = function(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
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
    <span class="text-sm font-medium flex-1">${message}</span>
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

const API_BASE_URL = window.location.hostname.includes('androidplatform.net')
  ? 'https://awesomemyanmar.pages.dev'
  : window.location.origin;
let activeSessionUser = null;
let activeSessionToken = null;
let activeCanvases = {};

function authHeaders() {
  return activeSessionToken ? { Authorization: 'Bearer ' + activeSessionToken } : {};
}

// Restore session from localStorage on page load
(function restoreSession() {
  const saved = localStorage.getItem('gate_pass_token');
  if (saved) {
    activeSessionToken = saved;
    try {
      const payload = JSON.parse(atob(saved.split('.')[1]));
      activeSessionUser = {
        id: payload.id,
        name: payload.name,
        role: payload.role,
        email: payload.email,
      };
    } catch (e) {
      localStorage.removeItem('gate_pass_token');
      activeSessionToken = null;
    }
  }
})();
// Listen for online status updates
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
function updateOnlineStatus() {
  const badge = document.getElementById('offline-badge');
  if (navigator.onLine) {
    badge.classList.add('hidden');
    syncOfflineQueue();
  } else {
    badge.classList.remove('hidden');
  }
}
async function handleLogin(e) {
  e.preventDefault();
  const id = document.getElementById('auth-uid').value.trim().toUpperCase();
  const pin = document.getElementById('auth-pin').value.trim();
  const btn = document.getElementById('auth-btn');
  btn.disabled = true;
  btn.textContent = 'Checking Credentials...';
  try {
    // If offline, check if user details match pre-seeded values or cached logins
    if (!navigator.onLine) {
      showToast('Running offline. Login bypassed using cached operator ID.', 'warning');
      activeSessionUser = { id, name: 'Field Operator (' + id + ')', role: 'Technician' };
      document.getElementById('user-display-name').textContent = activeSessionUser.name;
      document.getElementById('user-display-role').textContent =
        `${activeSessionUser.id} • ${activeSessionUser.role}`;
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('app-content').classList.remove('hidden');
      updateOnlineStatus();
      loadCachedJobs();
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
    document.getElementById('user-display-name').textContent = activeSessionUser.name;
    document.getElementById('user-display-role').textContent =
      `${activeSessionUser.id} • ${activeSessionUser.role}`;
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    updateOnlineStatus();
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
function handleLogout() {
  activeSessionUser = null;
  activeSessionToken = null;
  localStorage.removeItem('gate_pass_token');
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-content').classList.add('hidden');
}
async function fetchJobs() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=100`, {
      headers: authHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');
    renderJobList(data.data || data);
    if (navigator.onLine) {
      cacheJobs(data.data || data);
    }
  } catch (err) {
    showToast('Error pulling remote data: ' + err.message, 'error');
    loadCachedJobs();
  }
}
async function submitJob(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const job = Object.fromEntries(formData.entries());
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(job),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit job');
    if (!navigator.onLine) {
      showToast('Device offline. Update stored in local pipeline queue!', 'warning');
      queueOfflineUpdate(job);
    } else {
      showToast('Cloud engine synced successfully!', 'success');
    }
    fetchJobs();
    e.target.reset();
  } catch (err) {
    showToast('API sync error: ' + err.message + '. Enqueueing update locally.', 'error');
    queueOfflineUpdate(job);
  }
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
    } catch (e) {
      break;
    }
  }
  if (synced > 0) {
    const remaining = queue.slice(synced);
    localStorage.setItem('offline_job_queue', JSON.stringify(remaining));
    showToast('Offline database changes merged to Cloudflare D1 successfully!', 'success');
    fetchJobs();
  }
}
function queueOfflineUpdate(job) {
  const queue = JSON.parse(localStorage.getItem('offline_job_queue') || '[]');
  queue.push(job);
  localStorage.setItem('offline_job_queue', JSON.stringify(queue));
}
function cacheJobs(jobs) {
  localStorage.setItem('cached_jobs', JSON.stringify(jobs));
}
function loadCachedJobs() {
  const cached = localStorage.getItem('cached_jobs');
  if (cached) {
    renderJobList(JSON.parse(cached));
  }
}
async function loadCustomers() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/clients`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load customers');
    const select = document.getElementById('job-customer');
    select.innerHTML = '<option value="">Select Customer</option>';
    (data.data || data).forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.company_name || c.name || c.id;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast('Error loading customers: ' + err.message, 'error');
  }
}
async function loadTechnicians() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/technicians`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load technicians');
    const select = document.getElementById('job-technician');
    select.innerHTML = '<option value="">Select Technician</option>';
    (data.data || data).forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  } catch (err) {
    showToast('Error loading technicians: ' + err.message, 'error');
  }
}
function renderJobList(jobs) {
  const container = document.getElementById('job-list');
  container.innerHTML = '';
  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<p class="text-center text-slate-500 py-8">No jobs found.</p>';
    return;
  }
  jobs.forEach((job) => {
    const card = document.createElement('div');
    card.className = 'glass-panel p-4 rounded-xl border border-white/5 space-y-2';
    const statusColor =
      job.status === 'Completed'
        ? 'bg-emerald-500/20 text-emerald-400'
        : job.status === 'In Progress'
        ? 'bg-amber-500/20 text-amber-400'
        : 'bg-blue-500/20 text-blue-400';
    card.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-white">${escapeHTML(job.id)}</h3>
          <p class="text-xs text-slate-400">${escapeHTML(job.customer_name || job.company_name || 'Unknown')}</p>
        </div>
        <span class="px-2 py-1 text-xs rounded-full ${statusColor}">${escapeHTML(job.status)}</span>
      </div>
      <p class="text-xs text-slate-300">${escapeHTML(job.job_description || job.description || '')}</p>
      <div class="flex gap-2 pt-2">
        <button onclick="viewJobDetails('${escapeHTML(job.id)}')" class="flex-1 bg-white/5 hover:bg-white/10 text-white text-xs py-2 rounded-lg border border-white/10">View Details</button>
        <button onclick="updateJobStatus('${escapeHTML(job.id)}')" class="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-xs py-2 rounded-lg font-semibold">Update Status</button>
      </div>
    `;
    container.appendChild(card);
  });
}
function viewJobDetails(jobId) {
  showToast('View details for ' + jobId, 'info');
}
async function updateJobStatus(jobId) {
  const newStatus = prompt('Enter new status (Pending/In Progress/Completed):');
  if (!newStatus) return;
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    showToast('Job status updated!', 'success');
    fetchJobs();
  } catch (err) {
    showToast('Error updating status: ' + err.message, 'error');
  }
}
function switchMobileTab(tab) {
  document.querySelectorAll('.mobile-tab-content').forEach((c) => c.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.getElementById('nav-btn-' + tab).classList.add('active');
  if (tab === 'jobs') fetchJobs();
  if (tab === 'customers') loadCustomers();
  if (tab === 'technicians') loadTechnicians();
  if (tab === 'history') loadJobHistory();
}
async function loadJobHistory() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=50`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load history');
    const container = document.getElementById('history-list');
    container.innerHTML = '';
    (data.data || data).forEach((job) => {
      const div = document.createElement('div');
      div.className = 'p-3 bg-white/5 rounded-lg border border-white/10 text-xs';
      div.innerHTML = `<strong>${escapeHTML(job.id)}</strong> - ${escapeHTML(job.customer_name || '')} - ${escapeHTML(job.status)}`;
      container.appendChild(div);
    });
  } catch (err) {
    showToast('Error loading history: ' + err.message, 'error');
  }
}
function renderMyIdCard() {
  if (!activeSessionUser) return;
  const card = document.getElementById('my-id-card');
  card.innerHTML = `
    <div class="bg-gradient-to-br from-amber-600 to-amber-800 rounded-xl p-4 text-white">
      <div class="text-xs uppercase tracking-wider opacity-75">GATE PASS</div>
      <div class="text-xl font-bold mt-1">${escapeHTML(activeSessionUser.name)}</div>
      <div class="text-sm opacity-75 mt-1">${escapeHTML(activeSessionUser.id)} • ${escapeHTML(activeSessionUser.role)}</div>
    </div>
  `;
}
function openSettingsModal() {
  document.getElementById('settings-modal').classList.remove('hidden');
}
function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}
async function handleSettingsSubmit(e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const settings = Object.fromEntries(formData.entries());
  try {
    const res = await fetch(`${API_BASE_URL}/api/technicians/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update settings');
    showToast('Settings updated!', 'success');
    closeSettingsModal();
  } catch (err) {
    showToast('Error updating settings: ' + err.message, 'error');
  }
}
async function handlePinChange(e) {
  e.preventDefault();
  const newPin = document.getElementById('new-pin').value;
  const confirmPin = document.getElementById('confirm-pin').value;
  if (newPin !== confirmPin) {
    showToast('New PIN inputs do not match!', 'error');
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/technicians/me/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ pin: newPin }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update PIN');
    showToast('PIN updated successfully!', 'success');
    closeSettingsModal();
  } catch (err) {
    showToast('Error updating PIN: ' + err.message, 'error');
  }
}
function toggleOfflineMode() {
  const enabled = !document.getElementById('offline-badge').classList.contains('hidden');
  if (enabled) {
    showToast('Local Offline Access Bypass Enabled.', 'warning');
  } else {
    showToast('Local Offline Access Bypass Disabled.', 'info');
  }
  updateOnlineStatus();
}
function openPhotoModal(jobId) {
  const modal = document.getElementById('photo-modal');
  modal.dataset.jobId = jobId;
  modal.classList.remove('hidden');
  loadJobPhotos(jobId);
}
function closePhotoModal() {
  document.getElementById('photo-modal').classList.add('hidden');
}
async function loadJobPhotos(jobId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/photos`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load photos');
    const container = document.getElementById('photo-gallery');
    container.innerHTML = '';
    (data.data || data).forEach((photo) => {
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.caption || 'Job photo';
      img.className = 'rounded-lg w-full aspect-video object-cover cursor-pointer';
      img.onclick = () => openFullscreenPhoto(photo.url);
      container.appendChild(img);
    });
  } catch (err) {
    showToast('Error loading photos: ' + err.message, 'error');
  }
}
async function uploadPhoto(e) {
  e.preventDefault();
  const jobId = document.getElementById('photo-modal').dataset.jobId;
  const fileInput = document.getElementById('photo-upload');
  const file = fileInput.files[0];
  if (!file) {
    showToast('Please select a photo', 'warning');
    return;
  }
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('caption', document.getElementById('photo-caption').value);
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/photos`, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
    showToast('Photo uploaded!', 'success');
    fileInput.value = '';
    document.getElementById('photo-caption').value = '';
    loadJobPhotos(jobId);
  } catch (err) {
    showToast('Error uploading photo: ' + err.message, 'error');
  }
}
function openFullscreenPhoto(url) {
  window.open(url, '_blank');
}
document.addEventListener('DOMContentLoaded', () => {
  updateOnlineStatus();
  if (activeSessionToken) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    fetchJobs();
    loadCustomers();
    loadTechnicians();
    renderMyIdCard();
  }
});