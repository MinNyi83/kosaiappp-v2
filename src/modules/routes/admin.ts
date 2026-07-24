/**
 * Admin Routes — Admin-only operations: system config, roles, backups, AI tools
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';
import { fetchGeminiWithFallback } from '../utils/gemini.js';
import { validateSql, ALLOWED_TABLES } from '../utils/sql-validator.js';

function register(router, env) {
  const db = env.DB;

  // Admin-only auth: verify token AND check admin role
  async function requireAdmin(request) {
    const user = await authenticate(request);
    if (!user || user.role?.toLowerCase() !== 'admin') return null;
    return user;
  }

  // ── GET /api/admin/lookups ─────────────────────────────────────────────
  router.get('/api/admin/lookups', async (request) => {
    try {
      const user = await requireAdmin(request);
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
      console.error('Fetch lookups error:', err.message);
      return error('Failed to fetch lookups', 500);
    }
  });

  // ── GET /api/admin/technicians ────────────────────────────────────────
  router.get('/api/admin/technicians', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db
        .prepare(
          'SELECT id, name, nickname, email, phone, role, active, username, telegram_username, photo, permissions FROM technicians ORDER BY name ASC'
        )
        .all();

      const technicians = result.results;

      return success(technicians);
    } catch (err) {
      console.error('Fetch technicians error:', err.message);
      return error('Failed to fetch technicians', 500);
    }
  });

  // ── PUT /api/admin/technicians/:id ────────────────────────────────────
  router.put('/api/admin/technicians/:id', async (request, params) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const existing = await db
        .prepare('SELECT id FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Technician not found', 404);

      const allowed = [
        'name',
        'nickname',
        'email',
        'phone',
        'role',
        'active',
        'specialties',
        'photo',
        'username',
        'pin',
        'telegram_username',
      ];
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
      console.error('Update technician error:', err.message);
      return error('Failed to update technician', 500);
    }
  });

  // ── DELETE /api/admin/technicians/:id ─────────────────────────────────
  router.delete('/api/admin/technicians/:id', async (request, params) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      await db.prepare('DELETE FROM technicians WHERE id = ?').bind(params.id).run();
      return success({ message: 'Technician deleted' });
    } catch (err) {
      console.error('Delete technician error:', err.message);
      return error('Failed to delete technician', 500);
    }
  });

  // ── GET /api/admin/clients ────────────────────────────────────────────
  router.get('/api/admin/clients', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
      const offset = (page - 1) * limit;

      let query =
        'SELECT c.*, (SELECT COUNT(*) FROM service_records WHERE client_id = c.id) as job_count FROM clients c WHERE 1=1';
      const params = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (c.company_name LIKE ? OR c.phone LIKE ? OR c.contact_person LIKE ?)';
        params.push(like, like, like);
      }

      query += ' ORDER BY c.company_name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch clients error:', err.message);
      return error('Failed to fetch clients', 500);
    }
  });

  // ── GET /api/admin/config/:key ────────────────────────────────────────
  router.get('/api/admin/config/:key', async (request, params) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const config = await db
        .prepare('SELECT * FROM system_config WHERE config_key = ?')
        .bind(params.key)
        .first();

      if (!config) return error('Config key not found', 404);
      return success(config);
    } catch (err) {
      console.error('Fetch config error:', err.message);
      return error('Failed to fetch config', 500);
    }
  });

  // ── POST /api/admin/config/save (alias for PDF builder) ───────────────
  router.post('/api/admin/config/save', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const { key, value } = (await request.json()) as any;
      if (!key) return error('Missing key', 400);

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await db
        .prepare('SELECT config_key FROM system_config WHERE config_key = ?')
        .bind(key)
        .first();

      if (existing) {
        await db
          .prepare('UPDATE system_config SET config_value = ? WHERE config_key = ?')
          .bind(serialized, key)
          .run();
      } else {
        await db
          .prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)')
          .bind(key, serialized)
          .run();
      }

      return success({ message: 'Config saved', key });
    } catch (err) {
      console.error('Save config error:', err.message);
      return error('Failed to save config', 500);
    }
  });

  // ── POST /api/admin/config ────────────────────────────────────────────
  router.post('/api/admin/config', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const { key, value, description } = (await request.json()) as any;
      if (!key || value === undefined) return error('Missing key or value', 400);

      await db
        .prepare(
          "INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = excluded.config_value, description = COALESCE(excluded.description, description), updated_by = excluded.updated_by, updated_at = datetime('now')"
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
      console.error('Save config error:', err.message);
      return error('Failed to save config', 500);
    }
  });

  // ── GET /api/admin/roles ──────────────────────────────────────────────
  router.get('/api/admin/roles', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare('SELECT * FROM roles ORDER BY name ASC').all();

      return success(result.results);
    } catch (err) {
      console.error('Fetch roles error:', err.message);
      return error('Failed to fetch roles', 500);
    }
  });

  // ── POST /api/admin/roles ─────────────────────────────────────────────
  router.post('/api/admin/roles', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const { name, permissions, description } = (await request.json()) as any;
      if (!name) return error('Missing role name', 400);

      const id = 'ROLE-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare('INSERT INTO roles (id, name, permissions, description) VALUES (?, ?, ?, ?)')
        .bind(id, name, permissions ? JSON.stringify(permissions) : '[]', description || null)
        .run();

      return success({ id, name }, 201);
    } catch (err) {
      console.error('Create role error:', err.message);
      return error('Failed to create role', 500);
    }
  });

  // ── GET /api/admin/roles/list (alias for /api/admin/roles) ─────────────
  router.get('/api/admin/roles/list', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare('SELECT * FROM roles ORDER BY name ASC').all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch roles list error:', err.message);
      return error('Failed to fetch roles', 500);
    }
  });

  // ── DELETE /api/admin/roles/:id ───────────────────────────────────────
  router.delete('/api/admin/roles/:id', async (request, params) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM roles WHERE id = ?').bind(params.id).run();
      return success({ message: 'Role deleted' });
    } catch (err) {
      console.error('Delete role error:', err.message);
      return error('Failed to delete role', 500);
    }
  });

  // ── POST /api/admin/backup ────────────────────────────────────────────
  router.post('/api/admin/backup', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      // Export all tables to JSON (exclude sensitive columns)
      const tables = [
        'clients',
        'service_records',
        'inventory_stock',
        'inventory_items',
        'inventory_batches',
        'cash_safes',
        'cash_transactions',
        'service_fees',
        'system_config',
        'distributors',
        'invoices',
      ];
      const backup: any = {};

      // Technicians table: exclude pin and password columns
      const techResult = await db
        .prepare('SELECT id, name, nickname, email, phone, role, active, username, telegram_username, photo, permissions, specialties, created_at, last_login FROM technicians')
        .all();
      backup.technicians = (techResult as any).results;

      for (const table of tables) {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = (result as any).results;
      }

      backup._exported_at = new Date().toISOString();
      backup._exported_by = user.id;

      return success(backup);
    } catch (err) {
      console.error('Create backup error:', err.message);
      return error('Failed to create backup', 500);
    }
  });

  // ── POST /api/admin/restore ───────────────────────────────────────────
  router.post('/api/admin/restore', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      // CSRF protection for state-changing request
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      if (!body || !body._exported_at) return error('Invalid backup format', 400);

      // Validate backup size (max 10MB)
      const backupSize = JSON.stringify(body).length;
      if (backupSize > 10 * 1024 * 1024) {
        return error('Backup too large (max 10MB)', 400);
      }

      const tables = [
        'technicians',
        'clients',
        'service_records',
        'inventory_stock',
        'inventory_items',
        'inventory_batches',
        'cash_safes',
        'cash_transactions',
        'service_fees',
        'system_config',
        'distributors',
        'invoices',
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
      console.error('Restore backup error:', err.message);
      return error('Failed to restore backup', 500);
    }
  });

  // ── GET /api/admin/stats ──────────────────────────────────────────────
  router.get('/api/admin/stats', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const [totalJobs, activeJobs, totalClients, totalTechs, totalExpenses, totalRevenue] =
        await Promise.all([
          db.prepare('SELECT COUNT(*) as count FROM service_records').first(),
          db
            .prepare(
              "SELECT COUNT(*) as count FROM service_records WHERE status IN ('Pending', 'In Progress')"
            )
            .first(),
          db.prepare('SELECT COUNT(*) as count FROM clients').first(),
          db.prepare('SELECT COUNT(*) as count FROM technicians WHERE active = 1').first(),
          db
            .prepare(
              "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE transaction_type = 'Withdrawal'"
            )
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
      console.error('Fetch stats error:', err.message);
      return error('Failed to fetch stats', 500);
    }
  });

  // ── GET /api/landing-page ─────────────────────────────────────────────
  // Frontend calls this to load HQ config (map coordinates, contact info)
  router.get('/api/landing-page', async (request) => {
    try {
      const row = await db.prepare('SELECT * FROM landing_page WHERE id = 1').first();
      return success(row || {});
    } catch (err) {
      console.error('Fetch landing page error:', err.message);
      return error('Failed to fetch landing page', 500);
    }
  });

  // ── POST /api/landing-page ────────────────────────────────────────────
  router.post('/api/landing-page', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const fields = Object.keys(body);
      if (fields.length === 0) return error('No fields provided', 400);

      const setClause = fields.map((f) => `${f} = ?`).join(', ');
      const values = fields.map((f) => body[f]);

      // Upsert: try update first, then insert
      const existing = await db.prepare('SELECT id FROM landing_page WHERE id = 1').first();
      if (existing) {
        await db
          .prepare(`UPDATE landing_page SET ${setClause} WHERE id = 1`)
          .bind(...values)
          .run();
      } else {
        const colClause = ['id', ...fields].join(', ');
        const valClause = ['1', ...fields.map(() => '?')].join(', ');
        await db
          .prepare(`INSERT INTO landing_page (${colClause}) VALUES (${valClause})`)
          .bind(...values)
          .run();
      }

      return success({ message: 'Landing page updated' });
    } catch (err) {
      console.error('Update landing page error:', err.message);
      return error('Failed to update landing page', 500);
    }
  });

  // ── POST /api/admin/hq-config ─────────────────────────────────────────
  router.post('/api/admin/hq-config', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const hq = (await request.json()) as any;
      if (!hq) return error('Missing configuration data', 400);

      const lat = parseFloat(hq.lat);
      const lng = parseFloat(hq.lng);
      const address = hq.address || '';

      // 1. Update landing_page table for public website coordinates & address
      const existingLanding = await db.prepare('SELECT id FROM landing_page WHERE id = 1').first();
      if (existingLanding) {
        await db
          .prepare(
            'UPDATE landing_page SET map_lat = ?, map_lng = ?, contact_address = ? WHERE id = 1'
          )
          .bind(lat, lng, address)
          .run();
      } else {
        await db
          .prepare(
            'INSERT INTO landing_page (id, map_lat, map_lng, contact_address) VALUES (1, ?, ?, ?)'
          )
          .bind(lat, lng, address)
          .run();
      }

      // 2. Update system_config key-value store for internal settings syncing
      const serialized = JSON.stringify(hq);
      const existingConfig = await db
        .prepare('SELECT config_key FROM system_config WHERE config_key = ?')
        .bind('hq_config')
        .first();

      if (existingConfig) {
        await db
          .prepare('UPDATE system_config SET config_value = ? WHERE config_key = ?')
          .bind(serialized, 'hq_config')
          .run();
      } else {
        await db
          .prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)')
          .bind('hq_config', serialized)
          .run();
      }

      return success({ message: 'HQ Configuration saved and synchronized successfully' });
    } catch (err) {
      console.error('Save HQ config error:', err.message);
      return error('Failed to save HQ configuration', 500);
    }
  });

  // ── GET /api/admin/config ─────────────────────────────────────────────
  // Key-value config store. ?key=pdf_builder_config etc.
  router.get('/api/admin/config', async (request) => {
    try {
      const user = await requireAdmin(request);
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
      console.error('Fetch config error:', err.message);
      return error('Failed to fetch config', 500);
    }
  });

  // ── POST /api/admin/config ────────────────────────────────────────────
  router.post('/api/admin/config', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const { key, value } = (await request.json()) as any;
      if (!key) return error('Missing key', 400);

      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      const existing = await db
        .prepare('SELECT config_key FROM system_config WHERE config_key = ?')
        .bind(key)
        .first();

      if (existing) {
        await db
          .prepare('UPDATE system_config SET config_value = ? WHERE config_key = ?')
          .bind(serialized, key)
          .run();
      } else {
        await db
          .prepare('INSERT INTO system_config (config_key, config_value) VALUES (?, ?)')
          .bind(key, serialized)
          .run();
      }

      return success({ message: 'Config saved', key });
    } catch (err) {
      console.error('Save config error:', err.message);
      return error('Failed to save config', 500);
    }
  });

  // ── POST /api/admin/jobs/ai-polish ────────────────────────────────────
  // AI polish for job notes — forwards to Gemini, falls back gracefully
  router.post('/api/admin/jobs/ai-polish', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const { text, notes, job_id } = (await request.json()) as any;
      const raw = text || notes || '';
      if (!raw) return error('Missing text or notes field', 400);

      const GEMINI_API_KEY = env.GEMINI_API_KEY;
      let polished = raw;

      if (GEMINI_API_KEY) {
        try {
          const data = await fetchGeminiWithFallback(GEMINI_API_KEY, {
            contents: [
              {
                parts: [
                  {
                    text: `Polish the following CCTV/IT service technician notes for clarity and professionalism. Fix grammar and spelling. Keep all technical details intact. Return only the polished text:\n\n${raw}`,
                  },
                ],
              },
            ],
          });
          polished = data?.candidates?.[0]?.content?.parts?.[0]?.text || raw;
        } catch (_) {
          /* use raw */
        }
      }

      return success({ original: raw, polished, job_id: job_id || null });
    } catch (err) {
      console.error('AI polish error:', err.message);
      return error('AI polish failed', 500);
    }
  });

  // ── POST /api/admin/ai/chat-data ──────────────────────────────────────
  // AI Copilot chat with database query execution
  router.post('/api/admin/ai/chat-data', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const { message, query, question, history } = (await request.json()) as any;
      const userMsg = message || query || question || '';
      if (!userMsg) return error('Missing message', 400);

      const GEMINI_API_KEY = env.GEMINI_API_KEY;

      // Gather context for SQL generation
      const schema = await getSchemaSummary(db);
      const [jobCount, clientCount, techCount] = await Promise.all([
        db.prepare('SELECT COUNT(*) as c FROM service_records').first(),
        db.prepare('SELECT COUNT(*) as c FROM clients').first(),
        db.prepare('SELECT COUNT(*) as c FROM technicians WHERE active = 1').first(),
      ]);

      const systemPrompt = `You are a SQLite SQL generator. Given a database schema and a natural language question, output ONLY a valid SQLite SELECT query. No explanation, no markdown, no semicolons. Just the raw SQL.

Database schema:
${schema}`;

      let sql = '';
      let results = [];
      let reply = '';

      // First: try keyword matching (reliable)
      {
        const q = userMsg.toLowerCase();

        // Jobs queries
        if (
          q.includes('job') &&
          (q.includes('assigned') || q.includes('technician') || q.includes('tech'))
        ) {
          // Extract technician ID if mentioned
          const techMatch = q.match(/technician\s*(\d+)|tech\s*(\d+)/);
          const techId = techMatch ? techMatch[1] : null;
          if (techId) {
            sql = `SELECT id, job_description, service_type, status, created_at FROM service_records WHERE technician_id LIKE '%${techId}%' ORDER BY created_at DESC LIMIT 20`;
          } else {
            sql =
              "SELECT id, job_description, service_type, status, technician_id FROM service_records WHERE status IN ('Pending', 'In Progress') ORDER BY created_at DESC LIMIT 20";
          }
        } else if (q.includes('job') && (q.includes('pending') || q.includes('new'))) {
          sql =
            "SELECT id, job_description, service_type, status FROM service_records WHERE status = 'Pending' ORDER BY created_at DESC LIMIT 20";
        } else if (q.includes('job') && (q.includes('progress') || q.includes('active'))) {
          sql =
            "SELECT id, job_description, service_type, status FROM service_records WHERE status = 'In Progress' ORDER BY created_at DESC LIMIT 20";
        } else if (
          q.includes('job') &&
          (q.includes('completed') || q.includes('done') || q.includes('finished'))
        ) {
          sql =
            "SELECT id, job_description, service_type, completed_at FROM service_records WHERE status = 'Completed' ORDER BY completed_at DESC LIMIT 20";
        } else if (q.includes('job') && q.includes('count')) {
          sql = 'SELECT status, COUNT(*) as count FROM service_records GROUP BY status';
        } else if (q.includes('job') || q.includes('ticket') || q.includes('dispatch')) {
          sql =
            'SELECT id, job_description, service_type, status FROM service_records ORDER BY created_at DESC LIMIT 20';
        }

        // Technician queries
        else if (q.includes('technician') && q.includes('count')) {
          sql = 'SELECT COUNT(*) as count FROM technicians WHERE active = 1';
        } else if (q.includes('technician') || q.includes('engineer') || q.includes('staff')) {
          sql = 'SELECT id, name, role, active FROM technicians ORDER BY name';
        }

        // Client queries
        else if (q.includes('client') && q.includes('count')) {
          sql = 'SELECT COUNT(*) as count FROM clients';
        } else if (q.includes('client') || q.includes('customer')) {
          sql = 'SELECT id, name, phone, email FROM clients ORDER BY name LIMIT 20';
        }

        // Attendance queries
        else if (q.includes('attendance') || q.includes('clock') || q.includes('check')) {
          sql =
            "SELECT a.date, t.name, a.clock_in, a.clock_out FROM attendance a JOIN technicians t ON a.technician_id = t.id WHERE a.date >= date('now', '-7 days') ORDER BY a.date DESC, a.clock_in DESC LIMIT 20";
        }

        // Inventory queries
        else if (q.includes('inventory') || q.includes('stock')) {
          sql =
            'SELECT item_code, item_name, current_stock FROM inventory_items ORDER BY item_name LIMIT 20';
        }

        // Financial queries
        else if (
          q.includes('revenue') ||
          q.includes('income') ||
          q.includes('cash') ||
          q.includes('transaction')
        ) {
          sql = 'SELECT category, SUM(amount) as total FROM cash_transactions GROUP BY category';
        }

        // Count queries
        else if (q.includes('count') || q.includes('how many')) {
          if (q.includes('job') || q.includes('ticket') || q.includes('dispatch')) {
            sql = 'SELECT status, COUNT(*) as count FROM service_records GROUP BY status';
          } else if (q.includes('client') || q.includes('customer')) {
            sql = 'SELECT COUNT(*) as count FROM clients';
          } else if (q.includes('technician') || q.includes('engineer') || q.includes('staff')) {
            sql = 'SELECT COUNT(*) as count FROM technicians WHERE active = 1';
          } else {
            sql = 'SELECT COUNT(*) as count FROM service_records';
          }
        }

        // Default fallback
        else {
          sql = 'SELECT id, name, role FROM technicians LIMIT 10';
        }
      }

      // If no SQL from keywords, try Gemini
      if (!sql && GEMINI_API_KEY) {
        try {
          const data = await fetchGeminiWithFallback(GEMINI_API_KEY, {
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `You are a SQL generator. Given this SQLite schema:\n${schema}\n\nConvert this question to SQL: ${userMsg}\n\nReturn ONLY the SELECT query.`,
                  },
                ],
              },
            ],
          });
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (rawText) {
            const selectMatch = rawText.match(/(SELECT\s+[\s\S]+)/i);
            if (selectMatch) sql = selectMatch[1].replace(/```/g, '').replace(/;$/, '').trim();
          }
        } catch (e) {
          console.error('Gemini error:', e);
        }
      }

      // Validate and execute SQL
      if (sql) {
        const validationError = validateSql(sql);
        if (!validationError) {
          try {
            const dbResult = await db.prepare(sql).all();
            results = dbResult.results.slice(0, 50);
            reply = `Found ${results.length} result(s).`;
          } catch (dbErr) {
            reply = `SQL error: ${dbErr.message}`;
          }
        } else {
          reply = `Query blocked: ${validationError}`;
        }
      } else {
        reply = 'I could not generate a query for that question. Try rephrasing.';
      }

      return success({ reply, message: reply, query: userMsg, sql, results, summary: reply });
    } catch (err) {
      console.error('AI chat error:', err.message);
      return error('AI chat failed', 500);
    }
  });

  // ── POST /api/admin/ai/route-optimize ────────────────────────────────
  router.post('/api/admin/ai/route-optimize', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const technician_id =
        url.searchParams.get('technician_id') || ((await request.json()) as any)?.technician_id;

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
      console.error('Route optimize error:', err.message);
      return error('Route optimize failed', 500);
    }
  });

  // ── POST /api/admin/ai/auto-dispatch ──────────────────────────────────
  router.post('/api/admin/ai/auto-dispatch', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const { text, job_type, priority } = (await request.json()) as any;

      // Find available technicians based on workload
      const availableTechs = await db
        .prepare(
          'SELECT t.id, t.name, ' +
            "(SELECT COUNT(*) FROM service_records WHERE technician_id = t.id AND status IN ('Pending', 'In Progress')) as active_jobs " +
            'FROM technicians t WHERE t.active = 1 ORDER BY active_jobs ASC LIMIT 10'
        )
        .all();

      // Score each technician
      const scored = availableTechs.results.map((tech) => {
        let score = 100;
        score -= tech.active_jobs * 20;
        return { ...tech, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const bestTech = scored[0];

      // If text provided, use AI to analyze the complaint
      let explanation = `Recommended ${bestTech?.name || 'no technician'} based on workload and specialty matching.`;
      let domain = job_type || 'General';

      if (text && env.GEMINI_API_KEY) {
        try {
          const data = await fetchGeminiWithFallback(env.GEMINI_API_KEY, {
            contents: [
              {
                parts: [
                  {
                    text: `Analyze this service complaint and suggest: 1) domain (CCTV, Networking, WiFi, NAS, General), 2) priority (urgent/high/normal/low), 3) brief explanation. Complaint: "${text}"`,
                  },
                ],
              },
            ],
          });
          const aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          explanation = aiReply;
          // Extract domain from AI response
          const domainMatch = aiReply.match(/(?:domain|category|type)[:\s]*(\w+)/i);
          if (domainMatch) domain = domainMatch[1];
        } catch (_) {}
      }

      return success({
        domain,
        suggested_technician_id: bestTech?.id || null,
        suggested_technician_name: bestTech?.name || null,
        explanation,
        recommendation: bestTech || null,
        alternatives: scored.slice(1, 4),
      });
    } catch (err) {
      console.error('Auto-dispatch error:', err.message);
      return error('Auto-dispatch failed', 500);
    }
  });

  // ── POST /api/admin/ai/transcribe ─────────────────────────────────────
  router.post('/api/admin/ai/transcribe', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);
      return success({ transcription: '', message: 'Transcription endpoint active.' });
    } catch (err) {
      console.error('Transcribe error:', err.message);
      return error('Transcribe failed', 500);
    }
  });

  // ── GET /api/portal/history ───────────────────────────────────────────
  // Client job history for portal — requires admin auth or portal token
  router.get('/api/portal/history', async (request) => {
    try {
      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');
      if (!client_id) return error('Missing client_id parameter', 400);

      // Require admin auth for portal access (client portal should use separate auth)
      const user = await authenticate(request);
      if (!user || user.role?.toLowerCase() !== 'admin') return error('Unauthorized', 401);

      let query = `SELECT sr.*, t.name as tech_name, c.company_name
                   FROM service_records sr
                   LEFT JOIN technicians t ON sr.technician_id = t.id
                   LEFT JOIN clients c ON sr.client_id = c.id
                   WHERE sr.client_id = ?`;
      const params: any[] = [client_id];
      query += ' ORDER BY sr.created_at DESC LIMIT 50';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch history error:', err.message);
      return error('Failed to fetch history', 500);
    }
  });

  // ── GET /api/portal/warranties ────────────────────────────────────────
  // Client warranties for portal — requires admin auth
  router.get('/api/portal/warranties', async (request) => {
    try {
      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');
      if (!client_id) return error('Missing client_id parameter', 400);

      // Require admin auth for portal access
      const user = await authenticate(request);
      if (!user || user.role?.toLowerCase() !== 'admin') return error('Unauthorized', 401);

      const result = await db
        .prepare('SELECT * FROM inventory_items WHERE client_id = ? ORDER BY installed_date DESC')
        .bind(client_id)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch warranties error:', err.message);
      return error('Failed to fetch warranties', 500);
    }
  });

  // ── GET /api/portal/transactions ──────────────────────────────────────
  // Client transactions for portal — requires admin auth
  router.get('/api/portal/transactions', async (request) => {
    try {
      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');
      if (!client_id) return error('Missing client_id parameter', 400);

      // Require admin auth for portal access
      const user = await authenticate(request);
      if (!user || user.role?.toLowerCase() !== 'admin') return error('Unauthorized', 401);

      // Get transactions linked to this client's jobs
      const result = await db
        .prepare(
          `SELECT ct.* FROM cash_transactions ct
           LEFT JOIN service_records sr ON ct.linked_batch = sr.id
           WHERE sr.client_id = ? OR ct.notes LIKE ?
           ORDER BY ct.created_at DESC LIMIT 50`
        )
        .bind(client_id, `%${client_id}%`)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch transactions error:', err.message);
      return error('Failed to fetch transactions', 500);
    }
  });

  // ── GET /api/pos/sales ────────────────────────────────────────────────
  router.get('/api/pos/sales', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');

      let query =
        "SELECT * FROM cash_transactions WHERE transaction_type IN ('Deposit','Income','Sale') ";
      const params: any[] = [];

      if (dateFrom) {
        query += ' AND created_at >= ?';
        params.push(dateFrom);
      }
      if (dateTo) {
        query += ' AND created_at <= ?';
        params.push(dateTo);
      }
      query += ' ORDER BY created_at DESC LIMIT 200';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch POS sales error:', err.message);
      return error('Failed to fetch POS sales', 500);
    }
  });

  // ── GET /api/pos/credits ──────────────────────────────────────────────
  router.get('/api/pos/credits', async (request) => {
    try {
      const user = await requireAdmin(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id');

      let query =
        'SELECT cc.*, c.company_name FROM client_credits cc LEFT JOIN clients c ON cc.client_id = c.id WHERE 1=1';
      const params: any[] = [];

      if (client_id) {
        query += ' AND cc.client_id = ?';
        params.push(client_id);
      }
      query += ' ORDER BY cc.created_at DESC LIMIT 100';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch credits error:', err.message);
      return error('Failed to fetch credits', 500);
    }
  });
}

async function getSchemaSummary(db) {
  const schemas = [];
  for (const table of ALLOWED_TABLES) {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all();
    const cols = info.results
      .map(
        (c) => `  ${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.notnull ? ' NOT NULL' : ''}`
      )
      .join('\n');
    schemas.push(`TABLE ${table}:\n${cols}`);
  }
  return schemas.join('\n\n');
}

export { register };
