/**
 * Distributors Routes — Distributor directory management
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

  // ── GET /api/distributors ─────────────────────────────────────────────
  router.get('/api/distributors', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search = url.searchParams.get('search');

      let query = 'SELECT * FROM distributors WHERE 1=1';
      const params = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (name LIKE ? OR contact_person LIKE ? OR phone LIKE ?)';
        params.push(like, like, like);
      }

      query += ' ORDER BY name ASC';
      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch distributors: ' + err.message, 500);
    }
  });

  // ── POST /api/distributors ────────────────────────────────────────────
  router.post('/api/distributors', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { name, contact_person, phone, email, notes } = (await request.json()) as any;
      if (!name) return error('Missing distributor name', 400);

      const result = await db
        .prepare(
          'INSERT INTO distributors (name, contact_person, phone, email, product_lines) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(
          name,
          contact_person || null,
          phone || null,
          email || null,
          notes || null
        )
        .run();

      return success({ id: result.meta?.last_row_id, name }, 201);
    } catch (err) {
      return error('Failed to create distributor: ' + err.message, 500);
    }
  });

  // ── PUT /api/distributors/:id ─────────────────────────────────────────
  router.put('/api/distributors/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const allowed = ['name', 'contact_person', 'phone', 'email', 'product_lines'];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);
      values.push(params.id);

      await db
        .prepare(`UPDATE distributors SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Distributor updated' });
    } catch (err) {
      return error('Failed to update distributor: ' + err.message, 500);
    }
  });

  // ── DELETE /api/distributors/:id ──────────────────────────────────────
  router.delete('/api/distributors/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM distributors WHERE id = ?').bind(params.id).run();
      return success({ message: 'Distributor deleted' });
    } catch (err) {
      return error('Failed to delete distributor: ' + err.message, 500);
    }
  });

  // ── Alias routes for /api/admin/distributors/* (frontend paths) ───────
  router.get('/api/admin/distributors/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db.prepare('SELECT * FROM distributors ORDER BY name ASC').all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch distributors: ' + err.message, 500);
    }
  });

  router.post('/api/admin/distributors/add', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const { name, contact_person, phone, email, notes } = (await request.json()) as any;
      if (!name) return error('Missing distributor name', 400);
      const result = await db.prepare('INSERT INTO distributors (name, contact_person, phone, email, product_lines) VALUES (?, ?, ?, ?, ?)').bind(name, contact_person || null, phone || null, email || null, notes || null).run();
      return success({ id: result.meta?.last_row_id, name }, 201);
    } catch (err) {
      return error('Failed to create distributor: ' + err.message, 500);
    }
  });

  router.post('/api/admin/distributors/delete', async (request) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return error('Missing id parameter', 400);
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      await db.prepare('DELETE FROM distributors WHERE id = ?').bind(id).run();
      return success({ message: 'Distributor deleted' });
    } catch (err) {
      return error('Failed to delete distributor: ' + err.message, 500);
    }
  });
}

export { register };
