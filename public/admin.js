function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
window.escapeHTML = escapeHTML;

// Intercept global fetch to automatically inject Authorization token
const apiInput = document.getElementById('api-base');
if (apiInput && !apiInput.value) {
    const hostname = window.location.hostname;
    if (hostname.includes('pages.dev') || hostname === 'tauri.localhost' || hostname === 'localhost' && window.location.port === '') {
        // Cloudflare Pages or Tauri desktop app -> use remote Worker
        apiInput.value = "https://cctv-service-system.nyinyimin2007.workers.dev";
    } else {
        // Local dev (127.0.0.1:8787) -> use local origin
        apiInput.value = window.location.origin;
    }
}

const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
    if (url && (url.includes('/api/admin/') || url.includes('/api/landing-page') || url.includes('/api/jobs/schedule') || url.includes('/api/jobs/update'))) {
        options.headers = options.headers || {};
        const token = localStorage.getItem('admin_token');
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
    }
    const res = await originalFetch(url, options);
    if (res.status === 401) {
        handleLogout();
    }
    return res;
};

let map;
let mapMarkers = [];
let statusChartInstance;
let categoryChartInstance;
let calendarInstance = null;

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
    const telegram_username = document.getElementById("new-user-telegram-username")?.value?.trim() || "";

    const baseUrl = document.getElementById('api-base').value;
    const secret = document.getElementById('admin-secret').value;

    try {
        const res = await fetch(`${baseUrl}/api/admin/technicians/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
            body: JSON.stringify({ id, username, password, name, nickname, role, phone, email, pin, telegram_username })
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
    } catch (e) {
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
    reader.onload = async function (e) {
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
        } catch (err) {
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

    if (tabId === 'pos') {
        window.loadPosData();
        setTimeout(() => {
            const searchInput = document.getElementById('pos-stock-search');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }, 150);
    }

    if (tabId === 'system-settings') {
        window.loadPdfBuilderConfig();
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
        { name: 'pos', file: 'pos.html' },
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

        // Apply searchable dropdowns to all admin view selects
        initSearchableSelects();

        // Run original initializations
        refreshDashboardData();
        window.loadRbacSettings();

        // Start dashboard auto refresh loops every 10 seconds
        setInterval(refreshDashboardData, 300000);
    } catch (err) {
        workspace.innerHTML = `<div class="p-6 text-center text-rose-500 font-bold">Failed to bootstrap console workspace: ${err.message}</div>`;
    }
}

// == Searchable Select Initialization (Admin) ============================
function initSearchableSelects() {
    if (typeof window.makeSearchable !== 'function') return;
    var amberOpts = { accentColor: '#f59e0b' };

    // Tickets view
    makeSearchableAll(['#lookup-tech','#edit-ticket-tech','[name="service_type"]','[name="edit-ticket-service-type"]','[name="edit-ticket-status"]','#ticket-filter-domain'], document, amberOpts);

    // Inventory view
    makeSearchableAll(['#batch-filter-model','#pricing-filter-category','#catalog-filter-category','[name="batch-item-code"]','[name="catalog-item-category"]','[name="catalog-sub-category"]','[name="catalog-brand"]','[name="catalog-um"]','[name="price-update-item-code"]','#new-subcat-parent'], document, amberOpts);

    // AMC / Clients view
    makeSearchableAll(['#client-status-dropdown','#client-sort-dropdown','[name="amc_status"]'], document, amberOpts);

    // User Management view
    makeSearchableAll(['#new-user-role','#edit-tech-role','[name="user-filter-role"]'], document, amberOpts);

    // Currency / Cash Safe view
    makeSearchableAll(['[name="cash-type"]','[name="cash-currency"]','[name="cash-batch-id"]'], document, amberOpts);

    // Service Fees view
    makeSearchableAll(['[name="fee-service-type"]','[name="fee-currency"]'], document, amberOpts);

    // Reports view
    makeSearchableAll(['#report-select-type','#report-select-timeframe'], document, amberOpts);

    // POS view
    makeSearchableAll(['#pos-stock-cat','#pos-link-job'], document, amberOpts);

    // Warranty view
    makeSearchableAll(['#modal-warranty-client','#modal-rma-serial'], document, amberOpts);

    // AI Copilot view
    makeSearchableAll(['#ai-route-tech'], document, amberOpts);

    // Portfolio view
    makeSearchableAll(['[name="project-service"]'], document, amberOpts);

    // Admin role select rendered in table rows (dynamically)
    makeSearchableAll(['[id^="role-"]'], document, amberOpts);
}
window.initSearchableSelects = initSearchableSelects;

// After any data refresh that repopulates a dynamic select, call this:
window.refreshSearchableSelect = function(elOrId) {
    var el = typeof elOrId === 'string' ? document.getElementById(elOrId) : elOrId;
    if (!el) return;
    if (el._ss) { el._ss.sync(); }
    else { window.makeSearchable(el, { accentColor: '#f59e0b' }); }
};

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

    const editClientSearch = document.getElementById('edit-ticket-client-search');
    const editClientIdHidden = document.getElementById('edit-ticket-client');
    const editNewClientFields = document.getElementById('edit-ticket-new-client-fields');
    const editClientPhone = document.getElementById('edit-ticket-client-phone');
    const editClientAddress = document.getElementById('edit-ticket-client-address');

    if (editClientSearch) {
        editClientSearch.addEventListener('input', (e) => {
            const val = e.target.value;
            const match = val.match(/\[(CLI-IND-[A-Z0-9-]+|CLI-[A-Z0-9-]+)\]/);
            let selectedClient = null;

            if (match && match[1]) {
                selectedClient = window.allClientsList?.find(c => c.id === match[1]);
            } else {
                selectedClient = window.allClientsList?.find(c => c.company_name === val);
            }

            if (selectedClient) {
                editClientIdHidden.value = selectedClient.id;
                if (editNewClientFields) editNewClientFields.classList.add('hidden');
                if (editClientPhone) { editClientPhone.required = false; }
                if (editClientAddress) { editClientAddress.required = false; }
            } else {
                editClientIdHidden.value = '__NEW__';
                if (editNewClientFields) editNewClientFields.classList.remove('hidden');
                if (editClientPhone) { editClientPhone.required = true; }
                if (editClientAddress) { editClientAddress.required = true; }
            }
        });

        editClientSearch.addEventListener('blur', (e) => {
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
        attribution: 'Â© OpenStreetMap'
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
        document.getElementById('report-usd-safe').textContent = `$${safe.usd_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('report-mmk-safe').textContent = `${safe.mmk_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ks`;

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

    } catch (e) {
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
let masterCategories = [];
let masterSubCategories = [];
let masterBrands = [];
let masterUnits = [];

window.loadInventoryData = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    try {
        // 1. Fetch catalog
        const catRes = await fetch(`${baseUrl}/api/admin/inventory/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (catRes.ok) activeCatalogList = await catRes.json();

        // 2. Fetch batches
        const batRes = await fetch(`${baseUrl}/api/admin/inventory/batches`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (batRes.ok) activeBatchesList = await batRes.json();

        // 3. Fetch master data
        await loadMasterData();

        renderBatchesTable();
        renderSalesPricing();
    } catch (e) {
        console.error("Inventory fetch exception", e);
    }
};
const loadInventoryData = window.loadInventoryData;

async function loadMasterData() {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    const h = { 'Authorization': `Bearer ${token}` };
    try {
        const [catR, subR, brandR, unitR] = await Promise.all([
            fetch(`${baseUrl}/api/admin/inventory/categories`, { headers: h }),
            fetch(`${baseUrl}/api/admin/inventory/sub-categories`, { headers: h }),
            fetch(`${baseUrl}/api/admin/inventory/brands`, { headers: h }),
            fetch(`${baseUrl}/api/admin/inventory/units`, { headers: h })
        ]);
        if (catR.ok) masterCategories = await catR.json();
        if (subR.ok) masterSubCategories = await subR.json();
        if (brandR.ok) masterBrands = await brandR.json();
        if (unitR.ok) masterUnits = await unitR.json();

        populateMasterDropdowns();
        renderMasterLists();
    } catch (e) { console.error('Master data load error', e); }
}

function populateMasterDropdowns() {
    // Category dropdowns
    const catOpts = masterCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    ['catalog-item-category', 'pricing-filter-category', 'catalog-filter-category'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const placeholder = id.includes('filter') ? '<option value="">All Categories</option>' : '<option value="">â€” Select â€”</option>';
            el.innerHTML = placeholder + catOpts;
        }
    });

    // Sub-category dropdown in register model form
    const subCatEl = document.getElementById('catalog-sub-category');
    if (subCatEl) {
        subCatEl.innerHTML = '<option value="">â€” Select â€”</option>' +
            masterSubCategories.map(s => `<option value="${s.name}">${s.name}${s.category_name ? ' (' + s.category_name + ')' : ''}</option>`).join('');
    }

    // Brand dropdown in register model form
    const brandEl = document.getElementById('catalog-brand');
    if (brandEl) {
        brandEl.innerHTML = '<option value="">â€” Select â€”</option>' +
            masterBrands.map(b => `<option value="${b.name}">${b.name}</option>`).join('');
    }

    // Sub-cat parent dropdown in sub-category form
    const parentEl = document.getElementById('new-subcat-parent');
    if (parentEl) {
        parentEl.innerHTML = '<option value="">â€” Select Category â€”</option>' +
            masterCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    // Unit dropdowns
    const unitOpts = masterUnits.map(u => `<option value="${u.abbreviation}">${u.abbreviation} (${u.name})</option>`).join('');
    const catalogUmEl = document.getElementById('catalog-um');
    if (catalogUmEl) catalogUmEl.innerHTML = '<option value="">â€” Select Unit â€”</option>' + unitOpts;
}

function renderMasterLists() {
    // Categories
    const catBody = document.getElementById('categories-body');
    if (catBody) {
        if (masterCategories.length === 0) {
            catBody.innerHTML = '<tr><td colspan="3" class="px-3 py-6 text-center text-[11px] text-slate-600">No categories yet</td></tr>';
        } else {
            catBody.innerHTML = masterCategories.map((c, i) => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <td class="px-3 py-2 text-[10px] text-slate-400 font-mono">${c.code || 'â€”'}</td>
                            <td class="px-3 py-2 text-[11px] text-white font-medium">${c.name}</td>
                            <td class="px-3 py-2 flex items-center gap-2">
                                <button onclick="window.editCategoryPrompt(${c.id}, window.escapeHTML('${c.name.replace(/'/g, "\\'")}'), window.escapeHTML('${(c.code || '').replace(/'/g, "\\'")}'))" class="text-[9px] text-sky-400 hover:text-sky-300 transition-all">Edit</button>
                                <button onclick="deleteMasterItem('categories',${c.id})" class="text-[9px] text-rose-400 hover:text-rose-300 transition-all">Remove</button>
                            </td>
                        </tr>`).join('');
        }
    }

    // Sub-Categories
    const subBody = document.getElementById('subcategories-body');
    if (subBody) {
        if (masterSubCategories.length === 0) {
            subBody.innerHTML = '<tr><td colspan="4" class="px-3 py-6 text-center text-[11px] text-slate-600">No sub-categories yet</td></tr>';
        } else {
            subBody.innerHTML = masterSubCategories.map(s => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <td class="px-3 py-2 text-[10px] text-slate-400 font-mono">${s.code || 'â€”'}</td>
                            <td class="px-3 py-2 text-[11px] text-white font-medium">${s.name}</td>
                            <td class="px-3 py-2 text-[9px] text-slate-500">${s.category_name || 'â€”'}</td>
                            <td class="px-3 py-2 flex items-center gap-2">
                                <button onclick="window.editSubCategoryPrompt(${s.id}, window.escapeHTML('${s.name.replace(/'/g, "\\'")}'), window.escapeHTML('${(s.code || '').replace(/'/g, "\\'")}'), ${s.category_id || 'null'})" class="text-[9px] text-sky-400 hover:text-sky-300 transition-all">Edit</button>
                                <button onclick="deleteMasterItem('sub-categories',${s.id})" class="text-[9px] text-rose-400 hover:text-rose-300 transition-all">Remove</button>
                            </td>
                        </tr>`).join('');
        }
    }

    // Brands
    const brandBody = document.getElementById('brands-body');
    if (brandBody) {
        if (masterBrands.length === 0) {
            brandBody.innerHTML = '<tr><td colspan="3" class="px-3 py-6 text-center text-[11px] text-slate-600">No brands yet</td></tr>';
        } else {
            brandBody.innerHTML = masterBrands.map((b, i) => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <td class="px-3 py-2 text-[10px] text-slate-400 font-mono">${b.code || 'â€”'}</td>
                            <td class="px-3 py-2 text-[11px] text-white font-medium">${b.name}</td>
                            <td class="px-3 py-2 flex items-center gap-2">
                                <button onclick="window.editBrandPrompt(${b.id}, window.escapeHTML('${b.name.replace(/'/g, "\\'")}'), window.escapeHTML('${(b.code || '').replace(/'/g, "\\'")}'))" class="text-[9px] text-sky-400 hover:text-sky-300 transition-all">Edit</button>
                                <button onclick="deleteMasterItem('brands',${b.id})" class="text-[9px] text-rose-400 hover:text-rose-300 transition-all">Remove</button>
                            </td>
                        </tr>`).join('');
        }
    }

    // Units
    const unitsBody = document.getElementById('units-body');
    if (unitsBody) {
        if (masterUnits.length === 0) {
            unitsBody.innerHTML = '<tr><td colspan="3" class="px-3 py-6 text-center text-[11px] text-slate-600">No units yet (defaults: pcs, meter, pack, box...)</td></tr>';
        } else {
            unitsBody.innerHTML = masterUnits.map(u => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <td class="px-3 py-2 text-[11px] text-white font-medium">${u.name}</td>
                            <td class="px-3 py-2 text-[10px] font-mono text-emerald-400">${u.abbreviation}</td>
                            <td class="px-3 py-2"><button onclick="deleteMasterItem('units',${u.id})" class="text-[9px] text-rose-400 hover:text-rose-300 transition-all">Remove</button></td>
                        </tr>`).join('');
        }
    }
}

window.switchInvModule = function (module) {
    const panels = ['batches', 'pricing', 'catalog', 'categories', 'subcategories', 'brands', 'units', 'add-batch', 'add-model', 'update-price'];
    panels.forEach(p => {
        const el = document.getElementById(`inv-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`inv-panel-${module}`);
    if (active) active.classList.remove('hidden');

    // Update sidebar active state for all nav module buttons
    const navMods = ['batches', 'pricing', 'catalog', 'categories', 'subcategories', 'brands', 'units'];
    navMods.forEach(m => {
        const btn = document.getElementById(`inv-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-inv-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
            } else {
                btn.classList.remove('active-inv-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
            }
        }
    });
};

// Keep old alias for backward compat
window.setInventoryTab = window.switchInvModule;

// â”€â”€ Master Data submit handlers â”€â”€
window.submitMasterData = async function (type, e) {
    e.preventDefault();
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    
    let name = '', code = '';
    if (type === 'categories') {
        const nameEl = document.getElementById('new-category-name');
        const codeEl = document.getElementById('new-category-id');
        if (nameEl) name = nameEl.value.trim();
        if (codeEl) code = codeEl.value.trim();
    } else if (type === 'brands') {
        const nameEl = document.getElementById('new-brand-name');
        const codeEl = document.getElementById('new-brand-id');
        if (nameEl) name = nameEl.value.trim();
        if (codeEl) code = codeEl.value.trim();
    }
    
    if (!name) return;
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/${type}/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, code })
        });
        if (res.ok) {
            if (type === 'categories') {
                document.getElementById('new-category-name').value = '';
                document.getElementById('new-category-id').value = '';
            } else if (type === 'brands') {
                document.getElementById('new-brand-name').value = '';
                document.getElementById('new-brand-id').value = '';
            }
            await loadMasterData();
        }
        else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch (err) { alert('Error: ' + err.message); }
};

window.submitSubCategory = async function (e) {
    e.preventDefault();
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    const name = document.getElementById('new-subcat-name').value.trim();
    const code = document.getElementById('new-subcat-id').value.trim();
    const category_id = document.getElementById('new-subcat-parent').value;
    if (!name) return;
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/sub-categories/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, category_id: category_id || null, code })
        });
        if (res.ok) {
            document.getElementById('new-subcat-name').value = '';
            document.getElementById('new-subcat-id').value = '';
            await loadMasterData();
        }
        else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch (err) { alert('Error: ' + err.message); }
};

window.editCategoryPrompt = async function (id, currentName, currentCode) {
    const name = prompt("Edit Category Name:", currentName);
    if (name === null) return;
    const code = prompt("Edit Category ID / Code:", currentCode);
    if (code === null) return;
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/categories/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id, name, code })
        });
        if (res.ok) {
            await loadMasterData();
        } else {
            const d = await res.json();
            alert(d.error || 'Failed');
        }
    } catch (err) { alert('Error: ' + err.message); }
};

window.editBrandPrompt = async function (id, currentName, currentCode) {
    const name = prompt("Edit Brand Name:", currentName);
    if (name === null) return;
    const code = prompt("Edit Brand ID / Code:", currentCode);
    if (code === null) return;
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/brands/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id, name, code })
        });
        if (res.ok) {
            await loadMasterData();
        } else {
            const d = await res.json();
            alert(d.error || 'Failed');
        }
    } catch (err) { alert('Error: ' + err.message); }
};

window.editSubCategoryPrompt = async function (id, currentName, currentCode, currentCategoryId) {
    const name = prompt("Edit Sub-Category Name:", currentName);
    if (name === null) return;
    const code = prompt("Edit Sub-Category ID / Code:", currentCode);
    if (code === null) return;
    
    let parentMsg = "Change Parent Category?\nAvailable Categories:\n";
    masterCategories.forEach(c => {
        parentMsg += `ID: ${c.id} - ${c.name}\n`;
    });
    parentMsg += "\nEnter Category ID (or leave blank to keep current):";
    const parentVal = prompt(parentMsg, currentCategoryId || '');
    if (parentVal === null) return;
    
    const category_id = parentVal.trim() ? parseInt(parentVal) : currentCategoryId;
    
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/sub-categories/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id, name, code, category_id })
        });
        if (res.ok) {
            await loadMasterData();
        } else {
            const d = await res.json();
            alert(d.error || 'Failed');
        }
    } catch (err) { alert('Error: ' + err.message); }
};

window.submitStockUnit = async function (e) {
    e.preventDefault();
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    const name = document.getElementById('new-unit-name').value.trim();
    const abbreviation = document.getElementById('new-unit-abbr').value.trim();
    if (!name || !abbreviation) return;
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/units/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, abbreviation })
        });
        if (res.ok) {
            document.getElementById('new-unit-name').value = '';
            document.getElementById('new-unit-abbr').value = '';
            await loadMasterData();
        } else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch (err) { alert('Error: ' + err.message); }
};

window.deleteMasterItem = async function (type, id) {
    if (!confirm('Remove this item?')) return;
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/${type}/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ id })
        });
        if (res.ok) await loadMasterData();
        else { const d = await res.json(); alert(d.error || 'Failed'); }
    } catch (err) { alert('Error: ' + err.message); }
};

window.loadSubCategoriesForForm = function (categoryName) {
    const subCatEl = document.getElementById('catalog-sub-category');
    if (!subCatEl) return;
    const filtered = masterSubCategories.filter(s => !categoryName || s.category_name === categoryName);
    subCatEl.innerHTML = '<option value="">â€” Select â€”</option>' +
        filtered.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
};

// â”€â”€ Generic master list search â”€â”€
window.filterMasterTable = function (tbodyId, inputId) {
    const q = (document.getElementById(inputId)?.value || '').toLowerCase();
    const rows = document.querySelectorAll(`#${tbodyId} tr`);
    rows.forEach(row => { row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none'; });
};

// â”€â”€ Pricing table search & filter â”€â”€
window.filterPricingTable = function () {
    const q = (document.getElementById('pricing-search-input')?.value || '').toLowerCase();
    const cat = (document.getElementById('pricing-filter-category')?.value || '').toLowerCase();
    const table = document.getElementById('pricing-table');
    const activeFilters = table ? table.activeExcelFilters : null;

    document.querySelectorAll('#sales-pricing-body tr').forEach(row => {
        if (row.classList.contains('empty-state-row')) return;
        const text = row.textContent.toLowerCase();
        const cells = row.querySelectorAll('td');
        
        const searchMatch = !q || text.includes(q);
        
        let catMatch = true;
        if (cat && cells.length > 2) {
            const catText = cells[2].textContent.trim().toLowerCase();
            catMatch = (catText === cat);
        }
        
        let excelMatch = true;
        if (activeFilters) {
            for (const [colIndex, allowedSet] of Object.entries(activeFilters)) {
                if (!cells[colIndex]) continue;
                const cellText = cells[colIndex].textContent.trim();
                if (!allowedSet.has(cellText)) {
                    excelMatch = false;
                    break;
                }
            }
        }
        
        row.style.display = (searchMatch && catMatch && excelMatch) ? '' : 'none';
    });
};

window.filterPricingByCategory = function (val) {
    window.filterPricingTable();
};

// â”€â”€ Catalog table search & filter â”€â”€
window.filterCatalogTable = function () {
    const q = (document.getElementById('catalog-search-input')?.value || '').toLowerCase();
    const cat = (document.getElementById('catalog-filter-category')?.value || '').toLowerCase();
    const table = document.getElementById('catalog-table');
    const activeFilters = table ? table.activeExcelFilters : null;

    document.querySelectorAll('#catalog-models-body tr').forEach(row => {
        if (row.classList.contains('empty-state-row')) return;
        const text = row.textContent.toLowerCase();
        const cells = row.querySelectorAll('td');
        
        const searchMatch = !q || text.includes(q);
        
        let catMatch = true;
        if (cat && cells.length > 2) {
            const catText = cells[2].textContent.trim().toLowerCase();
            catMatch = (catText === cat);
        }
        
        let excelMatch = true;
        if (activeFilters) {
            for (const [colIndex, allowedSet] of Object.entries(activeFilters)) {
                if (!cells[colIndex]) continue;
                const cellText = cells[colIndex].textContent.trim();
                if (!allowedSet.has(cellText)) {
                    excelMatch = false;
                    break;
                }
            }
        }
        
        row.style.display = (searchMatch && catMatch && excelMatch) ? '' : 'none';
    });
};

window.filterCatalogByCategory = function (val) {
    window.filterCatalogTable();
};

// â”€â”€ Excel Export â”€â”€
window.exportTableToExcel = function (tableId, filename) {
    // Load SheetJS if not already loaded
    function doExport() {
        const table = document.getElementById(tableId);
        if (!table) { alert('Table not found'); return; }
        const wb = XLSX.utils.table_to_book(table, { sheet: filename });
        XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    }
    if (typeof XLSX !== 'undefined') { doExport(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = doExport;
    document.head.appendChild(script);
};

function loadXLSX(cb) {
    if (typeof XLSX !== 'undefined') { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = cb;
    document.head.appendChild(s);
}

// â”€â”€ Import: Pricing â”€â”€
window.importPricingExcel = function (input) {
    const file = input.files[0]; if (!file) return;
    loadXLSX(async () => {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const baseUrl = document.getElementById('api-base').value;
        const token = localStorage.getItem('admin_token');
        const secret = document.getElementById('admin-secret').value;
        let ok = 0, fail = 0;
        for (const r of rows) {
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                } else {
                    headers['X-Admin-Secret'] = secret;
                }
                const res = await fetch(`${baseUrl}/api/admin/inventory/catalog/price`, {
                    method: 'POST', headers: headers,
                    body: JSON.stringify({ item_code: r['SKU'] || r['item_code'], unit_price: parseFloat(r['USD Price'] || r['unit_price']) || 0, unit_price_mmk: parseInt(r['MMK Price'] || r['unit_price_mmk']) || 0 })
                });
                res.ok ? ok++ : fail++;
            } catch { fail++; }
        }
        alert(`Import complete: ${ok} updated, ${fail} failed.`);
        input.value = ''; loadInventoryData();
    });
};

// â”€â”€ Import: Catalog â”€â”€
window.importCatalogExcel = function (input) {
    const file = input.files[0]; if (!file) return;
    loadXLSX(async () => {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const baseUrl = document.getElementById('api-base').value;
        const token = localStorage.getItem('admin_token');
        const secret = document.getElementById('admin-secret').value;
        let ok = 0, fail = 0;
        for (const r of rows) {
            try {
                const headers = { 'Content-Type': 'application/json' };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                } else {
                    headers['X-Admin-Secret'] = secret;
                }
                const res = await fetch(`${baseUrl}/api/admin/inventory/add`, {
                    method: 'POST', headers: headers,
                    body: JSON.stringify({ item_code: (r['SKU'] || r['item_code'] || '').toUpperCase(), item_name: r['Model Name'] || r['item_name'] || '', category: r['Category'] || r['category'] || '', sub_category_id: r['Sub-Cat'] || '', brand_id: r['Brand'] || '', stocking_um: r['U/M'] || 'pcs', stock_qty: 0, unit_price: 0, unit_price_mmk: 0 })
                });
                res.ok ? ok++ : fail++;
            } catch { fail++; }
        }
        alert(`Import complete: ${ok} added, ${fail} failed.`);
        input.value = ''; loadInventoryData();
    });
};

// â”€â”€ Import: Batch â”€â”€
window.importBatchExcel = function (input) {
    const file = input.files[0]; if (!file) return;
    const overwrite = confirm("Do you want to overwrite existing batches if duplicate Batch Codes are found?");
    loadXLSX(async () => {
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const baseUrl = document.getElementById('api-base').value;
        const token = localStorage.getItem('admin_token');
        let ok = 0, fail = 0;
        for (const r of rows) {
            try {
                const is_serial = String(r['Is Serial'] || r['is_serial'] || '').toLowerCase() === 'yes';
                let serials = [];
                if (is_serial && r['Serials']) {
                    serials = String(r['Serials']).split(/[\n,;]/).map(s => s.trim()).filter(Boolean);
                }
                const res = await fetch(`${baseUrl}/api/admin/inventory/batches/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        batch_code: String(r['Batch Code'] || r['batch_code'] || '').toUpperCase().trim(),
                        item_code: String(r['SKU'] || r['item_code'] || '').toUpperCase().trim(),
                        buying_price: parseFloat(r['Buying Cost'] || r['buying_price']) || 0,
                        supplier: r['Supplier'] || '',
                        is_serial,
                        serials,
                        manual_qty: parseInt(r['Quantity'] || r['manual_qty']) || 0,
                        overwrite
                    })
                });
                res.ok ? ok++ : fail++;
            } catch { fail++; }
        }
        alert(`Batch Import complete: ${ok} processed, ${fail} failed.`);
        input.value = '';
        if (typeof window.loadInventoryData === 'function') {
            window.loadInventoryData();
        }
    });
};

window.switchUserModule = function (module) {
    const panels = ['accounts', 'create', 'roles'];
    panels.forEach(p => {
        const el = document.getElementById(`user-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`user-panel-${module}`);
    if (active) active.classList.remove('hidden');

    const mainMods = ['accounts', 'create', 'roles'];
    mainMods.forEach(m => {
        const btn = document.getElementById(`user-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-user-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.user-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(16,185,129,0.2)';
                    iconWrap.style.border = '1px solid rgba(16,185,129,0.3)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.add('text-emerald-400');
                }
                const label = btn.querySelector('.user-mod-label');
                if (label) label.classList.add('text-emerald-400');
            } else {
                btn.classList.remove('active-user-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.user-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(255,255,255,0.05)';
                    iconWrap.style.border = '1px solid rgba(255,255,255,0.05)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.remove('text-emerald-400');
                }
                const label = btn.querySelector('.user-mod-label');
                if (label) label.classList.remove('text-emerald-400');
            }
        }
    });

    if (module === 'roles') {
        window.loadRbacSettings();
    }
};

window.switchTicketModule = function (module) {
    const panels = ['logs', 'create', 'pdf'];
    panels.forEach(p => {
        const el = document.getElementById(`ticket-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`ticket-panel-${module}`);
    if (active) active.classList.remove('hidden');

    const mainMods = ['logs', 'create', 'pdf'];
    mainMods.forEach(m => {
        const btn = document.getElementById(`ticket-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-ticket-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.ticket-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(16,185,129,0.2)';
                    iconWrap.style.border = '1px solid rgba(16,185,129,0.3)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.add('text-emerald-400');
                }
                const label = btn.querySelector('.ticket-mod-label');
                if (label) label.classList.add('text-emerald-400');
            } else {
                btn.classList.remove('active-ticket-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.ticket-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(255,255,255,0.05)';
                    iconWrap.style.border = '1px solid rgba(255,255,255,0.05)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.remove('text-emerald-400');
                }
                const label = btn.querySelector('.ticket-mod-label');
                if (label) label.classList.remove('text-emerald-400');
            }
        }
    });
};

window.switchAmcModule = function (module) {
    const panels = ['directory', 'create'];
    panels.forEach(p => {
        const el = document.getElementById(`amc-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`amc-panel-${module}`);
    if (active) active.classList.remove('hidden');

    const mainMods = ['directory', 'create'];
    mainMods.forEach(m => {
        const btn = document.getElementById(`amc-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-amc-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.amc-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(16,185,129,0.2)';
                    iconWrap.style.border = '1px solid rgba(16,185,129,0.3)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.add('text-emerald-400');
                }
                const label = btn.querySelector('.amc-mod-label');
                if (label) label.classList.add('text-emerald-400');
            } else {
                btn.classList.remove('active-amc-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.amc-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(255,255,255,0.05)';
                    iconWrap.style.border = '1px solid rgba(255,255,255,0.05)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.remove('text-emerald-400');
                }
                const label = btn.querySelector('.amc-mod-label');
                if (label) label.classList.remove('text-emerald-400');
            }
        }
    });
};

window.switchCurrencyModule = function (module) {
    const panels = ['ledger', 'create', 'sales-ledger'];
    panels.forEach(p => {
        const el = document.getElementById(`currency-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`currency-panel-${module}`);
    if (active) active.classList.remove('hidden');

    const mainMods = ['ledger', 'create', 'sales-ledger'];
    mainMods.forEach(m => {
        const btn = document.getElementById(`currency-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-currency-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.currency-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(16,185,129,0.2)';
                    iconWrap.style.border = '1px solid rgba(16,185,129,0.3)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.add('text-emerald-400');
                }
                const label = btn.querySelector('.currency-mod-label');
                if (label) label.classList.add('text-emerald-400');
            } else {
                btn.classList.remove('active-currency-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.currency-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(255,255,255,0.05)';
                    iconWrap.style.border = '1px solid rgba(255,255,255,0.05)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.remove('text-emerald-400');
                }
                const label = btn.querySelector('.currency-mod-label');
                if (label) label.classList.remove('text-emerald-400');
            }
        }
    });

    if (module === 'sales-ledger') {
        window.loadPosSalesHistory();
    }
};

window.processSerialInput = function (textareaElement) {
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

window.toggleBatchTrackingMode = function (val) {
    const serialCard = document.getElementById('serial-entry-card');
    const manualQtyContainer = document.getElementById('manual-qty-container');
    const manualQtyInput = document.getElementById('batch-manual-qty');
    const serialsTextarea = document.getElementById('batch-serials');
    const manualBtn = document.getElementById('manual-commit-btn-container');

    if (val === 'yes') {
        if (serialCard) serialCard.classList.remove('hidden');
        if (manualQtyContainer) manualQtyContainer.classList.add('hidden');
        if (manualQtyInput) manualQtyInput.removeAttribute('required');
        if (serialsTextarea) serialsTextarea.setAttribute('required', 'true');
        if (manualBtn) manualBtn.classList.add('hidden');
    } else {
        if (serialCard) serialCard.classList.add('hidden');
        if (manualQtyContainer) manualQtyContainer.classList.remove('hidden');
        if (manualQtyInput) manualQtyInput.setAttribute('required', 'true');
        if (serialsTextarea) serialsTextarea.removeAttribute('required');
        if (manualBtn) manualBtn.classList.remove('hidden');
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

    let rowsHtml = '';
    activeBatchesList.forEach((b, idx) => {
        const isSerial = b.serials && b.serials.length > 0;
        const totalUnits = isSerial ? b.serials.length : (b.quantity || 0);
        const availableUnits = isSerial ? b.serials.filter(s => s.status === 'Active').length : (b.remaining_qty || 0);
        const soldUnits = totalUnits - availableUnits;
        const importDate = b.created_at ? b.created_at.substring(0, 10) : 'â€”';

        let serialsHtml = '';
        if (isSerial) {
            b.serials.forEach(s => {
                if (s.status === 'Active') {
                    serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center"><span class="font-mono text-slate-300 text-[10px] truncate">${s.serial_number}</span><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 shrink-0"></span></div>`;
                } else {
                    const details = s.job_id ? `Job: ${s.job_id}` : 'SOLD';
                    serialsHtml += `<div class="px-2 py-1 bg-white/5 border border-white/5 rounded flex justify-between items-center opacity-40"><span class="font-mono text-slate-500 text-[10px] line-through truncate" title="${details}">${s.serial_number}</span><span class="text-[8px] text-amber-500 font-bold ml-1 shrink-0">SOLD</span></div>`;
                }
            });
        } else {
            serialsHtml = `<div class="col-span-4 text-slate-400 font-semibold text-[10px] py-1.5">Tracked by Quantity: ${availableUnits} / ${totalUnits} ${b.stocking_um || 'pcs'} Available (No serials required)</div>`;
        }

        rowsHtml += `
                    <tr class="clickable-row cursor-pointer border-b border-white/5 transition-all align-middle group"
                        style="border-left: 2px solid transparent;"
                        onmouseenter="this.style.background='rgba(16,185,129,0.03)'; this.style.borderLeftColor='rgba(16,185,129,0.4)';"
                        onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';"
                        onclick="document.getElementById('serials-row-${idx}').classList.toggle('hidden'); const a = this.querySelector('.expand-arrow'); if(a) a.style.transform = a.style.transform === 'rotate(90deg)' ? '' : 'rotate(90deg)';">
                        <td class="pl-3 pr-2 py-2.5">
                            <div class="w-5 h-5 rounded flex items-center justify-center transition-all" style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.15);">
                                <span class="expand-arrow text-emerald-500 text-[10px] inline-block transition-transform duration-200 font-bold">â€º</span>
                            </div>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="font-mono text-[11px] font-bold text-white tracking-wide">${b.batch_code}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="text-[11px] text-slate-300 font-medium">${b.item_name || 'â€”'}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="cat-pill">${b.category || 'â€”'}</span>
                        </td>
                        <td class="px-4 py-2.5">
                            <span class="font-mono text-[12px] font-bold text-sky-400">$${parseFloat(b.buying_price || 0).toFixed(2)}</span>
                            <span class="text-[8px] text-slate-600 ml-0.5">/unit</span>
                        </td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-500">${b.supplier || 'â€”'}</td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="font-mono text-[13px] font-black text-slate-300">${totalUnits} ${b.stocking_um || 'pcs'}</span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${availableUnits > 0 ? 'text-emerald-400' : 'text-rose-400'}" style="background: ${availableUnits > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}; border: 1px solid ${availableUnits > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}">
                                <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: ${availableUnits > 0 ? '#10b981' : '#ef4444'};"></span>
                                ${availableUnits}
                            </span>
                        </td>
                        <td class="px-4 py-2.5 text-center">
                            <span class="font-mono text-[11px] ${soldUnits > 0 ? 'text-amber-400' : 'text-slate-700'}">${soldUnits > 0 ? soldUnits : 'â€”'}</span>
                        </td>
                        <td class="px-4 py-2.5 text-[10px] text-slate-600">${importDate}</td>
                        <td class="px-4 py-2.5 text-center" onclick="event.stopPropagation(); event.preventDefault();">
                            <button onclick="event.stopPropagation(); event.preventDefault(); window.posEditBatchPrompt('${b.batch_code}', ${b.buying_price}, window.escapeHTML('${(b.supplier || '').replace(/'/g, "\\'")}'))"
                                class="px-2 py-0.5 text-[9px] font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded hover:bg-sky-500/25 transition">
                                Edit
                            </button>
                        </td>
                    </tr>
                    <tr id="serials-row-${idx}" class="hidden">
                        <td colspan="11" class="px-5 py-3" style="background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(16,185,129,0.1);">
                            <div class="flex items-center gap-2 mb-2">
                                <div class="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <p class="text-[8px] font-black text-emerald-600 uppercase tracking-[0.15em]">${isSerial ? 'Serial Numbers' : 'Quantity batch'} Â· ${b.batch_code} Â· ${availableUnits}/${totalUnits} Available</p>
                            </div>
                            <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-1">
                                ${serialsHtml}
                            </div>
                        </td>
                    </tr>
                `;
    });
    tbody.innerHTML = rowsHtml;
    window.initExcelTableFilters('batch-main-table');
    window.filterBatchTable();
}

function renderSalesPricing() {
    const pricingBody = document.getElementById('sales-pricing-body');
    const catalogBody = document.getElementById('catalog-models-body');
    const batchSelect = document.getElementById('batch-item-code');
    const updateSelect = document.getElementById('price-update-item-code');
    const filterSelect = document.getElementById('batch-filter-model');

    const prevBatchVal = batchSelect ? batchSelect.value : '';
    const prevUpdateVal = updateSelect ? updateSelect.value : '';

    if (activeCatalogList.length === 0) {
        if (pricingBody) pricingBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
        if (catalogBody) catalogBody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-600 text-[11px]">No models in catalog yet.</td></tr>';
        return;
    }

    let batchSelectHtml = '<option value="">-- Choose Model --</option>';
    let updateSelectHtml = '<option value="">-- Choose Device --</option>';
    let filterSelectHtml = '<option value="">â€” All Models â€”</option>';
    let pricingRowsHtml = '';
    let catalogRowsHtml = '';

    const limit = 200;

    activeCatalogList.forEach((item, i) => {
        const opt = `<option value="${item.item_code}">${item.item_name} [${item.item_code}]</option>`;
        batchSelectHtml += opt;
        updateSelectHtml += opt;
        filterSelectHtml += `<option value="${item.item_code}">${item.item_name}</option>`;

        if (i < limit) {
            const priceUSD = item.unit_price ? `$${parseFloat(item.unit_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'â€”';
            const priceMMK = item.unit_price_mmk ? `Ks ${parseInt(item.unit_price_mmk).toLocaleString()}` : 'â€”';
            const usdColor = item.unit_price ? 'text-emerald-400' : 'text-slate-600';
            const mmkColor = item.unit_price_mmk ? 'text-amber-400' : 'text-slate-600';

            const inStock = activeBatchesList
                .filter(b => b.item_code === item.item_code)
                .reduce((sum, b) => {
                    const isSerial = b.serials && b.serials.length > 0;
                    return sum + (isSerial ? b.serials.filter(s => s.status === 'Active').length : (b.remaining_qty || 0));
                }, 0);
            const stockColor = inStock > 5 ? 'text-emerald-400' : inStock > 0 ? 'text-amber-400' : 'text-rose-400';
            const um = item.stocking_um || 'pcs';

            pricingRowsHtml += `
                        <tr class="border-b border-white/5 transition-all text-[11px] cursor-default"
                            style="border-left: 2px solid transparent;"
                            onmouseenter="this.style.background='rgba(245,158,11,0.03)'; this.style.borderLeftColor='rgba(245,158,11,0.3)';"
                            onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';">
                            <td class="px-4 py-2.5 font-mono text-[10px] font-bold text-sky-400">${item.item_code}</td>
                            <td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td>
                            <td class="px-4 py-2.5"><span class="cat-pill">${item.category || 'â€”'}</span></td>
                            <td class="px-4 py-2.5 text-[10px] text-slate-400">${item.brand_id || 'â€”'}</td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${stockColor}" style="background: ${inStock > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${inStock > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}">
                                    <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: currentColor;"></span>
                                    ${inStock} ${um}
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

            catalogRowsHtml += `
                        <tr class="border-b border-white/5 transition-all text-[11px]"
                            style="border-left: 2px solid transparent;"
                            onmouseenter="this.style.background='rgba(99,102,241,0.03)'; this.style.borderLeftColor='rgba(99,102,241,0.3)';"
                            onmouseleave="this.style.background=''; this.style.borderLeftColor='transparent';">
                            <td class="px-4 py-2.5 font-mono text-[10px] font-bold text-sky-400">${item.item_code}</td>
                            <td class="px-4 py-2.5 text-white font-medium">${item.item_name}</td>
                            <td class="px-4 py-2.5"><span class="cat-pill">${item.category || 'â€”'}</span></td>
                            <td class="px-4 py-2.5 text-[10px] text-slate-500">${item.sub_category_id || 'â€”'}</td>
                            <td class="px-4 py-2.5 text-[10px] text-slate-400">${item.brand_id || 'â€”'}</td>
                            <td class="px-4 py-2.5 font-mono text-[10px] text-violet-400">${um}</td>
                            <td class="px-4 py-2.5 text-center">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${stockColor}" style="background: ${inStock > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)'}; border: 1px solid ${inStock > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}">
                                    <span class="w-1.5 h-1.5 rounded-full inline-block" style="background: currentColor;"></span>
                                    ${inStock} ${um}
                                </span>
                            </td>
                            <td class="px-4 py-2.5 text-right">
                                <button onclick="deleteInventoryItem('${item.item_code}')" class="px-2.5 py-1 text-[9px] font-bold text-rose-400 rounded transition-all"
                                    style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15);">Remove</button>
                            </td>
                        </tr>
                    `;
        }
    });

    if (activeCatalogList.length > limit) {
        const messageHtml = `<tr><td colspan="8" class="px-4 py-4 text-center text-slate-500 text-[11px] font-semibold bg-white/5 border-t border-white/10">Showing first ${limit} of ${activeCatalogList.length} items. Use search to filter.</td></tr>`;
        pricingRowsHtml += messageHtml;
        catalogRowsHtml += messageHtml;
    }

    if (batchSelect) batchSelect.innerHTML = batchSelectHtml;
    if (updateSelect) updateSelect.innerHTML = updateSelectHtml;
    if (filterSelect) filterSelect.innerHTML = filterSelectHtml;
    if (pricingBody) pricingBody.innerHTML = pricingRowsHtml;
    if (catalogBody) catalogBody.innerHTML = catalogRowsHtml;

    if (batchSelect && prevBatchVal) batchSelect.value = prevBatchVal;
    if (updateSelect && prevUpdateVal) updateSelect.value = prevUpdateVal;

    window.initExcelTableFilters('pricing-table');
    window.initExcelTableFilters('catalog-table');
    window.filterPricingTable();
    window.filterCatalogTable();
}

window.filterBatchTable = function () {
    const q = (document.getElementById('batch-search-input')?.value || '').toLowerCase();
    const modelVal = (document.getElementById('batch-filter-model')?.value || '');
    const table = document.getElementById('batch-main-table');
    const activeFilters = table ? table.activeExcelFilters : null;

    let currentParentVisible = true;
    const tbody = document.getElementById('batches-stock-body');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.forEach(row => {
        if (row.id && row.id.startsWith('serials-row')) {
            row.style.display = (currentParentVisible && row.classList.contains('expanded-visible')) ? '' : 'none';
            if (!currentParentVisible) {
                row.style.display = 'none';
            }
            return;
        }
        
        if (row.classList.contains('empty-state-row')) return;
        
        const text = row.textContent.toLowerCase();
        const cells = row.querySelectorAll('td');
        
        const searchMatch = !q || text.includes(q);
        
        let modelMatch = true;
        if (modelVal) {
            if (cells[2]) {
                const deviceModelText = cells[2].textContent.trim();
                const matchModel = activeCatalogList.find(c => c.item_code === modelVal);
                if (matchModel) {
                    modelMatch = deviceModelText === matchModel.item_name;
                } else {
                    modelMatch = false;
                }
            }
        }
        
        let excelMatch = true;
        if (activeFilters) {
            for (const [colIndex, allowedSet] of Object.entries(activeFilters)) {
                if (!cells[colIndex]) continue;
                const cellText = cells[colIndex].textContent.trim();
                if (!allowedSet.has(cellText)) {
                    excelMatch = false;
                    break;
                }
            }
        }
        
        const visible = searchMatch && modelMatch && excelMatch;
        row.style.display = visible ? '' : 'none';
        currentParentVisible = visible;
    });
};

window.filterBatchByModel = function (val) {
    window.filterBatchTable();
};

window.posEditBatchPrompt = async function (batchCode, currentPrice, currentSupplier) {
    const priceVal = prompt(`Edit Stock Batch "${batchCode}"\n\nEnter new Buying Price / unit (USD):`, currentPrice);
    if (priceVal === null) return; // Cancelled

    const supplierVal = prompt(`Edit Stock Batch "${batchCode}"\n\nEnter new Supplier name:`, currentSupplier);
    if (supplierVal === null) return; // Cancelled

    const newPrice = parseFloat(priceVal);
    if (isNaN(newPrice)) {
        alert("Please enter a valid numeric value for buying price.");
        return;
    }

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/batches/edit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ batch_code: batchCode, buying_price: newPrice, supplier: supplierVal })
        });
        const data = await res.json();
        if (res.ok) {
            alert("Stock batch updated successfully.");
            // Reload table
            if (typeof window.loadInventoryData === 'function') {
                window.loadInventoryData();
            }
        } else {
            alert("Failed to update batch: " + data.error);
        }
    } catch (e) {
        alert("Request error: " + e.message);
    }
};

window.populatePriceFields = function (itemCode) {
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

window.submitNewBatch = async function (e) {
    e.preventDefault();
    const baseUrl = document.getElementById('api-base').value;
    const secret = document.getElementById('admin-secret').value;

    const batch_code = document.getElementById('batch-code').value.trim().toUpperCase();
    const item_code = document.getElementById('batch-item-code').value;
    const buying_price = parseFloat(document.getElementById('batch-buying-price').value) || 0;
    const trackingMode = document.getElementById('batch-is-serial').value;

    const is_serial = trackingMode === 'yes';
    let serials = [];
    let manual_qty = 0;

    if (is_serial) {
        const serialsRaw = document.getElementById('batch-serials').value;
        serials = serialsRaw
            .split(/[\n,;]/)
            .map(sn => sn.trim())
            .filter(sn => sn !== '');
    } else {
        manual_qty = parseInt(document.getElementById('batch-manual-qty').value) || 0;
    }

    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/batches/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
            body: JSON.stringify({ batch_code, item_code, buying_price, serials, is_serial, manual_qty })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || 'Batch created successfully.');
            e.target.reset();
            // Reset dropdown and toggles
            document.getElementById('batch-is-serial').value = 'yes';
            window.toggleBatchTrackingMode('yes');
            loadInventoryData();
        } else {
            alert('Error: ' + data.error);
        }
    } catch (err) {
        alert('Request failed: ' + err.message);
    }
};

window.submitPriceUpdate = async function (e) {
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

window.submitNewCatalogItem = async function (e) {
    e.preventDefault();
    const baseUrl = document.getElementById('api-base').value;
    const secret = document.getElementById('admin-secret').value;

    const item_name = document.getElementById('catalog-item-name').value.trim();
    const item_code = document.getElementById('catalog-item-code').value.trim().toUpperCase();
    const category = document.getElementById('catalog-item-category').value;
    // Sub-category and brand are now select dropdowns
    const subCatEl = document.getElementById('catalog-sub-category');
    const brandEl = document.getElementById('catalog-brand');
    const sub_category_id = subCatEl ? subCatEl.value : '';
    const brand_id = brandEl ? brandEl.value : '';
    const stocking_um = document.getElementById('catalog-um').value;

    try {
        const res = await fetch(`${baseUrl}/api/admin/inventory/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Admin-Secret': secret },
            body: JSON.stringify({ item_code, item_name, category, stock_qty: 0, unit_price: 0, unit_price_mmk: 0, sub_category_id, brand_id, stocking_um })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message || 'Catalog model provisioned successfully.');
            e.target.reset();
            // Re-populate dropdowns after reset
            populateMasterDropdowns();
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
    } catch (err) {
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
            let wRowsHtml = '';
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

                wRowsHtml += `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-all text-slate-300">
                                <td class="py-2.5 font-mono text-indigo-300 font-bold">${item.serial_number}</td>
                                <td class="py-2.5 font-semibold text-white">${item.device_name}</td>
                                <td class="py-2.5">${item.company_name || 'Individual Customer'}</td>
                                <td class="py-2.5 font-mono">${endStr}</td>
                                <td class="py-2.5">${statusBadge}</td>
                            </tr>
                        `;
            });
            warrantyBody.innerHTML = wRowsHtml;
        }
    } catch (e) {
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
            let rRowsHtml = '';
            rmaList.forEach(item => {
                const statusColor = item.status === 'RMA Completed' ? 'text-emerald-400' : 'text-amber-400';
                const sentStr = item.installed_date ? item.installed_date : 'N/A';

                rRowsHtml += `
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
                                        âœ”
                                    </button>
                                </td>
                            </tr>
                        `;
            });
            rmaBody.innerHTML = rRowsHtml;
        }
    } catch (e) {
        console.error("RMA fetch exception", e);
    }
    window.initExcelTableFilters('warranties-table');
    window.initExcelTableFilters('rma-table');
    window.applyExcelFiltersToTable('warranties-table');
    window.applyExcelFiltersToTable('rma-table');
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
    } catch (e) { }
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
                                ðŸ—‘ï¸
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
    } catch (e) { }
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
        document.getElementById('safe-usd-balance').textContent = `$${safe.usd_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        document.getElementById('safe-mmk-balance').textContent = `${safe.mmk_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Ks`;

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
        } catch (err) { }

        // Transactions
        const txRes = await fetch(`${baseUrl}/api/admin/cash/transactions`);
        cashTransactions = await txRes.json();
        renderCashTable();
    } catch (e) { }
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
    } catch (e) { }
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

        let rowsHtml = '';
        techs.forEach(t => {
            const statusBadge = t.active === 1
                ? '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-emerald-500/10 text-emerald-400">Active</span>'
                : '<span class="px-2 py-0.5 rounded-full font-bold text-[9px] bg-amber-500/10 text-amber-400">Pending Approval</span>';

            let roleOptions = '';
            const rList = window.globalRolesList && window.globalRolesList.length > 0
                ? window.globalRolesList
                : [{ name: 'Admin' }, { name: 'Sales' }, { name: 'Technician' }];

            rList.forEach(r => {
                roleOptions += `<option value="${r.name}" ${t.role === r.name ? 'selected' : ''}>${r.name}</option>`;
            });

            const roleSelect = `
                        <select id="role-${t.id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1 text-xs text-white">
                            ${roleOptions}
                        </select>
                    `;

            const actionButton = t.active === 1
                ? `<button onclick="updateTechnicianStatus('${t.id}', 0)" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Deactivate</button>`
                : `<button onclick="updateTechnicianStatus('${t.id}', 1)" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-3 py-1 rounded-lg">Approve</button>`;

            rowsHtml += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all align-middle">
                            <td class="py-2.5 font-mono text-indigo-300 font-bold">${t.id}</td>
                            <td class="py-2.5 font-bold">${t.name}</td>
                            <td class="py-2.5 text-indigo-400 font-bold">${t.nickname || '-'}</td>
                            <td class="py-2.5 text-slate-400 font-mono">${t.email || (t.username ? '@' + t.username : 'N/A')}</td>
                            <td class="py-2.5">${roleSelect}</td>
                            <td class="py-2.5">${statusBadge}</td>
                            <td class="py-2.5 text-right space-x-1 whitespace-nowrap">
                                <button onclick="openTechHistoryModal('${t.id}', '${t.name.replace(/'/g, "\\'")}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[10px] px-2 py-1 rounded transition-all">ðŸ“œ History</button>
                                <button onclick="openTechIdCard('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${t.role}', '${t.phone || ''}', '${t.email || ''}', '${t.nickname || ''}', ${t.active}, '${t.photo || ''}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 font-bold text-[10px] px-2 py-1 rounded transition-all">ðŸªª ID Card</button>
                                <button onclick="saveTechnicianRole('${t.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Save Role</button>
                                <button onclick="openEditTechModal('${t.id}', '${t.name.replace(/'/g, "\\'")}', '${(t.nickname || '').replace(/'/g, "\\'")}', '${t.phone || ''}', '${t.email || ''}', '${t.username || ''}', '${t.pin || ''}', '${t.role}', '${(t.telegram_username || '').replace(/'/g, "\\'")}')" class="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Edit</button>
                                <button onclick="deleteTechnician('${t.id}')" class="bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Delete</button>
                                ${actionButton}
                            </td>
                        </tr>
                    `;
        });
        tbody.innerHTML = rowsHtml;
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

window.openEditTechModal = function (id, name, nickname, phone, email, username, pin, role, telegram_username = '') {
    document.getElementById('edit-tech-id').value = id;
    document.getElementById('edit-tech-name').value = name;
    document.getElementById('edit-tech-nickname').value = nickname;
    document.getElementById('edit-tech-phone').value = phone;
    document.getElementById('edit-tech-email').value = email;
    if (document.getElementById('edit-tech-telegram-username')) {
        document.getElementById('edit-tech-telegram-username').value = telegram_username;
    }
    document.getElementById('edit-tech-username').value = username;
    document.getElementById('edit-tech-password').value = '';
    document.getElementById('edit-tech-pin').value = pin === 'undefined' || !pin ? '1234' : pin;
    document.getElementById('edit-tech-role').value = role || 'Technician';

    document.getElementById('edit-tech-modal').classList.remove('hidden');
};

window.closeEditTechModal = function () {
    document.getElementById('edit-tech-modal').classList.add('hidden');
};

// â”€â”€â”€ ðŸªª ID CARD SYSTEM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _idCardCurrentTech = null;

window.openTechIdCard = function (id, name, role, phone, email, nickname, active, photo) {
    _idCardCurrentTech = { id, name, role, phone, email, nickname, active, _photoDataUrl: photo };

    // Populate info panel
    document.getElementById('id-info-name').textContent = name || 'â€”';
    document.getElementById('id-info-id').textContent = id || 'â€”';
    document.getElementById('id-info-role').textContent = role || 'â€”';
    document.getElementById('id-info-phone').textContent = phone || 'â€”';
    document.getElementById('id-info-email').textContent = email || 'â€”';
    document.getElementById('id-info-status').textContent = active ? 'Active âœ“' : 'Inactive';
    document.getElementById('id-info-status').className = active
        ? 'text-emerald-400 font-bold'
        : 'text-rose-400 font-bold';

    // Populate card face
    document.getElementById('id-card-name-front').textContent = name.toUpperCase();
    document.getElementById('id-card-role-front').textContent = role;
    document.getElementById('id-card-id-front').textContent = id;
    document.getElementById('id-card-phone-front').textContent = phone || 'â€”';
    document.getElementById('id-card-email-back').textContent = email || 'â€”';

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
        photoEl.innerHTML = 'ðŸ‘·';
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

window.handleIdCardPhotoUpload = async function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        const rawDataUrl = e.target.result;

        // Compress image using canvas
        const img = new Image();
        img.onload = async function () {
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
                } catch (err) {
                    console.error("Photo upload network error:", err);
                }
            }
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
};

window.downloadTechIdPdf = function () {
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
    <title>ID Card â€” ${name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        /* CR80 card: 85.6 Ã— 53.98 mm at 96 DPI â†’ px ratio */
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
            <div class="photo">${_photoDataUrl ? `<img src="${_photoDataUrl}">` : 'ðŸ‘·'}</div>
            <div class="info">
                <div class="brand">Awesome Myanmar</div>
                <div class="emp-name">${name}</div>
                <div class="emp-role">${role}${nickname ? ` Â· "${nickname}"` : ''}</div>
                <div class="emp-id">${id}</div>
            </div>
            <div class="qr-mini"><img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}" width="50" height="50" style="border-radius:3px;background:#fff;padding:2px;display:block;" alt="QR"></div>
        </div>
        <div class="bottom-bar">
            <span class="phone-txt">${phone || ''}</span>
            <span class="status-txt">${active ? 'Field Tech â€¢ Active' : 'Field Tech â€¢ Inactive'}</span>
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
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.submitEditTechnician = async function (e) {
    e.preventDefault();
    const id = document.getElementById('edit-tech-id').value;
    const name = document.getElementById('edit-tech-name').value.trim();
    const nickname = document.getElementById('edit-tech-nickname').value.trim();
    const phone = document.getElementById('edit-tech-phone').value.trim();
    const email = document.getElementById('edit-tech-email').value.trim();
    const telegram_username = document.getElementById('edit-tech-telegram-username')?.value?.trim() || '';
    const username = document.getElementById('edit-tech-username').value.trim();
    const password = document.getElementById('edit-tech-password').value.trim();
    const pin = document.getElementById('edit-tech-pin').value.trim();
    const role = document.getElementById('edit-tech-role').value;

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    const payload = { id, name, nickname, phone, email, username, pin, role, telegram_username };
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

window.deleteTechnician = async function (id) {
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

window.openTechHistoryModal = async function (techId, techName) {
    const modal = document.getElementById('tech-history-modal');
    const title = document.getElementById('history-modal-tech-title');
    const listContainer = document.getElementById('tech-history-tickets-list');
    const detailsContainer = document.getElementById('tech-history-ticket-details');

    if (!modal || !title || !listContainer) return;

    title.textContent = techName;
    listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">Pulling service logs...</p>';
    detailsContainer.innerHTML = `
                <div class="text-center text-slate-500 py-12">
                    <span class="text-3xl block mb-2">ðŸŽ«</span>
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
                                <div class="text-[10px] text-slate-400 mt-0.5">${j.service_type} â€¢ ${j.created_at ? j.created_at.split(' ')[0] : '-'}</div>
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

window.closeTechHistoryModal = function () {
    const modal = document.getElementById('tech-history-modal');
    if (modal) modal.classList.add('hidden');
};

window.renderTechHistoryDetails = function (jobId) {
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
                                        <span>${val ? 'âœ…' : 'âŒ'}</span>
                                        <span class="capitalize">${key.replace(/_/g, ' ')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
        } catch (e) { }
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
                            <div class="text-[10px] font-bold text-white mt-0.5">ðŸ¢ ${job.company_name || 'Individual Client'}</div>
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
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">ðŸ“¸ Deployment Site Proofs</span>
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
    } catch (e) {
        alert("AI request failed: " + e.message);
    }
}

window.openEditTicketModal = function (id, clientId, techId, serviceType, status, desc, mapsUrl, arrivalLat, arrivalLng) {
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

    const editDatalist = document.getElementById('edit-clients-datalist');
    if (editDatalist && window.allClientsList) {
        editDatalist.innerHTML = '';
        window.allClientsList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = `${c.company_name} [${c.id}]`;
            editDatalist.appendChild(opt);
        });
    }

    const editClientSearch = document.getElementById('edit-ticket-client-search');
    const editClientIdHidden = document.getElementById('edit-ticket-client');
    const editNewClientFields = document.getElementById('edit-ticket-new-client-fields');
    const editClientPhone = document.getElementById('edit-ticket-client-phone');
    const editClientAddress = document.getElementById('edit-ticket-client-address');

    if (editNewClientFields) editNewClientFields.classList.add('hidden');
    if (editClientPhone) { editClientPhone.value = ''; editClientPhone.required = false; }
    if (editClientAddress) { editClientAddress.value = ''; editClientAddress.required = false; }

    const currentClient = window.allClientsList?.find(c => c.id === clientId);
    if (currentClient) {
        editClientSearch.value = `${currentClient.company_name} [${currentClient.id}]`;
        editClientIdHidden.value = currentClient.id;
    } else {
        editClientSearch.value = clientId || '';
        editClientIdHidden.value = clientId || '';
    }

    const techSelect = document.getElementById('edit-ticket-tech');
    techSelect.innerHTML = document.getElementById('lookup-tech').innerHTML;
    techSelect.value = techId;

    document.getElementById('edit-ticket-modal').classList.remove('hidden');
};

window.closeEditTicketModal = function () {
    document.getElementById('edit-ticket-modal').classList.add('hidden');
};

window.resolveEditJobMapsUrlToCoords = async function (url) {
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
    } catch (e) {
        statusEl.textContent = "Resolution API error: " + e.message;
        statusEl.className = "block text-[8px] text-rose-400 mt-1";
    }
};

window.submitEditTicket = async function (e) {
    e.preventDefault();
    const id = document.getElementById('edit-ticket-id').value;
    const new_id = document.getElementById('edit-ticket-id-display').value.trim();
    let client_id = document.getElementById('edit-ticket-client').value;
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
        if (client_id === '__NEW__' || !client_id) {
            const editClientSearch = document.getElementById('edit-ticket-client-search');
            const editClientPhone = document.getElementById('edit-ticket-client-phone');
            const editClientAddress = document.getElementById('edit-ticket-client-address');

            const typedName = editClientSearch.value.trim();
            if (!typedName) {
                alert("Please select or enter a client name.");
                return;
            }

            const existing = window.allClientsList?.find(c => c.company_name.toLowerCase() === typedName.toLowerCase());
            if (existing) {
                client_id = existing.id;
            } else {
                const newClientId = `CLI-IND-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                const phone = editClientPhone.value.trim();
                const address = editClientAddress.value.trim();

                const clientRes = await fetch(`${baseUrl}/api/admin/clients`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({
                        id: newClientId,
                        company_name: typedName,
                        contact_person: typedName,
                        address: address,
                        phone: phone,
                        amc_status: 'Individual'
                    })
                });
                const clientData = await clientRes.json();
                if (!clientRes.ok) {
                    throw new Error(clientData.error || "Failed to create new client profile.");
                }
                client_id = newClientId;
            }
        }

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

window.cancelJob = async function (id) {
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

    let rowsHtml = '';
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

        rowsHtml += `
                    <tr class="clickable-row border-b border-white/5 hover:bg-white/5 transition-all text-slate-300 align-middle cursor-pointer" onclick="if(!event.target.closest('button') && !event.target.closest('img') && !event.target.closest('a')) { this.classList.toggle('expanded'); document.getElementById('details-${j.id}').classList.toggle('hidden'); }">
                        <td class="py-2.5 font-mono text-amber-500 font-bold">
                            <span class="row-expand-arrow">â–¶</span>${j.id}
                        </td>
                        <td class="py-2.5 font-semibold text-white">${j.company_name || 'Client'}</td>
                        <td class="py-2.5">${j.tech_name || 'Tech'}</td>
                        <td class="py-2.5 text-slate-400">${j.service_type}</td>
                        <td class="py-2.5"><span class="px-2 py-0.5 rounded-full font-bold text-[9px] uppercase ${statusBadge}">${j.status}</span></td>
                        <td class="py-2.5 text-right space-x-1" onclick="event.stopPropagation()">
                            <button onclick="aiPolishJobNotes('${j.id}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[9px] px-2 py-1 rounded transition-all">âœ¨ AI Polish</button>
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
    tbody.innerHTML = rowsHtml;
    window.initExcelTableFilters('tickets-table');
    window.filterTicketTable();
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
        html: `<div style="background-color: #ef4444; border: 2px solid #f59e0b; border-radius: 50%; width: 16px; height: 16px; box-shadow: 0 0 12px #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 9px;">ðŸ¢</div>`,
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
    if (!calendarEl) return;

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

    if (calendarInstance) {
        calendarInstance.removeAllEvents();
        events.forEach(ev => calendarInstance.addEvent(ev));
        return;
    }

    calendarInstance = new FullCalendar.Calendar(calendarEl, {
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
    calendarInstance.render();
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
    } catch (e) {
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

window.setClientStatusCardFilter = function (status) {
    activeCardFilter = status;

    // Sync status dropdown selector if needed
    const dropdown = document.getElementById('client-status-dropdown');
    if (dropdown) {
        dropdown.value = status === 'Active' ? 'Active' : status === 'Expired' ? 'Expired' : 'all';
    }

    filterAndSortClients();
};

window.setClientDirectoryTab = function (tab) {
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

window.filterAndSortClients = function () {
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
    let rowsHtml = '';
    list.forEach(c => {
        let badgeClass = 'bg-slate-500/10 text-slate-400';
        if (c.amc_status === 'Active') badgeClass = 'bg-emerald-500/10 text-emerald-400';
        else if (c.amc_status === 'Expired') badgeClass = 'bg-rose-500/10 text-rose-400';
        else if (c.amc_status === 'No AMC') badgeClass = 'bg-amber-500/10 text-amber-500';
        else if (c.amc_status === 'Individual') badgeClass = 'bg-indigo-500/10 text-indigo-400';

        const amcRange = (c.amc_start || c.amc_end)
            ? `<div class="text-[10px] text-slate-500 font-mono mt-0.5">${c.amc_start || ''} to ${c.amc_end || ''}</div>`
            : '';

        rowsHtml += `
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
                            <button onclick="openClientHistoryModal('${c.id}', '${c.company_name.replace(/'/g, "\\'")}')" class="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-bold text-[10px] px-2 py-1 rounded transition-all">ðŸ“œ History</button>
                            <button onclick="openEditClient('${c.id}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 font-bold text-[10px] px-2 py-1 rounded transition-all">âœï¸ Edit</button>
                            <button onclick="deleteClient('${c.id}')" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold text-[10px] px-2 py-1 rounded transition-all">ðŸ—‘ï¸ Delete</button>
                        </td>
                    </tr>
                `;
    });
    tbody.innerHTML = rowsHtml;
    window.initExcelTableFilters('clients-table');
    window.applyExcelFiltersToTable('clients-table');
}

window.openEditClient = function (id) {
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

    document.getElementById('client-form-title').innerHTML = '<span class="text-amber-500">âœï¸</span> Edit Client Profile';
    document.getElementById('client-cancel-edit-btn').classList.remove('hidden');
};

window.resetClientForm = function () {
    document.getElementById('client-id-field').value = '';
    document.getElementById('client-id-field').readOnly = false;
    document.getElementById('client-form').reset();
    document.getElementById('client-form-title').innerHTML = '<span class="text-amber-500">ðŸ¢</span> Provision Client Profile';
    document.getElementById('client-cancel-edit-btn').classList.add('hidden');
};

window.submitClient = async function (e) {
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

window.deleteClient = async function (id) {
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

window.openClientHistoryModal = async function (clientId, companyName) {
    const modal = document.getElementById('client-history-modal');
    const title = document.getElementById('history-modal-client-title');
    const listContainer = document.getElementById('history-tickets-list');
    const detailsContainer = document.getElementById('history-ticket-details');

    if (!modal || !title || !listContainer) return;

    title.textContent = companyName;
    listContainer.innerHTML = '<p class="text-xs text-slate-500 py-4 text-center">Pulling service logs...</p>';
    detailsContainer.innerHTML = `
                <div class="text-center text-slate-500 py-12">
                    <span class="text-3xl block mb-2">ðŸŽ«</span>
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
                                <div class="text-[10px] text-slate-400 mt-0.5">${j.service_type} â€¢ ${j.created_at ? j.created_at.split(' ')[0] : '-'}</div>
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

window.closeClientHistoryModal = function () {
    const modal = document.getElementById('client-history-modal');
    if (modal) modal.classList.add('hidden');
};

window.renderClientHistoryDetails = function (jobId) {
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
                                        <span>${val ? 'âœ…' : 'âŒ'}</span>
                                        <span class="capitalize">${key.replace(/_/g, ' ')}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `;
        } catch (e) { }
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
                            <div class="text-[10px] font-bold text-white mt-0.5">ðŸ› ï¸ ${job.tech_name || 'Unassigned'}</div>
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
                            <span class="block text-[8px] font-bold text-slate-500 uppercase tracking-widest">ðŸ“¸ Deployment Site Proofs</span>
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

window.openAdminPhoto = function (event, jobId, fieldName) {
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
        } catch (e) { }
        const hardwareLines = doc.splitTextToSize(hardwareStr, 180);
        doc.text(hardwareLines, 15, currentY);

        // --- Sign-Off Footer section ---
        currentY += (hardwareLines.length * 4.5) + 26;

        if (job.signature) {
            try {
                doc.addImage(job.signature, 'PNG', 135, currentY - 14, 45, 12);
            } catch (e) {
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

// â”€â”€â”€ AI COPILOT WORKSPACE SCRIPT HANDLERS â”€â”€â”€
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
    } catch (e) {
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
        attribution: 'Â© OpenStreetMap'
    }).addTo(copilotMap);
    document.getElementById('copilot-map').classList.add('dark-map-theme');

    // Add HQ Office pin
    L.marker([hq.lat, hq.lng]).addTo(copilotMap)
        .bindPopup("ðŸ« <strong>AwesomeMyanmar Office (Start/End)</strong>").openPopup();

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
    } catch (e) { }
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
    } catch (e) {
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
                    <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">ðŸ¤–</div>
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
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">ðŸ¤–</div>
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
                            <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">ðŸ¤–</div>
                            <div class="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-2.5 text-xs text-rose-400 leading-relaxed">
                                Failed to process request: ${data.error}
                            </div>
                        </div>
                    `;
        }
    } catch (e) {
        const loader = document.getElementById(loadingId);
        if (loader) loader.remove();
        stream.innerHTML += `
                    <div class="flex gap-3 max-w-[85%]">
                        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">ðŸ¤–</div>
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
                } catch (err) {
                    inputArea.value = "Transcription connection error: " + err.message;
                }
            };
            mediaRecorder.start();
            isRecording = true;
            btn.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
            btn.classList.remove('bg-red-500/10', 'text-red-400', 'border-red-500/20');
            icon.textContent = "â¹ï¸";
            text.textContent = "Stop Recording";
        } catch (err) {
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
        icon.textContent = "ðŸŽ™ï¸";
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

window.editServiceFee = function (id, serviceType, amount, currency, desc) {
    document.getElementById('fee-id').value = id;
    document.getElementById('fee-service-type').value = serviceType;
    document.getElementById('fee-amount').value = amount;
    document.getElementById('fee-currency').value = currency;
    document.getElementById('fee-desc').value = desc;

    document.getElementById('fee-form-title').innerHTML = '<span>ðŸ’µ</span> Edit Service Rate';
    document.getElementById('btn-fee-reset').classList.remove('hidden');
};

window.resetFeeForm = function () {
    document.getElementById('fee-id').value = '';
    document.getElementById('service-fee-form').reset();
    document.getElementById('fee-form-title').innerHTML = '<span>ðŸ’µ</span> Add Service Rate';
    document.getElementById('btn-fee-reset').classList.add('hidden');
};

window.submitServiceFee = async function (e) {
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

window.deleteServiceFee = async function (id) {
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ›’ POINT OF SALE (POS) SYSTEM IMPLEMENTATION
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.posCart = [];
window.posCatalog = [];
window.posClients = [];
window.posJobs = [];

window.switchPosModule = function (module) {
    const panels = ['checkout', 'credits'];
    panels.forEach(p => {
        const el = document.getElementById(`pos-panel-${p}`);
        if (el) el.classList.add('hidden');
    });
    const active = document.getElementById(`pos-panel-${module}`);
    if (active) active.classList.remove('hidden');

    const mainMods = ['checkout', 'credits'];
    mainMods.forEach(m => {
        const btn = document.getElementById(`pos-mod-${m}`);
        if (btn) {
            if (m === module) {
                btn.classList.add('active-pos-mod');
                btn.classList.remove('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.pos-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(16,185,129,0.2)';
                    iconWrap.style.border = '1px solid rgba(16,185,129,0.3)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.add('text-emerald-400');
                }
                const label = btn.querySelector('.pos-mod-label');
                if (label) label.classList.add('text-emerald-400');
            } else {
                btn.classList.remove('active-pos-mod');
                btn.classList.add('text-slate-400', 'hover:text-white');
                const iconWrap = btn.querySelector('.pos-mod-icon');
                if (iconWrap) {
                    iconWrap.style.background = 'rgba(255,255,255,0.05)';
                    iconWrap.style.border = '1px solid rgba(255,255,255,0.05)';
                    const iconSvg = iconWrap.querySelector('svg');
                    if (iconSvg) iconSvg.classList.remove('text-emerald-400');
                }
                const label = btn.querySelector('.pos-mod-label');
                if (label) label.classList.remove('text-emerald-400');
            }
        }
    });

    if (module === 'credits') {
        window.posLoadCreditsLedger();
    }
};

window.loadPosData = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    // Attach scanner listener dynamically when element becomes available in DOM
    const searchInput = document.getElementById('pos-stock-search');
    if (searchInput && !searchInput.dataset.scannerBound) {
        searchInput.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
                const val = e.target.value.trim().toUpperCase();
                if (!val) return;

                // 1. Try to match Catalog Item Model Code directly
                const matched = window.posCatalog.find(item => item.item_code.toUpperCase() === val);
                if (matched) {
                    window.addToPosCart(matched.item_code);
                    e.target.value = '';
                    e.target.focus();
                    e.preventDefault();
                    return;
                }

                // 2. Try to resolve as Serial Number via API
                e.preventDefault();

                // Check if serial has already been scanned in this active cart session
                window.scannedSerialsList = window.scannedSerialsList || [];
                if (window.scannedSerialsList.includes(val)) {
                    alert(`Serial Number "${val}" has already been scanned into this active cart.`);
                    e.target.value = '';
                    e.target.focus();
                    return;
                }

                try {
                    const res = await fetch(`${baseUrl}/api/pos/resolve-serial?serial=${encodeURIComponent(val)}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const resolvedItem = await res.json();

                        // Double check resolved serial is still valid
                        window.scannedSerialsList.push(val);
                        window.addToPosCart(resolvedItem.item_code, val);
                        e.target.value = '';
                    } else {
                        alert(`Scanned code "${val}" is not a recognized model or serial number.`);
                    }
                } catch (err) {
                    console.error("Failed to query serial resolver:", err);
                } finally {
                    e.target.focus();
                }
            }
        });
        searchInput.dataset.scannerBound = "true";
    }

    try {
        // Fetch catalog
        const stockRes = await fetch(`${baseUrl}/api/admin/inventory/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (stockRes.ok) {
            window.posCatalog = await stockRes.json();

            // Populate POS Categories selector
            const catSelect = document.getElementById('pos-stock-cat');
            if (catSelect) {
                const uniqueCats = [...new Set(window.posCatalog.map(item => item.category))].filter(Boolean);
                catSelect.innerHTML = '<option value="All">All Categories</option>' +
                    uniqueCats.map(cat => `<option value="${cat}">${cat}</option>`).join('');
            }

            window.filterPosCatalog();
        }

        // Fetch clients
        const clientRes = await fetch(`${baseUrl}/api/admin/clients/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (clientRes.ok) {
            window.posClients = await clientRes.json();

            // Populate posClients list if Individual walk-in is missing
            const hasIndividual = window.posClients.some(c => c.id === 'Individual');
            if (!hasIndividual) {
                window.posClients.unshift({
                    id: 'Individual',
                    company_name: 'Individual Clients / Walk-in',
                    contact_person: 'Walk-in',
                    address: 'Myanmar',
                    phone: ''
                });
            }

            const datalist = document.getElementById('pos-clients-datalist');
            if (datalist) {
                datalist.innerHTML = '';
                window.posClients.forEach(c => {
                    datalist.innerHTML += `<option value="${c.company_name}" data-id="${c.id}">${c.id} (${c.contact_person || 'No Contact'})</option>`;
                });
            }
        }

        // Fetch Jobs / Tickets to allow linking
        const jobsRes = await fetch(`${baseUrl}/api/admin/cash/transactions`, { // using generic auth
            headers: { 'Authorization': `Bearer ${token}` }
        });
        // Fallback to query service records endpoint
        const recordsRes = await fetch(`${baseUrl}/api/jobs/receipt?job_id=`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null);

        // Fetch direct jobs from jobs database
        const directJobsRes = await fetch(`${baseUrl}/api/admin/ai/route-optimize?technician_id=`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ technician_id: '' })
        }).catch(() => null);

        // Fetch all service tickets for linking
        const ticketsRes = await fetch(`${baseUrl}/api/portal/history?client_id=`, {
            headers: { 'Authorization': `Bearer ${token}` }
        }).catch(() => null);

        // Let's populate the link job options via active service tickets from tickets tab data
        const jobsSelect = document.getElementById('pos-link-job');
        if (jobsSelect) {
            // Populate from active list or fetch
            const ticketsRes = await fetch(`${baseUrl}/api/admin/cash/transactions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // Directly pull from DB active service records
            const recordsQuery = await fetch(`${baseUrl}/api/admin/ai/transcribe`, { method: 'POST' }).catch(() => null); // mock trigger

            // Let's fetch jobs
            const fetchRecords = await fetch(`${baseUrl}/api/jobs/receipt?job_id=`, { headers: { 'Authorization': `Bearer ${token}` } }).catch(() => null);

            // Fetch list of tickets from tickets database
            const tListRes = await fetch(`${baseUrl}/api/admin/cash/transactions`, { headers: { 'Authorization': `Bearer ${token}` } });
            // Let's fetch the list from general dashboard list
            const list = window.globalJobsList || [];
            jobsSelect.innerHTML = '<option value="">-- Link Ticket / Job ID --</option>' +
                list.map(j => `<option value="${j.id}">${j.id} - ${j.company_name || 'Individual'}</option>`).join('');
        }

        // Load PDF template builder configuration
        await window.loadPdfBuilderConfig();
    } catch (err) {
        console.error("Failed to load POS reference data:", err);
    }
};

window.posCreateWalkinClient = function () {
    const clientInput = document.getElementById('pos-client-search');
    const clientIdHidden = document.getElementById('pos-client-id');
    if (clientInput) clientInput.value = 'Individual Clients / Walk-in';
    if (clientIdHidden) clientIdHidden.value = 'Individual';
    alert("Quick Client set to: Walk-in Individual Customer");
};

window.posLoadJobDetails = function (jobId) {
    if (!jobId) return;
    const job = (window.globalJobsList || []).find(j => j.id === jobId);
    if (!job) return;

    // Auto-select Client
    const clientInput = document.getElementById('pos-client-search');
    const clientIdHidden = document.getElementById('pos-client-id');

    if (clientInput) {
        clientInput.value = job.company_name || 'Individual Clients / Walk-in';
    }
    if (clientIdHidden) {
        clientIdHidden.value = job.client_id || 'Individual';
    }

    // Auto-load linked items if specified in job description
    if (job.job_description) {
        // Attempt to match model codes in job description
        window.posCatalog.forEach(item => {
            if (job.job_description.toUpperCase().includes(item.item_code.toUpperCase())) {
                window.addToPosCart(item.item_code);
            }
        });
    }
    alert(`Linked to Ticket ${jobId}. Client: ${job.company_name || 'Individual'}`);
};

window.posLoadCreditsLedger = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    const tbody = document.getElementById('pos-credits-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${baseUrl}/api/pos/credits`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const credits = await res.json();
            if (credits.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-10 text-center text-[11px] text-slate-600">No outstanding credit records found.</td></tr>';
                return;
            }

            tbody.innerHTML = credits.map(c => {
                const dateStr = new Date(c.created_at).toLocaleDateString();
                const total = parseFloat(c.total_amount).toFixed(2);
                const paid = parseFloat(c.paid_amount).toFixed(2);
                const credit = parseFloat(c.credit_amount).toFixed(2);
                const statusColor = c.status === 'Paid' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10';

                return `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition align-middle text-[11px]">
                                <td class="px-4 py-3 text-slate-400 font-mono">${dateStr}</td>
                                <td class="px-4 py-3 text-white font-bold">${c.company_name}</td>
                                <td class="px-4 py-3 text-sky-400 font-mono font-bold">${c.invoice_id}</td>
                                <td class="px-4 py-3 text-right font-mono">$${total}</td>
                                <td class="px-4 py-3 text-right font-mono">$${paid}</td>
                                <td class="px-4 py-3 text-right font-mono text-rose-400 font-bold">$${credit}</td>
                                <td class="px-4 py-3 text-center">
                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${statusColor}">${c.status}</span>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <button onclick="window.posRecallCreditInvoice('${c.client_id}', '${c.invoice_id}', ${c.credit_amount})"
                                        class="px-2.5 py-1 text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded hover:bg-amber-500/20 transition">
                                        Recall & Clear
                                    </button>
                                </td>
                            </tr>
                        `;
            }).join('');
        }
    } catch (e) {
        console.error("Failed to load outstanding credits:", e);
    }
};

window.posRecallCreditInvoice = function (clientId, invoiceId, creditAmount) {
    const matched = window.posClients.find(c => c.id === clientId);
    if (matched) {
        const clientInput = document.getElementById('pos-client-search');
        const clientIdHidden = document.getElementById('pos-client-id');
        if (clientInput) clientInput.value = matched.company_name;
        if (clientIdHidden) clientIdHidden.value = clientId;
    }

    // Set checkout amounts to reflect paying off the credit amount
    document.getElementById('pos-paid-amount-a').value = creditAmount;
    document.getElementById('pos-paid-amount-b').value = '';

    // Switch back to checkout panel
    window.switchPosModule('checkout');
    window.calculatePosTotals();
    alert(`Recalled Credit Invoice ${invoiceId} for Client: ${matched ? matched.company_name : clientId}. Record payment of $${creditAmount} to clear.`);
};

window.filterPosCatalog = function () {
    const query = (document.getElementById('pos-stock-search')?.value || '').trim().toLowerCase();
    const cat = document.getElementById('pos-stock-cat')?.value || 'All';
    const showInstockOnly = document.getElementById('pos-filter-instock')?.checked || false;
    const grid = document.getElementById('pos-catalog-grid');
    if (!grid) return;

    const filtered = window.posCatalog.filter(item => {
        const matchesQuery = item.item_name.toLowerCase().includes(query) || item.item_code.toLowerCase().includes(query);
        const matchesCat = cat === 'All' || item.category === cat;
        const matchesStock = !showInstockOnly || item.stock_qty > 0;
        return matchesQuery && matchesCat && matchesStock;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="col-span-4 text-center text-slate-500 py-12 text-xs">No matching items in stock.</div>`;
        return;
    }

    let html = '';
    const limit = 48;

    filtered.forEach((item, idx) => {
        if (idx >= limit) return;

        const outOfStock = item.stock_qty <= 0;
        const lowStock = item.stock_qty > 0 && item.stock_qty <= 3;
        const disabled = outOfStock ? 'opacity-40 pointer-events-none' : '';

        // Category icon SVG strings
        const catIconMap = {
            'Hard Drives': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
            'Network Cables': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`,
            'Security IP Cams': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
            'Spare Hardware Parts': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M19.07 19.07l-1.41-1.41M5.34 5.34L3.93 3.93M22 12h-2M4 12H2M12 22v-2M12 4V2"/></svg>`,
        };
        const catColorMap = {
            'Hard Drives': { bg: 'rgba(234,179,8,0.12)', bdr: 'rgba(234,179,8,0.28)', txt: '#fbbf24' },
            'Network Cables': { bg: 'rgba(59,130,246,0.12)', bdr: 'rgba(59,130,246,0.28)', txt: '#60a5fa' },
            'Security IP Cams': { bg: 'rgba(239,68,68,0.12)', bdr: 'rgba(239,68,68,0.28)', txt: '#f87171' },
            'Spare Hardware Parts': { bg: 'rgba(168,85,247,0.12)', bdr: 'rgba(168,85,247,0.28)', txt: '#c084fc' },
        };
        const defaultC = { bg: 'rgba(16,185,129,0.1)', bdr: 'rgba(16,185,129,0.22)', txt: '#34d399' };
        const c = catColorMap[item.category] || defaultC;
        const icon = catIconMap[item.category] || `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" class="w-4 h-4"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="8" y1="21" x2="16" y2="21"/></svg>`;

        const stockBadge = outOfStock
            ? `<span class="text-[8px] font-black bg-rose-500/10 text-rose-400 border border-rose-500/20 px-1 py-0.5 rounded-full leading-none">Out</span>`
            : lowStock
                ? `<span class="text-[8px] font-black bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1 py-0.5 rounded-full leading-none">${item.stock_qty}!</span>`
                : `<span class="text-[8px] font-bold bg-emerald-500/8 text-emerald-500 border border-emerald-500/15 px-1 py-0.5 rounded-full leading-none">${item.stock_qty}</span>`;

        html += `
                    <div onclick="window.addToPosCart('${item.item_code}')"
                        class="pos-catalog-card group relative flex flex-col cursor-pointer rounded-xl overflow-hidden transition-all duration-150 ${disabled}"
                        style="background: rgba(255,255,255,0.025); border: 1px solid rgba(255,255,255,0.06); min-height: 90px;">

                        <div class="h-0.5 w-full" style="background: linear-gradient(90deg, ${c.bdr}, transparent);"></div>

                        <div class="p-2 flex flex-col gap-1.5 flex-1">
                            <div class="flex items-start justify-between gap-1">
                                <div class="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                                    style="background: ${c.bg}; border: 1px solid ${c.bdr}; color: ${c.txt}; min-width: 20px; height: 20px;">
                                    ${icon}
                                </div>
                                ${stockBadge}
                            </div>
                            <p class="text-[10px] font-bold text-white leading-tight line-clamp-2">${item.item_name}</p>
                            <div class="flex items-center justify-between mt-auto pt-1" style="border-top: 1px solid rgba(255,255,255,0.05);">
                                <span class="text-[7px] text-slate-700 font-mono uppercase tracking-wide truncate max-w-[50%]">${item.item_code}</span>
                                <span class="text-[11px] font-black font-mono" style="color: ${c.txt};">$${item.unit_price.toFixed(2)}</span>
                            </div>
                        </div>

                        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 rounded-xl pointer-events-none"
                            style="background: ${c.bg}; border: 1px solid ${c.bdr};">
                            <div class="flex flex-col items-center gap-0.5">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4" style="color:${c.txt};"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                <span class="text-[7px] font-black uppercase tracking-widest" style="color:${c.txt};">Add</span>
                            </div>
                        </div>
                    </div>
                `;
    });

    if (filtered.length > limit) {
        html += `
                    <div class="col-span-4 flex items-center justify-center p-6 bg-white/5 border border-white/10 rounded-xl">
                        <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider text-center">
                            Showing first ${limit} of ${filtered.length} matches. Type keywords or scan model barcodes to filter.
                        </span>
                    </div>
                `;
    }

    grid.innerHTML = html;
};

window.addToPosCart = function (itemCode, serialNum = null) {
    const item = window.posCatalog.find(i => i.item_code === itemCode);
    if (!item) return;

    const inCart = window.posCart.find(i => i.item_code === itemCode);
    if (inCart) {
        if (inCart.qty >= item.stock_qty) {
            alert(`Cannot add more. Insufficient stock limit of ${item.stock_qty} units.`);
            return;
        }
        inCart.qty++;
        if (serialNum) {
            inCart.serials = inCart.serials || [];
            inCart.serials.push(serialNum);
        }
    } else {
        window.posCart.push({
            item_code: item.item_code,
            item_name: item.item_name,
            qty: 1,
            unit_price: item.unit_price,
            unit_price_mmk: item.unit_price_mmk,
            stock_qty: item.stock_qty,
            category: item.category,
            serials: serialNum ? [serialNum] : []
        });
    }
    window.renderPosCart();
};

window.updateCartQty = function (itemCode, qtyVal) {
    const item = window.posCart.find(i => i.item_code === itemCode);
    if (!item) return;

    const qty = parseInt(qtyVal) || 1;
    if (qty > item.stock_qty) {
        alert(`Insufficient stock. Maximum available: ${item.stock_qty}`);
        item.qty = item.stock_qty;
    } else if (qty < 1) {
        item.qty = 1;
    } else {
        item.qty = qty;
    }
    window.renderPosCart();
};

window.removeFromCart = function (itemCode) {
    // Clean up serials tracking list for this item's associated serials
    const inCart = window.posCart.find(i => i.item_code === itemCode);
    if (inCart && inCart.serials) {
        window.scannedSerialsList = (window.scannedSerialsList || []).filter(s => !inCart.serials.includes(s));
    }
    window.posCart = window.posCart.filter(i => i.item_code !== itemCode);
    window.renderPosCart();
};

window.resetPosCart = function () {
    window.posCart = [];
    window.scannedSerialsList = [];
    const clientInput = document.getElementById('pos-client-search');
    if (clientInput) clientInput.value = '';
    const clientIdHidden = document.getElementById('pos-client-id');
    if (clientIdHidden) clientIdHidden.value = '';
    const jobLinkSelect = document.getElementById('pos-link-job');
    if (jobLinkSelect) jobLinkSelect.value = '';
    window.renderPosCart();
};

window.renderPosCart = function () {
    const list = document.getElementById('pos-cart-list');
    if (!list) return;

    list.innerHTML = '';
    if (window.posCart.length === 0) {
        list.innerHTML = `<div class="text-center text-slate-500 py-12 text-xs">Cart is empty. Click items from catalog.</div>`;
        window.calculatePosTotals();
        return;
    }

    window.posCart.forEach((item, idx) => {
        const catDotColors = {
            'Hard Drives': '#fbbf24',
            'Network Cables': '#60a5fa',
            'Security IP Cams': '#f87171',
            'Spare Hardware Parts': '#c084fc',
        };
        const dotColor = catDotColors[item.category] || '#34d399';
        const lineTotal = (item.unit_price * item.qty).toFixed(2);
        list.innerHTML += `
                    <div class="group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all hover:bg-white/3" style="border: 1px solid rgba(255,255,255,0.04);">
                        <div class="w-1 h-7 rounded-full shrink-0" style="background: ${dotColor}; opacity: 0.65;"></div>
                        <div class="flex-1 min-w-0">
                            <p class="text-[10px] font-bold text-white truncate leading-none">${item.item_name}</p>
                            <p class="text-[8px] font-mono mt-0.5" style="color: rgba(255,255,255,0.3);">$${item.unit_price.toFixed(2)} &times; ${item.qty} = <span style="color:${dotColor};" class="font-bold">$${lineTotal}</span></p>
                        </div>
                        <div class="flex items-center gap-0.5 shrink-0">
                            <button onclick="window.updateCartQty('${item.item_code}', ${item.qty - 1})"
                                class="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition font-black text-xs leading-none">âˆ’</button>
                            <input type="number" value="${item.qty}" min="1" max="${item.stock_qty}"
                                onchange="window.updateCartQty('${item.item_code}', this.value)"
                                class="w-8 bg-black/40 border border-white/10 rounded text-center text-white font-mono text-[10px] focus:border-emerald-500/40 focus:outline-none py-0.5">
                            <button onclick="window.updateCartQty('${item.item_code}', ${item.qty + 1})"
                                class="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition font-black text-xs leading-none">+</button>
                        </div>
                        <button onclick="window.removeFromCart('${item.item_code}')"
                            class="w-5 h-5 rounded flex items-center justify-center text-slate-700 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                `;
    });

    window.calculatePosTotals();
};

window.calculatePosTotals = function () {
    const disc = parseFloat(document.getElementById('pos-discount')?.value) || 0;
    const standardRate = parseFloat(document.getElementById('pos-exchange-rate')?.value) || 4500;
    const customRate = parseFloat(document.getElementById('pos-custom-exchange-rate')?.value) || standardRate;
    const payCurrency = document.getElementById('pos-pay-currency')?.value || 'USD';

    // Show/hide custom rate container dynamically
    const customRateContainer = document.getElementById('pos-custom-rate-container');
    if (customRateContainer) {
        if (payCurrency === 'USD_CUSTOM') {
            customRateContainer.classList.remove('hidden');
        } else {
            customRateContainer.classList.add('hidden');
        }
    }

    const activeRate = payCurrency === 'USD_CUSTOM' ? customRate : standardRate;

    let subtotal = 0;
    window.posCart.forEach(item => {
        subtotal += item.unit_price * item.qty;
    });

    const totalUsd = subtotal * (1 - (disc / 100));
    const totalMmk = totalUsd * activeRate;

    const subtotalText = document.getElementById('pos-subtotal');
    if (subtotalText) subtotalText.textContent = `$${subtotal.toFixed(2)} / ${(subtotal * activeRate).toLocaleString()} Ks`;

    const totalUsdText = document.getElementById('pos-total-usd');
    if (totalUsdText) totalUsdText.textContent = `$${totalUsd.toFixed(2)}`;

    const totalMmkText = document.getElementById('pos-total-mmk');
    if (totalMmkText) totalMmkText.textContent = `${totalMmk.toLocaleString()} Ks`;

    // Calculate change due and credit remaining
    const targetTotal = payCurrency === 'MMK' ? totalMmk : totalUsd;
    const activeCurrencyText = payCurrency === 'MMK' ? 'Ks' : '$';

    const paidA = parseFloat(document.getElementById('pos-paid-amount-a')?.value) || 0;
    const paidB = parseFloat(document.getElementById('pos-paid-amount-b')?.value) || 0;
    const totalPaid = paidA + paidB;

    const changeText = document.getElementById('pos-change-due');
    const creditText = document.getElementById('pos-credit-due');

    if (totalPaid >= targetTotal) {
        const change = totalPaid - targetTotal;
        if (changeText) {
            if (payCurrency === 'MMK') {
                changeText.textContent = `${change.toLocaleString()} Ks`;
            } else {
                changeText.textContent = `$${change.toFixed(2)}`;
            }
        }
        if (creditText) creditText.textContent = payCurrency === 'MMK' ? '0 Ks' : '$0.00';
    } else {
        const credit = targetTotal - totalPaid;
        if (changeText) changeText.textContent = payCurrency === 'MMK' ? '0 Ks' : '$0.00';
        if (creditText) {
            if (payCurrency === 'MMK') {
                creditText.textContent = `${credit.toLocaleString()} Ks`;
            } else {
                creditText.textContent = `$${credit.toFixed(2)}`;
            }
        }
    }
};

window.executePosCheckout = async function () {
    const clientInput = document.getElementById('pos-client-search')?.value || '';
    let matchedClient = window.posClients.find(c => c.company_name === clientInput);

    // Auto-create/fallback to Individual client if name matches Individual Walk-in
    if (!matchedClient && (clientInput.toLowerCase().includes('individual') || clientInput.toLowerCase().includes('walk-in'))) {
        matchedClient = { id: 'Individual', company_name: 'Individual Clients / Walk-in', address: 'Myanmar', phone: '' };
    }

    if (!matchedClient) {
        alert("Please select a valid client from the autocomplete lists or use 'Quick Walk-In'.");
        return;
    }

    if (window.posCart.length === 0) {
        alert("Cannot checkout with an empty cart.");
        return;
    }

    const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
    const exchange_rate = parseFloat(document.getElementById('pos-exchange-rate')?.value) || 4500;
    const custom_exchange_rate = parseFloat(document.getElementById('pos-custom-exchange-rate')?.value) || exchange_rate;
    const pay_currency = document.getElementById('pos-pay-currency')?.value || 'USD';

    const activeRate = pay_currency === 'USD_CUSTOM' ? custom_exchange_rate : exchange_rate;
    let subtotal = 0;
    window.posCart.forEach(item => {
        subtotal += item.unit_price * item.qty;
    });
    const totalUsd = subtotal * (1 - (discount / 100));
    const totalMmk = totalUsd * activeRate;
    const targetTotal = pay_currency === 'MMK' ? totalMmk : totalUsd;

    const payment_method_a = document.getElementById('pos-pay-method-a').value;
    const paid_amount_a = parseFloat(document.getElementById('pos-paid-amount-a').value) || 0;
    const payment_method_b = document.getElementById('pos-pay-method-b').value;
    const paid_amount_b = parseFloat(document.getElementById('pos-paid-amount-b').value) || 0;

    const totalPaid = paid_amount_a + paid_amount_b;
    const credit_amount = totalPaid < targetTotal ? (targetTotal - totalPaid) : 0;

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    const payload = {
        client_id: matchedClient.id,
        cart: window.posCart.map(i => ({ item_code: i.item_code, qty: i.qty })),
        discount,
        exchange_rate,
        custom_exchange_rate,
        currency_type: pay_currency,
        payment_method_a,
        paid_amount_a,
        payment_method_b,
        paid_amount_b,
        credit_amount
    };

    try {
        const res = await fetch(`${baseUrl}/api/pos/checkout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (res.ok) {
            alert("POS Checkout completed successfully!");

            // Generate PDF Invoice
            window.printInvoicePdf({
                invoice_id: data.invoice_id,
                client_name: matchedClient.company_name,
                client_address: matchedClient.address || '',
                client_phone: matchedClient.phone || '',
                date: new Date().toLocaleDateString(),
                cart: window.posCart,
                discount,
                exchange_rate: activeRate,
                total_usd: data.total_usd,
                total_mmk: data.total_mmk,
                pay_currency,
                payment_method_a,
                paid_amount_a,
                payment_method_b,
                paid_amount_b,
                credit_amount
            });

            window.resetPosCart();
            window.loadPosData();
        } else {
            alert("Error checking out: " + data.error);
        }
    } catch (err) {
        alert("Communication error: " + err.message);
    }
};

window.printInvoicePdf = function (tx) {
    const { jsPDF } = window.jspdf;

    // Get custom config
    const cfg = window.pdfBuilderConfig || {
        company: "AWESOME MYANMAR",
        subtitle: "POINT OF SALE INVOICE RECEIPT",
        color: "#0f172a",
        accent: "#0ea5e9",
        paper: "a4",
        header_style: "full",
        orientation: "portrait",
        phone: "+95 9 XXX-XXXXXX",
        website: "www.awesomemyanmar.com",
        address: "Yangon, Myanmar",
        logo_url: "",
        banner: "",
        footer: "Thank you for your business!",
        terms: "1. All sales are final.\n2. Returns within 7 days with receipt.",
        show_mmk: true,
        show_sig: true,
        show_payment: true,
        show_tax: false,
        show_terms: true,
        show_address: true,
        show_banner_note: false,
        show_itemcode: true
    };

    const hexToRgb = (hex) => {
        const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
        const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
        return result ? [
            parseInt(result[1], 16),
            parseInt(result[2], 16),
            parseInt(result[3], 16)
        ] : [15, 23, 42];
    };

    const rgb = hexToRgb(cfg.color || "#0f172a");
    const accentRgb = hexToRgb(cfg.accent || "#0ea5e9");
    const isThermal = cfg.paper === 'thermal80';

    let doc;
    let pageWidth, margin, contentWidth;

    if (isThermal) {
        // Thermal 80mm Receipt Mode
        pageWidth = 80;
        margin = 4;
        contentWidth = 72;

        // Dynamically calculate estimated height based on cart items
        const itemLinesCount = tx.cart.length;
        const estimatedHeight = 120 + (itemLinesCount * 9) + (cfg.show_terms ? 25 : 0);

        doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: [80, estimatedHeight]
        });
    } else {
        // standard sizes: A4, A5, Letter
        const size = cfg.paper || 'a4';
        const orient = cfg.orientation || 'portrait';
        doc = new jsPDF({
            orientation: orient,
            unit: 'mm',
            format: size
        });

        const dimensions = doc.internal.pageSize;
        pageWidth = dimensions.width || dimensions.getWidth();
        margin = 15;
        contentWidth = pageWidth - (margin * 2);
    }

    let y = 10;

    // â”€â”€â”€ HEADER BANNER DRAW â”€â”€â”€
    if (isThermal) {
        // Compact text-only receipt header
        doc.setTextColor(rgb[0], rgb[1], rgb[2]);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(cfg.company || "AWESOME MYANMAR", pageWidth / 2, y, { align: 'center' });
        y += 5;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.text(cfg.subtitle || "INVOICE RECEIPT", pageWidth / 2, y, { align: 'center' });
        y += 4;

        if (cfg.show_address && cfg.address) {
            doc.text(cfg.address, pageWidth / 2, y, { align: 'center' });
            y += 3.5;
        }
        if (cfg.phone || cfg.website) {
            const parts = [];
            if (cfg.phone) parts.push(`Tel: ${cfg.phone}`);
            if (cfg.website) parts.push(cfg.website);
            doc.text(parts.join(' | '), pageWidth / 2, y, { align: 'center' });
            y += 4;
        }

        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4.5;

        // Invoice Details
        doc.setFontSize(7);
        doc.text(`INV ID: ${tx.invoice_id || 'pos'}`, margin, y);
        doc.text(`DATE: ${tx.date || new Date().toLocaleDateString()}`, pageWidth - margin - 22, y);
        y += 4;
        doc.text(`RATE: ${tx.exchange_rate} Ks/USD`, margin, y);
        y += 4;
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;
    } else {
        // Standard Paper layout (A4/A5/Letter)
        if (cfg.header_style === 'full') {
            // Full Color Header Background
            doc.setFillColor(rgb[0], rgb[1], rgb[2]);
            doc.rect(0, 0, pageWidth, 42, 'F');
            doc.setTextColor(255, 255, 255);

            doc.setFontSize(22);
            doc.setFont('helvetica', 'bold');
            doc.text(cfg.company || "AWESOME MYANMAR", margin, 18);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(190, 200, 210);
            doc.text(cfg.subtitle || "POINT OF SALE INVOICE RECEIPT", margin, 25);

            let contactStr = [];
            if (cfg.show_address && cfg.address) contactStr.push(cfg.address);
            if (cfg.phone) contactStr.push(`Phone: ${cfg.phone}`);
            if (cfg.website) contactStr.push(cfg.website);

            doc.setFontSize(7.5);
            doc.setTextColor(170, 185, 200);
            doc.text(contactStr.join('  |  '), margin, 31);

            // Invoice right details
            doc.setFontSize(9);
            doc.setTextColor(255, 255, 255);
            doc.text(`INVOICE: ${tx.invoice_id || 'N/A'}`, pageWidth - margin - 48, 16);
            doc.text(`DATE: ${tx.date || new Date().toLocaleDateString()}`, pageWidth - margin - 48, 22);
            doc.text(`RATE: ${tx.exchange_rate} Ks/USD`, pageWidth - margin - 48, 28);

            y = 52;
        } else {
            // Minimalist or slim styles
            doc.setTextColor(rgb[0], rgb[1], rgb[2]);
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text(cfg.company || "AWESOME MYANMAR", margin, 20);

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 110, 120);
            doc.text(cfg.subtitle || "POINT OF SALE INVOICE RECEIPT", margin, 26);

            let contactStr = [];
            if (cfg.show_address && cfg.address) contactStr.push(cfg.address);
            if (cfg.phone) contactStr.push(`Phone: ${cfg.phone}`);
            if (cfg.website) contactStr.push(cfg.website);

            doc.setFontSize(7.5);
            doc.text(contactStr.join('  |  '), margin, 31);

            doc.setTextColor(50, 60, 70);
            doc.text(`INVOICE: ${tx.invoice_id || 'N/A'}`, pageWidth - margin - 48, 20);
            doc.text(`DATE: ${tx.date || new Date().toLocaleDateString()}`, pageWidth - margin - 48, 25);
            doc.text(`RATE: ${tx.exchange_rate} Ks/USD`, pageWidth - margin - 48, 30);

            doc.setDrawColor(accentRgb[0], accentRgb[1], accentRgb[2]);
            doc.setLineWidth(0.6);
            doc.line(margin, 35, pageWidth - margin, 35);

            y = 47;
        }
    }

    // â”€â”€â”€ BILL TO â”€â”€â”€
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThermal ? 7.5 : 9.5);
    doc.text("BILL TO:", margin, y);
    y += (isThermal ? 3.5 : 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(isThermal ? 8 : 10);
    doc.text(tx.client_name, margin, y);
    y += (isThermal ? 3.5 : 5);
    if (tx.client_address) {
        doc.text(tx.client_address, margin, y);
        y += (isThermal ? 3.5 : 5);
    }
    if (tx.client_phone) {
        doc.text(tx.client_phone, margin, y);
        y += (isThermal ? 3.5 : 5);
    }

    y += (isThermal ? 2 : 4);

    // â”€â”€â”€ ITEMS TABLE â”€â”€â”€
    doc.setFillColor(accentRgb[0], accentRgb[1], accentRgb[2]);
    doc.rect(margin, y, contentWidth, isThermal ? 6 : 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(isThermal ? 6.5 : 8);
    doc.setFont('helvetica', 'bold');

    const colItemX = margin + 1;
    const colSkuX = margin + (isThermal ? 25 : 65);
    const colQtyX = margin + (isThermal ? 42 : 110);
    const colPriceX = margin + (isThermal ? 53 : 138);
    const colTotalX = margin + (isThermal ? 64 : 165);

    doc.text("ITEM", colItemX, y + (isThermal ? 4 : 5));
    if (cfg.show_itemcode) {
        doc.text("SKU", colSkuX, y + (isThermal ? 4 : 5));
    }
    doc.text("QTY", colQtyX, y + (isThermal ? 4 : 5));
    doc.text("PRICE", colPriceX, y + (isThermal ? 4 : 5));
    doc.text("TOTAL", colTotalX, y + (isThermal ? 4 : 5));

    y += (isThermal ? 6 : 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 40, 50);
    doc.setFontSize(isThermal ? 6 : 8);

    tx.cart.forEach(item => {
        // Shorten item name for thermal print space
        let displayName = item.item_name;
        if (isThermal && displayName.length > 18) {
            displayName = displayName.substring(0, 16) + '..';
        } else if (!isThermal && displayName.length > 34) {
            displayName = displayName.substring(0, 32) + '..';
        }

        doc.text(displayName, colItemX, y + (isThermal ? 4 : 5));
        if (cfg.show_itemcode) {
            doc.text(item.item_code || '-', colSkuX, y + (isThermal ? 4 : 5));
        }
        doc.text(item.qty.toString(), colQtyX, y + (isThermal ? 4 : 5));
        doc.text(`$${item.unit_price.toFixed(2)}`, colPriceX, y + (isThermal ? 4 : 5));
        doc.text(`$${(item.unit_price * item.qty).toFixed(2)}`, colTotalX, y + (isThermal ? 4 : 5));

        doc.setDrawColor(240, 240, 240);
        doc.setLineWidth(0.2);
        doc.line(margin, y + (isThermal ? 5.5 : 7.5), pageWidth - margin, y + (isThermal ? 5.5 : 7.5));
        y += (isThermal ? 6 : 8);
    });

    // â”€â”€â”€ TOTALS SECTION â”€â”€â”€
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pageWidth - margin, y);
    y += (isThermal ? 4 : 5);

    doc.setFontSize(isThermal ? 6.5 : 8.5);
    doc.text(`Discount: ${tx.discount}%`, colPriceX - 10, y);
    y += (isThermal ? 3.5 : 5);

    // Tax
    if (cfg.show_tax) {
        const taxAmount = tx.total_usd * 0.05;
        doc.text(`Tax (5%): $${taxAmount.toFixed(2)}`, colPriceX - 10, y);
        y += (isThermal ? 3.5 : 5);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(isThermal ? 7.5 : 10);
    doc.text(`TOTAL USD: $${tx.total_usd.toFixed(2)}`, colPriceX - 10, y);

    if (cfg.show_mmk) {
        y += (isThermal ? 4 : 5);
        doc.text(`TOTAL MMK: ${tx.total_mmk.toLocaleString()} Ks`, colPriceX - 10, y);
    }

    doc.setFont('helvetica', 'normal');

    // â”€â”€â”€ PAYMENT DETAILS â”€â”€â”€
    if (cfg.show_payment) {
        y += (isThermal ? 6 : 8);
        doc.setFontSize(isThermal ? 6 : 8);
        doc.setTextColor(80, 90, 100);
        doc.text("PAYMENT SUMMARY:", margin, y);

        const activeCurrencySymbol = tx.pay_currency === 'MMK' ? ' Ks' : ' USD';
        y += (isThermal ? 3.5 : 4.5);
        doc.text(`- Method A: ${tx.payment_method_a || 'N/A'} - Paid: ${tx.paid_amount_a || 0}${activeCurrencySymbol}`, margin, y);
        y += (isThermal ? 3.5 : 4.5);
        doc.text(`- Method B: ${tx.payment_method_b || 'N/A'} - Paid: ${tx.paid_amount_b || 0}${activeCurrencySymbol}`, margin, y);

        if (tx.credit_amount > 0) {
            y += (isThermal ? 3.5 : 4.5);
            doc.setTextColor(220, 30, 70);
            doc.setFont('helvetica', 'bold');
            doc.text(`- Credit Balance (Pay Later): ${tx.credit_amount}${activeCurrencySymbol}`, margin, y);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(80, 90, 100);
        }
    }

    // â”€â”€â”€ TERMS AND CONDITIONS â”€â”€â”€
    if (cfg.show_terms && cfg.terms) {
        y += (isThermal ? 6 : 8);
        doc.setFontSize(isThermal ? 5.5 : 7.5);
        doc.setFont('helvetica', 'bold');
        doc.text("TERMS & CONDITIONS", margin, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isThermal ? 5 : 7);

        cfg.terms.split('\n').forEach(line => {
            if (line.trim()) {
                y += (isThermal ? 3 : 4);
                doc.text(line, margin, y);
            }
        });
    }

    // â”€â”€â”€ SIGNATURE BLOCK â”€â”€â”€
    if (cfg.show_sig) {
        y += (isThermal ? 10 : 15);
        doc.setDrawColor(200, 200, 200);
        const sigWidth = isThermal ? 35 : 55;
        const sigX = pageWidth - margin - sigWidth;
        doc.line(sigX, y, pageWidth - margin, y);
        y += (isThermal ? 3 : 4);
        doc.setFontSize(isThermal ? 5 : 7);
        doc.setTextColor(150, 160, 170);
        doc.text("AUTHORIZED SIGNATURE", sigX + (isThermal ? 4 : 10), y);
    }

    // â”€â”€â”€ FOOTER TEXT â”€â”€â”€
    y += (isThermal ? 8 : 10);
    doc.setFontSize(isThermal ? 6 : 8);
    doc.setTextColor(100, 110, 120);
    doc.text(cfg.footer || "Thank you for your business!", margin, y);

    doc.save(`invoice_${tx.invoice_id || 'pos'}.pdf`);

    // Automatically backup to Google Drive
    try {
        const pdfBase64 = doc.output('datauristring').split(',')[1];
        const baseUrl = document.getElementById('api-base').value;
        const token = localStorage.getItem('admin_token');

        fetch(`${baseUrl}/api/pos/save-invoice-drive`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({
                invoice_id: tx.invoice_id || 'pos',
                client_name: tx.client_name || 'Walk-in Customer',
                pdf_base64: pdfBase64
            })
        }).then(async r => {
            const data = await r.json();
            if (r.ok) {
                console.log("Invoice backup saved to Google Drive:", data.file_id);
            } else {
                console.error("Google Drive upload error:", data.error);
            }
        }).catch(err => {
            console.error("Failed to fetch Google Drive upload API:", err.message);
        });
    } catch (driveErr) {
        console.error("Error preparing Google Drive upload:", driveErr.message);
    }
};

window.loadPosSalesHistory = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');
    const tbody = document.getElementById('pos-sales-body');
    if (!tbody) return;

    try {
        const res = await fetch(`${baseUrl}/api/pos/sales`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Server error");
        const sales = await res.json();

        tbody.innerHTML = '';
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="py-4 text-center text-slate-600">No POS transactions booked yet.</td></tr>';
            return;
        }

        sales.forEach(tx => {
            tbody.innerHTML += `
                        <tr class="border-b border-white/5 hover:bg-white/5 transition-all align-middle text-slate-300">
                            <td class="py-2.5 font-mono text-[10px] text-slate-500">${new Date(tx.created_at).toLocaleString()}</td>
                            <td class="py-2.5 font-bold truncate max-w-[200px]">${tx.notes}</td>
                            <td class="py-2.5 font-bold font-mono text-indigo-400">${tx.primary_currency}</td>
                            <td class="py-2.5 font-mono text-emerald-400 font-bold">${tx.amount.toFixed(2)}</td>
                            <td class="py-2.5 font-mono font-semibold">${tx.exchange_rate} Ks</td>
                            <td class="py-2.5 text-right">
                                <button onclick="window.reprintInvoicePdf('${tx.id}', '${tx.notes.replace(/'/g, "\\'")}', ${tx.amount}, '${tx.primary_currency}', ${tx.exchange_rate})" class="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] px-2.5 py-1 rounded-lg">Reprint</button>
                            </td>
                        </tr>
                    `;
        });
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-rose-400">Failed to load sales: ${err.message}</td></tr>`;
    }
};

window.reprintInvoicePdf = function (id, notes, amount, currency, rate) {
    // Re-compile invoice dynamically from transaction logs
    const parsedNotes = notes.split('|');
    const clientPart = parsedNotes[0] ? parsedNotes[0].replace('[POS CHECKOUT] Client:', '').trim() : 'Walk-in Client';
    const itemsPart = parsedNotes[1] ? parsedNotes[1].replace('Items:', '').trim() : '';

    const cartItems = itemsPart.split(',').map(part => {
        const match = part.trim().match(/(.+) \(x(\d+)\)/);
        if (match) {
            return {
                item_name: match[1],
                qty: parseInt(match[2]),
                unit_price: currency === 'USD' ? (amount / parseInt(match[2])) : ((amount / rate) / parseInt(match[2]))
            };
        }
        return { item_name: part.trim(), qty: 1, unit_price: currency === 'USD' ? amount : (amount / rate) };
    });

    window.printInvoicePdf({
        invoice_id: "INV-" + id,
        client_name: clientPart,
        date: new Date().toLocaleDateString(),
        cart: cartItems,
        discount: 0,
        exchange_rate: rate,
        total_usd: currency === 'USD' ? amount : (amount / rate),
        total_mmk: currency === 'MMK' ? amount : (amount * rate),
        pay_currency: currency,
        paid_amount: amount
    });
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸŽ¨ RECEIPT PDF DESIGN BUILDER FUNCTIONS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.pdfBuilderConfig = {
    company: "AWESOME MYANMAR",
    subtitle: "POINT OF SALE INVOICE RECEIPT",
    color: "#0f172a",
    accent: "#0ea5e9",
    paper: "a4",
    header_style: "full",
    orientation: "portrait",
    phone: "+95 9 XXX-XXXXXX",
    website: "www.awesomemyanmar.com",
    address: "Yangon, Myanmar",
    logo_url: "",
    banner: "",
    footer: "Thank you for your business!",
    terms: "1. All sales are final.\n2. Returns within 7 days with receipt.",
    show_mmk: true,
    show_sig: true,
    show_payment: true,
    show_tax: false,
    show_terms: true,
    show_address: true,
    show_banner_note: false,
    show_itemcode: true
};

window.updatePdfPreview = function () {
    // Read inputs
    const company = document.getElementById('pdf-cfg-company')?.value || "AWESOME MYANMAR";
    const subtitle = document.getElementById('pdf-cfg-subtitle')?.value || "POINT OF SALE INVOICE RECEIPT";
    const color = document.getElementById('pdf-cfg-color')?.value || "#0f172a";
    const accent = document.getElementById('pdf-cfg-accent')?.value || "#0ea5e9";
    const paper = document.getElementById('pdf-cfg-paper')?.value || "a4";
    const header_style = document.getElementById('pdf-cfg-header-style')?.value || "full";
    const orientation = document.getElementById('pdf-cfg-orientation')?.value || "portrait";
    const phone = document.getElementById('pdf-cfg-phone')?.value || "";
    const website = document.getElementById('pdf-cfg-website')?.value || "";
    const address = document.getElementById('pdf-cfg-address')?.value || "";
    const logo_url = document.getElementById('pdf-cfg-logo-url')?.value || "";
    const banner = document.getElementById('pdf-cfg-banner')?.value || "";
    const footer = document.getElementById('pdf-cfg-footer')?.value || "Thank you for your business!";
    const terms = document.getElementById('pdf-cfg-terms')?.value || "";

    const show_mmk = document.getElementById('pdf-cfg-show-mmk')?.checked;
    const show_sig = document.getElementById('pdf-cfg-show-sig')?.checked;
    const show_payment = document.getElementById('pdf-cfg-show-payment')?.checked;
    const show_tax = document.getElementById('pdf-cfg-show-tax')?.checked;
    const show_terms = document.getElementById('pdf-cfg-show-terms')?.checked;
    const show_address = document.getElementById('pdf-cfg-show-address')?.checked;
    const show_banner_note = document.getElementById('pdf-cfg-show-banner-note')?.checked;
    const show_itemcode = document.getElementById('pdf-cfg-show-itemcode')?.checked;

    // Sync color hex displays
    if (document.getElementById('pdf-cfg-color-hex')) document.getElementById('pdf-cfg-color-hex').value = color;
    if (document.getElementById('pdf-cfg-accent-hex')) document.getElementById('pdf-cfg-accent-hex').value = accent;

    // Sync Paper Size Badge in UI
    const sizeBadge = document.getElementById('pdf-preview-size-badge');
    if (sizeBadge) sizeBadge.textContent = `${paper} (${orientation === 'portrait' ? 'Port' : 'Land'})`;

    // Live Preview: Header Box styling
    const prevHeader = document.getElementById('prev-pdf-header');
    if (prevHeader) {
        prevHeader.style.backgroundColor = color;
        if (header_style === 'minimal') {
            prevHeader.style.backgroundColor = 'transparent';
            prevHeader.style.color = '#0f172a';
            prevHeader.style.borderBottom = `2px solid ${accent}`;
        } else if (header_style === 'classic') {
            prevHeader.style.backgroundColor = '#f8fafc';
            prevHeader.style.color = '#0f172a';
            prevHeader.style.border = `1px solid ${accent}`;
        } else {
            prevHeader.style.color = '#ffffff';
            prevHeader.style.border = 'none';
        }
    }

    const prevTitle = document.getElementById('prev-pdf-title');
    if (prevTitle) {
        prevTitle.textContent = company;
        if (header_style === 'minimal' || header_style === 'classic') {
            prevTitle.style.color = color;
        } else {
            prevTitle.style.color = '#ffffff';
        }
    }

    const prevSubtitle = document.getElementById('prev-pdf-subtitle');
    if (prevSubtitle) prevSubtitle.textContent = subtitle;

    // Contact Block
    const prevAddress = document.getElementById('prev-pdf-address-line');
    if (prevAddress) {
        prevAddress.textContent = address;
        if (show_address && address) prevAddress.classList.remove('hidden');
        else prevAddress.classList.add('hidden');
    }
    const prevPhone = document.getElementById('prev-pdf-phone-line');
    if (prevPhone) prevPhone.textContent = phone ? `Tel: ${phone}` : '';
    const prevWebsite = document.getElementById('prev-pdf-website-line');
    if (prevWebsite) prevWebsite.textContent = website;

    // Banner Note
    const prevBanner = document.getElementById('prev-pdf-banner-note');
    if (prevBanner) {
        if (show_banner_note && banner) {
            prevBanner.classList.remove('hidden');
            prevBanner.querySelector('span').textContent = banner;
        } else {
            prevBanner.classList.add('hidden');
        }
    }

    // Table Accent
    const prevTableHeader = document.getElementById('prev-pdf-table-header');
    if (prevTableHeader) prevTableHeader.style.backgroundColor = accent;

    // Item SKU column toggle
    const skuCol = document.getElementById('prev-pdf-sku-col');
    const skuVal = document.getElementById('prev-pdf-sku-val');
    if (skuCol) {
        if (show_itemcode) skuCol.classList.remove('hidden');
        else skuCol.classList.add('hidden');
    }
    if (skuVal) {
        if (show_itemcode) skuVal.classList.remove('hidden');
        else skuVal.classList.add('hidden');
    }

    // MMK equivalent toggle
    const prevMmk = document.getElementById('prev-pdf-total-mmk');
    if (prevMmk) {
        if (show_mmk) prevMmk.classList.remove('hidden');
        else prevMmk.classList.add('hidden');
    }

    // Tax Line toggle
    const prevTax = document.getElementById('prev-pdf-tax-line');
    if (prevTax) {
        if (show_tax) prevTax.classList.remove('hidden');
        else prevTax.classList.add('hidden');
    }

    // Payment method detail block
    const prevPayment = document.getElementById('prev-pdf-payment-detail');
    if (prevPayment) {
        if (show_payment) prevPayment.classList.remove('hidden');
        else prevPayment.classList.add('hidden');
    }

    // Terms Block
    const prevTerms = document.getElementById('prev-pdf-terms-block');
    if (prevTerms) {
        if (show_terms && terms) {
            prevTerms.classList.remove('hidden');
            let listHtml = `<p class="font-black text-slate-500 uppercase tracking-wider mb-0.5" style="font-size:3.5px;">Terms & Conditions</p>`;
            terms.split('\n').forEach(t => {
                if (t.trim()) listHtml += `<p>${escapeHTML(t)}</p>`;
            });
            prevTerms.innerHTML = listHtml;
        } else {
            prevTerms.classList.add('hidden');
        }
    }

    // Signature Line
    const prevSig = document.getElementById('prev-pdf-sig-block');
    if (prevSig) {
        if (show_sig) prevSig.classList.remove('hidden');
        else prevSig.classList.add('hidden');
    }

    const prevFooter = document.getElementById('prev-pdf-footer');
    if (prevFooter) prevFooter.textContent = footer;
};

window.savePdfBuilderConfig = async function () {
    const company = document.getElementById('pdf-cfg-company')?.value || "AWESOME MYANMAR";
    const subtitle = document.getElementById('pdf-cfg-subtitle')?.value || "POINT OF SALE INVOICE RECEIPT";
    const color = document.getElementById('pdf-cfg-color')?.value || "#0f172a";
    const accent = document.getElementById('pdf-cfg-accent')?.value || "#0ea5e9";
    const paper = document.getElementById('pdf-cfg-paper')?.value || "a4";
    const header_style = document.getElementById('pdf-cfg-header-style')?.value || "full";
    const orientation = document.getElementById('pdf-cfg-orientation')?.value || "portrait";
    const phone = document.getElementById('pdf-cfg-phone')?.value || "";
    const website = document.getElementById('pdf-cfg-website')?.value || "";
    const address = document.getElementById('pdf-cfg-address')?.value || "";
    const logo_url = document.getElementById('pdf-cfg-logo-url')?.value || "";
    const banner = document.getElementById('pdf-cfg-banner')?.value || "";
    const footer = document.getElementById('pdf-cfg-footer')?.value || "Thank you for your business!";
    const terms = document.getElementById('pdf-cfg-terms')?.value || "";

    const show_mmk = document.getElementById('pdf-cfg-show-mmk')?.checked;
    const show_sig = document.getElementById('pdf-cfg-show-sig')?.checked;
    const show_payment = document.getElementById('pdf-cfg-show-payment')?.checked;
    const show_tax = document.getElementById('pdf-cfg-show-tax')?.checked;
    const show_terms = document.getElementById('pdf-cfg-show-terms')?.checked;
    const show_address = document.getElementById('pdf-cfg-show-address')?.checked;
    const show_banner_note = document.getElementById('pdf-cfg-show-banner-note')?.checked;
    const show_itemcode = document.getElementById('pdf-cfg-show-itemcode')?.checked;

    const config = {
        company, subtitle, color, accent, paper, header_style, orientation,
        phone, website, address, logo_url, banner, footer, terms,
        show_mmk, show_sig, show_payment, show_tax, show_terms, show_address, show_banner_note, show_itemcode
    };

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/config/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ key: 'pdf_builder_config', value: JSON.stringify(config) })
        });
        const data = res.ok ? await res.json() : null;
        if (res.ok) {
            alert("Receipt PDF template layout configuration saved!");
            window.pdfBuilderConfig = config;
        } else {
            alert("Error saving: " + (data ? data.error : "Unknown error"));
        }
    } catch (e) {
        alert("Failed to store builder settings: " + e.message);
    }
};

window.loadPdfBuilderConfig = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/config?key=pdf_builder_config`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.value) {
                const config = JSON.parse(data.value);
                window.pdfBuilderConfig = config;

                // Prepopulate form fields
                if (document.getElementById('pdf-cfg-company')) document.getElementById('pdf-cfg-company').value = config.company || "";
                if (document.getElementById('pdf-cfg-subtitle')) document.getElementById('pdf-cfg-subtitle').value = config.subtitle || "";
                if (document.getElementById('pdf-cfg-color')) document.getElementById('pdf-cfg-color').value = config.color || "#0f172a";
                if (document.getElementById('pdf-cfg-accent')) document.getElementById('pdf-cfg-accent').value = config.accent || "#0ea5e9";
                if (document.getElementById('pdf-cfg-paper')) document.getElementById('pdf-cfg-paper').value = config.paper || "a4";
                if (document.getElementById('pdf-cfg-header-style')) document.getElementById('pdf-cfg-header-style').value = config.header_style || "full";
                if (document.getElementById('pdf-cfg-orientation')) document.getElementById('pdf-cfg-orientation').value = config.orientation || "portrait";
                if (document.getElementById('pdf-cfg-phone')) document.getElementById('pdf-cfg-phone').value = config.phone || "";
                if (document.getElementById('pdf-cfg-website')) document.getElementById('pdf-cfg-website').value = config.website || "";
                if (document.getElementById('pdf-cfg-address')) document.getElementById('pdf-cfg-address').value = config.address || "";
                if (document.getElementById('pdf-cfg-logo-url')) document.getElementById('pdf-cfg-logo-url').value = config.logo_url || "";
                if (document.getElementById('pdf-cfg-banner')) document.getElementById('pdf-cfg-banner').value = config.banner || "";
                if (document.getElementById('pdf-cfg-footer')) document.getElementById('pdf-cfg-footer').value = config.footer || "";
                if (document.getElementById('pdf-cfg-terms')) document.getElementById('pdf-cfg-terms').value = config.terms || "";

                if (document.getElementById('pdf-cfg-show-mmk')) document.getElementById('pdf-cfg-show-mmk').checked = config.show_mmk !== false;
                if (document.getElementById('pdf-cfg-show-sig')) document.getElementById('pdf-cfg-show-sig').checked = config.show_sig !== false;
                if (document.getElementById('pdf-cfg-show-payment')) document.getElementById('pdf-cfg-show-payment').checked = config.show_payment !== false;
                if (document.getElementById('pdf-cfg-show-tax')) document.getElementById('pdf-cfg-show-tax').checked = !!config.show_tax;
                if (document.getElementById('pdf-cfg-show-terms')) document.getElementById('pdf-cfg-show-terms').checked = config.show_terms !== false;
                if (document.getElementById('pdf-cfg-show-address')) document.getElementById('pdf-cfg-show-address').checked = config.show_address !== false;
                if (document.getElementById('pdf-cfg-show-banner-note')) document.getElementById('pdf-cfg-show-banner-note').checked = !!config.show_banner_note;
                if (document.getElementById('pdf-cfg-show-itemcode')) document.getElementById('pdf-cfg-show-itemcode').checked = config.show_itemcode !== false;

                window.updatePdfPreview();
            }
        }
    } catch (e) {
        console.error("Failed to load PDF builder configuration:", e);
    }
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ðŸ›¡ï¸ ROLE-BASED ACCESS CONTROL (RBAC) CONTROLLER
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.globalRolesList = [];
window.rbacActiveRole = null;

const rbacModules = [
    { id: 'clients', name: 'Client Management' },
    { id: 'technicians', name: 'User & Role Management' },
    { id: 'jobs', name: 'Job Tickets Management' },
    { id: 'service_fees', name: 'Service Fee Matrix' },
    { id: 'cash_safe', name: 'Cash Safe & Vault Transactions' },
    { id: 'pos', name: 'Point of Sale (POS) System' },
    { id: 'inventory', name: 'Stock & Batches Inventory' },
    { id: 'pdf_builder', name: 'Invoice Receipt PDF Builder' }
];

window.loadRbacSettings = async function () {
    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/roles/list`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
            window.globalRolesList = await res.json();

            // Populate role selection elements in creation/edit forms
            const newRoleSel = document.getElementById('new-user-role');
            const editRoleSel = document.getElementById('edit-tech-role');
            const filterRoleSel = document.getElementById('user-filter-role');

            if (newRoleSel) {
                newRoleSel.innerHTML = window.globalRolesList.map(r => `<option value="${r.name}" class="bg-slate-900">${r.name}</option>`).join('');
            }
            if (editRoleSel) {
                editRoleSel.innerHTML = window.globalRolesList.map(r => `<option value="${r.name}" class="bg-slate-900">${r.name}</option>`).join('');
            }
            if (filterRoleSel) {
                const currentVal = filterRoleSel.value;
                filterRoleSel.innerHTML = '<option value="All">All Roles</option>' + window.globalRolesList.map(r => `<option value="${r.name}">${r.name}</option>`).join('');
                filterRoleSel.value = currentVal;
            }

            // Render Roles list on the left side of Roles Tab
            const rolesListDiv = document.getElementById('rbac-roles-list');
            if (rolesListDiv) {
                rolesListDiv.innerHTML = window.globalRolesList.map(r => {
                    const activeClass = window.rbacActiveRole && window.rbacActiveRole.name === r.name
                        ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white';
                    return `
                                <button onclick="selectRbacRole('${r.name}')" class="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeClass}">
                                    ðŸ”‘ ${r.name}
                                </button>
                            `;
                }).join('');
            }

            // Load active role details
            if (window.rbacActiveRole) {
                const matched = window.globalRolesList.find(r => r.name === window.rbacActiveRole.name);
                if (matched) {
                    window.rbacActiveRole = matched;
                }
            } else if (window.globalRolesList.length > 0) {
                window.rbacActiveRole = window.globalRolesList[0];
            }

            window.renderRbacMatrix();
        }
    } catch (err) {
        console.error("Failed to load RBAC configurations:", err);
    }
};

window.selectRbacRole = function (roleName) {
    const matched = (window.globalRolesList || []).find(r => r.name === roleName);
    if (matched) {
        window.rbacActiveRole = matched;
        // Re-render sidebar active button class
        window.loadRbacSettings();
    }
};

window.renderRbacMatrix = function () {
    const matrixBody = document.getElementById('rbac-matrix-body');
    const titleEl = document.getElementById('rbac-active-role-title');
    const btnDel = document.getElementById('btn-delete-active-role');

    if (!matrixBody || !window.rbacActiveRole) return;

    titleEl.textContent = `Role: ${window.rbacActiveRole.name}`;

    // Show delete button for custom roles only (cannot delete default system roles)
    if (window.rbacActiveRole.name === "Admin" || window.rbacActiveRole.name === "Sales" || window.rbacActiveRole.name === "Technician") {
        btnDel.classList.add('hidden');
    } else {
        btnDel.classList.remove('hidden');
    }

    let permissions = {};
    try {
        permissions = JSON.parse(window.rbacActiveRole.permissions || '{}');
    } catch (e) { }

    matrixBody.innerHTML = '';

    rbacModules.forEach(mod => {
        const currentAccess = permissions[mod.id] || 'none';

        const isWriteChecked = currentAccess === 'write' ? 'checked' : '';
        const isReadChecked = currentAccess === 'read' ? 'checked' : '';
        const isNoneChecked = currentAccess === 'none' ? 'checked' : '';

        // Default Admin role is locked to full write access
        const disabledAttr = window.rbacActiveRole.name === "Admin" ? 'disabled' : '';

        matrixBody.innerHTML += `
                    <tr class="border-b border-white/5 hover:bg-white/5 transition align-middle">
                        <td class="py-3 px-3 font-semibold text-slate-200">${mod.name} <span class="text-[9px] text-slate-500 font-mono">(${mod.id})</span></td>
                        <td class="py-3 px-3 text-center">
                            <label class="inline-flex items-center cursor-pointer">
                                <input type="radio" name="perm-${mod.id}" value="write" ${isWriteChecked} ${disabledAttr} class="rounded-full bg-black/40 border-white/10 text-emerald-500 focus:ring-0">
                                <span class="text-[10px] text-emerald-400 ml-1.5 font-bold">Write ðŸŸ¢</span>
                            </label>
                        </td>
                        <td class="py-3 px-3 text-center">
                            <label class="inline-flex items-center cursor-pointer">
                                <input type="radio" name="perm-${mod.id}" value="read" ${isReadChecked} ${disabledAttr} class="rounded-full bg-black/40 border-white/10 text-amber-500 focus:ring-0">
                                <span class="text-[10px] text-amber-400 ml-1.5 font-bold">Read ðŸŸ¡</span>
                            </label>
                        </td>
                        <td class="py-3 px-3 text-center">
                            <label class="inline-flex items-center cursor-pointer">
                                <input type="radio" name="perm-${mod.id}" value="none" ${isNoneChecked} ${disabledAttr} class="rounded-full bg-black/40 border-white/10 text-rose-500 focus:ring-0">
                                <span class="text-[10px] text-rose-400 ml-1.5 font-bold">None ðŸ”´</span>
                            </label>
                        </td>
                    </tr>
                `;
    });
};

window.saveRbacPermissions = async function () {
    if (!window.rbacActiveRole) return;
    if (window.rbacActiveRole.name === "Admin") {
        alert("The default Admin role has full write access by system rules and cannot be edited.");
        return;
    }

    const permissions = {};
    rbacModules.forEach(mod => {
        const radios = document.getElementsByName(`perm-${mod.id}`);
        let val = 'none';
        for (const r of radios) {
            if (r.checked) {
                val = r.value;
                break;
            }
        }
        permissions[mod.id] = val;
    });

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/roles/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: window.rbacActiveRole.name, permissions })
        });
        if (res.ok) {
            alert(`Access permissions for role "${window.rbacActiveRole.name}" updated successfully.`);
            window.loadRbacSettings();
        } else {
            const data = await res.json();
            alert("Failed to save: " + data.error);
        }
    } catch (e) {
        alert("Request error: " + e.message);
    }
};

