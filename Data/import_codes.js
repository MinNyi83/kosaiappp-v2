/**
 * Import Script: Stock code format V2.2.xlsx → D1 Database
 * Reads Category, Sub Category, and Brand worksheets.
 * Imports/updates name AND code columns.
 */

const XLSX = require('xlsx');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:8787';
const ADMIN_SECRET = 'SuperSecureAdminPass123!';

function apiFetch(path, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        const data = body ? JSON.stringify(body) : null;
        const url = new URL(BASE_URL + path);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Secret': ADMIN_SECRET,
                'Authorization': `Bearer ${ADMIN_SECRET}`,
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
            }
        };
        const req = http.request(options, (res) => {
            let resData = '';
            res.on('data', chunk => resData += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(resData) }); }
                catch { resolve({ status: res.statusCode, body: resData }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const wb = XLSX.readFile('Data/Stock code fomat V2.2.xlsx');

const excelCategories = XLSX.utils.sheet_to_json(wb.Sheets['Category']).map(r => ({
    code: String(r.Category_ID).trim().padStart(2, '0'),
    name: String(r.Category_Description).trim()
})).filter(r => r.code && r.name);

const excelSubCategories = XLSX.utils.sheet_to_json(wb.Sheets['Sub Category']).map(r => ({
    code: String(r.Sub_Category_ID).trim().padStart(3, '0'),
    name: String(r.Sub_Category_Description).trim()
})).filter(r => r.code && r.name);

const excelBrands = XLSX.utils.sheet_to_json(wb.Sheets['Brand']).map(r => ({
    code: String(r.Brand_ID).trim().padStart(2, '0'),
    name: String(r.Brand_Description).trim()
})).filter(r => r.code && r.name);

async function main() {
    console.log('\n======================================================');
    console.log('  Importing Code fields from Excel to D1 Database');
    console.log('======================================================\n');

    // ── 1. Fetch D1 categories, sub-categories, brands ───────────────────────
    const [catRes, subRes, brandRes] = await Promise.all([
        apiFetch('/api/admin/inventory/categories'),
        apiFetch('/api/admin/inventory/sub-categories'),
        apiFetch('/api/admin/inventory/brands'),
    ]);

    const d1Cats = catRes.status === 200 ? catRes.body : [];
    const d1Subs = subRes.status === 200 ? subRes.body : [];
    const d1Brands = brandRes.status === 200 ? brandRes.body : [];

    console.log(`D1 state: ${d1Cats.length} cats, ${d1Subs.length} sub-cats, ${d1Brands.length} brands`);

    // We will clean and insert/overwrite all categories, brands, sub-categories with codes.
    // ── 2. Import categories with code ───────────────────────────────────────
    console.log('\n📁 Importing Categories...');
    for (const c of excelCategories) {
        // Post to /add
        const res = await apiFetch('/api/admin/inventory/categories/add', 'POST', { name: c.name, code: c.code });
        process.stdout.write('.');
        await sleep(15);
    }
    console.log(' Done.');

    // ── 3. Import brands with code ───────────────────────────────────────────
    console.log('\n🏷️  Importing Brands...');
    for (const b of excelBrands) {
        const res = await apiFetch('/api/admin/inventory/brands/add', 'POST', { name: b.name, code: b.code });
        process.stdout.write('.');
        await sleep(15);
    }
    console.log(' Done.');

    // ── 4. Re-fetch Categories to match sub-category parents ─────────────────
    await sleep(200);
    const catRes2 = await apiFetch('/api/admin/inventory/categories');
    const updatedD1Cats = catRes2.body || [];
    const catNameToId = {};
    updatedD1Cats.forEach(c => { catNameToId[c.name.trim().toLowerCase()] = c.id; });

    // Build subcategory parent mapping from SQLite 'stock' table counts
    const Database = require('better-sqlite3');
    const sqliteDb = new Database('Data/stock_codes.sqlite', { readonly: true });
    
    const subCatFreq = {};
    const stocks = sqliteDb.prepare('SELECT category_id, sub_category_id FROM stock WHERE sub_category_id IS NOT NULL AND category_id IS NOT NULL').all();
    for (const s of stocks) {
        const sub = String(s.sub_category_id).trim().padStart(3, '0');
        const cat = String(s.category_id).trim().padStart(2, '0');
        if (!subCatFreq[sub]) subCatFreq[sub] = {};
        subCatFreq[sub][cat] = (subCatFreq[sub][cat] || 0) + 1;
    }
    
    const categoriesList = sqliteDb.prepare('SELECT * FROM categories').all();
    const subcategoriesList = sqliteDb.prepare('SELECT * FROM subcategories').all();
    const sqliteCatById = {};
    categoriesList.forEach(c => { sqliteCatById[c.category_id.padStart(2, '0')] = c.category_description.trim(); });
    const sqliteSubById = {};
    subcategoriesList.forEach(s => { sqliteSubById[s.sub_category_id.padStart(3, '0')] = s.sub_category_description.trim(); });

    const subNameToParentCatName = {};
    for (const [subId, catCounts] of Object.entries(subCatFreq)) {
        const bestCatId = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];
        const subName = sqliteSubById[subId];
        const catName = sqliteCatById[bestCatId];
        if (subName && catName) {
            subNameToParentCatName[subName.trim().toLowerCase()] = catName.trim();
        }
    }
    sqliteDb.close();

    // ── 5. Import sub-categories with code and parent category_id ────────────
    console.log('\n📂 Importing Sub-Categories...');
    for (const s of excelSubCategories) {
        const parentCatName = subNameToParentCatName[s.name.trim().toLowerCase()];
        const parentId = parentCatName ? catNameToId[parentCatName.trim().toLowerCase()] : null;
        
        // Check if subcategory already exists in D1
        const existingSub = d1Subs.find(ds => ds.name.trim().toLowerCase() === s.name.trim().toLowerCase());
        if (existingSub) {
            // Update it with code & parentId
            await apiFetch('/api/admin/inventory/sub-categories/update', 'POST', {
                id: existingSub.id,
                name: s.name,
                category_id: parentId,
                code: s.code
            });
        } else {
            // Add new
            await apiFetch('/api/admin/inventory/sub-categories/add', 'POST', {
                name: s.name,
                category_id: parentId,
                code: s.code
            });
        }
        process.stdout.write('.');
        await sleep(15);
    }
    console.log(' Done.');

    console.log('\n✨ Database import of code fields completed successfully!');
}

main().catch(console.error);
