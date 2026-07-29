// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN TICKETS MODULE — Command Center
// ═══════════════════════════════════════════════════════════════════════════════

let tkAllJobs = [];
let tkFilteredJobs = [];
let tkViewMode = 'cards'; // 'cards' | 'table'
let tkCurrentPage = 1;
const tkPageSize = 20;
let tkDetailJob = null;

// ── Init ──────────────────────────────────────────────────────────────────────

async function tkInit() {
  tkPopulateTechFilter();
  tkPopulateClientDatalists();
  await tkLoadJobs();
}

// ── Load Jobs ─────────────────────────────────────────────────────────────────

async function tkLoadJobs() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const json = await res.json();
    const payload = json.data || json;
    tkAllJobs = Array.isArray(payload) ? payload : (payload.jobs || []);
    tkUpdatePipelineCounts();
    tkApplyFilters();
  } catch (err) {
    console.error('Failed to load tickets:', err);
  }
}

// ── Pipeline Counts ───────────────────────────────────────────────────────────

function tkUpdatePipelineCounts() {
  const counts = { Pending: 0, 'In Progress': 0, Completed: 0, Cancelled: 0 };
  tkAllJobs.forEach(j => { if (counts[j.status] !== undefined) counts[j.status]++; });
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('tk-count-pending', counts.Pending);
  set('tk-count-progress', counts['In Progress']);
  set('tk-count-completed', counts.Completed);
  set('tk-count-cancelled', counts.Cancelled);
}

// ── Filter by Status (pipeline click) ─────────────────────────────────────────

window.tkFilterByStatus = function(status) {
  document.getElementById('tk-filter-status').value = status;
  tkApplyFilters();
};

// ── Apply Filters ─────────────────────────────────────────────────────────────

