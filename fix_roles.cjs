const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else if (file.endsWith('.ts')) {
      results.push(file);
    }
  });
  return results;
}

walk('src').forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let orig = content;
  content = content.replace(/user\.role !== 'admin'/g, "user.role?.toLowerCase() !== 'admin'");
  content = content.replace(/user\.role === 'admin'/g, "user.role?.toLowerCase() === 'admin'");
  if (content !== orig) {
    fs.writeFileSync(file, content);
    console.log('Updated ' + file);
  }
});
