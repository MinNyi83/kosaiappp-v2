---
name: opencode-dev
description: OpenCode development workflow for KosAI system. Use when creating, editing, testing, or deploying Cloudflare Workers, D1 database schemas, API endpoints, or frontend components. Covers TypeScript development, wrangler CLI, database migrations, testing with vitest, and CI/CD deployment.
---

# OpenCode Development Skill

Development workflow for KosAI Cloudflare Workers project.

## Project Structure

```
src/
├── index.ts                    # Worker entry point
├── modules/
│   ├── routes/                 # API route handlers
│   │   ├── auth.ts             # Authentication (login, JWT)
│   │   ├── jobs.ts             # Jobs CRUD, photo upload
│   │   ├── clients.ts          # Client management
│   │   ├── inventory.ts        # Inventory, warranty, RMA
│   │   ├── admin.ts            # Admin operations, config
│   │   ├── google.ts           # Google OAuth, Drive
│   │   └── telegram.ts         # Telegram bot webhook
│   └── utils/
│       ├── jwt.ts              # JWT signing/verification
│       ├── csrf.ts             # CSRF token generation
│       ├── cors.ts             # CORS headers
│       ├── google.ts           # Google Drive upload
│       ├── telegram.ts         # Telegram notifications
│       ├── rate-limit.ts       # Rate limiting
│       └── sql-validator.ts    # SQL injection prevention
└── types/
    └── schema.ts               # TypeScript type definitions

public/                         # Frontend assets
├── admin.html                  # Admin dashboard
├── admin.js                    # Admin logic
├── app.html                    # Technician mobile app
├── app.js                      # Technician app logic
└── views/                      # Admin view partials

db/                             # Database schemas and migrations
```

## Common Commands

### Development
```bash
npm run dev                    # Start wrangler dev server (port 8787)
npm run build:css              # Build Tailwind CSS
npm run watch:css              # Watch Tailwind CSS
```

### Testing
```bash
npm test                       # Run all tests
npm run test:watch             # Run tests in watch mode
```

### Deployment
```bash
npm run deploy:worker          # Deploy Cloudflare Worker
npm run deploy:pages           # Deploy to Cloudflare Pages
npm run deploy                 # Deploy both
```

### Database
```bash
npx wrangler d1 execute cctv-fsm-db --local --command "SQL"
npx wrangler d1 execute cctv-fsm-db --remote --command "SQL"
```

## Development Workflow

### 1. Add New API Endpoint

1. Create route in `src/modules/routes/{module}.ts`
2. Register in `src/index.ts` route modules
3. Add to router: `router.get('/api/endpoint', handler)`
4. Use `authenticate(request)` for auth
5. Use `requireCsrf(request, userId)` for POST/PUT/DELETE
6. Return `success(data)` or `error(message, statusCode)`

### 2. Add New Database Table

1. Create migration in `db/migrations/`
2. Run: `npx wrangler d1 execute cctv-fsm-db --file=db/migrations/xxx.sql`
3. Update `src/types/schema.ts` with TypeScript types
4. Test locally with `--local` flag

### 3. Add New Frontend View

1. Create HTML in `public/views/{name}.html`
2. Add navigation in `admin.js`
3. Load view: `loadView('{name}')`
4. Add API calls with auth headers

### 4. Security Checklist

- [ ] PINs stored as salted SHA-256 (`$sha256$<salt>$<hash>`)
- [ ] CSRF token required for state-changing requests
- [ ] Rate limiting on login endpoints
- [ ] Secrets in `.dev.vars` (local) or Cloudflare Dashboard (production)
- [ ] No secrets committed to git
- [ ] Admin endpoints require admin role
- [ ] Input validation on all endpoints

## API Patterns

### Route Handler
```typescript
router.get('/api/endpoint', async (request) => {
  try {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);

    const url = new URL(request.url);
    const param = url.searchParams.get('param');

    const result = await db.prepare('SELECT * FROM table').all();
    return success(result.results);
  } catch (err) {
    console.error('Error:', err.message);
    return error('Failed to fetch', 500);
  }
});
```

### POST with CSRF
```typescript
router.post('/api/endpoint', async (request) => {
  try {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);
    if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

    const body = (await request.json()) as any;
    // ... process body

    return success({ message: 'Created' }, 201);
  } catch (err) {
    return error('Failed', 500);
  }
});
```

### Database Query
```typescript
// Parameterized query (safe from SQL injection)
const result = await db
  .prepare('SELECT * FROM clients WHERE id = ?')
  .bind(clientId)
  .first();

// Pagination
const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);
const offset = (page - 1) * limit;
```

## Testing Patterns

### Unit Test
```typescript
import { describe, expect, it, vi } from 'vitest';

describe('Feature', () => {
  it('should do something', async () => {
    const result = await myFunction();
    expect(result).toBe(expected);
  });
});
```

### E2E Test
```typescript
import { unstable_dev } from 'wrangler';

describe('API Endpoint', () => {
  let worker: any;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should return 200', async () => {
    const res = await worker.fetch('/api/endpoint');
    expect(res.status).toBe(200);
  });
});
```

## Environment Variables

### Required Secrets (`.dev.vars` / Cloudflare Dashboard)
- `JWT_SECRET` - JWT signing key (64+ chars)
- `CSRF_SECRET` - CSRF token signing key
- `GEMINI_API_KEY` - AI copilot
- `GOOGLE_CLIENT_ID` - OAuth
- `GOOGLE_CLIENT_SECRET` - OAuth
- `GOOGLE_REFRESH_TOKEN` - Drive access
- `TELEGRAM_BOT_TOKEN` - Notifications
- `TELEGRAM_CHAT_ID` - Notification group

### Non-Sensitive (wrangler.toml `[vars]`)
- `ADMIN_EMAIL` - Admin contact

## Debugging

### Check Worker Logs
```bash
npx wrangler tail              # Tail live logs
```

### Local Database
```bash
npx wrangler d1 execute cctv-fsm-db --local --command "SELECT * FROM technicians"
```

### Test Endpoints
```bash
# Login
curl -X POST http://127.0.0.1:8787/api/auth/login-password \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"1234"}'

# Authenticated request
curl http://127.0.0.1:8787/api/jobs \
  -H "Authorization: Bearer <token>"
```
