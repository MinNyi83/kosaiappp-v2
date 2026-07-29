// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE FEE CATALOG — Upgraded
// ═══════════════════════════════════════════════════════════════════════════════

let sfCurrentFilter = '';
let sfSearchQuery = '';
let sfSelectedIds = new Set();
let sfData = [];
let sfSearchTimeout = null;

// ─── Load data ───────────────────────────────────────────────────────────────

async function sfLoadData() {
  const tbody = document.getElementById('sf-table-container');
  if (!tbody) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const showInactive = document.getElementById('sf-show-inactive')?.checked;

  let url = `${baseUrl}/api/service-fees`;
  const params = new URLSearchParams();
  if (sfCurrentFilter) params.set('category', sfCurrentFilter);
  if (!showInactive) params.set('active', '1');
  if (sfSearchQuery) params.set('q', sfSearchQuery);
  if (params.toString()) url += '?' + params.toString();

  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    sfData = Array.isArray(data) ? data : (data.data || []);
    renderSFTable();
    sfLoadStats();
    sfLoadCategories();
  } catch (err) {
    tbody.innerHTML = `<div class="p-8 text-center text-rose-400 text-xs">Failed to load: ${err.message}</div>`;
  }
}

// ─── Render table grouped by category ────────────────────────────────────────

function renderSFTable() {
  const container = document.getElementById('sf-table-container');
  if (!container) return;

  if (sfData.length === 0) {
    container.innerHTML = '<div class="p-8 text-center text-slate-600 text-xs">No service rates found.</div>';
    document.getElementById('sf-count-label').textContent = '';
    return;
  }

  // Group by category
  const groups = {};
  sfData.forEach(f => {
    const cat = f.category || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  });

  const catIcons = {
    'CCTV': '📹', 'Networking': '🌐', 'WiFi': '📡', 'NAS': '💾',
    'Maintenance': '🔧', 'General': '📋'
  };
  const catColors = {
    'CCTV': 'amber', 'Networking': 'sky', 'WiFi': 'emerald', 'NAS': 'violet',
    'Maintenance': 'rose', 'General': 'slate'
  };

  let html = '';
  const sortedCats = Object.keys(groups).sort();

  sortedCats.forEach(cat => {
    const items = groups[cat];
    const color = catColors[cat] || 'slate';
    const icon = catIcons[cat] || '📋';

    html += `
    <div class="border-b border-white/5">
      <div class="px-4 py-2.5 bg-${color}-500/5 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="text-sm">${icon}</span>
          <span class="text-xs font-bold text-${color}-400 uppercase tracking-wider">${escapeHTML(cat)}</span>
          <span class="text-[10px] text-slate-500">(${items.length})</span>
        </div>
        <span class="text-[10px] text-slate-500">Avg: MMK ${Math.round(items.reduce((s, f) => s + f.fee_amount, 0) / items.length).toLocaleString()}</span>
      </div>`;

    items.forEach(f => {
      const isActive = f.active === 1;
      const isSelected = sfSelectedIds.has(f.id);
      const unitLabel = (f.unit || 'per job').replace('per ', '/');
      html += `
      <div class="px-4 py-3 flex items-center gap-4 hover:bg-white/[0.02] transition-all group ${!isActive ? 'opacity-50' : ''}">
        <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="sfToggleSelect(${f.id})" class="sf-checkbox rounded border-white/20" data-id="${f.id}" />
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-white truncate">${escapeHTML(f.service_type)}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 font-mono">${escapeHTML(unitLabel)}</span>
            ${!isActive ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 font-bold">INACTIVE</span>' : ''}
          </div>
          ${f.description ? `<p class="text-[10px] text-slate-500 mt-0.5 truncate">${escapeHTML(f.description)}</p>` : ''}
        </div>
        <div class="text-right flex-shrink-0">
          <span class="text-xs font-bold font-mono ${f.currency === 'USD' ? 'text-emerald-400' : 'text-amber-400'}">${f.currency} ${f.fee_amount.toLocaleString()}</span>
          ${f.min_charge > 0 ? `<div class="text-[9px] text-slate-500">min: ${f.currency} ${f.min_charge.toLocaleString()}</div>` : ''}
        </div>
        <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onclick="sfToggleActive(${f.id})" class="p-1.5 rounded-lg hover:bg-white/5 transition ${isActive ? 'text-emerald-400' : 'text-slate-500'}" title="Toggle active">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onclick="sfEdit(${f.id})" class="p-1.5 rounded-lg hover:bg-amber-500/10 text-amber-400 transition" title="Edit">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onclick="sfDelete(${f.id})" class="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 transition" title="Delete">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>`;
    });

    html += '</div>';
  });

  container.innerHTML = html;
  document.getElementById('sf-count-label').textContent = `— ${sfData.length} rate${sfData.length !== 1 ? 's' : ''}`;
  sfUpdateBulkBtn();
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function sfLoadStats() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/service-fees/stats`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const s = data?.data || data;
    document.getElementById('sf-stat-total').textContent = s.total ?? '—';
    document.getElementById('sf-stat-active').textContent = s.active_count ?? '—';
    document.getElementById('sf-stat-categories').textContent = s.categories ?? '—';
    document.getElementById('sf-stat-avg').textContent = s.avg_rate ? `K ${Math.round(s.avg_rate).toLocaleString()}` : '—';
  } catch (_) {}
}

// ─── Category chips ──────────────────────────────────────────────────────────

async function sfLoadCategories() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/service-fees/categories`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const cats = data?.data || data || [];
    const container = document.getElementById('sf-category-chips');
    if (!container) return;

    let html = `<button onclick="sfFilterCategory('')" class="sf-chip ${sfCurrentFilter === '' ? 'active' : ''} text-[10px] font-bold px-3 py-1.5 rounded-lg transition">All</button>`;
    cats.forEach(c => {
      const active = sfCurrentFilter === c.category ? 'active' : '';
      html += `<button onclick="sfFilterCategory('${escapeHTML(c.category)}')" class="sf-chip ${active} text-[10px] font-bold px-3 py-1.5 rounded-lg transition">${escapeHTML(c.category)} (${c.count})</button>`;
    });
    container.innerHTML = html;
  } catch (_) {}
}