window.createNewRbacRole = async function () {
    const nameField = document.getElementById('new-role-name');
    const name = nameField ? nameField.value.trim() : '';
    if (!name) {
        alert("Please enter a role name.");
        return;
    }

    // Default all modules to none for a new role
    const permissions = {};
    rbacModules.forEach(mod => { permissions[mod.id] = 'none'; });

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/roles/save`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name, permissions })
        });
        if (res.ok) {
            alert(`Role "${name}" created successfully. You can now configure its permissions.`);
            if (nameField) nameField.value = '';
            window.rbacActiveRole = { name, permissions: JSON.stringify(permissions) };
            window.loadRbacSettings();
        } else {
            const data = await res.json();
            alert("Failed to create role: " + data.error);
        }
    } catch (e) {
        alert("Request failed: " + e.message);
    }
};

window.deleteActiveRbacRole = async function () {
    if (!window.rbacActiveRole) return;
    const roleName = window.rbacActiveRole.name;
    if (roleName === "Admin" || roleName === "Sales" || roleName === "Technician") {
        alert("System default roles cannot be deleted.");
        return;
    }

    if (!confirm(`Are you sure you want to delete the role "${roleName}"? Any users assigned to this role will lose their custom permissions.`)) {
        return;
    }

    const baseUrl = document.getElementById('api-base').value;
    const token = localStorage.getItem('admin_token');

    try {
        const res = await fetch(`${baseUrl}/api/admin/roles/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ name: roleName })
        });
        if (res.ok) {
            alert(`Role "${roleName}" deleted successfully.`);
            window.rbacActiveRole = null;
            window.loadRbacSettings();
        } else {
            const data = await res.json();
            alert("Failed to delete role: " + data.error);
        }
    } catch (e) {
        alert("Request failed: " + e.message);
    }
};

