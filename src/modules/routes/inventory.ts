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
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '200'), 500);
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM inventory_stock WHERE 1=1';
      const params: any[] = [];
      let countQuery = 'SELECT COUNT(*) as total FROM inventory_stock WHERE 1=1';
      const countParams: any[] = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
        params.push(like, like, like);
        countQuery += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
        countParams.push(like, like, like);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
        countQuery += ' AND category = ?';
        countParams.push(category);
      }

      query += ' ORDER BY item_name ASC LIMIT ? OFFSET ?';
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
        total: countResult?.total ?? 0,
        page,
        limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
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

  // ── POST /api/inventory & /api/admin/inventory/add ────────────────────
  const addInventoryHandler = async (request: any) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const item_code = (body.item_code || body.sku || '').toUpperCase();
      const item_name = body.item_name || body.name || '';
      const category = body.category || '';
      const sub_category_id = body.sub_category_id || null;
      const brand_id = body.brand_id || null;
      const stocking_um = body.stocking_um || body.unit || 'pcs';
      const stock_qty = body.stock_qty || body.quantity || 0;
      const unit_price = body.unit_price || body.selling_price || 0;
      const unit_price_mmk = body.unit_price_mmk || 0;
      const buying_price = body.buying_price || body.cost_price || 0;
      const batch_code = body.batch_code || null;

      if (!item_code || !item_name) {
        return error('Missing required fields: item_code (sku), item_name (name)', 400);
      }

      // Check if item_code already exists
      const existing = await db
        .prepare('SELECT item_code FROM inventory_stock WHERE item_code = ?')
        .bind(item_code)
        .first();

      if (existing) {
        await db
          .prepare(
            `UPDATE inventory_stock 
             SET item_name = ?, category = ?, sub_category_id = ?, brand_id = ?, stocking_um = ?, stock_qty = ?, unit_price = ?, unit_price_mmk = ?, buying_price = ?, batch_code = ?
             WHERE item_code = ?`
          )
          .bind(
            item_name,
            category,
            sub_category_id,
            brand_id,
            stocking_um,
            stock_qty,
            unit_price,
            unit_price_mmk,
            buying_price,
            batch_code,
            item_code
          )
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO inventory_stock (item_code, item_name, category, sub_category_id, brand_id, stocking_um, stock_qty, unit_price, unit_price_mmk, buying_price, batch_code)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .bind(
            item_code,
            item_name,
            category,
            sub_category_id,
            brand_id,
            stocking_um,
            stock_qty,
            unit_price,
            unit_price_mmk,
            buying_price,
            batch_code
          )
          .run();
      }

      return success({ item_code, item_name }, 201);
    } catch (err: any) {
      return error('Failed to save inventory item: ' + err.message, 500);
    }
  };

  router.post('/api/inventory', addInventoryHandler);
  router.post('/api/admin/inventory/add', addInventoryHandler);

  // ── PUT /api/inventory/:id ────────────────────────────────────────────
  router.put('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const existing = await db
        .prepare('SELECT item_code FROM inventory_stock WHERE item_code = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Inventory item not found', 404);

      const allowed = [
        'item_name',
        'category',
        'sub_category_id',
        'brand_id',
        'stocking_um',
        'stock_qty',
        'unit_price',
        'unit_price_mmk',
        'buying_price',
        'batch_code',
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

      values.push(params.id);

      await db
        .prepare(`UPDATE inventory_stock SET ${updates.join(', ')} WHERE item_code = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Inventory item updated' });
    } catch (err: any) {
      return error('Failed to update inventory item: ' + err.message, 500);
    }
  });

  // ── DELETE /api/inventory/:id & /api/admin/inventory/delete ───────────
  router.delete('/api/inventory/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM inventory_stock WHERE item_code = ?').bind(params.id).run();
      return success({ message: 'Inventory item deleted' });
    } catch (err: any) {
      return error('Failed to delete inventory item: ' + err.message, 500);
    }
  });

  router.post('/api/admin/inventory/delete', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { item_code } = (await request.json()) as any;
      if (!item_code) return error('Missing item_code', 400);

      await db.prepare('DELETE FROM inventory_stock WHERE item_code = ?').bind(item_code).run();
      return success({ message: 'Inventory item deleted' });
    } catch (err: any) {
      return error('Failed to delete inventory item: ' + err.message, 500);
    }
  });

  // ── POST /api/inventory/:id/adjust ────────────────────────────────────
  router.post('/api/inventory/:id/adjust', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { quantity_change, reason } = (await request.json()) as any;
      if (quantity_change === undefined) {
        return error('Missing quantity_change', 400);
      }

      const item = await db
        .prepare('SELECT * FROM inventory_stock WHERE item_code = ?')
        .bind(params.id)
        .first();
      if (!item) return error('Inventory item not found', 404);

      const newQuantity = (item.stock_qty || 0) + quantity_change;
      if (newQuantity < 0) return error('Insufficient stock', 400);

      await db
        .prepare('UPDATE inventory_stock SET stock_qty = ? WHERE item_code = ?')
        .bind(newQuantity, params.id)
        .run();

      // Log the adjustment (catch gracefully if inventory_log table doesn't exist)
      try {
        await db
          .prepare(
            'INSERT INTO inventory_log (item_id, previous_quantity, new_quantity, change_amount, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(
            params.id,
            item.stock_qty || 0,
            newQuantity,
            quantity_change,
            reason || 'manual adjustment',
            user.id
          )
          .run();
      } catch (_) {}

      return success({
        id: params.id,
        previous_quantity: item.stock_qty || 0,
        new_quantity: newQuantity,
      });
    } catch (err: any) {
      return error('Failed to adjust inventory: ' + err.message, 500);
    }
  });

  // ── GET /api/inventory/low-stock ──────────────────────────────────────
  router.get('/api/inventory/low-stock', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      // inventory_stock doesn't have reorder_level, we filter by stock_qty <= 5
      const items = await db
        .prepare('SELECT * FROM inventory_stock WHERE stock_qty <= 5 ORDER BY stock_qty ASC')
        .all();

      return success(items.results);
    } catch (err: any) {
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
          'SELECT DISTINCT category FROM inventory_stock WHERE category IS NOT NULL ORDER BY category ASC'
        )
        .all();

      return success(result.results.map((r) => r.category));
    } catch (err) {
      return error('Failed to fetch categories: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/list (paginated) ────────────────────────
  router.get('/api/admin/inventory/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const search = url.searchParams.get('search') || '';
      const category = url.searchParams.get('category') || '';
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 500);
      const offset = (page - 1) * limit;

      let query = 'SELECT * FROM inventory_stock WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as total FROM inventory_stock WHERE 1=1';
      const params: any[] = [];
      const countParams: any[] = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
        params.push(like, like, like);
        countQuery += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
        countParams.push(like, like, like);
      }
      if (category) {
        query += ' AND category = ?';
        params.push(category);
        countQuery += ' AND category = ?';
        countParams.push(category);
      }

      const totalResult = await db
        .prepare(countQuery)
        .bind(...countParams)
        .first();
      const total = totalResult?.total || 0;

      query += ' ORDER BY item_name ASC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success({
        items: result.results,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      return error('Failed to fetch inventory list: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/batches ──────────────────────────────────
  router.get('/api/admin/inventory/batches', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db
        .prepare(
          `SELECT ib.*, is2.item_name, is2.category
         FROM inventory_batches ib
         LEFT JOIN inventory_stock is2 ON ib.item_code = is2.item_code
         ORDER BY ib.created_at DESC LIMIT 200`
        )
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch batches: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/categories ───────────────────────────────
  router.get('/api/admin/inventory/categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db.prepare('SELECT * FROM inv_categories ORDER BY name ASC').all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch categories: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/sub-categories ───────────────────────────
  router.get('/api/admin/inventory/sub-categories', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db
        .prepare(
          `
        SELECT s.*, c.name as category_name
        FROM inv_sub_categories s
        LEFT JOIN inv_categories c ON s.category_id = c.id
        ORDER BY s.name ASC
      `
        )
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch sub-categories: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/brands ───────────────────────────────────
  router.get('/api/admin/inventory/brands', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db.prepare('SELECT * FROM inv_brands ORDER BY name ASC').all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch brands: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/inventory/units ────────────────────────────────────
  router.get('/api/admin/inventory/units', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const result = await db.prepare('SELECT * FROM inv_stock_units ORDER BY name ASC').all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch units: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/warranty/list ──────────────────────────────────────
  // Stub: warranty table may not exist yet; return empty array gracefully
  router.get('/api/admin/warranty/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      // Try querying; if table doesn't exist, return empty
      try {
        const result = await db
          .prepare('SELECT * FROM warranty_records ORDER BY created_at DESC LIMIT 100')
          .all();
        return success(result.results);
      } catch (_) {
        return success([]);
      }
    } catch (err) {
      return error('Failed to fetch warranties: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/rma/list ───────────────────────────────────────────
  // Stub: RMA table may not exist yet; return empty array gracefully
  router.get('/api/admin/rma/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      try {
        const result = await db
          .prepare('SELECT * FROM rma_records ORDER BY created_at DESC LIMIT 100')
          .all();
        return success(result.results);
      } catch (_) {
        return success([]);
      }
    } catch (err) {
      return error('Failed to fetch RMA records: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/inventory/catalog/price ───────────────────────────
  router.post('/api/admin/inventory/catalog/price', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { item_code, unit_price, unit_price_mmk } = body;
      if (!item_code) return error('Missing item_code', 400);

      await db
        .prepare(
          'UPDATE inventory_stock SET unit_price = ?, unit_price_mmk = ? WHERE item_code = ?'
        )
        .bind(unit_price || 0, unit_price_mmk || 0, item_code)
        .run();

      return success({ message: 'Price updated successfully', item_code });
    } catch (err: any) {
      return error('Failed to update price: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/inventory/batches/create ──────────────────────────
  router.post('/api/admin/inventory/batches/create', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { batch_code, item_code, quantity, buying_price, supplier, serials } = body;

      if (!batch_code || !item_code || !quantity) {
        return error('Missing required fields: batch_code, item_code, quantity', 400);
      }

      // Check item details
      const item = await db
        .prepare('SELECT item_name FROM inventory_stock WHERE item_code = ?')
        .bind(item_code)
        .first();
      const deviceName = item ? item.item_name : 'Unknown Device';

      // Insert/Upsert batch
      const existingBatch = await db
        .prepare('SELECT batch_code FROM inventory_batches WHERE batch_code = ?')
        .bind(batch_code)
        .first();

      if (existingBatch) {
        await db
          .prepare(
            `UPDATE inventory_batches 
             SET item_code = ?, quantity = ?, remaining_qty = ?, buying_price = ?, supplier = ?
             WHERE batch_code = ?`
          )
          .bind(item_code, quantity, quantity, buying_price || 0, supplier || '', batch_code)
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO inventory_batches (batch_code, item_code, quantity, remaining_qty, buying_price, supplier)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(batch_code, item_code, quantity, quantity, buying_price || 0, supplier || '')
          .run();
      }

      // Insert Serials if provided
      if (Array.isArray(serials) && serials.length > 0) {
        for (const sn of serials) {
          if (!sn) continue;
          // Check if serial exists
          const existingSn = await db
            .prepare('SELECT serial_number FROM inventory_items WHERE serial_number = ?')
            .bind(sn)
            .first();

          if (!existingSn) {
            await db
              .prepare(
                `INSERT INTO inventory_items (serial_number, device_name, batch_code, status)
                 VALUES (?, ?, ?, 'Active')`
              )
              .bind(sn, deviceName, batch_code)
              .run();
          }
        }
      }

      // Recalculate inventory stock level
      const totalQty = await db
        .prepare(
          'SELECT COALESCE(SUM(remaining_qty), 0) as total FROM inventory_batches WHERE item_code = ?'
        )
        .bind(item_code)
        .first();
      const newStockQty = totalQty ? totalQty.total : 0;

      await db
        .prepare('UPDATE inventory_stock SET stock_qty = ? WHERE item_code = ?')
        .bind(newStockQty, item_code)
        .run();

      return success({ message: 'Batch registered successfully', batch_code, item_code });
    } catch (err: any) {
      return error('Failed to register batch: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/inventory/batches/edit ────────────────────────────
  router.post('/api/admin/inventory/batches/edit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { batch_code, buying_price, supplier, quantity } = body;
      if (!batch_code) return error('Missing batch_code', 400);

      await db
        .prepare(
          `UPDATE inventory_batches 
           SET buying_price = ?, supplier = ?, quantity = ?, remaining_qty = ?
           WHERE batch_code = ?`
        )
        .bind(buying_price || 0, supplier || '', quantity || 0, quantity || 0, batch_code)
        .run();

      return success({ message: 'Batch updated successfully', batch_code });
    } catch (err: any) {
      return error('Failed to edit batch: ' + err.message, 500);
    }
  });
}

export { register };
