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
  const styles = {
    success: { bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)', text: '#34d399', bar: '#10b981' },
    error:   { bg: 'rgba(244,63,94,0.12)', border: 'rgba(244,63,94,0.3)', text: '#fb7185', bar: '#f43f5e' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24', bar: '#f59e0b' },
    info:    { bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', text: '#60a5fa', bar: '#3b82f6' }
  };
  const s = styles[type] || styles.info;
  toast.style.cssText = `transform: translateY(-120%) scale(0.95); opacity: 0; transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease-out; pointer-events: auto; background: ${s.bg}; border: 1px solid ${s.border}; color: ${s.text};`;
  toast.className = 'relative flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg backdrop-blur-xl overflow-hidden';
  toast.innerHTML = `<span class="text-sm font-medium flex-1">${escapeHTML(message)}</span>
    <button onclick="this.parentElement.remove()" class="flex-shrink-0 opacity-60 hover:opacity-100 text-xs">&times;</button>
    <div class="absolute bottom-0 left-0 h-0.5" style="background:${s.bar};width:100%;transition:width ${duration}ms linear;"></div>`;
  container.appendChild(toast);
  // Entrance: slide down + fade in + scale up
  requestAnimationFrame(() => {
    toast.style.transform = 'translateY(0) scale(1)';
    toast.style.opacity = '1';
  });
  // Animate progress bar
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const bar = toast.querySelector('div');
      if (bar) bar.style.width = '0%';
    });
  });
  // Exit: slide up + fade out + scale down
  setTimeout(() => {
    toast.style.transition = 'transform 0.3s ease-in, opacity 0.25s ease-in';
    toast.style.transform = 'translateY(-120%) scale(0.95)';
    toast.style.opacity = '0';
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
  if (tab === 'checklist') loadChecklist();
  if (tab === 'history') loadJobHistory();
  if (tab === 'setting') renderMyIdCard();
}

// ── Jobs ─────────────────────────────────────────────────────────────────
async function fetchJobs() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=100`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to fetch jobs');
    const jobs = data.data?.jobs || data.data || data.jobs || [];
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
  // Filter to active jobs only (Pending, In Progress)
  const activeStatuses = ['Pending', 'In Progress', 'Scheduled', 'Assigned'];
  const activeJobs = (jobs || []).filter(j => activeStatuses.includes(j.status));
  container.innerHTML = '';
  if (activeJobs.length === 0) {
    container.innerHTML = '<div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm"><span class="text-3xl block mb-2">📭</span>No active jobs assigned.</div>';
    return;
  }
  activeJobs.forEach((job) => {
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

function startJob(jobId) {
  currentJobId = jobId;
  updateJobStatus(jobId, 'In Progress');
  switchMobileTab('checklist');
}
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
async function loadChecklist() {
  const form = document.getElementById('checklist-form-container');
  const placeholder = document.getElementById('checklist-placeholder');
  if (!currentJobId) {
    if (form) form.innerHTML = '';
    if (placeholder) placeholder.classList.remove('hidden');
    return;
  }
  if (placeholder) placeholder.classList.add('hidden');
  if (!form) return;

  // Fetch job details
  let job = null;
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs/${currentJobId}`, { headers: authHeaders() });
    const data = await res.json();
    job = data.data || data;
  } catch (e) {}

  const jobType = (job?.service_type || 'CCTV').toUpperCase();
  const clientName = job?.company_name || job?.client_id || 'Client';
  const jobDesc = job?.job_description || '';

  // Different checklists based on service type
  const checklists = {
    CCTV: [
      { section: 'Site Assessment', items: ['Surveyed installation area', 'Verified power outlet availability', 'Checked network cable routing path', 'Confirmed camera mounting positions'] },
      { section: 'Hardware Installation', items: ['Cameras mounted and securely fixed', 'Camera angles adjusted and aligned', 'Cables neatly routed and secured', 'Weatherproofing applied (outdoor units)', 'Power connections verified'] },
      { section: 'System Configuration', items: ['NVR/DVR initialized and configured', 'Camera feeds verified on monitor', 'Recording schedule set correctly', 'Motion detection zones configured', 'Remote access configured and tested'] },
      { section: 'Quality Check', items: ['All cameras showing clear footage', 'Night vision / IR tested', 'Playback functionality verified', 'Storage capacity confirmed'] },
      { section: 'Client Handover', items: ['Demonstrated system to client', 'Provided user credentials', 'Shared mobile app access', 'Client signed off on completion'] },
    ],
    NAS: [
      { section: 'Pre-Installation', items: ['Rack space verified', 'Power capacity confirmed', 'Network drop available', 'Drive bays inspected'] },
      { section: 'Hardware Setup', items: ['NAS unit mounted in rack', 'Hard drives installed and seated', 'Network cable connected', 'Power supply connected', 'LED status indicators verified'] },
      { section: 'Configuration', items: ['RAID array initialized', 'Storage pool created', 'Shared folders configured', 'User accounts created', 'Backup schedule configured'] },
      { section: 'Testing & Handover', items: ['Read/write speeds tested', 'Remote access verified', 'Backup restoration tested', 'Client trained on basic operations', 'Client signed off'] },
    ],
    NETWORK: [
      { section: 'Site Survey', items: ['Existing network assessed', 'Cable paths planned', 'Equipment rack location confirmed'] },
      { section: 'Installation', items: ['Switches/routers mounted', 'Cables terminated and tested', 'Patch panel labeled', 'Power over Ethernet verified'] },
      { section: 'Configuration', items: ['VLANs configured', 'Firewall rules applied', 'WiFi access points configured', 'DHCP scope defined', 'DNS settings applied'] },
      { section: 'Verification', items: ['All ports tested and active', 'Internet connectivity verified', 'Internal network tested', 'Security audit completed', 'Client signed off'] },
    ],
  };

  const sections = checklists[jobType] || checklists.CCTV;

  form.innerHTML = `
    <div class="space-y-4">
      <!-- Job Info Header -->
      <div class="glass-panel p-4 rounded-2xl">
        <div class="flex items-center justify-between mb-2">
          <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">${escapeHTML(jobType)} Service</span>
          <span class="px-2 py-0.5 text-[10px] rounded-full bg-amber-500/20 text-amber-400 font-bold">In Progress</span>
        </div>
        <h3 class="text-sm font-bold text-white">${escapeHTML(currentJobId)}</h3>
        <p class="text-xs text-slate-400 mt-1">${escapeHTML(clientName)}</p>
        ${jobDesc ? `<p class="text-[11px] text-slate-300 mt-2 leading-relaxed">${escapeHTML(jobDesc)}</p>` : ''}
      </div>

      <!-- Collapsible Checklist Sections -->
      ${sections.map((section, si) => `
        <div class="glass-panel rounded-2xl overflow-hidden">
          <button onclick="toggleSection(this)" class="w-full flex items-center justify-between p-4 text-left active:bg-white/5 transition">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">${si + 1}</span>
              <span class="text-xs font-bold text-white uppercase tracking-wider">${escapeHTML(section.section)}</span>
            </div>
            <svg class="w-4 h-4 text-slate-400 transition-transform duration-300 section-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <div class="section-content hidden px-4 pb-4 space-y-2">
            ${section.items.map((item, ii) => `
              <label class="flex items-center gap-3 p-3 bg-white/5 rounded-xl active:bg-white/10 transition cursor-pointer">
                <input type="checkbox" class="checklist-cb accent-indigo-500 w-5 h-5 rounded">
                <span class="text-[13px] text-slate-200 leading-snug">${escapeHTML(item)}</span>
              </label>
            `).join('')}
          </div>
        </div>
      `).join('')}

      <!-- Hardware Replacement / Add -->
      <div class="glass-panel rounded-2xl overflow-hidden">
        <button onclick="toggleSection(this)" class="w-full flex items-center justify-between p-4 text-left active:bg-white/5 transition">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px] font-bold">+</span>
            <span class="text-xs font-bold text-white uppercase tracking-wider">Hardware Used / Replaced</span>
          </div>
          <svg class="w-4 h-4 text-slate-400 transition-transform duration-300 section-arrow" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
        </button>
        <div class="section-content hidden px-4 pb-4 space-y-3">
          <div id="hardware-list" class="space-y-3"></div>
          <button onclick="addHardwareRow()" class="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-dashed border-white/10 transition text-xs text-indigo-400 font-bold uppercase tracking-wider">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v12m6-6H6"/></svg>
            Add Hardware Item
          </button>
        </div>
      </div>

      <!-- Notes -->
      <div class="glass-panel p-4 rounded-2xl space-y-3">
        <h4 class="text-xs font-bold text-white uppercase tracking-wider">Technician Notes</h4>
        <textarea id="checklist-notes" placeholder="Additional notes, observations, or issues..." class="w-full bg-black/30 border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none" rows="4"></textarea>
      </div>

      <!-- Photo Capture -->
      <div class="glass-panel p-4 rounded-2xl space-y-3">
        <h4 class="text-xs font-bold text-white uppercase tracking-wider">Photo Evidence</h4>
        <div class="grid grid-cols-2 gap-3">
          <!-- Before Photo -->
          <div>
            <button onclick="document.getElementById('photo-before-input').click()" class="w-full relative rounded-xl overflow-hidden bg-white/5 border border-dashed border-white/10 active:bg-white/10 transition" style="min-height: 120px;">
              <img id="photo-before-img" class="w-full h-full object-cover hidden" style="min-height: 120px;">
              <div id="photo-before-placeholder" class="flex flex-col items-center justify-center gap-2 p-4" style="min-height: 120px;">
                <span class="text-2xl">📷</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase">Before Photo</span>
              </div>
            </button>
            <input type="file" accept="image/*" capture="environment" id="photo-before-input" class="hidden" onchange="handlePhotoCapture(this, 'before')">
            <button onclick="removePhoto('before')" id="photo-before-remove" class="hidden w-full mt-1 text-[10px] text-rose-400 font-bold py-1">Remove</button>
          </div>
          <!-- After Photo -->
          <div>
            <button onclick="document.getElementById('photo-after-input').click()" class="w-full relative rounded-xl overflow-hidden bg-white/5 border border-dashed border-white/10 active:bg-white/10 transition" style="min-height: 120px;">
              <img id="photo-after-img" class="w-full h-full object-cover hidden" style="min-height: 120px;">
              <div id="photo-after-placeholder" class="flex flex-col items-center justify-center gap-2 p-4" style="min-height: 120px;">
                <span class="text-2xl">📸</span>
                <span class="text-[10px] text-slate-400 font-bold uppercase">After Photo</span>
              </div>
            </button>
            <input type="file" accept="image/*" capture="environment" id="photo-after-input" class="hidden" onchange="handlePhotoCapture(this, 'after')">
            <button onclick="removePhoto('after')" id="photo-after-remove" class="hidden w-full mt-1 text-[10px] text-rose-400 font-bold py-1">Remove</button>
          </div>
        </div>
      </div>

      <!-- Signature -->
      <div class="glass-panel p-4 rounded-2xl space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="text-xs font-bold text-white uppercase tracking-wider">Client Signature</h4>
          <button onclick="clearSignature()" class="text-[10px] text-rose-400 font-bold uppercase">Clear</button>
        </div>
        <canvas id="signature-pad-canvas" class="w-full h-32 rounded-xl border border-white/10 bg-white cursor-crosshair touch-none"></canvas>
        <p id="signature-hint" class="text-[10px] text-slate-500 text-center">Draw signature above</p>
      </div>

      <!-- Progress Bar -->
      <div class="glass-panel p-4 rounded-2xl">
        <div class="flex justify-between text-[10px] font-bold text-slate-400 mb-2">
          <span class="uppercase tracking-wider">Progress</span>
          <span id="checklist-progress">0%</span>
        </div>
        <div class="w-full bg-white/10 rounded-full h-2">
          <div id="checklist-progress-bar" class="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-300" style="width: 0%"></div>
        </div>
      </div>

      <!-- Submit -->
      <button onclick="submitChecklist()" class="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-4 rounded-2xl text-sm uppercase tracking-wider transition-all shadow-lg active:scale-95">
        Submit & Complete Checklist
      </button>
    </div>`;

  // Update progress bar on checkbox change
  form.querySelectorAll('.checklist-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const total = form.querySelectorAll('.checklist-cb').length;
      const checked = form.querySelectorAll('.checklist-cb:checked').length;
      const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
      document.getElementById('checklist-progress').textContent = pct + '%';
      document.getElementById('checklist-progress-bar').style.width = pct + '%';
    });
  });

  // Preload inventory and add first hardware row
  fetchInventoryCache().then(() => addHardwareRow());

  // Initialize signature pad
  setTimeout(initSignaturePad, 100);
}

