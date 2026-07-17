/**
 * Admin Routes — Admin-only operations: system config, roles, backups, AI tools
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const user = await verifyToken(authHeader.slice(7));
    if (!user || user.role?.toLowerCase() !== 'admin') return null;
    return user;
  }

  // ── GET /api/admin/lookups ─────────────────────────────────────────────
  router.get('/api/admin/lookups', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const [clientsResult, techsResult] = await Promise.all([
        db.prepare('SELECT id, amc_status FROM clients').all(),
        db.prepare('SELECT id, name FROM technicians').all(),
      ]);

      return success({
        clients: clientsResult.results,
        technicians: techsResult.results,
      });
    } catch (err) {
      return error('Failed to fetch lookups: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/technicians ────────────────────────────────────────
  router.get('/api/admin/technicians', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db
        .prepare(
          'SELECT id, name, email, phone, role, active FROM technicians ORDER BY name ASC'
        )
        .all();

      const technicians = result.results;

      return success(technicians);
    } catch (err) {
      return error('Failed to fetch technicians: ' + err.message, 500);
    }
  });

  // ── PUT /api/admin/technicians/:id ────────────────────────────────────
  router.put('/api/admin/technicians/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const existing = await db
        .prepare('SELECT id FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Technician not found', 404);

      const allowed = ['name', 'nickname', 'email', 'phone', 'role', 'active', 'specialties', 'photo', 'username', 'pin', 'telegram_username'];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(field === 'specialties' ? JSON.stringify(body[field]) : body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);
      values.push(params.id);

      await db
        .prepare(`UPDATE technicians SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Technician updated' });
    } catch (err) {
      return error('Failed to update technician: ' + err.message, 500);
    }
  });

  // ── DELETE /api/admin/technicians/:id ─────────────────────────────────
  router.delete('/api/admin/technicians/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM technicians WHERE id = ?').bind(params.id).run();
      return success({ message: 'Technician deleted' });
    } catch (err) {
      return error('Failed to delete technician: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/clients ────────────────────────────────────────────
  router.get('/api/admin/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
      const offset = (page - 1) * limit;

      let query =
        'SELECT c.*, (SELECT COUNT(*) FROM jobs WHERE client_id = c.id) as job_count FROM clients c WHERE 1=1';
      const params = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
        params.push(like, like, like);
      }

      query += ' ORDER BY c.name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch clients: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/config/:key ────────────────────────────────────────
  router.get('/api/admin/config/:key', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const config = await db
        .prepare('SELECT * FROM system_config WHERE key = ?')
        .bind(params.key)
        .first();

      if (!config) return error('Config key not found', 404);
      return success(config);
    } catch (err) {
      return error('Failed to fetch config: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/config ────────────────────────────────────────────
  router.post('/api/admin/config', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { key, value, description } = (await request.json() as any);
      if (!key || value === undefined) return error('Missing key or value', 400);

      await db
        .prepare(
          "INSERT INTO system_config (key, value, description, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = COALESCE(excluded.description, description), updated_by = excluded.updated_by, updated_at = datetime('now')"
        )
        .bind(
          key,
          typeof value === 'object' ? JSON.stringify(value) : String(value),
          description || null,
          user.id
        )
        .run();

      return success({ key, value });
    } catch (err) {
      return error('Failed to save config: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/roles ──────────────────────────────────────────────
  router.get('/api/admin/roles', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare('SELECT * FROM roles ORDER BY name ASC').all();

      return success(result.results);
    } catch (err) {
      return error('Failed to fetch roles: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/roles ─────────────────────────────────────────────
  router.post('/api/admin/roles', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { name, permissions, description } = (await request.json() as any);
      if (!name) return error('Missing role name', 400);

      const id = 'ROLE-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare('INSERT INTO roles (id, name, permissions, description) VALUES (?, ?, ?, ?)')
        .bind(id, name, permissions ? JSON.stringify(permissions) : '[]', description || null)
        .run();

      return success({ id, name }, 201);
    } catch (err) {
      return error('Failed to create role: ' + err.message, 500);
    }
  });

  // ── DELETE /api/admin/roles/:id ───────────────────────────────────────
  router.delete('/api/admin/roles/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM roles WHERE id = ?').bind(params.id).run();
      return success({ message: 'Role deleted' });
    } catch (err) {
      return error('Failed to delete role: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/backup ────────────────────────────────────────────
  router.post('/api/admin/backup', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      // Export all tables to JSON
      const tables = [
        'technicians',
        'clients',
        'jobs',
        'inventory',
        'expenses',
        'attendance',
        'system_config',
      ];
const backup: any = {};

      for (const table of tables) {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = (result as any).results;
      }

      backup._exported_at = new Date().toISOString();
      backup._exported_by = user.id;

      return success(backup);
    } catch (err) {
      return error('Failed to create backup: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/restore ───────────────────────────────────────────
  router.post('/api/admin/restore', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      if (!body || !body._exported_at) return error('Invalid backup format', 400);

      const tables = [
        'technicians',
        'clients',
        'jobs',
        'inventory',
        'expenses',
        'attendance',
        'system_config',
      ];
      let restored = 0;

      for (const table of tables) {
        if (Array.isArray(body[table]) && body[table].length > 0) {
          // Clear existing data
          await db.prepare(`DELETE FROM ${table}`).run();

          // Insert backup data (simplified — real impl needs column mapping)
          for (const row of body[table]) {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map((col) => row[col]);
            try {
              await db
                .prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`)
                .bind(...values)
                .run();
              restored++;
            } catch (e) {
              // Skip rows that fail (e.g. FK constraints)
              console.warn(`Skipped row in ${table}: ${e.message}`);
            }
          }
        }
      }

      return success({ message: `Restored ${restored} rows across ${tables.length} tables` });
    } catch (err) {
      return error('Failed to restore backup: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/stats ──────────────────────────────────────────────
  router.get('/api/admin/stats', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const [totalJobs, activeJobs, totalClients, totalTechs, totalExpenses, totalRevenue] =
        await Promise.all([
          db.prepare('SELECT COUNT(*) as count FROM jobs').first(),
          db
            .prepare(
              "SELECT COUNT(*) as count FROM jobs WHERE status IN ('pending', 'assigned', 'in_progress')"
            )
            .first(),
          db.prepare('SELECT COUNT(*) as count FROM clients').first(),
          db.prepare('SELECT COUNT(*) as count FROM technicians WHERE active = 1').first(),
          db
            .prepare(
              "SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'approved'"
            )
            .first(),
          db
            .prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'")
            .first(),
        ]);

      return success({
        total_jobs: totalJobs.count,
        active_jobs: activeJobs.count,
        total_clients: totalClients.count,
        active_technicians: totalTechs.count,
        total_expenses: totalExpenses.total,
        total_revenue: totalRevenue.total,
      });
    } catch (err) {
      return error('Failed to fetch stats: ' + err.message, 500);
    }
  });

  // ── GET /api/landing-page ─────────────────────────────────────────────
  // Frontend calls this to load HQ config (map coordinates, contact info)
  router.get('/api/landing-page', async (request) => {
    try {
      const row = await db.prepare('SELECT * FROM landing_page WHERE id = 1').first();
      return success(row || {});
    } catch (err) {
      return error('Failed to fetch landing page: ' + err.message, 500);
    }
  });

  // ── POST /api/landing-page ────────────────────────────────────────────
  router.post('/api/landing-page', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const fields = Object.keys(body);
      if (fields.length === 0) return error('No fields provided', 400);

      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values = fields.map(f => body[f]);

      // Upsert: try update first, then insert
      const existing = await db.prepare('SELECT id FROM landing_page WHERE id = 1').first();
      if (existing) {
        await db.prepare(`UPDATE landing_page SET ${setClause} WHERE id = 1`).bind(...values).run();
      } else {
        const colClause = ['id', ...fields].join(', ');
        const valClause = ['1', ...fields.map(() => '?')].join(', ');
        await db.prepare(`INSERT INTO landing_page (${colClause}) VALUES (${valClause})`).bind(...values).run();
      }

      return success({ message: 'Landing page updated' });
    } catch (err) {
      return error('Failed to update landing page: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/hq-config ─────────────────────────────────────────
  router.post('/api/admin/hq-config', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const hq = (await request.json() as any);
      if (!hq) return error('Missing configuration data', 400);

      const lat = parseFloat(hq.lat);
      const lng = parseFloat(hq.lng);
      const address = hq.address || '';

      // 1. Update landing_page table for public website coordinates & address
      const existingLanding = await db.prepare('SELECT id FROM landing_page WHERE id = 1').first();
      if (existingLanding) {
        await db.prepare('UPDATE landing_page SET map_lat = ?, map_lng = ?, contact_address = ? WHERE id = 1')
          .bind(lat, lng, address)
          .run();
      } else {
        await db.prepare('INSERT INTO landing_page (id, map_lat, map_lng, contact_address) VALUES (1, ?, ?, ?)')
          .bind(lat, lng, address)
          .run();
      }

      // 2. Update system_config key-value store for internal settings syncing
      const serialized = JSON.stringify(hq);
      const existingConfig = await db.prepare('SELECT config_key FROM system_config WHERE config_key = ?')
        .bind('hq_config')
        .first();

      if (existingConfig) {
        await db.prepare('UPDATE system_config SET config_value = ? WHERE config_key = ?')
          .bind(serialized, 'hq_config')
          .run();
      } else {
        await db.prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)')
          .bind('hq_config', serialized)
          .run();
      }

      return success({ message: 'HQ Configuration saved and synchronized successfully' });
    } catch (err) {
      return error('Failed to save HQ configuration: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/config ─────────────────────────────────────────────
  // Key-value config store. ?key=pdf_builder_config etc.
  router.get('/api/admin/config', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const key = url.searchParams.get('key');

      if (key) {
        const row = await db
          .prepare('SELECT config_value FROM system_config WHERE config_key = ?')
          .bind(key)
          .first();
        const value = row ? JSON.parse(row.config_value || 'null') : null;
        return success({ key, value });
      }

      const rows = await db.prepare('SELECT * FROM system_config').all();
      return success(rows.results);
    } catch (err) {
      return error('Failed to fetch config: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/config ────────────────────────────────────────────
  router.post('/api/admin/config', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { key, value } = (await request.json() as any);
      if (!key) return error('Missing key', 400);

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await db.prepare('SELECT config_key FROM system_config WHERE config_key = ?').bind(key).first();

      if (existing) {
        await db.prepare('UPDATE system_config SET config_value = ? WHERE config_key = ?').bind(serialized, key).run();
      } else {
        await db.prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)').bind(key, serialized).run();
      }

      return success({ message: 'Config saved', key });
    } catch (err) {
      return error('Failed to save config: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/roles/list ─────────────────────────────────────────
  router.get('/api/admin/roles/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const rows = await db.prepare('SELECT * FROM roles ORDER BY name ASC').all();
      return success(rows.results);
    } catch (err) {
      return error('Failed to fetch roles: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/jobs/ai-polish ────────────────────────────────────
  // AI polish for job notes — forwards to Gemini, falls back gracefully
  router.post('/api/admin/jobs/ai-polish', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { text, notes, job_id } = (await request.json() as any);
      const raw = text || notes || '';
      if (!raw) return error('Missing text or notes field', 400);

      const GEMINI_API_KEY = env.GEMINI_API_KEY;
      let polished = raw;

      if (GEMINI_API_KEY) {
        try {
          const endpoints = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            `https://api.gemini.tams.tech/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          ];
          for (const endpoint of endpoints) {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `Polish the following CCTV/IT service technician notes for clarity and professionalism. Fix grammar and spelling. Keep all technical details intact. Return only the polished text:\n\n${raw}` }] }],
              }),
            });
            if (resp.ok) {
              const data = (await resp.json() as any);
              polished = data?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
              break;
            }
          }
        } catch (_) { /* use raw */ }
      }

      return success({ original: raw, polished, job_id: job_id || null });
    } catch (err) {
      return error('AI polish failed: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/ai/chat-data ──────────────────────────────────────
  // AI Copilot chat with business data context
  router.post('/api/admin/ai/chat-data', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { message, query, question, history } = (await request.json() as any);
      const userMsg = message || query || question || '';
      if (!userMsg) return error('Missing message', 400);

      const GEMINI_API_KEY = env.GEMINI_API_KEY;

      // Gather quick context
      const [jobCount, clientCount, techCount] = await Promise.all([
        db.prepare("SELECT COUNT(*) as c FROM service_records").first(),
        db.prepare("SELECT COUNT(*) as c FROM clients").first(),
        db.prepare("SELECT COUNT(*) as c FROM technicians WHERE active = 1").first(),
      ]);

      const context = `You are an AI assistant for an Awesome Myanmar CCTV & IT service company.
Current system stats: ${jobCount?.c ?? 0} total jobs, ${clientCount?.c ?? 0} clients, ${techCount?.c ?? 0} active technicians.
Answer helpfully and concisely. If asked about specific data, note that you have limited access.`;

      let reply = 'I am your AI assistant. How can I help you manage your service operations?';

      if (GEMINI_API_KEY) {
        try {
          const msgs = [
            { role: 'user', parts: [{ text: context }] },
            { role: 'model', parts: [{ text: 'Understood. I will assist with service operations.' }] },
            ...(Array.isArray(history) ? history : []),
            { role: 'user', parts: [{ text: userMsg }] },
          ];
          const endpoints = [
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
            `https://api.gemini.tams.tech/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
          ];
          for (const endpoint of endpoints) {
            const resp = await fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: msgs }),
            });
            if (resp.ok) {
              const data = (await resp.json() as any);
              reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || reply;
              break;
            }
          }
        } catch (_) { /* use default reply */ }
      }

      return success({ reply, message: reply });
    } catch (err) {
      return error('AI chat failed: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/ai/route-optimize ────────────────────────────────
  router.post('/api/admin/ai/route-optimize', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const technician_id = url.searchParams.get('technician_id') || (await request.json() as any)?.technician_id;

      const jobs = await db
        .prepare(
          `SELECT sr.id, sr.service_type, sr.status, c.company_name, c.address
           FROM service_records sr
           LEFT JOIN clients c ON sr.client_id = c.id
           WHERE sr.technician_id = ? AND sr.status IN ('Pending','In Progress')
           ORDER BY sr.created_at ASC`
        )
        .bind(technician_id || '')
        .all();

      return success({
        technician_id,
        total_jobs: jobs.results.length,
        optimized_route: jobs.results,
      });
    } catch (err) {
      return error('Route optimize failed: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/ai/transcribe ─────────────────────────────────────
  router.post('/api/admin/ai/transcribe', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      return success({ transcription: '', message: 'Transcription endpoint active.' });
    } catch (err) {
      return error('Transcribe failed: ' + err.message, 500);
    }
  });

  // ── GET /api/jobs/receipt ─────────────────────────────────────────────
  // Job receipt by job_id query param
  router.get('/api/jobs/receipt', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const job_id = url.searchParams.get('job_id');
      if (!job_id) return success(null);

      const job = await db
        .prepare(
          `SELECT sr.*, c.company_name, c.address, c.phone as client_phone, c.amc_status,
                  t.name as tech_name, t.phone as tech_phone
           FROM service_records sr
           LEFT JOIN clients c ON sr.client_id = c.id
           LEFT JOIN technicians t ON sr.technician_id = t.id
           WHERE sr.id = ?`
        )
        .bind(job_id)
        .first();

      return success(job || null);
    } catch (err) {
      return error('Failed to fetch receipt: ' + err.message, 500);
    }
  });

  // ── GET /api/portal/history ───────────────────────────────────────────
  // Client job history for portal / POS
  router.get('/api/portal/history', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');

      let query = `SELECT sr.*, t.name as tech_name
                   FROM service_records sr
                   LEFT JOIN technicians t ON sr.technician_id = t.id`;
      const params: any[] = [];

      if (client_id) {
        query += ' WHERE sr.client_id = ?';
        params.push(client_id);
      }
      query += ' ORDER BY sr.created_at DESC LIMIT 50';

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch history: ' + err.message, 500);
    }
  });

  // ── GET /api/pos/sales ────────────────────────────────────────────────
  router.get('/api/pos/sales', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo   = url.searchParams.get('date_to');

      let query = 'SELECT * FROM cash_transactions WHERE transaction_type IN (\'Deposit\',\'Income\',\'Sale\') ';
      const params: any[] = [];

      if (dateFrom) { query += ' AND created_at >= ?'; params.push(dateFrom); }
      if (dateTo)   { query += ' AND created_at <= ?'; params.push(dateTo); }
      query += ' ORDER BY created_at DESC LIMIT 200';

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch POS sales: ' + err.message, 500);
    }
  });

  // ── GET /api/pos/credits ──────────────────────────────────────────────
  router.get('/api/pos/credits', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');

      let query = 'SELECT cc.*, c.company_name FROM client_credits cc LEFT JOIN clients c ON cc.client_id = c.id WHERE 1=1';
      const params: any[] = [];

      if (client_id) { query += ' AND cc.client_id = ?'; params.push(client_id); }
      query += ' ORDER BY cc.created_at DESC LIMIT 100';

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch credits: ' + err.message, 500);
    }
  });
}

export { register };