window.tkApplyFilters = function() {
  const search = (document.getElementById('tk-search')?.value || '').toLowerCase().trim();
  const domain = document.getElementById('tk-filter-domain')?.value || '';
  const status = document.getElementById('tk-filter-status')?.value || '';
  const tech = document.getElementById('tk-filter-tech')?.value || '';

  tkFilteredJobs = tkAllJobs.filter(j => {
    if (domain && j.service_type !== domain) return false;
    if (status && j.status !== status) return false;
    if (tech && j.technician_id !== tech) return false;
    if (search) {
      const hay = `${j.id} ${j.company_name || ''} ${j.tech_name || ''} ${j.service_type} ${j.job_description || ''}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });

  tkCurrentPage = 1;
  tkRender();
};

window.tkClearFilters = function() {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('tk-search', '');
  set('tk-filter-domain', '');
  set('tk-filter-status', '');
  set('tk-filter-tech', '');
  tkApplyFilters();
};

// ── Toggle View ───────────────────────────────────────────────────────────────

window.tkToggleView = function() {
  tkViewMode = tkViewMode === 'cards' ? 'table' : 'cards';
  tkRender();
};

// ── Render ────────────────────────────────────────────────────────────────────

function tkRender() {
  const cardsEl = document.getElementById('tk-view-cards');
  const tableEl = document.getElementById('tk-view-table');
  const emptyEl = document.getElementById('tk-empty-state');

  if (tkViewMode === 'cards') {
    cardsEl?.classList.remove('hidden');
    tableEl?.classList.add('hidden');
    tkRenderCards();
  } else {
    cardsEl?.classList.add('hidden');
    tableEl?.classList.remove('hidden');
    tkRenderTable();
  }

  if (emptyEl) {
    emptyEl.classList.toggle('hidden', tkFilteredJobs.length > 0);
  }

  // Update toggle icon
  const btn = document.getElementById('tk-view-toggle');
  if (btn) {
    btn.innerHTML = tkViewMode === 'cards'
      ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>'
      : '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>';
  }
}

// ── Render Cards ──────────────────────────────────────────────────────────────

function tkRenderCards() {
  const container = document.getElementById('tk-view-cards');
  if (!container) return;

  if (tkFilteredJobs.length === 0) {
    container.innerHTML = '';
    return;
  }

  const statusConfig = {
    'Pending': { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/25', dot: 'bg-amber-400' },
    'In Progress': { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/25', dot: 'bg-blue-400' },
    'Completed': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
    'Cancelled': { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/25', dot: 'bg-rose-400' },
  };
  const domainEmoji = { 'CCTV': '🎥', 'Networking': '🌐', 'WiFi': '📡', 'NAS': '💾', 'General Maintenance': '🔧' };

  container.innerHTML = tkFilteredJobs.map(j => {
    const sc = statusConfig[j.status] || statusConfig['Pending'];
    const emoji = domainEmoji[j.service_type] || '📋';
    const date = j.created_at ? new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    const photos = (j.before_photo || j.after_photo) ? true : false;
    const hasMap = j.maps_url || (j.arrival_lat && j.arrival_lng);

    return `
    <div class="glass-panel rounded-2xl border border-white/5 hover:border-white/10 transition-all cursor-pointer group" onclick="tkOpenDetail('${j.id}')">
      <div class="p-4">
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <span class="font-mono text-xs font-bold text-amber-400">${escapeHTML(j.id)}</span>
          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold border ${sc.bg} ${sc.text} ${sc.border} flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full ${sc.dot}"></span>
            ${j.status}
          </span>
        </div>
        <!-- Client -->
        <div class="mb-2">
          <p class="text-xs font-bold text-white truncate">${escapeHTML(j.company_name || 'Anonymous')}</p>
          <p class="text-[10px] text-slate-400">${emoji} ${escapeHTML(j.service_type)}</p>
        </div>
        <!-- Tech -->
        <div class="flex items-center justify-between">
          <span class="text-[10px] text-slate-400">👤 ${escapeHTML(j.tech_name || 'Unassigned')}</span>
          <span class="text-[10px] text-slate-500 font-mono">${date}</span>
        </div>
        <!-- Indicators -->
        <div class="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
          ${photos ? '<span class="text-[9px] text-slate-500 flex items-center gap-1">📷 Photos</span>' : ''}
          ${hasMap ? '<span class="text-[9px] text-slate-500 flex items-center gap-1">📍 Location</span>' : ''}
          ${j.equipment_used ? '<span class="text-[9px] text-slate-500 flex items-center gap-1">🔧 Equipment</span>' : ''}
          ${j.signature ? '<span class="text-[9px] text-slate-500 flex items-center gap-1">✍️ Signed</span>' : ''}
          <span class="flex-1"></span>
          <button onclick="event.stopPropagation();tkQuickEdit('${j.id}')" class="opacity-0 group-hover:opacity-100 text-[9px] text-slate-400 hover:text-white transition px-2 py-1 rounded-lg bg-white/5">Edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Render Table ──────────────────────────────────────────────────────────────

function tkRenderTable() {
  const tbody = document.getElementById('tk-table-body');
  if (!tbody) return;

  const start = (tkCurrentPage - 1) * tkPageSize;
  const pageJobs = tkFilteredJobs.slice(start, start + tkPageSize);

  const statusBadge = (s) => {
    const m = { 'Pending': 'bg-amber-500/10 text-amber-400', 'In Progress': 'bg-blue-500/10 text-blue-400', 'Completed': 'bg-emerald-500/10 text-emerald-400', 'Cancelled': 'bg-rose-500/10 text-rose-400' };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${m[s] || m['Pending']}">${s}</span>`;
  };

  if (pageJobs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-8 text-slate-500 text-xs">No tickets match filters</td></tr>';
    tkRenderPagination();
    return;
  }

  tbody.innerHTML = pageJobs.map(j => {
    const date = j.created_at ? new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `
    <tr class="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition" onclick="tkOpenDetail('${j.id}')">
      <td class="py-3 px-4 font-mono text-xs font-bold text-amber-400">${escapeHTML(j.id)}</td>
      <td class="py-3 px-4 text-xs font-semibold text-white">${escapeHTML(j.company_name || '—')}</td>
      <td class="py-3 px-4 text-xs text-slate-300">${escapeHTML(j.tech_name || '—')}</td>
      <td class="py-3 px-4 text-xs text-slate-400">${escapeHTML(j.service_type)}</td>
      <td class="py-3 px-4">${statusBadge(j.status)}</td>
      <td class="py-3 px-4 text-[10px] text-slate-500">${date}</td>
      <td class="py-3 px-4 text-right" onclick="event.stopPropagation()">
        <button onclick="tkQuickEdit('${j.id}')" class="text-[10px] text-slate-400 hover:text-white transition px-2 py-1 rounded-lg bg-white/5">Edit</button>
      </td>
    </tr>`;
  }).join('');

  tkRenderPagination();
}

// ── Pagination ────────────────────────────────────────────────────────────────

function tkRenderPagination() {
  const totalPages = Math.ceil(tkFilteredJobs.length / tkPageSize);
  const info = document.getElementById('tk-page-info');
  const pag = document.getElementById('tk-pagination');
  if (info) {
    const start = (tkCurrentPage - 1) * tkPageSize + 1;
    const end = Math.min(tkCurrentPage * tkPageSize, tkFilteredJobs.length);
    info.textContent = tkFilteredJobs.length > 0
      ? `Showing ${start}–${end} of ${tkFilteredJobs.length} tickets`
      : 'No tickets found';
  }
  if (!pag) return;
  if (totalPages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  if (tkCurrentPage > 1) html += `<button onclick="tkGoPage(${tkCurrentPage - 1})" class="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-white/5 rounded-lg transition">←</button>`;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - tkCurrentPage) <= 1) {
      html += `<button onclick="tkGoPage(${i})" class="px-3 py-1.5 text-[10px] font-bold rounded-lg transition ${i === tkCurrentPage ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-white/5'}">${i}</button>`;
    } else if (Math.abs(i - tkCurrentPage) === 2) {
      html += '<span class="text-slate-600 px-1">...</span>';
    }
  }
  if (tkCurrentPage < totalPages) html += `<button onclick="tkGoPage(${tkCurrentPage + 1})" class="px-3 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white bg-white/5 rounded-lg transition">→</button>`;
  pag.innerHTML = html;
}

window.tkGoPage = function(page) {
  tkCurrentPage = page;
  tkRender();
};

// ── Ticket Detail Modal ───────────────────────────────────────────────────────

window.tkOpenDetail = async function(jobId) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/jobs/${jobId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    tkDetailJob = json.data || json;
    if (!tkDetailJob) throw new Error('Not found');
    tkRenderDetail();
    document.getElementById('tk-detail-modal')?.classList.remove('hidden');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Failed to load ticket details', 'error');
  }
};

function tkRenderDetail() {
  const j = tkDetailJob;
  if (!j) return;

  document.getElementById('tk-detail-id').textContent = j.id;

  const statusConfig = {
    'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/25',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/25',
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25',
    'Cancelled': 'bg-rose-500/10 text-rose-400 border-rose-500/25',
  };
  const badge = document.getElementById('tk-detail-status-badge');
  if (badge) {
    badge.className = `px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig[j.status] || statusConfig['Pending']}`;
    badge.textContent = j.status;
  }

  document.getElementById('tk-detail-status-select').value = j.status;

  const created = j.created_at ? new Date(j.created_at).toLocaleString() : '—';
  const arrival = j.arrival_time ? new Date(j.arrival_time).toLocaleString() : '—';
  const completion = j.completion_time ? new Date(j.completion_time).toLocaleString() : '—';
  const domainEmoji = { 'CCTV': '🎥', 'Networking': '🌐', 'WiFi': '📡', 'NAS': '💾', 'General Maintenance': '🔧' };

  let photosHtml = '';
  if (j.before_photo || j.after_photo) {
    const beforeImg = j.before_photo
      ? '<div><p class="text-[9px] text-slate-500 mb-1">Before</p><img src="' + escapeHTML(j.before_photo) + '" class="w-full h-32 object-cover rounded-xl border border-white/5" onerror="this.style.display=\'none\'"></div>'
      : '<div></div>';
    const afterImg = j.after_photo
      ? '<div><p class="text-[9px] text-slate-500 mb-1">After</p><img src="' + escapeHTML(j.after_photo) + '" class="w-full h-32 object-cover rounded-xl border border-white/5" onerror="this.style.display=\'none\'"></div>'
      : '<div></div>';
    photosHtml = '<div><p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Photos</p><div class="grid grid-cols-2 gap-3">' + beforeImg + afterImg + '</div></div>';
  }

  let equipHtml = '';
  if (j.equipment_used) {
    try {
      const items = JSON.parse(j.equipment_used);
      if (Array.isArray(items) && items.length > 0) {
        equipHtml = `
        <div>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Equipment Used</p>
          <div class="flex flex-wrap gap-2">${items.map(e => `<span class="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-slate-300 border border-white/5">${escapeHTML(typeof e === 'string' ? e : e.name || e.code || JSON.stringify(e))}</span>`).join('')}</div>
        </div>`;
      }
    } catch (_) {}
  }

  let checklistHtml = '';
  if (j.checklist_data) {
    try {
      const items = JSON.parse(j.checklist_data);
      if (Array.isArray(items) && items.length > 0) {
        checklistHtml = `
        <div>
          <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Checklist</p>
          <div class="space-y-1">${items.map(c => `<div class="flex items-center gap-2 text-[10px] ${c.done ? 'text-emerald-400' : 'text-slate-400'}"><span>${c.done ? '✅' : '⬜'}</span> ${escapeHTML(c.text || c.label || '')}</div>`).join('')}</div>
        </div>`;
      }
    } catch (_) {}
  }

  let mapHtml = '';
  if (j.arrival_lat && j.arrival_lng) {
    mapHtml = `
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Location</p>
      <a href="https://www.google.com/maps?q=${j.arrival_lat},${j.arrival_lng}" target="_blank" class="text-[10px] text-blue-400 hover:underline">📍 Open in Google Maps</a>
    </div>`;
  }

  document.getElementById('tk-detail-body').innerHTML = `
    <!-- Info Grid -->
    <div class="grid grid-cols-2 gap-4">
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client</p>
        <p class="text-xs text-white font-bold">${escapeHTML(j.company_name || 'Anonymous')}</p>
        ${j.client_phone ? `<p class="text-[10px] text-slate-400">${escapeHTML(j.client_phone)}</p>` : ''}
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technician</p>
        <p class="text-xs text-white font-bold">${escapeHTML(j.tech_name || 'Unassigned')}</p>
        ${j.tech_phone ? `<p class="text-[10px] text-slate-400">${escapeHTML(j.tech_phone)}</p>` : ''}
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Service Domain</p>
        <p class="text-xs text-white">${domainEmoji[j.service_type] || '📋'} ${escapeHTML(j.service_type)}</p>
      </div>
      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">AMC Status</p>
        <p class="text-xs text-white">${escapeHTML(j.amc_status || '—')}</p>
      </div>
    </div>

    <!-- Timeline -->
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Timeline</p>
      <div class="grid grid-cols-3 gap-3">
        <div class="bg-white/5 rounded-xl p-2.5">
          <p class="text-[9px] text-slate-500">Created</p>
          <p class="text-[10px] text-white font-bold">${created}</p>
        </div>
        <div class="bg-white/5 rounded-xl p-2.5">
          <p class="text-[9px] text-slate-500">Arrived</p>
          <p class="text-[10px] text-white font-bold">${arrival}</p>
        </div>
        <div class="bg-white/5 rounded-xl p-2.5">
          <p class="text-[9px] text-slate-500">Completed</p>
          <p class="text-[10px] text-white font-bold">${completion}</p>
        </div>
      </div>
    </div>

    <!-- Description -->
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Job Description</p>
      <p class="text-xs text-slate-300 whitespace-pre-wrap">${escapeHTML(j.job_description || '—')}</p>
    </div>

    ${j.technician_notes ? `
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Technician Notes</p>
      <p class="text-xs text-slate-300 whitespace-pre-wrap">${escapeHTML(j.technician_notes)}</p>
    </div>` : ''}

    ${mapHtml}
    ${equipHtml}
    ${checklistHtml}
    ${photosHtml}
  `;
}

window.tkCloseDetail = function() {
  document.getElementById('tk-detail-modal')?.classList.add('hidden');
  tkDetailJob = null;
};

// ── Quick Status Update ───────────────────────────────────────────────────────

window.tkQuickStatusUpdate = async function(newStatus) {
  if (!tkDetailJob) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/jobs/${tkDetailJob.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) throw new Error('Failed');
    if (typeof showToast === 'function') showToast(`Status updated to ${newStatus}`, 'success');
    tkDetailJob.status = newStatus;
    tkRenderDetail();
    await tkLoadJobs();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Failed to update status', 'error');
  }
};