// â”€â”€ Generic Excel Column Filters Utility â”€â”€
window.initExcelTableFilters = function (tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const thead = table.querySelector('thead');
    if (!thead) return;
    const headers = thead.querySelectorAll('th');
    
    if (!table.activeExcelFilters) {
        table.activeExcelFilters = {};
    }
    
    headers.forEach((th, colIndex) => {
        const text = th.textContent.trim();
        if (!text || text.toLowerCase() === 'action' || text.toLowerCase() === 'actions') return;
        
        if (getComputedStyle(th).position === 'static') {
            th.style.position = 'relative';
        }
        
        if (th.querySelector('.excel-filter-btn')) return;
        
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'excel-filter-btn ml-1.5 inline-flex items-center text-slate-500 hover:text-amber-500 focus:outline-none transition-all';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `
            <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clip-rule="evenodd" />
            </svg>
        `;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            openExcelFilterPopover(tableId, colIndex, th, btn);
        });
        
        th.appendChild(btn);
    });
};

function openExcelFilterPopover(tableId, colIndex, th, btn) {
    let popover = document.getElementById('excel-filter-popover');
    if (popover) popover.remove();
    
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr:not([id^="serials-row"]):not(.empty-state-row)'));
    
    const values = new Set();
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[colIndex]) {
            values.add(cells[colIndex].textContent.trim());
        }
    });
    
    const sortedValues = Array.from(values).sort((a, b) => a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'}));
    
    popover = document.createElement('div');
    popover.id = 'excel-filter-popover';
    popover.className = 'fixed z-50 w-56 rounded-xl border border-white/10 p-3 shadow-2xl space-y-2 text-left';
    popover.style.background = 'linear-gradient(135deg, rgba(20, 20, 28, 0.98) 0%, rgba(12, 12, 18, 0.98) 100%)';
    popover.style.backdropFilter = 'blur(16px)';
    
    const headerTitle = th.textContent.replace(/[â–¼â–²\s]/g, '').trim();
    
    let itemsHtml = sortedValues.map(val => {
        const isChecked = !table.activeExcelFilters[colIndex] || table.activeExcelFilters[colIndex].has(val);
        return `
            <label class="flex items-center gap-2 px-1 py-1 hover:bg-white/5 rounded cursor-pointer text-[11px] text-slate-300">
                <input type="checkbox" value="${window.escapeHTML(val)}" ${isChecked ? 'checked' : ''} class="excel-filter-checkbox rounded border-white/10 bg-black/40 text-amber-500 focus:ring-0 focus:ring-offset-0">
                <span class="truncate">${window.escapeHTML(val)}</span>
            </label>
        `;
    }).join('');
    
    popover.innerHTML = `
        <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Filter: ${window.escapeHTML(headerTitle)}</div>
        <input type="text" placeholder="Search..." class="popover-search-input w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-amber-500/50">
        <div class="flex justify-between text-[9px] font-semibold text-amber-500/80 px-0.5">
            <button type="button" class="btn-select-all hover:text-amber-400 focus:outline-none">Select All</button>
            <button type="button" class="btn-clear hover:text-amber-400 focus:outline-none">Clear</button>
        </div>
        <div class="popover-list max-h-40 overflow-y-auto space-y-0.5 pr-1">
            ${itemsHtml || '<div class="text-center py-2 text-[10px] text-slate-600">No values</div>'}
        </div>
        <div class="flex gap-2 pt-1.5 border-t border-white/5">
            <button type="button" class="btn-apply flex-1 bg-amber-600 hover:bg-amber-500 py-1 rounded-lg text-[10px] font-bold text-white uppercase tracking-wider transition">OK</button>
            <button type="button" class="btn-cancel flex-1 bg-white/5 hover:bg-white/10 py-1 rounded-lg text-[10px] font-bold text-slate-300 uppercase tracking-wider transition">Cancel</button>
        </div>
    `;
    
    document.body.appendChild(popover);
    
    const rect = btn.getBoundingClientRect();
    const popoverHeight = popover.offsetHeight || 260;
    const spaceBelow = window.innerHeight - rect.bottom;
    
    popover.style.left = `${Math.min(rect.left, window.innerWidth - 240)}px`;
    if (spaceBelow >= popoverHeight) {
        popover.style.top = `${rect.bottom + window.scrollY + 6}px`;
    } else {
        popover.style.top = `${rect.top + window.scrollY - popoverHeight - 6}px`;
    }
    
    const searchInput = popover.querySelector('.popover-search-input');
    const checkboxList = popover.querySelector('.popover-list');
    
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase();
        checkboxList.querySelectorAll('label').forEach(lbl => {
            const txt = lbl.textContent.toLowerCase();
            lbl.style.display = txt.includes(q) ? '' : 'none';
        });
    });
    
    popover.querySelector('.btn-select-all').addEventListener('click', () => {
        checkboxList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    });
    
    popover.querySelector('.btn-clear').addEventListener('click', () => {
        checkboxList.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    });
    
    popover.querySelector('.btn-cancel').addEventListener('click', () => {
        popover.remove();
    });
    
    popover.querySelector('.btn-apply').addEventListener('click', () => {
        const checkedValues = new Set();
        checkboxList.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
            checkedValues.add(cb.value);
        });
        
        const totalCheckboxes = checkboxList.querySelectorAll('input[type="checkbox"]').length;
        if (checkedValues.size === totalCheckboxes) {
            delete table.activeExcelFilters[colIndex];
            btn.classList.remove('text-amber-500');
            btn.classList.add('text-slate-500');
        } else {
            table.activeExcelFilters[colIndex] = checkedValues;
            btn.classList.remove('text-slate-500');
            btn.classList.add('text-amber-500');
        }
        
        if (window.applyExcelFiltersToTable) {
            window.applyExcelFiltersToTable(tableId);
        }
        popover.remove();
    });
    
    function onDocClick(event) {
        if (!popover.contains(event.target) && !btn.contains(event.target)) {
            popover.remove();
            document.removeEventListener('click', onDocClick);
        }
    }
    setTimeout(() => document.addEventListener('click', onDocClick), 0);
}

