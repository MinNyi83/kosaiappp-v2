// ═══════════════════════════════════════════════════════════════════════════════
// RECEIPT BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

let rbSettings = JSON.parse(localStorage.getItem('rb-settings') || '{}');
let rbCurrentData = null;

const RB_PAPER_SIZES = {
  a4:     { w: 210, h: 297, label: 'A4 (210×297mm)' },
  a5:     { w: 148, h: 210, label: 'A5 (148×210mm)' },
  letter: { w: 216, h: 279, label: 'Letter (8.5×11")' },
  legal:  { w: 216, h: 356, label: 'Legal (8.5×14")' },
  thermal:{ w: 72,  h: 200, label: 'Thermal (80mm)' }
};

let rbState = {
  theme: '#f59e0b',
  alignment: 'center',
  tableStyle: 'striped',
  paperSize: 'a4',
  fontFamily: "'Segoe UI', system-ui, sans-serif",
  fontSize: '12'
};

function rbGetDefaults() {
  return {
    companyName: 'Awesome Myanmar CCTV',
    tagline: 'Field Service Management',
    phone: '+95 9 XXX XXX XXX',
    email: 'info@awesomemyanmar.com',
    address: 'Yangon, Myanmar',
    website: 'www.awesomemyanmar.com',
    logo: '',
    themeColor: '#f59e0b',
    alignment: 'center',
    tableStyle: 'striped',
    paperSize: 'a4',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    fontSize: '12',
    showLogo: true,
    showTagline: true,
    showContact: true,
    showWebsite: true,
    showMeta: true,
    showItems: true,
    showTotals: true,
    showNotes: true,
    showTerms: true,
    showWarranty: true,
    showSignature: true,
    showFooter: true,
    footerThanks: 'Thank you for your business!',
    footerTerms: 'Payment due within 30 days. Late payments subject to 1.5% monthly interest.',
    footerWarranty: 'All hardware includes 12-month manufacturer warranty.',
    footerNote: '',
  };
}

function rbLoadSettings() {
  const d = rbGetDefaults();
  const s = { ...d, ...rbSettings };
  const el = (id) => document.getElementById(id);
  el('rb-company-name').value = s.companyName;
  el('rb-company-tagline').value = s.tagline;
  el('rb-company-phone').value = s.phone;
  el('rb-company-email').value = s.email;
  el('rb-company-address').value = s.address;
  el('rb-company-website').value = s.website;
  el('rb-company-logo').value = s.logo;
  el('rb-footer-thanks').value = s.footerThanks;
  el('rb-footer-terms').value = s.footerTerms;
  el('rb-footer-warranty').value = s.footerWarranty;
  el('rb-footer-note').value = s.footerNote;
  el('rb-paper-size').value = s.paperSize;
  el('rb-font-family').value = s.fontFamily;
  el('rb-font-size').value = s.fontSize;
  el('rb-show-logo').checked = s.showLogo;
  el('rb-show-tagline').checked = s.showTagline;
  el('rb-show-contact').checked = s.showContact;
  el('rb-show-website').checked = s.showWebsite;
  el('rb-show-meta').checked = s.showMeta;
  el('rb-show-items').checked = s.showItems;
  el('rb-show-totals').checked = s.showTotals;
  el('rb-show-notes').checked = s.showNotes;
  el('rb-show-terms').checked = s.showTerms;
  el('rb-show-warranty').checked = s.showWarranty;
  el('rb-show-signature').checked = s.showSignature;
  el('rb-show-footer').checked = s.showFooter;
  rbState.theme = s.themeColor;
  rbState.alignment = s.alignment;
  rbState.tableStyle = s.tableStyle;
  rbState.paperSize = s.paperSize;
  rbState.fontFamily = s.fontFamily;
  rbState.fontSize = s.fontSize;
  el('rb-custom-color').value = s.themeColor;
  el('rb-color-hex').textContent = s.themeColor;
  rbSetThemeUI(s.themeColor);
  rbSetAlignmentUI(s.alignment);
  rbSetTableStyleUI(s.tableStyle);
}