// ── Edit Ticket Modal ─────────────────────────────────────────────────────────

window.tkQuickEdit = function(jobId) {
  const job = tkAllJobs.find(j => j.id === jobId);
  if (!job) return;
  tkOpenEditModal(job);
};

window.tkOpenEditFromDetail = function() {
  if (!tkDetailJob) return;
  tkCloseDetail();
  tkOpenEditModal(tkDetailJob);
};

function tkOpenEditModal(job) {
  document.getElementById('tk-edit-id').value = job.id;
  document.getElementById('tk-edit-client').value = job.client_id || job.company_name || '';
  document.getElementById('tk-edit-domain').value = job.service_type || '';
  document.getElementById('tk-edit-status').value = job.status || 'Pending';
  document.getElementById('tk-edit-maps').value = job.maps_url || '';
  document.getElementById('tk-edit-lat').value = job.arrival_lat || '';
  document.getElementById('tk-edit-lng').value = job.arrival_lng || '';
  document.getElementById('tk-edit-desc').value = job.job_description || '';
  document.getElementById('tk-edit-notes').value = job.technician_notes || '';

  // Populate tech select
  const techSel = document.getElementById('tk-edit-tech');
  const sourceSel = document.getElementById('tk-dispatch-tech');
  if (techSel && sourceSel) {
    techSel.innerHTML = sourceSel.innerHTML;
    techSel.value = job.technician_id || '';
  }

  document.getElementById('tk-edit-modal')?.classList.remove('hidden');
}

