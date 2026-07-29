// ── Surveys & Quotations Tab Functions ──────────────────────────────────────
let cachedSurveysList = [];
let cachedQuotationsList = [];

async function populateSurveyClientDropdown() {
  const selectEl = document.getElementById('survey-client-filter');
  if (!selectEl) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const list = Array.isArray(data) ? data : (data?.clients || data?.data?.clients || data?.data || []);
    
    selectEl.innerHTML = `<option value="">All Clients</option>` + list.map(c => `
      <option value="${escapeHTML(c.id)}">${escapeHTML(c.company_name)} (${escapeHTML(c.id)})</option>
    `).join('');
  } catch (err) {
    console.error('Failed to populate survey client dropdown:', err);
  }
}
window.populateSurveyClientDropdown = populateSurveyClientDropdown;

function filterSurveysByClient(clientId) {
  loadSurveysData(clientId);
  loadQuotationsData(clientId);
}
window.filterSurveysByClient = filterSurveysByClient;

async function loadSurveysData(filterClientId = '') {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const bodyEl = document.getElementById('surveys-table-body');
  if (!bodyEl) return;

  showLoading('Loading surveys...');
  try {
    const url = filterClientId ? `${baseUrl}/api/surveys?client_id=${encodeURIComponent(filterClientId)}` : `${baseUrl}/api/surveys`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const surveys = Array.isArray(data) ? data : (data.data || []);
    cachedSurveysList = surveys;
    
    document.getElementById('surveys-count-total').textContent = surveys.length;

    if (surveys.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500 italic">No site surveys logged yet.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = surveys.map(s => `
      <tr class="hover:bg-white/5 transition-all">
        <td class="font-mono font-bold text-teal-400">${escapeHTML(s.id)}</td>
        <td>${escapeHTML(s.client_name || s.client_id || 'Unknown')}</td>
        <td><span class="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-slate-300">${escapeHTML(s.survey_type || 'CCTV')}</span></td>
        <td class="font-mono text-center">${s.camera_count || 0}</td>
        <td>${escapeHTML(s.cable_type || 'Cat6')} (${s.estimated_cable_meters || 0}m)</td>
        <td><span class="badge badge-quoted">${escapeHTML(s.status || 'Draft')}</span></td>
        <td>
          <button onclick="estimateQuotationForSurvey('${s.id}')" class="text-xs text-amber-400 hover:underline font-bold">🤖 AI Quote</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Failed to load surveys:', err);
    bodyEl.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400 font-bold">Error loading surveys</td></tr>`;
  } finally { hideLoading(); }
}
window.loadSurveysData = loadSurveysData;

async function loadQuotationsData(filterClientId = '') {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const bodyEl = document.getElementById('quotations-table-body');
  if (!bodyEl) return;

  showLoading('Loading quotations...');
  try {
    const url = filterClientId ? `${baseUrl}/api/quotations?client_id=${encodeURIComponent(filterClientId)}` : `${baseUrl}/api/quotations`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    let quotations = Array.isArray(data) ? data : (data.data || []);
    if (filterClientId) {
      quotations = quotations.filter(q => q.client_id === filterClientId);
    }
    cachedQuotationsList = quotations;

    const activeCount = quotations.filter(q => q.status === 'Draft' || q.status === 'Sent').length;
    const approvedCount = quotations.filter(q => q.status === 'Approved').length;
    const convertedCount = quotations.filter(q => q.status === 'Converted').length;

    if (document.getElementById('quotations-count-active')) document.getElementById('quotations-count-active').textContent = activeCount;
    if (document.getElementById('quotations-count-approved')) document.getElementById('quotations-count-approved').textContent = approvedCount;
    if (document.getElementById('quotations-count-converted')) document.getElementById('quotations-count-converted').textContent = convertedCount;

    if (quotations.length === 0) {
      bodyEl.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-500 italic">No price quotations created yet.</td></tr>`;
      return;
    }

    bodyEl.innerHTML = `
      <tr id="bulk-actions-bar" class="hidden"><td colspan="6" class="py-2 px-3 bg-indigo-950/30 border-b border-indigo-500/20">
        <div class="flex items-center gap-3 text-xs">
          <span class="text-slate-300 font-bold"><span id="bulk-selected-count">0</span> selected</span>
          <button onclick="bulkQuotationAction('send')" class="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold transition">📨 Send All</button>
          <button onclick="bulkQuotationAction('convert-job')" class="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition">🚀 Convert to Jobs</button>
          <button onclick="bulkQuotationAction('convert-invoice')" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition">💰 Convert to Invoices</button>
          <button onclick="bulkQuotationAction('delete')" class="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-bold transition">🗑 Delete</button>
          <button onclick="toggleAllQuotationCheckboxes()" class="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg transition ml-auto">Select All</button>
        </div>
      </td></tr>
      ${quotations.map(q => `
      <tr class="hover:bg-white/5 transition-all cursor-pointer" onclick="openQuotationDetail('${q.id}')">
        <td class="w-8" onclick="event.stopPropagation()"><input type="checkbox" class="quotation-bulk-check accent-indigo-500" data-id="${q.id}" onchange="updateBulkSelectedCount()"></td>
        <td class="font-mono font-bold text-amber-400">${escapeHTML(q.id)}</td>
        <td>${escapeHTML(q.client_name || q.client_id || 'Unknown')}</td>
        <td class="text-xs text-slate-400">${q.item_count || 0} items</td>
        <td class="font-mono font-bold text-white">$${(q.total_amount || 0).toFixed(2)}</td>
        <td><span class="badge ${q.status === 'Approved' ? 'badge-approved' : q.status === 'Converted' ? 'badge-converted' : q.status === 'Sent' ? 'badge-quoted' : 'badge-pending'}">${escapeHTML(q.status || 'Draft')}</span></td>
        <td class="space-x-2">
          ${q.status !== 'Converted' ? `
            <button onclick="event.stopPropagation();convertQuotationToJob('${q.id}')" class="text-[11px] text-sky-400 hover:underline font-bold">🚀 Job</button>
            <button onclick="event.stopPropagation();convertQuotationToInvoice('${q.id}')" class="text-[11px] text-emerald-400 hover:underline font-bold">💰 Invoice</button>
          ` : `<span class="text-xs text-slate-500 font-semibold">Converted</span>`}
        </td>
      </tr>`).join('')}`;
  } catch (err) {
    console.error('Failed to load quotations:', err.message);
    bodyEl.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-rose-400 font-bold">Error loading quotations</td></tr>`;
  } finally { hideLoading(); }
}
window.loadQuotationsData = loadQuotationsData;

function updateBulkSelectedCount() {
  const checks = document.querySelectorAll('.quotation-bulk-check:checked');
  const count = checks.length;
  const bar = document.getElementById('bulk-actions-bar');
  const countEl = document.getElementById('bulk-selected-count');
  if (bar) bar.classList.toggle('hidden', count === 0);
  if (countEl) countEl.textContent = count;
}
window.updateBulkSelectedCount = updateBulkSelectedCount;

function toggleAllQuotationCheckboxes() {
  const checks = document.querySelectorAll('.quotation-bulk-check');
  const allChecked = Array.from(checks).every(c => c.checked);
  checks.forEach(c => c.checked = !allChecked);
  updateBulkSelectedCount();
}
window.toggleAllQuotationCheckboxes = toggleAllQuotationCheckboxes;

async function bulkQuotationAction(action) {
  const checks = document.querySelectorAll('.quotation-bulk-check:checked');
  const ids = Array.from(checks).map(c => c.dataset.id);
  if (ids.length === 0) return showToast('No quotations selected', 'error');
  if (action === 'delete' && !confirm(`Delete ${ids.length} quotation(s)? This cannot be undone.`)) return;
  if ((action === 'send' || action === 'convert-job' || action === 'convert-invoice') && !confirm(`${action.replace('-', ' ')} ${ids.length} quotation(s)?`)) return;

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  showLoading(`Bulk ${action}...`);
  try {
    const res = await fetch(`${baseUrl}/api/quotations/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action, quotation_ids: ids })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Bulk operation failed');
    showToast(`✅ ${data.processed} quotation(s) processed${data.errors ? `, ${data.errors.length} errors` : ''}`, 'success');
    loadQuotationsData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally { hideLoading(); }
}
window.bulkQuotationAction = bulkQuotationAction;

async function convertQuotationToJob(quotationId) {
  if (!confirm(`Convert Quotation ${quotationId} into an active Service Job?`)) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  showLoading('Converting to job...');
  try {
    const res = await fetch(`${baseUrl}/api/quotations/${quotationId}/convert-job`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');
    showToast(data.message || 'Converted to Job!', 'success');
    loadQuotationsData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally { hideLoading(); }
}
window.convertQuotationToJob = convertQuotationToJob;

async function convertQuotationToInvoice(quotationId) {
  if (!confirm(`Convert Quotation ${quotationId} into a POS Invoice?`)) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  showLoading('Converting to invoice...');
  try {
    const res = await fetch(`${baseUrl}/api/quotations/${quotationId}/convert-invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Conversion failed');
    showToast(data.message || 'Converted to POS Invoice!', 'success');
    loadQuotationsData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally { hideLoading(); }
}
window.convertQuotationToInvoice = convertQuotationToInvoice;

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
window.openModal = openModal;

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}
window.closeModal = closeModal;

let cachedInventoryItems = [];

async function loadClientsForSurveyDropdown() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const clients = Array.isArray(data) ? data : (data?.clients || data?.data?.clients || data?.data || []);
    const sel = document.getElementById('modal-survey-client-select');
    if (!sel) return;
    const existing = sel.querySelector('option[value="__NEW__"]');
    sel.innerHTML = '<option value="">-- Select Client --</option>';
    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.company_name} (${c.amc_status || 'Individual'})`;
      sel.appendChild(opt);
    });
    if (existing) sel.appendChild(existing);
    else { const o = document.createElement('option'); o.value = '__NEW__'; o.textContent = '➕ Create New...'; sel.appendChild(o); }
  } catch (e) { console.warn('Failed to load clients for survey:', e); }
}

async function loadTechniciansForSurveyDropdown() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/technicians`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const techs = Array.isArray(data) ? data : (data.data || []);
    const sel = document.getElementById('modal-survey-technician');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select...</option>';
    techs.filter(t => t.active !== 0).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.name;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn('Failed to load technicians:', e); }
}