// ── Signature Pad ──────────────────────────────────────────────────────
let _sigCtx = null;
let _sigDrawing = false;
let _sigHasData = false;

function initSignaturePad() {
  const canvas = document.getElementById('signature-pad-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = rect.height * 2;
  _sigCtx = canvas.getContext('2d');
  _sigCtx.scale(2, 2);
  _sigCtx.strokeStyle = '#818cf8';
  _sigCtx.lineWidth = 2.5;
  _sigCtx.lineCap = 'round';
  _sigCtx.lineJoin = 'round';

  const getPos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };

  const startDraw = (e) => { e.preventDefault(); _sigDrawing = true; const p = getPos(e); _sigCtx.beginPath(); _sigCtx.moveTo(p.x, p.y); };
  const draw = (e) => { if (!_sigDrawing) return; e.preventDefault(); const p = getPos(e); _sigCtx.lineTo(p.x, p.y); _sigCtx.stroke(); _sigHasData = true; document.getElementById('signature-hint').textContent = ''; };
  const endDraw = () => { _sigDrawing = false; };

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', endDraw);
  canvas.addEventListener('mouseleave', endDraw);
  canvas.addEventListener('touchstart', startDraw, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', endDraw);
}

function clearSignature() {
  const canvas = document.getElementById('signature-pad-canvas');
  if (!canvas || !_sigCtx) return;
  _sigCtx.clearRect(0, 0, canvas.width, canvas.height);
  _sigHasData = false;
  document.getElementById('signature-hint').textContent = 'Draw signature above';
}

function getSignatureData() {
  if (!_sigHasData) return null;
  const canvas = document.getElementById('signature-pad-canvas');
  return canvas ? canvas.toDataURL('image/png') : null;
}

// ── Completion Confirmation Screen ─────────────────────────────────────
function showCompletionSummary() {
  const form = document.getElementById('checklist-form-container');
  const checked = form ? form.querySelectorAll('.checklist-cb:checked').length : 0;
  const total = form ? form.querySelectorAll('.checklist-cb').length : 0;
  const notes = document.getElementById('checklist-notes')?.value || '';
  const hardware = getHardwareItems();
  const sig = getSignatureData();
  const beforePhoto = document.getElementById('photo-before-img')?.src;
  const afterPhoto = document.getElementById('photo-after-img')?.src;

  const summaryHtml = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4" id="completion-modal">
      <div class="glass-panel rounded-3xl max-w-sm w-full max-h-[85vh] overflow-y-auto p-6 space-y-4">
        <div class="text-center">
          <div class="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3">
            <svg class="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          </div>
          <h3 class="text-lg font-extrabold text-white">Job Complete</h3>
          <p class="text-xs text-slate-400 mt-1">${escapeHTML(currentJobId)}</p>
        </div>

        <!-- Checklist Summary -->
        <div class="bg-black/30 rounded-xl p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checklist</span>
            <span class="text-xs font-bold ${checked === total ? 'text-emerald-400' : 'text-amber-400'}">${checked}/${total} items</span>
          </div>
          <div class="w-full bg-white/10 rounded-full h-1.5">
            <div class="bg-gradient-to-r from-indigo-500 to-emerald-500 h-1.5 rounded-full" style="width: ${total > 0 ? Math.round(checked/total*100) : 0}%"></div>
          </div>
        </div>

        <!-- Photos -->
        <div class="bg-black/30 rounded-xl p-4">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Photos</span>
          <div class="flex gap-2 mt-2">
            <div class="flex-1 text-center">
              <div class="w-full h-16 rounded-lg ${beforePhoto ? 'bg-emerald-500/10' : 'bg-white/5'} flex items-center justify-center text-lg mb-1">${beforePhoto ? '✅' : '📷'}</div>
              <span class="text-[10px] text-slate-500">Before</span>
            </div>
            <div class="flex-1 text-center">
              <div class="w-full h-16 rounded-lg ${afterPhoto ? 'bg-emerald-500/10' : 'bg-white/5'} flex items-center justify-center text-lg mb-1">${afterPhoto ? '✅' : '📸'}</div>
              <span class="text-[10px] text-slate-500">After</span>
            </div>
          </div>
        </div>

        <!-- Hardware -->
        ${hardware.length > 0 ? `
        <div class="bg-black/30 rounded-xl p-4">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hardware (${hardware.length} items)</span>
          <div class="mt-2 space-y-1">
            ${hardware.map(h => `<div class="text-[11px] text-slate-300">• ${escapeHTML(h.name)} ${h.item_code ? `[${escapeHTML(h.item_code)}]` : ''} x${h.qty}</div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Signature -->
        <div class="bg-black/30 rounded-xl p-4">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Signature</span>
          <div class="mt-2 text-center">
            ${sig ? `<img src="${sig}" class="h-12 mx-auto bg-white/5 rounded-lg p-1">` : '<span class="text-[11px] text-amber-400">⚠ No signature captured</span>'}
          </div>
        </div>

        <!-- Notes -->
        ${notes ? `
        <div class="bg-black/30 rounded-xl p-4">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Notes</span>
          <p class="text-[11px] text-slate-300 mt-1">${escapeHTML(notes)}</p>
        </div>` : ''}

        <!-- Actions -->
        <div class="flex gap-3">
          <button onclick="closeCompletionModal()" class="flex-1 bg-white/5 hover:bg-white/10 text-slate-300 font-bold py-3 rounded-xl text-xs uppercase tracking-wider border border-white/10 transition">Back</button>
          <button onclick="confirmAndSubmit()" class="flex-1 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg active:scale-95">Confirm & Submit</button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', summaryHtml);
}

function closeCompletionModal() {
  const modal = document.getElementById('completion-modal');
  if (modal) modal.remove();
}

function toggleSection(btn) {
  const content = btn.nextElementSibling;
  const arrow = btn.querySelector('.section-arrow');
  content.classList.toggle('hidden');
  arrow.style.transform = content.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

// Cache inventory items
let _inventoryCache = null;
async function fetchInventoryCache() {
  if (_inventoryCache) return _inventoryCache;
  try {
    const res = await fetch(`${API_BASE_URL}/api/inventory?limit=500`, { headers: authHeaders() });
    const data = await res.json();
    _inventoryCache = data.data?.items || [];
  } catch (e) { _inventoryCache = []; }
  return _inventoryCache;
}

let _hwRowCount = 0;
function addHardwareRow() {
  const list = document.getElementById('hardware-list');
  if (!list) return;
  const rid = 'hw-' + (++_hwRowCount);
  const row = document.createElement('div');
  row.className = 'glass-panel p-3 rounded-xl space-y-2';
  row.dataset.rid = rid;
  row.innerHTML = `
    <div class="flex items-center gap-2">
      <select class="hw-action flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
        <option value="install">Install New</option>
        <option value="replace">Replace Existing</option>
      </select>
      <button onclick="this.closest('.glass-panel').remove()" class="text-rose-400 hover:text-rose-300 p-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    </div>
    <!-- Old item (shown when replace) -->
    <div class="hw-old-section hidden space-y-2">
      <label class="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Old Item Serial Number</label>
      <div class="flex gap-2">
        <input type="text" placeholder="Enter old serial number" class="hw-old-serial flex-1 bg-black/30 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500" autocomplete="off">
        <button onclick="lookupWarranty(this)" class="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-3 py-2 rounded-lg whitespace-nowrap">Check</button>
      </div>
      <div class="hw-old-info hidden"></div>
    </div>
    <!-- New item -->
    <div class="relative">
      <input type="text" placeholder="Search inventory item..." class="hw-name w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" autocomplete="off">
      <div class="hw-dropdown hidden absolute left-0 right-0 top-full mt-1 bg-[#0a0b10] border border-white/10 rounded-lg max-h-48 overflow-y-auto z-50 shadow-lg"></div>
    </div>
    <div class="flex gap-2">
      <input type="text" placeholder="Item code (auto-filled)" class="hw-serial flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500" readonly>
      <input type="number" placeholder="Qty" class="hw-qty w-16 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-center" value="1" min="1">
    </div>
    <!-- Warranty selection (shown when replace or install) -->
    <div class="hw-warranty-section hidden">
      <label class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">New Item Warranty</label>
      <select class="hw-warranty bg-black/30 border border-indigo-500/30 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full mt-1">
        <option value="12">12 Months</option>
        <option value="24">24 Months</option>
        <option value="48">48 Months</option>
      </select>
    </div>
    <p class="hw-stock text-[10px] text-slate-500"></p>
  `;
  list.appendChild(row);

  // Setup action toggle
  const actionSelect = row.querySelector('.hw-action');
  const oldSection = row.querySelector('.hw-old-section');
  const warrantySection = row.querySelector('.hw-warranty-section');
  actionSelect.addEventListener('change', () => {
    const isReplace = actionSelect.value === 'replace';
    oldSection.classList.toggle('hidden', !isReplace);
    warrantySection.classList.remove('hidden');
  });
  // Show warranty on install too
  warrantySection.classList.remove('hidden');

  // Setup search
  const nameInput = row.querySelector('.hw-name');
  const dropdown = row.querySelector('.hw-dropdown');
  const serialInput = row.querySelector('.hw-serial');
  const stockEl = row.querySelector('.hw-stock');
  let debounce = null;

  nameInput.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = nameInput.value.trim().toLowerCase();
    if (q.length < 1) { dropdown.classList.add('hidden'); return; }
    debounce = setTimeout(async () => {
      const items = await fetchInventoryCache();
      const matches = items.filter(i =>
        i.item_name.toLowerCase().includes(q) ||
        i.item_code.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      ).slice(0, 20);
      if (matches.length === 0) { dropdown.classList.add('hidden'); return; }
      dropdown.innerHTML = matches.map(item => `
        <div class="hw-opt px-3 py-2 text-xs cursor-pointer hover:bg-indigo-500/20 transition border-b border-white/5 last:border-0" data-name="${escapeHTML(item.item_name)}" data-code="${escapeHTML(item.item_code)}" data-stock="${item.stock_qty}" data-cat="${escapeHTML(item.category || '')}">
          <div class="text-white font-medium truncate">${escapeHTML(item.item_name)}</div>
          <div class="flex justify-between mt-0.5">
            <span class="text-indigo-400 font-mono text-[10px]">${escapeHTML(item.item_code)}</span>
            <span class="text-slate-500 text-[10px]">${item.stock_qty} in stock</span>
          </div>
        </div>
      `).join('');
      dropdown.classList.remove('hidden');
    }, 200);
  });

  nameInput.addEventListener('focus', () => {
    if (nameInput.value.trim().length >= 1) nameInput.dispatchEvent(new Event('input'));
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.hw-opt');
    if (!opt) return;
    nameInput.value = opt.dataset.name;
    serialInput.value = opt.dataset.code;
    stockEl.textContent = `Category: ${opt.dataset.cat} · Stock: ${opt.dataset.stock}`;
    dropdown.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!row.contains(e.target)) dropdown.classList.add('hidden');
  });

  nameInput.addEventListener('blur', () => {
    setTimeout(() => dropdown.classList.add('hidden'), 200);
  });
}

