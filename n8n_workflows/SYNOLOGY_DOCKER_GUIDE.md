# Synology Docker n8n Setup Guide

Step-by-step guide to run n8n on your Synology NAS via Docker.

---

## Prerequisites

| Requirement     | Details                                |
| --------------- | -------------------------------------- |
| Synology NAS    | Any model with Docker support (DSM 7+) |
| Docker package  | Install from Synology Package Center   |
| Docker Compose  | Included with Docker on DSM 7.2+       |
| Ports           | 5678 (n8n web UI)                      |
| Internet access | For Telegram/Facebook webhooks         |

---

## Step 1: Install Docker

1. Open **Package Center** on your Synology
2. Search for **Docker**
3. Click **Install**
4. Open Docker from the Main Menu after installation

---

## Step 2: Create Folder Structure

SSH into your Synology or use File Station:

```bash
# Create directories
mkdir -p /volume1/docker/n8n/data
mkdir -p /volume1/docker/n8n/workflows
```

Or via **File Station**:

1. Navigate to `docker/`
2. Create folder `n8n`
3. Inside `n8n/`, create subfolder `data`

---

## Step 3: Create docker-compose.yml

Create a file at `/volume1/docker/n8n/docker-compose.yml`:

```yaml
version: '3.8'

services:
  n8n:
    image: n8nio/n8n:latest
    container_name: kosai-n8n
    restart: unless-stopped
    ports:
      - '5678:5678'
    environment:
      # ── Basic Config ──────────────────────────────────
      - N8N_HOST=0.0.0.0
      - N8N_PORT=5678
      - N8N_PROTOCOL=http
      - WEBHOOK_URL=http://YOUR_SYNOLOGY_IP:5678

      # ── Timezone ──────────────────────────────────────
      - GENERIC_TIMEZONE=Asia/Yangon
      - TZ=Asia/Yangon

      # ── Security ──────────────────────────────────────
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=YourSecurePassword123!

      # ── Persistence ───────────────────────────────────
      - N8N_DEFAULT_BINARY_DATA_MODE=filesystem
      - EXECUTIONS_DATA_SAVE_ON_ERROR=all
      - EXECUTIONS_DATA_SAVE_ON_SUCCESS=all

      # ── Kosai API ─────────────────────────────────────
      - KOSAI_BASE_URL=https://your-worker.your-subdomain.workers.dev
      - KOSAI_API_KEY=your_jwt_secret

      # ── Telegram ──────────────────────────────────────
      - TELEGRAM_CHAT_ID=5556922076
      - TELEGRAM_DEFAULT_CHAT_ID=5556922076

      # ── Email (optional) ──────────────────────────────
      - SMTP_FROM=noreply@awesomemyanmar.com
      - ADMIN_EMAIL=nyinyimin2007@gmail.com

      # ── Facebook (workflows 11-13) ────────────────────
      - FB_PAGE_ACCESS_TOKEN=your_facebook_token
      - FB_PAGE_ID=your_facebook_page_id
      - FB_VERIFY_TOKEN=your_custom_verify_token

    volumes:
      - /volume1/docker/n8n/data:/home/node/.n8n
      - /volume1/docker/n8n/workflows:/home/node/workflows

    networks:
      - n8n-network

networks:
  n8n-network:
    driver: bridge
```

**Replace these values:**

- `YOUR_SYNOLOGY_IP` — your NAS local IP (e.g., `192.168.1.100`)
- `YourSecurePassword123!` — a strong password
- All `KOSAI_*` values — from your `.dev.vars` file
- All `TELEGRAM_*` values — from your Telegram bot
- All `FB_*` values — from Meta for Developers (if using Facebook)

---

## Step 4: Deploy with Docker Compose

### Option A: SSH (Recommended)

```bash
# SSH into your Synology
ssh admin@YOUR_SYNOLOGY_IP

# Navigate to n8n folder
cd /volume1/docker/n8n

# Start n8n
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f n8n
```

