# n8n Workflows Setup Guide

Complete step-by-step guide for deploying all 13 Kosai n8n workflows.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| n8n | v1.19+ | Self-hosted or cloud |
| Kosai API | Running | Cloudflare Worker at your domain |
| Telegram Bot | @BotFather | For notifications |
| Facebook App | Meta Developers | For workflows 11-13 |

---

## Step 1: Environment Variables

Add these to n8n → Settings → Environment Variables (or `.env` file):

```bash
# ── Kosai API ──────────────────────────────────────────────
KOSAI_BASE_URL=https://your-worker.your-subdomain.workers.dev
KOSAI_API_KEY=your_jwt_secret_or_api_key

# ── Telegram ───────────────────────────────────────────────
TELEGRAM_CHAT_ID=your_admin_chat_id
TELEGRAM_DEFAULT_CHAT_ID=your_default_chat_id

# ── Email (optional) ──────────────────────────────────────
SMTP_FROM=noreply@awesomemyanmar.com
ADMIN_EMAIL=nyinyimin2007@gmail.com

# ── Facebook (workflows 11-13 only) ───────────────────────
FB_PAGE_ACCESS_TOKEN=your_facebook_page_access_token
FB_PAGE_ID=your_facebook_page_id
FB_VERIFY_TOKEN=your_custom_verify_token
```

### How to get Telegram Chat ID

1. Open Telegram, search for `@userinfobot`
2. Send any message to it
3. It replies with your Chat ID (e.g., `5556922076`)
4. Use that as `TELEGRAM_CHAT_ID`

### How to get Facebook tokens

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create App → Business → Add "Messenger" product
3. Go to Messenger → Settings → Generate Token
4. Copy the Page Access Token
5. Your Page ID is in your Facebook Page → About → Page ID

---

## Step 2: Import Workflows

For each workflow:

1. Open n8n dashboard
2. Click **Add Workflow** → **Import from File**
3. Select the JSON file from `n8n_workflows/`
4. Configure credentials (see Step 3)
5. Set environment variables
6. Test manually first
7. Activate when ready

---

## Step 3: Telegram Bot Credentials

All workflows use the same Telegram bot. Set it up once:

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Telegram**
3. Name it `Kosai Telegram Bot`
4. Paste your bot token from @BotFather
5. Save

Then in each Telegram node, select this credential.

---

## Step 4: Workflow-by-Workflow Setup

### WF01: New Job Auto-Assignment

| Field | Value |
|---|---|
| File | `workflow_01_new_job_auto_assign.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/job-created` |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. In the "Webhook - Job Created" node, copy the webhook URL
3. In your Kosai API (`src/index.ts`), add a webhook call when a job is created:

