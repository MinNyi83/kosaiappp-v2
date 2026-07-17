# Complete Deployment Guide

Everything you need to get Kosai + n8n running end-to-end on your Synology NAS.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLOUD (Internet)                      │
│                                                         │
│  Cloudflare Workers          Facebook Graph API         │
│  (Kosai API) ◄────────────► (Messenger/Leads/Page)     │
│       │                           │                     │
│       │    ┌──────────────────────┘                     │
│       │    │                                            │
│       ▼    ▼                                            │
│  ┌─────────────────┐    ┌──────────────────┐           │
│  │   Telegram API   │    │  Google Sheets   │           │
│  │  (Notifications) │    │   (Backups)      │           │
│  └────────┬────────┘    └────────┬─────────┘           │
│           │                      │                      │
└───────────┼──────────────────────┼──────────────────────┘
            │                      │
            ▼                      ▼
┌─────────────────────────────────────────────────────────┐
│                 SYNOLOGY NAS (Local)                     │
│                                                         │
│  ┌─────────────────────────────────────────────┐       │
│  │              Docker Container                │       │
│  │                                             │       │
│  │  ┌─────────────────────────────────────┐   │       │
│  │  │              n8n                     │   │       │
│  │  │                                     │   │       │
│  │  │  WF01  WF02  WF03  WF04  WF05     │   │       │
│  │  │  WF06  WF07  WF08  WF09  WF10     │   │       │
│  │  │  WF11  WF12  WF13                 │   │       │
│  │  │                                     │   │       │
│  │  │  Port: 5678                         │   │       │
│  │  └─────────────────────────────────────┘   │       │
│  └─────────────────────────────────────────────┘       │
│                                                         │
│  ┌─────────────────────┐                               │
│  │  Portainer (optional)│                               │
│  │  Port: 9000          │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Synology Preparation

### Step 1.1 — Enable SSH

1. **Control Panel** → **Terminal & SNMP** → **Terminal**
2. Check **Enable SSH service**
3. Set port (default 22)
4. Apply

### Step 1.2 — Install Docker

1. Open **Package Center**
2. Search **Docker**
3. Click **Install**
4. Wait for installation to complete
5. Open Docker from Main Menu to verify

### Step 1.3 — Create Folder Structure

Via **File Station** or SSH:

```bash
# SSH into Synology
ssh admin@YOUR_SYNOLOGY_IP

# Create n8n directories
sudo mkdir -p /volume1/docker/n8n/data
sudo mkdir -p /volume1/docker/n8n/workflows
sudo chown -R 1000:1000 /volume1/docker/n8n
```

### Step 1.4 — Note Your Synology IP

Find your NAS IP:
- **Control Panel** → **Network** → **Network Interface**
- Or check your router's device list
- Example: `192.168.1.100`

---

## Phase 2: Deploy n8n on Docker

### Step 2.1 — Create docker-compose.yml

Via SSH or File Station, create `/volume1/docker/n8n/docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: kosai-n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      # ── n8n Config ────────────────────────────────────
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://192.168.1.100:5678
      - GENERIC_TIMEZONE=Asia/Yangon
      - TZ=Asia/Yangon
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=KosaiN8n2024!
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
      - N8N_RUNNERS_ENABLED=true

      # ── Kosai API ─────────────────────────────────────
      - KOSAI_BASE_URL=https://your-worker.workers.dev
      - KOSAI_API_KEY=your_jwt_secret_from_dev_vars

      # ── Telegram ──────────────────────────────────────
      - TELEGRAM_CHAT_ID=5556922076
      - TELEGRAM_DEFAULT_CHAT_ID=5556922076

      # ── Facebook ──────────────────────────────────────
      - FB_PAGE_ACCESS_TOKEN=your_facebook_token
      - FB_PAGE_ID=your_facebook_page_id
      - FB_VERIFY_TOKEN=KosaiFBVerify2024!

      # ── Email ─────────────────────────────────────────
      - SMTP_FROM=noreply@awesomemyanmar.com
      - ADMIN_EMAIL=nyinyimin2007@gmail.com

    volumes:
      - /volume1/docker/n8n/data:/home/node/.n8n
    networks:
      - n8n-network

networks:
  n8n-network:
    driver: bridge
```

**Replace these values before deploying:**
- `192.168.1.100` → your Synology IP
- `KosaiN8n2024!` → your chosen password
- `your-worker.workers.dev` → your Kosai API URL
- `your_jwt_secret_from_dev_vars` → from `.dev.vars` JWT_SECRET
- `5556922076` → your Telegram chat ID
- `your_facebook_token` → from Meta for Developers (if using Facebook)