async function lookupWarranty(btn) {
  const row = btn.closest('.glass-panel');
  const serial = row.querySelector('.hw-old-serial')?.value.trim();
  const infoEl = row.querySelector('.hw-old-info');
  if (!serial) { showToast('Enter a serial number first', 'warning'); return; }

  infoEl.innerHTML = '<p class="text-[10px] text-slate-400">Checking...</p>';
  infoEl.classList.remove('hidden');

  try {
    const res = await fetch(`${API_BASE_URL}/api/warranty/lookup/${encodeURIComponent(serial)}`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Not found');

    const w = data.data;
    const statusColor = w.warranty_active ? 'text-emerald-400' : 'text-rose-400';
    const statusText = w.warranty_active ? `Active (${w.warranty_days_left} days left)` : 'Expired';
    infoEl.innerHTML = `
      <div class="bg-black/30 rounded-lg p-3 space-y-1">
        <div class="flex justify-between">
          <span class="text-[10px] text-slate-400">Device:</span>
          <span class="text-[10px] text-white font-medium">${escapeHTML(w.device_name)}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] text-slate-400">Client:</span>
          <span class="text-[10px] text-white">${escapeHTML(w.company_name || 'N/A')}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] text-slate-400">Installed:</span>
          <span class="text-[10px] text-white">${w.installed_date}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] text-slate-400">Warranty Ends:</span>
          <span class="text-[10px] text-white">${w.warranty_end}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-[10px] text-slate-400">Status:</span>
          <span class="text-[10px] font-bold ${statusColor}">${statusText}</span>
        </div>
      </div>`;
  } catch (err) {
    infoEl.innerHTML = `<p class="text-[10px] text-rose-400">${escapeHTML(err.message)}</p>`;
  }
}

function handlePhotoCapture(input, type) {
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = document.getElementById(`photo-${type}-img`);
    const placeholder = document.getElementById(`photo-${type}-placeholder`);
    const removeBtn = document.getElementById(`photo-${type}-remove`);
    if (img) { img.src = e.target.result; img.classList.remove('hidden'); }
    if (placeholder) placeholder.classList.add('hidden');
    if (removeBtn) removeBtn.classList.remove('hidden');
  };
  reader.readAsDataURL(file);
}

