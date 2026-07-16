const Database = require('better-sqlite3');
const fs = require('fs');

const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const files = fs.readdirSync(dir);
console.log('Files in dir:', files);

for (const f of files) {
  if (f.endsWith('.sqlite')) {
    const path = `${dir}/${f}`;
    const db = new Database(path, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log(`\nPath: ${path}`);
    console.log(
      'Tables:',
      tables.map((t) => t.name)
    );
    db.close();
  }
}