function toggleSurveyClientNewInput(val) {
  const el = document.getElementById('modal-survey-client-new-fields');
  if (el) el.classList.toggle('hidden', val !== '__NEW__');
}
window.toggleSurveyClientNewInput = toggleSurveyClientNewInput;

function updateSurveyTypeFields(type) {
  const allTypes = ['cctv', 'networking', 'wifi', 'nas', 'access_control', 'general'];
  allTypes.forEach(t => {
    const el = document.getElementById(`survey-type-fields-${t}`);
    if (el) el.classList.add('hidden');
  });
  const map = { 'CCTV': 'cctv', 'Networking': 'networking', 'WiFi': 'wifi', 'NAS': 'nas', 'Access Control': 'access_control', 'General': 'general' };
  const show = document.getElementById(`survey-type-fields-${map[type] || 'general'}`);
  if (show) show.classList.remove('hidden');
}
window.updateSurveyTypeFields = updateSurveyTypeFields;

function openNewSurveyModal() {
  openModal('modal-new-survey');
  loadClientsForSurveyDropdown();
  loadTechniciansForSurveyDropdown();
  updateSurveyTypeFields(document.getElementById('modal-survey-type')?.value || 'CCTV');
}
window.openNewSurveyModal = openNewSurveyModal;

async function openNewQuotationModal() {
  openModal('modal-new-quotation');
  await loadClientsForQuotationDropdown();
  await loadSurveysForQuotationDropdown();
  await loadInventoryForLineItems();
}
window.openNewQuotationModal = openNewQuotationModal;