window.tkCloseEdit = function() {
  document.getElementById('tk-edit-modal')?.classList.add('hidden');
};

window.tkSubmitEdit = async function(e) {
  e.preventDefault();
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const id = document.getElementById('tk-edit-id').value;
  const payload = {
    id,
    client_id: document.getElementById('tk-edit-client').value || undefined,
    technician_id: document.getElementById('tk-edit-tech').value || undefined,
    service_type: document.getElementById('tk-edit-domain').value || undefined,
    status: document.getElementById('tk-edit-status').value || undefined,
    maps_url: document.getElementById('tk-edit-maps').value || undefined,
    arrival_lat: document.getElementById('tk-edit-lat').value || undefined,
    arrival_lng: document.getElementById('tk-edit-lng').value || undefined,
    job_description: document.getElementById('tk-edit-desc').value || undefined,
    technician_notes: document.getElementById('tk-edit-notes').value || undefined,
  };

  try {
    const res = await fetch(`${baseUrl}/api/admin/jobs/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed');
    if (typeof showToast === 'function') showToast('Ticket updated!', 'success');
    tkCloseEdit();
    await tkLoadJobs();
  } catch (err) {
    if (typeof showToast === 'function') showToast('Failed to update ticket', 'error');
  }
};

// ── Dispatch Form ─────────────────────────────────────────────────────────────

window.tkToggleCustomerType = function(type) {
  const corp = document.getElementById('tk-corp-client-field');
  const ind = document.getElementById('tk-individual-fields');
  const indSearch = document.getElementById('tk-individual-search');
  const indNewFields = document.getElementById('tk-individual-new-fields');
  
  if (type === 'Individual') {
    corp?.classList.add('hidden');
    corp?.querySelector('input')?.removeAttribute('required');
    ind?.classList.remove('hidden');
    // Load individual clients
    tkLoadClientsByType('Individual');
  } else {
    corp?.classList.remove('hidden');
    corp?.querySelector('input')?.setAttribute('required', '');
    ind?.classList.add('hidden');
    // Load corporate clients
    tkLoadClientsByType('Corporate');
  }
};

// Load clients filtered by type
async function tkLoadClientsByType(clientType) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const allClients = Array.isArray(data) ? data : (data?.clients || data?.data?.clients || data?.data || []);
    
    // Filter by client_type
    const filtered = allClients.filter(c => c.client_type === clientType);
    
    const datalistId = clientType === 'Individual' ? 'tk-individual-clients-datalist' : 'tk-clients-datalist';
    const dl = document.getElementById(datalistId);
    if (!dl) return;
    
    dl.innerHTML = '';
    filtered.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.company_name}${c.phone ? ' (' + c.phone + ')' : ''}`;
      dl.appendChild(opt);
    });
    
    // Add "Create New" option at the end
    const newOpt = document.createElement('option');
    newOpt.value = '__NEW__';
    newOpt.textContent = '➕ Create New Client...';
    dl.appendChild(newOpt);
  } catch (e) {
    console.warn('Failed to load clients by type:', e);
  }
}

