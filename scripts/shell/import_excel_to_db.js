/**
 * Import Script: Stock code format V2.2.xlsx → Local D1 via API
 * Reads all sheets, checks existing data, imports missing records.
 */

const XLSX = require('xlsx');
const https = require('http');

const BASE_URL = 'http://127.0.0.1:8787';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'kosai-admin-2024';

// ── Utility: JSON fetch ─────────────────────────────────────────────────────
function apiFetch(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Secret': ADMIN_SECRET,
        Authorization: `Bearer ${ADMIN_SECRET}`,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Load Excel ──────────────────────────────────────────────────────────────
const wb = XLSX.readFile('Data/Stock code fomat V2.2.xlsx');

const excelCategories = XLSX.utils
  .sheet_to_json(wb.Sheets['Category'])
  .map((r) => ({
    id: String(r.Category_ID).trim(),
    name: String(r.Category_Description).trim(),
  }))
  .filter((r) => r.id && r.name);

const excelSubCategories = XLSX.utils
  .sheet_to_json(wb.Sheets['Sub Category'])
  .map((r) => ({
    id: String(r.Sub_Category_ID).trim(),
    name: String(r.Sub_Category_Description).trim(),
  }))
  .filter((r) => r.id && r.name);

const excelBrands = XLSX.utils
  .sheet_to_json(wb.Sheets['Brand'])
  .map((r) => ({
    id: String(r.Brand_ID).trim(),
    name: String(r.Brand_Description).trim(),
  }))
  .filter((r) => r.id && r.name);

// Stock items - from 'Stock' sheet which has human-readable names
const stockRows = XLSX.utils.sheet_to_json(wb.Sheets['Stock'], { header: 1 });
let headerIdx = stockRows.findIndex((r) => r[0] === 'Stock_ID');
const stockHeaders = stockRows[headerIdx];
const excelStockItems = stockRows
  .slice(headerIdx + 1)
  .filter((r) => r[0] && typeof r[0] === 'string' && r[0].trim() !== '' && r[0] !== 'Stock_ID')
  .map((r) => {
    const obj = {};
    stockHeaders.forEach((h, i) => {
      if (h) obj[h] = r[i];
    });
    return obj;
  })
  .filter((r) => r.Stock_ID && r.Stock_Description);

// Unit mapping from Excel abbreviations to full names
const unitMap = {
  PC: { name: 'Piece', abbreviation: 'PC' },
  M: { name: 'Meter', abbreviation: 'M' },
  BOX: { name: 'Box', abbreviation: 'BOX' },
  PKG: { name: 'Package', abbreviation: 'PKG' },
  BOT: { name: 'Bottle', abbreviation: 'BOT' },
  Pair: { name: 'Pair', abbreviation: 'Pair' },
  pcs: { name: 'Pieces', abbreviation: 'pcs' },
  meter: { name: 'Meter', abbreviation: 'meter' },
  pack: { name: 'Pack', abbreviation: 'pack' },
  box: { name: 'Box (small)', abbreviation: 'box' },
  roll: { name: 'Roll', abbreviation: 'roll' },
  set: { name: 'Set', abbreviation: 'set' },
  unit: { name: 'Unit', abbreviation: 'unit' },
};

const uniqueUMs = [...new Set(excelStockItems.map((r) => r.Stocking_UM).filter(Boolean))];

// ── Main Import ─────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  Stock Code Import V2.2 → AwesomeMyanmar Inventory  ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log(
    `📊 Excel Data: ${excelCategories.length} categories, ${excelSubCategories.length} sub-cats, ${excelBrands.length} brands, ${excelStockItems.length} stock items\n`
  );

  // ── 1. Fetch existing master data ────────────────────────────────────────
  console.log('🔍 Fetching existing data from DB...');
  const [catRes, subRes, brandRes, unitRes, stockRes] = await Promise.all([
    apiFetch('/api/admin/inventory/categories'),
    apiFetch('/api/admin/inventory/sub-categories'),
    apiFetch('/api/admin/inventory/brands'),
    apiFetch('/api/admin/inventory/units'),
    apiFetch('/api/admin/inventory/list'),
  ]);

  const existingCats = catRes.status === 200 ? catRes.body || [] : [];
  const existingSubs = subRes.status === 200 ? subRes.body || [] : [];
  const existingBrands = brandRes.status === 200 ? brandRes.body || [] : [];
  const existingUnits = unitRes.status === 200 ? unitRes.body || [] : [];
  const existingStock = stockRes.status === 200 ? stockRes.body || [] : [];

  const existingCatNames = new Set(existingCats.map((c) => c.name.trim().toLowerCase()));
  const existingSubNames = new Set(existingSubs.map((s) => s.name.trim().toLowerCase()));
  const existingBrandNames = new Set(existingBrands.map((b) => b.name.trim().toLowerCase()));
  const existingUnitAbbrevs = new Set(
    existingUnits.map((u) => u.abbreviation.trim().toLowerCase())
  );
  const existingStockCodes = new Set(existingStock.map((s) => s.item_code.trim().toUpperCase()));

  console.log(
    `   DB has: ${existingCats.length} cats, ${existingSubs.length} sub-cats, ${existingBrands.length} brands, ${existingUnits.length} units, ${existingStock.length} stock items\n`
  );

  // ── 2. Import Categories ─────────────────────────────────────────────────
  const missingCats = excelCategories.filter((c) => !existingCatNames.has(c.name.toLowerCase()));
  console.log(
    `📁 Categories: ${missingCats.length} new to import (${excelCategories.length - missingCats.length} already exist)`
  );
  let catOk = 0,
    catFail = 0;
  for (const cat of missingCats) {
    const r = await apiFetch('/api/admin/inventory/categories/add', 'POST', { name: cat.name });
    if (r.status === 200 || r.status === 201) {
      catOk++;
      process.stdout.write('.');
    } else {
      catFail++;
      console.log(`\n   ❌ Failed: ${cat.name} — ${JSON.stringify(r.body)}`);
    }
    await sleep(30);
  }
  if (missingCats.length > 0) console.log(`\n   ✅ ${catOk} imported, ${catFail} failed`);

  // ── 3. Re-fetch categories to get IDs for sub-category mapping ───────────
  await sleep(200);
  const catRes2 = await apiFetch('/api/admin/inventory/categories');
  const allCats = catRes2.status === 200 ? catRes2.body : existingCats;
  // Map category name → id in DB
  const catNameToId = {};
  allCats.forEach((c) => {
    catNameToId[c.name.trim().toLowerCase()] = c.id;
  });

  // Build a mapping: sub-cat ID from Excel → which category it belongs to (approximate using name)
  // Since the Excel sub-cat sheet has no parent info, we import all as standalone
  const missingSubCats = excelSubCategories.filter(
    (s) => !existingSubNames.has(s.name.toLowerCase())
  );
  console.log(
    `\n📂 Sub-Categories: ${missingSubCats.length} new to import (${excelSubCategories.length - missingSubCats.length} already exist)`
  );
  let subOk = 0,
    subFail = 0;
  for (const sub of missingSubCats) {
    const r = await apiFetch('/api/admin/inventory/sub-categories/add', 'POST', {
      name: sub.name,
      category_id: null,
    });
    if (r.status === 200 || r.status === 201) {
      subOk++;
      process.stdout.write('.');
    } else {
      subFail++;
      console.log(`\n   ❌ Failed: ${sub.name}`);
    }
    await sleep(30);
  }
  if (missingSubCats.length > 0) console.log(`\n   ✅ ${subOk} imported, ${subFail} failed`);

  // ── 4. Import Brands ─────────────────────────────────────────────────────
  const missingBrands = excelBrands.filter((b) => !existingBrandNames.has(b.name.toLowerCase()));
  console.log(
    `\n🏷️  Brands: ${missingBrands.length} new to import (${excelBrands.length - missingBrands.length} already exist)`
  );
  let brandOk = 0,
    brandFail = 0;
  for (const brand of missingBrands) {
    const r = await apiFetch('/api/admin/inventory/brands/add', 'POST', { name: brand.name });
    if (r.status === 200 || r.status === 201) {
      brandOk++;
      process.stdout.write('.');
    } else {
      brandFail++;
      console.log(`\n   ❌ Failed: ${brand.name}`);
    }
    await sleep(30);
  }
  if (missingBrands.length > 0) console.log(`\n   ✅ ${brandOk} imported, ${brandFail} failed`);

  // ── 5. Import Stock Units ─────────────────────────────────────────────────
  const unitsToImport = uniqueUMs.map((um) => unitMap[um] || { name: um, abbreviation: um });
  const missingUnits = unitsToImport.filter(
    (u) => !existingUnitAbbrevs.has(u.abbreviation.toLowerCase())
  );
  console.log(
    `\n📏 Stock Units: ${missingUnits.length} new to import (${unitsToImport.length - missingUnits.length} already exist)`
  );
  let unitOk = 0,
    unitFail = 0;
  for (const unit of missingUnits) {
    const r = await apiFetch('/api/admin/inventory/units/add', 'POST', {
      name: unit.name,
      abbreviation: unit.abbreviation,
    });
    if (r.status === 200 || r.status === 201) {
      unitOk++;
      process.stdout.write('.');
    } else {
      unitFail++;
      console.log(`\n   ❌ Failed: ${unit.abbreviation}`);
    }
    await sleep(30);
  }
  if (missingUnits.length > 0) console.log(`\n   ✅ ${unitOk} imported, ${unitFail} failed`);

  // ── 6. Import Stock Items ─────────────────────────────────────────────────
  const missingStock = excelStockItems.filter((s) => {
    const code = String(s.Stock_ID).trim().toUpperCase();
    return !existingStockCodes.has(code);
  });
  console.log(
    `\n📦 Stock Items: ${missingStock.length} new to import (${excelStockItems.length - missingStock.length} already exist)`
  );
  console.log('   Importing... (this may take a while)\n');

  let stockOk = 0,
    stockFail = 0,
    stockSkip = 0;
  const batchSize = 20;
  const failedItems = [];

  for (let i = 0; i < missingStock.length; i++) {
    const s = missingStock[i];
    const item_code = String(s.Stock_ID).trim().toUpperCase();
    const item_name = String(s.Stock_Description || '').trim();
    const category = String(s.Category_ID || '').trim();
    const sub_category_id =
      String(s.Sub_Category_ID || '')
        .replace(/-/g, '')
        .trim() || null;
    const brand_id = String(s.Brand_ID || '').trim() || null;
    const stocking_um = String(s.Stocking_UM || 'PC').trim();
    const unit_price = parseFloat(s.Selling_Price) || 0;
    const purchase_price = parseFloat(s.Purchase_Price) || 0;

    if (!item_code || !item_name) {
      stockSkip++;
      continue;
    }

    const payload = {
      item_code,
      item_name,
      category,
      sub_category_id: sub_category_id || '',
      brand_id: brand_id || '',
      stocking_um,
      stock_qty: 0,
      unit_price,
      unit_price_mmk: 0,
    };

    const r = await apiFetch('/api/admin/inventory/add', 'POST', payload);
    if (r.status === 200 || r.status === 201) {
      stockOk++;
      if (stockOk % batchSize === 0)
        process.stdout.write(`\r   Progress: ${stockOk}/${missingStock.length} imported...`);
    } else {
      stockFail++;
      failedItems.push({ code: item_code, error: JSON.stringify(r.body).slice(0, 80) });
    }
    await sleep(20);
  }

  console.log(`\n\n   ✅ ${stockOk} imported`);
  if (stockFail > 0) {
    console.log(`   ❌ ${stockFail} failed:`);
    failedItems.slice(0, 10).forEach((f) => console.log(`      ${f.code}: ${f.error}`));
    if (failedItems.length > 10) console.log(`      ... and ${failedItems.length - 10} more`);
  }
  if (stockSkip > 0) console.log(`   ⏭️  ${stockSkip} skipped (missing code/name)`);

  // ── Summary ─────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║                   IMPORT SUMMARY                    ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Categories imported : ${String(catOk).padEnd(27)}║`);
  console.log(`║  Sub-Categories      : ${String(subOk).padEnd(27)}║`);
  console.log(`║  Brands imported     : ${String(brandOk).padEnd(27)}║`);
  console.log(`║  Stock Units         : ${String(unitOk).padEnd(27)}║`);
  console.log(`║  Stock Items         : ${String(stockOk).padEnd(27)}║`);
  console.log(
    `║  Failed/Skipped      : ${String(catFail + subFail + brandFail + unitFail + stockFail + stockSkip).padEnd(27)}║`
  );
  console.log('╚══════════════════════════════════════════════════════╝\n');
  console.log('✨ Done! Refresh the admin panel to see imported data.\n');
}

main().catch(console.error);
