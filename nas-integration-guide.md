# 📁 NAS SMB Integration Setup Guide (Option A)

This guide walks you through setting up the local bridge and Cloudflare Tunnel to save technician uploads directly onto your private office NAS.

---

## 🛠️ Step 1: Run the Local Bridge Service
The local bridge is a lightweight Node.js service that runs inside your office network (on a PC or server that has access to the NAS SMB share).

1. Open your terminal in the project directory.
2. Install the bridge dependencies:
   ```bash
   npm install express multer
   ```
3. Open [**`local-nas-bridge.js`**](file:///d:/kosai-project/v2/local-nas-bridge.js) and update the `NAS_MOUNT_PATH` variable (line 11) to point to your mounted NAS drive or network SMB path:
   * **Windows Network Path**: `\\\\192.168.1.100\\your-share-name`
   * **Linux/Mac Mount Path**: `/mnt/nas/photos`
4. Start the bridge service:
   ```bash
   node local-nas-bridge.js
   ```
   *You should see:* `🚀 Local NAS Bridge Service running on port 3010`

---

## ☁️ Step 2: Configure Cloudflare Tunnel (Tunneling through Firewall)
To let your Cloudflare Worker send files to this local service without opening port forwards on your router:

1. **Install cloudflared**: Download and install the Cloudflare Tunnel daemon on the same computer:
   * [Cloudflare Tunnel Download Link](https://github.com/cloudflare/cloudflared/releases)
2. **Expose port 3010**: Run the following command to create a quick, secure public tunnel:
   ```bash
   cloudflared tunnel --url http://localhost:3010
   ```
3. Cloudflare will output a unique public URL, for example:
   `https://some-random-subdomain.trycloudflare.com`

---

## ⚙️ Step 3: Bind the Tunnel URL to your Worker
1. Copy the public `.trycloudflare.com` URL generated in Step 2.
2. Store it in your worker environment configuration. 
   * **Local development**: Add it to [**`.dev.vars`**](file:///d:/kosai-project/v2/.dev.vars):
     ```env
     LOCAL_NAS_BRIDGE_URL="https://some-random-subdomain.trycloudflare.com"
     ```
   * **Production**: Save it as a worker secret:
     ```bash
     npx wrangler secret put LOCAL_NAS_BRIDGE_URL
     ```

---

## 💾 Step 4: Worker Code Integration
Now, inside the Worker `fetch()` handler, whenever a technician uploads a photo (e.g. `/api/technician/upload`), the worker will automatically duplicate or route the stream over the tunnel:

```javascript
// Forward stream example in Worker
if (env.LOCAL_NAS_BRIDGE_URL) {
  const formData = new FormData();
  formData.append('photo', uploadedFileBlob, 'photo.jpg');

  await fetch(`${env.LOCAL_NAS_BRIDGE_URL}/upload-to-nas`, {
    method: 'POST',
    body: formData
  });
}
```