// Handle individual client search input
window=tkToggleIndividualNewFields = function(val) {
  const indNewFields = document.getElementById('tk-individual-new-fields');
  if (val === '__NEW__') {
    indNewFields?.classList.remove('hidden');
  } else {
    indNewFields?.classList.add('hidden');
  }
};

window.tkSubmitDispatch = async function(e) {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form));
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  try {
    let clientId = data.client_id;

    // Individual customer type
    if (data.customer_type === 'Individual') {
      const selectedIndividual = data.individual_client_id;
      
      if (selectedIndividual === '__NEW__') {
        // Create new individual client
        const clientRes = await fetch(`${baseUrl}/api/admin/clients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            company_name: data.individual_name,
            phone: data.individual_phone,
            address: data.individual_address,
            client_type: 'Individual',
            amc_status: 'Individual'
          }),
        });
        if (clientRes.ok) {
          const cj = await clientRes.json();
          const cd = cj.data || cj;
          clientId = cd.id;
        }
      } else if (selectedIndividual) {
        // Use existing individual client
        clientId = selectedIndividual;
      }
    }

    const jobPayload = {
      id: data.id || undefined,
      service_type: data.service_type,
      client_id: clientId,
      technician_id: data.technician_id,
      job_description: data.job_description,
      maps_url: data.maps_url || undefined,
      arrival_lat: data.arrival_lat || undefined,
      arrival_lng: data.arrival_lng || undefined,
    };

    const res = await fetch(`${baseUrl}/api/admin/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(jobPayload),
    });
    if (!res.ok) throw new Error('Failed');
    if (typeof showToast === 'function') showToast('Ticket dispatched!', 'success');
    form.reset();
    await tkLoadJobs();
    switchTicketModule('logs');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Failed to dispatch ticket', 'error');
  }
};

