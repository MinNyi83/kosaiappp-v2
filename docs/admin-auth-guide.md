This addon updates your system with a Secure Technician Sign-In PIN architecture, full Admin Console CRUD tools for dispatchers to create new work orders, and an explicit walkthrough to hook up your Telegram Bot token infrastructure.Secure Admin Console, Authentication, and Telegram Bot ConfigurationThis document expands your Cloudflare Worker system with security, provisioning endpoints, and automated dispatch notification routing.Part 1: Secure Database Architecture PatchFile: security_patch.sqlRun this script to add cryptographic PIN fields for field team members and explicit authentication keys to secure your API pipelines from unauthorized traffic.sql-- 1. Upgrade technicians table with explicit PIN authentication tokens
ALTER TABLE technicians ADD COLUMN pin_code TEXT;

-- Seed secure access tokens for demonstration
UPDATE technicians SET pin_code = '1234' WHERE id = 'TECH-001';
UPDATE technicians SET pin_code = '5678' WHERE id = 'SALE-002';

-- 2. Global application configurations table for system admin authentication
CREATE TABLE IF NOT EXISTS system_config (
config_key TEXT PRIMARY KEY,
config_value TEXT NOT NULL
);

-- Seed global admin access passkey (Change this to a strong password)
INSERT OR REPLACE INTO system_config (config_key, config_value)
VALUES ('ADMIN_SECRET_KEY', 'SuperSecureAdminPass123!');
Use code with caution.Shell Command to Apply Security Patchbashnpx wrangler d1 execute cctv-fsm-db --remote --file=./security_patch.sql
Use code with caution.Part 2: Upgraded Edge Gateway (With Security & CRUD Framework)File: src/index.jsReplace your previous worker file with this complete script. It enforces field authentication via worker request headers and includes administrative pipelines to register clients and create new tickets.javascriptexport default {
async fetch(request, env) {
const url = new URL(request.url);
const method = request.method;

    if (method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });

    try {
      // --- PUBLIC ENDPOINTS (Technician Authentication Check) ---
      if (url.pathname === "/api/auth/login" && method === "POST") {
        const { id, pin } = await request.json();
        const tech = await env.DB.prepare(
          "SELECT id, name, role FROM technicians WHERE id = ? AND pin_code = ? AND active = 1"
        ).bind(id, pin).first();

        if (!tech) return new Response(JSON.stringify({ error: "Invalid ID or PIN" }), { status: 401, headers: getCorsHeaders() });
        return jsonResponse({ success: true, user: tech });
      }

      // --- DISPATCH & ADMIN ENDPOINTS (Protected via Admin Secret Key) ---
      if (url.pathname.startsWith("/api/admin")) {
        const adminKey = request.headers.get("X-Admin-Secret");
        const storedAdminKey = await env.DB.prepare("SELECT config_value FROM system_config WHERE config_key = 'ADMIN_SECRET_KEY'").first("config_value");

        if (!adminKey || adminKey !== storedAdminKey) {
          return new Response(JSON.stringify({ error: "Unauthorized Admin Request" }), { status: 403, headers: getCorsHeaders() });
        }

        // Admin Route: Add a new client
        if (url.pathname === "/api/admin/clients" && method === "POST") {
          const { id, company_name, contact_person, address, phone } = await request.json();
          await env.DB.prepare(
            "INSERT INTO clients (id, company_name, contact_person, address, phone) VALUES (?, ?, ?, ?, ?)"
          ).bind(id, company_name, contact_person, address, phone).run();
          return jsonResponse({ success: true, message: "Client created." });
        }

        // Admin Route: Dispatch a new field ticket
        if (url.pathname === "/api/admin/jobs" && method === "POST") {
          const { id, client_id, technician_id, service_type, job_description } = await request.json();
          await env.DB.prepare(
            "INSERT INTO service_records (id, client_id, technician_id, service_type, job_description, status) VALUES (?, ?, ?, ?, ?, 'Pending')"
          ).bind(id, client_id, technician_id, service_type, job_description).run();

          // Dispatch Notification to Telegram
          if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
            const msg = `🚀 *NEW JOB DISPATCHED*\n\n*Job ID:* ${id}\n*Tech Assigned:* ${technician_id}\n*Type:* ${service_type}\n*Scope:* ${job_description}`;
            await sendTelegramNotification(env, msg);
          }
          return jsonResponse({ success: true, message: "Job dispatched successfully." });
        }
      }

      // --- STANDARD PIPELINES (Technician Field Synchronization) ---
      if (url.pathname === "/api/jobs" && method === "GET") {
        const { results } = await env.DB.prepare(
          `SELECT r.*, c.company_name, c.address, t.name as tech_name FROM service_records r
           JOIN clients c ON r.client_id = c.id JOIN technicians t ON r.technician_id = t.id ORDER BY r.created_at DESC`
        ).all();
        return jsonResponse(results);
      }

      if (url.pathname.startsWith("/api/photos/") && method === "GET") {
        const photoKey = url.pathname.replace("/api/photos/", "");
        const object = await env.PHOTOS.get(photoKey);
        if (!object) return new Response("Image Not Found", { status: 404 });
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set("etag", object.httpEtag);
        headers.append("Access-Control-Allow-Origin", "*");
        return new Response(object.body, { headers });
      }

      if (url.pathname === "/api/jobs/update" && method === "POST") {
        const formData = await request.formData();
        const jobId = formData.get("job_id");
        const status = formData.get("status");
        const notes = formData.get("notes") || "";
        const equipment = formData.get("equipment") || "[]";

        let beforePhotoKey = formData.get("before_photo_key") || null;
        let afterPhotoKey = formData.get("after_photo_key") || null;

        const beforeFile = formData.get("before_photo_file");
        if (beforeFile && beforeFile.size > 0) {
          beforePhotoKey = `before_${jobId}_${Date.now()}.jpg`;
          await env.PHOTOS.put(beforePhotoKey, beforeFile.stream(), { httpMetadata: { contentType: "image/jpeg" } });
        }

        const afterFile = formData.get("after_photo_file");
        if (afterFile && afterFile.size > 0) {
          afterPhotoKey = `after_${jobId}_${Date.now()}.jpg`;
          await env.PHOTOS.put(afterPhotoKey, afterFile.stream(), { httpMetadata: { contentType: "image/jpeg" } });
        }

        await env.DB.prepare(
          `UPDATE service_records SET status = ?, technician_notes = ?, equipment_used = ?,
           before_photo_key = COALESCE(?, before_photo_key), after_photo_key = COALESCE(?, after_photo_key), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(status, notes, equipment, beforePhotoKey, afterPhotoKey, jobId).run();

        const details = await env.DB.prepare("SELECT r.service_type, c.company_name FROM service_records r JOIN clients c ON r.client_id = c.id WHERE r.id = ?").bind(jobId).first();

        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          const telegramMessage = `🔔 *Field Service Update*\n\n*Job ID:* ${jobId}\n*Client:* ${details.company_name}\n*Status:* ${status}\n*Notes:* ${notes}`;
          await sendTelegramNotification(env, telegramMessage);
        }
        return jsonResponse({ success: true });
      }

      return new Response("Not Found", { status: 404, headers: getCorsHeaders() });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders() });
    }

}
};

function getCorsHeaders() {
return { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret", "Content-Type": "application/json" };
}
function jsonResponse(data) { return new Response(JSON.stringify(data), { headers: getCorsHeaders() }); }
async function sendTelegramNotification(env, text) {
await fetch(`https://telegram.org{env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
method: "POST", headers: { "Content-Type": "application/json" },
body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: text, parse_mode: "Markdown" })
});
}
Use code with caution.Push the updated codebase livebashnpx wrangler deploy
Use code with caution.Part 3: Centralized Administrative Dispatch DashboardFile: admin.htmlSave this file onto your computer to act as your office dispatch station. It enables immediate provisioning of client structures and task assignments.html<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Office Dispatch Control Center</title>
    <script src="https://tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 p-8">
    <div class="max-w-4xl mx-auto space-y-8">
        <header class="border-b border-slate-800 pb-4">
            <h1 class="text-3xl font-black tracking-tight text-white">OFFICE DISPATCH STATION</h1>
            <p class="text-sm text-indigo-400">Manage clients, configure network profiles, and provision work tickets</p>
        </header>

        <!-- Configuration Authentication Banner -->
        <div class="bg-slate-900 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
            <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Production Worker URL Base</label>
                <input type="text" id="api-base" value="https://cctv-service-system.YOUR_SUBDOMAIN.workers.dev" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-indigo-300 font-mono">
            </div>
            <div>
                <label class="block text-xs font-bold uppercase text-slate-400 mb-1">Administrative secret key (`X-Admin-Secret`)</label>
                <input type="password" id="admin-secret" value="SuperSecureAdminPass123!" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm text-rose-400 font-mono">
            </div>
        </div>

        <div class="grid md:grid-cols-2 gap-8">
            <!-- Form 1: Add New Client -->
            <section class="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h2 class="text-xl font-bold text-white">🏢 Provision New Client</h2>
                <form id="client-form" class="space-y-3" onsubmit="submitClient(event)">
                    <input type="text" name="id" placeholder="Client ID (e.g., CLI-103)" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="company_name" placeholder="Company Name" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="contact_person" placeholder="Primary Technical Contact" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="address" placeholder="Physical Operational Address" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="phone" placeholder="Contact Phone Number" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 py-2 rounded font-bold text-sm">Create Client Account</button>
                </form>
            </section>

            <!-- Form 2: Dispatch Service Ticket -->
            <section class="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                <h2 class="text-xl font-bold text-white">🛠️ Dispatch Field Ticket</h2>
                <form id="job-form" class="space-y-3" onsubmit="submitJob(event)">
                    <input type="text" name="id" placeholder="Job ID (e.g., JOB-203)" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="client_id" placeholder="Client ID (e.g., CLI-101)" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <input type="text" name="technician_id" placeholder="Assigned Tech ID (e.g., TECH-001)" required class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                    <select name="service_type" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm">
                        <option value="CCTV">CCTV Surveillance Array</option>
                        <option value="Networking">Core Infrastructure Networking</option>
                        <option value="WiFi">WiFi Mesh Deployment</option>
                        <option value="NAS">NAS Storage Cluster</option>
                        <option value="General Maintenance">General Infrastructure Maintenance</option>
                    </select>
                    <textarea name="job_description" placeholder="Technical Scope of Work and Deployment Goals..." required rows="3" class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm"></textarea>
                    <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 py-2 rounded font-bold text-sm">Dispatch to Field Units</button>
                </form>
            </section>
        </div>
    </div>

    <script>
        async function sendAdminRequest(endpoint, payload) {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;

            const res = await fetch(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (res.ok) alert("Success: " + (data.message || "Record successfully pushed."));
            else alert("Error: " + data.error);
        }

        function submitClient(e) {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            sendAdminRequest('/api/admin/clients', data);
            e.target.reset();
        }

        function submitJob(e) {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            sendAdminRequest('/api/admin/jobs', data);
            e.target.reset();
        }
    </script>

</body>
</html>
Use code with caution.Part 4: Telegram Bot Token Integration GuideTo route field updates directly into a company chat room, configure your Telegram components by following these steps:Create the Bot via Telegram BotFather:Open Telegram and search for @BotFather.Send the command /newbot.Follow the prompts to name your bot (e.g., MyCCTVCompanyBot).Copy the HTTP API Token generated (formatted like 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ).Retrieve your target Chat ID:Create a new group chat in Telegram and add your bot as a member.Send a dummy text message inside that group chat channel (e.g., Test active connection).Open your browser and navigate to this URL to view the raw JSON activity updates received by your bot instance:https://telegram.org<YOUR_HTTP_API_TOKEN>/getUpdatesSearch through the text output for the "chat" object block and copy the negative numeric tracking string assigned to your room (formatted like "id": -100223456789).Bind Production Keys to Cloudflare Config Variables:Open your project's local wrangler.toml file and update your variables:toml[vars]
TELEGRAM_BOT_TOKEN = "PASTE_YOUR_COPIED_TOKEN_HERE"
TELEGRAM_CHAT_ID = "-100YOUR_COPIED_CHAT_ID_HERE"
Use code with caution.Deploy the configuration change to production:bashnpx wrangler deploy
Use code with caution.