// â”€â”€ Export complete inventory lists directly from memory â”€â”€
window.exportInventoryToExcel = function (type) {
    loadXLSX(() => {
        let data = [];
        let filename = '';
        
        if (type === 'pricing') {
            filename = 'sales_pricing';
            data = activeCatalogList.map(item => {
                const inStock = activeBatchesList
                    .filter(b => b.item_code === item.item_code)
                    .reduce((sum, b) => {
                        const isSerial = b.serials && b.serials.length > 0;
                        return sum + (isSerial ? b.serials.filter(s => s.status === 'Active').length : (b.remaining_qty || 0));
                    }, 0);
                return {
                    'SKU': item.item_code,
                    'Device Name': item.item_name,
                    'Category': item.category || '',
                    'Brand': item.brand_id || '',
                    'In Stock': inStock,
                    'USD Price': item.unit_price || 0,
                    'MMK Price': item.unit_price_mmk || 0
                };
            });
        } else if (type === 'catalog') {
            filename = 'device_catalog';
            data = activeCatalogList.map(item => {
                const inStock = activeBatchesList
                    .filter(b => b.item_code === item.item_code)
                    .reduce((sum, b) => {
                        const isSerial = b.serials && b.serials.length > 0;
                        return sum + (isSerial ? b.serials.filter(s => s.status === 'Active').length : (b.remaining_qty || 0));
                    }, 0);
                return {
                    'SKU': item.item_code,
                    'Model Name': item.item_name,
                    'Category': item.category || '',
                    'Sub-Cat': item.sub_category_id || '',
                    'Brand': item.brand_id || '',
                    'U/M': item.stocking_um || 'pcs',
                    'Stock Qty': inStock
                };
            });
        } else if (type === 'batches') {
            filename = 'stock_batches';
            data = activeBatchesList.map(b => {
                const isSerial = b.serials && b.serials.length > 0;
                const totalUnits = isSerial ? b.serials.length : (b.quantity || 0);
                const availableUnits = isSerial ? b.serials.filter(s => s.status === 'Active').length : (b.remaining_qty || 0);
                const soldUnits = totalUnits - availableUnits;
                return {
                    'Batch Code': b.batch_code,
                    'SKU': b.item_code,
                    'Device Model': activeCatalogList.find(c => c.item_code === b.item_code)?.item_name || b.item_code,
                    'Category': b.category || '',
                    'Buying Cost': b.buying_price || 0,
                    'Supplier': b.supplier || '',
                    'Total Qty': totalUnits,
                    'Available Qty': availableUnits,
                    'Sold Qty': soldUnits,
                    'Import Date': b.created_at ? b.created_at.substring(0, 10) : ''
                };
            });
        }
        
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        XLSX.writeFile(workbook, `${filename}_all_${new Date().toISOString().slice(0, 10)}.xlsx`);
    });
};