// ── AI Polish Notes ───────────────────────────────────────────────────────────

window.tkPolishNotes = async function() {
  if (!tkDetailJob) return;
  if (!confirm(`Run Gemini AI to polish notes for ${tkDetailJob.id}?`)) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/admin/jobs/ai-polish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ job_id: tkDetailJob.id }),
    });
    if (!res.ok) throw new Error('Failed');
    if (typeof showToast === 'function') showToast('Notes polished by AI!', 'success');
    await tkLoadJobs();
    tkCloseDetail();
  } catch (err) {
    if (typeof showToast === 'function') showToast('AI polish failed', 'error');
  }
};

// ── Telegram Notify ───────────────────────────────────────────────────────────

window.tkNotifyTelegram = async function() {
  if (!tkDetailJob) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/jobs/${tkDetailJob.id}/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed');
    if (typeof showToast === 'function') showToast('Telegram notification sent!', 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Notification failed', 'error');
  }
};

// ── Receipt Generator ─────────────────────────────────────────────────────────

window.tkGenerateReceipt = async function() {
  const jobId = document.getElementById('tk-pdf-job-id')?.value?.trim();
  if (!jobId) return;
  if (typeof generateServiceReceiptPDF === 'function') {
    document.getElementById('pdf-target-job-id').value = jobId;
    generateServiceReceiptPDF();
  } else {
    if (typeof showToast === 'function') showToast('PDF generator not available', 'error');
  }
};

// ── Resolve Map URL ───────────────────────────────────────────────────────────

window.tkResolveMapUrl = async function(url) {
  if (!url || url.length < 10) return;
  const statusEl = document.getElementById('tk-resolve-status');
  if (statusEl) statusEl.textContent = 'Resolving...';
  try {
    const baseUrl = document.getElementById('api-base')?.value || '';
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${baseUrl}/api/admin/resolve-coords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    });
    if (res.ok) {
      const data = await res.json();
      const coords = data.data || data;
      const form = document.getElementById('tk-dispatch-form');
      if (form) {
        form.querySelector('[name="arrival_lat"]').value = coords.lat || '';
        form.querySelector('[name="arrival_lng"]').value = coords.lng || '';
      }
      if (statusEl) statusEl.textContent = '✓ Resolved';
    } else {
      if (statusEl) statusEl.textContent = '✗ Failed';
    }
  } catch (_) {
    if (statusEl) statusEl.textContent = '✗ Error';
  }
};

