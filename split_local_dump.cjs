const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'local_dump.sql');
const output = path.join(__dirname, 'local_dump_split.sql');

const sql = fs.readFileSync(file, 'utf8');
const lines = sql.split('\n');
const result = [];

for (let line of lines) {
  // Skip CREATE TABLE and metadata/pragma lines since we ran schema migrations on remote
  if (
    line.startsWith('CREATE TABLE') || 
    line.startsWith('PRAGMA') || 
    line.startsWith('BEGIN TRANSACTION') || 
    line.startsWith('COMMIT') ||
    line.startsWith('INSERT INTO sqlite_sequence') ||
    line.startsWith('CREATE INDEX') ||
    line.startsWith('CREATE TRIGGER')
  ) {
    continue;
  }

  const match = line.match(/^(INSERT INTO\s+["\w_]+\s*\([^)]+\))\s*VALUES\s*/i);
  if (match) {
    const insertPrefix = match[1] + ' VALUES ';
    let suffix = line.substring(match[0].length).trim();
    if (suffix.endsWith(';')) {
      suffix = suffix.substring(0, suffix.length - 1);
    }
    
    const rows = [];
    let current = '';
    let inString = false;
    let quoteChar = '';
    let parenCount = 0;
    
    for (let c = 0; c < suffix.length; c++) {
      const char = suffix[c];
      current += char;
      
      if ((char === "'" || char === '"') && (c === 0 || suffix[c-1] !== '\\')) {
        if (!inString) {
          inString = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inString = false;
        }
      }
      
      if (!inString) {
        if (char === '(') {
          parenCount++;
        } else if (char === ')') {
          parenCount--;
          if (parenCount === 0) {
            rows.push(current.trim());
            current = '';
            if (suffix[c+1] === ',') {
              c++;
            }
          }
        }
      }
    }
    if (current.trim()) {
      rows.push(current.trim());
    }

    for (let row of rows) {
      let cleanedRow = row.trim();
      if (cleanedRow.startsWith(',')) cleanedRow = cleanedRow.substring(1).trim();
      if (cleanedRow) {
        result.push(`${insertPrefix}${cleanedRow};`);
      }
    }
  } else {
    result.push(line);
  }
}

fs.writeFileSync(output, result.join('\n'), 'utf8');
console.log('Split SQL written to local_dump_split.sql');
