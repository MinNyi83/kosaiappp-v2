It contains your entire production-ready system architecture: database schemas, photo storage configurations, Telegram bot logic, web frontends, and testing datasets.Complete CCTV & Network Field Service Deployment GuideThis single document contains all necessary scripts, code, and deployment configurations to launch an end-to-end Field Service Management (FSM) system on Cloudflare.System CapabilitiesCloudflare Workers & D1: Handles JSON API endpoints and relational data for clients, technicians, and work orders.Cloudflare R2: Securely hosts high-resolution before/after deployment site photos directly from the field.Telegram Bot Routing: Sends instantaneous, automated text and photo notifications directly to a technician dispatch chat room.Mobile Web Application: A zero-install, single-file HTML5 interface optimized for smartphones, featuring camera capture capabilities.Part 1: Project Initialization & Cloudflare SettingsRun these terminal commands to initialize the directory layout and provisioning profiles on Cloudflare.bash# 1. Initialize the worker application
npm create cloudflare@latest cctv-service-system -- --type=worker --lang=js
cd cctv-service-system

# 2. Provision serverless storage engines
npx wrangler d1 create cctv-fsm-db
npx wrangler r2 bucket create cctv-fsm-photos
Use code with caution.File: wrangler.tomlReplace the entire contents of your generated wrangler.toml file with this centralized configuration module. Ensure you insert your unique database ID string.tomlname = "cctv-service-system"
main = "src/index.js"
compatibility_date = "2026-07-04"

[[d1_databases]]
binding = "DB"
database_name = "cctv-fsm-db"
database_id = "PASTE_YOUR_D1_DATABASE_ID_HERE"

[[r2_buckets]]
binding = "PHOTOS"
bucket_name = "cctv-fsm-photos"

[vars]
TELEGRAM_BOT_TOKEN = "PASTE_YOUR_TELEGRAM_BOT_TOKEN_HERE"
TELEGRAM_CHAT_ID = "PASTE_YOUR_TELEGRAM_CHAT_ID_OR_CHANNEL_ID"
Use code with caution.Part 2: Relational Database Architecture & Testing SuiteFile: schema.sqlSave this relational database design schema. It maintains strict referential constraints while supporting unstructured data fields via JSON arrays.sqlDROP TABLE IF EXISTS service_records;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS technicians;

CREATE TABLE technicians (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT CHECK(role IN ('Sales', 'Technician', 'Admin')) NOT NULL,
    phone TEXT,
    active INTEGER DEFAULT 1
);

CREATE TABLE clients (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    address TEXT NOT NULL,
    phone TEXT
);

