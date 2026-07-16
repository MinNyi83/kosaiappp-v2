        // Intercept global fetch to automatically inject Authorization token
        const apiInput = document.getElementById('api-base');
        if (apiInput && !apiInput.value) {
            if (window.location.hostname.includes('pages.dev')) {
                apiInput.value = "https://cctv-service-system.nyinyimin2007.workers.dev";
            } else {
                apiInput.value = window.location.origin;
            }
        }

        const originalFetch = window.fetch;
        window.fetch = function (url, options = {}) {
            if (url && (url.includes('/api/admin/') || url.includes('/api/landing-page') || url.includes('/api/jobs/schedule') || url.includes('/api/jobs/update'))) {
                options.headers = options.headers || {};
                const token = localStorage.getItem('admin_token');
                if (token) {
                    options.headers['Authorization'] = `Bearer ${token}`;
                }
            }
            return originalFetch(url, options);
        };

        let map;
        let mapMarkers = [];
        let statusChartInstance;
        let categoryChartInstance;

        let cashTransactions = [];
        let cashPage = 1;
        const cashPerPage = 10;

        let inventoryItems = [];
        let stockPage = 1;
        const stockPerPage = 10;
        let clientsList = [];

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
        function toggleSidebarCollapse() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('collapsed');
            localStorage.setItem('sidebar_collapsed', sidebar.classList.contains('collapsed'));
        }
        window.addEventListener('DOMContentLoaded', () => {
            const sidebar = document.getElementById('sidebar');
            if (sidebar && localStorage.getItem('sidebar_collapsed') === 'true') {
                sidebar.classList.add('collapsed');
            }
        });
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
                localStorage.setItem('admin_token', data.token);
                document.getElementById('auth-screen').classList.add('hidden');
                initializeAdminDesk();
            } catch (err) {
                alert("Access Denied: " + err.message);
            }
        }

        async function submitNewUser(e) {
            e.preventDefault();
            const id = document.getElementById("new-user-id").value.trim();
            const username = document.getElementById("new-user-username").value.trim();
            const password = document.getElementById("new-user-password").value.trim();
            const name = document.getElementById("new-user-name").value.trim();
            const nickname = document.getElementById("new-user-nickname").value.trim();
            const role = document.getElementById("new-user-role").value;
            const phone = document.getElementById("new-user-phone").value.trim();
            const email = document.getElementById("new-user-email").value.trim();
            const pin = document.getElementById("new-user-pin").value.trim();
            
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;

            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
                    body: JSON.stringify({ id, username, password, name, nickname, role, phone, email, pin })
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
            const cachedToken = localStorage.getItem('admin_token');
            if (cachedUser && cachedToken && cachedToken.split('.').length === 3) {
                const user = JSON.parse(cachedUser);
                if (user.role === 'Admin') {
                    document.getElementById('auth-screen').classList.add('hidden');
                    initializeAdminDesk();
                }
            } else {
                handleLogout();
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
                localStorage.setItem('admin_token', data.token);
                document.getElementById('auth-screen').classList.add('hidden');
                initializeAdminDesk();
            } catch (err) {
                alert("Access Denied: " + err.message);
            }
        }

        function handleLogout() {
            localStorage.removeItem('admin_user');
            localStorage.removeItem('admin_token');
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
            const pathName = tabId === 'system-settings' ? 'System Settings' : 
                             tabId === 'user-management' ? 'User Management' :
                             tabId.charAt(0).toUpperCase() + tabId.slice(1);
            document.getElementById('current-path-display').textContent = pathName === 'Dashboard' ? 'Dashboard' : `Dashboard / ${pathName}`;

            // Highlight sidebar tab
            document.querySelectorAll('.tab-link').forEach(link => {
                link.classList.remove('bg-amber-500/10', 'text-amber-500');
                link.classList.add('text-slate-400');
            });
            // Find clicking source link (simplified matching)
            const activeLink = Array.from(document.querySelectorAll('.tab-link')).find(link => {
                const onclickAttr = link.getAttribute('onclick');
                return onclickAttr && onclickAttr.includes(tabId);
            });
            if (activeLink) {
                activeLink.classList.remove('text-slate-400');
                activeLink.classList.add('bg-amber-500/10', 'text-amber-500');
            }

            // Fix Leaflet rendering delay when opening a previously hidden container
            if (tabId === 'dispatch-map') {
                initLeafletMap();
                setTimeout(() => {
                    if (map) {
                        map.invalidateSize(true);
                        // Also trigger redraw of markers
                        loadJobsData();
                    }
                }, 100);
            }

            if (tabId === 'jobs') {
                loadJobsDashboardData();
            }

            if (tabId === 'portfolio' && typeof loadPortfolioProjects === 'function') {
                loadPortfolioProjects();
            }

            if (tabId === 'landing-page' && typeof loadLandingPageContent === 'function') {
                loadLandingPageContent();
            }
        }

        async function initializeAdminDesk() {
            const workspace = document.getElementById('app-workspace');
            workspace.innerHTML = '<div class="flex justify-center items-center h-64"><div class="animate-pulse text-amber-500 font-bold uppercase text-xs tracking-widest">Loading dispatch components...</div></div>';
            
            const views = [
                { name: 'dashboard', file: 'dashboard.html' },
                { name: 'dispatch-map', file: 'dispatch-map.html' },
                { name: 'ai-copilot', file: 'ai-copilot.html' },
                { name: 'tickets', file: 'tickets.html' },
                { name: 'amc', file: 'amc.html' },
                { name: 'currency', file: 'currency.html' },
                { name: 'reports', file: 'reports.html' },
                { name: 'service-fees', file: 'service-fees.html' },
                { name: 'warranty', file: 'warranty.html' },
                { name: 'distributors', file: 'distributors.html' },
                { name: 'system-settings', file: 'system-settings.html' },
                { name: 'user-management', file: 'user-management.html' },
                { name: 'inventory', file: 'inventory.html' },
                { name: 'landing-page', file: 'landing-page.html' },
                { name: 'portfolio', file: 'portfolio.html' },
                { name: 'jobs', file: 'jobs.html' }
            ];

            try {
                let workspaceHtml = '';
                for (const view of views) {
                    const res = await fetch(`./views/${view.file}`);
                    if (!res.ok) throw new Error(`Could not load view: ${view.name}`);
                    const html = await res.text();
                    workspaceHtml += html;
                }
                workspace.innerHTML = workspaceHtml;
                
                // Parse and inject script tags dynamically so the browser executes them
                const parser = new DOMParser();
                const doc = parser.parseFromString(workspaceHtml, 'text/html');
                doc.querySelectorAll('script').forEach(oldScript => {
                    const newScript = document.createElement('script');
                    Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                    document.body.appendChild(newScript);
                });
                
                // Hide all views except dashboard initially
                document.querySelectorAll('.tab-view').forEach(view => {
                    if (view.id !== 'view-dashboard') {
                        view.classList.add('hidden');
                    }
                });

                // Set up client searchable listeners after views are injected
                setupSearchableClientsListeners();

                // Run original initializations
                refreshDashboardData();
                
                // Start dashboard auto refresh loops every 10 seconds
                setInterval(refreshDashboardData, 300000);
            } catch (err) {
                workspace.innerHTML = `<div class="p-6 text-center text-rose-500 font-bold">Failed to bootstrap console workspace: ${err.message}</div>`;
            }
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
            
            // Asynchronously fetch live configuration from database and update inputs
            const baseUrl = document.getElementById('api-base') ? document.getElementById('api-base').value : '';
            fetch(`${baseUrl}/api/landing-page`)
                .then(res => res.json())
                .then(data => {
                    if (data.value) {
                        const content = data.value;
                        if (content.map_lat && content.map_lng) {
                            hq.lat = parseFloat(content.map_lat);
                            hq.lng = parseFloat(content.map_lng);
                        }
                        if (content.address) hq.address = content.address;
                        
                        if (document.getElementById('hq-name')) document.getElementById('hq-name').value = hq.name;
                        if (document.getElementById('hq-maps-url')) document.getElementById('hq-maps-url').value = hq.maps_url || '';
                        if (document.getElementById('hq-lat')) document.getElementById('hq-lat').value = hq.lat;
                        if (document.getElementById('hq-lng')) document.getElementById('hq-lng').value = hq.lng;
                        if (document.getElementById('hq-address')) document.getElementById('hq-address').value = hq.address;
                        
                        localStorage.setItem('hq_config', JSON.stringify(hq));
                    }
                })
                .catch(err => console.warn("Failed to load HQ settings from D1:", err));
            
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

            const baseUrl = document.getElementById('api-base').value;
            fetch(`${baseUrl}/api/admin/hq-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(hq)
            })
            .then(res => res.json())
            .then(data => {
                alert("Head Office Location settings saved and synchronized successfully!");
                if (map) {
                    map.setView([hq.lat, hq.lng], 12);
                    refreshDashboardData();
                }
            })
            .catch(err => {
                console.error("Failed to sync HQ config to D1:", err);
                alert("Saved locally, but failed to sync to database: " + err.message);
            });
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
            const mapContainer = document.getElementById('map');
            if (mapContainer) mapContainer.classList.add('dark-map-theme');
        }

        async function refreshDashboardData() {
            await populateLookupDropdowns();
            await loadJobsData();
            await loadInventoryData();
            await loadRMAData();
            await loadCashSafeData();
            await loadTechniciansData();
            await loadServiceFeesData();
            await loadClientsData();
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

            // Update sidebar active state for main nav buttons only
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

        // Keep old alias for backward compat
        window.setInventoryTab = window.switchInvModule;

        window.processSerialInput = function(textareaElement) {
            if (!textareaElement) return;

            // Get caret position to preserve cursor focus mapping
            const cursorStart = textareaElement.selectionStart;
            const cursorEnd = textareaElement.selectionEnd;
            const originalLength = textareaElement.value.length;

            const lines = textareaElement.value.split(/([\n,;])/);
            const seen = new Set();
            const rebuilt = [];

            let currentItem = "";
            for (let i = 0; i < lines.length; i++) {
                const token = lines[i];
                if (token === "\n" || token === "," || token === ";") {
                    if (currentItem !== "") {
                        const trimmed = currentItem.trim();
                        if (!seen.has(trimmed)) {
                            seen.add(trimmed);
                            rebuilt.push(currentItem);
                        }
                        currentItem = "";
                    }
                    rebuilt.push(token);
                } else {
                    currentItem += token;
                }
            }
            if (currentItem !== "") {
                const trimmed = currentItem.trim();
                if (!seen.has(trimmed)) {
                    rebuilt.push(currentItem);
                }
            }

            const cleanedVal = rebuilt.join("");
            if (cleanedVal !== textareaElement.value) {
                textareaElement.value = cleanedVal;
                // Calculate cursor drift to keep focus exactly where the operator was typing
                const diff = originalLength - cleanedVal.length;
                textareaElement.setSelectionRange(cursorStart - diff, cursorEnd - diff);
            }

            const badge = document.getElementById('serial-count-badge');
            if (badge) {
                const count = seen.size + (currentItem.trim() !== "" && !seen.has(currentItem.trim()) ? 1 : 0);
                if (count > 0) {
                    badge.textContent = `${count} unit${count !== 1 ? 's' : ''}`;
                    badge.style.color = '#34d399';
                    badge.style.borderColor = 'rgba(16,185,129,0.3)';
                    badge.style.background = 'rgba(16,185,129,0.08)';
                } else {
                    badge.textContent = '0 units';
                    badge.style.color = '';
                    badge.style.borderColor = '';
                    badge.style.background = '';
                }
            }
        };

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
                    <tr class="clickable-row cursor-pointer border-b border-white/5 transition-all align-middle group"
                        style="border-left: 2px solid transparent;"
                        onmouseenter="this.style.background='rgba(16,185,129,0.03)'; this.style.borderLeftColor='rgba(16,185,129,0.4)';"
                        onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';"
                        onclick="document.getElementById('serials-row-${idx}').classList.toggle('hidden'); const a = this.querySelector('.expand-arrow'); if(a) a.style.transform = a.style.transform === 'rotate(90deg)' ? '' : 'rotate(90deg)';">
                        <td class="pl-3 pr-2 py-2.5">
                            <div class="w-5 h-5 rounded flex items-center justify-center transition-all" style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15);">
                                <span class="expand-arrow text-emerald-500 text-[10px] inline-block transition-transform duration-200 font-bold">›</span>
                            </div>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="font-mono text-[11px] font-bold text-white tracking-wide">${b.batch_code}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="text-[11px] text-slate-300 font-medium">${b.item_name || '—'}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="cat-pill">${b.category || '—'}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="font-mono text-[12px] font-bold text-sky-400">$${parseFloat(b.buying_price || 0).toFixed(2)}</span>
                            <span class="text-[8px] text-slate-600 ml-0.5">/unit</span>
                        </td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${b.supplier || '—'}</td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="font-mono text-[13px] font-black text-slate-300">${totalUnits}</span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${availableUnits > 0 ? 'text-emerald-400' : 'text-rose-400'}" style="background: ${availableUnits > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid ${availableUnits > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}">
                                <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: ${availableUnits > 0 ? '#10b981' : '#ef4444'};"></span>
                                ${availableUnits}
                            </span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="font-mono text-[11px] ${soldUnits > 0 ? 'text-amber-400' : 'text-slate-700'}">${soldUnits > 0 ? soldUnits : '—'}</span>
                        </td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-600">${importDate}</td>
                    </tr>
                    <tr id="serials-row-${idx}" class="hidden">
                        <td colspan="10" class="px-5 py-3" style="background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(16,185,129,0.1);">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <p class="text-[8px] font-black text-emerald-600 uppercase tracking-[0.15em]">Serial Numbers · ${b.batch_code} · ${availableUnits}/${totalUnits} Available</p>
                            </div>
                            <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1">
                                ${serialsHtml}
                            </div>
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

            activeCatalogList.forEach((item, i) => {
                const opt = `<option value="${item.item_code}">${item.item_name} [${item.item_code}]</option>`;
                if (batchSelect) batchSelect.innerHTML += opt;
                if (updateSelect) updateSelect.innerHTML += opt;
                if (filterSelect) filterSelect.innerHTML += `<option value="${item.item_code}">${item.item_name}</option>`;

                const priceUSD = item.unit_price ? `$${parseFloat(item.unit_price).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}` : '—';
                const priceMMK = item.unit_price_mmk ? `Ks ${parseInt(item.unit_price_mmk).toLocaleString()}` : '—';
                const usdColor = item.unit_price ? 'text-emerald-400' : 'text-slate-600';
                const mmkColor = item.unit_price_mmk ? 'text-amber-400' : 'text-slate-600';

                // Count available stock from batches
                const inStock = activeBatchesList
                    .filter(b => b.item_code === item.item_code)
                    .reduce((sum, b) => sum + (b.serials ? b.serials.filter(s => s.status === 'Active').length : 0), 0);
                const stockColor = inStock > 5 ? 'text-emerald-400' : inStock > 0 ? 'text-amber-400' : 'text-rose-400';

                if (pricingBody) {
                    pricingBody.innerHTML += `
                        <tr class="border-b border-white/5 transition-all text-[11px] cursor-default"
                            style="border-left: 2px solid transparent;"
                            onmouseenter="this.style.background='rgba(245,158,11,0.03)'; this.style.borderLeftColor='rgba(245,158,11,0.3)';"
                            onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';">
                            <td class="px-4 py-2.5 font-mono text-[10px] font-bold text-sky-400">${item.item_code}</td>
                            <td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td>
                            <td class="px-4 py-2.5"><span class="cat-pill">${item.category || '—'}</span></td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${stockColor}" style="background: ${inStock > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${inStock > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}">
                                    <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: currentColor;"></span>
                                    ${inStock}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-right font-mono font-bold text-[12px] ${usdColor}">${priceUSD}</td>
                            <td class="px-4 py-2.5 text-right font-mono font-bold text-[12px] ${mmkColor}">${priceMMK}</td>
                            <td class="px-4 py-2.5 text-center">
                                <button onclick="window.switchInvModule('update-price'); setTimeout(() => { const s = document.getElementById('price-update-item-code'); if(s){ s.value='${item.item_code}'; window.populatePriceFields('${item.item_code}'); } }, 50);"
                                    class="px-2.5 py-1 text-[9px] font-bold text-sky-400 rounded transition-all"
                                    style="background: rgba(14,165,233,0.08); border: 1px solid rgba(14,165,233,0.2);"
                                    onmouseenter="this.style.background='rgba(14,165,233,0.15)'"
                                    onmouseleave="this.style.background='rgba(14,165,233,0.08)'">
                                    Edit Price
                                </button>
                            </td>
                        </tr>
                    `;
                }

                if (catalogBody) {
                    catalogBody.innerHTML += `
                        <tr class="border-b border-white/5 transition-all text-[11px]"
                            style="border-left: 2px solid transparent;"
                            onmouseenter="this.style.background='rgba(99,102,241,0.03)'; this.style.borderLeftColor='rgba(99,102,241,0.3)';"
                            onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';">
                            <td class="px-4 py-2.5 font-mono text-[10px] font-bold text-sky-400">${item.item_code}</td>
                            <td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td>
                            <td class="px-4 py-2.5"><span class="cat-pill">${item.category || '—'}</span></td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${stockColor}" style="background: ${inStock > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${inStock > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}">
                                    <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: currentColor;"></span>
                                    ${inStock} units
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-right">
                                <button class="px-2.5 py-1 text-[9px] font-bold text-rose-400 rounded transition-all"
                                    style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);"
                                    title="Delete not yet implemented">Remove</button>
                            </td>
                        </tr>
                    `;
                }
            });

            if (batchSelect && prevBatchVal) batchSelect.value = prevBatchVal;
            if (updateSelect && prevUpdateVal) updateSelect.value = prevUpdateVal;
        }

        window.filterBatchTable = function() {
            const q = (document.getElementById('batch-search-input')?.value || '').toLowerCase();
            document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(q) ? '' : 'none';
            });
        };

        window.filterBatchByModel = function(val) {
            document.querySelectorAll('#batch-main-table tbody .clickable-row').forEach(row => {
                if (!val) { row.style.display = ''; return; }
                const text = row.textContent.toLowerCase();
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

                // Load Batch Options
                try {
                    const lookupRes = await fetch(`${baseUrl}/api/admin/lookups`);
                    const lookups = await lookupRes.json();
                    const batchSel = document.getElementById('cash-batch-id');
                    if (batchSel && lookups.batches) {
                        batchSel.innerHTML = '<option value="" class="bg-slate-900">(None / Not Linked)</option>';
                        lookups.batches.forEach(b => {
                            batchSel.innerHTML += `<option value="${b}" class="bg-slate-900">Batch: ${b}</option>`;
                        });
                    }
                } catch(err){}

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
                const displayCurrency = tx.receive_mmk === 1 ? 'USD (MMK Safe)' : tx.primary_currency;
                const batchBadge = tx.linked_batch ? `<span class="bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold">Batch: ${tx.linked_batch}</span>` : '';
                const jobLink = tx.job_id ? `[Ref: ${tx.job_id}]` : '';

                ledgerBody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition-all">
                        <td class="py-2 text-slate-400 font-mono">${new Date(tx.created_at).toLocaleDateString()}</td>
                        <td class="py-2"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] ${badge}">${tx.transaction_type}</span></td>
                        <td class="py-2 font-mono font-bold text-amber-500">${amountPrefix}${tx.primary_currency === 'USD' ? '$' : ''}${tx.amount.toLocaleString()} ${tx.primary_currency === 'MMK' ? 'Ks' : ''} <span class="text-[9px] text-slate-500 font-normal">(${displayCurrency})</span></td>
                        <td class="py-2 font-mono text-slate-400">${tx.exchange_rate}</td>
                        <td class="py-2 font-mono text-slate-300">${tx.equivalent_amount.toLocaleString()} Ks</td>
                        <td class="py-2 text-slate-400">${tx.notes || ''} ${jobLink} ${batchBadge}</td>
                    </tr>
                `;
            });
        }

        async function submitCashTransaction(e) {
            e.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            const transaction_type = document.getElementById('cash-type').value;
            const currency_selection = document.getElementById('cash-currency').value;
            const amount = document.getElementById('cash-amount').value;
            const exchange_rate = document.getElementById('cash-rate').value;
            const job_id = document.getElementById('cash-job-id').value.trim();
            const linked_batch = document.getElementById('cash-batch-id').value.trim();
            const notes = document.getElementById('cash-notes').value;

            const primary_currency = currency_selection === 'USD_MMK' ? 'USD' : currency_selection;
            const receive_mmk = currency_selection === 'USD_MMK' ? 1 : 0;

            try {
                const res = await fetch(`${baseUrl}/api/admin/cash/transact`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transaction_type, primary_currency, amount, exchange_rate, job_id, notes, receive_mmk, linked_batch })
                });
                if (res.ok) {
                    alert("Cash safe reserve ledger transaction recorded.");
                    document.getElementById('cash-amount').value = '';
                    document.getElementById('cash-notes').value = '';
                    document.getElementById('cash-job-id').value = '';
                    document.getElementById('cash-batch-id').value = '';
                    loadCashSafeData();
                }
            } catch(e){}
        }

        async function loadTechniciansData() {
            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            const tbody = document.getElementById('tech-list-body');
            
            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians`, {
                    headers: { 'Authorization': `Bearer ${token}` }
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
                            <td class="py-2.5 font-mono text-indigo-300 font-bold">${t.id}</td>
                            <td class="py-2.5 font-bold">${t.name}</td>
                            <td class="py-2.5 text-indigo-400 font-bold">${t.nickname || '-'}</td>
                            <td class="py-2.5 text-slate-400 font-mono">${t.email || (t.username ? '@' + t.username : 'N/A')}</td>
                            <td class="py-2.5">${roleSelect}</td>
                            <td class="py-2.5">${statusBadge}</td>
                            <td class="py-2.5 text-right space-x-1 whitespace-nowrap">
                                <button onclick="openTechHistoryModal('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[10px] px-2 py-1 rounded transition-all">📜 History</button>
                                <button onclick="openTechIdCard('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${t.role}', '${t.phone || ''}', '${t.email || ''}', '${t.nickname || ''}', ${t.active}, '${t.photo || ''}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold text-[10px] px-2 py-1 rounded transition-all">🪪 ID Card</button>
                                <button onclick="saveTechnicianRole('${t.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Save Role</button>
                                <button onclick="openEditTechModal('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${(t.nickname || '').replace(/'/g, "\\'")}', '${t.phone || ''}', '${t.email || ''}', '${t.username || ''}', '${t.pin || ''}')" class="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Edit</button>
                                <button onclick="deleteTechnician('${t.id}')" class="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Delete</button>
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
            const token = localStorage.getItem('admin_token');
            const role = document.getElementById(`role-${id}`).value;
            
            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
            const token = localStorage.getItem('admin_token');
            const role = document.getElementById(`role-${id}`).value;
            
            try {
                const tbody = document.getElementById('tech-list-body');
                const row = Array.from(tbody.querySelectorAll('tr')).find(tr => tr.innerHTML.includes(id));
                const active = row.innerHTML.includes('bg-emerald-500/10') ? 1 : 0;
                
                const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

        window.openEditTechModal = function(id, name, nickname, phone, email, username, pin) {
            document.getElementById('edit-tech-id').value = id;
            document.getElementById('edit-tech-name').value = name;
            document.getElementById('edit-tech-nickname').value = nickname;
            document.getElementById('edit-tech-phone').value = phone;
            document.getElementById('edit-tech-email').value = email;
            document.getElementById('edit-tech-username').value = username;
            document.getElementById('edit-tech-password').value = '';
            document.getElementById('edit-tech-pin').value = pin === 'undefined' || !pin ? '1234' : pin;
            
            document.getElementById('edit-tech-modal').classList.remove('hidden');
        };

        window.closeEditTechModal = function() {
            document.getElementById('edit-tech-modal').classList.add('hidden');
        };

        // ─── 🪪 ID CARD SYSTEM ─────────────────────────────────────────────────
        let _idCardCurrentTech = null;

        window.openTechIdCard = function(id, name, role, phone, email, nickname, active, photo) {
            _idCardCurrentTech = { id, name, role, phone, email, nickname, active, _photoDataUrl: photo };

            // Populate info panel
            document.getElementById('id-info-name').textContent = name || '—';
            document.getElementById('id-info-id').textContent = id || '—';
            document.getElementById('id-info-role').textContent = role || '—';
            document.getElementById('id-info-phone').textContent = phone || '—';
            document.getElementById('id-info-email').textContent = email || '—';
            document.getElementById('id-info-status').textContent = active ? 'Active ✓' : 'Inactive';
            document.getElementById('id-info-status').className = active
                ? 'text-emerald-400 font-bold'
                : 'text-rose-400 font-bold';

            // Populate card face
            document.getElementById('id-card-name-front').textContent = name.toUpperCase();
            document.getElementById('id-card-role-front').textContent = role;
            document.getElementById('id-card-id-front').textContent = id;
            document.getElementById('id-card-phone-front').textContent = phone || '—';
            document.getElementById('id-card-email-back').textContent = email || '—';

            // Reset card flip state
            const flipper = document.getElementById('id-card-flipper');
            if (flipper) flipper.classList.remove('flipped');

            // Render photo if exists
            const photoEl = document.getElementById('id-card-photo-front');
            if (photo) {
                photoEl.innerHTML = '';
                photoEl.style.backgroundImage = `url(${photo})`;
                photoEl.style.backgroundSize = 'cover';
                photoEl.style.backgroundPosition = 'center';
            } else {
                photoEl.innerHTML = '👷';
                photoEl.style.backgroundImage = '';
            }

            // Generate QR code targeting the verification endpoint
            const baseUrl = document.getElementById('api-base')?.value || window.location.origin;
            const verifyUrl = `${baseUrl}/api/verify-tech/${id}`;
            document.getElementById('id-qr-url').textContent = verifyUrl;

            // Update all three img QR targets using public QR generator API
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;
            ['id-card-qr-mini', 'id-card-qr-back', 'id-qr-display'].forEach(imgId => {
                const img = document.getElementById(imgId);
                if (img) img.src = qrImageUrl;
            });

            // Show modal
            document.getElementById('tech-id-card-modal').classList.remove('hidden');
        };

        window.handleIdCardPhotoUpload = async function(input) {
            const file = input.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(e) {
                const rawDataUrl = e.target.result;
                
                // Compress image using canvas
                const img = new Image();
                img.onload = async function() {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 150;
                    const MAX_HEIGHT = 180;
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Output compressed JPEG base64 (small payload size!)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    
                    const photoEl = document.getElementById('id-card-photo-front');
                    photoEl.innerHTML = '';
                    photoEl.style.backgroundImage = `url(${dataUrl})`;
                    photoEl.style.backgroundSize = 'cover';
                    photoEl.style.backgroundPosition = 'center';
                    
                    if (_idCardCurrentTech) {
                        _idCardCurrentTech._photoDataUrl = dataUrl;
                        
                        // Auto save compressed profile photo upload to backend D1 database
                        const baseUrl = document.getElementById('api-base').value;
                        const token = localStorage.getItem('admin_token');
                        try {
                            const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ id: _idCardCurrentTech.id, photo: dataUrl })
                            });
                            const data = await res.json();
                            if (res.ok) {
                                console.log("Profile photo synchronized to database successfully.");
                                // Re-fetch database to sync the uploaded photo to local tech rows data state
                                await refreshDashboardData();
                                // Update local reference with latest list data state
                                const updatedRes = await fetch(`${baseUrl}/api/admin/technicians`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (updatedRes.ok) {
                                    const updatedTechs = await updatedRes.json();
                                    const latest = updatedTechs.find(t => t.id === _idCardCurrentTech.id);
                                    if (latest) _idCardCurrentTech._photoDataUrl = latest.photo;
                                }
                            } else {
                                console.error("Photo synchronization error:", data.error);
                            }
                        } catch(err) {
                            console.error("Photo upload network error:", err);
                        }
                    }
                };
                img.src = rawDataUrl;
            };
            reader.readAsDataURL(file);
        };

        window.downloadTechIdPdf = function() {
            if (!_idCardCurrentTech) return;

            const { id, name, role, phone, email, nickname, active, _photoDataUrl } = _idCardCurrentTech;

            // Build printable HTML and trigger browser print
            const baseUrl = document.getElementById('api-base')?.value || window.location.origin;
            const verifyUrl = `${baseUrl}/api/verify-tech/${id}`;

            const printWin = window.open('', '_blank', 'width=900,height=650');
            printWin.document.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>ID Card — ${name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        /* CR80 card: 85.6 × 53.98 mm at 96 DPI → px ratio */
        .id-card { width: 323px; height: 204px; position: relative; border-radius: 12px; overflow: hidden; background: linear-gradient(135deg, #1a1a2e, #0f0f1a); border: 1px solid rgba(245,158,11,0.25); box-shadow: 0 8px 24px rgba(0,0,0,0.4); break-inside: avoid; }
        .gold-bar { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg, #f59e0b, #fbbf24, #f59e0b); }
        .grid-overlay { position: absolute; inset: 0; background-image: linear-gradient(rgba(245,158,11,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.03) 1px,transparent 1px); background-size: 14px 14px; }
        .card-body { position: relative; z-index: 2; padding: 14px; display: flex; gap: 12px; align-items: flex-start; margin-top: 5px; }
        .photo { width: 62px; height: 78px; border-radius: 7px; background: rgba(99,102,241,0.15); border: 1.5px solid rgba(99,102,241,0.35); overflow: hidden; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 2rem; }
        .photo img { width: 100%; height: 100%; object-fit: cover; }
        .info { flex: 1; min-width: 0; }
        .brand { font-size: 7.5px; font-weight: 800; color: #f59e0b; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 5px; }
        .emp-name { font-size: 11px; font-weight: 800; color: #fff; text-transform: uppercase; letter-spacing: 0.04em; line-height: 1.2; margin-bottom: 3px; }
        .emp-role { font-size: 8px; color: #94a3b8; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 7px; }
        .emp-id { font-family: monospace; font-size: 8px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; padding: 2px 6px; color: #818cf8; font-weight: 700; display: inline-block; }
        .qr-mini { flex-shrink: 0; }
        .bottom-bar { position: absolute; bottom: 0; left: 0; right: 0; padding: 6px 14px; background: rgba(245,158,11,0.08); border-top: 1px solid rgba(245,158,11,0.15); display: flex; justify-content: space-between; align-items: center; }
        .phone-txt { font-size: 7.5px; color: #64748b; font-family: monospace; }
        .status-txt { font-size: 7px; color: #374151; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; }
        @media print { body { min-height: auto; } .id-card { box-shadow: none; } }
    </style>
</head>
<body>
    <div class="id-card">
        <div class="gold-bar"></div>
        <div class="grid-overlay"></div>
        <div class="card-body">
            <div class="photo">${_photoDataUrl ? `<img src="${_photoDataUrl}">` : '👷'}</div>
            <div class="info">
                <div class="brand">Awesome Myanmar</div>
                <div class="emp-name">${name}</div>
                <div class="emp-role">${role}${nickname ? ` · "${nickname}"` : ''}</div>
                <div class="emp-id">${id}</div>
            </div>
            <div class="qr-mini"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}" width="50" height="50" style="border-radius:3px;background:#fff;padding:2px;display:block;" alt="QR"></div>
        </div>
        <div class="bottom-bar">
            <span class="phone-txt">${phone || ''}</span>
            <span class="status-txt">${active ? 'Field Tech • Active' : 'Field Tech • Inactive'}</span>
        </div>
    </div>
    <script>
        window.onload = function() {
            setTimeout(function() { window.print(); window.close(); }, 500);
        };
    <\/script>
</body>
</html>`);
            printWin.document.close();
        };
        // ─────────────────────────────────────────────────────────────────────

        window.submitEditTechnician = async function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-tech-id').value;
            const name = document.getElementById('edit-tech-name').value.trim();
            const nickname = document.getElementById('edit-tech-nickname').value.trim();
            const phone = document.getElementById('edit-tech-phone').value.trim();
            const email = document.getElementById('edit-tech-email').value.trim();
            const username = document.getElementById('edit-tech-username').value.trim();
            const password = document.getElementById('edit-tech-password').value.trim();
            const pin = document.getElementById('edit-tech-pin').value.trim();
            
            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            const payload = { id, name, nickname, phone, email, username, pin };
            if (password) payload.password = password;

            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/update`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Technician updated successfully.");
                    closeEditTechModal();
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.deleteTechnician = async function(id) {
            if (!confirm("Are you sure you want to delete this technician? If they have completed jobs, they will be deactivated instead.")) return;
            
            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/technicians/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || "Technician deleted successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        let techHistoryModalJobs = [];

        window.openTechHistoryModal = async function(techId, techName) {
            const modal = document.getElementById('tech-history-modal');
            const title = document.getElementById('history-modal-tech-title');
            const listContainer = document.getElementById('tech-history-tickets-list');
            const detailsContainer = document.getElementById('tech-history-ticket-details');

            if (!modal || !title || !listContainer) return;

            title.textContent = techName;
            listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">Pulling service logs...</p>';
            detailsContainer.innerHTML = `
                <div class="text-center text-slate-500 py-12">
                    <span class="text-3xl block mb-2">🎫</span>
                    <p class="text-xs font-medium">Select an assigned job ticket from the list to inspect operational details.</p>
                </div>
            `;
            modal.classList.remove('hidden');

            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/jobs`);
                const allJobs = await res.json();
                
                // Filter jobs by technician ID
                techHistoryModalJobs = allJobs.filter(j => j.technician_id === techId);

                listContainer.innerHTML = '';
                if (techHistoryModalJobs.length === 0) {
                    listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">No assigned tickets found for this technician.</p>';
                    return;
                }

                techHistoryModalJobs.forEach(j => {
                    let statusBadge = 'bg-slate-500/10 text-slate-400';
                    if (j.status === 'Completed') statusBadge = 'bg-emerald-500/10 text-emerald-400';
                    else if (j.status === 'In Progress') statusBadge = 'bg-blue-500/10 text-blue-400';
                    else if (j.status === 'Pending') statusBadge = 'bg-amber-500/10 text-amber-500';
                    else if (j.status === 'Cancelled') statusBadge = 'bg-rose-500/10 text-rose-400';

                    listContainer.innerHTML += `
                        <div onclick="renderTechHistoryDetails('${j.id}')" class="bg-white/5 border border-white/5 hover:border-amber-500/30 p-3 rounded-xl cursor-pointer transition-all flex justify-between items-center group">
                            <div>
                                <div class="font-mono font-bold text-white text-[11px] group-hover:text-amber-500 transition-colors">${j.id}</div>
                                <div class="text-[10px] text-slate-400 mt-0.5">${j.service_type} • ${j.created_at ? j.created_at.split(' ')[0] : '-'}</div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${statusBadge}">${j.status}</span>
                        </div>
                    `;
                });

            } catch (err) {
                listContainer.innerHTML = '<p class="text-xs text-rose-400 py-4 text-center">Failed to load service records.</p>';
                console.error(err);
            }
        };

        window.closeTechHistoryModal = function() {
            const modal = document.getElementById('tech-history-modal');
            if (modal) modal.classList.add('hidden');
        };

        window.renderTechHistoryDetails = function(jobId) {
            const detailsContainer = document.getElementById('tech-history-ticket-details');
            if (!detailsContainer) return;

            const job = techHistoryModalJobs.find(j => j.id === jobId);
            if (!job) return;

            let checklistHtml = '';
            if (job.checklist_data) {
                try {
                    const checklist = JSON.parse(job.checklist_data);
                    checklistHtml = `
                        <div class="space-y-1">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Completed Checklist Checklist</span>
                            <div class="grid grid-cols-2 gap-1 text-[10px]">
                                ${Object.entries(checklist).map(([key, val]) => `
                                    <div class="flex items-center gap-1.5 text-slate-300">
                                        <span>${val ? '✅' : '❌'}</span>
                                        <span class="capitalize">${key.replace(/_/g, ' ')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } catch(e) {}
            }

            detailsContainer.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-start border-b border-white/5 pb-2">
                        <div>
                            <div class="font-mono font-black text-amber-500 text-sm">${job.id}</div>
                            <div class="text-[10px] text-slate-400 mt-0.5">Category Type: <span class="text-white font-semibold">${job.service_type}</span></div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] text-slate-400">Target Client</div>
                            <div class="text-[10px] font-bold text-white mt-0.5">🏢 ${job.company_name || 'Individual Client'}</div>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Statement of Scope</span>
                        <p class="text-[11px] text-slate-300 bg-black/40 border border-white/5 rounded-lg p-2.5 leading-relaxed max-h-[80px] overflow-y-auto font-medium">${job.job_description}</p>
                    </div>

                    <div class="space-y-1">
                        <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Technician Notes & Feedback</span>
                        <p class="text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 leading-relaxed max-h-[80px] overflow-y-auto font-medium">${job.technician_notes || 'No notes submitted by technician yet.'}</p>
                    </div>

                    ${job.equipment_used ? `
                        <div class="space-y-1">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Equipment / Parts Used</span>
                            <div class="font-mono text-[10px] bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-slate-300 font-bold">${job.equipment_used}</div>
                        </div>
                    ` : ''}

                    ${checklistHtml}

                    <!-- Before / After Photos -->
                    ${(job.before_photo || job.after_photo) ? `
                        <div class="space-y-1.5 border-t border-white/5 pt-3">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">📸 Deployment Site Proofs</span>
                            <div class="grid grid-cols-2 gap-2">
                                ${job.before_photo ? `
                                    <div class="space-y-1">
                                        <span class="text-[8px] text-slate-400 block font-semibold">BEFORE</span>
                                        <a href="#" onclick="openAdminPhoto(event, '${job.id}', 'before_photo')" class="block group relative overflow-hidden rounded-lg border border-white/10 hover:border-amber-500/50 transition-all bg-black/40">
                                            <img src="${job.before_photo}" class="max-h-24 w-full object-cover group-hover:scale-105 transition-all" />
                                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-opacity uppercase tracking-wider">Zoom</div>
                                        </a>
                                    </div>
                                ` : ''}
                                ${job.after_photo ? `
                                    <div class="space-y-1">
                                        <span class="text-[8px] text-slate-400 block font-semibold">AFTER</span>
                                        <a href="#" onclick="openAdminPhoto(event, '${job.id}', 'after_photo')" class="block group relative overflow-hidden rounded-lg border border-white/10 hover:border-amber-500/50 transition-all bg-black/40">
                                            <img src="${job.after_photo}" class="max-h-24 w-full object-cover group-hover:scale-105 transition-all" />
                                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-opacity uppercase tracking-wider">Zoom</div>
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div class="grid grid-cols-2 gap-3 text-[10px] border-t border-white/5 pt-3">
                        <div>
                            <span class="text-slate-500 block uppercase tracking-wider text-[8px]">Arrival Date</span>
                            <span class="font-mono text-slate-300 block font-medium mt-0.5">${job.arrival_time || '-'}</span>
                        </div>
                        <div>
                            <span class="text-slate-500 block uppercase tracking-wider text-[8px]">Completion Date</span>
                            <span class="font-mono text-slate-300 block font-medium mt-0.5">${job.completion_time || '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        };

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

        async function aiPolishJobNotes(jobId) {
            if (!confirm(`Run Gemini AI to polish shorthand notes for ${jobId}?`)) return;
            try {
                const res = await fetch(`/api/admin/jobs/ai-polish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ job_id: jobId })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("AI Polishing Completed!\n\nOriginal notes updated to:\n\n" + data.polishedText);
                    loadJobsData();
                } else {
                    alert("Failed: " + data.error);
                }
            } catch(e) {
                alert("AI request failed: " + e.message);
            }
        }

        window.openEditTicketModal = function(id, clientId, techId, serviceType, status, desc, mapsUrl, arrivalLat, arrivalLng) {
            document.getElementById('edit-ticket-id').value = id;
            document.getElementById('edit-ticket-id-display').value = id;
            document.getElementById('edit-ticket-service-type').value = serviceType;
            document.getElementById('edit-ticket-status').value = status;
            document.getElementById('edit-ticket-desc').value = desc;

            document.getElementById('edit-ticket-maps-url').value = mapsUrl === 'undefined' || !mapsUrl ? '' : mapsUrl;
            document.getElementById('edit-job-lat').value = arrivalLat === 'undefined' || !arrivalLat ? '' : arrivalLat;
            document.getElementById('edit-job-lng').value = arrivalLng === 'undefined' || !arrivalLng ? '' : arrivalLng;

            const statusEl = document.getElementById('edit-job-resolve-status');
            if (mapsUrl && mapsUrl !== 'undefined' && mapsUrl !== '') {
                statusEl.textContent = `Coordinates: ${arrivalLat}, ${arrivalLng}`;
                statusEl.className = "block text-[8px] text-emerald-400 mt-1 font-bold";
            } else {
                statusEl.textContent = "Coordinates: Not resolved yet";
                statusEl.className = "block text-[8px] text-slate-500 mt-1";
            }

            const clientSelect = document.getElementById('edit-ticket-client');
            clientSelect.innerHTML = document.getElementById('lookup-client').innerHTML;
            clientSelect.value = clientId;

            const techSelect = document.getElementById('edit-ticket-tech');
            techSelect.innerHTML = document.getElementById('lookup-tech').innerHTML;
            techSelect.value = techId;

            document.getElementById('edit-ticket-modal').classList.remove('hidden');
        };

        window.closeEditTicketModal = function() {
            document.getElementById('edit-ticket-modal').classList.add('hidden');
        };

        window.resolveEditJobMapsUrlToCoords = async function(url) {
            const statusEl = document.getElementById('edit-job-resolve-status');
            if (!url || !url.startsWith('http')) {
                statusEl.textContent = "Coordinates: Not resolved yet";
                statusEl.className = "block text-[8px] text-slate-500 mt-1";
                document.getElementById('edit-job-lat').value = '';
                document.getElementById('edit-job-lng').value = '';
                return;
            }

            statusEl.textContent = "Resolving Google Maps URL...";
            statusEl.className = "block text-[8px] text-amber-400 mt-1 animate-pulse";

            try {
                const baseUrl = document.getElementById('api-base').value;
                const res = await fetch(`${baseUrl}/api/admin/resolve-coords?url=${encodeURIComponent(url)}`);
                const data = await res.json();

                if (res.ok && data.success) {
                    document.getElementById('edit-job-lat').value = data.lat;
                    document.getElementById('edit-job-lng').value = data.lng;
                    statusEl.textContent = `Successfully resolved coordinates: ${data.lat.toFixed(6)}, ${data.lng.toFixed(6)}`;
                    statusEl.className = "block text-[8px] text-emerald-400 mt-1 font-bold";
                } else {
                    statusEl.textContent = "Could not resolve GPS coordinates from this link.";
                    statusEl.className = "block text-[8px] text-rose-400 mt-1";
                }
            } catch(e) {
                statusEl.textContent = "Resolution API error: " + e.message;
                statusEl.className = "block text-[8px] text-rose-400 mt-1";
            }
        };

        window.submitEditTicket = async function(e) {
            e.preventDefault();
            const id = document.getElementById('edit-ticket-id').value;
            const new_id = document.getElementById('edit-ticket-id-display').value.trim();
            const client_id = document.getElementById('edit-ticket-client').value;
            const technician_id = document.getElementById('edit-ticket-tech').value;
            const service_type = document.getElementById('edit-ticket-service-type').value;
            const status = document.getElementById('edit-ticket-status').value;
            const job_description = document.getElementById('edit-ticket-desc').value.trim();
            const maps_url = document.getElementById('edit-ticket-maps-url').value.trim();
            const arrival_lat = document.getElementById('edit-job-lat').value;
            const arrival_lng = document.getElementById('edit-job-lng').value;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/jobs/edit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id, new_id, client_id, technician_id, service_type, status, job_description, maps_url, arrival_lat, arrival_lng })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Service ticket updated successfully.");
                    closeEditTicketModal();
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.cancelJob = async function(id) {
            if (!confirm(`Are you sure you want to cancel ticket ${id}?`)) return;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/jobs/cancel`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Service ticket cancelled successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        function renderFullJobsTable(jobs) {
            const tbody = document.getElementById('full-jobs-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            
            jobs.forEach(j => {
                const statusBadge = j.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400' : j.status === 'In Progress' ? 'bg-indigo-500/10 text-indigo-400' : j.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-500';
                
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
                    <tr class="clickable-row border-b border-white/5 hover:bg-white/5 transition-all text-slate-300 align-middle cursor-pointer" onclick="if(!event.target.closest('button') && !event.target.closest('img') && !event.target.closest('a')) { this.classList.toggle('expanded'); document.getElementById('details-${j.id}').classList.toggle('hidden'); }">
                        <td class="py-2.5 font-mono text-amber-500 font-bold">
                            <span class="row-expand-arrow">▶</span>${j.id}
                        </td>
                        <td class="py-2.5 font-semibold text-white">${j.company_name || 'Client'}</td>
                        <td class="py-2.5">${j.tech_name || 'Tech'}</td>
                        <td class="py-2.5 text-slate-400">${j.service_type}</td>
                        <td class="py-2.5"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                        <td class="py-2.5 text-right space-x-1" onclick="event.stopPropagation()">
                            <button onclick="aiPolishJobNotes('${j.id}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[9px] px-2 py-1 rounded transition-all">✨ AI Polish</button>
                            <button onclick="openEditTicketModal('${j.id}', '${j.client_id}', '${j.technician_id}', '${j.service_type}', '${j.status}', '${j.job_description.replace(/'/g, "\\'")}', '${j.maps_url || ''}', '${j.arrival_lat || ''}', '${j.arrival_lng || ''}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold text-[9px] px-2 py-1 rounded transition-all">Edit</button>
                            <button onclick="cancelJob('${j.id}')" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[9px] px-2 py-1 rounded transition-all">Cancel</button>
                        </td>
                    </tr>
                    <tr id="details-${j.id}" class="detail-row hidden bg-black/20">
                        <td colspan="6" class="p-4 text-xs text-slate-400 border-b border-white/5 space-y-3">
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

        let activeMapFilter = 'all';
        let currentMapTheme = 'dark';

        function setMapTheme(theme) {
            currentMapTheme = theme;
            const btnDark = document.getElementById('map-theme-dark');
            const btnLight = document.getElementById('map-theme-light');
            if (btnDark) btnDark.className = theme === 'dark' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500 py-2 rounded-lg' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white py-2 rounded-lg';
            if (btnLight) btnLight.className = theme === 'light' ? 'bg-amber-500/10 border border-amber-500/30 text-amber-500 py-2 rounded-lg' : 'bg-white/5 border border-white/10 text-slate-400 hover:text-white py-2 rounded-lg';
            
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                if (theme === 'dark') {
                    mapContainer.classList.add('dark-map-theme');
                } else {
                    mapContainer.classList.remove('dark-map-theme');
                }
            }
        }

        function mapCenterToHQ() {
            const hq = loadHQConfig();
            if (map) {
                map.setView([hq.lat, hq.lng], 13);
            }
        }

        function filterMapMarkers(status) {
            activeMapFilter = status;
            
            // Re-render markers with filter applied
            loadJobsData();
        }

        function centerToCrew(lat, lng) {
            if (map) {
                map.setView([lat, lng], 15);
                mapMarkers.forEach(m => {
                    if (Math.abs(m.getLatLng().lat - lat) < 0.0001 && Math.abs(m.getLatLng().lng - lng) < 0.0001) {
                        m.openPopup();
                    }
                });
            }
        }

        function plotJobsOnMap(jobs) {
            if (!map) return;
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

            // Compute counts for filter indicators
            const pendingCount = jobs.filter(j => j.status === 'Pending').length;
            const progressCount = jobs.filter(j => j.status === 'In Progress').length;
            const completedCount = jobs.filter(j => j.status === 'Completed').length;
            
            const elAll = document.getElementById('map-count-all');
            const elPending = document.getElementById('map-count-pending');
            const elProgress = document.getElementById('map-count-progress');
            const elCompleted = document.getElementById('map-count-completed');
            
            if (elAll) elAll.textContent = jobs.length;
            if (elPending) elPending.textContent = pendingCount;
            if (elProgress) elProgress.textContent = progressCount;
            if (elCompleted) elCompleted.textContent = completedCount;

            const crewListEl = document.getElementById('map-active-crews-list');
            if (crewListEl) crewListEl.innerHTML = '';

            // 2. Draw jobs
            jobs.forEach(job => {
                if (activeMapFilter !== 'all' && job.status !== activeMapFilter) return;

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

                // Add to locate active dispatches list
                if (crewListEl) {
                    const statusColor = job.status === 'Completed' ? 'text-emerald-400' : job.status === 'In Progress' ? 'text-indigo-400' : 'text-amber-500';
                    const itemHtml = `
                        <button onclick="centerToCrew(${lat}, ${lng})" class="w-full text-left bg-white/5 hover:bg-white/10 p-2 rounded-xl transition text-[10px] space-y-1 border border-white/5">
                            <div class="flex justify-between font-bold">
                                <span class="text-white truncate max-w-[80px]">${job.tech_name || 'Unassigned'}</span>
                                <span class="${statusColor}">${job.status}</span>
                            </div>
                            <div class="text-slate-400 truncate text-[9px]">${job.company_name || 'Client'} [${job.id}]</div>
                        </button>
                    `;
                    crewListEl.innerHTML += itemHtml;
                }
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

        let activeCardFilter = 'all';
        let activeClientDirectoryTab = 'corporate';

        async function loadClientsData() {
            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`${baseUrl}/api/admin/clients/list`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error();
                clientsList = await res.json();
                
                renderClientStats();
                filterAndSortClients();
            } catch(e) {
                console.error("Failed to load clients list", e);
            }
        }

        function renderClientStats() {
            const elTotal = document.getElementById('cms-stat-total');
            const elActive = document.getElementById('cms-stat-active');
            const elExpired = document.getElementById('cms-stat-expired');

            if (!elTotal || !elActive || !elExpired) return;

            const total = clientsList.length;
            const active = clientsList.filter(c => c.amc_status === 'Active').length;
            const expired = clientsList.filter(c => c.amc_status === 'Expired').length;

            elTotal.textContent = total;
            elActive.textContent = active;
            elExpired.textContent = expired;
        }

        window.setClientStatusCardFilter = function(status) {
            activeCardFilter = status;
            
            // Sync status dropdown selector if needed
            const dropdown = document.getElementById('client-status-dropdown');
            if (dropdown) {
                dropdown.value = status === 'Active' ? 'Active' : status === 'Expired' ? 'Expired' : 'all';
            }
            
            filterAndSortClients();
        };

        window.setClientDirectoryTab = function(tab) {
            activeClientDirectoryTab = tab;
            
            const btnCorp = document.getElementById('tab-client-corporate');
            const btnInd = document.getElementById('tab-client-individual');
            const statusDropdown = document.getElementById('client-status-dropdown');
            
            if (tab === 'corporate') {
                btnCorp.className = "text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-white border border-amber-500/30 bg-amber-500/10";
                btnInd.className = "text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-slate-400 border border-transparent hover:text-white";
                statusDropdown?.classList.remove('hidden');
            } else {
                btnCorp.className = "text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-slate-400 border border-transparent hover:text-white";
                btnInd.className = "text-xs font-bold px-3 py-1.5 rounded-lg transition-all text-white border border-amber-500/30 bg-amber-500/10";
                statusDropdown?.classList.add('hidden');
            }
            
            filterAndSortClients();
        };

        window.filterAndSortClients = function() {
            const query = (document.getElementById('client-search-input')?.value || '').toLowerCase().trim();
            const dropdownStatus = document.getElementById('client-status-dropdown')?.value || 'all';
            const sortBy = document.getElementById('client-sort-dropdown')?.value || 'name-asc';

            // 1. Separate B2B (Corporate) and B2C (Individual) tabs
            let filtered = clientsList;
            if (activeClientDirectoryTab === 'corporate') {
                // Exclude B2C Individual clients
                filtered = filtered.filter(c => c.amc_status !== 'Individual');
                
                // Combine card filter and dropdown status filter
                let targetStatus = dropdownStatus;
                if (activeCardFilter !== 'all') {
                    targetStatus = activeCardFilter;
                }

                if (targetStatus !== 'all') {
                    filtered = filtered.filter(c => c.amc_status === targetStatus);
                }
            } else {
                // Only show B2C Individual clients
                filtered = filtered.filter(c => c.amc_status === 'Individual');
            }

            // 2. Apply search query filter
            if (query) {
                filtered = filtered.filter(c => 
                    c.id.toLowerCase().includes(query) ||
                    c.company_name.toLowerCase().includes(query) ||
                    (c.contact_person && c.contact_person.toLowerCase().includes(query)) ||
                    (c.phone && c.phone.toLowerCase().includes(query)) ||
                    (c.address && c.address.toLowerCase().includes(query))
                );
            }

            // 3. Apply sorting
            filtered.sort((a, b) => {
                if (sortBy === 'name-asc') {
                    return a.company_name.localeCompare(b.company_name);
                } else if (sortBy === 'name-desc') {
                    return b.company_name.localeCompare(a.company_name);
                } else if (sortBy === 'id-asc') {
                    return a.id.localeCompare(b.id);
                } else if (sortBy === 'expiry-soon') {
                    const dateA = a.amc_end ? new Date(a.amc_end) : new Date('9999-12-31');
                    const dateB = b.amc_end ? new Date(b.amc_end) : new Date('9999-12-31');
                    return dateA - dateB;
                }
                return 0;
            });

            // Reset active card filter helper state if dropdown was manually changed
            if (activeCardFilter !== 'all' && dropdownStatus !== activeCardFilter) {
                activeCardFilter = 'all';
            }

            renderClientsTable(filtered);
        };

        let historyModalJobs = [];

        function renderClientsTable(list) {
            const tbody = document.getElementById('clients-list-body');
            if (!tbody) return;
            tbody.innerHTML = '';
            if (list.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-slate-600">No clients match this filter criteria.</td></tr>';
                return;
            }
            list.forEach(c => {
                let badgeClass = 'bg-slate-500/10 text-slate-400';
                if (c.amc_status === 'Active') badgeClass = 'bg-emerald-500/10 text-emerald-400';
                else if (c.amc_status === 'Expired') badgeClass = 'bg-rose-500/10 text-rose-400';
                else if (c.amc_status === 'No AMC') badgeClass = 'bg-amber-500/10 text-amber-500';
                else if (c.amc_status === 'Individual') badgeClass = 'bg-indigo-500/10 text-indigo-400';

                const amcRange = (c.amc_start || c.amc_end) 
                    ? `<div class="text-[10px] text-slate-500 font-mono mt-0.5">${c.amc_start || ''} to ${c.amc_end || ''}</div>`
                    : '';

                tbody.innerHTML += `
                    <tr class="hover:bg-white/5 transition-all text-slate-300 align-middle">
                        <td class="py-3 px-2 font-mono font-bold text-amber-500">${c.id}</td>
                        <td class="py-3 px-2">
                            <div class="font-bold text-white">${c.company_name}</div>
                            <div class="text-[10px] text-slate-400">Manager: ${c.contact_person || '-'}</div>
                        </td>
                        <td class="py-3 px-2">
                            <div class="font-mono">${c.phone || '-'}</div>
                            <div class="text-[10px] text-slate-500 truncate max-w-[150px]" title="${c.address}">${c.address}</div>
                        </td>
                        <td class="py-3 px-2">
                            <span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${badgeClass}">${c.amc_status}</span>
                            ${amcRange}
                        </td>
                        <td class="py-3 px-2 text-right space-x-1 whitespace-nowrap">
                            <button onclick="openClientHistoryModal('${c.id}', '${c.company_name.replace(/'/g, "\\'")}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[10px] px-2 py-1 rounded transition-all">📜 History</button>
                            <button onclick="openEditClient('${c.id}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold text-[10px] px-2 py-1 rounded transition-all">✏️ Edit</button>
                            <button onclick="deleteClient('${c.id}')" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] px-2 py-1 rounded transition-all">🗑️ Delete</button>
                        </td>
                    </tr>
                `;
            });
        }

        window.openEditClient = function(id) {
            const client = clientsList.find(c => c.id === id);
            if (!client) return;

            document.getElementById('client-id-field').value = client.id;
            document.getElementById('client-id-field').readOnly = true;
            document.getElementById('client-company-field').value = client.company_name;
            document.getElementById('client-contact-field').value = client.contact_person;
            document.getElementById('client-address-field').value = client.address;
            document.getElementById('client-phone-field').value = client.phone;
            document.getElementById('client-start-field').value = client.amc_start || '';
            document.getElementById('client-end-field').value = client.amc_end || '';
            document.getElementById('client-status-field').value = client.amc_status;

            document.getElementById('client-form-title').innerHTML = '<span class="text-amber-500">✏️</span> Edit Client Profile';
            document.getElementById('client-cancel-edit-btn').classList.remove('hidden');
        };

        window.resetClientForm = function() {
            document.getElementById('client-id-field').value = '';
            document.getElementById('client-id-field').readOnly = false;
            document.getElementById('client-form').reset();
            document.getElementById('client-form-title').innerHTML = '<span class="text-amber-500">🏢</span> Provision Client Profile';
            document.getElementById('client-cancel-edit-btn').classList.add('hidden');
        };

        window.submitClient = async function(e) {
            e.preventDefault();
            const form = e.target;
            const data = Object.fromEntries(new FormData(form));
            const idField = document.getElementById('client-id-field');
            const isEdit = idField.readOnly;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            const endpoint = isEdit ? '/api/admin/clients/edit' : '/api/admin/clients';

            try {
                const res = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify(data)
                });
                const resData = await res.json();
                if (res.ok) {
                    alert(resData.message || "Client saved successfully.");
                    resetClientForm();
                    refreshDashboardData();
                } else {
                    alert("Error: " + resData.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.deleteClient = async function(id) {
            if (!confirm(`Are you sure you want to delete client ${id}?`)) return;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/clients/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ id })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Client deleted successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.openClientHistoryModal = async function(clientId, companyName) {
            const modal = document.getElementById('client-history-modal');
            const title = document.getElementById('history-modal-client-title');
            const listContainer = document.getElementById('history-tickets-list');
            const detailsContainer = document.getElementById('history-ticket-details');

            if (!modal || !title || !listContainer) return;

            title.textContent = companyName;
            listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">Pulling service logs...</p>';
            detailsContainer.innerHTML = `
                <div class="text-center text-slate-500 py-12">
                    <span class="text-3xl block mb-2">🎫</span>
                    <p class="text-xs font-medium">Select a service ticket from the list to inspect operational details.</p>
                </div>
            `;
            modal.classList.remove('hidden');

            const baseUrl = document.getElementById('api-base').value;
            try {
                const res = await fetch(`${baseUrl}/api/jobs`);
                const allJobs = await res.json();
                
                // Filter jobs by client
                historyModalJobs = allJobs.filter(j => j.client_id === clientId);

                listContainer.innerHTML = '';
                if (historyModalJobs.length === 0) {
                    listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">No service records registered for this client.</p>';
                    return;
                }

                historyModalJobs.forEach(j => {
                    let statusBadge = 'bg-slate-500/10 text-slate-400';
                    if (j.status === 'Completed') statusBadge = 'bg-emerald-500/10 text-emerald-400';
                    else if (j.status === 'In Progress') statusBadge = 'bg-blue-500/10 text-blue-400';
                    else if (j.status === 'Pending') statusBadge = 'bg-amber-500/10 text-amber-500';
                    else if (j.status === 'Cancelled') statusBadge = 'bg-rose-500/10 text-rose-400';

                    listContainer.innerHTML += `
                        <div onclick="renderClientHistoryDetails('${j.id}')" class="bg-white/5 border border-white/5 hover:border-amber-500/30 p-3 rounded-xl cursor-pointer transition-all flex justify-between items-center group">
                            <div>
                                <div class="font-mono font-bold text-white text-[11px] group-hover:text-amber-500 transition-colors">${j.id}</div>
                                <div class="text-[10px] text-slate-400 mt-0.5">${j.service_type} • ${j.created_at ? j.created_at.split(' ')[0] : '-'}</div>
                            </div>
                            <span class="px-2 py-0.5 rounded-full font-bold text-[8px] uppercase ${statusBadge}">${j.status}</span>
                        </div>
                    `;
                });

            } catch (err) {
                listContainer.innerHTML = '<p class="text-xs text-rose-400 py-4 text-center">Failed to load service records.</p>';
                console.error(err);
            }
        };

        window.closeClientHistoryModal = function() {
            const modal = document.getElementById('client-history-modal');
            if (modal) modal.classList.add('hidden');
        };

        window.renderClientHistoryDetails = function(jobId) {
            const detailsContainer = document.getElementById('history-ticket-details');
            if (!detailsContainer) return;

            const job = historyModalJobs.find(j => j.id === jobId);
            if (!job) return;

            // Format check-list parameters if any
            let checklistHtml = '';
            if (job.checklist_data) {
                try {
                    const checklist = JSON.parse(job.checklist_data);
                    checklistHtml = `
                        <div class="space-y-1">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Completed Checklist Checklist</span>
                            <div class="grid grid-cols-2 gap-1 text-[10px]">
                                ${Object.entries(checklist).map(([key, val]) => `
                                    <div class="flex items-center gap-1.5 text-slate-300">
                                        <span>${val ? '✅' : '❌'}</span>
                                        <span class="capitalize">${key.replace(/_/g, ' ')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
                } catch(e) {}
            }

            detailsContainer.innerHTML = `
                <div class="space-y-3">
                    <div class="flex justify-between items-start border-b border-white/5 pb-2">
                        <div>
                            <div class="font-mono font-black text-amber-500 text-sm">${job.id}</div>
                            <div class="text-[10px] text-slate-400 mt-0.5">Category Type: <span class="text-white font-semibold">${job.service_type}</span></div>
                        </div>
                        <div class="text-right">
                            <div class="text-[10px] text-slate-400">Technician</div>
                            <div class="text-[10px] font-bold text-white mt-0.5">🛠️ ${job.tech_name || 'Unassigned'}</div>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Statement of Scope</span>
                        <p class="text-[11px] text-slate-300 bg-black/40 border border-white/5 rounded-lg p-2.5 leading-relaxed max-h-[80px] overflow-y-auto font-medium">${job.job_description}</p>
                    </div>

                    <div class="space-y-1">
                        <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Technician Notes & Feedback</span>
                        <p class="text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2.5 leading-relaxed max-h-[80px] overflow-y-auto font-medium">${job.technician_notes || 'No notes submitted by technician yet.'}</p>
                    </div>

                    ${job.equipment_used ? `
                        <div class="space-y-1">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">Equipment / Parts Used</span>
                            <div class="font-mono text-[10px] bg-black/40 border border-white/5 rounded-lg px-2.5 py-1.5 text-slate-300 font-bold">${job.equipment_used}</div>
                        </div>
                    ` : ''}

                    ${checklistHtml}

                    <!-- Before / After Photos -->
                    ${(job.before_photo || job.after_photo) ? `
                        <div class="space-y-1.5 border-t border-white/5 pt-3">
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">📸 Deployment Site Proofs</span>
                            <div class="grid grid-cols-2 gap-2">
                                ${job.before_photo ? `
                                    <div class="space-y-1">
                                        <span class="text-[8px] text-slate-400 block font-semibold">BEFORE</span>
                                        <a href="#" onclick="openAdminPhoto(event, '${job.id}', 'before_photo')" class="block group relative overflow-hidden rounded-lg border border-white/10 hover:border-amber-500/50 transition-all bg-black/40">
                                            <img src="${job.before_photo}" class="max-h-24 w-full object-cover group-hover:scale-105 transition-all" />
                                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-opacity uppercase tracking-wider">Zoom</div>
                                        </a>
                                    </div>
                                ` : ''}
                                ${job.after_photo ? `
                                    <div class="space-y-1">
                                        <span class="text-[8px] text-slate-400 block font-semibold">AFTER</span>
                                        <a href="#" onclick="openAdminPhoto(event, '${job.id}', 'after_photo')" class="block group relative overflow-hidden rounded-lg border border-white/10 hover:border-amber-500/50 transition-all bg-black/40">
                                            <img src="${job.after_photo}" class="max-h-24 w-full object-cover group-hover:scale-105 transition-all" />
                                            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[8px] font-bold text-white transition-opacity uppercase tracking-wider">Zoom</div>
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}

                    <div class="grid grid-cols-2 gap-3 text-[10px] border-t border-white/5 pt-3">
                        <div>
                            <span class="text-slate-500 block uppercase tracking-wider text-[8px]">Arrival Date</span>
                            <span class="font-mono text-slate-300 block font-medium mt-0.5">${job.arrival_time || '-'}</span>
                        </div>
                        <div>
                            <span class="text-slate-500 block uppercase tracking-wider text-[8px]">Completion Date</span>
                            <span class="font-mono text-slate-300 block font-medium mt-0.5">${job.completion_time || '-'}</span>
                        </div>
                    </div>
                </div>
            `;
        };

        window.openAdminPhoto = function(event, jobId, fieldName) {
            event.preventDefault();
            const baseUrl = document.getElementById('api-base').value;
            fetch(`${baseUrl}/api/jobs`)
                .then(res => res.json())
                .then(jobs => {
                    const job = jobs.find(j => j.id === jobId);
                    if (job && job[fieldName]) {
                        const base64Data = job[fieldName];
                        const w = window.open();
                        if (w) {
                            w.document.write(`
                                <html>
                                <head><title>View Proof Photo</title></head>
                                <body style="margin:0; background:#070709; display:flex; align-items:center; justify-content:center; min-height:100vh;">
                                    <img src="${base64Data}" style="max-width:100%; max-height:100vh; object-fit:contain; box-shadow:0 10px 30px rgba(0,0,0,0.5); border-radius:8px;" />
                                </body>
                                </html>
                            `);
                            w.document.close();
                        } else {
                            alert("Popup blocked! Please allow popups for this site.");
                        }
                    } else {
                        alert("Photo not found.");
                    }
                });
        };

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

        async function generateCustomReport() {
            const reportType = document.getElementById('report-select-type').value;
            const timeframe = document.getElementById('report-select-timeframe').value;
            const baseUrl = document.getElementById('api-base').value;
            const secret = document.getElementById('admin-secret').value;

            const resPanel = document.getElementById('report-result-panel');
            const resTitle = document.getElementById('report-title-display');
            const resTime = document.getElementById('report-timestamp-display');
            const tableHead = document.getElementById('report-result-head');
            const tableBody = document.getElementById('report-result-body');

            resPanel.classList.remove('hidden');
            resTime.textContent = new Date().toLocaleString();
            tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">Compiling database metrics...</td></tr>`;

            try {
                // Fetch datasets
                const jobsRes = await fetch(`${baseUrl}/api/jobs`);
                const jobs = await jobsRes.json();

                const cashRes = await fetch(`${baseUrl}/api/admin/cash/transactions`, {
                    headers: { 'X-Admin-Secret': secret }
                });
                const cashTransactions = await cashRes.json() || [];

                const invRes = await fetch(`${baseUrl}/api/admin/inventory/list`);
                const inventory = await invRes.json();

                const lookupsRes = await fetch(`${baseUrl}/api/admin/lookups`);
                const lookups = await lookupsRes.json();
                const clients = lookups.clients || [];

                const warrantyRes = await fetch(`${baseUrl}/api/admin/warranty/list`, {
                    headers: { 'X-Admin-Secret': secret }
                });
                const warranties = await warrantyRes.json();

                const rmaRes = await fetch(`${baseUrl}/api/admin/rma/list`, {
                    headers: { 'X-Admin-Secret': secret }
                });
                const rmas = await rmaRes.json();

                // Apply timeframe filter
                const now = new Date();
                const filterByTime = (dateStr) => {
                    if (timeframe === 'all' || !dateStr) return true;
                    const logDate = new Date(dateStr);
                    
                    if (timeframe === 'this-month') {
                        return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
                    }
                    if (timeframe === 'last-month') {
                        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
                        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
                        return logDate.getMonth() === lastMonth && logDate.getFullYear() === lastMonthYear;
                    }
                    if (timeframe === 'this-year') {
                        return logDate.getFullYear() === now.getFullYear();
                    }
                    if (timeframe === 'last-year') {
                        return logDate.getFullYear() === now.getFullYear() - 1;
                    }
                    
                    const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
                    return diffDays <= parseInt(timeframe);
                };

                if (reportType === 'tech-performance') {
                    resTitle.textContent = "Technician Performance Audit";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Tech ID / Name</th>
                            <th class="pb-2">Total Jobs</th>
                            <th class="pb-2">Completed</th>
                            <th class="pb-2">Pending / In Progress</th>
                            <th class="pb-2 text-right">Completion Rate</th>
                        </tr>
                    `;

                    // Calculate tech stats
                    const techStats = {};
                    jobs.forEach(j => {
                        const tech = j.tech_name || j.technician_id || 'UNASSIGNED';
                        if (!filterByTime(j.created_at)) return;
                        if (!techStats[tech]) {
                            techStats[tech] = { total: 0, completed: 0, active: 0 };
                        }
                        techStats[tech].total++;
                        if (j.status === 'Completed') {
                            techStats[tech].completed++;
                        } else {
                            techStats[tech].active++;
                        }
                    });

                    tableBody.innerHTML = '';
                    Object.entries(techStats).forEach(([tech, stat]) => {
                        const rate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-bold text-white">${tech}</td>
                            <td class="py-2.5">${stat.total}</td>
                            <td class="py-2.5 text-emerald-400">${stat.completed}</td>
                            <td class="py-2.5 text-amber-400">${stat.active}</td>
                            <td class="py-2.5 text-right font-mono font-bold">${rate}%</td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'customer-service') {
                    resTitle.textContent = "Customer Service Audit";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Customer Name</th>
                            <th class="pb-2">Total Tickets</th>
                            <th class="pb-2">Completed</th>
                            <th class="pb-2">AMC Status</th>
                            <th class="pb-2 text-right">Revenue Contributed</th>
                        </tr>
                    `;

                    const clientStats = {};
                    clients.forEach(c => {
                        clientStats[c.id] = { name: c.company_name, amc: c.amc_status, total: 0, completed: 0, cash: 0 };
                    });

                    jobs.forEach(j => {
                        if (!filterByTime(j.created_at)) return;
                        const cid = j.client_id;
                        if (!clientStats[cid]) {
                            clientStats[cid] = { name: j.company_name || 'Unknown', amc: '-', total: 0, completed: 0, cash: 0 };
                        }
                        clientStats[cid].total++;
                        if (j.status === 'Completed') clientStats[cid].completed++;
                    });

                    cashTransactions.forEach(t => {
                        if (!filterByTime(t.created_at)) return;
                        if (t.job_id) {
                            const job = jobs.find(j => j.id === t.job_id);
                            if (job && clientStats[job.client_id]) {
                                const val = parseFloat(t.amount) * (t.primary_currency === 'USD' ? 1 : (1 / parseFloat(t.exchange_rate)));
                                clientStats[job.client_id].cash += val;
                            }
                        }
                    });

                    tableBody.innerHTML = '';
                    Object.values(clientStats).forEach(stat => {
                        if (stat.total === 0 && stat.cash === 0) return; // skip inactive
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-bold text-white">${stat.name}</td>
                            <td class="py-2.5">${stat.total}</td>
                            <td class="py-2.5 text-emerald-400">${stat.completed}</td>
                            <td class="py-2.5 text-slate-400">${stat.amc || 'No AMC'}</td>
                            <td class="py-2.5 text-right font-mono font-bold">$${stat.cash.toFixed(2)}</td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'job-ledger') {
                    resTitle.textContent = "Job History Ledger";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Job ID</th>
                            <th class="pb-2">Client</th>
                            <th class="pb-2">Service Type</th>
                            <th class="pb-2">Tech Assigned</th>
                            <th class="pb-2">Created Date</th>
                            <th class="pb-2 text-right">Status</th>
                        </tr>
                    `;

                    tableBody.innerHTML = '';
                    const filteredJobs = jobs.filter(j => filterByTime(j.created_at));
                    if (filteredJobs.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No jobs found in this timeframe.</td></tr>`;
                        return;
                    }

                    filteredJobs.forEach(j => {
                        let statusColor = 'text-amber-400';
                        if (j.status === 'Completed') statusColor = 'text-emerald-400';
                        else if (j.status === 'Cancelled') statusColor = 'text-rose-500';

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-mono font-bold text-white">${j.id}</td>
                            <td class="py-2.5">${j.company_name || 'General'}</td>
                            <td class="py-2.5 text-slate-300">${j.service_type}</td>
                            <td class="py-2.5">${j.tech_name || 'Unassigned'}</td>
                            <td class="py-2.5 text-slate-400 font-mono text-[10px]">${new Date(j.created_at).toLocaleDateString()}</td>
                            <td class="py-2.5 text-right font-bold ${statusColor}">${j.status}</td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'cashflow') {
                    resTitle.textContent = "Safe Cash Flow Statement";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Date</th>
                            <th class="pb-2">Type</th>
                            <th class="pb-2">Linked Job</th>
                            <th class="pb-2">Amount</th>
                            <th class="pb-2">Exchange Rate</th>
                            <th class="pb-2 text-right">MMK Value</th>
                        </tr>
                    `;

                    tableBody.innerHTML = '';
                    const filteredTx = cashTransactions.filter(t => filterByTime(t.created_at));
                    if (filteredTx.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No cash transactions in this timeframe.</td></tr>`;
                        return;
                    }

                    filteredTx.forEach(tx => {
                        const valueMMK = parseFloat(tx.amount) * parseFloat(tx.exchange_rate);
                        const isWithdrawal = tx.transaction_type === 'Withdrawal';
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 text-slate-400">${new Date(tx.created_at || Date.now()).toLocaleDateString()}</td>
                            <td class="py-2.5 ${isWithdrawal ? 'text-rose-400' : 'text-emerald-400'}">${tx.transaction_type}</td>
                            <td class="py-2.5 font-mono">${tx.job_id || '-'}</td>
                            <td class="py-2.5 font-mono">${tx.primary_currency === 'USD' ? '$' : ''}${parseFloat(tx.amount).toFixed(2)} ${tx.primary_currency}</td>
                            <td class="py-2.5 font-mono">1 USD = ${tx.exchange_rate} Ks</td>
                            <td class="py-2.5 text-right font-mono font-bold">${isWithdrawal ? '-' : '+'}${Math.round(valueMMK).toLocaleString()} Ks</td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'inventory-low') {
                    resTitle.textContent = "Inventory Consumption & Low Stock";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Item Code</th>
                            <th class="pb-2">Item Name</th>
                            <th class="pb-2">Category</th>
                            <th class="pb-2 text-right">Unit Price</th>
                            <th class="pb-2 text-right">Stock Level</th>
                            <th class="pb-2 text-right">Status</th>
                        </tr>
                    `;

                    tableBody.innerHTML = '';
                    inventory.forEach(item => {
                        const qty = parseInt(item.stock_qty) || 0;
                        let statusColor = "text-emerald-400";
                        let statusText = "OK";
                        if (qty === 0) {
                            statusColor = "text-rose-500 font-bold animate-pulse";
                            statusText = "OUT OF STOCK";
                        } else if (qty <= 5) {
                            statusColor = "text-amber-500 font-bold";
                            statusText = "LOW STOCK";
                        }

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-mono text-white">${item.code}</td>
                            <td class="py-2.5">${item.name}</td>
                            <td class="py-2.5 text-slate-400">${item.category || 'General'}</td>
                            <td class="py-2.5 text-right font-mono">$${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                            <td class="py-2.5 text-right font-mono font-bold">${qty}</td>
                            <td class="py-2.5 text-right ${statusColor} font-bold">${statusText}</td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'amc-expiry') {
                    resTitle.textContent = "Maintenance & AMC Expiry Schedule";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Company Name</th>
                            <th class="pb-2">Contact</th>
                            <th class="pb-2">AMC Start</th>
                            <th class="pb-2">AMC End</th>
                            <th class="pb-2">Status</th>
                            <th class="pb-2 text-right">Remaining Days</th>
                        </tr>
                    `;

                    tableBody.innerHTML = '';
                    const filteredClients = clients.filter(c => c.amc_status && c.amc_status !== 'No AMC');
                    if (filteredClients.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-slate-500">No active maintenance accounts.</td></tr>`;
                        return;
                    }

                    filteredClients.forEach(c => {
                        let remainingDays = "Expired";
                        if (c.amc_end) {
                            const end = new Date(c.amc_end);
                            const diff = end - now;
                            remainingDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
                        }

                        const isNearExpiry = typeof remainingDays === 'number' && remainingDays <= 30 && remainingDays > 0;
                        const isExpired = typeof remainingDays === 'number' && remainingDays <= 0;

                        let statusColor = "text-emerald-400";
                        if (isExpired) statusColor = "text-rose-500 font-bold";
                        else if (isNearExpiry) statusColor = "text-amber-500 font-bold";

                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-bold text-white">${c.company_name}</td>
                            <td class="py-2.5">${c.contact_person} (${c.phone})</td>
                            <td class="py-2.5 font-mono">${c.amc_start || '-'}</td>
                            <td class="py-2.5 font-mono">${c.amc_end || '-'}</td>
                            <td class="py-2.5 font-bold ${statusColor}">${c.amc_status}</td>
                            <td class="py-2.5 text-right font-mono font-bold ${statusColor}">
                                ${typeof remainingDays === 'number' ? (remainingDays > 0 ? `${remainingDays} Days` : 'Expired') : '-'}
                            </td>
                        `;
                        tableBody.appendChild(tr);
                    });

                } else if (reportType === 'warranty-rma') {
                    resTitle.textContent = "Active Warranty & RMA Claims Log";
                    tableHead.innerHTML = `
                        <tr class="text-slate-500 border-b border-white/5 pb-2">
                            <th class="pb-2">Serial / Item</th>
                            <th class="pb-2">Tracking ID</th>
                            <th class="pb-2">Distributor</th>
                            <th class="pb-2">Sent Date</th>
                            <th class="pb-2">Status</th>
                        </tr>
                    `;

                    tableBody.innerHTML = '';
                    if (rmas.length === 0) {
                        tableBody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-500">No active RMA claims found.</td></tr>`;
                        return;
                    }

                    rmas.forEach(r => {
                        const tr = document.createElement('tr');
                        tr.className = "hover:bg-white/5 border-b border-white/5 pb-2";
                        tr.innerHTML = `
                            <td class="py-2.5 font-bold text-white">${r.serial_number}</td>
                            <td class="py-2.5 font-mono">${r.rma_id}</td>
                            <td class="py-2.5">${r.distributor}</td>
                            <td class="py-2.5 font-mono">${r.sent_date}</td>
                            <td class="py-2.5"><span class="text-amber-500 font-bold">${r.status || 'Pending'}</span></td>
                        `;
                        tableBody.appendChild(tr);
                    });
                }

            } catch (err) {
                tableBody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-400">Failed to compile metrics: ${err.message}</td></tr>`;
            }
        }

        // ─── AI COPILOT WORKSPACE SCRIPT HANDLERS ───
        let lastSuggestedDomain = '';
        let lastSuggestedTechId = '';
        let copilotMap = null;
        let copilotMarkers = [];

        function setCopilotTab(tab) {
            // Toggles between dispatcher, routes, and chat
            ['dispatcher', 'routes', 'chat'].forEach(t => {
                const btn = document.getElementById(`copilot-tab-${t}`);
                const workspace = document.getElementById(`copilot-workspace-${t}`);
                if (t === tab) {
                    btn.classList.add('border-b-2', 'border-amber-500', 'text-white');
                    btn.classList.remove('text-slate-400', 'font-semibold');
                    workspace.classList.remove('hidden');
                } else {
                    btn.classList.remove('border-b-2', 'border-amber-500', 'text-white');
                    btn.classList.add('text-slate-400', 'font-semibold');
                    workspace.classList.add('hidden');
                }
            });

            // Initialize route optimizer map if selected
            if (tab === 'routes') {
                setTimeout(initCopilotMap, 100);
            }
        }

        // 1. Auto-Dispatcher
        async function runAIDispatcher() {
            const rawText = document.getElementById('ai-dispatch-input').value.trim();
            if (!rawText) return alert("Please paste a client complaint description.");

            const elDomain = document.getElementById('ai-dispatch-domain');
            const elTech = document.getElementById('ai-dispatch-tech');
            const elExp = document.getElementById('ai-dispatch-explanation');
            const btnApply = document.getElementById('btn-apply-ai-dispatch');

            elDomain.textContent = "Analyzing...";
            elTech.textContent = "Analyzing...";
            elExp.textContent = "AI is evaluating domain tags and technician profiles...";
            btnApply.disabled = true;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/ai/auto-dispatch`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ text: rawText })
                });
                const data = await res.json();
                if (res.ok) {
                    elDomain.textContent = data.domain;
                    elTech.textContent = data.suggested_technician_name;
                    elExp.textContent = data.explanation;

                    lastSuggestedDomain = data.domain;
                    lastSuggestedTechId = data.suggested_technician_id;
                    btnApply.disabled = false;
                } else {
                    alert("AI Analysis Failed: " + data.error);
                }
            } catch(e) {
                alert("AI Connection failed: " + e.message);
            }
        }

        function applyAIDispatchSuggestions() {
            // Fill in the Service Tickets dispatch form
            const form = document.getElementById('job-form');
            if (form) {
                const selService = form.querySelector('[name="service_type"]');
                const selTech = document.getElementById('lookup-tech');
                const descArea = form.querySelector('[name="job_description"]');

                if (selService) selService.value = lastSuggestedDomain;
                if (selTech) selTech.value = lastSuggestedTechId;
                if (descArea) descArea.value = document.getElementById('ai-dispatch-input').value.trim();

                alert("Suggestions applied successfully! Redirecting you to Service Tickets form.");
                switchTab('tickets');
            }
        }

        // 2. Route Optimizer Map
        function initCopilotMap() {
            if (copilotMap) {
                copilotMap.invalidateSize(true);
                return;
            }
            const hq = loadHQConfig();
            copilotMap = L.map('copilot-map').setView([hq.lat, hq.lng], 12);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap'
            }).addTo(copilotMap);
            document.getElementById('copilot-map').classList.add('dark-map-theme');

            // Add HQ Office pin
            L.marker([hq.lat, hq.lng]).addTo(copilotMap)
                .bindPopup("🏫 <strong>AwesomeMyanmar Office (Start/End)</strong>").openPopup();

            // Populate the selector dropdown
            populateRouteTechSelector();
        }

        async function populateRouteTechSelector() {
            const selectEl = document.getElementById('ai-route-tech');
            if (!selectEl) return;
            selectEl.innerHTML = '';

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            try {
                const res = await fetch(`${baseUrl}/api/admin/lookups`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                data.technicians.forEach(t => {
                    selectEl.innerHTML += `<option value="${t.id}">${t.name} [${t.id}]</option>`;
                });
            } catch(e){}
        }

        async function optimizeTechRoute() {
            const techId = document.getElementById('ai-route-tech').value;
            const routeContainer = document.getElementById('ai-route-order');

            routeContainer.innerHTML = '<p class="text-amber-500 animate-pulse">Running Travelling Salesperson optimization...</p>';

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/ai/route-optimize`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ technician_id: techId })
                });
                const data = await res.json();
                if (res.ok) {
                    // Clear previous markers
                    copilotMarkers.forEach(m => copilotMap.removeLayer(m));
                    copilotMarkers = [];

                    routeContainer.innerHTML = '';
                    if (data.route.length === 0) {
                        routeContainer.innerHTML = '<p class="text-slate-500 italic">No active dispatches found for this engineer today.</p>';
                        return;
                    }

                    // Render optimized routing path text
                    data.route.forEach((stop, index) => {
                        const stepHtml = `
                            <div class="flex items-start gap-2 bg-white/5 border border-white/5 p-2 rounded-xl">
                                <span class="bg-amber-500 text-black font-extrabold w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 mt-0.5">${index + 1}</span>
                                <div>
                                    <div class="font-bold text-white">${stop.company_name}</div>
                                    <div class="text-[9px] text-slate-400 truncate max-w-[150px]">${stop.address}</div>
                                </div>
                            </div>
                        `;
                        routeContainer.innerHTML += stepHtml;

                        // Plot coordinate markers on Map
                        const m = L.marker([stop.lat, stop.lng]).addTo(copilotMap)
                            .bindPopup(`<strong>Stop #${index + 1}: ${stop.company_name}</strong><br>${stop.address}`);
                        copilotMarkers.push(m);
                    });

                    // Fit map view to coordinate bounds
                    const latlngs = data.route.map(stop => [stop.lat, stop.lng]);
                    const bounds = L.latLngBounds(latlngs);
                    copilotMap.fitBounds(bounds);
                } else {
                    routeContainer.innerHTML = `<p class="text-rose-400">${data.error}</p>`;
                }
            } catch(e) {
                routeContainer.innerHTML = `<p class="text-rose-400">Error: ${e.message}</p>`;
            }
        }

        // 3. Database Chat Copilot
        async function askCopilot(question) {
            document.getElementById('copilot-chat-input').value = question;
            sendCopilotChat();
        }

        async function sendCopilotChat() {
            const inputEl = document.getElementById('copilot-chat-input');
            const question = inputEl.value.trim();
            if (!question) return;

            inputEl.value = '';
            const stream = document.getElementById('copilot-chat-stream');

            // Render user message
            stream.innerHTML += `
                <div class="flex gap-3 max-w-[85%] ml-auto justify-end">
                    <div class="bg-indigo-600 rounded-2xl px-4 py-2.5 text-xs text-white leading-relaxed">
                        ${question}
                    </div>
                </div>
            `;
            stream.scrollTop = stream.scrollHeight;

            // Render AI Loading container
            const loadingId = 'chat-loading-' + Date.now();
            stream.innerHTML += `
                <div class="flex gap-3 max-w-[85%]" id="${loadingId}">
                    <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">🤖</div>
                    <div class="bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5 text-xs text-amber-500 animate-pulse">
                        Querying database engine...
                    </div>
                </div>
            `;
            stream.scrollTop = stream.scrollHeight;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/ai/chat-data`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ question })
                });
                const data = await res.json();
                
                // Remove loading container
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();

                if (res.ok && !data.error) {
                    let tableHtml = '';
                    if (data.results && data.results.length > 0) {
                        // Generate table header columns
                        const cols = Object.keys(data.results[0]);
                        tableHtml = `
                            <div class="overflow-x-auto bg-black/40 border border-white/5 rounded-xl p-3 my-3">
                                <table class="w-full text-[10px] text-left">
                                    <thead>
                                        <tr class="text-slate-500 border-b border-white/5 pb-1 font-bold uppercase tracking-wider">
                                            ${cols.map(c => `<th class="pb-2 pr-4">${c}</th>`).join('')}
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-white/5 text-slate-300">
                                        ${data.results.map(row => `
                                            <tr>
                                                ${cols.map(c => `<td class="py-1.5 pr-4">${row[c] !== null ? row[c] : '-'}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                    }

                    stream.innerHTML += `
                        <div class="flex gap-3 max-w-[85%]">
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">🤖</div>
                            <div class="bg-white/5 border border-white/5 rounded-2xl px-4 py-2.5 text-xs text-slate-300 leading-relaxed w-full">
                                <div class="font-mono text-[9px] text-emerald-400 mb-2">Executed Query: ${data.query}</div>
                                <div class="mb-2">${data.summary}</div>
                                ${tableHtml}
                            </div>
                        </div>
                    `;
                } else {
                    stream.innerHTML += `
                        <div class="flex gap-3 max-w-[85%]">
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">🤖</div>
                            <div class="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-2.5 text-xs text-rose-400 leading-relaxed">
                                Failed to process request: ${data.error}
                            </div>
                        </div>
                    `;
                }
            } catch(e) {
                const loader = document.getElementById(loadingId);
                if (loader) loader.remove();
                stream.innerHTML += `
                    <div class="flex gap-3 max-w-[85%]">
                        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">🤖</div>
                        <div class="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-2.5 text-xs text-rose-400 leading-relaxed">
                            Connection failed: ${e.message}
                        </div>
                    </div>
                `;
            }
            stream.scrollTop = stream.scrollHeight;
        }

        // Voice Recording State variables
        let mediaRecorder = null;
        let audioChunks = [];
        let isRecording = false;

        async function toggleVoiceRecording() {
            const btn = document.getElementById('btn-record-voice');
            const icon = document.getElementById('record-icon');
            const text = document.getElementById('record-text');
            const inputArea = document.getElementById('ai-dispatch-input');

            if (!isRecording) {
                // Start Recording
                audioChunks = [];
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    mediaRecorder.ondataavailable = e => {
                        audioChunks.push(e.data);
                    };
                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        inputArea.value = "Transcribing voice recording...";
                        
                        // Send audio blob to Worker backend Whisper transcription endpoint
                        try {
                            const formData = new FormData();
                            formData.append('audio', audioBlob, 'voice.webm');

                            const res = await fetch('/api/admin/ai/transcribe', {
                                method: 'POST',
                                body: formData
                            });
                            const data = await res.json();
                            if (res.ok && data.text) {
                                inputArea.value = data.text;
                                // Run analyzer automatically
                                runAIDispatcher();
                            } else {
                                inputArea.value = "Voice transcription failed: " + (data.error || "Invalid response");
                            }
                        } catch(err) {
                            inputArea.value = "Transcription connection error: " + err.message;
                        }
                    };
                    mediaRecorder.start();
                    isRecording = true;
                    btn.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                    btn.classList.remove('bg-red-500/10', 'text-red-400', 'border-red-500/20');
                    icon.textContent = "⏹️";
                    text.textContent = "Stop Recording";
                } catch(err) {
                    alert("Microphone access denied: " + err.message);
                }
            } else {
                // Stop Recording
                if (mediaRecorder) {
                    mediaRecorder.stop();
                    // Stop all audio tracks in stream
                    mediaRecorder.stream.getTracks().forEach(track => track.stop());
                }
                isRecording = false;
                btn.classList.remove('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
                btn.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
                icon.textContent = "🎙️";
                text.textContent = "Record Voice";
            }
        }

        async function loadServiceFeesData() {
            const tbody = document.getElementById('service-fees-body');
            if (!tbody) return;
            const baseUrl = document.getElementById('api-base').value;

            try {
                const res = await fetch(`${baseUrl}/api/service-fees`);
                const fees = await res.json();

                tbody.innerHTML = '';
                if (fees.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-600">No service rates configured yet.</td></tr>';
                    return;
                }

                fees.forEach(f => {
                    tbody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all align-middle text-slate-300">
                            <td class="py-2.5 font-bold">${f.service_type}</td>
                            <td class="py-2.5 font-mono text-emerald-400 font-bold">${f.currency} ${f.fee_amount.toFixed(2)}</td>
                            <td class="py-2.5 text-slate-400">${f.description || '-'}</td>
                            <td class="py-2.5 text-right space-x-1">
                                <button onclick="editServiceFee(${f.id}, '${f.service_type}', ${f.fee_amount}, '${f.currency}', '${(f.description || '').replace(/'/g, "\\'")}')" class="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Edit</button>
                                <button onclick="deleteServiceFee(${f.id})" class="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Delete</button>
                            </td>
                        </tr>
                    `;
                });
            } catch (err) {
                tbody.innerHTML = `<tr><td colspan="4" class="py-4 text-center text-rose-400">Failed to load rates: ${err.message}</td></tr>`;
            }
        }

        window.editServiceFee = function(id, serviceType, amount, currency, desc) {
            document.getElementById('fee-id').value = id;
            document.getElementById('fee-service-type').value = serviceType;
            document.getElementById('fee-amount').value = amount;
            document.getElementById('fee-currency').value = currency;
            document.getElementById('fee-desc').value = desc;

            document.getElementById('fee-form-title').innerHTML = '<span>💵</span> Edit Service Rate';
            document.getElementById('btn-fee-reset').classList.remove('hidden');
        };

        window.resetFeeForm = function() {
            document.getElementById('fee-id').value = '';
            document.getElementById('service-fee-form').reset();
            document.getElementById('fee-form-title').innerHTML = '<span>💵</span> Add Service Rate';
            document.getElementById('btn-fee-reset').classList.add('hidden');
        };

        window.submitServiceFee = async function(e) {
            e.preventDefault();
            const id = document.getElementById('fee-id').value;
            const service_type = document.getElementById('fee-service-type').value;
            const fee_amount = parseFloat(document.getElementById('fee-amount').value);
            const currency = document.getElementById('fee-currency').value;
            const description = document.getElementById('fee-desc').value.trim();

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');
            const action = id ? 'update' : 'create';

            try {
                const res = await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ action, id, service_type, fee_amount, currency, description })
                });
                const data = await res.json();
                if (res.ok) {
                    alert(data.message || "Service rate saved successfully.");
                    resetFeeForm();
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.deleteServiceFee = async function(id) {
            if (!confirm("Are you sure you want to delete this service rate?")) return;

            const baseUrl = document.getElementById('api-base').value;
            const token = localStorage.getItem('admin_token');

            try {
                const res = await fetch(`${baseUrl}/api/admin/service-fees/manage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ action: 'delete', id })
                });
                const data = await res.json();
                if (res.ok) {
                    alert("Service rate deleted successfully.");
                    refreshDashboardData();
                } else {
                    alert("Error: " + data.error);
                }
            } catch (err) {
                alert("Communication error: " + err.message);
            }
        };

        window.handlePasswordLogin = handlePasswordLogin;
        window.setLoginTab = setLoginTab;
        window.triggerBackup = triggerBackup;
        window.triggerRestore = triggerRestore;
        window.handleRestoreFile = handleRestoreFile;
        window.syncExchangeRate = syncExchangeRate;
        window.saveHQConfig = saveHQConfig;
        window.resolveMapsUrlToCoords = resolveMapsUrlToCoords;
        window.loadHQConfig = loadHQConfig;
