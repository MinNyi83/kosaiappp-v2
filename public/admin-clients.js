// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS DIRECTORY — Upgraded
// ═══════════════════════════════════════════════════════════════════════════════

let cdData = [];
let cdSelectedIds = new Set();
let cdCurrentType = '';
let cdCurrentStatus = '';
let cdCurrentPriority = '';
let cdCurrentTag = '';
let cdSearchQuery = '';
let cdSearchTimeout = null;
let cdViewMode = 'table';
let cdDetailClient = null;

// ─── Load data ───────────────────────────────────────────────────────────────

async function cdLoadData() {
  const container = document.getElementById('cd-table-container');
  const cardsContainer = document.getElementById('cd-cards-container');
  if (!container && !cardsContainer) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  let url = `${baseUrl}/api/clients`;
  const params = new URLSearchParams();
  if (cdSearchQuery) params.set('search', cdSearchQuery);
  if (cdCurrentStatus) params.set('amc_status', cdCurrentStatus);
  if (cdCurrentType) params.set('client_type', cdCurrentType);
  if (cdCurrentPriority) params.set('priority', cdCurrentPriority);
  if (cdCurrentTag) params.set('tags', cdCurrentTag);
  const sort = document.getElementById('cd-sort')?.value || 'name-asc';
  params.set('sort', sort);
  params.set('limit', '500');
  if (params.toString()) url += '?' + params.toString();

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const result = data?.data || data;
    cdData = result?.clients || result || [];
    renderCDTable();
    renderCDCards();
    cdLoadStats();
    cdLoadTags();
  } catch (err) {
    if (container) container.innerHTML = `<div class="p-8 text-center text-rose-400 text-xs">Failed to load: ${err.message}</div>`;
  }
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function cdLoadStats() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients/stats`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const s = data?.data || data;
    document.getElementById('cd-stat-total').textContent = s.total ?? '—';
    document.getElementById('cd-stat-active').textContent = s.active ?? '—';
    document.getElementById('cd-stat-expired').textContent = s.expired ?? '—';
    document.getElementById('cd-stat-inactive').textContent = s.inactive ?? '—';
    document.getElementById('cd-stat-vip').textContent = s.vip ?? '—';
  } catch (_) {}
}

// ─── Tags ────────────────────────────────────────────────────────────────────

async function cdLoadTags() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients/tags`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const tags = data?.data || data || [];
    const container = document.getElementById('cd-tag-chips');
    if (!container) return;
    let html = '';
    tags.slice(0, 10).forEach(t => {
      const active = cdCurrentTag === t.name ? 'active' : '';
      html += `<button onclick="cdFilterTag('${escapeHTML(t.name)}')" class="cd-tag-chip ${active}">${escapeHTML(t.name)} (${t.count})</button>`;
    });
    if (cdCurrentTag) {
      html += `<button onclick="cdFilterTag('')" class="cd-tag-chip active">✕ Clear</button>`;
    }
    container.innerHTML = html;
  } catch (_) {}
}

// ─── Table render ────────────────────────────────────────────────────────────