function rbSaveSettings() {
  const el = (id) => document.getElementById(id);
  rbSettings = {
    companyName: el('rb-company-name').value,
    tagline: el('rb-company-tagline').value,
    phone: el('rb-company-phone').value,
    email: el('rb-company-email').value,
    address: el('rb-company-address').value,
    website: el('rb-company-website').value,
    logo: el('rb-company-logo').value,
    themeColor: rbState.theme,
    alignment: rbState.alignment,
    tableStyle: rbState.tableStyle,
    paperSize: el('rb-paper-size').value,
    fontFamily: el('rb-font-family').value,
    fontSize: el('rb-font-size').value,
    showLogo: el('rb-show-logo').checked,
    showTagline: el('rb-show-tagline').checked,
    showContact: el('rb-show-contact').checked,
    showWebsite: el('rb-show-website').checked,
    showMeta: el('rb-show-meta').checked,
    showItems: el('rb-show-items').checked,
    showTotals: el('rb-show-totals').checked,
    showNotes: el('rb-show-notes').checked,
    showTerms: el('rb-show-terms').checked,
    showWarranty: el('rb-show-warranty').checked,
    showSignature: el('rb-show-signature').checked,
    showFooter: el('rb-show-footer').checked,
    footerThanks: el('rb-footer-thanks').value,
    footerTerms: el('rb-footer-terms').value,
    footerWarranty: el('rb-footer-warranty').value,
    footerNote: el('rb-footer-note').value,
  };
  localStorage.setItem('rb-settings', JSON.stringify(rbSettings));
}

// ─── Theme / Alignment / Table Style UI helpers ──────────────────────────────

function rbSetThemeUI(color) {
  document.getElementById('rb-custom-color').value = color;
  document.getElementById('rb-color-hex').textContent = color;
}

function rbSetAlignmentUI(align) {
  ['left','center','right'].forEach(a => {
    const btn = document.getElementById('rb-align-' + a);
    if (!btn) return;
    const active = a === align;
    btn.className = active
      ? 'flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold py-2 rounded-xl transition'
      : 'flex-1 bg-white/5 border border-white/10 text-slate-400 text-xs font-bold py-2 rounded-xl transition';
  });
}

function rbSetTableStyleUI(style) {
  ['striped','bordered','minimal'].forEach(s => {
    const btn = document.getElementById('rb-table-' + s);
    if (!btn) return;
    const active = s === style;
    btn.className = active
      ? 'flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-bold py-2 rounded-xl transition'
      : 'flex-1 bg-white/5 border border-white/10 text-slate-400 text-xs font-bold py-2 rounded-xl transition';
  });
}

function rbSetTheme(color) {
  rbState.theme = color;
  rbSetThemeUI(color);
  rbSaveSettings();
  rbPreview();
}

function rbSetAlignment(align) {
  rbState.alignment = align;
  rbSetAlignmentUI(align);
  rbSaveSettings();
  rbPreview();
}

function rbSetTableStyle(style) {
  rbState.tableStyle = style;
  rbSetTableStyleUI(style);
  rbSaveSettings();
  rbPreview();
}

function rbUploadLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('rb-company-logo').value = e.target.result;
    rbSaveSettings();
    rbPreview();
  };
  reader.readAsDataURL(file);
}

function rbExportPDF() {
  const container = document.getElementById('rb-preview-container');
  if (!container.innerHTML) { rbPreview(); }
  const printWindow = window.open('', '_blank');
  printWindow.document.write('<!DOCTYPE html><html><head><title>Receipt</title></head><body>' + container.innerHTML + '</body></html>');
  printWindow.document.close();
  setTimeout(() => { printWindow.print(); }, 500);
}

// ─── Template loader ─────────────────────────────────────────────────────────

function rbLoadTemplate(type) {
  const templates = {
    quotation: { thanks: 'Thank you for your business!', terms: 'Payment due within 30 days.', warranty: 'All hardware includes 12-month manufacturer warranty.', note: '' },
    invoice:   { thanks: 'Thank you for your purchase!', terms: 'Payment due upon receipt. Late payments subject to 2% monthly interest.', warranty: 'Hardware warranty as per manufacturer policy.', note: '' },
    receipt:   { thanks: 'Thank you for choosing our service!', terms: 'Payment received. This is your official receipt.', warranty: 'Service warranty: 90 days from completion date.', note: '' }
  };
  const t = templates[type] || templates.quotation;
  document.getElementById('rb-footer-thanks').value = t.thanks;
  document.getElementById('rb-footer-terms').value = t.terms;
  document.getElementById('rb-footer-warranty').value = t.warranty;
  document.getElementById('rb-footer-note').value = t.note;
  rbSaveSettings();
  rbPreview();
}

// ─── Live Preview ────────────────────────────────────────────────────────────

