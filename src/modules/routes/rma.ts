/**
 * RMA Routes — Return Merchandise Authorization management
 */

import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';

function register(router, env) {
  const db = env.DB;

  // ── GET /api/rma ──────────────────────────────────────────────────────
  router.get('/api/rma', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');

      let query =
        'SELECT r.*, c.name as client_name FROM rma_requests r LEFT JOIN clients c ON r.client_id = c.id WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND r.status = ?';
        params.push(status);
      }
      query += ' ORDER BY r.created_at DESC';

      try {
        const result = await db
          .prepare(query)
          .bind(...params)
          .all();
        return success(result.results);
      } catch (_) {
        // Table may not exist yet — return empty list
        return success([]);
      }
    } catch (err) {
      return error('Failed to fetch RMA requests: ' + err.message, 500);
    }
  });

  // ── POST /api/rma ─────────────────────────────────────────────────────
  router.post('/api/rma', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { client_id, serial_number, item_id, issue_description, notes } =
        (await request.json()) as any;
      if (!client_id || !issue_description) {
        return error('Missing required fields: client_id, issue_description', 400);
      }

      const id = 'RMA-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO rma_requests (id, client_id, serial_number, item_id, issue_description, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"
        )
        .bind(
          id,
          client_id,
          serial_number || null,
          item_id || null,
          issue_description,
          notes || null,
          user.id
        )
        .run();

      // Update serial status if provided
      if (serial_number) {
        await db
          .prepare("UPDATE serial_numbers SET status = 'rma' WHERE serial_number = ?")
          .bind(serial_number)
          .run();
      }

      return success({ id, status: 'pending' }, 201);
    } catch (err) {
      return error('Failed to create RMA request: ' + err.message, 500);
    }
  });

  // ── PUT /api/rma/:id/status ───────────────────────────────────────────
  router.put('/api/rma/:id/status', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const { status, resolution_notes } = (await request.json()) as any;
      const validStatuses = [
        'pending',
        'approved',
        'received',
        'repairing',
        'repaired',
        'replaced',
        'rejected',
        'closed',
      ];

      if (!validStatuses.includes(status)) {
        return error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      const existing = await db
        .prepare('SELECT id, status FROM rma_requests WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('RMA request not found', 404);

      await db
        .prepare(
          "UPDATE rma_requests SET status = ?, resolution_notes = ?, resolved_by = ?, resolved_at = datetime('now') WHERE id = ?"
        )
        .bind(status, resolution_notes || null, user.id, params.id)
        .run();

      return success({ id: params.id, previous_status: existing.status, new_status: status });
    } catch (err) {
      return error('Failed to update RMA status: ' + err.message, 500);
    }
  });

  // ── GET /api/warranty/check ───────────────────────────────────────────
  router.get('/api/warranty/check', async (request) => {
    try {
      const url = new URL(request.url);
      const serial = url.searchParams.get('serial');

      if (!serial) return error('Missing serial parameter', 400);

      const item = await db
        .prepare(
          'SELECT s.serial_number, s.created_at as sale_date, i.name as product_name, i.warranty_period_days FROM serial_numbers s JOIN inventory i ON s.item_id = i.id WHERE s.serial_number = ?'
        )
        .bind(serial)
        .first();

      if (!item) return error('Serial number not found', 404);

      const saleDate = new Date(item.sale_date);
      const warrantyDays = item.warranty_period_days || 365;
      const expiryDate = new Date(saleDate);
      expiryDate.setDate(expiryDate.getDate() + warrantyDays);
      const isInWarranty = new Date() <= expiryDate;

      return success({
        product: item.product_name,
        serial: item.serial_number,
        sale_date: item.sale_date,
        warranty_period_days: warrantyDays,
        warranty_expiry: expiryDate.toISOString().split('T')[0],
        in_warranty: isInWarranty,
        days_remaining: isInWarranty
          ? Math.floor((expiryDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
          : 0,
      });
    } catch (err) {
      return error('Warranty check failed: ' + err.message, 500);
    }
  });
}

export { register };