function renderCDTable() {
  const container = document.getElementById('cd-table-container');
  if (!container) return;

  if (cdData.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-slate-600 text-xs">No clients found.</div>';
    document.getElementById('cd-count-label').textContent = '';
    return;
  }

  let html = '';
  cdData.forEach(c => {
    const isSelected = cdSelectedIds.has(c.id);
    const badge = cdStatusBadge(c.amc_status);
    const priorityBadge = cdPriorityBadge(c.priority);
    const tags = (c.tags || '').split(',').filter(Boolean).slice(0, 3);

    html += `
    <div class="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-all group">
      <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="cdToggleSelect('${c.id}')" class="cd-checkbox rounded border-white/20" data-id="${c.id}" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-white truncate cursor-pointer hover:text-emerald-400 transition" onclick="cdShowDetail('${c.id}')">${escapeHTML(c.company_name)}</span>
          <span class="text-[9px] font-mono text-slate-500">${escapeHTML(c.id)}</span>
          ${priorityBadge}
        </div>
        <div class="flex items-center gap-2 mt-0.5">
          <span class="text-[10px] text-slate-400">${escapeHTML(c.contact_person || '—')}</span>
          <span class="text-[10px] text-slate-600">·</span>
          <span class="text-[10px] text-slate-500 font-mono">${escapeHTML(c.phone || '—')}</span>
          ${c.email ? `<span class="text-[10px] text-slate-600">·</span><span class="text-[10px] text-slate-500">${escapeHTML(c.email)}</span>` : ''}
        </div>
        ${tags.length > 0 ? `<div class="flex gap-1 mt-1">${tags.map(t => `<span class="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-bold">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="text-right flex-shrink-0">
        ${badge}
        ${c.amc_end ? `<div class="text-[9px] text-slate-500 font-mono mt-0.5">ends ${c.amc_end}</div>` : ''}
      </div>
      <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onclick="cdShowDetail('${c.id}')" class="p-1.5 rounded-lg hover:bg-emerald-500/10 text-emerald-400 transition" title="View">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button onclick="cdEdit('${c.id}')" class="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400 transition" title="Edit">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button onclick="cdDelete('${c.id}')" class="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition" title="Delete">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    </div>`;
  });

  container.innerHTML = html;
  document.getElementById('cd-count-label').textContent = `— ${cdData.length} client${cdData.length !== 1 ? 's' : ''}`;
  cdUpdateBulkBtn();
}

// ─── Cards render ────────────────────────────────────────────────────────────

function renderCDCards() {
  const container = document.getElementById('cd-cards-container');
  if (!container) return;

  if (cdData.length === 0) {
    container.innerHTML = '<div class="col-span-full p-8 text-center text-slate-600 text-xs glass-panel rounded-2xl">No clients found.</div>';
    return;
  }

  let html = '';
  cdData.forEach(c => {
    const badge = cdStatusBadge(c.amc_status);
    const priorityBadge = cdPriorityBadge(c.priority);
    const tags = (c.tags || '').split(',').filter(Boolean).slice(0, 4);
    const initial = (c.company_name || '?')[0].toUpperCase();

    html += `
    <div class="glass-panel p-5 rounded-2xl border border-white/5 hover:border-emerald-500/20 transition-all cursor-pointer group" onclick="cdShowDetail('${c.id}')">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-black text-sm flex-shrink-0">${initial}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-bold text-white truncate">${escapeHTML(c.company_name)}</span>
            ${priorityBadge}
          </div>
          <p class="text-[10px] text-slate-500 font-mono">${escapeHTML(c.id)}</p>
        </div>
        ${badge}
      </div>
      <div class="space-y-1.5 text-[10px] text-slate-400 mb-3">
        <div class="flex items-center gap-1.5">
          <span class="text-slate-600">👤</span> ${escapeHTML(c.contact_person || '—')}
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-slate-600">📞</span> <span class="font-mono">${escapeHTML(c.phone || '—')}</span>
        </div>
        ${c.email ? `<div class="flex items-center gap-1.5"><span class="text-slate-600">✉️</span> ${escapeHTML(c.email)}</div>` : ''}
        <div class="flex items-center gap-1.5 truncate">
          <span class="text-slate-600">📍</span> <span class="truncate">${escapeHTML(c.address || '—')}</span>
        </div>
      </div>
      ${tags.length > 0 ? `<div class="flex flex-wrap gap-1 mb-3">${tags.map(t => `<span class="text-[8px] px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-bold">${escapeHTML(t)}</span>`).join('')}</div>` : ''}
      <div class="flex items-center justify-between pt-2 border-t border-white/5">
        <span class="text-[9px] text-slate-500">${c.job_count || 0} jobs</span>
        ${c.amc_end ? `<span class="text-[9px] text-slate-500 font-mono">ends ${c.amc_end}</span>` : ''}
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onclick="event.stopPropagation()">
          <button onclick="cdEdit('${c.id}')" class="p-1 rounded hover:bg-amber-500/10 text-amber-400 transition" title="Edit">✏️</button>
          <button onclick="cdDelete('${c.id}')" class="p-1 rounded hover:bg-rose-500/10 text-rose-400 transition" title="Delete">🗑</button>
        </div>
      </div>
    </div>`;
  });

  container.innerHTML = html;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cdStatusBadge(status) {
  const map = {
    'Active': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Expired': 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    'Inactive': 'bg-slate-500/10 text-slate-400 border-slate-500/20',
    'No AMC': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Individual': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  };
  const cls = map[status] || map['Inactive'];
  return `<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${cls}">${status || 'Unknown'}</span>`;
}

function cdPriorityBadge(priority) {
  if (!priority || priority === 'Normal') return '';
  const map = {
    'VIP': 'bg-amber-500/15 text-amber-400',
    'High': 'bg-rose-500/15 text-rose-400',
    'Low': 'bg-slate-500/15 text-slate-500',
  };
  const cls = map[priority] || '';
  return `<span class="text-[8px] px-1.5 py-0.5 rounded font-bold ${cls}">${priority}</span>`;
}

// ─── Filters ─────────────────────────────────────────────────────────────────

function cdFilterType(type) {
  cdCurrentType = type;
  document.querySelectorAll('.cd-type-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(type ? `cd-type-${type.toLowerCase()}` : 'cd-type-all');
  if (btn) btn.classList.add('active');
  cdLoadData();
}

function cdFilterStatus(status) {
  cdCurrentStatus = status;
  cdLoadData();
}

function cdFilterPriority(priority) {
  cdCurrentPriority = cdCurrentPriority === priority ? '' : priority;
  cdLoadData();
}

function cdFilterTag(tag) {
  cdCurrentTag = cdCurrentTag === tag ? '' : tag;
  cdLoadData();
}

function cdDebouncedSearch() {
  clearTimeout(cdSearchTimeout);
  cdSearchTimeout = setTimeout(() => {
    cdSearchQuery = document.getElementById('cd-search')?.value || '';
    cdLoadData();
  }, 300);
}

function cdSetView(mode) {
  cdViewMode = mode;
  document.getElementById('cd-table-view').classList.toggle('hidden', mode !== 'table');
  document.getElementById('cd-cards-view').classList.toggle('hidden', mode !== 'cards');
  document.getElementById('cd-view-table').className = mode === 'table'
    ? 'px-2.5 py-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 transition'
    : 'px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition';
  document.getElementById('cd-view-cards').className = mode === 'cards'
    ? 'px-2.5 py-1.5 text-[10px] font-bold bg-emerald-500/20 text-emerald-400 transition'
    : 'px-2.5 py-1.5 text-[10px] font-bold text-slate-400 hover:text-white transition';
}

// ─── Selection / Bulk ────────────────────────────────────────────────────────

function cdToggleSelect(id) {
  if (cdSelectedIds.has(id)) cdSelectedIds.delete(id);
  else cdSelectedIds.add(id);
  cdUpdateBulkBtn();
}

function cdToggleSelectAll() {
  const all = document.getElementById('cd-select-all')?.checked;
  cdSelectedIds.clear();
  if (all) cdData.forEach(c => cdSelectedIds.add(c.id));
  document.querySelectorAll('.cd-checkbox').forEach(cb => { cb.checked = all; });
  cdUpdateBulkBtn();
}

function cdUpdateBulkBtn() {
  const btn = document.getElementById('cd-bulk-delete-btn');
  const count = document.getElementById('cd-selected-count');
  if (!btn) return;
  if (cdSelectedIds.size > 0) {
    btn.classList.remove('hidden');
    count.textContent = cdSelectedIds.size;
  } else {
    btn.classList.add('hidden');
  }
}

async function cdBulkDelete() {
  if (cdSelectedIds.size === 0) return;
  if (!confirm(`Delete ${cdSelectedIds.size} client(s)?`)) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  try {
    const res = await fetch(`${baseUrl}/api/admin/clients/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'bulk_delete', ids: Array.from(cdSelectedIds) }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Deleted!', 'success');
      cdSelectedIds.clear();
      document.getElementById('cd-select-all').checked = false;
      cdLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

// ─── Detail Modal ────────────────────────────────────────────────────────────

async function cdShowDetail(id) {
  const c = cdData.find(x => x.id === id);
  if (!c) return;
  cdDetailClient = c;

  document.getElementById('cd-detail-id').textContent = c.id;
  document.getElementById('cd-detail-name').textContent = c.company_name;
  document.getElementById('cd-detail-badges').innerHTML = cdStatusBadge(c.amc_status) + ' ' + cdPriorityBadge(c.priority);

  document.getElementById('cd-detail-contact').innerHTML = `
    <div>👤 ${escapeHTML(c.contact_person || '—')}</div>
    <div>📞 <span class="font-mono">${escapeHTML(c.phone || '—')}</span></div>
    ${c.email ? `<div>✉️ ${escapeHTML(c.email)}</div>` : ''}
    <div>📍 ${escapeHTML(c.address || '—')}</div>
  `;

  document.getElementById('cd-detail-amc').innerHTML = `
    <div>Status: ${cdStatusBadge(c.amc_status)}</div>
    ${c.amc_start ? `<div>Start: <span class="font-mono">${c.amc_start}</span></div>` : ''}
    ${c.amc_end ? `<div>End: <span class="font-mono">${c.amc_end}</span></div>` : ''}
  `;

  const tags = (c.tags || '').split(',').filter(Boolean);
  document.getElementById('cd-detail-tags').innerHTML = tags.length > 0
    ? tags.map(t => `<span class="text-[9px] px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 font-bold">${escapeHTML(t)}</span>`).join('')
    : '<span class="text-[10px] text-slate-500">No tags</span>';

  document.getElementById('cd-detail-stats').innerHTML = `
    <div class="bg-white/5 rounded-xl p-3 text-center"><p class="text-[9px] text-slate-400 uppercase">Jobs</p><p class="text-lg font-black text-white">${c.job_count || 0}</p></div>
    <div class="bg-white/5 rounded-xl p-3 text-center"><p class="text-[9px] text-slate-400 uppercase">Type</p><p class="text-lg font-black text-white">${escapeHTML(c.client_type || 'Corporate')}</p></div>
  `;

  document.getElementById('cd-detail-notes').textContent = c.notes || 'No notes.';

  // Load service history
  const historyContainer = document.getElementById('cd-detail-history');
  historyContainer.innerHTML = '<p class="text-[10px] text-slate-500">Loading...</p>';

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients/${id}/history`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const history = data?.data || data || [];
    if (history.length === 0) {
      historyContainer.innerHTML = '<p class="text-[10px] text-slate-500">No service records.</p>';
    } else {
      historyContainer.innerHTML = history.slice(0, 10).map(h => `
        <div class="bg-white/5 rounded-lg p-2.5 text-[10px]">
          <div class="flex justify-between"><span class="font-bold text-white">${escapeHTML(h.service_type || 'Service')}</span><span class="text-slate-500">${h.created_at ? new Date(h.created_at).toLocaleDateString() : ''}</span></div>
          <p class="text-slate-400 mt-0.5 truncate">${escapeHTML(h.job_description || '')}</p>
        </div>
      `).join('');
    }
  } catch (_) {
    historyContainer.innerHTML = '<p class="text-[10px] text-rose-400">Failed to load history.</p>';
  }

  document.getElementById('cd-detail-modal').classList.remove('hidden');
}

function cdCloseDetail() {
  document.getElementById('cd-detail-modal').classList.add('hidden');
  cdDetailClient = null;
}

function cdEditFromDetail() {
  if (cdDetailClient) {
    const clientId = cdDetailClient.id;
    cdCloseDetail();
    cdEdit(clientId);
  }
}

async function cdDeleteFromDetail() {
  if (cdDetailClient) {
    const id = cdDetailClient.id;
    cdCloseDetail();
    await cdDelete(id);
  }
}

// ─── Add/Edit Form ───────────────────────────────────────────────────────────

function cdOpenAddForm() {
  cdResetForm();
  document.getElementById('cd-form-title').innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400"></span> Add Client';
  document.getElementById('cd-form-modal').classList.remove('hidden');
  document.getElementById('cd-form-company').focus();
}

function cdEdit(id) {
  const c = cdData.find(x => x.id === id);
  if (!c) return;
  document.getElementById('cd-form-id').value = c.id;
  document.getElementById('cd-form-company').value = c.company_name;
  document.getElementById('cd-form-contact').value = c.contact_person || '';
  document.getElementById('cd-form-address').value = c.address || '';
  document.getElementById('cd-form-phone').value = c.phone || '';
  document.getElementById('cd-form-email').value = c.email || '';
  document.getElementById('cd-form-type').value = c.client_type || 'Corporate';
  document.getElementById('cd-form-priority').value = c.priority || 'Normal';
  document.getElementById('cd-form-status').value = c.amc_status || 'Inactive';
  document.getElementById('cd-form-start').value = c.amc_start || '';
  document.getElementById('cd-form-end').value = c.amc_end || '';
  document.getElementById('cd-form-tags').value = c.tags || '';
  document.getElementById('cd-form-notes').value = c.notes || '';
  document.getElementById('cd-form-title').innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Edit Client';
  document.getElementById('cd-form-modal').classList.remove('hidden');
  document.getElementById('cd-form-company').focus();
}

function cdResetForm() {
  document.getElementById('cd-form-id').value = '';
  document.getElementById('cd-form-company').value = '';
  document.getElementById('cd-form-contact').value = '';
  document.getElementById('cd-form-address').value = '';
  document.getElementById('cd-form-phone').value = '';
  document.getElementById('cd-form-email').value = '';
  document.getElementById('cd-form-type').value = 'Corporate';
  document.getElementById('cd-form-priority').value = 'Normal';
  document.getElementById('cd-form-status').value = 'Inactive';
  document.getElementById('cd-form-start').value = '';
  document.getElementById('cd-form-end').value = '';
  document.getElementById('cd-form-tags').value = '';
  document.getElementById('cd-form-notes').value = '';
}

function cdCloseForm() {
  document.getElementById('cd-form-modal').classList.add('hidden');
}

async function cdSubmit() {
  const id = document.getElementById('cd-form-id').value;
  const company_name = document.getElementById('cd-form-company').value.trim();
  const contact_person = document.getElementById('cd-form-contact').value.trim();
  const address = document.getElementById('cd-form-address').value.trim();
  const phone = document.getElementById('cd-form-phone').value.trim();
  const email = document.getElementById('cd-form-email').value.trim();
  const client_type = document.getElementById('cd-form-type').value;
  const priority = document.getElementById('cd-form-priority').value;
  const amc_status = document.getElementById('cd-form-status').value;
  const amc_start = document.getElementById('cd-form-start').value;
  const amc_end = document.getElementById('cd-form-end').value;
  const tags = document.getElementById('cd-form-tags').value.trim();
  const notes = document.getElementById('cd-form-notes').value.trim();

  if (!company_name) { showToast('Company name is required', 'error'); return; }
  if (!address) { showToast('Address is required', 'error'); return; }

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');

  const payload = { company_name, contact_person, address, phone, email, client_type, priority, amc_status, amc_start: amc_start || null, amc_end: amc_end || null, tags, notes };

  try {
    let res;
    if (id) {
      res = await fetch(`${baseUrl}/api/clients/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload),
      });
    } else {
      res = await fetch(`${baseUrl}/api/clients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
        body: JSON.stringify(payload),
      });
    }
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || (id ? 'Client updated!' : 'Client created!'), 'success');
      cdCloseForm();
      cdLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

async function cdDelete(id) {
  if (!confirm('Delete this client?')) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Client deleted!', 'success');
      cdLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

// ─── Export ──────────────────────────────────────────────────────────────────

function cdExportExcel() {
  if (cdData.length === 0) { showToast('No data to export', 'error'); return; }
  const rows = [['ID', 'Company', 'Contact', 'Phone', 'Email', 'Address', 'Type', 'Priority', 'AMC Status', 'AMC Start', 'AMC End', 'Tags', 'Jobs', 'Notes']];
  cdData.forEach(c => {
    rows.push([c.id, c.company_name, c.contact_person || '', c.phone || '', c.email || '', c.address || '', c.client_type || '', c.priority || '', c.amc_status || '', c.amc_start || '', c.amc_end || '', c.tags || '', c.job_count || 0, c.notes || '']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Clients_Directory_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Exported!', 'success');
}

// ─── Init ────────────────────────────────────────────────────────────────────

function cdInitClients() {
  cdLoadData();
}
