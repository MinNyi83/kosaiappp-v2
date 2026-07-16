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
      const itemId = url.searchParams.get('item_id');

      let query =
        'SELECT b.*, i.name as item_name, i.sku FROM batches b LEFT JOIN inventory i ON b.item_id = i.id WHERE 1=1';
      const params = [];

      if (itemId) {
        query += ' AND b.item_id = ?';
        params.push(itemId);
      }
      query += ' ORDER BY b.created_at DESC';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();

      // Attach serial count to each batch
      const batches = await Promise.all(
        result.results.map(async (batch) => {
          const serialCount = await db
            .prepare(
              'SELECT COUNT(*) as count, status FROM serial_numbers WHERE batch_id = ? GROUP BY status'
            )
            .bind(batch.id)
            .all();
          return { ...batch, serials: serialCount.results };
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

      const { item_id, quantity, serials, supplier, cost_price, notes } = (await request.json() as any);
      if (!item_id || !quantity) return error('Missing item_id or quantity', 400);

      const batchId = 'BATCH-' + Date.now().toString(36).toUpperCase();

      // Create batch
      await db
        .prepare(
          'INSERT INTO batches (id, item_id, quantity, supplier, cost_price, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(batchId, item_id, quantity, supplier || null, cost_price || 0, notes || null, user.id)
        .run();

      // Create serial numbers
      if (serials && serials.length > 0) {
        const stmt = db.prepare(
          "INSERT INTO serial_numbers (id, batch_id, item_id, serial_number, status) VALUES (?, ?, ?, ?, 'available')"
        );
        for (const serial of serials) {
          const serialId =
            'SRL-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6);
          await stmt.bind(serialId, batchId, item_id, serial).run();
        }
      }

      // Update inventory quantity
      await db
        .prepare('UPDATE inventory SET quantity = quantity + ? WHERE id = ?')
        .bind(quantity, item_id)
        .run();

      return success({ id: batchId, item_id, quantity, serials_count: serials?.length || 0 }, 201);
    } catch (err) {
      return error('Failed to create batch: ' + err.message, 500);
    }
  });

  // ── PUT /api/batches/:id ──────────────────────────────────────────────
  router.put('/api/batches/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const allowed = ['supplier', 'cost_price', 'notes'];
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
        .prepare(`UPDATE batches SET ${updates.join(', ')} WHERE id = ?`)
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
      const itemId = url.searchParams.get('item_id');
      const search = url.searchParams.get('search');

      let query =
        'SELECT s.*, i.name as item_name, b.batch_number FROM serial_numbers s LEFT JOIN inventory i ON s.item_id = i.id LEFT JOIN batches b ON s.batch_id = b.id WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND s.status = ?';
        params.push(status);
      }
      if (itemId) {
        query += ' AND s.item_id = ?';
        params.push(itemId);
      }
      if (search) {
        query += ' AND s.serial_number LIKE ?';
        params.push(`%${search}%`);
      }

      query += ' ORDER BY s.created_at DESC LIMIT 200';

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
      const { serial } = (await request.json() as any);
      if (!serial) return error('Missing serial number', 400);

      const item = await db
        .prepare(
          'SELECT s.serial_number, s.status, s.created_at as registration_date, i.name as product_name, i.sku FROM serial_numbers s JOIN inventory i ON s.item_id = i.id WHERE s.serial_number = ?'
        )
        .bind(serial)
        .first();

      if (!item) return error('Serial number not found in system', 404);

      return success({
        valid: true,
        product: item.product_name,
        sku: item.sku,
        status: item.status,
        registered: item.registration_date,
      });
    } catch (err) {
      return error('Verification failed: ' + err.message, 500);
    }
  });
}

export { register };