function rbPreview() {
  const el = (id) => document.getElementById(id);
  const paper = RB_PAPER_SIZES[el('rb-paper-size')?.value] || RB_PAPER_SIZES.a4;
  const font = el('rb-font-family')?.value || "'Segoe UI',system-ui,sans-serif";
  const fontSize = parseInt(el('rb-font-size')?.value || '12', 10);
  rbState.paperSize = el('rb-paper-size')?.value || 'a4';
  rbState.fontFamily = font;
  rbState.fontSize = String(fontSize);

  const label = el('rb-paper-label');
  if (label) label.textContent = paper.label;

  const show = (id) => el(id)?.checked !== false;

  const companyName = el('rb-company-name')?.value || 'Company Name';
  const tagline = el('rb-company-tagline')?.value || '';
  const phone = el('rb-company-phone')?.value || '';
  const email = el('rb-company-email')?.value || '';
  const address = el('rb-company-address')?.value || '';
  const website = el('rb-company-website')?.value || '';
  const logoUrl = el('rb-company-logo')?.value || '';
  const thanks = el('rb-footer-thanks')?.value || '';
  const terms = el('rb-footer-terms')?.value || '';
  const warranty = el('rb-footer-warranty')?.value || '';
  const note = el('rb-footer-note')?.value || '';
  const docType = el('rb-doc-type')?.value || 'quotation';
  const theme = rbState.theme;
  const align = rbState.alignment;
  const tableStyle = rbState.tableStyle;

  const contactParts = [phone, email, address].filter(Boolean).join(' · ');
  const docTitle = docType === 'quotation' ? 'Quotation' : docType === 'invoice' ? 'Invoice' : 'Job Receipt';

  // Sample items (used for preview)
  const sampleItems = [
    { desc: 'CCTV Camera (4MP dome)', qty: 4, price: 120000 },
    { desc: 'NVR 8-channel', qty: 1, price: 350000 },
    { desc: 'Installation & cabling', qty: 1, price: 150000 },
    { desc: 'CAT6 cable (50m)', qty: 2, price: 25000 }
  ];
  const subtotal = sampleItems.reduce((s, i) => s + i.qty * i.price, 0);
  const tax = Math.round(subtotal * 0.05);
  const total = subtotal + tax;

  // Build table rows based on style
  let tableRows = '';
  const rowBg = (i) => tableStyle === 'striped' ? (i % 2 === 0 ? '#f9fafb' : '#fff') : '#fff';
  const cellBorder = tableStyle === 'minimal' ? 'border-bottom:1px solid #f3f4f6' : 'border-bottom:1px solid #e5e7eb';
  const cellBorderB = tableStyle === 'bordered' ? 'border:1px solid #d1d5db' : cellBorder;

  sampleItems.forEach((it, i) => {
    tableRows += `<tr style="background:${rowBg(i)}">
      <td style="padding:10px 12px;${cellBorderB};font-size:${fontSize}px">${escapeHTML(it.desc)}</td>
      <td style="padding:10px 12px;${cellBorderB};text-align:center;font-size:${fontSize}px">${it.qty}</td>
      <td style="padding:10px 12px;${cellBorderB};text-align:right;font-size:${fontSize}px;color:#6b7280">MMK ${it.price.toLocaleString()}</td>
      <td style="padding:10px 12px;${cellBorderB};text-align:right;font-size:${fontSize}px;font-weight:600">MMK ${(it.qty * it.price).toLocaleString()}</td>
    </tr>`;
  });

  // Table header style
  let thExtra = '';
  if (tableStyle === 'bordered') {
    thExtra = 'border:1px solid rgba(255,255,255,0.3)';
  } else if (tableStyle === 'minimal') {
    thExtra = 'border-bottom:2px solid #e5e7eb;background:transparent;color:#6b7280';
  } else {
    thExtra = 'border-bottom:2px solid ' + theme;
  }

  const isThermal = rbState.paperSize === 'thermal';
  const pageW = isThermal ? '72mm' : paper.w + 'mm';
  const pagePad = isThermal ? '6mm 4mm' : '15mm';
  const maxW = isThermal ? '100%' : '650px';
  const bodyStyle = isThermal ? `font-size:${Math.min(fontSize, 11)}px;` : '';

  // Logo
  const logoHtml = show('rb-show-logo') && logoUrl
    ? `<img src="${escapeHTML(logoUrl)}" style="max-height:60px;max-width:180px;object-fit:contain;margin-bottom:12px;" alt="Logo" />`
    : '';

  // ── Assemble HTML ──────────────────────────────────────────────────────
  const html = `
<div style="font-family:${font};font-size:${fontSize}px;color:#1f2937;background:#fff;page-break-after:always;width:${pageW};min-height:${paper.h}mm;padding:${pagePad};max-width:${maxW};margin:0 auto;box-sizing:border-box;${bodyStyle}">

  <!-- Header -->
  <div style="text-align:${align};margin-bottom:20px;border-bottom:3px solid ${theme};padding-bottom:16px;">
    ${logoHtml}
    <h1 style="font-size:22px;font-weight:800;margin:0;color:${theme};">${escapeHTML(companyName)}</h1>
    ${show('rb-show-tagline') && tagline ? `<p style="font-size:11px;color:#6b7280;margin:4px 0 0;letter-spacing:0.05em;text-transform:uppercase;">${escapeHTML(tagline)}</p>` : ''}
    ${show('rb-show-contact') && contactParts ? `<p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#6b7280;margin:8px 0 0;">${escapeHTML(contactParts)}</p>` : ''}
    ${show('rb-show-website') && website ? `<p style="font-size:${Math.max(fontSize - 1, 10)}px;color:${theme};margin:4px 0 0;font-weight:500;">${escapeHTML(website)}</p>` : ''}
  </div>

  <!-- Document Title -->
  <div style="text-align:center;margin-bottom:16px;">
    <h2 style="font-size:18px;font-weight:700;margin:0;color:#111827;text-transform:uppercase;letter-spacing:0.08em;">${docTitle}</h2>
    <p style="font-size:11px;color:#6b7280;margin:4px 0 0;">Ref: QT-2026-001 · Date: ${new Date().toLocaleDateString('en-GB')}</p>
  </div>

  ${show('rb-show-meta') ? `
  <!-- Bill To / Ship To -->
  <div style="display:flex;gap:20px;margin-bottom:20px;">
    <div style="flex:1;">
      <p style="font-size:10px;font-weight:700;color:${theme};text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Bill To</p>
      <p style="font-size:${fontSize}px;font-weight:600;margin:0;">Customer Name</p>
      <p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#6b7280;margin:2px 0 0;">123 Street, Yangon</p>
      <p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#6b7280;margin:2px 0 0;">+95 9 123 456 789</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:10px;font-weight:700;color:${theme};text-transform:uppercase;letter-spacing:0.05em;margin:0 0 6px;">Ship To</p>
      <p style="font-size:${fontSize}px;font-weight:600;margin:0;">Site Address</p>
      <p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#6b7280;margin:2px 0 0;">Same as billing</p>
    </div>
  </div>
  ` : ''}

  ${show('rb-show-items') ? `
  <!-- Line Items Table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
    <thead>
      <tr style="background:${tableStyle === 'minimal' ? 'transparent' : theme};color:${tableStyle === 'minimal' ? '#6b7280' : '#fff'};">
        <th style="padding:10px 12px;${thExtra};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-align:left;">Description</th>
        <th style="padding:10px 12px;${thExtra};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-align:center;">Qty</th>
        <th style="padding:10px 12px;${thExtra};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Unit Price</th>
        <th style="padding:10px 12px;${thExtra};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>
  ` : ''}

  ${show('rb-show-totals') ? `
  <!-- Totals -->
  <div style="text-align:right;margin-bottom:20px;">
    <table style="margin-left:auto;border-collapse:collapse;">
      <tr>
        <td style="padding:4px 16px;font-size:${fontSize}px;color:#6b7280;">Subtotal</td>
        <td style="padding:4px 0;font-size:${fontSize}px;text-align:right;font-weight:600;">MMK ${subtotal.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:4px 16px;font-size:${fontSize}px;color:#6b7280;">Tax (5%)</td>
        <td style="padding:4px 0;font-size:${fontSize}px;text-align:right;font-weight:600;">MMK ${tax.toLocaleString()}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 4px;font-size:${fontSize + 2}px;font-weight:800;color:${theme};border-top:2px solid ${theme};">Total</td>
        <td style="padding:8px 0 4px;font-size:${fontSize + 2}px;text-align:right;font-weight:800;color:${theme};border-top:2px solid ${theme};">MMK ${total.toLocaleString()}</td>
      </tr>
    </table>
  </div>
  ` : ''}

  ${show('rb-show-notes') && note ? `
  <!-- Note -->
  <div style="background:#f0fdf4;border-left:3px solid ${theme};padding:10px 14px;margin-bottom:16px;font-size:${Math.max(fontSize - 1, 10)}px;color:#374151;">
    <strong style="color:${theme};">Note:</strong> ${escapeHTML(note)}
  </div>
  ` : ''}

  ${show('rb-show-terms') && terms ? `
  <!-- Payment Terms -->
  <div style="margin-bottom:12px;">
    <p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Payment Terms</p>
    <p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#374151;margin:0;white-space:pre-line;">${escapeHTML(terms)}</p>
  </div>
  ` : ''}

  ${show('rb-show-warranty') && warranty ? `
  <!-- Warranty -->
  <div style="margin-bottom:16px;">
    <p style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 4px;">Warranty</p>
    <p style="font-size:${Math.max(fontSize - 1, 10)}px;color:#374151;margin:0;">${escapeHTML(warranty)}</p>
  </div>
  ` : ''}

  ${show('rb-show-signature') ? `
  <!-- Signatures -->
  <div style="display:flex;justify-content:space-between;margin-top:30px;padding-top:16px;border-top:1px dashed #d1d5db;">
    <div style="text-align:center;">
      <div style="width:160px;border-bottom:1px solid #9ca3af;margin-bottom:6px;">&nbsp;</div>
      <p style="font-size:10px;color:#6b7280;margin:0;">Authorized Signature</p>
    </div>
    <div style="text-align:center;">
      <div style="width:160px;border-bottom:1px solid #9ca3af;margin-bottom:6px;">&nbsp;</div>
      <p style="font-size:10px;color:#6b7280;margin:0;">Customer Signature</p>
    </div>
  </div>
  ` : ''}

  ${show('rb-show-footer') && thanks ? `
  <!-- Footer -->
  <div style="text-align:center;margin-top:20px;padding-top:12px;border-top:2px solid ${theme};">
    <p style="font-size:12px;font-weight:600;color:${theme};margin:0;">${escapeHTML(thanks)}</p>
    <p style="font-size:10px;color:#9ca3af;margin:6px 0 0;">${escapeHTML(companyName)}${website ? ' · ' + escapeHTML(website) : ''}</p>
  </div>
  ` : ''}

</div>`;

  document.getElementById('rb-preview-container').innerHTML = html;
  rbSaveSettings();
}

// ─── Print ───────────────────────────────────────────────────────────────────

function rbPrint() {
  const container = document.getElementById('rb-preview-container');
  if (!container.innerHTML) { rbPreview(); }
  const printWindow = window.open('', '_blank');
  printWindow.document.write('<!DOCTYPE html><html><head><title>Receipt</title><style>@media print{body{margin:0;}}</style></head><body>' + container.innerHTML + '</body></html>');
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}

// ─── Load from existing docs ─────────────────────────────────────────────────

async function rbLoadDocumentData() {
  try {
    const quotationId = document.getElementById('rb-load-quotation')?.value;
    const jobId = document.getElementById('rb-load-job')?.value;
    if (quotationId) {
      const baseUrl = document.getElementById('api-base')?.value || '';
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${baseUrl}/api/quotations/${quotationId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      const q = json.data || json;
      if (q) {
        rbCurrentData = q;
        rbPreview();
      }
    }
  } catch (e) {
    console.error('Failed to load document data:', e);
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

function rbInitReceiptBuilder() {
  const token = localStorage.getItem('admin_token');
  if (!token) return;
  rbLoadSettings();
  rbLoadQuotationsList();
  rbLoadJobsList();
  rbPreview();
}

async function rbLoadQuotationsList() {
  try {
    const baseUrl = document.getElementById('api-base')?.value || '';
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${baseUrl}/api/quotations`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    const data = json.data || json;
    const quotations = data.quotations || data;
    const select = document.getElementById('rb-load-quotation');
    if (!select) return;
    select.innerHTML = '<option value="">Select Quotation...</option>';
    if (Array.isArray(quotations)) {
      quotations.forEach(q => {
        const opt = document.createElement('option');
        opt.value = q.id;
        opt.textContent = `${q.id} - ${q.client_name || 'Client'} (${q.status})`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load quotations:', e);
  }
}

async function rbLoadJobsList() {
  try {
    const baseUrl = document.getElementById('api-base')?.value || '';
    const token = localStorage.getItem('admin_token');
    const res = await fetch(`${baseUrl}/api/jobs`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed to fetch');
    const json = await res.json();
    const data = json.data || json;
    const jobs = data.jobs || data;
    const select = document.getElementById('rb-load-job');
    if (!select) return;
    select.innerHTML = '<option value="">Select Job...</option>';
    if (Array.isArray(jobs)) {
      jobs.forEach(j => {
        const opt = document.createElement('option');
        opt.value = j.id;
        opt.textContent = `${j.id} - ${j.client_name || 'Client'} (${j.status})`;
        select.appendChild(opt);
      });
    }
  } catch (e) {
    console.error('Failed to load jobs:', e);
  }
}