### Option B: Portainer (GUI)

1. Install **Portainer** from Package Center (or via Docker)
2. Open Portainer at `http://YOUR_SYNOLOGY_IP:9000`
3. Go to **Stacks** → **Add Stack**
4. Name it `n8n`
5. Paste the `docker-compose.yml` content
6. Click **Deploy the stack**

### Option C: Synology Container Manager (DSM 7.2+)

1. Open **Container Manager** from Main Menu
2. Go to **Project**
3. Click **Create**
4. Name: `n8n`
5. Path: `/volume1/docker/n8n`
6. Upload or paste `docker-compose.yml`
7. Click **Next** → **Done**

---

## Step 5: Access n8n

1. Open browser: `http://YOUR_SYNOLOGY_IP:5678`
2. Login with the credentials you set:
   - Username: `admin`
   - Password: `YourSecurePassword123!`
3. You should see the n8n dashboard

---

## Step 6: Import Workflows

1. In n8n, click **Add Workflow** → **Import from File**
2. Select each JSON file from `n8n_workflows/`:
   - `workflow_01_new_job_auto_assign.json`
   - `workflow_02_inventory_low_stock_alert.json`
   - ... (all 13 files)
3. For each workflow:
   - Select `Kosai Telegram Bot` credential on Telegram nodes
   - Update any hardcoded URLs
   - Test manually
   - Activate

---

## Step 7: Set Up Telegram Bot Credential

Do this once for all workflows:

1. In n8n, go to **Credentials** → **Add Credential**
2. Search for **Telegram**
3. Name: `Kosai Telegram Bot`
4. Access Token: your bot token from @BotFather
5. Click **Save**

---

## Step 8: Expose Webhooks (Required for External Triggers)

Your Synology needs to be accessible from the internet for Facebook webhooks and Cloudflare Worker callbacks.

### Option A: QuickConnect (Easiest)

1. In Synology, go to **Control Panel** → **QuickConnect**
2. Enable QuickConnect
3. Your n8n webhook URL becomes:
   ```
   https://YOUR_QUICKCONNECT_ID.quickconnect.to/webhook/kosai/...
   ```

### Option B: DDNS + Port Forwarding (Recommended)

1. In Synology, go to **Control Panel** → **External Access** → **DDNS**
2. Add a DDNS host (e.g., `synology.dyndns.org`)
3. In your router, forward port `5678` to your Synology IP
4. Your webhook URL: `http://YOUR_DDNS_HOST:5678/webhook/kosai/...`

### Option C: Reverse Proxy + SSL (Best for Production)

1. In Synology, go to **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Create a new rule:
   - Source: `https://n8n.yourdomain.com`
   - Destination: `http://localhost:5678`