// ─── Filter / Search ─────────────────────────────────────────────────────────

function sfFilterCategory(cat) {
  sfCurrentFilter = cat;
  sfLoadData();
}

function sfDebouncedSearch() {
  clearTimeout(sfSearchTimeout);
  sfSearchTimeout = setTimeout(() => {
    sfSearchQuery = document.getElementById('sf-search')?.value || '';
    sfLoadData();
  }, 300);
}

// ─── Selection / Bulk ────────────────────────────────────────────────────────

function sfToggleSelect(id) {
  if (sfSelectedIds.has(id)) sfSelectedIds.delete(id);
  else sfSelectedIds.add(id);
  sfUpdateBulkBtn();
}

function sfToggleSelectAll() {
  const all = document.getElementById('sf-select-all')?.checked;
  sfSelectedIds.clear();
  if (all) sfData.forEach(f => sfSelectedIds.add(f.id));
  document.querySelectorAll('.sf-checkbox').forEach(cb => { cb.checked = all; });
  sfUpdateBulkBtn();
}

function sfUpdateBulkBtn() {
  const btn = document.getElementById('sf-bulk-delete-btn');
  const count = document.getElementById('sf-selected-count');
  if (!btn) return;
  if (sfSelectedIds.size > 0) {
    btn.classList.remove('hidden');
    count.textContent = sfSelectedIds.size;
  } else {
    btn.classList.add('hidden');
  }
}

