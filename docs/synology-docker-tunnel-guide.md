# 🐳 Step-by-Step Guide: Cloudflare Tunnel on Synology NAS Docker

This guide walks you through running a Cloudflare Tunnel inside **Synology Container Manager (Docker)**. This connects your local NAS bridge service securely to your Cloudflare Worker without exposing ports or opening firewall rules on your office router.

---

## 🔑 Step 1: Create a Tunnel in Cloudflare Zero Trust

Before configuring your Synology NAS, you need to create the tunnel and obtain your unique secure Token from Cloudflare:

1. Log in to your **[Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/)**.
2. Navigate to **Networks** $\rightarrow$ **Tunnels** in the left sidebar.
3. Click **Add a tunnel**.
4. Select **Cloudflared** (connector type) and click **Next**.
5. Name your tunnel (e.g., `synology-nas-bridge`) and click **Save tunnel**.
6. Cloudflare will display install commands for different platforms. Locate the **Docker** tab.
7. Copy only the long token string at the end of the command. It looks like:
   `eyJhIjoi...` (Copy this token; you will need it in Step 3).

---

## 🛠️ Step 2: Install Container Manager on Synology DSM

If you don't have Docker installed on your Synology NAS:

1. Log in to your **Synology DSM** administration page.
2. Open the **Package Center**.
3. Search for **Container Manager** (this is the new name for the official Docker package on DSM 7.2+).
4. Click **Install**.

---

## 🐳 Step 3: Run the Cloudflared Container

1. Open **Container Manager** on your Synology NAS.
2. Go to **Registry** in the left menu, search for `cloudflare/cloudflared`, and download the `latest` image.
3. Once downloaded, go to **Image**, select `cloudflare/cloudflared:latest`, and click **Launch** (or **Create Container**).
4. **General Settings**:
   - **Container Name**: `cloudflare-tunnel`
   - Check **Enable auto-restart** (Critical: This ensures the tunnel automatically starts back up if your NAS restarts).
   - Click **Next**.
5. **Advanced Settings**:
   - Scroll down to **Execution Command** (or Entrypoint/Arguments).
   - In the command arguments, replace the default settings with the following:
     ```bash
     tunnel --no-autoupdate run --token YOUR_CLOUDFLARE_TUNNEL_TOKEN
     ```
     _(Make sure to replace `YOUR_CLOUDFLARE_TUNNEL_TOKEN` with the exact token you copied in Step 1)._
   - **Network**: Select `bridge` (default) or `host`.
6. Click **Next**, review the settings, and click **Done** to start the container.

---

## 🌐 Step 4: Configure Hostname Routing in Zero Trust

Now that the container is running and connected, you need to route traffic from your domain to the local bridge service:

1. Return to the **Cloudflare Zero Trust Tunnels** page. You should now see your tunnel status as **HEALTHY (Active)**.
2. Click **Edit** next to your tunnel.
3. Go to the **Public Hostname** tab.
4. Click **Add a public hostname**.
5. Fill out the routing details:
   - **Subdomain**: `nas-bridge` (or whatever you prefer)
   - **Domain**: Select your domain (e.g., `awesomemyanmar.com`)
   - **Service Type**: `HTTP`
   - **URL**: The local IP address of your Synology NAS and the port running your NAS bridge service (e.g., `192.168.1.100:3010`).
6. Click **Save hostname**.

> [!TIP]
> **What if I don't own a custom domain?**
>
> - **Free Option (Quick Tunnel)**: Skip Step 1 and Step 4. Run the Docker container command as: `tunnel --url http://YOUR_NAS_IP:3010`. In the container's log tab, look for the generated `.trycloudflare.com` link. (Note: This link changes every time you restart the container).
> - **Permanent Option (Recommended)**: Buy a cheap domain on Cloudflare Registrar (e.g. `.xyz` or `.online` domains cost about $2–$5/year) to get a static, permanent address.

---

## ⚙️ Step 5: Update Worker Environment

Finally, update your system configuration so the worker routes photo uploads to this new secure tunnel endpoint:

- **For Local Testing**:
  Add it to your [`.dev.vars`](file:///d:/kosai-project/v2/.dev.vars) file:
  ```env
  LOCAL_NAS_BRIDGE_URL="https://nas-bridge.awesomemyanmar.com"
  ```
- **For Production (Live)**:
  Run this command in your terminal to save it as a secure secret on Cloudflare:
  ```bash
  npx wrangler secret put LOCAL_NAS_BRIDGE_URL
  ```
  When prompted, enter: `https://nas-bridge.awesomemyanmar.com`

---

# 🌀 Alternative Option B: Setup static URL with NGROK (Free & Permanent)

If you don't own a domain, **ngrok** is the best option because they provide **one free permanent subdomain** (e.g. `https://your-custom-name.ngrok-free.app`).

### 1. Claim your Free Subdomain

1. Create a free account at **[ngrok.com](https://ngrok.com/)**.
2. Go to your ngrok dashboard:
   - Copy your **Authtoken**.
   - Go to **Cloud Edge** $\rightarrow$ **Domains** and click **Create Domain** to claim your free permanent subdomain (e.g., `awesome-nas.ngrok-free.app`).

### 2. Launch the Docker Container on Synology

1. Open **Container Manager** on your Synology NAS.
2. Under **Registry**, search for `ngrok/ngrok` and download it.
3. Launch the container and add these settings:
   - **Environment Variables**: Add `NGROK_AUTHTOKEN` and paste your copied token as the value.
   - **Execution Command**: Change the command to:
     ```bash
     http 192.168.1.100:3010 --domain=your-custom-name.ngrok-free.app
     ```
     _(Replace `192.168.1.100` with your Synology IP, and use your claimed subdomain)._
4. Start the container. Your static URL is now active!

---

# ⚡ Alternative Option C: Pinggy (Zero-Install SSH Tunnel)

If you want a quick tunnel without downloading containers or registering domains, **Pinggy** runs directly over plain SSH:

1. SSH into your Synology NAS (or run this command on the server hosting the NAS bridge):
   ```bash
   ssh -R 80:localhost:3010 a.pinggy.io
   ```
2. The command will instantly output a public URL (e.g., `https://random-id.pinggy.link`).
3. Enter this link as your `LOCAL_NAS_BRIDGE_URL`.
   _(Note: Pinggy free URLs will rotate if the SSH connection is interrupted)._

---

# 🛡️ Alternative Option D: Tailscale Funnel (Free, Permanent, and Native)

If you use Tailscale to access your Synology NAS, you can use **Tailscale Funnel** to expose the NAS bridge port to the internet with a permanent HTTPS address.

### 1. Enable Funnel in Tailscale Admin

1. Go to your **[Tailscale Admin Console](https://login.tailscale.com/)**.
2. Navigate to **Access Control** and ensure you have enabled node attribute funneling (normally enabled by default).

### 2. Run the Funnel Command on your Synology NAS

1. SSH into your Synology NAS as administrator.
2. Run the following commands to forward and open the port to the public internet:
   ```bash
   tailscale serve http://localhost:3010
   tailscale funnel 3010 on
   ```
3. Your permanent URL will be:
   `https://your-nas-hostname.your-tailnet.ts.net`

---

# 🦀 Alternative Option E: Bore (Minimalist Rust Tunnel)

`bore` is a lightweight open-source TCP tunnel with zero configuration.

1. Run the `bore` container in Synology Docker (Registry search: `m1guelpf/bore`).
2. Set the container execution command to:
   ```bash
   local 3010 --to bore.pub
   ```
3. Look at your container logs to see the allocated public port (e.g., `bore.pub:34852`).

---

# 🔒 Alternative Option F: Zrok (Next-Gen Open-Source Tunnel)

`zrok` is a security-focused open-source sharing platform.

1. Sign up for a free invite at **[zrok.io](https://zrok.io/)**.
2. Run the docker container `openziti/zrok`.
3. Run the container command to enable sharing:
   ```bash
   share public http://192.168.1.100:3010
   ```