function removePhoto(type) {
  const img = document.getElementById(`photo-${type}-img`);
  const input = document.getElementById(`photo-${type}-input`);
  const placeholder = document.getElementById(`photo-${type}-placeholder`);
  const removeBtn = document.getElementById(`photo-${type}-remove`);
  if (img) { img.src = ''; img.classList.add('hidden'); }
  if (input) input.value = '';
  if (placeholder) placeholder.classList.remove('hidden');
  if (removeBtn) removeBtn.classList.add('hidden');
}

function getHardwareItems() {
  const items = [];
  document.querySelectorAll('#hardware-list .glass-panel').forEach(row => {
    const name = row.querySelector('.hw-name')?.value.trim();
    if (!name) return;
    const item = {
      action: row.querySelector('.hw-action')?.value || 'install',
      name,
      item_code: row.querySelector('.hw-serial')?.value.trim() || null,
      qty: parseInt(row.querySelector('.hw-qty')?.value) || 1,
    };
    if (item.action === 'replace') {
      item.old_serial = row.querySelector('.hw-old-serial')?.value.trim() || null;
    }
    const warranty = row.querySelector('.hw-warranty')?.value;
    if (warranty) item.warranty_months = parseInt(warranty);
    items.push(item);
  });
  return items;
}

async function submitChecklist() {
  showCompletionSummary();
}

