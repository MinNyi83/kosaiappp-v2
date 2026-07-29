/**
 * Service Fees Routes — Manage service fee catalog (upgraded)
 * DB schema: service_fees(id, service_type, fee_amount, currency, description, category, unit, min_charge, active, sort_order, created_at, updated_at)
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';

function register(router, env) {
  const db = env.DB;

  // ── GET /api/service-fees ─────────────────────────────────────────────
  // Public-facing (requires auth). Supports ?category=X&active=1&q=search
  router.get('/api/service-fees', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const active = url.searchParams.get('active');
      const q = url.searchParams.get('q');

      let query = 'SELECT * FROM service_fees WHERE 1=1';
      const params: any[] = [];

      if (category) {
        query += ' AND category = ?';
        params.push(category);
      }
      if (active !== null && active !== undefined && active !== '') {
        query += ' AND active = ?';
        params.push(parseInt(active, 10));
      }
      if (q) {
        query += ' AND (service_type LIKE ? OR description LIKE ? OR category LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like);
      }

      query += ' ORDER BY category ASC, sort_order ASC, service_type ASC';
      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch service fees: ' + err.message, 500);
    }
  });

  // ── GET /api/service-fees/stats ───────────────────────────────────────
  // Aggregate stats for the dashboard cards
  router.get('/api/service-fees/stats', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) as active_count,
          SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) as inactive_count,
          COUNT(DISTINCT category) as categories,
          ROUND(AVG(fee_amount), 2) as avg_rate,
          SUM(CASE WHEN currency = 'MMK' THEN fee_amount ELSE 0 END) as total_mmk,
          SUM(CASE WHEN currency = 'USD' THEN fee_amount ELSE 0 END) as total_usd
        FROM service_fees
      `).first();
      return success(result);
    } catch (err) {
      return error('Failed to fetch stats: ' + err.message, 500);
    }
  });

  // ── GET /api/service-fees/categories ──────────────────────────────────
  // List distinct categories with counts
  router.get('/api/service-fees/categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db.prepare(`
        SELECT category, COUNT(*) as count, ROUND(AVG(fee_amount), 2) as avg_rate
        FROM service_fees
        GROUP BY category
        ORDER BY category ASC
      `).all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch categories: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/service-fees/manage ───────────────────────────────
  // Handles create, update, delete, bulk_delete, toggle_active actions
  router.post('/api/admin/service-fees/manage', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { action, id, ids, service_type, fee_amount, currency, description, category, unit, min_charge, active, sort_order } = body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

      if (action === 'create') {
        if (!service_type || fee_amount === undefined || !currency) {
          return error('Missing service_type, fee_amount, or currency', 400);
        }
        await db.prepare(
          `INSERT INTO service_fees (service_type, fee_amount, currency, description, category, unit, min_charge, active, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          service_type,
          parseFloat(fee_amount),
          currency,
          description || null,
          category || 'General',
          unit || 'per job',
          parseFloat(min_charge || '0'),
          active !== undefined ? (active ? 1 : 0) : 1,
          parseInt(sort_order || '0', 10),
          now,
          now
        ).run();
        return success({ message: 'Service rate created successfully.' });
      } else if (action === 'update') {
        if (!id) return error('Missing id', 400);
        await db.prepare(
          `UPDATE service_fees SET service_type=?, fee_amount=?, currency=?, description=?, category=?, unit=?, min_charge=?, active=?, sort_order=?, updated_at=? WHERE id=?`
        ).bind(
          service_type,
          parseFloat(fee_amount),
          currency,
          description || null,
          category || 'General',
          unit || 'per job',
          parseFloat(min_charge || '0'),
          active !== undefined ? (active ? 1 : 0) : 1,
          parseInt(sort_order || '0', 10),
          now,
          id
        ).run();
        return success({ message: 'Service rate updated successfully.' });
      } else if (action === 'delete') {
        if (!id) return error('Missing id', 400);
        await db.prepare('DELETE FROM service_fees WHERE id = ?').bind(id).run();
        return success({ message: 'Service rate deleted successfully.' });
      } else if (action === 'bulk_delete') {
        if (!ids || !Array.isArray(ids) || ids.length === 0) return error('Missing ids array', 400);
        const placeholders = ids.map(() => '?').join(',');
        await db.prepare(`DELETE FROM service_fees WHERE id IN (${placeholders})`).bind(...ids).run();
        return success({ message: `${ids.length} service rate(s) deleted.` });
      } else if (action === 'toggle_active') {
        if (!id) return error('Missing id', 400);
        await db.prepare('UPDATE service_fees SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?').bind(now, id).run();
        return success({ message: 'Service rate toggled.' });
      } else {
        return error('Invalid action. Use create, update, delete, bulk_delete, or toggle_active.', 400);
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { service_type, fee_amount, currency, description } = body;
      if (!service_type || fee_amount === undefined || !currency) {
        return error('Missing service_type, fee_amount, or currency', 400);
      }
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await db.prepare(
        `INSERT INTO service_fees (service_type, fee_amount, currency, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`
      ).bind(service_type, parseFloat(fee_amount), currency, description || null, now, now).run();
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { service_type, fee_amount, currency, description } = body;
      const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
      await db.prepare(
        `UPDATE service_fees SET service_type=?, fee_amount=?, currency=?, description=?, updated_at=? WHERE id=?`
      ).bind(service_type, parseFloat(fee_amount), currency, description || null, now, params.id).run();
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      await db.prepare('DELETE FROM service_fees WHERE id = ?').bind(params.id).run();
      return success({ message: 'Service fee deleted' });
    } catch (err) {
      return error('Failed to delete service fee: ' + err.message, 500);
    }
  });
}

export { register };
