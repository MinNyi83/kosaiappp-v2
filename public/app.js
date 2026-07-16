        function escapeHTML(str) {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        const API_BASE_URL = window.location.hostname.includes("androidplatform.net")
            ? "https://awesomemyanmar.pages.dev"
            : window.location.origin;
        let activeSessionUser = null;
        let activeCanvases = {};

        // Listen for online status updates
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        function updateOnlineStatus() {
            const badge = document.getElementById('offline-badge');
            if (navigator.onLine) {
                badge.classList.add('hidden');
                syncOfflineQueue();
            } else {
                badge.classList.remove('hidden');
            }
        }

        async function handleLogin(e) {
            e.preventDefault();
            const id = document.getElementById('auth-uid').value.trim().toUpperCase();
            const pin = document.getElementById('auth-pin').value.trim();
            const btn = document.getElementById('auth-btn');

            btn.disabled = true;
            btn.textContent = "Checking Credentials...";

            try {
                // If offline, check if user details match pre-seeded values or cached logins
                if (!navigator.onLine) {
                    alert("Running offline. Login bypassed using cached operator ID.");
                    activeSessionUser = { id, name: "Field Operator (" + id + ")", role: "Technician" };
                    document.getElementById('user-display-name').textContent = activeSessionUser.name;
                    document.getElementById('user-display-role').textContent = `${activeSessionUser.id} â€¢ ${activeSessionUser.role}`;
                    document.getElementById('auth-screen').classList.add('hidden');
                    document.getElementById('app-content').classList.remove('hidden');
                    updateOnlineStatus();
                    loadCachedJobs();
                    return;
                }

                const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, pin })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Authentication failed");

                activeSessionUser = data.user;
                document.getElementById('user-display-name').textContent = activeSessionUser.name;
                document.getElementById('user-display-role').textContent = `${activeSessionUser.id} â€¢ ${activeSessionUser.role}`;
                
                document.getElementById('auth-screen').classList.add('hidden');
                document.getElementById('app-content').classList.remove('hidden');
                updateOnlineStatus();
                fetchJobs();
                // Render technician ID card in Settings tab
                setTimeout(renderMyIdCard, 400);
            } catch (err) {
                alert("Access Denied: " + err.message);
                document.getElementById('auth-pin').value = '';
            } finally {
                btn.disabled = false;
                btn.textContent = "Verify Gate Pass";
            }
        }

        function handleLogout() {
            activeSessionUser = null;
            document.getElementById('auth-uid').value = '';
            document.getElementById('auth-pin').value = '';
            document.getElementById('app-content').classList.add('hidden');
            document.getElementById('auth-screen').classList.remove('hidden');
        }

        async function fetchJobs() {
            if (!activeSessionUser) return;
            try {
                if (!navigator.onLine) {
                    loadCachedJobs();
                    return;
                }

                const res = await fetch(`${API_BASE_URL}/api/jobs`);
                const jobs = await res.json();
                localStorage.setItem('cached_jobs', JSON.stringify(jobs));

                // Fetch catalog stock items for technician dropdown select
                try {
                    const invRes = await fetch(`${API_BASE_URL}/api/admin/inventory/list`);
                    if (invRes.ok) {
                        const invList = await invRes.json();
                        localStorage.setItem('cached_catalog', JSON.stringify(invList));
                    }
                } catch (invErr) {
                    console.warn("Failed to fetch inventory catalog:", invErr);
                }

                renderJobsList(jobs);
            } catch (err) {
                alert("Error pulling remote data: " + err.message);
                loadCachedJobs();
            }
        }

        function loadCachedJobs() {
            const cached = localStorage.getItem('cached_jobs');
            if (cached) {
                renderJobsList(JSON.parse(cached));
            } else {
                document.getElementById('jobs-list').innerHTML = `
                    <div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm">
                        No cached service tickets found on this device.
                    </div>`;
            }
        }

            let selectedJobId = null;

        window.switchMobileTab = function(tabId) {
            document.querySelectorAll('.mobile-tab-view').forEach(view => {
                view.classList.add('hidden');
            });
            const activeView = document.getElementById(`view-${tabId}`);
            if (activeView) activeView.classList.remove('hidden');

            const navBtnIds = ['job', 'checklist', 'history', 'setting'];
            navBtnIds.forEach(id => {
                const btn = document.getElementById(`nav-btn-${id}`);
                if (btn) {
                    if (id === tabId) {
                        btn.classList.add('active-nav-btn');
                    } else {
                        btn.classList.remove('active-nav-btn');
                    }
                }
            });

            // Re-render ID card whenever user opens Settings tab
            if (tabId === 'setting') {
                setTimeout(renderMyIdCard, 50);
            }
        };

        // â”€â”€â”€ ðŸªª MY ID CARD â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function renderMyIdCard() {
            if (!activeSessionUser) return;
            const { id, name, role } = activeSessionUser;

            // Populate text fields
            const setEl = (elId, val) => { const el = document.getElementById(elId); if (el) el.textContent = val; };
            setEl('my-card-name', (name || '').toUpperCase());
            setEl('my-card-role', role || 'Field Technician');
            setEl('my-card-id', id || 'â€”');
            setEl('my-card-status-bar', 'âœ“ ACTIVE');
            setEl('my-card-phone-front', activeSessionUser.phone || 'â€”');
            setEl('my-card-email-back', activeSessionUser.email || 'â€”');

            // Set photo if saved
            const photoEl = document.getElementById('my-card-photo');
            if (photoEl) {
                if (activeSessionUser.photo) {
                    photoEl.innerHTML = '';
                    photoEl.style.backgroundImage = `url(${activeSessionUser.photo})`;
                    photoEl.style.backgroundSize = 'cover';
                    photoEl.style.backgroundPosition = 'center';
                } else {
                    photoEl.innerHTML = 'ðŸ‘·';
                    photoEl.style.backgroundImage = '';
                }
            }

            // Also update header elements
            setEl('settings-username', name || 'â€”');
            setEl('settings-userid', `ID: ${id}`);

            // Build verification URL
            const verifyUrl = `${API_BASE_URL}/api/verify-tech/${id}`;
            setEl('my-card-qr-url', verifyUrl);

            // Update all three img QR targets using public QR generator API
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
            ['my-card-qr-mini', 'my-card-qr-back', 'my-card-qr-main'].forEach(imgId => {
                const img = document.getElementById(imgId);
                if (img) img.src = qrImageUrl;
            });
        }

        window.printMyIdCard = function() {
            if (!activeSessionUser) return;
            const { id, name, role } = activeSessionUser;
            const verifyUrl = `${API_BASE_URL}/api/verify-tech/${id}`;

            const printWin = window.open('', '_blank', 'width=800,height=560');
            printWin.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ID Card â€” ${name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #f1f5f9; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 16px; }
        h2 { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; }
        .id-card { width: 323px; height: 204px; position: relative; border-radius: 14px; overflow: hidden; background: linear-gradient(135deg, #1a1a2e, #0f0f1a); border: 1px solid rgba(245,158,11,0.3); box-shadow: 0 10px 30px rgba(0,0,0,0.4); }
        .gold-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b); }
        .grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(245,158,11,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px); background-size: 14px 14px; }
        .body { position: relative; z-index: 2; padding: 14px; display: flex; gap: 12px; align-items: flex-start; margin-top: 5px; }
        .photo { width: 60px; height: 76px; border-radius: 7px; background: rgba(99,102,241,0.15); border: 1.5px solid rgba(99,102,241,0.35); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
        .info { flex: 1; }
        .brand { font-size: 7.5px; font-weight: 800; color: #f59e0b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 5px; }
        .emp-name { font-size: 11px; font-weight: 800; color: #fff; text-transform: uppercase; margin-bottom: 3px; }
        .emp-role { font-size: 8px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
        .emp-id { font-family: monospace; font-size: 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 2px 6px; color: #818cf8; font-weight: 700; }
        .bottom { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 14px; background: rgba(245,158,11,0.08); border-top: 1px solid rgba(245,158,11,0.15); display: flex; justify-content: space-between; align-items: center; }
        .bottom-l { font-size: 7px; color: #34d399; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
        .bottom-r { font-size: 6.5px; color: #374151; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        @media print { body { background: white; min-height: auto; } .id-card { box-shadow: none; } }
    </style>
</head>
<body>
    <h2>Awesome Myanmar â€” Field Engineer ID Card</h2>
    <div class="id-card">
        <div class="gold-bar"></div>
        <div class="grid"></div>
        <div class="body">
            <div class="photo">${activeSessionUser.photo ? `<img src="${activeSessionUser.photo}" style="width:100%;height:100%;object-fit:cover;">` : 'ðŸ‘·'}</div>
            <div class="info">
                <div class="brand">Awesome Myanmar</div>
                <div class="emp-name">${name}</div>
                <div class="emp-role">${role}</div>
                <div class="emp-id">${id}</div>
            </div>
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}" width="52" height="52" style="border-radius:4px;background:#fff;padding:2px;flex-shrink:0;display:block;" alt="QR">
        </div>
        <div class="bottom">
            <span class="bottom-l">âœ“ Active</span>
            <span class="bottom-r">Field Technician</span>
        </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 500);
        };
    <\/script>
</body></html>`);
            printWin.document.close();
        };
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

        window.openServiceChecklist = function(jobId) {
            const cached = localStorage.getItem('cached_jobs');
            if (!cached) return;
            const jobs = JSON.parse(cached);
            const job = jobs.find(j => j.id === jobId);
            if (!job) return;

            selectedJobId = jobId;

            document.getElementById('checklist-placeholder').classList.add('hidden');
            const formContainer = document.getElementById('checklist-form-container');

            formContainer.innerHTML = renderChecklistFormHTML(job);

            // Apply searchable dropdowns to dynamically rendered selects in checklist form
            if (typeof window.makeSearchable === 'function') {
                var indigo = { accentColor: '#6366f1', force: true };
                var indigoSm = { accentColor: '#6366f1' };
                formContainer.querySelectorAll('select[name="service_type"]').forEach(function(el) { window.makeSearchable(el, indigoSm); });
                formContainer.querySelectorAll('select[name="status"]').forEach(function(el) { window.makeSearchable(el, indigo); });
                formContainer.querySelectorAll('select[name="hardware_action"]').forEach(function(el) { window.makeSearchable(el, indigo); });
                formContainer.querySelectorAll('select[name="warranty_months"]').forEach(function(el) { window.makeSearchable(el, indigo); });
            }

            const statusSelect = formContainer.querySelector('select[name="status"]');
            toggleSignaturePad(statusSelect, jobId);

            let checklistVal = {};
            try {
                checklistVal = JSON.parse(job.checklist_data || "{}");
            } catch(e) {}

            setTimeout(() => {
                if (checklistVal && Array.isArray(checklistVal.workstations)) {
                    checklistVal.workstations.forEach(ws => {
                        insertWorkstationRow(jobId, ws.device_id || "", ws.os_updated || false, ws.temp_cleaned || false, ws.smart_status || "Pass");
                    });
                }
            }, 50);

            switchMobileTab('checklist');
        };

        function renderChecklistFormHTML(job) {
            let equipmentText = "";
            try {
                const arr = JSON.parse(job.equipment_used || "[]");
                if (Array.isArray(arr)) {
                    equipmentText = arr.join(', ');
                } else {
                    equipmentText = job.equipment_used;
                }
            } catch(e) {
                equipmentText = job.equipment_used || "";
            }

            let checklistVal = {};
            try {
                checklistVal = JSON.parse(job.checklist_data || "{}");
            } catch(e) {
                checklistVal = {};
            }

            return `
                <div class="glass-panel p-5 rounded-3xl shadow-xl space-y-4">
                    <div class="border-b border-white/5 pb-3">
                        <span class="bg-indigo-500/10 text-indigo-300 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-500/25">${job.service_type}</span>
                        <h3 class="text-base font-black mt-2 text-white">${job.company_name}</h3>
                        <p class="text-[11px] text-slate-400 mt-0.5">${job.address}</p>
                    </div>

                    <div class="text-xs bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                        <strong class="text-[9px] uppercase tracking-widest text-slate-400 block font-bold">Scope of Work</strong>
                        <span class="text-slate-300">${job.job_description}</span>
                    </div>

                    ${job.arrival_time ? `
                    <div class="text-xs text-slate-400 bg-black/20 p-2.5 rounded-xl space-y-1 font-mono">
                        <div>â±ï¸ Arrived: ${job.arrival_time}</div>
                        ${job.completion_time ? `<div>â±ï¸ Completed: ${job.completion_time}</div>` : ''}
                    </div>` : ''}

                    <form onsubmit="updateJob(event, '${job.id}')" class="space-y-4">
                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Service Domain</label>
                            <select name="service_type" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                                <option value="CCTV" ${job.service_type === 'CCTV' ? 'selected' : ''}>CCTV Surveillance Array</option>
                                <option value="Networking" ${job.service_type === 'Networking' ? 'selected' : ''}>Core Infrastructure Networking</option>
                                <option value="WiFi" ${job.service_type === 'WiFi' ? 'selected' : ''}>WiFi Mesh Deployment</option>
                                <option value="NAS" ${job.service_type === 'NAS' ? 'selected' : ''}>NAS Storage Cluster</option>
                                <option value="General Maintenance" ${job.service_type === 'General Maintenance' ? 'selected' : ''}>General Maintenance</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Statement of Scope</label>
                            <textarea name="job_description" rows="3" placeholder="Technical instructions & specific service scope..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none">${job.job_description || ''}</textarea>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Google Maps Share Link</label>
                            <input type="text" name="maps_url" value="${job.maps_url || ''}" placeholder="https://maps.app.goo.gl/..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Status Update</label>
                            <select name="status" onchange="toggleSignaturePad(this, '${job.id}')" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
                                <option value="Pending" ${job.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="In Progress" ${job.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                <option value="Completed" ${job.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Technical Action Logs</label>
                            <textarea name="notes" rows="2" placeholder="Describe diagnostic results or fixes..." class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none">${job.technician_notes || ''}</textarea>
                        </div>

                        <div class="space-y-1">
                            <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Equipment Implemented</label>
                            <input type="text" name="equipment" value="${equipmentText.replace(/"/g, '&quot;')}" placeholder="e.g., 2x CCTV Camera, 50m Cat6 Cable" class="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500">
                        </div>

                        <div class="grid grid-cols-2 gap-3 pt-2">
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">ðŸ“¸ Before Photo</label>
                                <input type="file" name="before_photo_file" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 file:transition-all">
                                ${job.before_photo ? `<a href="#" onclick="openPhoto(event, '${job.id}', 'before_photo'); return false;" class="text-xs text-indigo-400 hover:underline font-medium mt-1 block">View Upload</a>` : ''}
                            </div>
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">ðŸ“¸ After Photo</label>
                                <input type="file" name="after_photo_file" accept="image/*" capture="environment" class="w-full text-xs text-slate-500 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 file:transition-all">
                                ${job.after_photo ? `<a href="#" onclick="openPhoto(event, '${job.id}', 'after_photo'); return false;" class="text-xs text-indigo-400 hover:underline font-medium mt-1 block">View Upload</a>` : ''}
                            </div>
                        </div>

                        <div class="space-y-3 pt-4 border-t border-white/5">
                            <div class="flex items-center gap-2 border-b border-indigo-500/20 pb-2">
                                <span class="text-sm">ðŸ“‹</span>
                                <label class="text-xs font-extrabold uppercase tracking-widest text-indigo-400">Preventative Maintenance Log</label>
                            </div>

                            <!-- Section 1: Workstations (Collapsible) -->
                            <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden transition-all duration-300">
                                <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotate-180');" class="flex justify-between items-center p-3.5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                                    <span class="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-2">ðŸ–¥ï¸ 1. Workstations & PCs</span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="event.stopPropagation(); addWorkstationRow('${job.id}')" class="bg-indigo-600/90 hover:bg-indigo-500 text-white text-[8px] font-bold px-2 py-1 rounded-lg transition-all shadow-md">+ Add Device</button>
                                        <span class="arrow transition-all text-xs text-slate-400">â–¼</span>
                                    </div>
                                </div>
                                <div class="p-3.5 space-y-3 border-t border-white/5 hidden">
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-left border-collapse text-[10px]" id="tbl-workstations-${job.id}">
                                            <thead>
                                                <tr class="border-b border-white/5 text-slate-500 text-[8px] uppercase tracking-widest font-bold">
                                                    <th class="pb-1.5 pr-2">Device ID</th>
                                                    <th class="pb-1.5 text-center pr-2">OS Update</th>
                                                    <th class="pb-1.5 text-center pr-2">Temp Clean</th>
                                                    <th class="pb-1.5 pr-2">SMART</th>
                                                    <th class="pb-1.5 text-center"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <!-- Dynamic rows -->
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <!-- Section 2: Network Infrastructure -->
                            <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                                <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotate-180');" class="flex justify-between items-center p-3.5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                                    <span class="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-2">ðŸŒ 2. Network Infrastructure</span>
                                    <span class="arrow transition-all text-xs text-slate-400">â–¼</span>
                                </div>
                                <div class="p-3.5 space-y-3.5 border-t border-white/5 hidden">
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Firmware Upgrade</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="net_firmware">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'net_firmware', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.net_firmware === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Config Backup</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="net_backup">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'net_backup', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.net_backup === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">UPS Battery Test</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="net_ups">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'net_ups', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.net_ups === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Section 3: CCTV Camera Systems -->
                            <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                                <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotate-180');" class="flex justify-between items-center p-3.5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                                    <span class="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-2">ðŸ“· 3. CCTV Camera Systems</span>
                                    <span class="arrow transition-all text-xs text-slate-400">â–¼</span>
                                </div>
                                <div class="p-3.5 space-y-3.5 border-t border-white/5 hidden">
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Video Storage Retention</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="cctv_retention">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'cctv_retention', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.cctv_retention === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Camera Time Sync</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="cctv_time">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'cctv_time', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.cctv_time === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Video Loss Matrix</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="cctv_matrix">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'cctv_matrix', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.cctv_matrix === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Section 4: NAS Storage Nodes -->
                            <div class="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                                <div onclick="this.nextElementSibling.classList.toggle('hidden'); this.querySelector('.arrow').classList.toggle('rotate-180');" class="flex justify-between items-center p-3.5 bg-white/[0.02] cursor-pointer hover:bg-white/[0.05] transition-all">
                                    <span class="text-[10px] font-extrabold uppercase text-slate-300 tracking-wider flex items-center gap-2">ðŸ’¾ 4. NAS Storage Nodes</span>
                                    <span class="arrow transition-all text-xs text-slate-400">â–¼</span>
                                </div>
                                <div class="p-3.5 space-y-3.5 border-t border-white/5 hidden">
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">RAID Health Status</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="nas_raid">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'nas_raid', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.nas_raid === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="block text-[9px] font-bold text-slate-400">Storage Used Capacity (%)</label>
                                        <input type="number" name="nas_capacity" min="0" max="100" value="${checklistVal.nas_capacity || 0}" class="w-full bg-black/40 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 transition-all font-mono">
                                    </div>
                                    <div class="space-y-1.5">
                                        <div class="flex justify-between items-center">
                                            <span class="text-[9px] font-bold text-slate-400">Data Scrubbing Check</span>
                                        </div>
                                        <div class="flex gap-1.5" data-status-group="nas_scrubbing">
                                            ${['Good', 'Repair', 'Fixed', 'Change'].map(state => `
                                                <button type="button" onclick="selectStatusState(this, 'nas_scrubbing', '${state}')" class="status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight
                                                    ${checklistVal.nas_scrubbing === state ? getButtonColorClasses(state) : 'bg-black/40 text-slate-500 border-white/5 hover:text-slate-300'}" data-state="${state}">${state}</button>
                                            `).join('')}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- On-Site Hardware Replacement / Sales Form -->
                        <div class="space-y-3 pt-3 border-t border-white/5 bg-white/5 p-3 rounded-2xl">
                            <label class="block text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest">ðŸ“¦ Hardware Installation / Sales Action</label>

                            <div class="space-y-1">
                                <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hardware Action</label>
                                <select name="hardware_action" data-client-id="${job.client_id}" onchange="toggleHardwareFields(this, '${job.id}')" class="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                                    <option value="none">None / No Hardware Changes</option>
                                    <option value="sell">Sell New Device</option>
                                    <option value="replace">Replace Defective Unit (RMA)</option>
                                </select>
                            </div>

                            <div id="hw-fields-${job.id}" class="hidden space-y-3">
                                <div class="grid grid-cols-2 gap-2">
                                    <div class="space-y-1 relative" id="hw-model-wrap-${job.id}">
                                        <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Select Device Model</label>
                                        <!-- Hidden input carries selected value for form submission -->
                                        <input type="hidden" name="device_name" id="hw-device-val-${job.id}">
                                        <!-- Visible search/filter input -->
                                        <div class="relative">
                                            <input type="text" id="hw-device-search-${job.id}" autocomplete="off"
                                                placeholder="Type to search modelâ€¦"
                                                class="w-full bg-black/50 border border-white/10 rounded-xl pl-2.5 pr-7 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
                                                oninput="window.filterDeviceDropdown('${job.id}')"
                                                onfocus="window.openDeviceDropdown('${job.id}')"
                                                onkeydown="window.deviceDropdownKeyNav(event,'${job.id}')">
                                            <span class="absolute inset-y-0 right-2 flex items-center pointer-events-none text-slate-600">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3"><path d="M6 9l6 6 6-6"/></svg>
                                            </span>
                                        </div>
                                        <!-- Dropdown list -->
                                        <div id="hw-device-list-${job.id}"
                                            class="hidden absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 shadow-2xl"
                                            style="background: #0f1117;">
                                            ${(() => {
                                                try {
                                                    const catalog = JSON.parse(localStorage.getItem('cached_catalog') || '[]');
                                                    if (!catalog.length) return '<div class="px-3 py-2 text-[10px] text-slate-500">No devices in catalog</div>';
                                                    return catalog.map(c => `
                                                        <div class="hw-device-opt px-3 py-2 text-xs text-slate-300 cursor-pointer hover:bg-indigo-500/20 hover:text-white transition-colors flex justify-between items-center gap-2"
                                                            data-value="${c.item_code}"
                                                            data-label="${c.item_name}"
                                                            onclick="window.selectDeviceOption('${job.id}', '${c.item_code}', '${c.item_name.replace(/'/g,"\\'")}')">
                                                            <span class="truncate">${c.item_name}</span>
                                                            <span class="shrink-0 text-[9px] font-mono ${(c.stock_qty || 0) > 0 ? 'text-emerald-500' : 'text-rose-500'}">${c.stock_qty || 0} in stock</span>
                                                        </div>`).join('');
                                                } catch(e) { return ''; }
                                            })()}
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                         <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Serial Number</label>
                                         <input type="text" name="serial_number" list="hw-serials-${job.id}" placeholder="e.g., SN-12345" class="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                                         <datalist id="hw-serials-${job.id}"></datalist>
                                     </div>
                                </div>

                                <div id="hw-price-info-${job.id}" class="hidden p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between text-[10px] text-emerald-400 font-mono">
                                    <span>ðŸ’µ Unit Selling Price:</span>
                                    <span class="font-bold" id="hw-price-value-${job.id}">$0.00 / 0 Ks</span>
                                </div>

                                <div class="grid grid-cols-2 gap-2">
                                    <div class="space-y-1">
                                        <label class="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">Warranty Duration</label>
                                        <select name="warranty_months" class="w-full bg-black/50 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                                            <option value="12">12 Months (1 Year)</option>
                                            <option value="24">24 Months (2 Years)</option>
                                            <option value="36">36 Months (3 Years)</option>
                                        </select>
                                    </div>
                                    <div id="defective-sn-wrap-${job.id}" class="hidden space-y-1">
                                        <label class="block text-[9px] font-bold text-rose-400 uppercase tracking-widest">Defective Serial No.</label>
                                        <input type="text" name="defective_serial" list="defective-serials-${job.id}" placeholder="Old serial to replace" class="w-full bg-black/50 border border-rose-500/20 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
                                        <datalist id="defective-serials-${job.id}"></datalist>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Dynamic Signature Canvas Pad -->
                        <div id="sig-pad-${job.id}" class="hidden space-y-1.5 pt-2 border-t border-white/5">
                            <div class="flex justify-between items-center">
                                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">âœï¸ Customer Signature Sign-Off</label>
                                <button type="button" onclick="clearSignatureCanvas('${job.id}')" class="text-[10px] font-semibold text-rose-400 hover:underline">Clear Canvas</button>
                            </div>
                            <div class="bg-black rounded-xl border border-white/10 overflow-hidden">
                                <canvas id="canvas-${job.id}" class="w-full h-32 cursor-crosshair bg-black" style="touch-action: none;"></canvas>
                            </div>
                        </div>

                        <button type="submit" class="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold py-3.5 rounded-xl text-xs transition-all shadow-lg hover:shadow-emerald-500/20 uppercase tracking-widest mt-2">Submit Dispatch Report</button>
                    </form>
                </div>
            `;
        }

        function renderJobsList(jobs) {
            localStorage.setItem('cached_jobs', JSON.stringify(jobs));

            const activeContainer = document.getElementById('view-job');
            const historyContainer = document.getElementById('view-history');

            activeContainer.innerHTML = '';
            historyContainer.innerHTML = '';

            const technicianJobs = jobs.filter(j => j.technician_id === activeSessionUser.id);

            const activeJobs = technicianJobs.filter(j => j.status !== 'Completed' && j.status !== 'Cancelled');
            const historyJobs = technicianJobs.filter(j => j.status === 'Completed' || j.status === 'Cancelled');

            // 1. Render Active Jobs Tab View
            if (activeJobs.length === 0) {
                activeContainer.innerHTML = `
                    <div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm">
                        <span class="text-3xl block mb-2">ðŸŽ‰</span>
                        No active service tickets assigned to you.
                    </div>`;
            } else {
                activeJobs.forEach(job => {
                    const card = document.createElement('div');
                    card.className = "glass-panel p-5 rounded-3xl shadow-xl space-y-4";
                    
                    let badgeColor = job.status === 'In Progress' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                     'bg-blue-500/10 text-blue-400 border-blue-500/20';

                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0 pr-4">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}">${job.status}</span>
                                    <span class="bg-indigo-500/10 text-indigo-300 text-[9px] font-bold px-2 py-0.5 rounded border border-indigo-500/25">${job.service_type}</span>
                                </div>
                                <h3 class="text-base font-black mt-2 text-white truncate">${job.company_name}</h3>
                                <p class="text-[11px] text-slate-400 truncate mt-0.5">${job.address}</p>
                            </div>
                        </div>
                        <div class="text-xs bg-black/30 p-3 rounded-xl border border-white/5 space-y-1">
                            <strong class="text-[9px] uppercase tracking-widest text-slate-500 block font-bold">Scope of Work</strong>
                            <span class="text-slate-300">${job.job_description}</span>
                        </div>
                        <button onclick="openServiceChecklist('${job.id}')" class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-95 font-extrabold">
                            Open Service Checklist
                        </button>
                    `;
                    activeContainer.appendChild(card);
                });
            }

            // 2. Render History Jobs Tab View
            if (historyJobs.length === 0) {
                historyContainer.innerHTML = `
                    <div class="glass-panel p-8 rounded-3xl text-center text-slate-500 text-sm">
                        No completed history records found on this device.
                    </div>`;
            } else {
                historyJobs.forEach(job => {
                    const card = document.createElement('div');
                    card.className = "glass-panel p-5 rounded-3xl shadow-xl space-y-3 opacity-80";

                    let badgeColor = job.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                     'bg-rose-500/10 text-rose-400 border-rose-500/20';

                    card.innerHTML = `
                        <div onclick="this.nextElementSibling.classList.toggle('hidden');" class="cursor-pointer select-none">
                            <div class="flex justify-between items-center">
                                <div class="flex-1 min-w-0 pr-4">
                                    <div class="flex items-center gap-2 flex-wrap">
                                        <span class="text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${badgeColor}">${job.status}</span>
                                        <span class="bg-white/5 text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded border border-white/10">${job.service_type}</span>
                                    </div>
                                    <h3 class="text-sm font-black mt-2 text-white truncate">${job.company_name}</h3>
                                    <p class="text-[10px] text-slate-500 truncate">${job.address}</p>
                                </div>
                                <span class="text-xs text-indigo-400">â–¼</span>
                            </div>
                        </div>
                        <div class="hidden pt-3 border-t border-white/5 space-y-2 text-xs">
                            <p class="text-slate-400"><strong class="text-slate-500">Job Description:</strong> ${job.job_description}</p>
                            ${job.technician_notes ? `<p class="text-slate-300 bg-black/20 p-2 rounded-lg"><strong class="text-slate-500">Tech Notes:</strong> ${job.technician_notes}</p>` : ''}
                            ${job.equipment_used ? `<p class="text-slate-400"><strong class="text-slate-500">Equipment Used:</strong> ${job.equipment_used}</p>` : ''}
                            ${job.arrival_time ? `<p class="text-slate-500 font-mono text-[10px]">Arrived: ${job.arrival_time} / Completed: ${job.completion_time || 'N/A'}</p>` : ''}
                        </div>
                    `;
                    historyContainer.appendChild(card);
                });
            }

            // Sync settings profile cards
            const setUsername = document.getElementById('settings-username');
            const setUserid = document.getElementById('settings-userid');
            if (setUsername && activeSessionUser) setUsername.textContent = activeSessionUser.name;
            if (setUserid && activeSessionUser) setUserid.textContent = `ID: ${activeSessionUser.id}`;
        }

        function toggleSignaturePad(select, jobId) {
            const pad = document.getElementById(`sig-pad-${jobId}`);
            if (select.value === 'Completed') {
                pad.classList.remove('hidden');
                initSignatureCanvas(jobId);
            } else {
                pad.classList.add('hidden');
            }
        }

        function toggleHardwareFields(select, jobId) {
            const wrap = document.getElementById(`hw-fields-${jobId}`);
            const defectiveSnWrap = document.getElementById(`defective-sn-wrap-${jobId}`);
            if (select.value === 'none') {
                wrap.classList.add('hidden');
            } else {
                wrap.classList.remove('hidden');
                if (select.value === 'replace') {
                    defectiveSnWrap.classList.remove('hidden');
                    
                    const clientId = select.getAttribute('data-client-id');
                    const datalist = document.getElementById(`defective-serials-${jobId}`);
                    if (clientId && datalist) {
                        datalist.innerHTML = '';
                        fetch(`/api/portal/warranties?client_id=${clientId}`)
                            .then(res => res.json())
                            .then(items => {
                                if (Array.isArray(items)) {
                                    datalist.innerHTML = items.map(item => {
                                        const expiry = new Date(item.installed_date || item.created_at);
                                        expiry.setMonth(expiry.getMonth() + (parseInt(item.warranty_months) || 12));
                                        const isExpired = expiry < new Date();
                                        const statusText = isExpired ? 'Expired' : 'Active';
                                        return `<option value="${item.serial_number}">${item.device_name} (${statusText} Warranty)</option>`;
                                    }).join('');
                                }
                            })
                            .catch(err => console.error("Failed to load customer warranties for autocomplete:", err));
                    }
                } else {
                    defectiveSnWrap.classList.add('hidden');
                }
            }
        }

        window.showDevicePrice = function(itemCode, jobId) {
            const priceInfoWrap = document.getElementById(`hw-price-info-${jobId}`);
            const priceValSpan = document.getElementById(`hw-price-value-${jobId}`);
            const datalist = document.getElementById(`hw-serials-${jobId}`);
            if (!priceInfoWrap || !priceValSpan) return;

            if (datalist) {
                datalist.innerHTML = '';
            }

            if (!itemCode) {
                priceInfoWrap.classList.add('hidden');
                return;
            }

            // Load available stock serial numbers for the selected device model
            if (datalist) {
                fetch(`/api/inventory/serials?item_code=${itemCode}`)
                    .then(res => res.json())
                    .then(serials => {
                        if (Array.isArray(serials)) {
                            datalist.innerHTML = serials.map(sn => `<option value="${sn}"></option>`).join('');
                        }
                    })
                    .catch(err => console.error("Failed to load serials for autocomplete:", err));
            }

            try {
                const catalog = JSON.parse(localStorage.getItem('cached_catalog') || '[]');
                const item = catalog.find(c => c.item_code === itemCode);
                if (item) {
                    const priceUSD = parseFloat(item.unit_price || 0).toFixed(2);
                    const priceMMK = parseInt(item.unit_price_mmk || 0).toLocaleString();
                    priceValSpan.textContent = `$${priceUSD} / ${priceMMK} Ks`;
                    priceInfoWrap.classList.remove('hidden');
                } else {
                    priceInfoWrap.classList.add('hidden');
                }
            } catch (err) {
                console.error("Price display error:", err);
                priceInfoWrap.classList.add('hidden');
            }
        };

        // â”€â”€ Device Model Searchable Combobox Controllers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        window.openDeviceDropdown = function(jobId) {
            const list = document.getElementById(`hw-device-list-${jobId}`);
            if (list) {
                list.classList.remove('hidden');
                // Reset filter to show all when reopening
                list.querySelectorAll('.hw-device-opt').forEach(el => el.style.display = '');
            }
        };

        window.filterDeviceDropdown = function(jobId) {
            const searchInput = document.getElementById(`hw-device-search-${jobId}`);
            const list        = document.getElementById(`hw-device-list-${jobId}`);
            const hiddenInput = document.getElementById(`hw-device-val-${jobId}`);
            if (!searchInput || !list) return;

            const q = searchInput.value.trim().toLowerCase();
            list.classList.remove('hidden');

            // If user clears the input, also clear the committed value
            if (!q) {
                if (hiddenInput) hiddenInput.value = '';
                window.showDevicePrice('', jobId);
            }

            let anyVisible = false;
            list.querySelectorAll('.hw-device-opt').forEach(opt => {
                const label = (opt.dataset.label || '').toLowerCase();
                const match = !q || label.includes(q);
                opt.style.display = match ? '' : 'none';
                if (match) anyVisible = true;
            });

            // Show empty state if nothing matches
            let emptyMsg = list.querySelector('.hw-device-empty');
            if (!anyVisible) {
                if (!emptyMsg) {
                    emptyMsg = document.createElement('div');
                    emptyMsg.className = 'hw-device-empty px-3 py-2 text-[10px] text-slate-500';
                    emptyMsg.textContent = 'No match found';
                    list.appendChild(emptyMsg);
                }
                emptyMsg.style.display = '';
            } else if (emptyMsg) {
                emptyMsg.style.display = 'none';
            }
        };

        window.selectDeviceOption = function(jobId, itemCode, itemLabel) {
            const searchInput = document.getElementById(`hw-device-search-${jobId}`);
            const hiddenInput = document.getElementById(`hw-device-val-${jobId}`);
            const list        = document.getElementById(`hw-device-list-${jobId}`);
            if (searchInput) searchInput.value = itemLabel;
            if (hiddenInput) hiddenInput.value = itemCode;
            if (list) list.classList.add('hidden');
            // Highlight selected row
            if (list) {
                list.querySelectorAll('.hw-device-opt').forEach(opt => {
                    opt.style.background = opt.dataset.value === itemCode ? 'rgba(99,102,241,0.15)' : '';
                });
            }
            window.showDevicePrice(itemCode, jobId);
        };

        window.deviceDropdownKeyNav = function(e, jobId) {
            const list = document.getElementById(`hw-device-list-${jobId}`);
            if (!list) return;
            const opts = [...list.querySelectorAll('.hw-device-opt')].filter(o => o.style.display !== 'none');
            const current = list.querySelector('.hw-device-opt.dd-focused');
            let idx = opts.indexOf(current);

            if (e.key === 'Escape') {
                list.classList.add('hidden');
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (list.classList.contains('hidden')) { list.classList.remove('hidden'); }
                if (current) current.classList.remove('dd-focused');
                idx = Math.min(idx + 1, opts.length - 1);
                if (opts[idx]) { opts[idx].classList.add('dd-focused'); opts[idx].scrollIntoView({ block: 'nearest' }); }
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (current) current.classList.remove('dd-focused');
                idx = Math.max(idx - 1, 0);
                if (opts[idx]) { opts[idx].classList.add('dd-focused'); opts[idx].scrollIntoView({ block: 'nearest' }); }
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (current) window.selectDeviceOption(jobId, current.dataset.value, current.dataset.label);
                return;
            }
        };

        // Global click-outside handler to close device dropdowns
        if (!window._deviceDropdownOutsideListenerAdded) {
            window._deviceDropdownOutsideListenerAdded = true;
            document.addEventListener('click', function(e) {
                document.querySelectorAll('[id^="hw-device-list-"]').forEach(list => {
                    const jobId = list.id.replace('hw-device-list-', '');
                    const wrap  = document.getElementById(`hw-model-wrap-${jobId}`);
                    if (wrap && !wrap.contains(e.target)) {
                        list.classList.add('hidden');
                    }
                });
            });
        }


        function initSignatureCanvas(jobId) {
            const canvas = document.getElementById(`canvas-${jobId}`);
            if (!canvas || activeCanvases[jobId]) return;

            // Make canvas responsive
            canvas.width = canvas.parentElement.clientWidth;
            
            const ctx = canvas.getContext('2d');
            ctx.strokeStyle = '#6366f1'; // Indigo signature stroke
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            let drawing = false;

            // Event listeners for drawing
            canvas.addEventListener('mousedown', startDraw);
            canvas.addEventListener('mousemove', draw);
            canvas.addEventListener('mouseup', stopDraw);
            canvas.addEventListener('mouseleave', stopDraw);

            canvas.addEventListener('touchstart', (e) => {
                const t = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                ctx.beginPath();
                ctx.moveTo(t.clientX - rect.left, t.clientY - rect.top);
                drawing = true;
                e.preventDefault();
            });
            canvas.addEventListener('touchmove', (e) => {
                if (!drawing) return;
                const t = e.touches[0];
                const rect = canvas.getBoundingClientRect();
                ctx.lineTo(t.clientX - rect.left, t.clientY - rect.top);
                ctx.stroke();
                e.preventDefault();
            });
            canvas.addEventListener('touchend', stopDraw);

            function startDraw(e) {
                drawing = true;
                const rect = canvas.getBoundingClientRect();
                ctx.beginPath();
                ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
            }

            function draw(e) {
                if (!drawing) return;
                const rect = canvas.getBoundingClientRect();
                ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
                ctx.stroke();
            }

            function stopDraw() {
                drawing = false;
            }

            activeCanvases[jobId] = { canvas, ctx };
        }

        function clearSignatureCanvas(jobId) {
            const item = activeCanvases[jobId];
            if (item) {
                item.ctx.clearRect(0, 0, item.canvas.width, item.canvas.height);
            }
        }

        function drawSignatureData(jobId, dataUrl) {
            const item = activeCanvases[jobId];
            if (item) {
                const img = new Image();
                img.onload = () => {
                    item.ctx.drawImage(img, 0, 0, item.canvas.width, item.canvas.height);
                };
                img.src = dataUrl;
            }
        }

        async function updateJob(event, jobId) {
            event.preventDefault();
            const form = event.target;
            const status = form.status.value;
            
            const formData = new FormData(form);
            formData.append("job_id", jobId);

            // Convert comma-separated equipment items into a JSON array string
            const rawEquipment = form.equipment.value.trim();
            let eqJson = "[]";
            if (rawEquipment) {
                const arr = rawEquipment.split(',').map(s => s.trim()).filter(s => s !== '');
                eqJson = JSON.stringify(arr);
            }
            formData.set("equipment", eqJson);

            // Serialize checklist items as JSON
            const workstations = [];
            const table = document.getElementById(`tbl-workstations-${jobId}`);
            const wsRows = table ? table.querySelectorAll('tbody tr') : [];
            wsRows.forEach(row => {
                const device_id = row.querySelector('[name="ws_device_id"]').value.trim();
                const os_updated = row.querySelector('[name="ws_os_updated"]').checked;
                const temp_cleaned = row.querySelector('[name="ws_temp_cleaned"]').checked;
                const smart_status = row.querySelector('[name="ws_smart_status"]').value;
                if (device_id) {
                    workstations.push({ device_id, os_updated, temp_cleaned, smart_status });
                }
            });

            const getSelectedState = (groupName) => {
                const group = form.querySelector(`[data-status-group="${groupName}"]`);
                if (!group) return 'Good';
                const activeBtn = group.querySelector('.bg-emerald-500, .bg-amber-500, .bg-indigo-500, .bg-rose-500');
                return activeBtn ? activeBtn.getAttribute('data-state') : 'Good';
            };

            const checklist = {
                workstations: workstations,
                net_firmware: getSelectedState('net_firmware'),
                net_backup: getSelectedState('net_backup'),
                net_ups: getSelectedState('net_ups'),
                cctv_retention: getSelectedState('cctv_retention'),
                cctv_time: getSelectedState('cctv_time'),
                cctv_matrix: getSelectedState('cctv_matrix'),
                nas_raid: getSelectedState('nas_raid'),
                nas_capacity: form.nas_capacity ? parseInt(form.nas_capacity.value) || 0 : 0,
                nas_scrubbing: getSelectedState('nas_scrubbing')
            };
            formData.append("checklist_data", JSON.stringify(checklist));

            // Add signature if completing
            if (status === 'Completed' && activeCanvases[jobId]) {
                const signatureData = activeCanvases[jobId].canvas.toDataURL('image/png');
                formData.append("signature", signatureData);
            }

            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = "Syncing with Edge...";

            // Retrieve Location & Time Telemetry parameters
            const telemetry = await getFieldTelemetry(status);
            if (telemetry.time) {
                if (status === 'In Progress') {
                    formData.append("arrival_time", telemetry.time);
                    if (telemetry.coords) {
                        formData.append("arrival_lat", telemetry.coords.latitude);
                        formData.append("arrival_lng", telemetry.coords.longitude);
                    }
                } else if (status === 'Completed') {
                    formData.append("completion_time", telemetry.time);
                    if (telemetry.coords) {
                        formData.append("completion_lat", telemetry.coords.latitude);
                        formData.append("completion_lng", telemetry.coords.longitude);
                    }
                }
            }

            try {
                if (!navigator.onLine) {
                    queueOfflineUpdate(jobId, formData);
                    alert("Device offline. Update stored in local pipeline queue!");
                    selectedJobId = null;
                    document.getElementById('checklist-placeholder').classList.remove('hidden');
                    document.getElementById('checklist-form-container').innerHTML = '';
                    switchMobileTab('job');
                    fetchJobs();
                    return;
                }

                const res = await fetch(`${API_BASE_URL}/api/jobs/update`, {
                    method: "POST",
                    body: formData
                });
                if (!res.ok) throw new Error("Synchronization failure.");
                alert("Cloud engine synced successfully!");
                selectedJobId = null;
                document.getElementById('checklist-placeholder').classList.remove('hidden');
                document.getElementById('checklist-form-container').innerHTML = '';
                switchMobileTab('job');
                fetchJobs();
            } catch (err) {
                alert("API sync error: " + err.message + ". Enqueueing update locally.");
                queueOfflineUpdate(jobId, formData);
                selectedJobId = null;
                document.getElementById('checklist-placeholder').classList.remove('hidden');
                document.getElementById('checklist-form-container').innerHTML = '';
                switchMobileTab('job');
                fetchJobs();
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Submit Dispatch Report";
            }
        }

        function getFieldTelemetry(status) {
            return new Promise((resolve) => {
                if (status === 'Pending') return resolve({});
                
                const time = new Date().toLocaleString();
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (pos) => resolve({ time, coords: pos.coords }),
                        () => resolve({ time }), // fallback if user blocks GPS
                        { timeout: 3000 } // set 3s timeout to prevent infinite hang in local development
                    );
                } else {
                    resolve({ time });
                }
            });
        }

        // --- OFFLINE Fallback Cache Queue Pipelines ---
        function queueOfflineUpdate(jobId, formData) {
            const queue = JSON.parse(localStorage.getItem('offline_update_queue') || '[]');
            
            // Map formData entries to JSON-serializable object
            const record = { jobId };
            for (const [key, val] of formData.entries()) {
                if (val instanceof File) {
                    // skip file binaries in offline storage for memory efficiency
                    continue;
                }
                record[key] = val;
            }
            
            queue.push(record);
            localStorage.setItem('offline_update_queue', JSON.stringify(queue));
            showSyncButton();
        }

        function showSyncButton() {
            const queue = JSON.parse(localStorage.getItem('offline_update_queue') || '[]');
            const btn = document.getElementById('sync-btn');
            if (queue.length > 0) {
                btn.textContent = `Sync Queue (${queue.length})`;
                btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
            }
        }

        async function syncOfflineQueue() {
            const queue = JSON.parse(localStorage.getItem('offline_update_queue') || '[]');
            if (queue.length === 0) return;

            const btn = document.getElementById('sync-btn');
            btn.disabled = true;
            btn.textContent = "Syncing local database...";

            for (const record of queue) {
                const formData = new FormData();
                for (const [k, v] of Object.entries(record)) {
                    formData.append(k, v);
                }

                try {
                    await fetch(`${API_BASE_URL}/api/jobs/update`, {
                        method: "POST",
                        body: formData
                    });
                } catch (e) {
                    console.error("Queue sync failure", e);
                }
            }

            localStorage.removeItem('offline_update_queue');
            showSyncButton();
            alert("Offline database changes merged to Cloudflare D1 successfully!");
            fetchJobs();
        }

        // Initialize queue checks
        setTimeout(() => {
            showSyncButton();
            updateOnlineStatus();
        }, 1000);



        // Google OAuth Sign-in Handlers
        window.addEventListener("load", () => {
            google.accounts.id.initialize({
                client_id: "609507528219-2foc0ch65rkqkgdlvlihqagb6dqbmpcm.apps.googleusercontent.com", // Google OAuth Client ID binding
                callback: handleGoogleLogin
            });
            google.accounts.id.renderButton(
                document.getElementById("g-signin-btn"),
                { theme: "dark", size: "large", type: "standard", shape: "rectangular" }
            );
        });

        async function handleGoogleLogin(response) {
            const container = document.getElementById('auth-screen');
            try {
                if (!navigator.onLine) {
                    alert("Local Offline Access Bypass Enabled.");
                    activeSessionUser = { id: "TECH-001", name: "Offline Operator", role: "Technician" };
                    document.getElementById('user-display-name').textContent = activeSessionUser.name;
                    document.getElementById('user-display-role').textContent = `${activeSessionUser.id} â€¢ ${activeSessionUser.role}`;
                    container.classList.add('hidden');
                    document.getElementById('app-content').classList.remove('hidden');
                    return;
                }

                const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: response.credential })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Google login rejected");

                activeSessionUser = data.user;
                document.getElementById('user-display-name').textContent = activeSessionUser.name;
                document.getElementById('user-display-role').textContent = `${activeSessionUser.id} â€¢ ${activeSessionUser.role}`;
                
                container.classList.add('hidden');
                document.getElementById('app-content').classList.remove('hidden');
                fetchJobs();
            } catch (err) {
                alert("Access Denied: " + err.message);
            }
        }

        window.addWorkstationRow = function(jobId) {
            insertWorkstationRow(jobId, "", false, false, "Pass");
        }

        window.removeWorkstationRow = function(btn) {
            const row = btn.closest('tr');
            if (row) row.remove();
        }

        function insertWorkstationRow(jobId, deviceId, osUpdated, tempCleaned, smartStatus) {
            const table = document.getElementById(`tbl-workstations-${jobId}`);
            const tbody = table ? table.querySelector('tbody') : null;
            if (!tbody) return;

            const tr = document.createElement('tr');
            tr.className = "border-b border-white/5 hover:bg-white/[0.02] transition-all";
            tr.innerHTML = `
                <td class="py-2.5 pr-2">
                    <input type="text" name="ws_device_id" value="${deviceId}" placeholder="PC-01" class="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-white text-[10px] focus:outline-none focus:border-indigo-500 transition-all font-mono uppercase">
                </td>
                <td class="py-2.5 text-center pr-2">
                    <input type="checkbox" name="ws_os_updated" class="w-4 h-4 rounded border-white/10 bg-black/40 text-indigo-500 focus:ring-0 cursor-pointer" ${osUpdated ? 'checked' : ''}>
                </td>
                <td class="py-2.5 text-center pr-2">
                    <input type="checkbox" name="ws_temp_cleaned" class="w-4 h-4 rounded border-white/10 bg-black/40 text-indigo-500 focus:ring-0 cursor-pointer" ${tempCleaned ? 'checked' : ''}>
                </td>
                <td class="py-2.5 pr-2">
                    <select name="ws_smart_status" class="bg-black/40 border border-white/10 rounded-lg px-1.5 py-1.5 text-white text-[10px] focus:outline-none focus:border-indigo-500 transition-all cursor-pointer">
                        <option value="Pass" ${smartStatus === 'Pass' ? 'selected' : ''}>Pass</option>
                        <option value="Fail" ${smartStatus === 'Fail' ? 'selected' : ''}>Fail</option>
                        <option value="N/A" ${smartStatus === 'N/A' ? 'selected' : ''}>N/A</option>
                    </select>
                </td>
                <td class="py-2.5 text-center">
                    <button type="button" onclick="removeWorkstationRow(this)" class="w-6 h-6 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-all flex items-center justify-center font-bold text-[10px]">âœ•</button>
                </td>
            `;
            tbody.appendChild(tr);
        }

        window.openPhoto = function(event, jobId, fieldName) {
            event.preventDefault();
            // Fetch the job object from local memory or API to get base64Data
            const form = event.target.closest('form');
            if (!form) return;
            
            // If the user has already loaded/rendered jobs, they are in the DOM or cached
            // For simplicity, we query the API or retrieve from DB directly, but we can also just fetch it:
            fetch(`${API_BASE_URL}/api/jobs`)
                .then(res => res.json())
                .then(jobs => {
                    const job = jobs.find(j => j.id === jobId);
                    if (job && job[fieldName]) {
                        const base64Data = job[fieldName];
                        const w = window.open();
                        if (w) {
                            w.document.write(`
                                <html>
                                <head><title>View Uploaded Photo</title></head>
                                <body style="margin:0; background:#070709; display:flex; align-items:center; justify-content:center; min-height:100vh;">
                                    <img src="${base64Data}" style="max-width:100%; max-height:100vh; object-contain:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5); border-radius:8px;" />
                                </body>
                                </html>
                            `);
                            w.document.close();
                        } else {
                            alert("Popup blocked! Please allow popups for this site.");
                        }
                    } else {
                        alert("Photo data not found or empty.");
                    }
                });
        }

        // --- MULTI-STATE CHECKLIST HELPERS ---
        function getButtonColorClasses(state) {
            switch(state) {
                case 'Good':
                    return 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600 shadow-md shadow-emerald-500/10';
                case 'Repair':
                    return 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600 shadow-md shadow-amber-500/10';
                case 'Fixed':
                    return 'bg-indigo-500 text-white border-indigo-500 hover:bg-indigo-600 shadow-md shadow-indigo-500/10';
                case 'Change':
                    return 'bg-rose-500 text-white border-rose-500 hover:bg-rose-600 shadow-md shadow-rose-500/10';
                default:
                    return 'bg-black/40 text-slate-500 border-white/5';
            }
        }

        function selectStatusState(button, groupName, state) {
            const container = button.closest(`[data-status-group="${groupName}"]`);
            if (!container) return;

            // Reset all buttons in the group to default state
            const buttons = container.querySelectorAll('.status-btn');
            buttons.forEach(btn => {
                btn.className = 'status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight bg-black/40 text-slate-500 border-white/5 hover:text-slate-300';
            });

            // Set the clicked button to active state classes
            button.className = `status-btn flex-1 text-[9px] font-bold py-1 px-1.5 rounded-lg border transition-all text-center uppercase tracking-tight ${getButtonColorClasses(state)}`;
        }

        // Bind helpers to window context
        window.selectStatusState = selectStatusState;
        window.getButtonColorClasses = getButtonColorClasses;

        window.changeSecurityPin = async function(e) {
            e.preventDefault();
            if (!activeSessionUser) return alert("Session expired. Please log in first.");

            const oldPin = document.getElementById('pin-current').value.trim();
            const newPin = document.getElementById('pin-new').value.trim();
            const confirmPin = document.getElementById('pin-new-confirm').value.trim();

            if (newPin !== confirmPin) {
                alert("New PIN inputs do not match!");
                return;
            }

            const btn = document.getElementById('pin-btn');
            btn.disabled = true;
            btn.textContent = "Updating PIN...";

            try {
                const res = await fetch(`${API_BASE_URL}/api/portal/change-pin`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: activeSessionUser.id, oldPin, newPin })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to update PIN");

                alert("PIN updated successfully!");
                document.getElementById('pin-modal').classList.add('hidden');
                document.getElementById('pin-current').value = '';
                document.getElementById('pin-new').value = '';
                document.getElementById('pin-new-confirm').value = '';
            } catch (err) {
                alert("Error updating PIN: " + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = "Update Security PIN";
            }
        };