async function sfBulkDelete() {
  if (sfSelectedIds.size === 0) return;
  if (!confirm(`Delete ${sfSelectedIds.size} service rate(s)?`)) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  try {
    const res = await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'bulk_delete', ids: Array.from(sfSelectedIds) }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Deleted!', 'success');
      sfSelectedIds.clear();
      document.getElementById('sf-select-all').checked = false;
      sfLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

function sfOpenAddForm() {
  sfResetForm();
  document.getElementById('sf-form-title').innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Add Service Rate';
  document.getElementById('sf-form-body').classList.remove('hidden');
  document.getElementById('sf-cancel-btn').classList.add('hidden');
  document.getElementById('sf-service-type').focus();
}

function sfEdit(id) {
  const f = sfData.find(x => x.id === id);
  if (!f) return;
  document.getElementById('sf-id').value = f.id;
  document.getElementById('sf-service-type').value = f.service_type;
  document.getElementById('sf-category').value = f.category || 'General';
  document.getElementById('sf-unit').value = f.unit || 'per job';
  document.getElementById('sf-amount').value = f.fee_amount;
  document.getElementById('sf-currency').value = f.currency;
  document.getElementById('sf-min-charge').value = f.min_charge || 0;
  document.getElementById('sf-desc').value = f.description || '';
  document.getElementById('sf-active').checked = f.active === 1;
  document.getElementById('sf-sort-order').value = f.sort_order || 0;
  document.getElementById('sf-form-title').innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Edit Service Rate';
  document.getElementById('sf-cancel-btn').classList.remove('hidden');
  document.getElementById('sf-form-body').classList.remove('hidden');
  document.getElementById('sf-service-type').focus();
}

function sfResetForm() {
  document.getElementById('sf-id').value = '';
  document.getElementById('sf-service-type').value = '';
  document.getElementById('sf-category').value = 'CCTV';
  document.getElementById('sf-unit').value = 'per job';
  document.getElementById('sf-amount').value = '';
  document.getElementById('sf-currency').value = 'MMK';
  document.getElementById('sf-min-charge').value = '';
  document.getElementById('sf-desc').value = '';
  document.getElementById('sf-active').checked = true;
  document.getElementById('sf-sort-order').value = '0';
  document.getElementById('sf-form-title').innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-400"></span> Add Service Rate';
  document.getElementById('sf-cancel-btn').classList.add('hidden');
}

function sfToggleForm() {
  const body = document.getElementById('sf-form-body');
  const toggle = document.getElementById('sf-form-toggle');
  if (body.classList.contains('hidden')) {
    body.classList.remove('hidden');
    toggle.textContent = '−';
  } else {
    body.classList.add('hidden');
    toggle.textContent = '+';
  }
}

async function sfSubmit() {
  const id = document.getElementById('sf-id').value;
  const service_type = document.getElementById('sf-service-type').value.trim();
  const category = document.getElementById('sf-category').value;
  const unit = document.getElementById('sf-unit').value;
  const fee_amount = parseFloat(document.getElementById('sf-amount').value);
  const currency = document.getElementById('sf-currency').value;
  const min_charge = parseFloat(document.getElementById('sf-min-charge').value || '0');
  const description = document.getElementById('sf-desc').value.trim();
  const active = document.getElementById('sf-active').checked;
  const sort_order = parseInt(document.getElementById('sf-sort-order').value || '0', 10);

  if (!service_type) { showToast('Service name is required', 'error'); return; }
  if (isNaN(fee_amount) || fee_amount < 0) { showToast('Valid rate amount is required', 'error'); return; }

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  const action = id ? 'update' : 'create';

  try {
    const res = await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action, id: id ? parseInt(id) : undefined, service_type, fee_amount, currency, description, category, unit, min_charge, active, sort_order }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || (action === 'create' ? 'Rate created!' : 'Rate updated!'), 'success');
      sfResetForm();
      sfLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

async function sfDelete(id) {
  if (!confirm('Delete this service rate?')) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  try {
    const res = await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'delete', id }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast('Rate deleted!', 'success');
      sfLoadData();
    } else {
      showToast('Error: ' + (data.error || 'Unknown'), 'error');
    }
  } catch (_) {
    showToast('Connection error', 'error');
  }
}

async function sfToggleActive(id) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const csrfToken = localStorage.getItem('csrf_token');
  try {
    await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ action: 'toggle_active', id }),
    });
    sfLoadData();
  } catch (_) {}
}

// ─── Export ──────────────────────────────────────────────────────────────────

function sfExportExcel() {
  if (sfData.length === 0) { showToast('No data to export', 'error'); return; }
  const rows = [['ID', 'Service Name', 'Category', 'Unit', 'Rate', 'Currency', 'Min Charge', 'Active', 'Description', 'Created']];
  sfData.forEach(f => {
    rows.push([f.id, f.service_type, f.category, f.unit, f.fee_amount, f.currency, f.min_charge || 0, f.active ? 'Yes' : 'No', f.description || '', f.created_at || '']);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Service_Fees_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Exported!', 'success');
}

// ─── Init ────────────────────────────────────────────────────────────────────

function sfInitServiceFees() {
  sfLoadData();
}