CREATE TABLE service_records (
    id TEXT PRIMARY KEY,
    client_id TEXT REFERENCES clients(id),
    technician_id TEXT REFERENCES technicians(id),
    service_type TEXT CHECK(service_type IN ('CCTV', 'Networking', 'WiFi', 'NAS', 'General Maintenance')) NOT NULL,
    status TEXT CHECK(status IN ('Pending', 'In Progress', 'Completed')) DEFAULT 'Pending',
    job_description TEXT NOT NULL,
    technician_notes TEXT,
    equipment_used TEXT,
    before_photo_key TEXT,
    after_photo_key TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
Use code with caution.File: mock_data.sqlSave this file to inject highly specific production testing records into your cluster.sqlINSERT INTO technicians (id, name, role, phone, active) VALUES 
('TECH-001', 'Alex Mercer', 'Technician', '+15550199', 1),
('SALE-002', 'Sarah Connor', 'Sales', '+15550188', 1);

INSERT INTO clients (id, company_name, contact_person, address, phone) VALUES 
('CLI-101', 'Apex Tech Solutions', 'John Doe', '100 Main St, Suite 400', '+15559999'),
('CLI-102', 'Omega Logistics Hub', 'Jane Smith', '750 Warehouse Blvd, Dock 4', '+15558888');

INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description, technician_notes, equipment_used) VALUES 
('JOB-201', 'CLI-101', 'TECH-001', 'NAS', 'In Progress', 'Migrate 4-bay Synology NAS array to RAID 6 and configure remote access.', 'Initial deployment complete. Data rebuilding is running smoothly.', '["4x 8TB Enterprise HDDs", "Cat6 Patch Cord 2m"]'),
('JOB-202', 'CLI-102', 'TECH-001', 'CCTV', 'Pending', 'Mount 4x external IP PoE cameras and update firmware on 16-channel NVR.', '', '[]');
Use code with caution.Shell Commands to Build Schema & Seed DataExecute these commands to apply your local definitions directly to the active remote instances:bashnpx wrangler d1 execute cctv-fsm-db --remote --file=./schema.sql
npx wrangler d1 execute cctv-fsm-db --remote --file=./mock_data.sql
Use code with caution.Part 3: Backend Gateway LogicFile: src/index.jsThis serverless runtime engine handles routing, parses multipart photo file uploads, interacts with storage systems, and dispatches data to Telegram pipelines.javascriptexport default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // Handle cross-origin isolation (CORS preflight checks)
    if (method === "OPTIONS") {
      return new Response(null, { headers: getCorsHeaders() });
    }

    try {
      // Endpoint: Fetch Active Jobs
      if (url.pathname === "/api/jobs" && method === "GET") {
        const { results } = await env.DB.prepare(
          `SELECT r.*, c.company_name, c.address, t.name as tech_name 
           FROM service_records r
           JOIN clients c ON r.client_id = c.id
           JOIN technicians t ON r.technician_id = t.id
           ORDER BY r.created_at DESC`
        ).all();
        return jsonResponse(results);
      }

      // Endpoint: Serves Photos back to front-end clients from R2 Buckets
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

      // Endpoint: Process Form Upgrades from Field Devices (Updates + Photo Uploads)
      if (url.pathname === "/api/jobs/update" && method === "POST") {
        const formData = await request.formData();
        const jobId = formData.get("job_id");
        const status = formData.get("status");
        const notes = formData.get("notes") || "";
        const equipment = formData.get("equipment") || "[]";
        
        if (!jobId || !status) {
          return new Response("Missing job_id or status components", { status: 400, headers: getCorsHeaders() });
        }

        let beforePhotoKey = formData.get("before_photo_key") || null;
        let afterPhotoKey = formData.get("after_photo_key") || null;

        // Process File Storage Layers for Uploaded Images
        const beforeFile = formData.get("before_photo_file");
        if (beforeFile && beforeFile.size > 0) {
          beforePhotoKey = `before_${jobId}_${Date.now()}.jpg`;
          await env.PHOTOS.put(beforePhotoKey, beforeFile.stream(), {
            httpMetadata: { contentType: "image/jpeg" }
          });
        }

        const afterFile = formData.get("after_photo_file");
        if (afterFile && afterFile.size > 0) {
          afterPhotoKey = `after_${jobId}_${Date.now()}.jpg`;
          await env.PHOTOS.put(afterPhotoKey, afterFile.stream(), {
            httpMetadata: { contentType: "image/jpeg" }
          });
        }

        // Persist records inside D1 Database
        await env.DB.prepare(
          `UPDATE service_records 
           SET status = ?, technician_notes = ?, equipment_used = ?, 
               before_photo_key = COALESCE(?, before_photo_key), 
               after_photo_key = COALESCE(?, after_photo_key), 
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = ?`
        ).bind(status, notes, equipment, beforePhotoKey, afterPhotoKey, jobId).run();

        // Query metadata details for formatting Telegram telemetry messages
        const details = await env.DB.prepare(
          `SELECT r.service_type, c.company_name FROM service_records r 
           JOIN clients c ON r.client_id = c.id WHERE r.id = ?`
        ).bind(jobId).first();

        // Dispatch alert to Telegram
        if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
          const telegramMessage = `🔔 *Field Service Update*\n\n*Job ID:* ${jobId}\n*Client:* ${details.company_name}\n*Type:* ${details.service_type}\n*Status:* ${status}\n\n*Tech Notes:* ${notes}\n*Equip:* ${equipment}`;
          await sendTelegramNotification(env, telegramMessage);
        }

        return jsonResponse({ success: true, message: "Field metrics synced successfully." });
      }

      return new Response("Route target not found", { status: 404, headers: getCorsHeaders() });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders() });
    }
  }
};

function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data), { headers: getCorsHeaders() });
}

