const Database = require('better-sqlite3');

const db = new Database(
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/1f6511a010eea77a87edada2cd2f8bd03d36571a83f5e8a8359f1d7e94856a92.sqlite'
);

try {
  db.prepare('ALTER TABLE inv_categories ADD COLUMN code TEXT').run();
  console.log('Added code column to inv_categories');
} catch (e) {
  console.log('inv_categories: ', e.message);
}

try {
  db.prepare('ALTER TABLE inv_sub_categories ADD COLUMN code TEXT').run();
  console.log('Added code column to inv_sub_categories');
} catch (e) {
  console.log('inv_sub_categories: ', e.message);
}

try {
  db.prepare('ALTER TABLE inv_brands ADD COLUMN code TEXT').run();
  console.log('Added code column to inv_brands');
} catch (e) {
  console.log('inv_brands: ', e.message);
}

console.log('Schemas now:');
const tables = ['inv_categories', 'inv_sub_categories', 'inv_brands'];
for (const t of tables) {
  const info = db.prepare(`PRAGMA table_info(${t})`).all();
  console.log(
    `- Table ${t} columns:`,
    info.map((c) => c.name)
  );
}

db.close();