// â”€â”€ Generic Table Excel Filter Application â”€â”€
window.applyExcelFiltersToTable = function (tableId) {
    const table = document.getElementById(tableId);
    if (!table || !table.activeExcelFilters) return;

    if (tableId === 'batch-main-table' && typeof window.filterBatchTable === 'function') {
        window.filterBatchTable();
        return;
    }
    if (tableId === 'pricing-table' && typeof window.filterPricingTable === 'function') {
        window.filterPricingTable();
        return;
    }
    if (tableId === 'catalog-table' && typeof window.filterCatalogTable === 'function') {
        window.filterCatalogTable();
        return;
    }
    if (tableId === 'warranties-table' && typeof window.filterWarrantiesTable === 'function') {
        window.filterWarrantiesTable();
        return;
    }
    if (tableId === 'rma-table' && typeof window.filterRmaTable === 'function') {
        window.filterRmaTable();
        return;
    }
    if (tableId === 'clients-table' && typeof window.filterAndSortClients === 'function') {
        window.filterAndSortClients();
        return;
    }
    if (tableId === 'tickets-table' && typeof window.filterTicketTable === 'function') {
        window.filterTicketTable();
        return;
    }

    // Fallback: Generic row filter
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.forEach(row => {
        if (row.classList.contains('empty-state-row') || row.classList.contains('message-row')) return;
        const cells = row.querySelectorAll('td');
        let excelMatch = true;

        for (const [colIndex, allowedSet] of Object.entries(table.activeExcelFilters)) {
            if (!cells[colIndex]) continue;
            const cellText = cells[colIndex].textContent.trim();
            if (!allowedSet.has(cellText)) {
                excelMatch = false;
                break;
            }
        }
        row.style.display = excelMatch ? '' : 'none';
    });
};