```javascript
// In your job creation endpoint, after inserting the job:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/job-created`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId: newJob.id })
});
```

4. Select `Kosai Telegram Bot` credential on all Telegram nodes
5. Test with a manual POST to the webhook URL
6. Activate

---

### WF02: Inventory Low Stock Alert

| Field | Value |
|---|---|
| File | `workflow_02_inventory_low_stock_alert.json` |
| Trigger | Cron (Daily 8AM) |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Select Telegram credential
3. The cron schedule is already set (daily 8AM)
4. Test manually by clicking "Execute Workflow"
5. Activate

---

### WF03: Client Onboarding Sequence

| Field | Value |
|---|---|
| File | `workflow_03_client_onboarding.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/client-created` |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. Add webhook call in your client creation endpoint:

```javascript
// After inserting a new client:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/client-created`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: newClient.id })
});
```

4. Select Telegram credential
5. Test, then activate

---

### WF04: Invoice Payment Reconciliation

| Field | Value |
|---|---|
| File | `workflow_04_invoice_reconciliation.json` |
| Trigger | Cron (Daily 6AM) |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Select Telegram credential
3. Test manually
4. Activate

---

### WF05: Worker Attendance Report

| Field | Value |
|---|---|
| File | `workflow_05_worker_attendance_report.json` |
| Trigger | Cron (Monday 9AM) |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Select Telegram credential
3. Test manually
4. Activate

---

### WF06: Multi-Channel Notification Hub

| Field | Value |
|---|---|
| File | `workflow_06_multi_channel_notification_hub.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/notify` |
| Requires | Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. Use this webhook from any other workflow or your API to send notifications:

```javascript
// Send a notification:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/notify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'job_completed',  // or any event type
    job_id: 'JOB-123',
    client_name: 'Acme Corp',
    description: 'CCTV installation completed'
  })
});
```

4. Select Telegram credential
5. Test, then activate

---

### WF07: Job Status Client Alert

| Field | Value |
|---|---|
| File | `workflow_07_job_status_client_alert.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/job-status-change` |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. Add webhook call in your job status update endpoint:

```javascript
// After updating job status:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/job-status-change`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobId: job.id,
    oldStatus: oldStatus,
    newStatus: newStatus,
    clientTelegramId: client.telegram_id
  })
});
```

4. Select Telegram credential
5. Test, then activate

---

### WF08: Daily Operations Digest

| Field | Value |
|---|---|
| File | `workflow_08_daily_operations_digest.json` |
| Trigger | Cron (Daily 7AM) |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Select Telegram credential
3. Test manually
4. Activate

---

### WF09: Expense Approval Workflow

| Field | Value |
|---|---|
| File | `workflow_09_expense_approval.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/expense-submitted` |
| Requires | Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. Add webhook call when an expense is submitted:

```javascript
// After creating an expense:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/expense-submitted`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ expenseId: expense.id })
});
```

4. Select Telegram credential
5. Test, then activate

---

### WF10: Data Backup to Google Sheets

| Field | Value |
|---|---|
| File | `workflow_10_data_backup_google_sheets.json` |
| Trigger | Cron (Daily 2AM) |
| Requires | Kosai API, Google account, Telegram |

**Setup:**
1. Import the JSON
2. In n8n, add Google Sheets OAuth2 credential:
   - Go to **Credentials** → **Add** → **Google Sheets**
   - Follow OAuth flow with your Google account
3. In each Google Sheets node, select your credential
4. Create a Google Sheet with these tabs:
   - `Clients`
   - `Jobs`
   - `Technicians`
   - `Invoices`
   - `Inventory`
5. In each Google Sheets node, update the Spreadsheet ID
6. Select Telegram credential
7. Test manually
8. Activate

---

### WF11: Facebook Messenger Chat

| Field | Value |
|---|---|
| File | `workflow_11_facebook_messenger_chat.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/facebook/messenger` |
| Requires | Facebook App, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. In Meta for Developers:
   - Go to your App → Messenger → Settings
   - Under **Webhooks**, click **Subscribe to Events**
   - Enter your webhook URL
   - Enter your `FB_VERIFY_TOKEN` as the Verify Token
   - Subscribe to: `messages`, `messaging_postbacks`
4. Select Telegram credential
5. Test by sending a message to your Facebook Page
6. Activate

---

### WF12: Facebook Lead Ads

| Field | Value |
|---|---|
| File | `workflow_12_facebook_lead_ads.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/facebook/leads` |
| Requires | Facebook App, Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. In Meta for Developers:
   - Go to your App → Lead Ads → Settings
   - Under **Webhooks**, click **Subscribe**
   - Enter your webhook URL
   - Subscribe to: `leads`
4. Create a Lead Ad Form in Facebook Ads Manager with fields:
   - Name
   - Email
   - Phone Number
   - Service Interest (dropdown)
   - Message (optional)
5. Select Telegram credential
6. Test with a test lead
7. Activate

---

### WF13: Facebook Page Job Post

| Field | Value |
|---|---|
| File | `workflow_13_facebook_page_job_post.json` |
| Trigger | Webhook |
| Webhook URL | `{{n8n_url}}/webhook/kosai/facebook/job-post` |
| Requires | Facebook App, Kosai API, Telegram |

**Setup:**
1. Import the JSON
2. Copy the webhook URL
3. Add webhook call when a job is completed:

```javascript
// After marking job as completed:
await fetch(`${N8N_WEBHOOK_URL}/webhook/kosai/facebook/job-post`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId: job.id })
});
```

4. In Meta for Developers:
   - Go to your App → Facebook Login → Settings
   - Add your n8n domain to **Valid OAuth Redirect URIs**
   - Go to Pages → Add your Page
   - Generate a Page Access Token with `pages_manage_posts` and `pages_read_engagement` permissions
5. Set `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN`
6. Select Telegram credential
7. Test with a completed job
8. Activate

---

## Step 5: Connect Kosai API to Webhooks

Add these environment variables to your Cloudflare Worker (`.dev.vars`):

```bash
N8N_WEBHOOK_URL=https://your-n8n-instance.com
```

Then add webhook calls in your API routes. Here's where each webhook should be called:

| Workflow | Trigger Point | File |
|---|---|---|
| WF01 | After creating a job | `src/modules/routes/jobs.ts` — POST /api/jobs |
| WF03 | After creating a client | `src/modules/routes/clients.ts` — POST /api/clients |
| WF06 | Any event | Used by other workflows or API |
| WF07 | After updating job status | `src/modules/routes/jobs.ts` — POST /api/jobs/:id/status |
| WF09 | After submitting an expense | `src/modules/routes/expenses.ts` — POST /api/expenses |
| WF13 | After completing a job | `src/modules/routes/jobs.ts` — POST /api/jobs/:id/status |

### Example: Add to jobs.ts

```typescript
// In POST /api/jobs handler, after successful insert:
try {
  await fetch(`${env.N8N_WEBHOOK_URL}/webhook/kosai/job-created`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobId: newJob.id })
  });
} catch (e) {
  console.warn('n8n webhook failed:', e);
}
```

---

## Step 6: Test Each Workflow

Run this checklist for each workflow:

- [ ] JSON imported successfully
- [ ] Environment variables set
- [ ] Telegram credential selected on all Telegram nodes
- [ ] Webhook URL copied (if webhook-triggered)
- [ ] Webhook registered in Kosai API (if needed)
- [ ] Manual test executed successfully
- [ ] Workflow activated

---

## Troubleshooting

### "Unauthorized" errors
- Check `KOSAI_API_KEY` matches your JWT secret
- Ensure Bearer prefix: `Bearer {{ $env.KOSAI_API_KEY }}`

### Telegram messages not sending
- Verify bot token in credentials
- Check `TELEGRAM_CHAT_ID` is correct
- Send `/start` to your bot in Telegram first

### Facebook webhook verification fails
- Ensure `FB_VERIFY_TOKEN` matches in both Meta and n8n
- Webhook URL must be HTTPS
- Check n8n is publicly accessible

### Workflows not triggering
- Check webhook URLs are correct
- Verify n8n is accessible from your API
- Check Cloudflare Worker logs for webhook errors

### Cron workflows not running
- Ensure workflow is **activated** (toggle switch)
- Check n8n server timezone settings
- Verify cron expression is valid

---

## Webhook URL Reference

| Workflow | Webhook Path |
|---|---|
| WF01 | `/webhook/kosai/job-created` |
| WF03 | `/webhook/kosai/client-created` |
| WF06 | `/webhook/kosai/notify` |
| WF07 | `/webhook/kosai/job-status-change` |
| WF09 | `/webhook/kosai/expense-submitted` |
| WF11 | `/webhook/kosai/facebook/messenger` |
| WF12 | `/webhook/kosai/facebook/leads` |
| WF13 | `/webhook/kosai/facebook/job-post` |

Full URL format: `https://your-n8n-domain.com/webhook/kosai/...`

---

## Architecture Overview

```
Kosai API (Cloudflare Worker)
  │
  ├── POST /api/jobs ──────────→ WF01 (Auto-Assign)
  ├── POST /api/clients ───────→ WF03 (Onboarding)
  ├── POST /api/jobs/:id/... ──→ WF07 (Client Alert)
  ├── POST /api/expenses ──────→ WF09 (Approval)
  └── POST /api/jobs/:id/... ──→ WF13 (FB Page Post)

Cron Triggers (n8n)
  ├── Daily 2AM ───────────────→ WF10 (Backup)
  ├── Daily 6AM ───────────────→ WF04 (Reconciliation)
  ├── Daily 7AM ───────────────→ WF08 (Digest)
  ├── Daily 8AM ───────────────→ WF02 (Low Stock)
  └── Monday 9AM ──────────────→ WF05 (Attendance)

Webhook Triggers (external)
  ├── WF06 ← Any workflow or API (Notification Hub)
  ├── WF11 ← Facebook Messenger
  └── WF12 ← Facebook Lead Ads
```