async function sendTelegramNotification(env, text) {
  const url = `https://telegram.org{env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: text,
      parse_mode: "Markdown"
    })
  });
}
Use code with caution.Part 4: Production DeploymentDeploy your backend worker code to the global edge network using this command:bashnpx wrangler deploy
Use code with caution.Note down the live .workers.dev endpoint subdomain string printed to your terminal dashboard panel.Part 5: Single-File Mobile Operations Web InterfaceFile: app.htmlSave this HTML5 code as a local file or host it anywhere. Make sure to update the API_BASE_URL constant on line 12 with your live Cloudflare Worker URL to start managing field assignments, capturing site photos, and tracking hardware equipment in real time.html<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>IT & Security Field Operations</title>
    <script src="https://tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen font-sans">
    <script>
        // Replace this URL with your production Cloudflare Worker URL
        const API_BASE_URL = "https://cctv-service-system.YOUR_SUBDOMAIN.workers.dev";

        async function fetchJobs() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/jobs`);
                const jobs = await res.json();
                const container = document.getElementById('jobs-list');
                container.innerHTML = '';

                jobs.forEach(job => {
                    const card = document.createElement('div');
                    card.className = "bg-slate-800 p-5 rounded-xl border border-slate-700 shadow-xl space-y-4";
                    
                    let badgeColor = job.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 
                                     job.status === 'In Progress' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 
                                     'bg-blue-500/20 text-blue-400 border-blue-500/30';

                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <span class="text-xs font-mono px-2.5 py-1 rounded-full border ${badgeColor}">${job.status}</span>
                                <h3 class="text-lg font-bold mt-2 text-white">${job.company_name}</h3>
                                <p class="text-xs text-slate-400">${job.address}</p>
                            </div>
                            <span class="bg-indigo-600/30 text-indigo-300 text-xs font-semibold px-3 py-1 rounded border border-indigo-500/30">${job.service_type}</span>
                        </div>
                        <div class="text-sm border-l-2 border-slate-600 pl-3 py-1 bg-slate-850 rounded">
                            <strong class="text-xs uppercase tracking-wider text-slate-400 block">Scope of Work</strong>
                            <span class="text-slate-200">${job.job_description}</span>
                        </div>
                        <form onsubmit="updateJob(event, '${job.id}')" class="space-y-3 pt-2 border-t border-slate-700/60">
                            <div>
                                <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Status Transition</label>
                                <select name="status" class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                                    <option value="Pending" ${job.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="In Progress" ${job.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="Completed" ${job.status === 'Completed' ? 'selected' : ''}>Completed</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Technician Maintenance Logs</label>
                                <textarea name="notes" rows="2" placeholder="Describe diagnostic results or issues..." class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">${job.technician_notes || ''}</textarea>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase text-slate-400 mb-1">Equipment Used (JSON List)</label>
                                <input type="text" name="equipment" value='${job.equipment_used || "[]"}' class="w-full font-mono bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-indigo-300">
                            </div>
                            <div class="grid grid-cols-2 gap-2">
                                <div>
                                    <label class="block text-xs font-semibold text-slate-400 mb-1">📷 Before Photo</label>
                                    <input type="file" name="before_photo_file" accept="image/*" capture="environment" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600">
                                    ${job.before_photo_key ? `<a href="${API_BASE_URL}/api/photos/${job.before_photo_key}" target="_blank" class="text-xs text-indigo-400 underline mt-1 block">View Upload</a>` : ''}
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-slate-400 mb-1">📷 After Photo</label>
                                    <input type="file" name="after_photo_file" accept="image/*" capture="environment" class="w-full text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600">
                                    ${job.after_photo_key ? `<a href="${API_BASE_URL}/api/photos/${job.after_photo_key}" target="_blank" class="text-xs text-indigo-400 underline mt-1 block">View Upload</a>` : ''}
                                </div>
                            </div>
                            <button type="submit" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm transition-colors shadow-md">Sync Changes to Cloud</button>
                        </form>
                    `;
                    container.appendChild(card);
                });
            } catch (err) {
                alert("Error loading jobs dataset: " + err.message);
            }
        }

        async function updateJob(event, jobId) {
            event.preventDefault();
            const form = event.target;
            const formData = new FormData(form);
            formData.append("job_id", jobId);

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = "Syncing with Cloud Edge...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/jobs/update`, {
                    method: "POST",
                    body: formData
                });
                if (res.ok) {
                    alert("Changes securely pushed to edge cluster!");
                    fetchJobs();
                } else {
                    alert("Failed to sync records.");
                }
            } catch (err) {
                alert("Network communication error: " + err.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Sync Changes to Cloud";
            }
        }

        window.onload = fetchJobs;
    </script>

    <header class="bg-slate-950 border-b border-slate-800 p-4 sticky top-0 z-50 shadow-md">
        <div class="max-w-md mx-auto flex justify-between items-center">
            <div>
                <h1 class="text-xl font-black text-white tracking-wide">NET/CCTV FIELD SYSTEM</h1>
                <p class="text-xs text-indigo-400 font-medium">Cloudflare Workers Edge Node</p>
            </div>
            <button onclick="fetchJobs()" class="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition">
                🔄
            </button>
        </div>
    </header>

    <main class="max-w-md mx-auto p-4 space-y-6 pb-12" id="jobs-list">
        <div class="text-center py-12 text-slate-500">
            Initializing pipeline components...
        </div>
    </main>
</body>
</html>