// â”€â”€ Tickets log search & filter â”€â”€
window.filterTicketTable = function () {
    const q = (document.getElementById('ticket-search-input')?.value || '').toLowerCase().trim();
    const domain = (document.getElementById('ticket-filter-domain')?.value || '').toLowerCase();
    const table = document.getElementById('tickets-table');
    const activeFilters = table ? table.activeExcelFilters : null;

    let currentParentVisible = true;
    const tbody = document.getElementById('full-jobs-body');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));

    rows.forEach(row => {
        if (row.id && row.id.startsWith('details-')) {
            row.style.display = currentParentVisible ? '' : 'none';
            return;
        }

        if (row.classList.contains('empty-state-row')) return;

        const text = row.textContent.toLowerCase();
        const cells = row.querySelectorAll('td');

        const searchMatch = !q || text.includes(q);

        let domainMatch = true;
        if (domain && domain !== 'all' && cells[3]) {
            const domainText = cells[3].textContent.trim().toLowerCase();
            domainMatch = (domainText === domain);
        }

        let excelMatch = true;
        if (activeFilters) {
            for (const [colIndex, allowedSet] of Object.entries(activeFilters)) {
                if (!cells[colIndex]) continue;
                const cellText = cells[colIndex].textContent.trim();
                if (!allowedSet.has(cellText)) {
                    excelMatch = false;
                    break;
                }
            }
        }

        const visible = searchMatch && domainMatch && excelMatch;
        row.style.display = visible ? '' : 'none';
        currentParentVisible = visible;
    });
};

window.filterTicketByDomain = function (val) {
    window.filterTicketTable();
};