### Step 2.2 — Deploy the Container

**Option A: SSH (Fastest)**
```bash
cd /volume1/docker/n8n
sudo docker-compose up -d
```

**Option B: Portainer (GUI)**
1. Install Portainer from Package Center
2. Open at `http://YOUR_IP:9000`
3. Stacks → Add Stack
4. Name: `n8n`
5. Paste the docker-compose.yml content
6. Deploy

**Option C: Container Manager (DSM 7.2+)**
1. Open Container Manager
2. Project → Create
3. Name: `n8n`
4. Path: `/volume1/docker/n8n`
5. Upload docker-compose.yml
6. Done

### Step 2.3 — Verify n8n is Running

```bash
# Check container status
sudo docker ps

# Should show:
# kosai-n8n   n8nio/n8n:latest   Up X minutes   0.0.0.0:5678->5678/tcp
```

Open browser: `http://YOUR_SYNOLOGY_IP:5678`

You should see the n8n login page.

### Step 2.4 — Login to n8n

1. Username: `admin`
2. Password: `KosaiN8n2024!` (or whatever you set)
3. You'll see the n8n dashboard

---

## Phase 3: Configure n8n Credentials

### Step 3.1 — Telegram Bot Token

1. In Telegram, message `@BotFather`
2. Send `/newbot`
3. Name: `Kosai Notifications`
4. Username: `kosai_notifs_bot`
5. Copy the token BotFather gives you

Now in n8n:
1. Go to **Credentials** → **Add Credential**
2. Search **Telegram**
3. Name: `Kosai Telegram Bot`
4. Access Token: paste the token
5. **Save**

### Step 3.2 — Get Your Telegram Chat ID

1. In Telegram, message `@userinfobot`
2. Send any message
3. Copy the user ID it returns (e.g., `5556922076`)

Update n8n environment:
1. In n8n, go to **Settings** → **Environment Variables**
2. Set `TELEGRAM_CHAT_ID` to your ID
3. Set `TELEGRAM_DEFAULT_CHAT_ID` to your ID

### Step 3.3 — Kosai API Key

From your `.dev.vars` file, copy the `JWT_SECRET` value.

Update n8n environment:
1. Set `KOSAI_API_KEY` to your JWT secret
2. Set `KOSAI_BASE_URL` to your Cloudflare Worker URL

---

## Phase 4: Import All Workflows

### Step 4.1 — Download Workflow Files

All 13 JSON files are in `n8n_workflows/`:
```
workflow_01_new_job_auto_assign.json
workflow_02_inventory_low_stock_alert.json
workflow_03_client_onboarding.json
workflow_04_invoice_reconciliation.json
workflow_05_worker_attendance_report.json
workflow_06_multi_channel_notification_hub.json
workflow_07_job_status_client_alert.json
workflow_08_daily_operations_digest.json
workflow_09_expense_approval.json
workflow_10_data_backup_google_sheets.json
workflow_11_facebook_messenger_chat.json
workflow_12_facebook_lead_ads.json
workflow_13_facebook_page_job_post.json
```

### Step 4.2 — Import Each Workflow

For each file:
1. In n8n, click **Add Workflow** (top right)
2. Click **⋮** (three dots) → **Import from File**
3. Select the JSON file
4. The workflow appears in your dashboard

### Step 4.3 — Configure Telegram Nodes

In every workflow that has Telegram nodes:
1. Click on each Telegram node
2. Under **Credential to connect with**, select `Kosai Telegram Bot`
3. Repeat for all Telegram nodes in all workflows

---

## Phase 5: Test Each Workflow

### Step 5.1 — Test WF06 (Notification Hub) First

This is the simplest to test:

1. Open workflow `WF06 Multi-Channel Notification Hub`
2. Click **Test Workflow**
3. In another terminal, send a test POST:
```bash
curl -X POST http://YOUR_IP:5678/webhook/kosai/notify \
  -H "Content-Type: application/json" \
  -d '{"type":"system_alert","message":"Test from deployment guide"}'
```
4. Check your Telegram — you should receive a message

### Step 5.2 — Test WF02 (Low Stock Alert)

1. Open `WF02 Inventory Low Stock Alert`
2. Click **Test Workflow**
3. Check Telegram for the alert (or "No low stock" message)

### Step 5.3 — Test WF08 (Daily Digest)

1. Open `WF08 Daily Operations Digest`
2. Click **Test Workflow**
3. Check Telegram for the digest

### Step 5.4 — Test Webhook Workflows

For each webhook workflow, test with curl:

