// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD — Clean Command Center
// ═══════════════════════════════════════════════════════════════════════════════

let dbData = null;

async function dbRefresh() {
  const baseUrl = document.getElementById('api-base')?.value || '';
  const token = localStorage.getItem('admin_token');
  dbUpdateGreeting();

  try {
    const res = await fetch(`${baseUrl}/api/reports/dashboard`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Dashboard fetch failed');
    const data = await res.json();
    dbData = data?.data || data;
    dbRenderStats(dbData);
    dbRenderRecentTickets(dbData.recent_jobs || []);
    dbRenderTopTechs(dbData.top_technicians || []);
    dbRenderActivityFeed(dbData.recent_activity || []);
  } catch (err) {
    console.error('Dashboard load failed:', err);
  }
}

function dbUpdateGreeting() {
  const el = document.getElementById('db-greeting');
  const dateEl = document.getElementById('db-date');
  if (el) {
    const h = new Date().getHours();
    el.textContent = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  }
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }
}

function dbRenderStats(d) {
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('db-stat-active', d.pending_jobs ?? 0);
  set('db-stat-revenue', `$${(d.monthly_revenue || 0).toLocaleString()}`);
  set('db-stat-revenue-mmk', `${(d.monthly_revenue || 0).toLocaleString()} MMK`);
  set('db-stat-clients', d.total_clients ?? 0);
  set('db-stat-techs', d.active_techs ?? 0);
}

function dbRenderRecentTickets(jobs) {
  const container = document.getElementById('db-today-list');
  if (!container) return;
  if (!jobs || jobs.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-600 text-xs py-6">No recent dispatches</div>';
    return;
  }
  const statusMap = {
    'Completed': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    'In Progress': 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    'Pending': 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  };
  let html = '<div class="space-y-2">';
  jobs.slice(0, 8).forEach(j => {
    const badge = statusMap[j.status] || statusMap['Pending'];
    const date = j.created_at ? new Date(j.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
    html += `
    <div class="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.03] transition-all">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-bold text-white truncate">${escapeHTML(j.company_name || j.client_name || 'Anonymous')}</span>
          <span class="text-[9px] font-mono text-slate-500">${escapeHTML(j.id)}</span>
        </div>
        <p class="text-[10px] text-slate-500">${escapeHTML(j.service_type || '')}</p>
      </div>
      <span class="text-[9px] font-mono text-slate-500">${date}</span>
      <span class="px-2 py-0.5 rounded-full text-[9px] font-bold border ${badge}">${j.status}</span>
    </div>`;
  });
  html += '</div>';
  container.innerHTML = html;
}

function dbRenderTopTechs(techs) {
  const container = document.getElementById('db-top-techs');
  if (!container) return;
  if (!techs || techs.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-600 text-xs py-4">No data</div>';
    return;
  }
  const maxJobs = Math.max(...techs.map(t => t.job_count || 0), 1);
  const colors = ['bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-rose-500'];
  let html = '';
  techs.forEach((t, i) => {
    const pct = Math.round(((t.job_count || 0) / maxJobs) * 100);
    html += `
    <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-all">
      <span class="text-sm w-5 text-center font-bold ${['text-amber-400','text-emerald-400','text-blue-400','text-slate-400','text-slate-400'][i]}">${i + 1}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[11px] font-bold text-white truncate">${escapeHTML(t.name)}</span>
          <span class="text-[10px] font-mono text-slate-400">${t.job_count}</span>
        </div>
        <div class="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div class="${colors[i] || 'bg-slate-500'} h-full rounded-full opacity-60" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function dbRenderActivityFeed(items) {
  const container = document.getElementById('db-activity-feed');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-600 text-xs py-4">No recent activity</div>';
    return;
  }
  let html = '';
  items.slice(0, 10).forEach(item => {
    const isJob = item.type === 'job';
    const icon = isJob ? '🎫' : '👤';
    const time = item.created_at ? dbTimeAgo(item.created_at) : '';
    const statusColors = { Completed: 'text-emerald-400', 'In Progress': 'text-blue-400', Pending: 'text-amber-400', Active: 'text-emerald-400', Expired: 'text-rose-400', Inactive: 'text-slate-400' };
    const sc = statusColors[item.status] || 'text-slate-400';
    html += `
    <div class="flex items-start gap-2 p-1.5 rounded-lg hover:bg-white/[0.02] transition-all">
      <span class="text-xs mt-0.5">${icon}</span>
      <div class="flex-1 min-w-0">
        <p class="text-[10px] text-white font-bold truncate">${escapeHTML(item.detail || 'Unknown')}</p>
        <div class="flex items-center gap-1.5">
          <span class="text-[9px] ${sc} font-bold">${item.status || ''}</span>
          <span class="text-[9px] text-slate-600">·</span>
          <span class="text-[9px] text-slate-500">${time}</span>
        </div>
      </div>
    </div>`;
  });
  container.innerHTML = html;
}

function dbTimeAgo(dateStr) {
  const diff = Math.floor((new Date() - new Date(dateStr)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function dbInitDashboard() {
  dbRefresh();
}
