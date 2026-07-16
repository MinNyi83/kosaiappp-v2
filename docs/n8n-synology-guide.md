# 🟢 24/7 n8n Setup on Synology NAS (Direct to Cloudflare)

Running n8n on your Synology NAS is the best way to keep your Facebook automations running 24/7 without needing your PC to stay powered on.

This guide will show you how to install n8n using Synology's Container Manager and connect it to your live Cloudflare Worker.

---

## 🛠️ Step 1: Install n8n on Synology Container Manager

1. Log into your **Synology DSM**.
2. Open **Container Manager** (or install it from the Package Center if you haven't).
3. Go to **Registry** in the left sidebar.
4. Search for `n8nio/n8n` and download the `latest` image.
5. Wait for the download to finish, then go to **Image** and select `n8nio/n8n:latest`. Click **Run** (or **Launch**).

### ⚙️ Container Configuration

Configure the container with the following settings:

1. **General Settings**:
   - **Container Name**: `n8n-automation`
   - **Enable auto-restart**: ✅ Checked (Crucial so it turns back on if the NAS reboots).
   - Click **Next**.

2. **Advanced Settings (Volume)**:
   - Click **Add Folder** to map persistent storage (so you don't lose workflows).
   - Create a folder on your NAS called `docker/n8n_data`.
   - **Mount path (File/Folder)**: `docker/n8n_data`
   - **Mount path (Container)**: `/home/node/.n8n`

3. **Advanced Settings (Port Settings)**:
   - Map your local NAS port to the container.
   - **Local Port**: `5678`
   - **Container Port**: `5678`

4. **Advanced Settings (Environment Variables)** (Optional but recommended):
   - `GENERIC_TIMEZONE` = `Asia/Yangon`
   - `TZ` = `Asia/Yangon`

5. Click **Next** -> **Done** to launch n8n!
6. Open your browser and go to `http://YOUR_NAS_IP:5678` to set up your owner account.

---

## 🌐 Step 2: Connect n8n to your Live Cloudflare Worker

Since n8n is now running on the NAS and your PC might be off, you **cannot** use `http://127.0.0.1:8787` anymore. You must point n8n to your deployed, live Cloudflare Worker URL.

### 1. Find your live Worker URL

If you haven't deployed your worker recently, run this command on your PC to push the latest external APIs to the live server:

```bash
npx wrangler deploy
```

Wrangler will output your live URL (e.g., `https://cctv-service-system.yourname.workers.dev`).

### 2. Update your n8n HTTP Request Nodes

In your n8n workflows on the NAS, change the URLs in the HTTP Request nodes to use your live production URL:

**To check stock:**

- **URL**: `https://cctv-service-system.yourname.workers.dev/api/external/inventory/search?q={{ $json.product }}`

**To create a ticket:**

- **URL**: `https://cctv-service-system.yourname.workers.dev/api/external/jobs/create`

---

## 🌍 Step 3: Exposing n8n to the Internet (For Facebook Webhooks)

If you are using the **Facebook Messenger Trigger node**, Facebook requires a secure, public `https://` address to send the messages to n8n. Your NAS's local IP (`192.168...`) will not work for Facebook.

To solve this securely without opening router ports, you can run a **Cloudflare Tunnel** right next to n8n on your Synology NAS!

1. Open your existing **Cloudflare Zero Trust** dashboard.
2. Go to **Networks** -> **Tunnels** and edit your NAS tunnel (or create a new one).
3. Go to the **Public Hostname** tab and click **Add a public hostname**.
4. Set it up like this:
   - **Subdomain**: `n8n` (or whatever you prefer)
   - **Domain**: Your domain (e.g., `awesomemyanmar.com`)
   - **Service Type**: `HTTP`
   - **URL**: `YOUR_NAS_IP:5678` (e.g., `192.168.1.100:5678`)

5. Save the hostname.

### Final Step in n8n

Now n8n is securely accessible from the internet at `https://n8n.awesomemyanmar.com`.
You need to tell n8n what its public URL is so it can generate the correct webhook URLs for Facebook.

Stop your `n8n-automation` container in Container Manager, go to **Settings -> Environment**, and add this variable:

- `WEBHOOK_URL` = `https://n8n.awesomemyanmar.com/`

Start the container again. Now, when you add a Facebook Trigger node, it will generate a public webhook URL that Facebook can successfully reach!