```bash
# WF01 - Job Created
curl -X POST http://YOUR_IP:5678/webhook/kosai/job-created \
  -H "Content-Type: application/json" \
  -d '{"jobId":"TEST-001"}'

# WF03 - Client Created
curl -X POST http://YOUR_IP:5678/webhook/kosai/client-created \
  -H "Content-Type: application/json" \
  -d '{"clientId":"CLI-TEST"}'

# WF07 - Job Status Change
curl -X POST http://YOUR_IP:5678/webhook/kosai/job-status-change \
  -H "Content-Type: application/json" \
  -d '{"jobId":"TEST-001","newStatus":"Completed"}'

# WF09 - Expense Submitted
curl -X POST http://YOUR_IP:5678/webhook/kosai/expense-submitted \
  -H "Content-Type: application/json" \
  -d '{"expenseId":"EXP-TEST"}'
```

### Step 5.5 — Activate Workflows

Once tested successfully, toggle each workflow to **Active** (top right toggle).

---

## Phase 6: Connect Kosai API to n8n

### Step 6.1 — Add N8N_WEBHOOK_URL to Cloudflare

In your `.dev.vars`:
```
N8N_WEBHOOK_URL=http://YOUR_SYNOLOGY_IP:5678
```

If your NAS is not accessible from the internet, use one of these:
- **Cloudflare Tunnel** (recommended)
- **QuickConnect**
- **Port forwarding** on your router

### Step 6.2 — Add Webhook Calls to Kosai API

Edit your Cloudflare Worker to call n8n webhooks.

**In `src/modules/routes/jobs.ts`**, after creating a job:
```typescript
// Fire-and-forget webhook to n8n
fetch(`${env.N8N_WEBHOOK_URL}/webhook/kosai/job-created`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jobId: result.id })
}).catch(() => {});
```

**In `src/modules/routes/jobs.ts`**, after status change:
```typescript
fetch(`${env.N8N_WEBHOOK_URL}/webhook/kosai/job-status-change`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jobId: params.id,
    oldStatus: previousStatus,
    newStatus: newStatus,
    clientTelegramId: client?.telegram_id
  })
}).catch(() => {});
```

**In `src/modules/routes/clients.ts`**, after creating a client:
```typescript
fetch(`${env.N8N_WEBHOOK_URL}/webhook/kosai/client-created`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId: newClient.id })
}).catch(() => {});
```

**In `src/modules/routes/expenses.ts`**, after submitting an expense:
```typescript
fetch(`${env.N8N_WEBHOOK_URL}/webhook/kosai/expense-submitted`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ expenseId: expense.id })
}).catch(() => {});
```

### Step 6.3 — Deploy Updated API

```bash
wrangler deploy
```

---

## Phase 7: Facebook Setup (Optional)

### Step 7.1 — Create Facebook App