async function confirmAndSubmit() {
  closeCompletionModal();
  showToast('Submitting job completion...', 'info');

  const form = document.getElementById('checklist-form-container');
  const checked = form ? form.querySelectorAll('.checklist-cb:checked').length : 0;
  const total = form ? form.querySelectorAll('.checklist-cb').length : 0;
  const notes = document.getElementById('checklist-notes')?.value || '';
  const hardware = getHardwareItems();
  const sig = getSignatureData();

  // Build notes with hardware info
  let fullNotes = `[Checklist ${checked}/${total}]`;
  if (hardware.length > 0) {
    fullNotes += '\nHardware Used:\n' + hardware.map(h =>
      `- ${h.action === 'replace' ? 'Replaced' : 'Installed'} ${h.name}${h.item_code ? ' [' + h.item_code + ']' : ''} x${h.qty}${h.warranty_months ? ' (' + h.warranty_months + 'mo warranty)' : ''}`
    ).join('\n');
  }
  if (notes) fullNotes += '\n' + notes;

  try {
    // 1. Upload photos to Google Drive (parallel)
    const beforePhoto = document.getElementById('photo-before-img')?.src;
    const afterPhoto = document.getElementById('photo-after-img')?.src;
    const photoPromises = [];
    if (beforePhoto && beforePhoto.startsWith('data:')) {
      photoPromises.push(
        fetch(`${API_BASE_URL}/api/jobs/${currentJobId}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ photo_base64: beforePhoto, photo_type: 'before' }),
        }).catch(e => console.warn('Before photo failed:', e))
      );
    }
    if (afterPhoto && afterPhoto.startsWith('data:')) {
      photoPromises.push(
        fetch(`${API_BASE_URL}/api/jobs/${currentJobId}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ photo_base64: afterPhoto, photo_type: 'after' }),
        }).catch(e => console.warn('After photo failed:', e))
      );
    }
    // 2. Save signature as photo
    if (sig) {
      photoPromises.push(
        fetch(`${API_BASE_URL}/api/jobs/${currentJobId}/photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ photo_base64: sig, photo_type: 'signature' }),
        }).catch(e => console.warn('Signature save failed:', e))
      );
    }
    await Promise.all(photoPromises);

    // 3. Fetch job details for receipt
    const jobRes = await fetch(`${API_BASE_URL}/api/jobs/${currentJobId}`, { headers: authHeaders() });
    const jobData = await jobRes.json();
    const job = jobData.data;

    // 4. Update job status
    await fetch(`${API_BASE_URL}/api/jobs/${currentJobId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ status: 'Completed', notes: fullNotes, equipment_used: JSON.stringify(hardware) }),
    });

    // 5. Register warranties (parallel)
    const warrantyPromises = hardware
      .filter(h => h.item_code && h.warranty_months)
      .map(h => fetch(`${API_BASE_URL}/api/warranty/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          serial_number: h.item_code,
          device_name: h.name,
          client_id: job?.client_id,
          job_id: currentJobId,
          warranty_months: h.warranty_months,
        }),
      }).catch(() => {}));
    await Promise.all(warrantyPromises);

    // 6. Send completion notification
    fetch(`${API_BASE_URL}/api/jobs/${currentJobId}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ message: `${checked}/${total} checklist items, ${hardware.length} hardware items used` }),
    }).catch(() => {});

    // 6. Generate receipt and send client notification
    showJobReceipt(job, hardware, checked, total, sig);

    currentJobId = null;
    switchMobileTab('job');
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ── Job Receipt ────────────────────────────────────────────────────────
function showJobReceipt(job, hardware, checked, total, sig) {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const receiptHtml = `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center p-4" id="receipt-modal">
      <div class="glass-panel rounded-3xl max-w-sm w-full max-h-[85vh] overflow-y-auto">
        <!-- Receipt Header -->
        <div class="p-6 text-center border-b border-white/5">
          <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-3 text-xl">🏆</div>
          <h3 class="text-base font-extrabold text-white">Job Completed</h3>
          <p class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider mt-1">Service Receipt</p>
        </div>

        <!-- Job Info -->
        <div class="p-4 space-y-3">
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Job ID</span>
            <span class="text-white font-bold font-mono">${escapeHTML(job?.id || currentJobId)}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Client</span>
            <span class="text-white">${escapeHTML(job?.company_name || 'N/A')}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Service Type</span>
            <span class="text-white">${escapeHTML(job?.service_type || 'N/A')}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Technician</span>
            <span class="text-white">${escapeHTML(activeSessionUser?.name || 'N/A')}</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-slate-400">Completed</span>
            <span class="text-white">${dateStr} ${timeStr}</span>
          </div>

          <div class="border-t border-white/5 pt-3">
            <div class="flex justify-between text-xs">
              <span class="text-slate-400">Checklist</span>
              <span class="text-emerald-400 font-bold">${checked}/${total} items</span>
            </div>
            ${hardware.length > 0 ? `
            <div class="flex justify-between text-xs mt-1">
              <span class="text-slate-400">Hardware Used</span>
              <span class="text-indigo-400 font-bold">${hardware.length} items</span>
            </div>` : ''}
            ${sig ? `
            <div class="flex justify-between text-xs mt-1">
              <span class="text-slate-400">Signature</span>
              <span class="text-emerald-400 font-bold">✓ Captured</span>
            </div>` : ''}
          </div>

          ${job?.before_photo || job?.after_photo ? `
          <div class="border-t border-white/5 pt-3">
            <span class="text-[10px] text-slate-400 uppercase font-bold">Photos Uploaded</span>
            <div class="flex gap-2 mt-2">
              ${job?.before_photo ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">✓ Before</span>' : ''}
              ${job?.after_photo ? '<span class="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">✓ After</span>' : ''}
            </div>
          </div>` : ''}
        </div>

        <!-- Close -->
        <div class="p-4 border-t border-white/5">
          <button onclick="document.getElementById('receipt-modal').remove()" class="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold py-3 rounded-xl text-xs uppercase tracking-wider transition shadow-lg active:scale-95">
            Done
          </button>
        </div>
      </div>
    </div>`;

  document.body.insertAdjacentHTML('beforeend', receiptHtml);
}

// ── Job History ──────────────────────────────────────────────────────────
async function loadJobHistory() {
  const container = document.getElementById('view-history');
  if (!container) return;
  container.innerHTML = '<div class="text-center text-slate-500 py-8 text-sm">Loading history...</div>';
  try {
    const res = await fetch(`${API_BASE_URL}/api/jobs?limit=100`, { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const jobs = data.data?.jobs || data.data || data.jobs || [];
    // Filter to completed jobs only
    const completedJobs = jobs.filter(j => j.status === 'Completed');
    container.innerHTML = '';
    if (completedJobs.length === 0) {
      container.innerHTML = '<div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm"><span class="text-3xl block mb-2">📋</span>No completed jobs yet.</div>';
      return;
    }
    completedJobs.forEach((job) => {
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
  const phoneEl = document.getElementById('my-card-phone-front');
  const emailEl = document.getElementById('my-card-email-back');
  const photoEl = document.getElementById('my-card-photo');
  if (nameEl) nameEl.textContent = activeSessionUser.name || 'Technician';
  if (idEl) idEl.textContent = activeSessionUser.id || '';
  if (roleEl) roleEl.textContent = activeSessionUser.role || 'Technician';
  if (phoneEl) phoneEl.textContent = activeSessionUser.phone || '—';
  if (emailEl) emailEl.textContent = activeSessionUser.email || '—';
  // Photo
  if (photoEl && activeSessionUser.photo) {
    photoEl.innerHTML = `<img src="${escapeHTML(activeSessionUser.photo)}" alt="Photo" style="width:100%;height:100%;object-fit:cover;" />`;
  }
  // QR codes — card front (mini) and back
  const verifyUrl = `${window.location.origin}/api/public/technician/${activeSessionUser.id}`;
  const qrConfigs = [
    { id: 'my-card-qr-mini', size: 54 },
    { id: 'my-card-qr-back', size: 92 },
  ];
  if (typeof QRCode !== 'undefined') {
    qrConfigs.forEach(({ id, size }) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.innerHTML = '';
      new QRCode(el, { text: verifyUrl, width: size, height: size, correctLevel: QRCode.CorrectLevel.M });
    });
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