// ── Export Excel ──────────────────────────────────────────────────────────────

window.tkExportExcel = function() {
  if (typeof exportTableToExcel === 'function') {
    exportTableToExcel('tk-table', 'Ticket_Logs');
  }
};

// ── Module Switch ─────────────────────────────────────────────────────────────

window.switchTicketModule = function(module) {
  ['logs', 'create', 'pdf'].forEach(p => {
    const el = document.getElementById(`ticket-panel-${p}`);
    if (el) el.classList.toggle('hidden', p !== module);
  });
  ['logs', 'create', 'pdf'].forEach(m => {
    const btn = document.getElementById(`ticket-mod-${m}`);
    if (btn) {
      if (m === module) {
        btn.classList.add('text-white', 'font-bold', 'bg-white/10');
        btn.classList.remove('text-slate-400');
      } else {
        btn.classList.remove('text-white', 'font-bold', 'bg-white/10');
        btn.classList.add('text-slate-400');
      }
    }
  });
};

// ── Populate Filters ──────────────────────────────────────────────────────────

function tkPopulateTechFilter() {
  const sel = document.getElementById('tk-filter-tech');
  const dispatchSel = document.getElementById('tk-dispatch-tech');
  if (!sel && !dispatchSel) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  fetch(`${baseUrl}/api/admin/technicians`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : [])
    .then(json => {
      const techs = Array.isArray(json) ? json : (json?.data?.technicians || json?.technicians || []);
      if (sel) {
        sel.innerHTML = '<option value="">All Technicians</option>';
        techs.forEach(t => { sel.innerHTML += `<option value="${t.id}">${escapeHTML(t.name)}</option>`; });
      }
      if (dispatchSel) {
        dispatchSel.innerHTML = '<option value="">Select technician...</option>';
        techs.forEach(t => { dispatchSel.innerHTML += `<option value="${t.id}">${escapeHTML(t.name)}</option>`; });
      }
    })
    .catch(() => {});
}

function tkPopulateClientDatalists() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.ok ? r.json() : [])
    .then(json => {
      const clients = Array.isArray(json) ? json : (json?.clients || json?.data?.clients || json?.data || []);
      
      // Populate corporate client datalist (Annual/AMC)
      const corpDl = document.getElementById('tk-clients-datalist');
      if (corpDl) {
        corpDl.innerHTML = '';
        const corporateClients = clients.filter(c => c.client_type === 'Corporate');
        corporateClients.forEach(c => {
          corpDl.innerHTML += `<option value="${escapeHTML(c.id)}">${escapeHTML(c.company_name)}${c.phone ? ' (' + escapeHTML(c.phone) + ')' : ''}</option>`;
        });
        // Add Create New option
        corpDl.innerHTML += `<option value="__NEW__">➕ Create New Client...</option>`;
      }
      
      // Populate individual client datalist
      const indDl = document.getElementById('tk-individual-clients-datalist');
      if (indDl) {
        indDl.innerHTML = '';
        const individualClients = clients.filter(c => c.client_type === 'Individual');
        individualClients.forEach(c => {
          indDl.innerHTML += `<option value="${escapeHTML(c.id)}">${escapeHTML(c.company_name)}${c.phone ? ' (' + escapeHTML(c.phone) + ')' : ''}</option>`;
        });
        // Add Create New option
        indDl.innerHTML += `<option value="__NEW__">➕ Create New Client...</option>`;
      }
      
      // Also populate edit datalist
      const editDl = document.getElementById('tk-edit-clients-datalist');
      if (editDl) {
        editDl.innerHTML = '';
        clients.forEach(c => {
          editDl.innerHTML += `<option value="${escapeHTML(c.id)}">${escapeHTML(c.company_name)}${c.phone ? ' (' + escapeHTML(c.phone) + ')' : ''}</option>`;
        });
      }
    })
    .catch(() => {});
}

// ── Expose for legacy admin.js calls ──────────────────────────────────────────
window.loadJobsData = tkLoadJobs;
window.calculateStats = function() {};
