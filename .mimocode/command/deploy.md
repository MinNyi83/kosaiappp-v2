---
description: Deploy Worker and Pages to Cloudflare production (no testing)
---

# Deploy

Deploy code changes to Cloudflare production without running endpoint tests.

## Steps

### 1. TypeScript Check

```bash
npx tsc --noEmit
```

### 2. Deploy Both

```bash
npm run deploy
```

This runs:

- `npx wrangler deploy` → Worker
- `npx wrangler pages deploy public --project-name=awesomemyanmar` → Pages

## Environment

- Worker: `https://cctv-service-system.nyinyimin2007.workers.dev`
- Pages: `https://awesomemyanmar.pages.dev`

## Rules

- Always deploy BOTH worker and pages
- Always run TypeScript check first