1. Go to [Meta for Developers](https://developers.facebook.com)
2. Click **My Apps** → **Create App**
3. Type: **Business**
4. App Name: `Kosai`
5. Create App

### Step 7.2 — Add Messenger Product

1. In your app, click **Add Products**
2. Find **Messenger** → Click **Set up**
3. Go to **Messenger** → **Settings**

### Step 7.3 — Generate Page Access Token

1. Under **Access Tokens**, click **Generate Token**
2. Select your Facebook Page
3. Check all permissions:
   - `pages_messaging`
   - `pages_manage_posts`
   - `pages_read_engagement`
4. Copy the token

Update n8n:
```
FB_PAGE_ACCESS_TOKEN=paste_token_here
```

### Step 7.4 — Subscribe to Webhooks

1. Under **Webhooks**, click **Subscribe to Events**
2. Callback URL: `https://your-public-url/webhook/kosai/facebook/messenger`
3. Verify Token: `KosaiFBVerify2024!` (must match n8n)
4. Subscribe to events:
   - `messages`
   - `messaging_postbacks`
5. Click **Verify and Save**

### Step 7.5 — Get Page ID

1. Go to your Facebook Page
2. **About** → scroll to bottom
3. Copy **Page ID**

Update n8n:
```
FB_PAGE_ID=123456789012345
```

### Step 7.6 — Test Facebook Messenger

1. Open your Facebook Page
2. Send a message: "Hello, I need CCTV installation"
3. Check n8n execution log
4. You should receive an auto-reply on Facebook
5. Check Telegram for the agent alert

---

## Phase 8: External Access (Webhooks)

Your n8n must be reachable from the internet for:
- Facebook webhooks
- Cloudflare Worker callbacks

### Option A: Cloudflare Tunnel (Recommended)

Most secure, no port forwarding needed:

```bash
# SSH into Synology
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -O /volume1/docker/cloudflared
chmod +x /volume1/docker/cloudflared

# Create a quick tunnel
/volume1/docker/cloudflared tunnel --url http://localhost:5678
```

This gives you a public URL like: `https://abc-xyz.trycloudflare.com`

Update your Cloudflare Worker:
```
N8N_WEBHOOK_URL=https://abc-xyz.trycloudflare.com
```

### Option B: DDNS + Port Forwarding

1. **Synology** → **Control Panel** → **External Access** → **DDNS**
2. Add a DDNS hostname (e.g., `kosai.synology.me`)
3. **Router** → Forward port `5678` to `YOUR_SYNOLogy_IP:5678`
4. Test: `http://kosai.synology.me:5678`

### Option C: Reverse Proxy with SSL

1. **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Create rule:
   - Source: `https://n8n.yourdomain.com`
   - Destination: `http://localhost:5678`
3. Add SSL certificate (Let's Encrypt)
4. Test: `https://n8n.yourdomain.com`

---

## Phase 9: Final Verification

Run this complete checklist:

### n8n
- [ ] n8n accessible at `http://YOUR_IP:5678`
- [ ] Can login with admin credentials
- [ ] All 13 workflows imported
- [ ] Telegram credential configured
- [ ] All Telegram nodes use `Kosai Telegram Bot` credential

### Workflows
- [ ] WF01 — Webhook responds to job-created
- [ ] WF02 — Cron triggers daily at 8AM
- [ ] WF03 — Webhook responds to client-created
- [ ] WF04 — Cron triggers daily at 6AM
- [ ] WF05 — Cron triggers Monday 9AM
- [ ] WF06 — Test notification received on Telegram
- [ ] WF07 — Webhook responds to job-status-change
- [ ] WF08 — Daily digest received on Telegram
- [ ] WF09 — Webhook responds to expense-submitted
- [ ] WF10 — Backup runs (if Google Sheets configured)
- [ ] WF11 — Facebook Messenger auto-reply works
- [ ] WF12 — Facebook Lead creates client
- [ ] WF13 — Job completion posts to Facebook Page

### Kosai API
- [ ] `N8N_WEBHOOK_URL` set in `.dev.vars`
- [ ] Webhook calls added to jobs.ts, clients.ts, expenses.ts
- [ ] API deployed with `wrangler deploy`
- [ ] API can reach n8n (test with curl from Cloudflare logs)

### Facebook (if configured)
- [ ] Facebook App created
- [ ] Messenger product added
- [ ] Webhook subscribed to messages
- [ ] Page Access Token generated
- [ ] Page ID set in n8n

---

## Troubleshooting

### n8n won't start
```bash
cd /volume1/docker/n8n
sudo docker-compose logs n8n
# Check for errors
sudo docker-compose down
sudo docker-compose up -d
```

### Telegram messages not sending
1. Send `/start` to your bot in Telegram
2. Verify token in n8n credentials
3. Verify chat ID is correct

### Webhooks return 404
1. Check workflow is **activated** (toggle on)
2. Verify webhook URL matches exactly
3. Check n8n is accessible from the internet

### Facebook webhook verification fails
1. Ensure HTTPS (Facebook requires it)
2. Verify verify token matches in both places
3. Check n8n is publicly accessible

### Kosai API can't reach n8n
1. Test from Cloudflare Worker logs
2. Check `N8N_WEBHOOK_URL` is correct
3. Ensure n8n is accessible from internet

---

## Quick Reference

| Resource | URL/Location |
|---|---|
| n8n UI | `http://YOUR_SYNOLOGY_IP:5678` |
| n8n Data | `/volume1/docker/n8n/data` |
| docker-compose | `/volume1/docker/n8n/docker-compose.yml` |
| n8n Logs | `sudo docker-compose logs -f n8n` |
| Restart n8n | `sudo docker-compose restart` |
| Stop n8n | `sudo docker-compose down` |
| Update n8n | `sudo docker-compose pull && sudo docker-compose up -d` |

---

## Backup

Schedule weekly backup of n8n data:

```bash
# Manual backup
tar -czf /volume1/backup/n8n-$(date +%Y%m%d).tar.gz /volume1/docker/n8n/data

# Or add to Synology Task Scheduler (Control Panel → Task Scheduler):
# Weekly backup every Sunday at 3AM
0 3 * * 0 tar -czf /volume1/backup/n8n-$(date +\%Y\%m\%d).tar.gz /volume1/docker/n8n/data
```