3. Get an SSL certificate (Let's Encrypt via Synology)
4. Your webhook URL: `https://n8n.yourdomain.com/webhook/kosai/...`

### Option D: Cloudflare Tunnel (No Port Forwarding)

1. Install cloudflared on your Synology:
   ```bash
   # SSH into Synology
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /volume1/docker/cloudflared
   chmod +x /volume1/docker/cloudflared
   ```
2. Create a tunnel:
   ```bash
   /volume1/docker/cloudflared tunnel --url http://localhost:5678
   ```
3. Use the generated URL as your `WEBHOOK_URL`

---

## Step 9: Connect Kosai API to n8n

### Update Cloudflare Worker

Add to your `.dev.vars`:

```bash
N8N_WEBHOOK_URL=http://YOUR_SYNOLOGY_IP:5678
```

### Add Webhook Calls in API

Edit your Kosai API to call n8n webhooks. Example for job creation in `src/modules/routes/jobs.ts`:

```typescript
// After inserting a new job, add this:
try {
  const n8nUrl = env.N8N_WEBHOOK_URL;
  if (n8nUrl) {
    await fetch(`${n8nUrl}/webhook/kosai/job-created`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: result.id }),
    });
  }
} catch (e) {
  console.warn('n8n webhook failed:', e);
}
```

### Webhook URLs to Register

| Workflow | URL                                                   | Where to Add                   |
| -------- | ----------------------------------------------------- | ------------------------------ |
| WF01     | `http://YOUR_IP:5678/webhook/kosai/job-created`       | jobs.ts — POST /api/jobs       |
| WF03     | `http://YOUR_IP:5678/webhook/kosai/client-created`    | clients.ts — POST /api/clients |
| WF07     | `http://YOUR_IP:5678/webhook/kosai/job-status-change` | jobs.ts — status update        |
| WF09     | `http://YOUR_IP:5678/webhook/kosai/expense-submitted` | expenses.ts — POST             |
| WF13     | `http://YOUR_IP:5678/webhook/kosai/facebook/job-post` | jobs.ts — status=Completed     |

---

## Step 10: Verify Everything Works

Run this checklist:

- [ ] n8n accessible at `http://YOUR_IP:5678`
- [ ] Can login with admin credentials
- [ ] All 13 workflows imported
- [ ] Telegram credential configured
- [ ] Test webhook (WF06) returns 200:
  ```bash
  curl -X POST http://YOUR_IP:5678/webhook/kosai/notify \
    -H "Content-Type: application/json" \
    -d '{"type":"system_alert","message":"Test notification"}'
  ```
- [ ] Telegram bot receives test message
- [ ] Cron workflows are activated
- [ ] Cloudflare Worker can reach n8n (if using webhooks)

---

## Managing n8n

### Start/Stop

```bash
cd /volume1/docker/n8n
docker-compose up -d      # Start
docker-compose down       # Stop
docker-compose restart    # Restart
```

### View Logs

```bash
docker-compose logs -f n8n        # Follow logs
docker-compose logs --tail=100 n8n  # Last 100 lines
```

### Update n8n

```bash
cd /volume1/docker/n8n
docker-compose pull        # Pull latest image
docker-compose up -d       # Restart with new image
```

### Backup

```bash
# Backup n8n data
tar -czf n8n-backup-$(date +%Y%m%d).tar.gz /volume1/docker/n8n/data
```

---

## Troubleshooting

### n8n won't start

```bash
# Check logs
docker-compose logs n8n

# Common fix: permissions
sudo chown -R 1000:1000 /volume1/docker/n8n/data
```

### Port 5678 already in use

```bash
# Check what's using the port
sudo netstat -tlnp | grep 5678

# Change port in docker-compose.yml
ports:
  - "5679:5678"  # Use 5679 externally
```

### Webhooks not reachable from internet

1. Check port forwarding on your router
2. Check Synology firewall: **Control Panel** → **Security** → **Firewall**
3. Test with: `curl http://YOUR_PUBLIC_IP:5678/healthz`

### Telegram messages not sending

1. Send `/start` to your bot in Telegram
2. Check bot token is correct in credentials
3. Verify `TELEGRAM_CHAT_ID` is your chat ID

### Environment variables not loading

1. Recreate the container after changing env vars:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

---

## Security Recommendations

1. **Change default password** immediately
2. **Use HTTPS** (reverse proxy or Cloudflare Tunnel)
3. **Restrict access** — only allow your IP on port 5678
4. **Backup regularly** — schedule weekly backup of `/volume1/docker/n8n/data`
5. **Don't expose to public** without authentication

---

## Resource Requirements

| Resource    | Minimum | Recommended |
| ----------- | ------- | ----------- |
| RAM         | 512MB   | 1GB         |
| CPU         | 1 core  | 2 cores     |
| Storage     | 1GB     | 5GB         |
| DSM Version | 7.0+    | 7.2+        |

Most Synology NAS models (DS220+, DS420+, DS920+, etc.) handle n8n easily.
