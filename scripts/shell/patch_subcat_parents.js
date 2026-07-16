/**
 * Patch Script: Set parent category_id for all sub-categories in the D1 DB.
 * Uses SQLite stock data to determine the authoritative sub_cat → category mapping.
 * Calls the local API to update each sub-category record.
 */

const Database = require('better-sqlite3');
const http = require('http');

const ADMIN_SECRET = 'SuperSecureAdminPass123!';
const BASE = 'http://127.0.0.1:8787';

function apiFetch(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: '127.0.0.1',
      port: 8787,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ADMIN_SECRET}`,
        'X-Admin-Secret': ADMIN_SECRET,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = http.request(opts, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => {
        try {
          resolve({ s: r.statusCode, b: JSON.parse(d) });
        } catch {
          resolve({ s: r.statusCode, b: d });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║    Sub-Category Parent Fix — SQLite → D1 Database Patch     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ── 1. Build authoritative mapping from SQLite ───────────────────────────
  const db = new Database('Data/stock_codes.sqlite', { readonly: true });
  const categories = db.prepare('SELECT * FROM categories').all();
  const subcategories = db.prepare('SELECT * FROM subcategories').all();

  // category_id (padded) → description
  const catById = {};
  categories.forEach((c) => {
    catById[c.category_id.padStart(2, '0')] = c.category_description.trim();
  });

  // sub_category_id (padded) → description
  const subById = {};
  subcategories.forEach((s) => {
    subById[s.sub_category_id.padStart(3, '0')] = s.sub_category_description.trim();
  });

  // Count category votes per sub-category from stock data
  const subCatFreq = {};
  const stocks = db
    .prepare(
      'SELECT category_id, sub_category_id FROM stock WHERE sub_category_id IS NOT NULL AND category_id IS NOT NULL'
    )
    .all();
  for (const s of stocks) {
    const sub = String(s.sub_category_id).trim().padStart(3, '0');
    const cat = String(s.category_id).trim().padStart(2, '0');
    if (!subCatFreq[sub]) subCatFreq[sub] = {};
    subCatFreq[sub][cat] = (subCatFreq[sub][cat] || 0) + 1;
  }

  // Resolve: sub_name → category_name (most frequent category wins)
  const subNameToParentCatName = {};
  for (const [subId, catCounts] of Object.entries(subCatFreq)) {
    const bestCatId = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];
    const subName = subById[subId];
    const catName = catById[bestCatId];
    if (subName && catName) {
      subNameToParentCatName[subName.trim().toLowerCase()] = catName.trim();
    }
  }
  db.close();
  console.log(
    `✅ Loaded ${Object.keys(subNameToParentCatName).length} sub-cat→category mappings from SQLite\n`
  );

  // ── 2. Fetch current D1 sub-categories and categories ──────────────────
  console.log('🔍 Fetching current data from D1...');
  const [subRes, catRes] = await Promise.all([
    apiFetch('/api/admin/inventory/sub-categories'),
    apiFetch('/api/admin/inventory/categories'),
  ]);
  const d1SubCats = Array.isArray(subRes.b) ? subRes.b : [];
  const d1Cats = Array.isArray(catRes.b) ? catRes.b : [];

  // Map: category name (lower) → id in D1
  const d1CatNameToId = {};
  d1Cats.forEach((c) => {
    d1CatNameToId[c.name.trim().toLowerCase()] = c.id;
  });

  console.log(`   D1 sub-categories: ${d1SubCats.length}`);
  console.log(`   D1 categories:     ${d1Cats.length}\n`);

  // ── 3. Identify which sub-cats need updating ─────────────────────────────
  const toUpdate = [];
  const noMatch = [];
  const alreadySet = [];

  for (const sub of d1SubCats) {
    const subNameLower = sub.name.trim().toLowerCase();
    const parentCatName = subNameToParentCatName[subNameLower];

    if (!parentCatName) {
      noMatch.push(sub.name);
      continue;
    }

    const parentCatId = d1CatNameToId[parentCatName.trim().toLowerCase()];
    if (!parentCatId) {
      noMatch.push(`${sub.name} (cat "${parentCatName}" not in D1)`);
      continue;
    }

    // Check if already correctly set
    if (sub.category_id && sub.category_id === parentCatId) {
      alreadySet.push(sub.name);
      continue;
    }

    toUpdate.push({
      id: sub.id,
      name: sub.name,
      category_id: parentCatId,
      category_name: parentCatName,
    });
  }

  console.log(`📊 Analysis:`);
  console.log(`   Already correct : ${alreadySet.length}`);
  console.log(`   Need updating   : ${toUpdate.length}`);
  console.log(`   No match found  : ${noMatch.length}`);
  if (noMatch.length > 0) {
    console.log(
      `   Unmatched: ${noMatch.slice(0, 10).join(', ')}${noMatch.length > 10 ? '...' : ''}`
    );
  }
  console.log('');

  if (toUpdate.length === 0) {
    console.log('✨ All sub-categories already have correct parent categories!\n');
    return;
  }

  // ── 4. Patch each sub-category via API ───────────────────────────────────
  console.log(`🔧 Patching ${toUpdate.length} sub-categories...\n`);
  let ok = 0,
    fail = 0;
  const failedItems = [];

  for (const sub of toUpdate) {
    const r = await apiFetch('/api/admin/inventory/sub-categories/update', 'POST', {
      id: sub.id,
      name: sub.name,
      category_id: sub.category_id,
    });

    if (r.s === 200 || r.s === 201) {
      ok++;
      process.stdout.write('.');
      if (ok % 50 === 0) process.stdout.write(` ${ok}/${toUpdate.length}\n`);
    } else {
      fail++;
      failedItems.push({ name: sub.name, error: JSON.stringify(r.b).slice(0, 80) });
    }
    await sleep(15);
  }

  console.log(`\n\n   ✅ ${ok} updated successfully`);
  if (fail > 0) {
    console.log(`   ❌ ${fail} failed:`);
    failedItems.forEach((f) => console.log(`      ${f.name}: ${f.error}`));
  }

  // ── 5. Summary ───────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                         SUMMARY                              ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log(`║  Sub-cats updated  : ${String(ok).padEnd(38)}║`);
  console.log(`║  Already correct   : ${String(alreadySet.length).padEnd(38)}║`);
  console.log(`║  No SQLite match   : ${String(noMatch.length).padEnd(38)}║`);
  console.log(`║  Failed updates    : ${String(fail).padEnd(38)}║`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('✨ Refresh the admin panel → Inventory → Sub-Categories to verify.\n');
}

main().catch(console.error);
