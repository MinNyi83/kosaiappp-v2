const Database = require('better-sqlite3');
const db = new Database('Data/stock_codes.sqlite', { readonly: true });

// List all tables
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name));

// Inspect each table
for (const t of tables) {
    const info = db.prepare(`PRAGMA table_info(${t.name})`).all();
    console.log(`\n--- ${t.name} columns:`, info.map(c => c.name));
    const rows = db.prepare(`SELECT * FROM ${t.name} LIMIT 5`).all();
    rows.forEach(r => console.log('  ', JSON.stringify(r)));
    const count = db.prepare(`SELECT COUNT(*) as n FROM ${t.name}`).get();
    console.log(`  Total: ${count.n}`);
}
