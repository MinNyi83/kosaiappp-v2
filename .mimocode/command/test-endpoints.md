---
description: Test all Cloudflare endpoints (Telegram, Admin API, AI Copilot) after deployment
---

# Test Endpoints

Run comprehensive endpoint tests against the deployed Cloudflare Worker.

## Parameters
- `$1` (optional): Specific endpoint to test (e.g., "telegram", "admin", "ai", "all")

## Implementation

Test the following endpoints against `https://cctv-service-system.nyinyimin2007.workers.dev`:

### Admin Login
```powershell
$loginBody = @{ username = "admin"; password = "AdminPass123!" } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "$baseUrl/api/auth/login-password" -Method POST -Body $loginBody -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
$token = ($loginResp.Content | ConvertFrom-Json).data.token
```

### Telegram Commands (19 total)
Test each command by POSTing to `/api/telegram/webhook` with a simulated Telegram message payload.

### Admin API
Test authenticated endpoints with Bearer token.

### AI Copilot
Test `/api/admin/ai/chat-data` with a natural language query.

Report pass/fail for each endpoint.