async function loadClientsForQuotationDropdown() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/clients`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const clients = Array.isArray(data) ? data : (data?.clients || data?.data?.clients || data?.data || []);
    const sel = document.getElementById('modal-quote-client-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Select Client --</option>';
    clients.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.company_name} (${c.amc_status || 'Individual'})`;
      sel.appendChild(opt);
    });
    const o = document.createElement('option'); o.value = '__NEW__'; o.textContent = '➕ Create New...'; sel.appendChild(o);
  } catch (e) { console.warn('Failed to load clients:', e); }
}

function toggleQuoteClientNewInput(val) {
  const el = document.getElementById('modal-quote-client-new-fields');
  if (el) el.classList.toggle('hidden', val !== '__NEW__');
}
window.toggleQuoteClientNewInput = toggleQuoteClientNewInput;

async function loadSurveysForQuotationDropdown() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/surveys`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    const surveys = Array.isArray(data) ? data : (data.data || data.surveys || []);
    const sel = document.getElementById('modal-quote-survey-link');
    if (!sel) return;
    sel.innerHTML = '<option value="">None</option>';
    surveys.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = `${s.id} — ${s.client_name || s.client_id}`;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn('Failed to load surveys:', e); }
}

async function loadInventoryForLineItems() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  try {
    const res = await fetch(`${baseUrl}/api/inventory`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    cachedInventoryItems = Array.isArray(data) ? data : (data.data || []);
    const sel = document.getElementById('line-item-inventory-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">-- Type manually or select from inventory --</option>';
    cachedInventoryItems.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.item_code || item.id;
      opt.textContent = `${item.item_code || ''} — ${item.model || item.name || ''} ($${item.sale_price || item.unit_price || 0})`;
      sel.appendChild(opt);
    });
  } catch (e) { console.warn('Failed to load inventory:', e); }
}

function fillFromInventory(code) {
  if (!code) return;
  const item = cachedInventoryItems.find(i => (i.item_code || i.id) === code);
  if (!item) return;
  document.getElementById('line-item-name').value = item.model || item.name || '';
  document.getElementById('line-item-code').value = item.item_code || '';
  document.getElementById('line-item-price').value = item.sale_price || item.unit_price || 0;
  document.getElementById('line-item-unit').value = item.unit || 'pc';
  const cat = (item.category || '').toLowerCase();
  const catMap = { 'camera': 'hardware', 'nvr': 'hardware', 'switch': 'hardware', 'router': 'hardware', 'cable': 'cable', 'cat6': 'cable', 'fiber': 'cable', 'labor': 'labor', 'license': 'software' };
  document.getElementById('line-item-category').value = catMap[cat] || 'hardware';
}
window.fillFromInventory = fillFromInventory;

function submitNewSurvey(e) {
  e.preventDefault();
  const clientId = document.getElementById('modal-survey-client-select')?.value;
  const isNewClient = clientId === '__NEW__';
  const newClientName = document.getElementById('modal-survey-client-new-name')?.value?.trim();
  const surveyType = document.getElementById('modal-survey-type')?.value;
  const techId = document.getElementById('modal-survey-technician')?.value;

  if (isNewClient && !newClientName) return showToast('Please enter a company name for the new client', 'warning');
  if (!isNewClient && !clientId) return showToast('Please select a client', 'warning');

  let cameraCount = 0, cableMeters = 0, extraFields = {};
  if (surveyType === 'CCTV') {
    cameraCount = parseInt(document.getElementById('modal-survey-cameras')?.value) || 0;
    cableMeters = parseFloat(document.getElementById('modal-survey-cable-meters')?.value) || 0;
  } else if (surveyType === 'Networking') {
    extraFields.switches = parseInt(document.getElementById('modal-survey-switches')?.value) || 0;
    cableMeters = parseFloat(document.getElementById('modal-survey-net-cable')?.value) || 0;
  } else if (surveyType === 'WiFi') {
    extraFields.access_points = parseInt(document.getElementById('modal-survey-access-points')?.value) || 0;
    extraFields.coverage_area = parseFloat(document.getElementById('modal-survey-coverage-area')?.value) || 0;
  } else if (surveyType === 'NAS') {
    extraFields.storage_tb = parseFloat(document.getElementById('modal-survey-storage-tb')?.value) || 0;
    extraFields.drives = parseInt(document.getElementById('modal-survey-drives')?.value) || 0;
  } else if (surveyType === 'Access Control') {
    extraFields.doors = parseInt(document.getElementById('modal-survey-doors')?.value) || 0;
    extraFields.readers = parseInt(document.getElementById('modal-survey-readers')?.value) || 0;
  } else if (surveyType === 'General') {
    extraFields.description = document.getElementById('modal-survey-general-desc')?.value || '';
  }

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const payload = {
    client_id: isNewClient ? newClientName : clientId,
    technician_id: techId || undefined,
    survey_type: surveyType,
    camera_count: cameraCount,
    estimated_cable_meters: cableMeters,
    status: 'Draft',
    site_address: document.getElementById('modal-survey-address')?.value || '',
    contact_name: document.getElementById('modal-survey-contact-name')?.value || '',
    contact_phone: document.getElementById('modal-survey-contact-phone')?.value || '',
    existing_infrastructure: document.getElementById('modal-survey-existing-infra')?.value || '',
    special_requirements: document.getElementById('modal-survey-special-req')?.value || '',
    scheduled_date: document.getElementById('modal-survey-scheduled-date')?.value || '',
    notes: JSON.stringify(extraFields),
  };

  fetch(`${baseUrl}/api/surveys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
    .then((res) => res.json())
    .then((data) => {
      showToast(data.message || 'Site Survey logged successfully!', 'success');
      closeModal('modal-new-survey');
      loadSurveysData();
    })
    .catch((err) => showToast('Failed to create survey: ' + err.message, 'error'));
}
window.submitNewSurvey = submitNewSurvey;

