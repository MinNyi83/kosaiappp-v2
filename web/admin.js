        let map;
        let mapMarkers = [];
        let statusChartInstance;
        let categoryChartInstance;
        let chatInterval;

        let cashTransactions = [];
        let cashPage = 1;
        const cashPerPage = 10;

        let inventoryItems = [];
        let stockPage = 1;
        const stockPerPage = 10;

        // Mobile sidebar controls
        function openSidebar() {
            document.getElementById('sidebar').classList.add('open');
            document.getElementById('sidebar-overlay').classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function closeSidebar() {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('open');
            document.body.style.overflow = '';
        }

        // Login view tabs switcher
        function setLoginTab(tab) {

            const googleBtn = document.getElementById("tab-google");
            const passBtn = document.getElementById("tab-password");
            const googleContainer = document.getElementById("login-google-container");
            const passContainer = document.getElementById("login-password-container");

            if (tab === "google") {
                googleBtn.classList.add("text-white", "font-bold", "border-b-2", "border-amber-500");
                googleBtn.classList.remove("text-slate-400");
                passBtn.classList.remove("text-white", "font-bold", "border-b-2", "border-amber-500");
                passBtn.classList.add("text-slate-400");
                googleContainer.classList.remove("hidden");
                passContainer.classList.add("hidden");
            } else {
                passBtn.classList.add("text-white", "font-bold", "border-b-2", "border-amber-500");
                passBtn.classList.remove("text-slate-400");
                googleBtn.classList.remove("text-white", "font-bold", "border-b-2", "border-amber-500");
                googleBtn.classList.add("text-slate-400");
                passContainer.classList.remove("hidden");
                googleContainer.classList.add("hidden");
            }
        }

        async function handlePasswordLogin(e) {
            e.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value.trim();
            const baseUrl = document.getElementById("api-base").value;

            try {
                const res = await fetch(`${baseUrl}/api/auth/login-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Authentication failed");

                if (data.user.role !== 'Admin') {
                    throw new Error("Your account does not have Admin privileges.");
                }

                localStorage.setItem('admin_user', JSON.stringify(data.user));
                document.getElementById('auth-screen').classList.add('hidden');
                initializeAdminDesk();
            } catch (err) {
                alert("Access Denied: " + err.message);
            }
        }

        async function submitNewUser(e) {
            e.preventDefault();
            const username = document.getElementById("new-user-username").value.trim();
            const password = document.getElementById("new-user-password").value.trim();
            const name = document.getElementById("new-user-name").value.trim();
            const role = document.getElementById("new-user-role").value;
            const phone = document.getElementById("new-user-phone").value.trim();
            const email = document.getElementById("new-user-email").value.trim();
            
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;

            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ username, password, name, role, phone, email })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("User account created successfully.");
                    e.target.reset();
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        }

        // Auto check Google user cache on load
        window.addEventListener("load", () => {
            google.accounts.id.initialize({
                client_id: "609507528219-2foc0ch65rkqkgdlvlihqagb6dqbmpcm.apps.googleusercontent.com", // Google OAuth Client ID binding
                callback: handleGoogleLogin
            });
            google.accounts.id.renderButton(
                document.getElementById("g-signin-btn"),
                { theme: "dark", size: "large", type: "standard", shape: "rectangular" }
            );

            const cachedUser = localStorage.getItem('admin_user');
            if (cachedUser) {
                const user = JSON.parse(cachedUser);
                if (user.role === 'Admin') {
                    document.getElementById('auth-screen').classList.add('hidden');
                    initializeAdminDesk();
                }
            }
        });

        async function handleGoogleLogin(response) {
            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: response.credential })
                });
                
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Google auth rejected");

                if (data.user.role !== 'Admin') {
                    throw new Error("Your account does not have Admin privileges.");
                }

                localStorage.setItem('admin_user', JSON.stringify(data.user));
                document.getElementById('auth-screen').classList.add('hidden');
                initializeAdminDesk();
            } catch (err) {
                alert("Access Denied: " + err.message);
            }
        }

        function handleLogout() {
            localStorage.removeItem('admin_user');
            document.getElementById('auth-screen').classList.remove('hidden');
        }

        async function triggerBackup() {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            try {
                const res = await fetch(`${baseUrl}/api/admin/backup`, {
                    headers: { 'X-Admin-Secret': secret }
                });
                if (!res.ok) throw new Error("Could not download backup file.");
                const data = await res.json();
                
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `awesomemyanmar_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                alert("Database backup file generated and downloaded successfully!");
            } catch(e) {
                alert("Backup failed: " + e.message);
            }
        }

        function triggerRestore() {
            document.getElementById('restore-file-input').click();
        }

        async function handleRestoreFile(event) {
            const file = event.target.files[0];
            if (!file) return;

            const confirmRestore = confirm("CRITICAL WARNING: This action will completely erase all current client profiles, technician registries, tickets, ledger entries, and transaction histories, replacing them with the backup state. Do you want to proceed?");
            if (!confirmRestore) {
                event.target.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = async function(e) {
                const baseUrl = document.getElementById('api-base').value;
                const secret = document.getElementById('admin-secret').value;
                try {
                    const parsed = JSON.parse(e.target.result);
                    if (!parsed.data) throw new Error("Invalid backup file structure.");

                    const res = await fetch(`${baseUrl}/api/admin/restore`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                        body: JSON.stringify(parsed)
                    });
                    const resData = await res.json();
                    if (res.ok) {
                        alert("Database restored successfully! Reloading dashboard metrics...");
                        refreshDashboardData();
                    } else {
                        throw new Error(resData.error || "Restoration failed.");
                    }
                } catch(err) {
                    alert("Restoration process aborted: " + err.message);
                } finally {
                    event.target.value = '';
                }
            };
            reader.readAsText(file);
        }

        function syncExchangeRate(val) {
            const globalRate = document.getElementById('cash-rate-global');
            if (globalRate) globalRate.value = val;
            const cashRate = document.getElementById('cash-rate');
            if (cashRate) cashRate.value = val;
            document.getElementById('cash-rate-local').value = val;
        }

        function switchTab(tabId) {
            // Hide all views
            document.querySelectorAll('.tab-view').forEach(view => {
                view.classList.add('hidden');
            });
            // Show selected view
            const selectedView = document.getElementById(`view-${tabId}`);
            if (selectedView) selectedView.classList.remove('hidden');

            // Update path display
            const pathName = tabId === 'system-settings' ? 'System Settings' : tabId.charAt(0).toUpperCase() + tabId.slice(1);
            document.getElementById('current-path-display').textContent = pathName === 'Dashboard' ? 'Dashboard' : `Dashboard / ${pathName}`;

            // Highlight sidebar tab
            document.querySelectorAll('.tab-link').forEach(link => {
                link.classList.remove('bg-amber-500/10', 'text-amber-500');
                link.classList.add('text-slate-400');
            });
            // Find clicking source link (simplified matching)
            const activeLink = Array.from(document.querySelectorAll('.tab-link')).find(link => link.getAttribute('onclick').includes(tabId));
            if (activeLink) {
                activeLink.classList.remove('text-slate-400');
                activeLink.classList.add('bg-amber-500/10', 'text-amber-500');
            }
        }

        function initializeAdminDesk() {
            initLeafletMap();
            setupSearchableClientsListeners();
            refreshDashboardData();
            // Start dashboard auto refresh loops every 10 seconds
            setInterval(refreshDashboardData, 10000);
        }

        let hqMarker = null;

        function loadHQConfig() {
            const hq = JSON.parse(localStorage.getItem('hq_config')) || {
                name: "AwesomeMyanmar Head Office",
                lat: 16.774687,
                lng: 96.163438,
                address: "Q5F7+V9 Yangon, Myanmar (Burma)",
                maps_url: "https://maps.app.goo.gl/EynEhHxGX42CpHvr5"
            };
            
            if (document.getElementById('hq-name')) document.getElementById('hq-name').value = hq.name;
            if (document.getElementById('hq-maps-url')) document.getElementById('hq-maps-url').value = hq.maps_url || '';
            if (document.getElementById('hq-lat')) document.getElementById('hq-lat').value = hq.lat;
            if (document.getElementById('hq-lng')) document.getElementById('hq-lng').value = hq.lng;
            if (document.getElementById('hq-address')) document.getElementById('hq-address').value = hq.address;
            
            return hq;
        }

        async function resolveMapsUrlToCoords(url) {
            const statusEl = document.getElementById('hq-resolve-status');
            if (!url || !url.startsWith('http')) {
                statusEl.textContent = "Default coordinates preloaded";
                statusEl.className = "block text-[8px] text-slate-500 mt-1";
                return;
            }

            statusEl.textContent = "Resolving Google Maps URL...";
            statusEl.className = "block text-[8px] text-amber-400 mt-1 animate-pulse";

            try {
                const baseUrl = document.getElementById('api-base').value;
                const res = await fetch(`${baseUrl}/api/admin/resolve-coords?url=${encodeURIComponent(url)}`);
                const data = await res.json();

                if (res.ok && data.success) {
                    document.getElementById('hq-lat').value = data.lat;
                    document.getElementById('hq-lng').value = data.lng;
                    statusEl.textContent = `Successfully resolved coordinates: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
                    statusEl.className = "block text-[8px] text-emerald-400 mt-1 font-bold";
                } else {
                    statusEl.textContent = "Failed to resolve coordinates: " + (data.error || "Invalid response");
                    statusEl.className = "block text-[8px] text-rose-400 mt-1 font-bold";
                }
            } catch (err) {
                statusEl.textContent = "Resolution network error: " + err.message;
                statusEl.className = "block text-[8px] text-rose-400 mt-1 font-bold";
            }
        }

        async function resolveJobMapsUrlToCoords(url) {
            const statusEl = document.getElementById('job-resolve-status');
            if (!url || !url.startsWith('http')) {
                statusEl.textContent = "Coordinates: Not resolved yet";
                statusEl.className = "block text-[8px] text-slate-500 mt-1";
                document.getElementById('job-lat').value = '';
                document.getElementById('job-lng').value = '';
                return;
            }

            statusEl.textContent = "Resolving Google Maps URL...";
            statusEl.className = "block text-[8px] text-amber-400 mt-1 animate-pulse";

            try {
                const baseUrl = document.getElementById('api-base').value;
                const res = await fetch(`${baseUrl}/api/admin/resolve-coords?url=${encodeURIComponent(url)}`);
                const data = await res.json();

                if (res.ok && data.success) {
                    document.getElementById('job-lat').value = data.lat;
                    document.getElementById('job-lng').value = data.lng;
                    statusEl.textContent = `Successfully resolved coordinates: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
                    statusEl.className = "block text-[8px] text-emerald-400 mt-1 font-bold";
                } else {
                    statusEl.textContent = "Failed to resolve coordinates: " + (data.error || "Invalid response");
                    statusEl.className = "block text-[8px] text-rose-400 mt-1 font-bold";
                }
            } catch (err) {
                statusEl.textContent = "Resolution network error: " + err.message;
                statusEl.className = "block text-[8px] text-rose-400 mt-1 font-bold";
            }
        }

        function saveHQConfig(e) {
            e.preventDefault();
            const latVal = parseFloat(document.getElementById('hq-lat').value);
            const lngVal = parseFloat(document.getElementById('hq-lng').value);
            const hq = {
                name: document.getElementById('hq-name').value,
                lat: isNaN(latVal) ? 16.774687 : latVal,
                lng: isNaN(lngVal) ? 96.163438 : lngVal,
                address: document.getElementById('hq-address').value,
                maps_url: document.getElementById('hq-maps-url').value
            };
            localStorage.setItem('hq_config', JSON.stringify(hq));
            alert("Head Office Location settings saved! Redrawing map...");
            
            if (map) {
                map.setView([hq.lat, hq.lng], 12);
                refreshDashboardData();
            }
        }

        function toggleCustomerTypeFields(val) {
            const corpField = document.getElementById('corporate-client-field');
            const indField = document.getElementById('individual-customer-fields');
            if (val === 'Individual') {
                corpField.classList.add('hidden');
                indField.classList.remove('hidden');
                indField.querySelectorAll('input').forEach(i => i.required = true);
                const searchInput = document.getElementById('lookup-client-search');
                if (searchInput) searchInput.required = false;
            } else {
                corpField.classList.remove('hidden');
                indField.classList.add('hidden');
                indField.querySelectorAll('input').forEach(i => {
                    i.required = false;
                    i.value = '';
                });
                const searchInput = document.getElementById('lookup-client-search');
                if (searchInput) searchInput.required = true;
                const hiddenInput = document.getElementById('lookup-client');
                if (hiddenInput) hiddenInput.value = '';
                if (searchInput) searchInput.value = '';
            }
        }

        function setupSearchableClientsListeners() {
            const corpSearch = document.getElementById('lookup-client-search');
            const corpIdHidden = document.getElementById('lookup-client');
            if (corpSearch) {
                corpSearch.addEventListener('input', (e) => {
                    const val = e.target.value;
                    const match = val.match(/\[(CLI-[A-Z0-9-]+)\]/);
                    if (match && match[1]) {
                        corpIdHidden.value = match[1];
                    } else {
                        const client = window.allClientsList?.find(c => c.company_name === val);
                        corpIdHidden.value = client ? client.id : '';
                    }
                });
            }

            const indSearch = document.getElementById('lookup-individual-search');
            if (indSearch) {
                indSearch.addEventListener('input', (e) => {
                    const val = e.target.value;
                    const match = val.match(/\[(CLI-IND-[A-Z0-9-]+)\]/) || val.match(/\[(CLI-[A-Z0-9-]+)\]/);
                    let selectedClient = null;
                    
                    if (match && match[1]) {
                        selectedClient = window.allClientsList?.find(c => c.id === match[1]);
                    } else {
                        selectedClient = window.allClientsList?.find(c => c.company_name === val && c.amc_status === 'Individual');
                    }

                    const phoneInput = document.querySelector('input[name="customer_phone"]');
                    const addressInput = document.querySelector('input[name="customer_address"]');
                    
                    if (selectedClient) {
                        corpIdHidden.value = selectedClient.id;
                        if (phoneInput) phoneInput.value = selectedClient.phone || '';
                        if (addressInput) addressInput.value = selectedClient.address || '';
                    } else {
                        corpIdHidden.value = '';
                    }
                });

                indSearch.addEventListener('blur', (e) => {
                    const val = e.target.value;
                    const cleanVal = val.replace(/\s*\[(CLI-IND-[A-Z0-9-]+|CLI-[A-Z0-9-]+)\]$/, '');
                    if (cleanVal !== val) {
                        e.target.value = cleanVal;
                    }
                });
            }
        }

        function initLeafletMap() {
            if (map) return;
            const hq = loadHQConfig();
            map = L.map('map').setView([hq.lat, hq.lng], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(map);
        }

        async function refreshDashboardData() {
            await populateLookupDropdowns();
            await loadJobsData();
            await loadInventoryData();
            await loadRMAData();
            await loadCashSafeData();
            await loadTechniciansData();
            await populateReports();
        }

        async function populateReports() {
            const baseUrl = document.getElementById('api-base').value;
            try {
                const jobsRes = await fetch(`${baseUrl}/api/jobs`);
                const jobs = await jobsRes.json();

                const lookupsRes = await fetch(`${baseUrl}/api/admin/lookups`);
                const lookups = await lookupsRes.json();

                const totalTickets = jobs.length;
                const completedJobs = jobs.filter(j => j.status === 'Completed').length;
                const completionRate = totalTickets > 0 ? Math.round((completedJobs / totalTickets) * 100) : 0;

                document.getElementById('report-total-tickets').textContent = totalTickets;
                document.getElementById('report-completion-rate').textContent = `${completionRate}%`;

                const safeRes = await fetch(`${baseUrl}/api/admin/cash/safe`);
                const safe = await safeRes.json();
                document.getElementById('report-usd-safe').textContent = `$${safe.usd_balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                document.getElementById('report-mmk-safe').textContent = `${safe.mmk_balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} Ks`;

                const amcCounts = { 'Active': 0, 'Inactive': 0, 'Expired': 0, 'No AMC': 0, 'Individual': 0 };
                lookups.clients.forEach(c => {
                    const status = c.amc_status || 'Inactive';
                    if (amcCounts[status] !== undefined) {
                        amcCounts[status]++;
                    }
                });

                const amcBody = document.getElementById('report-amc-body');
                amcBody.innerHTML = '';
                Object.entries(amcCounts).forEach(([status, count]) => {
                    let badgeClass = 'text-slate-400';
                    if (status === 'Active') badgeClass = 'text-emerald-400 font-bold';
                    else if (status === 'Expired') badgeClass = 'text-rose-400';
                    else if (status === 'No AMC') badgeClass = 'text-amber-500';
                    else if (status === 'Individual') badgeClass = 'text-indigo-400';

                    amcBody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                            <td class="py-2.5 font-semibold ${badgeClass}">${status}</td>
                            <td class="py-2.5 text-right font-mono font-bold">${count} clients</td>
                        </tr>
                    `;
                });

                const techLoad = {};
                lookups.technicians.forEach(t => {
                    techLoad[t.id] = { name: t.name, assigned: 0, completed: 0 };
                });

                jobs.forEach(j => {
                    if (techLoad[j.technician_id]) {
                        techLoad[j.technician_id].assigned++;
                        if (j.status === 'Completed') {
                            techLoad[j.technician_id].completed++;
                        }
                    }
                });

                const techsBody = document.getElementById('report-techs-body');
                techsBody.innerHTML = '';
                Object.values(techLoad).forEach(t => {
                    const rate = t.assigned > 0 ? Math.round((t.completed / t.assigned) * 100) : 0;
                    techsBody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                            <td class="py-2.5 font-semibold">${t.name}</td>
                            <td class="py-2.5 text-center font-mono">${t.assigned} jobs</td>
                            <td class="py-2.5 text-right font-mono font-bold text-emerald-400">${rate}% (${t.completed}/${t.assigned})</td>
                        </tr>
                    `;
                });

            } catch(e) {
                console.error("Failed to populate reports:", e);
            }
        }

        async function populateLookupDropdowns() {
            const baseUrl = document.getElementById('api-base').value;
            const techSelect = document.getElementById('lookup-tech');

            try {
                const res = await fetch(`${baseUrl}/api/admin/lookups`);
                if (!res.ok) throw new Error("Could not capture dynamic dataset listings.");
                const data = await res.json();

                // Cache globally
                window.allClientsList = data.clients || [];

                // Populate corporate datalist (amc_status !== 'Individual')
                const corpDatalist = document.getElementById('corporate-clients-datalist');
                if (corpDatalist) {
                    corpDatalist.innerHTML = '';
                    window.allClientsList.filter(c => c.amc_status !== 'Individual').forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = `${c.company_name} [${c.id}]`;
                        corpDatalist.appendChild(opt);
                    });
                }

                // Populate individual datalist (amc_status === 'Individual')
                const indDatalist = document.getElementById('individual-clients-datalist');
                if (indDatalist) {
                    indDatalist.innerHTML = '';
                    window.allClientsList.filter(c => c.amc_status === 'Individual').forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = `${c.company_name} [${c.id}]`;
                        indDatalist.appendChild(opt);
                    });
                }

                techSelect.innerHTML = '';
                data.technicians.forEach(t => {
                    techSelect.innerHTML += `<option value="${t.id}" class="bg-slate-900">${t.name} [${t.id}]</option>`;
                });
            } catch (err) {
                console.error("Error populating lookups:", err);
            }
        }

        let activeCatalogList = [];
        let activeBatchesList = [];

        async function loadInventoryData() {
            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            try {
                // 1. Fetch catalog
                const catRes = await fetch(`${baseUrl}/api/admin/inventory/list`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (catRes.ok) {
                    activeCatalogList = await catRes.json();
                }

                // 2. Fetch batches
                const batRes = await fetch(`${baseUrl}/api/admin/inventory/batches`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (batRes.ok) {
                    activeBatchesList = await batRes.json();
                }

                renderBatchesTable();
                renderSalesPricing();
            } catch(e) {
                console.error("Inventory fetch exception", e);
            }
        }

        window.switchInvModule = function(module) {
            const panels = ['batches','pricing','catalog','add-batch','add-model','update-price'];
            panels.forEach(p => {
                const el = document.getElementById(`inv-panel-${p}`);
                if (el) el.classList.add('hidden');
            });
            const active = document.getElementById(`inv-panel-${module}`);
            if (active) active.classList.remove('hidden');
            const mainMods = ['batches','pricing','catalog'];
            mainMods.forEach(m => {
                const btn = document.getElementById(`inv-mod-${m}`);
                if (btn) {
                    if (m === module) {
                        btn.classList.add('active-inv-mod');
                        btn.classList.remove('text-slate-400','hover:text-white','hover:bg-white/5');
                    } else {
                        btn.classList.remove('active-inv-mod');
                        btn.classList.add('text-slate-400','hover:text-white','hover:bg-white/5');
                    }
                }
            });
        };
        window.setInventoryTab = window.switchInvModule;

        function renderBatchesTable() {
            const tbody = document.getElementById('batches-stock-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (activeBatchesList.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-600 text-[11px]">No stock batches registered yet.</td></tr>';
                return;
            }
            activeBatchesList.forEach((b, idx) => {
                const totalUnits = b.serials ? b.serials.length : 0;
                const availableUnits = b.serials ? b.serials.filter(s => s.status === 'Active').length : 0;
                const soldUnits = totalUnits - availableUnits;
                const importDate = b.created_at ? b.created_at.substring(0,10) : '—';
                let serialsHtml = '';
                if (b.serials && b.serials.length > 0) {
                    b.serials.forEach(s => {
                        if (s.status === 'Active') {
                            serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center"><span class="font-mono text-slate-300 text-[10px] truncate">${s.serial_number}</span><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 shrink-0"></span></div>`;
                        } else {
                            const details = s.job_id ? `Job: ${s.job_id}` : 'SOLD';
                            serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center opacity-40"><span class="font-mono text-slate-500 text-[10px] line-through truncate" title="${details}">${s.serial_number}</span><span class="text-[8px] text-amber-500 font-bold ml-1 shrink-0">SOLD</span></div>`;
                        }
                    });
                } else {
                    serialsHtml = '<div class="col-span-4 text-slate-500 italic text-[10px]">No serials registered.</div>';
                }
                tbody.innerHTML += `
                    <tr class="clickable-row group cursor-pointer border-b border-white/5 hover:bg-white/5 transition-all align-middle"
                        onclick="document.getElementById('serials-row-${idx}').classList.toggle('hidden'); const a = this.querySelector('.expand-arrow'); if(a) a.style.transform = a.style.transform === 'rotate(90deg)' ? '' : 'rotate(90deg)';">
                        <td class="px-4 py-2.5"><span class="expand-arrow text-emerald-500 text-[11px] inline-block transition-transform duration-200">›</span></td>
                        <td class="px-4 py-2.5 font-mono text-[11px] font-semibold text-white">${b.batch_code}</td>
                        <td class="px-4 py-2.5 text-[11px] text-slate-300">${b.item_name || '—'}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${b.category || '—'}</td>
                        <td class="px-4 py-2.5 font-mono text-[11px] text-sky-400">$${parseFloat(b.buying_price || 0).toFixed(2)}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-400">${b.supplier || '—'}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] font-bold text-white">${totalUnits}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] font-bold text-emerald-400">${availableUnits}</td>
                        <td class="px-4 py-2.5 text-center font-mono text-[12px] text-rose-400">${soldUnits > 0 ? soldUnits : '—'}</td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${importDate}</td>
                    </tr>
                    <tr id="serials-row-${idx}" class="hidden bg-black/30">
                        <td colspan="10" class="px-6 py-3">
                            <p class="text-[8px] font-bold text-slate-500 uppercase tracking-widest mb-2">Serial Numbers · ${b.batch_code}</p>
                            <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-1.5">${serialsHtml}</div>
                        </td>
                    </tr>
                `;
            });
        }

        function renderSalesPricing() {
            const pricingBody = document.getElementById('sales-pricing-body');
            const catalogBody = document.getElementById('catalog-models-body');
            const batchSelect = document.getElementById('batch-item-code');
            const updateSelect = document.getElementById('price-update-item-code');
            const filterSelect = document.getElementById('batch-filter-model');
            const prevBatchVal = batchSelect ? batchSelect.value : '';
            const prevUpdateVal = updateSelect ? updateSelect.value : '';
            if (batchSelect) batchSelect.innerHTML = '<option value="">-- Choose Model --</option>';
            if (updateSelect) updateSelect.innerHTML = '<option value="">-- Choose Device --</option>';
            if (filterSelect) filterSelect.innerHTML = '<option value="">— All Models —</option>';
            if (pricingBody) pricingBody.innerHTML = '';
            if (catalogBody) catalogBody.innerHTML = '';
            if (activeCatalogList.length === 0) {
                if (pricingBody) pricingBody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
                if (catalogBody) catalogBody.innerHTML = '<tr><td colspan="5" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
                return;
            }
            activeCatalogList.forEach((item) => {
                const opt = `<option value="${item.item_code}">${item.item_name} [${item.item_code}]</option>`;
                if (batchSelect) batchSelect.innerHTML += opt;
                if (updateSelect) updateSelect.innerHTML += opt;
                if (filterSelect) filterSelect.innerHTML += `<option value="${item.item_code}">${item.item_name}</option>`;
                const priceUSD = item.unit_price ? `$${parseFloat(item.unit_price).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—';
                const priceMMK = item.unit_price_mmk ? `Ks ${parseInt(item.unit_price_mmk).toLocaleString()}` : '—';
                const usdColor = item.unit_price ? 'text-emerald-400' : 'text-slate-600';
                const mmkColor = item.unit_price_mmk ? 'text-amber-400' : 'text-slate-600';
                const inStock = activeBatchesList.filter(b => b.item_code === item.item_code).reduce((sum,b) => sum + (b.serials ? b.serials.filter(s => s.status==='Active').length : 0), 0);
                const stockColor = inStock > 5 ? 'text-emerald-400' : inStock > 0 ? 'text-amber-400' : 'text-rose-400';
                if (pricingBody) pricingBody.innerHTML += `<tr class="border-b border-white/5 hover:bg-white/5 transition-all text-[11px]"><td class="px-4 py-2.5 font-mono text-sky-400 font-semibold">${item.item_code}</td><td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td><td class="px-4 py-2.5 text-slate-400">${item.category||'—'}</td><td class="px-4 py-2.5 text-center font-mono font-bold ${stockColor}">${inStock}</td><td class="px-4 py-2.5 text-right font-mono font-bold ${usdColor}">${priceUSD}</td><td class="px-4 py-2.5 text-right font-mono font-bold ${mmkColor}">${priceMMK}</td><td class="px-4 py-2.5 text-center"><button onclick="window.switchInvModule('update-price'); setTimeout(() => { const s = document.getElementById('price-update-item-code'); if(s){ s.value='${item.item_code}'; window.populatePriceFields('${item.item_code}'); } }, 50);" class="px-2.5 py-1 text-[9px] font-bold text-sky-400 border border-sky-500/20 hover:bg-sky-500/10 rounded transition-all">Edit</button></td></tr>`;
                if (catalogBody) catalogBody.innerHTML += `<tr class="border-b border-white/5 hover:bg-white/5 transition-all text-[11px]"><td class="px-4 py-2.5 font-mono text-sky-400">${item.item_code}</td><td class="px-4 py-2.5 text-white">${item.item_name}</td><td class="px-4 py-2.5 text-slate-400">${item.category||'—'}</td><td class="px-4 py-2.5 text-center font-mono font-bold ${stockColor}">${inStock}</td><td class="px-4 py-2.5 text-right"><button class="text-[9px] text-rose-400 border border-rose-500/10 hover:bg-rose-500/5 px-2 py-0.5 rounded transition-all">Del</button></td></tr>`;
            });
            if (batchSelect && prevBatchVal) batchSelect.value = prevBatchVal;
            if (updateSelect && prevUpdateVal) updateSelect.value = prevUpdateVal;
        }

        window.filterBatchTable = function() {
            const q = (document.getElementById('batch-search-input')?.value || '').toLowerCase();
            document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach(row => {
                row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };
        window.filterBatchByModel = function(val) {
            document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach(row => {
                if (!val) { row.style.display = ''; return; }
                const match = activeBatchesList.some(b => b.item_code === val && row.textContent.includes(b.batch_code));
                row.style.display = match ? '' : 'none';
            });
        };

        window.populatePriceFields = function(itemCode) {
            const item = activeCatalogList.find(c => c.item_code === itemCode);
            const usdInput = document.getElementById('price-update-usd');
            const mmkInput = document.getElementById('price-update-mmk');
            
            if (item) {
                if (usdInput) usdInput.value = item.unit_price || 0;
                if (mmkInput) mmkInput.value = item.unit_price_mmk || 0;
            } else {
                if (usdInput) usdInput.value = '';
                if (mmkInput) mmkInput.value = '';
            }
        };

        window.submitNewBatch = async function(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            
            const batch_code = document.getElementById('batch-code').value.trim().toUpperCase();
            const item_code = document.getElementById('batch-item-code').value;
            const buying_price = parseFloat(document.getElementById('batch-buying-price').value) || 0;
            const serialsRaw = document.getElementById('batch-serials').value;

            // Parse serial numbers
            const serials = serialsRaw
                .split(/[\n,;]/)
                .map(sn => sn.trim())
                .filter(sn => sn !== '');

            try {
                const res = await fetch(`${baseUrl}/api/admin/inventory/batches/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ batch_code, item_code, buying_price, serials })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || 'Batch created successfully.');
                    e.target.reset();
                    loadInventoryData();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Request failed: ' + err.message);
            }
        };

        window.submitPriceUpdate = async function(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            
            const item_code = document.getElementById('price-update-item-code').value;
            const unit_price = parseFloat(document.getElementById('price-update-usd').value) || 0;
            const unit_price_mmk = parseInt(document.getElementById('price-update-mmk').value) || 0;

            try {
                const res = await fetch(`${baseUrl}/api/admin/inventory/catalog/price`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ item_code, unit_price, unit_price_mmk })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || 'Selling prices updated successfully.');
                    e.target.reset();
                    loadInventoryData();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Request failed: ' + err.message);
            }
        };

        window.submitNewCatalogItem = async function(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            
            const item_name = document.getElementById('catalog-item-name').value.trim();
            const item_code = document.getElementById('catalog-item-code').value.trim().toUpperCase();
            const category = document.getElementById('catalog-item-category').value;

            try {
                const res = await fetch(`${baseUrl}/api/admin/inventory/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ item_code, item_name, category, stock_qty: 0, unit_price: 0, unit_price_mmk: 0 })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || 'Catalog model provisioned successfully.');
                    e.target.reset();
                    loadInventoryData();
                } else {
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Request failed: ' + err.message);
            }
        };

        async function deleteInventoryItem(item_code) {
            if (!confirm(`Remove "${item_code}" from the catalog? This cannot be undone.`)) return;
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            try {
                const res = await fetch(`${baseUrl}/api/admin/inventory/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ item_code })
                });
                if (res.ok) {
                    loadInventoryData();
                } else {
                    const data = await res.json();
                    alert('Error: ' + data.error);
                }
            } catch(err) {
                alert('Request failed: ' + err.message);
            }
        }

        function openRegisterWarrantyModal() {
            document.getElementById('modal-register-warranty').classList.remove('hidden');
            const baseUrl = document.getElementById('api-base').value;
            fetch(`${baseUrl}/api/admin/lookups`)
                .then(res => res.json())
                .then(data => {
                    const sel = document.getElementById('modal-warranty-client');
                    sel.innerHTML = '';
                    data.clients.forEach(c => {
                        sel.innerHTML += `<option value="${c.id}" class="bg-slate-900">${c.company_name} [${c.id}]</option>`;
                    });
                })
                .catch(console.error);
        }

        function closeRegisterWarrantyModal() {
            document.getElementById('modal-register-warranty').classList.add('hidden');
        }

        function openRaiseRMAModal() {
            document.getElementById('modal-raise-rma').classList.remove('hidden');
            const baseUrl = document.getElementById('api-base').value;
            fetch(`${baseUrl}/api/admin/warranty/list`)
                .then(res => res.json())
                .then(warranties => {
                    const sel = document.getElementById('modal-rma-serial');
                    sel.innerHTML = '';
                    if (warranties.length === 0) {
                        sel.innerHTML = '<option value="">(No active product warranties registered)</option>';
                        return;
                    }
                    warranties.forEach(w => {
                        sel.innerHTML += `<option value="${w.serial_number}" class="bg-slate-900">${w.serial_number} - ${w.device_name}</option>`;
                    });
                })
                .catch(console.error);
        }

        function closeRaiseRMAModal() {
            document.getElementById('modal-raise-rma').classList.add('hidden');
        }

        async function submitRegisterWarranty(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const form = e.target;
            const payload = {
                serial_number: form.serial_number.value.trim(),
                device_name: form.device_name.value.trim(),
                client_id: parseInt(form.client_id.value),
                installed_date: form.installed_date.value,
                warranty_months: parseInt(form.warranty_months.value)
            };

            try {
                const res = await fetch(`${baseUrl}/api/admin/warranty/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert("Customer product warranty registered!");
                    closeRegisterWarrantyModal();
                    form.reset();
                    loadRMAData();
                } else {
                    const err = await res.json();
                    alert("Error registering warranty: " + err.error);
                }
            } catch (err) {
                alert("Network error: " + err.message);
            }
        }

        async function submitRaiseRMA(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const form = e.target;
            const payload = {
                serial_number: form.serial_number.value,
                distributor: form.distributor.value.trim(),
                rma_id: form.rma_id.value.trim(),
                sent_date: form.sent_date.value
            };

            if (!payload.serial_number) {
                alert("Please select a serial number first.");
                return;
            }

            try {
                const res = await fetch(`${baseUrl}/api/admin/rma/raise`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert("Distributor RMA claim raised!");
                    closeRaiseRMAModal();
                    form.reset();
                    loadRMAData();
                } else {
                    const err = await res.json();
                    alert("Error raising claim: " + err.error);
                }
            } catch (err) {
                alert("Network error: " + err.message);
            }
        }

        async function loadRMAData() {
            const baseUrl = document.getElementById('api-base').value;
            const warrantyBody = document.getElementById('warranty-list-body');
            const rmaBody = document.getElementById('rma-list-body');

            try {
                const res = await fetch(`${baseUrl}/api/admin/warranty/list`);
                if (!res.ok) throw new Error();
                const warranties = await res.json();

                warrantyBody.innerHTML = '';
                if (warranties.length === 0) {
                    warrantyBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-600">No active customer warranties registered.</td></tr>';
                } else {
                    warranties.forEach(item => {
                        const startDate = item.installed_date ? new Date(item.installed_date) : null;
                        const months = parseInt(item.warranty_months) || 12;
                        let endDate = null;
                        let isExpired = false;
                        if (startDate) {
                            endDate = new Date(startDate);
                            endDate.setMonth(startDate.getMonth() + months);
                            isExpired = endDate < new Date();
                        }
                        const endStr = endDate ? endDate.toISOString().split('T')[0] : 'N/A';
                        const statusBadge = isExpired
                            ? '<span class="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded font-semibold text-[10px]">Expired</span>'
                            : '<span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-semibold text-[10px]">Active</span>';

                        warrantyBody.innerHTML += `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                                <td class="py-2.5 font-mono text-amber-500 font-bold">${item.serial_number}</td>
                                <td class="py-2.5 font-semibold text-white">${item.device_name}</td>
                                <td class="py-2.5">${item.company_name || 'Individual Customer'}</td>
                                <td class="py-2.5 font-mono">${endStr}</td>
                                <td class="py-2.5">${statusBadge}</td>
                            </tr>
                        `;
                    });
                }
            } catch(e) {
                console.error("Warranties fetch exception", e);
            }

            try {
                const res = await fetch(`${baseUrl}/api/admin/rma/list`);
                if (!res.ok) throw new Error();
                const rmaList = await res.json();

                rmaBody.innerHTML = '';
                if (rmaList.length === 0) {
                    rmaBody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-600">No active distributor claims registered.</td></tr>';
                } else {
                    rmaList.forEach(item => {
                        const statusColor = item.status === 'RMA Completed' ? 'text-emerald-400' : 'text-amber-400';
                        const sentStr = item.installed_date ? item.installed_date : 'N/A';

                        rmaBody.innerHTML += `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                                <td class="py-2.5 font-mono text-amber-500 font-bold">${item.rma_tracking_id || 'RMA-3001'}</td>
                                <td class="py-2.5">
                                    <div class="font-mono text-slate-400">${item.serial_number}</div>
                                    <div class="font-semibold text-white">${item.device_name}</div>
                                </td>
                                <td class="py-2.5">${item.distributor || 'Supplier'}</td>
                                <td class="py-2.5 font-mono">${sentStr}</td>
                                <td class="py-2.5">
                                    <span class="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-bold text-[10px] uppercase ${statusColor}">
                                        ${item.status === 'RMA Sent' ? 'Sent To Supplier' : item.status}
                                    </span>
                                </td>
                                <td class="py-2.5 text-right">
                                    <button onclick="resolveRMAClaim('${item.serial_number}')" class="text-slate-400 hover:text-emerald-400 text-sm" title="Mark Resolved">
                                        ✔
                                    </button>
                                </td>
                            </tr>
                        `;
                    });
                }
            } catch(e) {
                console.error("RMA fetch exception", e);
            }
        }

        async function resolveRMAClaim(serialNumber) {
            if (!confirm("Are you sure this distributor RMA claim has been resolved / replaced?")) return;
            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/admin/rma/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        serial_number: serialNumber,
                        status: 'RMA Completed',
                        distributor: '',
                        rma_tracking_id: ''
                    })
                });
                if (res.ok) {
                    alert("RMA claim marked completed.");
                    loadRMAData();
                }
            } catch(e) {}
        }

        let distributorsList = [];

        function openAddDistributorModal() {
            document.getElementById('modal-add-distributor').classList.remove('hidden');
        }

        function closeAddDistributorModal() {
            document.getElementById('modal-add-distributor').classList.add('hidden');
        }

        async function submitAddDistributor(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const form = e.target;
            const payload = {
                name: form.name.value.trim(),
                contact_person: form.contact_person.value.trim(),
                phone: form.phone.value.trim(),
                email: form.email.value.trim(),
                product_lines: form.product_lines.value.trim()
            };

            try {
                const res = await fetch(`${baseUrl}/api/admin/distributors/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    alert("Distributor added successfully!");
                    closeAddDistributorModal();
                    form.reset();
                    loadDistributorsData();
                } else {
                    const err = await res.json();
                    alert("Error: " + err.error);
                }
            } catch (err) {
                alert("Network error: " + err.message);
            }
        }

        async function loadDistributorsData() {
            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/admin/distributors/list`);
                if (!res.ok) throw new Error();
                distributorsList = await res.json();
                renderDistributorsTable(distributorsList);
            } catch (err) {
                console.error("Failed to load distributors list", err);
            }
        }

        function renderDistributorsTable(list) {
            const tbody = document.getElementById('distributors-list-body');
            tbody.innerHTML = '';
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-600">No distributors registered.</td></tr>';
                return;
            }
            list.forEach(d => {
                tbody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                        <td class="py-2.5 font-bold text-amber-500">${d.name}</td>
                        <td class="py-2.5 font-semibold text-white">${d.contact_person}</td>
                        <td class="py-2.5 font-mono">${d.phone}</td>
                        <td class="py-2.5 font-mono text-slate-400">${d.email}</td>
                        <td class="py-2.5 text-slate-400">${d.product_lines}</td>
                        <td class="py-2.5 text-right">
                            <button onclick="deleteDistributor(${d.id})" class="text-rose-400 hover:text-rose-300 font-bold px-2 py-1 text-xs">
                                🗑️
                            </button>
                        </td>
                    </tr>
                `;
            });
        }

        async function deleteDistributor(id) {
            if (!confirm("Are you sure you want to delete this distributor?")) return;
            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/admin/distributors/delete?id=${id}`, { method: 'DELETE' });
                if (res.ok) {
                    alert("Distributor deleted.");
                    loadDistributorsData();
                }
            } catch(e) {}
        }

        function filterDistributors() {
            const query = document.getElementById('distributor-search-input').value.toLowerCase().trim();
            const filtered = distributorsList.filter(d => 
                d.name.toLowerCase().includes(query) || 
                d.product_lines.toLowerCase().includes(query) ||
                d.contact_person.toLowerCase().includes(query)
            );
            renderDistributorsTable(filtered);
        }

        async function loadCashSafeData() {
            const baseUrl = document.getElementById('api-base').value;
            try {
                // Balance
                const balanceRes = await fetch(`${baseUrl}/api/admin/cash/safe`);
                const safe = await balanceRes.json();
                document.getElementById('safe-usd-balance').textContent = `$${safe.usd_balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}`;
                document.getElementById('safe-mmk-balance').textContent = `${safe.mmk_balance.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})} Ks`;

                // Transactions
                const txRes = await fetch(`${baseUrl}/api/admin/cash/transactions`);
                cashTransactions = await txRes.json();
                renderCashTable();
            } catch(e){}
        }

        function changeCashPage(delta) {
            cashPage += delta;
            renderCashTable();
        }

        function renderCashTable() {
            const ledgerBody = document.getElementById('cash-ledger-body');
            const totalPages = Math.ceil(cashTransactions.length / cashPerPage) || 1;

            if (cashPage < 1) cashPage = 1;
            if (cashPage > totalPages) cashPage = totalPages;

            document.getElementById('cash-page-indicator').textContent = `Page ${cashPage} of ${totalPages}`;
            document.getElementById('btn-cash-prev').disabled = (cashPage === 1);
            document.getElementById('btn-cash-next').disabled = (cashPage === totalPages);

            const start = (cashPage - 1) * cashPerPage;
            const end = start + cashPerPage;
            const sliced = cashTransactions.slice(start, end);

            ledgerBody.innerHTML = '';
            sliced.forEach(tx => {
                const badge = tx.transaction_type === 'Deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400';
                const amountPrefix = tx.transaction_type === 'Deposit' ? '+' : '-';
                ledgerBody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td class="py-2 text-slate-400 font-mono">${new Date(tx.created_at).toLocaleDateString()}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] ${badge}">${tx.transaction_type}</span></td>
                        <td class="py-2 font-mono font-bold text-amber-500">${amountPrefix}${tx.primary_currency === 'USD' ? '$' : ''}${tx.amount.toLocaleString()} ${tx.primary_currency === 'MMK' ? 'Ks' : ''}</td>
                        <td class="py-2 font-mono text-slate-400">${tx.exchange_rate}</td>
                        <td class="py-2 font-mono text-slate-300">${tx.equivalent_amount.toLocaleString()} Ks</td>
                        <td class="py-2 text-slate-400">${tx.notes || ''} ${tx.job_id ? `[Ref: ${tx.job_id}]` : ''}</td>
                    </tr>
                `;
            });
        }

        async function submitCashTransaction(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const transaction_type = document.getElementById('cash-type').value;
            const primary_currency = document.getElementById('cash-currency').value;
            const amount = document.getElementById('cash-amount').value;
            const exchange_rate = document.getElementById('cash-rate').value;
            const job_id = document.getElementById('cash-job-id').value.trim();
            const notes = document.getElementById('cash-notes').value;

            try {
                const res = await fetch(`${baseUrl}/api/admin/cash/transact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transaction_type, primary_currency, amount, exchange_rate, job_id, notes })
                });
                if (res.ok) {
                    alert("Cash safe reserve ledger transaction recorded.");
                    document.getElementById('cash-amount').value = '';
                    document.getElementById('cash-notes').value = '';
                    document.getElementById('cash-job-id').value = '';
                    loadCashSafeData();
                }
            } catch(e){}
        }

        async function loadTechniciansData() {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            const tbody = document.getElementById('tech-list-body');
            
            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians`, {
                    headers: { 'X-Admin-Secret': secret }
                });
                if (!res.ok) throw new Error("Unauthorized or server error");
                const techs = await res.json();
                
                tbody.innerHTML = '';
                if (techs.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-600">No technicians registered in database.</td></tr>';
                    return;
                }
                
                techs.forEach(t => {
                    const statusBadge = t.active === 1 
                        ? '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-emerald-500/10 text-emerald-400">Active</span>' 
                        : '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-amber-500/10 text-amber-400">Pending Approval</span>';
                    
                    const roleSelect = `
                        <select id="role-${t.id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                            <option value="Technician" ${t.role === 'Technician' ? 'selected' : ''}>Technician</option>
                            <option value="Sales" ${t.role === 'Sales' ? 'selected' : ''}>Sales</option>
                            <option value="Admin" ${t.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    `;
                    
                    const actionButton = t.active === 1 
                        ? `<button onclick="updateTechnicianStatus('${t.id}', 0)" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Deactivate</button>` 
                        : `<button onclick="updateTechnicianStatus('${t.id}', 1)" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Approve</button>`;
                    
                    tbody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all align-middle">
                            <td class="py-2.5 font-bold">${t.name}</td>
                            <td class="py-2.5 text-slate-400 font-mono">${t.email || (t.username ? '@' + t.username : 'N/A')}</td>
                            <td class="py-2.5">${roleSelect}</td>
                            <td class="py-2.5">${statusBadge}</td>
                            <td class="py-2.5 text-right space-x-1">
                                <button onclick="saveTechnicianRole('${t.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-3 py-1 rounded-lg">Save Role</button>
                                ${actionButton}
                            </td>
                        </tr>
                    `;
                });
            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-rose-400">Failed to load team data: ${err.message}</td></tr>`;
            }
        }

        async function updateTechnicianStatus(id, active) {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            const role = document.getElementById(`role-${id}`).value;
            
            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ id, role, active })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Technician updated successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Request failed: " + err.message);
            }
        }

        async function saveTechnicianRole(id) {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;
            const role = document.getElementById(`role-${id}`).value;
            
            try {
                const tbody = document.getElementById('tech-list-body');
                const row = Array.from(tbody.querySelectorAll('tr')).find(tr => tr.innerHTML.includes(id));
                const active = row.innerHTML.includes('bg-emerald-500/10') ? 1 : 0;
                
                const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ id, role, active })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Technician role updated successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Request failed: " + err.message);
            }
        }

        async function loadJobsData() {
            const baseUrl = document.getElementById('api-base').value;

            try {
                const res = await fetch(`${baseUrl}/api/jobs`);
                const jobs = await res.json();
                
                // 1. Populate map markers
                plotJobsOnMap(jobs);

                // 2. Render Analytics Charts
                renderAnalytics(jobs);

                // 3. Render Dashboard Jobs
                renderDashboardJobs(jobs);

                // 4. Render Full Jobs Log
                renderFullJobsTable(jobs);

                // 5. Update Stats Widgets
                calculateStats(jobs);

                // 6. Initialize drag-and-drop calendar scheduler
                initFullCalendar(jobs);
            } catch (err) {
                console.error("Error pulling remote jobs data:", err);
            }
        }

        function calculateStats(jobs) {
            // Stats counts
            const activeTickets = jobs.filter(j => j.status === 'Pending' || j.status === 'In Progress').length;
            const pendingTickets = jobs.filter(j => j.status === 'Pending').length;
            document.getElementById('stat-active-tickets').textContent = activeTickets;
            
            // Assume 4 total engineers for mock display
            const activeTechs = new Set(jobs.filter(j => j.status === 'In Progress').map(j => j.technician_id)).size;
            document.getElementById('stat-techs-onsite').textContent = activeTechs;

            // Total revenue mock aggregation (could parse USD service receipts)
            let totalUSD = 0;
            jobs.forEach(j => {
                if (j.status === 'Completed') {
                    // Try to extract some service charge (mock values for now)
                    totalUSD += j.service_type === 'CCTV' ? 1380 : j.service_type === 'Networking' ? 120 : 250;
                }
            });
            document.getElementById('stat-total-revenue').textContent = `$${totalUSD.toLocaleString()}`;
        }

        function renderDashboardJobs(jobs) {
            const tbody = document.getElementById('dashboard-tickets-body');
            tbody.innerHTML = '';
            
            // Slice to first 5 recent jobs
            const sliced = jobs.slice(0, 5);
            sliced.forEach(j => {
                const statusBadge = j.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : j.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500';
                
                // Mock pricing to match screen reference
                const fee = j.service_type === 'CCTV' ? '$1,380.00' : j.service_type === 'Networking' ? '$120.00' : '900,000 MMK';
                
                tbody.innerHTML += `
                    <tr class="hover:bg-white/5 transition-all align-middle text-slate-300">
                        <td class="py-3 font-mono font-bold text-amber-500">${j.id}</td>
                        <td class="py-3 font-medium text-white">${j.company_name || 'Anonymous Client'}</td>
                        <td class="py-3 text-slate-400">${j.service_type}</td>
                        <td class="py-3 font-medium">${j.tech_name || 'Unassigned'}</td>
                        <td class="py-3"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                        <td class="py-3 font-mono font-bold">${fee}</td>
                        <td class="py-3 font-mono text-[10px] text-slate-500">${new Date(j.created_at || Date.now()).toLocaleDateString()}</td>
                    </tr>
                `;
            });
        }

        function renderFullJobsTable(jobs) {
            const tbody = document.getElementById('full-jobs-body');
            tbody.innerHTML = '';
            
            jobs.forEach(j => {
                const statusBadge = j.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : j.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-500';
                
                // Construct photos UI
                let photosHtml = '';
                if (j.before_photo) {
                    photosHtml += `<div class="space-y-1">
                        <span class="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">Before Photo</span>
                        <img src="${j.before_photo}" class="w-20 h-16 object-cover rounded-lg border border-white/10 hover:scale-105 transition-all cursor-pointer" onclick="window.open().document.write('<img src=\\'${j.before_photo.replace(/'/g, "\\'")}\\' style=\\'max-width:100%\\' />')">
                    </div>`;
                }
                if (j.after_photo) {
                    photosHtml += `<div class="space-y-1">
                        <span class="block text-[8px] uppercase tracking-wider text-slate-500 font-bold">After Photo</span>
                        <img src="${j.after_photo}" class="w-20 h-16 object-cover rounded-lg border border-white/10 hover:scale-105 transition-all cursor-pointer" onclick="window.open().document.write('<img src=\\'${j.after_photo.replace(/'/g, "\\'")}\\' style=\\'max-width:100%\\' />')">
                    </div>`;
                }
                const photosWrapper = photosHtml ? `<div class="flex gap-4 mt-2">${photosHtml}</div>` : '';

                tbody.innerHTML += `
                    <tr class="clickable-row border-b border-white/5 hover:bg-white/5 transition-all text-slate-300 align-middle cursor-pointer" onclick="if(!event.target.closest('img') && !event.target.closest('a')) { this.classList.toggle('expanded'); document.getElementById('details-${j.id}').classList.toggle('hidden'); }">
                        <td class="py-2.5 font-mono text-amber-500 font-bold">
                            <span class="row-expand-arrow">▶</span>${j.id}
                        </td>
                        <td class="py-2.5 font-semibold text-white">${j.company_name || 'Client'}</td>
                        <td class="py-2.5">${j.tech_name || 'Tech'}</td>
                        <td class="py-2.5 text-slate-400">${j.service_type}</td>
                        <td class="py-2.5"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                    </tr>
                    <tr id="details-${j.id}" class="detail-row hidden bg-black/20">
                        <td colspan="5" class="p-4 text-xs text-slate-400 border-b border-white/5 space-y-3">
                            <div class="grid md:grid-cols-2 gap-6">
                                <div class="space-y-2">
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Statement of Scope</span>
                                        <p class="text-slate-300 font-medium leading-relaxed">${j.job_description || 'N/A'}</p>
                                    </div>
                                    ${j.maps_url ? `<div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Service Location (Google Maps)</span>
                                        <a href="${j.maps_url}" target="_blank" class="text-amber-500 hover:underline font-mono">${j.maps_url}</a>
                                    </div>` : ''}
                                </div>
                                <div class="space-y-2">
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Technician Site Notes</span>
                                        <p class="text-slate-300 italic leading-relaxed">"${j.technician_notes || 'No notes submitted yet.'}"</p>
                                    </div>
                                    <div>
                                        <span class="block text-[8px] uppercase tracking-widest text-slate-500 font-bold">Equipment Used</span>
                                        <p class="text-slate-300 font-mono">${j.equipment_used || 'None recorded'}</p>
                                    </div>
                                </div>
                            </div>
                            ${photosWrapper}
                        </td>
                    </tr>
                `;
            });
        }

        function plotJobsOnMap(jobs) {
            // Remove previous markers
            mapMarkers.forEach(m => map.removeLayer(m));
            mapMarkers = [];
            if (hqMarker) {
                map.removeLayer(hqMarker);
                hqMarker = null;
            }

            // 1. Draw HQ Marker
            const hq = loadHQConfig();
            const hqIcon = L.divIcon({
                html: `<div style="background-color: #ef4444; border: 2px solid #f59e0b; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 0 12px #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 9px;">🏢</div>`,
                className: 'custom-leaflet-marker-hq',
                iconSize: [16, 16]
            });
            hqMarker = L.marker([hq.lat, hq.lng], { icon: hqIcon }).addTo(map)
                .bindPopup(`
                    <div class="text-xs space-y-1">
                        <span class="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase">HQ</span>
                        <strong class="text-white block font-bold mt-1">${hq.name}</strong>
                        <div class="text-slate-400 text-[10px]">${hq.address}</div>
                    </div>
                `);

            // 2. Draw jobs
            jobs.forEach(job => {
                const lat = job.arrival_lat || (hq.lat + (Math.random() - 0.5) * 0.05);
                const lng = job.arrival_lng || (hq.lng + (Math.random() - 0.5) * 0.05);

                const markerColor = job.status === 'Completed' ? '#10b981' : job.status === 'In Progress' ? '#6366f1' : '#f59e0b';
                
                const customIcon = L.divIcon({
                    html: `<div style="background-color: ${markerColor}; border: 2px solid white; border-radius: 50%; width: 12px; height: 12px; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>`,
                    className: 'custom-leaflet-marker',
                    iconSize: [12, 12]
                });

                const m = L.marker([lat, lng], { icon: customIcon }).addTo(map)
                    .bindPopup(`
                        <div class="text-xs space-y-1">
                            <strong class="text-amber-500 font-mono">${job.id}</strong>
                            <div class="font-bold text-white">${job.company_name || 'Client Site'}</div>
                            <div class="text-slate-400">Assigned: ${job.tech_name || 'N/A'}</div>
                            <div class="font-semibold text-indigo-300">${job.service_type} (${job.status})</div>
                        </div>
                    `);
                mapMarkers.push(m);
            });
        }

        function initFullCalendar(jobs) {
            const calendarEl = document.getElementById('calendar');
            const events = jobs.map(j => {
                const eventColor = j.status === 'Completed' ? '#10b981' : j.status === 'In Progress' ? '#6366f1' : '#f59e0b';
                return {
                    id: j.id,
                    title: `${j.id} - ${j.service_type}`,
                    start: j.created_at || new Date().toISOString(),
                    backgroundColor: eventColor,
                    borderColor: eventColor,
                    textColor: '#fff'
                };
            });

            const calendar = new FullCalendar.Calendar(calendarEl, {
                initialView: 'dayGridMonth',
                headerToolbar: {
                    left: 'prev,next',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek'
                },
                themeSystem: 'standard',
                events: events,
                height: 350
            });
            calendar.render();
        }

        function renderAnalytics(jobs) {
            // Status counts
            const statuses = { 'Completed': 0, 'In Progress': 0, 'Pending': 0 };
            const categories = { 'CCTV': 0, 'Networking': 0, 'WiFi': 0, 'NAS': 0, 'General Maintenance': 0 };

            jobs.forEach(j => {
                if (statuses[j.status] !== undefined) statuses[j.status]++;
                if (categories[j.service_type] !== undefined) categories[j.service_type]++;
            });

            // 1. Status Chart
            const ctxStatus = document.getElementById('chart-status').getContext('2d');
            if (statusChartInstance) statusChartInstance.destroy();
            statusChartInstance = new Chart(ctxStatus, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(statuses),
                    datasets: [{
                        data: Object.values(statuses),
                        backgroundColor: ['#10b981', '#6366f1', '#f59e0b'],
                        borderWidth: 1,
                        borderColor: '#1e1b4b'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } }
                }
            });

            // 2. Category Chart
            const ctxCategory = document.getElementById('chart-category').getContext('2d');
            if (categoryChartInstance) categoryChartInstance.destroy();
            categoryChartInstance = new Chart(ctxCategory, {
                type: 'bar',
                data: {
                    labels: Object.keys(categories),
                    datasets: [{
                        label: 'Tickets Deployed',
                        data: Object.values(categories),
                        backgroundColor: '#f59e0b',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 9 } } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8', font: { size: 9 } } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }

        async function sendAdminRequest(endpoint, payload) {
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;

            try {
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Operation executed successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error with edge: " + err.message);
            }
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

        async function generateServiceReceiptPDF() {
            const jobId = document.getElementById('pdf-target-job-id').value.trim();
            const baseUrl = document.getElementById('api-base').value;
            
            if (!jobId) return alert("Please specify a targeted ticket parameter entry.");
            
            try {
                const res = await fetch(`${baseUrl}/api/jobs/receipt?job_id=${jobId}`);
                if (!res.ok) throw new Error("Target service history index mismatch.");
                const job = await res.json();
                
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();

                // Build receipt PDF styles
                doc.setFillColor(248, 250, 252);
                doc.rect(0, 0, 210, 297, "F");

                doc.setFillColor(79, 70, 229);
                doc.rect(0, 0, 210, 18, "F");

                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(13);
                doc.text("AWESOMEMYANMAR SERVICE REPORT COMPLIANCE PROTOCOL SHEET", 15, 12);

                let currentY = 28;
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(12);
                doc.text(`TICKET IDENTIFIER NO: ${job.id}`, 15, currentY);

                doc.setFontSize(8.5);
                doc.setTextColor(71, 85, 105);
                doc.setFont("helvetica", "bold");
                doc.text("DOMAIN SERVICE:", 15, currentY + 6);
                doc.text("CREW MEMBER ID:", 15, currentY + 12);
                doc.text("TICKET CREATED:", 15, currentY + 18);

                doc.setFont("helvetica", "normal");
                doc.setTextColor(15, 23, 42);
                doc.text(job.service_type || 'N/A', 50, currentY + 6);
                doc.text(job.technician_id || 'N/A', 50, currentY + 12);
                doc.text(new Date(job.created_at).toLocaleString(), 50, currentY + 18);

                doc.setTextColor(71, 85, 105);
                doc.setFont("helvetica", "bold");
                doc.text("WORK STATUS GATE:", 135, currentY + 6);
                doc.text("ARRIVAL TIMESTAMP:", 135, currentY + 12);
                doc.text("COMPLETION TIMESTAMP:", 135, currentY + 18);

                doc.setFont("helvetica", "normal");
                doc.setTextColor(15, 23, 42);
                doc.text(job.status || 'N/A', 178, currentY + 6);
                const arrivalTxt = job.arrival_time ? `${job.arrival_time}` : 'Not Logged';
                const completionTxt = job.completion_time ? `${job.completion_time}` : 'Not Logged';
                doc.text(arrivalTxt, 178, currentY + 12);
                doc.text(completionTxt, 178, currentY + 18);

                // --- Section 1: Client Information Card ---
                currentY += 28;
                doc.setTextColor(245, 158, 11);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10.5);
                doc.text("1. ACCOUNT PROFILE METADATA DETAILS", 15, currentY);
                doc.setDrawColor(226, 232, 240);
                doc.line(15, currentY + 2.5, 195, currentY + 2.5);

                currentY += 8;
                doc.setTextColor(15, 23, 42);
                doc.setFontSize(9);
                doc.setFont("helvetica", "bold");
                doc.text("Company Account:", 15, currentY);
                doc.text("Primary Manager:", 15, currentY + 6);
                doc.text("Site Address:", 15, currentY + 12);
                doc.text("Contact Line:", 15, currentY + 18);

                doc.setFont("helvetica", "normal");
                doc.text(job.company_name || 'N/A', 50, currentY);
                doc.text(job.contact_person || 'N/A', 50, currentY + 6);
                doc.text(job.address || 'N/A', 50, currentY + 12);
                doc.text(job.client_phone || 'N/A', 50, currentY + 18);

                // --- Section 2: Technical Statements ---
                currentY += 28;
                doc.setTextColor(245, 158, 11);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10.5);
                doc.text("2. OPERATIONAL RESOLUTIONS & DIAGNOSTIC NOTES", 15, currentY);
                doc.line(15, currentY + 2.5, 195, currentY + 2.5);

                currentY += 8;
                doc.setTextColor(71, 85, 105);
                doc.setFontSize(8.5);
                doc.setFont("helvetica", "bold");
                doc.text("SERVICE STATEMENT SCOPE DEPLOYED:", 15, currentY);
                
                currentY += 5;
                doc.setTextColor(15, 23, 42);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                const scopeLines = doc.splitTextToSize(job.job_description || 'No job description provided.', 180);
                doc.text(scopeLines, 15, currentY);
                currentY += (scopeLines.length * 4.5) + 4;

                doc.setTextColor(71, 85, 105);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(8.5);
                doc.text("ENGINEER ACTION & RESOLUTION SUMMARY LOGS:", 15, currentY);

                currentY += 5;
                doc.setTextColor(15, 23, 42);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                const notesLines = doc.splitTextToSize(job.technician_notes || 'No closing action summary logs entered.', 180);
                doc.text(notesLines, 15, currentY);
                currentY += (notesLines.length * 4.5) + 4;

                // --- Section 3: Hardware Inventory ---
                doc.setTextColor(245, 158, 11);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10.5);
                doc.text("3. HARDWARE DEPLOYMENT TRACKING", 15, currentY);
                doc.line(15, currentY + 2.5, 195, currentY + 2.5);

                currentY += 8;
                doc.setTextColor(15, 23, 42);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
                let hardwareStr = "No inventory components allocated to this operational ticket.";
                try {
                    const parsedHardware = JSON.parse(job.equipment_used || "[]");
                    if (parsedHardware.length > 0) {
                        hardwareStr = parsedHardware.join(', ');
                    }
                } catch(e){}
                const hardwareLines = doc.splitTextToSize(hardwareStr, 180);
                doc.text(hardwareLines, 15, currentY);

                // --- Sign-Off Footer section ---
                currentY += (hardwareLines.length * 4.5) + 26;

                if (job.signature) {
                    try {
                        doc.addImage(job.signature, 'PNG', 135, currentY - 14, 45, 12);
                    } catch(e) {
                        console.error(e);
                    }
                }

                doc.setDrawColor(203, 213, 225);
                doc.setLineWidth(0.3);
                doc.line(15, currentY, 80, currentY);
                doc.line(125, currentY, 190, currentY);

                doc.setTextColor(100, 116, 139);
                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.text(`AUTHORIZED TECH LEAD SIGNATURE [${job.technician_id}]`, 15, currentY + 4.5);
                doc.text("CUSTOMER COMPLIANCE VALIDATION SIGN-OFF", 125, currentY + 4.5);

                // Export PDF
                doc.save(`receipt-service-log-${job.id}.pdf`);
                
            } catch (err) {
                alert("PDF compilation engine process exception encountered: " + err.message);
            }
        }
