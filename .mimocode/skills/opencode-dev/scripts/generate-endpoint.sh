#!/bin/bash
# Generate a new API endpoint template
# Usage: bash scripts/generate-endpoint.sh <module-name> <endpoint-name>

MODULE=$1
ENDPOINT=$2

if [ -z "$MODULE" ] || [ -z "$ENDPOINT" ]; then
  echo "Usage: bash scripts/generate-endpoint.sh <module-name> <endpoint-name>"
  echo "Example: bash scripts/generate-endpoint.sh reports dashboard"
  exit 1
fi

ROUTE_FILE="src/modules/routes/${MODULE}.ts"

# Check if route file exists
if [ ! -f "$ROUTE_FILE" ]; then
  echo "Creating new route file: $ROUTE_FILE"
  cat > "$ROUTE_FILE" << EOF
/**
 * ${MODULE^} Routes — ${ENDPOINT} operations
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';

function register(router, env) {
  const db = env.DB;

  // ── GET /api/${MODULE}/${ENDPOINT} ──────────────────────────────────
  router.get('/api/${MODULE}/${ENDPOINT}', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare('SELECT * FROM your_table').all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch ${ENDPOINT} error:', err.message);
      return error('Failed to fetch ${ENDPOINT}', 500);
    }
  });

  // ── POST /api/${MODULE}/${ENDPOINT} ─────────────────────────────────
  router.post('/api/${MODULE}/${ENDPOINT}', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      // TODO: Add validation and database insert

      return success({ message: 'Created' }, 201);
    } catch (err) {
      console.error('Create ${ENDPOINT} error:', err.message);
      return error('Failed to create ${ENDPOINT}', 500);
    }
  });
}

export { register };
EOF
  echo "Created: $ROUTE_FILE"
else
  echo "File exists: $ROUTE_FILE"
  echo "Adding endpoint to existing file..."
fi

echo ""
echo "Next steps:"
echo "1. Register the route in src/index.ts:"
echo "   import * as ${MODULE}Routes from './modules/routes/${MODULE}.js';"
echo "   routeModules.push(${MODULE}Routes);"
echo ""
echo "2. Add the table to your database schema"
echo "3. Run tests: npm test"