function submitNewQuotation(e) {
  e.preventDefault();
  const clientId = document.getElementById('modal-quote-client-select')?.value;
  const isNewClient = clientId === '__NEW__';
  const newClientName = document.getElementById('modal-quote-client-new-name')?.value?.trim();
  const validDays = parseInt(document.getElementById('modal-quote-valid-days')?.value) || 14;
  const discountPct = parseFloat(document.getElementById('modal-quote-discount-pct')?.value) || 0;
  const discountAmt = parseFloat(document.getElementById('modal-quote-discount-amt')?.value) || 0;
  const taxPct = parseFloat(document.getElementById('modal-quote-tax-pct')?.value) || 0;
  const terms = document.getElementById('modal-quote-terms')?.value || '';
  const surveyLink = document.getElementById('modal-quote-survey-link')?.value || '';

  if (isNewClient && !newClientName) return showToast('Please enter a company name for the new client', 'warning');
  if (!isNewClient && !clientId) return showToast('Please select a client', 'warning');

  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  fetch(`${baseUrl}/api/quotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      client_id: isNewClient ? newClientName : clientId,
      currency: 'USD',
      valid_days: validDays,
      discount_pct: discountPct,
      discount_amount: discountAmt,
      tax_pct: taxPct,
      terms_conditions: terms,
      survey_id_link: surveyLink || undefined,
      status: 'Draft',
    }),
  })
    .then((res) => res.json())
    .then((data) => {
      showToast(data.message || 'Quotation created! Add line items next.', 'success');
      closeModal('modal-new-quotation');
      loadQuotationsData();
    })
    .catch((err) => showToast('Failed to create quotation: ' + err.message, 'error'));
}
window.submitNewQuotation = submitNewQuotation;

async function estimateQuotationForSurvey(surveyId) {
  showToast('🤖 AI Estimating Bill of Materials...', 'info', 3000);
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');

  showLoading('AI generating quotation...');
  try {
    const res = await fetch(`${baseUrl}/api/ai/estimate-quotation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ survey_id: surveyId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'AI estimation failed');
    const items = data.data?.recommended_items || data.recommended_items || [];
    alert(`🤖 AI Quotation Recommendation for ${surveyId}:\n\n` + JSON.stringify(items, null, 2));
  } catch (err) {
    showToast(err.message, 'error');
  } finally { hideLoading(); }
}
window.estimateQuotationForSurvey = estimateQuotationForSurvey;

