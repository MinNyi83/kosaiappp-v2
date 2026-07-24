/**
 * Batches & Serials Routes — Stock batch management with serial number tracking
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

  // ── GET /api/batches ──────────────────────────────────────────────────
  router.get('/api/batches', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const itemCode = url.searchParams.get('item_code') || url.searchParams.get('item_id');

      let query =
        'SELECT b.*, i.item_name FROM inventory_batches b LEFT JOIN inventory_stock i ON b.item_code = i.item_code WHERE 1=1';
      const params: any[] = [];

      if (itemCode) {
        query += ' AND b.item_code = ?';
        params.push(itemCode);
      }
      query += ' ORDER BY b.created_at DESC';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();

      // Attach serial count to each batch
      const batches = await Promise.all(
        result.results.map(async (batch: any) => {
          try {
            const serialCount = await db
              .prepare(
                'SELECT COUNT(*) as count, status FROM inventory_items WHERE batch_code = ? GROUP BY status'
              )
              .bind(batch.batch_code)
              .all();
            return { ...batch, serials: serialCount.results };
          } catch (_) {
            return { ...batch, serials: [] };
          }
        })
      );

      return success(batches);
    } catch (err) {
      return error('Failed to fetch batches: ' + err.message, 500);
    }
  });

  // ── POST /api/batches ─────────────────────────────────────────────────
  router.post('/api/batches', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const item_code = body.item_code || body.item_id;
      const quantity = body.quantity || body.manual_qty || 0;
      const { serials, supplier, buying_price, batch_code: inputBatchCode } = body;
      if (!item_code || !quantity) return error('Missing item_code or quantity', 400);

      const batchCode = inputBatchCode || 'BATCH-' + Date.now().toString(36).toUpperCase();

      // Look up item name
      const item = await db
        .prepare('SELECT item_name FROM inventory_stock WHERE item_code = ?')
        .bind(item_code)
        .first();
      const deviceName = item ? item.item_name : 'Unknown Device';

      // Create batch in inventory_batches
      await db
        .prepare(
          'INSERT INTO inventory_batches (batch_code, item_code, quantity, remaining_qty, buying_price, supplier) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(batchCode, item_code, quantity, quantity, buying_price || 0, supplier || '')
        .run();

      // Create serial numbers in inventory_items
      if (serials && serials.length > 0) {
        for (const serial of serials) {
          if (!serial) continue;
          const existingSn = await db
            .prepare('SELECT serial_number FROM inventory_items WHERE serial_number = ?')
            .bind(serial)
            .first();
          if (!existingSn) {
            await db
              .prepare(
                "INSERT INTO inventory_items (serial_number, device_name, batch_code, status) VALUES (?, ?, ?, 'Active')"
              )
              .bind(serial, deviceName, batchCode)
              .run();
          }
        }
      }

      // Recalculate inventory stock level
      const totalQty = await db
        .prepare('SELECT COALESCE(SUM(remaining_qty), 0) as total FROM inventory_batches WHERE item_code = ?')
        .bind(item_code)
        .first();
      const newStockQty = totalQty ? totalQty.total : 0;
      await db
        .prepare('UPDATE inventory_stock SET stock_qty = ? WHERE item_code = ?')
        .bind(newStockQty, item_code)
        .run();

      return success({ id: batchCode, item_code, quantity, serials_count: serials?.length || 0 }, 201);
    } catch (err) {
      return error('Failed to create batch: ' + err.message, 500);
    }
  });

  // ── PUT /api/batches/:id ──────────────────────────────────────────────
  router.put('/api/batches/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const allowed = ['supplier', 'buying_price', 'quantity', 'remaining_qty'];
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

      await db
        .prepare(`UPDATE inventory_batches SET ${updates.join(', ')} WHERE batch_code = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Batch updated' });
    } catch (err) {
      return error('Failed to update batch: ' + err.message, 500);
    }
  });

  // ── GET /api/serials ──────────────────────────────────────────────────
  router.get('/api/serials', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const itemCode = url.searchParams.get('item_code') || url.searchParams.get('item_id');
      const search = url.searchParams.get('search');

      let query =
        'SELECT s.*, i.item_name, s.batch_code FROM inventory_items s LEFT JOIN inventory_stock i ON s.batch_code IN (SELECT batch_code FROM inventory_batches WHERE item_code = i.item_code) WHERE 1=1';
      const params: any[] = [];

      if (status) {
        query += ' AND s.status = ?';
        params.push(status);
      }
      if (search) {
        query += ' AND s.serial_number LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY s.installed_date DESC LIMIT 200';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch serials: ' + err.message, 500);
    }
  });

  // ── POST /api/serials/verify ──────────────────────────────────────────
  router.post('/api/serials/verify', async (request) => {
    try {
      const { serial } = (await request.json()) as any;
      if (!serial) return error('Missing serial number', 400);

      const item = await db
        .prepare(
          'SELECT s.serial_number, s.status, s.installed_date as registration_date, s.device_name as product_name, s.batch_code FROM inventory_items s WHERE s.serial_number = ?'
        )
        .bind(serial)
        .first();

      if (!item) return error('Serial number not found in system', 404);

      return success({
        valid: true,
        product: item.product_name,
        sku: item.batch_code,
        status: item.status,
        registered: item.registration_date,
      });
    } catch (err) {
      return error('Verification failed: ' + err.message, 500);
    }
  });
}

export { register };
