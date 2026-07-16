/**
 * Update stock catalog items in D1 to map to their parent Category, Sub-Category, and Brand names.
 * Uses SQLite 'stock' table to resolve numeric codes to description strings,
 * then updates inventory_stock entries in local D1.
 */

const Database = require('better-sqlite3');

async function main() {
    console.log('\n======================================================');
    console.log('  Mapping Category, Sub-Category, & Brands for Catalog');
    console.log('======================================================\n');

    // 1. Connect to SQLite metadata database
    const sqliteDb = new Database('Data/stock_codes.sqlite', { readonly: true });
    
    // Build category maps: id -> name
    const cats = sqliteDb.prepare('SELECT * FROM categories').all();
    const catMap = {};
    cats.forEach(c => { catMap[c.category_id.padStart(2, '0')] = c.category_description.trim(); });

    // sub_category_id -> name
    const subs = sqliteDb.prepare('SELECT * FROM subcategories').all();
    const subMap = {};
    subs.forEach(s => { subMap[s.sub_category_id.padStart(3, '0')] = s.sub_category_description.trim(); });

    // brand_id -> name
    const brands = sqliteDb.prepare('SELECT * FROM brands').all();
    const brandMap = {};
    brands.forEach(b => { brandMap[b.brand_id.padStart(2, '0')] = b.brand_description.trim(); });

    // Load entire stock codes lookup from SQLite
    const sqliteStocks = sqliteDb.prepare('SELECT stock_id, category_id, sub_category_id, brand_id, stocking_um FROM stock').all();
    const lookup = {};
    sqliteStocks.forEach(s => {
        if (s.stock_id) {
            lookup[s.stock_id.trim().toUpperCase()] = {
                categoryName: s.category_id ? catMap[String(s.category_id).trim().padStart(2, '0')] : null,
                subCategoryName: s.sub_category_id ? subMap[String(s.sub_category_id).trim().padStart(3, '0')] : null,
                brandName: s.brand_id ? brandMap[String(s.brand_id).trim().padStart(2, '0')] : null,
                stockingUm: s.stocking_um ? String(s.stocking_um).trim() : null
            };
        }
    });
    sqliteDb.close();
    console.log(`Loaded ${Object.keys(lookup).length} mappings from SQLite.`);

    // 2. Connect to local D1 SQLite file
    const d1Db = new Database('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite');
    
    // Get all catalog stock entries
    const d1Stocks = d1Db.prepare('SELECT item_code, item_name FROM inventory_stock').all();
    console.log(`D1 has ${d1Stocks.length} inventory catalog items.`);

    let matched = 0, updated = 0;
    
    // Begin transaction for speed
    const updateStmt = d1Db.prepare(`
        UPDATE inventory_stock 
        SET category = COALESCE(?, category), 
            sub_category_id = ?, 
            brand_id = ?,
            stocking_um = COALESCE(?, stocking_um)
        WHERE item_code = ?
    `);

    const updateTx = d1Db.transaction((items) => {
        for (const item of items) {
            const mapped = lookup[item.item_code.trim().toUpperCase()];
            if (mapped) {
                matched++;
                updateStmt.run(
                    mapped.categoryName,
                    mapped.subCategoryName,
                    mapped.brandName,
                    mapped.stockingUm,
                    item.item_code
                );
                updated++;
            }
        }
    });

    updateTx(d1Stocks);

    console.log(`Matched: ${matched}`);
    console.log(`Updated: ${updated}`);

    d1Db.close();
    console.log('\n✨ Catalog mapping complete! Refresh the Device Catalog.');
}

main().catch(console.error);