let currentQuotationDetail = null;

window.downloadQuotationPDF = function downloadQuotationPDF() {
  if (!currentQuotationDetail) return showToast('No quotation loaded', 'error');
  const q = currentQuotationDetail;
  const items = q.line_items || [];
  let win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${q.id} — Quotation</title>
    <style>
      body{font-family:'Segoe UI',Arial,sans-serif;margin:40px;color:#1a1a2e;font-size:13px}
      .header{display:flex;justify-content:space-between;border-bottom:3px solid #f59e0b;padding-bottom:16px;margin-bottom:24px}
      .logo{font-size:22px;font-weight:800;color:#f59e0b}
      table{width:100%;border-collapse:collapse;margin:16px 0}
      th{background:#f59e0b;color:#000;padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
      td{padding:10px 12px;border-bottom:1px solid #e5e7eb}
      .totals{display:flex;flex-direction:column;align-items:flex-end;gap:4px;margin-top:16px}
      .totals .row{display:flex;justify-content:space-between;width:280px;font-size:13px}
      .totals .grand{font-size:16px;font-weight:800;border-top:2px solid #f59e0b;padding-top:6px;margin-top:4px}
      .footer{margin-top:40px;font-size:11px;color:#666;text-align:center;border-top:1px solid #e5e7eb;padding-top:12px}
      @media print{body{margin:20px}}
    </style></head><body>
    <div class="header"><div><div class="logo">Awesome Myanmar CCTV</div><div style="font-size:11px;color:#666;margin-top:4px">Field Service Management</div></div>
    <div style="text-align:right"><div style="font-size:18px;font-weight:700">QUOTATION</div><div style="font-size:12px;color:#666">${q.id}</div><div style="font-size:12px;color:#666">Date: ${q.quotation_date || new Date().toLocaleDateString()}</div><div style="font-size:12px;color:#666">Valid Until: ${q.valid_until || 'N/A'}</div></div></div>
    <div style="margin-bottom:16px"><strong>Client:</strong> ${q.client_name || q.client_id || 'N/A'}<br><strong>Prepared by:</strong> ${q.prepared_by_name || 'Admin'}</div>
    <table><thead><tr><th>#</th><th>Item</th><th>Category</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>
    ${items.map((it, i) => `<tr><td>${i+1}</td><td>${it.name}${it.item_code ? ` (${it.item_code})` : ''}</td><td>${it.category || 'hardware'}</td><td>${it.quantity}</td><td>${it.unit || 'pc'}</td><td>$${(it.unit_price||0).toFixed(2)}</td><td>$${((it.quantity||0)*(it.unit_price||0)).toFixed(2)}</td></tr>`).join('')}
    </tbody></table>
    <div class="totals">
      <div class="row"><span>Subtotal:</span><span>$${(q.subtotal||0).toFixed(2)}</span></div>
      ${q.discount > 0 ? `<div class="row"><span>Discount:</span><span>-$${(q.discount||0).toFixed(2)}</span></div>` : ''}
      ${q.tax > 0 ? `<div class="row"><span>Tax:</span><span>$${(q.tax||0).toFixed(2)}</span></div>` : ''}
      <div class="row grand"><span>TOTAL:</span><span>$${(q.total_amount||0).toFixed(2)}</span></div>
    </div>
    ${q.terms_conditions ? `<div style="margin-top:24px"><strong>Terms & Conditions:</strong><br>${q.terms_conditions.replace(/\n/g,'<br>')}</div>` : ''}
    <div class="footer">Generated by Awesome Myanmar CCTV & FSM Platform — ${new Date().toLocaleString()}</div>
    </body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

window.downloadQuotationExcel = function downloadQuotationExcel() {
  if (!currentQuotationDetail) return showToast('No quotation loaded', 'error');
  const q = currentQuotationDetail;
  const items = q.line_items || [];
  const rows = [
    ['QUOTATION', q.id, '', '', '', '', ''],
    ['Client', q.client_name || q.client_id || '', '', '', '', ''],
    ['Date', q.quotation_date || '', 'Valid Until', q.valid_until || '', '', ''],
    ['Prepared By', q.prepared_by_name || 'Admin', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['#', 'Item', 'Category', 'Qty', 'Unit', 'Unit Price ($)', 'Total ($)'],
    ...items.map((it, i) => [i+1, `${it.name}${it.item_code ? ' ('+it.item_code+')' : ''}`, it.category||'hardware', it.quantity, it.unit||'pc', (it.unit_price||0).toFixed(2), ((it.quantity||0)*(it.unit_price||0)).toFixed(2)]),
    ['', '', '', '', '', '', ''],
    ['', '', '', '', 'Subtotal', '$'+(q.subtotal||0).toFixed(2)],
    ['', '', '', '', 'Discount', '-$'+(q.discount||0).toFixed(2)],
    ['', '', '', '', 'Tax', '$'+(q.tax||0).toFixed(2)],
    ['', '', '', '', 'TOTAL', '$'+(q.total_amount||0).toFixed(2)],
    ['', '', '', '', '', '', ''],
    ['Terms:', q.terms_conditions || '', '', '', '', '', ''],
  ];
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff'+csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${q.id}_quotation.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function openQuotationDetail(quotationId) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  showLoading('Loading quotation...');
  fetch(`${baseUrl}/api/quotations/${quotationId}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => {
      const q = data.data || data;
      currentQuotationDetail = q;
      document.getElementById('quote-detail-id').textContent = q.id;
      const statusEl = document.getElementById('quote-detail-status');
      statusEl.textContent = q.status || 'Draft';
      statusEl.className = `text-[10px] px-2 py-0.5 rounded-full border ${q.status === 'Approved' ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' : q.status === 'Sent' ? 'border-amber-500/50 text-amber-400 bg-amber-500/10' : 'border-white/20 text-slate-400 bg-white/5'}`;
      const items = q.line_items || [];
      document.getElementById('quote-detail-content').innerHTML = `
        <div class="grid grid-cols-2 gap-3 text-xs mb-3">
          <div><span class="text-slate-400">Client:</span> <span class="text-white font-semibold">${q.client_name || q.client_id || 'N/A'}</span></div>
          <div><span class="text-slate-400">Prepared by:</span> <span class="text-white">${q.prepared_by_name || 'Admin'}</span></div>
          <div><span class="text-slate-400">Date:</span> <span class="text-white">${q.quotation_date || '--'}</span></div>
          <div><span class="text-slate-400">Valid Until:</span> <span class="text-white">${q.valid_until || '--'}</span></div>
        </div>
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-xs font-bold text-white">Line Items (${items.length})</h4>
          <button onclick="openAddLineItem('${q.id}')" class="text-[11px] text-emerald-400 hover:underline font-bold">+ Add Item</button>
        </div>
        ${items.length > 0 ? `
        <div class="overflow-x-auto">
          <table class="w-full text-xs"><thead><tr class="border-b border-white/10">
            <th class="text-left py-2 px-2 text-slate-400 font-semibold">Item</th>
            <th class="text-center py-2 px-2 text-slate-400 font-semibold">Cat</th>
            <th class="text-center py-2 px-2 text-slate-400 font-semibold">Qty</th>
            <th class="text-right py-2 px-2 text-slate-400 font-semibold">Price</th>
            <th class="text-right py-2 px-2 text-slate-400 font-semibold">Total</th>
            <th class="text-right py-2 px-2 text-slate-400 font-semibold">Act</th>
          </tr></thead><tbody>
          ${items.map(it => `<tr class="border-b border-white/5 hover:bg-white/5">
            <td class="py-2 px-2 text-white">${it.name}${it.item_code ? `<span class="text-slate-500 ml-1">(${it.item_code})</span>` : ''}</td>
            <td class="py-2 px-2 text-center"><span class="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-slate-300">${it.category||'hw'}</span></td>
            <td class="py-2 px-2 text-center text-white">${it.quantity} ${it.unit||'pc'}</td>
            <td class="py-2 px-2 text-right text-white">$${(it.unit_price||0).toFixed(2)}</td>
            <td class="py-2 px-2 text-right font-bold text-emerald-400">$${((it.quantity||0)*(it.unit_price||0)).toFixed(2)}</td>
            <td class="py-2 px-2 text-right space-x-1">
              <button onclick="openEditLineItem('${q.id}','${it.id}')" class="text-amber-400 hover:underline">Edit</button>
              <button onclick="deleteLineItem('${q.id}','${it.id}')" class="text-rose-400 hover:underline">Del</button>
            </td>
          </tr>`).join('')}
          </tbody></table>
        </div>` : '<div class="text-center py-4 text-slate-500 italic">No items added yet</div>'}
        <div class="border-t border-white/10 pt-3 mt-3 space-y-1 text-xs flex flex-col items-end">
          <div class="flex justify-between w-64"><span class="text-slate-400">Subtotal:</span><span class="text-white">$${(q.subtotal||0).toFixed(2)}</span></div>
          ${q.discount > 0 ? `<div class="flex justify-between w-64"><span class="text-slate-400">Discount:</span><span class="text-rose-400">-$${(q.discount||0).toFixed(2)}</span></div>` : ''}
          ${q.tax > 0 ? `<div class="flex justify-between w-64"><span class="text-slate-400">Tax:</span><span class="text-white">$${(q.tax||0).toFixed(2)}</span></div>` : ''}
          <div class="flex justify-between w-64 text-base font-bold border-t border-white/10 pt-1"><span class="text-white">TOTAL:</span><span class="text-emerald-400">$${(q.total_amount||0).toFixed(2)}</span></div>
        </div>
        <div class="flex justify-between items-center pt-3 border-t border-white/10">
          <div class="flex gap-2">
            ${q.status !== 'Converted' ? `
              <button onclick="convertQuotationToJob('${q.id}')" class="text-[11px] bg-sky-500/20 text-sky-400 px-3 py-1.5 rounded-lg hover:bg-sky-500/30 font-bold">🚀 Convert to Job</button>
              <button onclick="convertQuotationToInvoice('${q.id}')" class="text-[11px] bg-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-500/30 font-bold">💰 Convert to Invoice</button>
              <button onclick="sendQuotationToClient('${q.id}')" class="text-[11px] bg-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/30 font-bold">📤 Send to Client</button>
            ` : '<span class="text-xs text-slate-500 font-semibold">Converted</span>'}
          </div>
        </div>`;
      openModal('modal-quotation-detail');
    })
    .catch(err => showToast('Failed to load quotation: ' + err.message, 'error'))
    .finally(() => hideLoading());
}
window.openQuotationDetail = openQuotationDetail;

function openAddLineItem(quotationId) {
  document.getElementById('line-item-quotation-id').value = quotationId;
  document.getElementById('line-item-edit-id').value = '';
  document.getElementById('line-item-modal-title').textContent = 'Add Line Item';
  document.getElementById('line-item-name').value = '';
  document.getElementById('line-item-code').value = '';
  document.getElementById('line-item-qty').value = '1';
  document.getElementById('line-item-price').value = '0';
  document.getElementById('line-item-unit').value = 'pc';
  document.getElementById('line-item-notes').value = '';
  document.getElementById('line-item-category').value = 'hardware';
  const sel = document.getElementById('line-item-inventory-select');
  if (sel) sel.value = '';
  loadInventoryForLineItems();
  openModal('modal-line-item');
}
window.openAddLineItem = openAddLineItem;

function openEditLineItem(quotationId, itemId) {
  if (!currentQuotationDetail || !currentQuotationDetail.line_items) return;
  const item = currentQuotationDetail.line_items.find(i => i.id === itemId);
  if (!item) return;
  document.getElementById('line-item-quotation-id').value = quotationId;
  document.getElementById('line-item-edit-id').value = itemId;
  document.getElementById('line-item-modal-title').textContent = 'Edit Line Item';
  document.getElementById('line-item-name').value = item.name || '';
  document.getElementById('line-item-code').value = item.item_code || '';
  document.getElementById('line-item-qty').value = item.quantity || 1;
  document.getElementById('line-item-price').value = item.unit_price || 0;
  document.getElementById('line-item-unit').value = item.unit || 'pc';
  document.getElementById('line-item-notes').value = item.notes || '';
  document.getElementById('line-item-category').value = item.category || 'hardware';
  openModal('modal-line-item');
}
window.openEditLineItem = openEditLineItem;

function submitLineItem(e) {
  e.preventDefault();
  const quotationId = document.getElementById('line-item-quotation-id').value;
  const editId = document.getElementById('line-item-edit-id').value;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  const payload = {
    name: document.getElementById('line-item-name').value,
    item_code: document.getElementById('line-item-code').value || undefined,
    category: document.getElementById('line-item-category').value,
    quantity: parseFloat(document.getElementById('line-item-qty').value) || 1,
    unit_price: parseFloat(document.getElementById('line-item-price').value) || 0,
    unit: document.getElementById('line-item-unit').value || 'pc',
    notes: document.getElementById('line-item-notes').value || undefined,
  };
  const method = editId ? 'PUT' : 'POST';
  const url = editId ? `${baseUrl}/api/quotations/${quotationId}/items/${editId}` : `${baseUrl}/api/quotations/${quotationId}/items`;
  fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) })
    .then(r => r.json())
    .then(data => {
      showToast(data.message || (editId ? 'Item updated' : 'Item added'), 'success');
      closeModal('modal-line-item');
      openQuotationDetail(quotationId);
    })
    .catch(err => showToast('Failed: ' + err.message, 'error'));
}
window.submitLineItem = submitLineItem;

function deleteLineItem(quotationId, itemId) {
  if (!confirm('Delete this line item?')) return;
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  fetch(`${baseUrl}/api/quotations/${quotationId}/items/${itemId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json())
    .then(data => { showToast('Item deleted', 'success'); openQuotationDetail(quotationId); })
    .catch(err => showToast('Failed: ' + err.message, 'error'));
}
window.deleteLineItem = deleteLineItem;

async function sendQuotationToClient(quotationId) {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  showLoading('Sending quotation...');
  try {
    const res = await fetch(`${baseUrl}/api/quotations/${quotationId}/send`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Send failed');
    showToast(data.message || 'Quotation sent via Telegram!', 'success');
    openQuotationDetail(quotationId);
  } catch (err) { showToast(err.message, 'error'); }
  finally { hideLoading(); }
}
window.sendQuotationToClient = sendQuotationToClient;

