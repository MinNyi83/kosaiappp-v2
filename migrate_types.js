import fs from 'fs';
import path from 'path';

function traverseDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');

      // Inject standard interface Env if not present, or assume it's global.
      // Better yet, just type them as any temporarily or import Env.
      // Let's replace function register(router, env)
      content = content.replace(
        /function register\(router, env\)/g,
        'function register(router: any, env: any)'
      );

      // Replace route signatures: router.post("/api/...", async (request) =>
      content = content.replace(/async \((request)\) =>/g, 'async (request: any) =>');
      content = content.replace(
        /async \((request, params)\) =>/g,
        'async (request: any, params: any) =>'
      );

      // We will just patch the most common ones to `any` for now to pass the compiler,
      // or to `Request` and `any`.
      fs.writeFileSync(fullPath, content, 'utf8');
    }
  }
}

traverseDir('./src/modules');
console.log('Done migrating basic types in modules.');
