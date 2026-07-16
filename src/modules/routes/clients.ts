/**
 * Clients Routes — CRUD + search for client records
 * DB schema: clients(id TEXT PK, company_name TEXT, contact_person TEXT, address TEXT,
 *            phone TEXT, amc_start TEXT, amc_end TEXT, amc_status TEXT)
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return verifyToken(authHeader.slice(7));
  }

  // ── GET /api/clients ──────────────────────────────────────────────────
  router.get('/api/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search  = url.searchParams.get('search');
      const status  = url.searchParams.get('amc_status');
      const page    = parseInt(url.searchParams.get('page') || '1');
      const limit   = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);
      const offset  = (page - 1) * limit;

      let query      = 'SELECT * FROM clients WHERE 1=1';
      const params: any[] = [];
      let countQuery = 'SELECT COUNT(*) as total FROM clients WHERE 1=1';
      const countParams: any[] = [];

      if (search) {
        const like = `%${search}%`;
        query      += ' AND (company_name LIKE ? OR phone LIKE ? OR contact_person LIKE ? OR address LIKE ?)';
        params.push(like, like, like, like);
        countQuery += ' AND (company_name LIKE ? OR phone LIKE ? OR contact_person LIKE ? OR address LIKE ?)';
        countParams.push(like, like, like, like);
      }
      if (status) {
        query      += ' AND amc_status = ?'; params.push(status);
        countQuery += ' AND amc_status = ?'; countParams.push(status);
      }

      query += ' ORDER BY company_name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [clientsResult, countResult] = await Promise.all([
        db.prepare(query).bind(...params).all(),
        db.prepare(countQuery).bind(...countParams).first(),
      ]);

      return success({
        clients: clientsResult.results,
        total: countResult?.total ?? 0,
        page,
        limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      });
    } catch (err) {
      return error('Failed to fetch clients: ' + err.message, 500);
    }
  });

  // ── GET /api/clients/:id ──────────────────────────────────────────────
  router.get('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const client = await db.prepare('SELECT * FROM clients WHERE id = ?').bind(params.id).first();
      if (!client) return error('Client not found', 404);
      return success(client);
    } catch (err) {
      return error('Failed to fetch client: ' + err.message, 500);
    }
  });

  // ── POST /api/clients ─────────────────────────────────────────────────
  router.post('/api/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const { company_name, contact_person, address, phone, amc_status, amc_start, amc_end } = body;

      if (!company_name || !address) {
        return error('Missing required fields: company_name, address', 400);
      }

      const id = 'CLT-' + Date.now().toString(36).toUpperCase();

      await db
        .prepare(
          'INSERT INTO clients (id, company_name, contact_person, address, phone, amc_status, amc_start, amc_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          company_name,
          contact_person || null,
          address,
          phone || null,
          amc_status || 'Inactive',
          amc_start || null,
          amc_end || null
        )
        .run();

      return success({ id, company_name, amc_status: amc_status || 'Inactive' }, 201);
    } catch (err) {
      return error('Failed to create client: ' + err.message, 500);
    }
  });

  // ── PUT /api/clients/:id ──────────────────────────────────────────────
  router.put('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const existing = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(params.id).first();
      if (!existing) return error('Client not found', 404);

      const allowed = ['company_name', 'contact_person', 'address', 'phone', 'amc_status', 'amc_start', 'amc_end'];
      const updates: string[] = [];
      const values: any[] = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);
      values.push(params.id);

      await db.prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      return success({ message: 'Client updated' });
    } catch (err) {
      return error('Failed to update client: ' + err.message, 500);
    }
  });

  // ── DELETE /api/clients/:id ───────────────────────────────────────────
  router.delete('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const existing = await db.prepare('SELECT id FROM clients WHERE id = ?').bind(params.id).first();
      if (!existing) return error('Client not found', 404);

      await db.prepare('DELETE FROM clients WHERE id = ?').bind(params.id).run();
      return success({ message: 'Client deleted' });
    } catch (err) {
      return error('Failed to delete client: ' + err.message, 500);
    }
  });
}

export { register };
