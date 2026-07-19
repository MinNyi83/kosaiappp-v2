---
name: deploy-and-test
description: Automates Cloudflare Worker + Pages deployment with post-deploy endpoint testing. Use when deploying code changes.
---

# Deploy & Test Workflow

Standard workflow for deploying code changes to Cloudflare and verifying endpoints.

## When to Use

- After any code change that needs to go live
- User says "deploy", "deploy cloudflare", or "deploy to production"
- After fixing bugs in backend routes or frontend views

## Deployment Steps

### 1. TypeScript Check

```bash
npx tsc --noEmit
```

### 2. Deploy Both Worker and Pages

```bash
npm run deploy
```

This runs:

- `npx wrangler deploy` → Worker at `https://cctv-service-system.nyinyimin2007.workers.dev`
- `npx wrangler pages deploy public --project-name=awesomemyanmar` → Pages at `https://awesomemyanmar.pages.dev`

### 3. Post-Deploy Endpoint Tests

**Login to get admin token:**

```powershell
$loginBody = @{ username = "admin"; password = "AdminPass123!" } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login-password" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
$token = ($loginResp.Content | ConvertFrom-Json).data.token
```

**Test Telegram commands (19 total):**

```powershell
$commands = @("/start", "/help", "/clock", "/checkin", "/checkout", "/clockin", "/clockout", "/status", "/jobs", "/completed", "/today", "/ticket", "/accept JOB-xxx", "/assign", "/cancel", "/team", "/leaderboard", "/report", "/history")
foreach ($cmd in $commands) {
    $body = @{ message = @{ text = $cmd; chat = @{ id = 123456789 }; from = @{ id = 987654321; username = "MinNyi83"; first_name = "Nyi Min" } } } | ConvertTo-Json -Depth 5
    $resp = Invoke-WebRequest -Uri "$baseUrl/api/telegram/webhook" -Method POST -Body $body -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing -TimeoutSec 10
}
```

**Test Admin API:**

```powershell
Invoke-WebRequest -Uri "$baseUrl/api/admin/clients" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
```

**Test AI Copilot:**

```powershell
$body = @{ question = "list all technicians" } | ConvertTo-Json
Invoke-WebRequest -Uri "$baseUrl/api/admin/ai/chat-data" -Method POST -Body $body -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing
```

## Environment

- Worker: `https://cctv-service-system.nyinyimin2007.workers.dev`
- Pages: `https://awesomemyanmar.pages.dev`
- Admin login: username `admin`, password `AdminPass123!`
- D1 Database: `cctv-fsm-db`

## Rules

- Always deploy BOTH worker and pages (user explicitly requested this)
- Always run TypeScript check before deploy
- Test all modified endpoints after deploy
