/**
 * Inventory Routes — CRUD for inventory items, stock tracking, low-stock alerts
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

  // ── GET /api/inventory ────────────────────────────────────────────────
  router.get('/api/inventory', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search = url.searchParams.get('search');
      const category = url.searchParams.get('category');
      const lowStock = url.searchParams.get('low_stock');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM inventory WHERE 1=1';
      const params = [];
      let countQuery = 'SELECT COUNT(*) as total FROM inventory WHERE 1=1';
      const countParams = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
        params.push(like, like, like);
        countQuery += ' AND (name LIKE ? OR sku LIKE ? OR description LIKE ?)';
        countParams.push(like, like, like);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
        countQuery += ' AND category = ?';
        countParams.push(category);
      }
      if (lowStock === 'true') {
        query += ' AND quantity <= reorder_level';
        countQuery += ' AND quantity <= reorder_level';
      }

      query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [itemsResult, countResult] = await Promise.all([
        db
          .prepare(query)
          .bind(...params)
          .all(),
        db
          .prepare(countQuery)
          .bind(...countParams)
          .first(),
      ]);

      return success({
        items: itemsResult.results,
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit),
      });
    } catch (err) {
      return error('Failed to fetch inventory: ' + err.message, 500);
    }
  });

  // ── GET /api/inventory/:id ────────────────────────────────────────────
  router.get('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const item = await db.prepare('SELECT * FROM inventory WHERE id = ?').bind(params.id).first();
      if (!item) return error('Inventory item not found', 404);

      return success(item);
    } catch (err) {
      return error('Failed to fetch item: ' + err.message, 500);
    }
  });

  // ── POST /api/inventory ───────────────────────────────────────────────
  router.post('/api/inventory', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = await request.json();
      const {
        name,
        sku,
        category,
        quantity,
        unit,
        reorder_level,
        description,
        cost_price,
        selling_price,
      } = body;

      if (!name || !sku) {
        return error('Missing required fields: name, sku', 400);
      }

      const id = 'INV-' + Date.now().toString(36).toUpperCase();

      await db
        .prepare(
          'INSERT INTO inventory (id, name, sku, category, quantity, unit, reorder_level, description, cost_price, selling_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          name,
          sku,
          category || null,
          quantity || 0,
          unit || 'pcs',
          reorder_level || 0,
          description || null,
          cost_price || 0,
          selling_price || 0
        )
        .run();

      return success({ id, name, sku }, 201);
    } catch (err) {
      return error('Failed to create inventory item: ' + err.message, 500);
    }
  });

  // ── PUT /api/inventory/:id ────────────────────────────────────────────
  router.put('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = await request.json();
      const existing = await db
        .prepare('SELECT id FROM inventory WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Inventory item not found', 404);

      const allowed = [
        'name',
        'sku',
        'category',
        'quantity',
        'unit',
        'reorder_level',
        'description',
        'cost_price',
        'selling_price',
      ];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);

      updates.push("updated_at = datetime('now')");
      values.push(params.id);

      await db
        .prepare(`UPDATE inventory SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Inventory item updated' });
    } catch (err) {
      return error('Failed to update inventory item: ' + err.message, 500);
    }
  });

  // ── DELETE /api/inventory/:id ─────────────────────────────────────────
  router.delete('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const existing = await db
        .prepare('SELECT id FROM inventory WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Inventory item not found', 404);

      await db.prepare('DELETE FROM inventory WHERE id = ?').bind(params.id).run();
      return success({ message: 'Inventory item deleted' });
    } catch (err) {
      return error('Failed to delete inventory item: ' + err.message, 500);
    }
  });

  // ── POST /api/inventory/:id/adjust ────────────────────────────────────
  router.post('/api/inventory/:id/adjust', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { quantity_change, reason } = await request.json();
      if (quantity_change === undefined) {
        return error('Missing quantity_change', 400);
      }

      const item = await db.prepare('SELECT * FROM inventory WHERE id = ?').bind(params.id).first();
      if (!item) return error('Inventory item not found', 404);

      const newQuantity = item.quantity + quantity_change;
      if (newQuantity < 0) return error('Insufficient stock', 400);

      await db
        .prepare("UPDATE inventory SET quantity = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(newQuantity, params.id)
        .run();

      // Log the adjustment
      await db
        .prepare(
          'INSERT INTO inventory_log (item_id, previous_quantity, new_quantity, change_amount, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(
          params.id,
          item.quantity,
          newQuantity,
          quantity_change,
          reason || 'manual adjustment',
          user.id
        )
        .run();

      return success({
        id: params.id,
        previous_quantity: item.quantity,
        new_quantity: newQuantity,
      });
    } catch (err) {
      return error('Failed to adjust inventory: ' + err.message, 500);
    }
  });

  // ── GET /api/inventory/low-stock ──────────────────────────────────────
  router.get('/api/inventory/low-stock', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const items = await db
        .prepare(
          'SELECT * FROM inventory WHERE quantity <= reorder_level ORDER BY (quantity * 1.0 / CASE WHEN reorder_level = 0 THEN 1 ELSE reorder_level END) ASC'
        )
        .all();

      return success(items.results);
    } catch (err) {
      return error('Failed to fetch low stock items: ' + err.message, 500);
    }
  });

  // ── GET /api/inventory/categories ─────────────────────────────────────
  router.get('/api/inventory/categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await db
        .prepare(
          'SELECT DISTINCT category FROM inventory WHERE category IS NOT NULL ORDER BY category ASC'
        )
        .all();

      return success(result.results.map((r) => r.category));
    } catch (err) {
      return error('Failed to fetch categories: ' + err.message, 500);
    }
  });
}

export { register };
