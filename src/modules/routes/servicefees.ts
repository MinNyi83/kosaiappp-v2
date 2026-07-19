/**
 * Service Fees Routes — Manage service fee catalog
 * DB schema: service_fees(id INTEGER PK, service_type TEXT, fee_amount REAL, currency TEXT, description TEXT)
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

  // ── GET /api/service-fees ─────────────────────────────────────────────
  router.get('/api/service-fees', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const serviceType = url.searchParams.get('service_type');

      let query = 'SELECT * FROM service_fees WHERE 1=1';
      const params: any[] = [];

      if (serviceType) {
        query += ' AND service_type = ?';
        params.push(serviceType);
      }

      query += ' ORDER BY service_type ASC';
      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch service fees: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/service-fees/manage ───────────────────────────────
  // Handles create, update, delete actions from admin frontend
  router.post('/api/admin/service-fees/manage', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { action, id, service_type, fee_amount, currency, description } = body;

      if (action === 'create') {
        if (!service_type || fee_amount === undefined || !currency) {
          return error('Missing service_type, fee_amount, or currency', 400);
        }
        await db
          .prepare(
            'INSERT INTO service_fees (service_type, fee_amount, currency, description) VALUES (?, ?, ?, ?)'
          )
          .bind(service_type, parseFloat(fee_amount), currency, description || null)
          .run();
        return success({ message: 'Service rate created successfully.' });
      } else if (action === 'update') {
        if (!id) return error('Missing id', 400);
        await db
          .prepare(
            'UPDATE service_fees SET service_type = ?, fee_amount = ?, currency = ?, description = ? WHERE id = ?'
          )
          .bind(service_type, parseFloat(fee_amount), currency, description || null, id)
          .run();
        return success({ message: 'Service rate updated successfully.' });
      } else if (action === 'delete') {
        if (!id) return error('Missing id', 400);
        await db.prepare('DELETE FROM service_fees WHERE id = ?').bind(id).run();
        return success({ message: 'Service rate deleted successfully.' });
      } else {
        return error('Invalid action. Use create, update, or delete.', 400);
      }
    } catch (err) {
      return error('Service fee operation failed: ' + err.message, 500);
    }
  });

  // ── POST /api/service-fees (legacy create) ────────────────────────────
  router.post('/api/service-fees', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { service_type, fee_amount, currency, description } = body;
      if (!service_type || fee_amount === undefined || !currency) {
        return error('Missing service_type, fee_amount, or currency', 400);
      }
      await db
        .prepare(
          'INSERT INTO service_fees (service_type, fee_amount, currency, description) VALUES (?, ?, ?, ?)'
        )
        .bind(service_type, parseFloat(fee_amount), currency, description || null)
        .run();
      return success({ message: 'Service rate created.' }, 201);
    } catch (err) {
      return error('Failed to create service fee: ' + err.message, 500);
    }
  });

  // ── PUT /api/service-fees/:id ─────────────────────────────────────────
  router.put('/api/service-fees/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { service_type, fee_amount, currency, description } = body;
      await db
        .prepare(
          'UPDATE service_fees SET service_type = ?, fee_amount = ?, currency = ?, description = ? WHERE id = ?'
        )
        .bind(service_type, parseFloat(fee_amount), currency, description || null, params.id)
        .run();
      return success({ message: 'Service fee updated' });
    } catch (err) {
      return error('Failed to update service fee: ' + err.message, 500);
    }
  });

  // ── DELETE /api/service-fees/:id ──────────────────────────────────────
  router.delete('/api/service-fees/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      await db.prepare('DELETE FROM service_fees WHERE id = ?').bind(params.id).run();
      return success({ message: 'Service fee deleted' });
    } catch (err) {
      return error('Failed to delete service fee: ' + err.message, 500);
    }
  });
}

export { register };
