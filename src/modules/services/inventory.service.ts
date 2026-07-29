/**
 * Inventory Service — Business logic for inventory management
 *
 * Extracted from routes/inventory.ts for modular monolith architecture.
 * Handles inventory CRUD, stock tracking, batches, warranty, RMA.
 */

const LOW_STOCK_THRESHOLD = 5;

export interface InventoryItemCreateDTO {
  item_code: string;
  item_name: string;
  category?: string;
  sub_category_id?: string;
  brand_id?: string;
  stocking_um?: string;
  stock_qty?: number;
  unit_price?: number;
  unit_price_mmk?: number;
  buying_price?: number;
  batch_code?: string;
}

export interface InventoryItemUpdateDTO {
  item_name?: string;
  category?: string;
  stock_qty?: number;
  unit_price?: number;
  unit_price_mmk?: number;
  buying_price?: number;
  batch_code?: string;
}

export interface InventoryListFilters {
  search?: string;
  category?: string;
  page?: number;
  limit?: number;
}

export class InventoryService {
  constructor(private db: D1Database) {}

  async list(filters: InventoryListFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 200, 500);
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM inventory_stock WHERE 1=1';
    const params: any[] = [];
    let countQuery = 'SELECT COUNT(*) as total FROM inventory_stock WHERE 1=1';
    const countParams: any[] = [];

    if (filters.search) {
      const like = `%${filters.search}%`;
      query += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
      params.push(like, like, like);
      countQuery += ' AND (item_name LIKE ? OR item_code LIKE ? OR category LIKE ?)';
      countParams.push(like, like, like);
    }
    if (filters.category) {
      query += ' AND category = ?';
      params.push(filters.category);
      countQuery += ' AND category = ?';
      countParams.push(filters.category);
    }

    query += ' ORDER BY item_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [itemsResult, countResult] = await Promise.all([
      this.db.prepare(query).bind(...params).all(),
      this.db.prepare(countQuery).bind(...countParams).first(),
    ]);

    return {
      items: itemsResult.results,
      total: countResult?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil(Number(countResult?.total ?? 0) / limit),
    };
  }

  async getLowStock() {
    const items = await this.db
      .prepare(`SELECT * FROM inventory_stock WHERE stock_qty <= ? ORDER BY stock_qty ASC`)
      .bind(LOW_STOCK_THRESHOLD)
      .all();
    return items.results;
  }

  async getCategories() {
    const result = await this.db
      .prepare('SELECT DISTINCT category FROM inventory_stock WHERE category IS NOT NULL ORDER BY category ASC')
      .all();
    return result.results.map((r: any) => r.category);
  }

  async getById(itemCode: string) {
    const item = await this.db.prepare('SELECT * FROM inventory_stock WHERE item_code = ?').bind(itemCode).first();
    return item || null;
  }

  async create(data: InventoryItemCreateDTO) {
    const itemCode = data.item_code.toUpperCase();
    const existing = await this.db
      .prepare('SELECT item_code FROM inventory_stock WHERE item_code = ?')
      .bind(itemCode)
      .first();

    if (existing) {
      await this.db
        .prepare(
          `UPDATE inventory_stock
           SET item_name = ?, category = ?, sub_category_id = ?, brand_id = ?, stocking_um = ?, stock_qty = ?, unit_price = ?, unit_price_mmk = ?, buying_price = ?, batch_code = ?
           WHERE item_code = ?`
        )
        .bind(
          data.item_name, data.category || '', data.sub_category_id || null,
          data.brand_id || null, data.stocking_um || 'pcs', data.stock_qty || 0,
          data.unit_price || 0, data.unit_price_mmk || 0, data.buying_price || 0,
          data.batch_code || null, itemCode
        )
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO inventory_stock (item_code, item_name, category, stock_qty, unit_price, unit_price_mmk, buying_price, batch_code)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          itemCode, data.item_name, data.category || '',
          data.stock_qty || 0, data.unit_price || 0, data.unit_price_mmk || 0,
          data.buying_price || 0, data.batch_code || null
        )
        .run();
    }

    return { item_code: itemCode, item_name: data.item_name };
  }

  async update(itemCode: string, data: InventoryItemUpdateDTO) {
    const allowed = ['item_name', 'category', 'stock_qty', 'unit_price', 'unit_price_mmk', 'buying_price', 'batch_code'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowed) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push((data as any)[field]);
      }
    }

    if (updates.length === 0) return false;
    values.push(itemCode);

    await this.db
      .prepare(`UPDATE inventory_stock SET ${updates.join(', ')} WHERE item_code = ?`)
      .bind(...values)
      .run();
    return true;
  }

  async delete(itemCode: string) {
    await this.db.prepare('DELETE FROM inventory_stock WHERE item_code = ?').bind(itemCode).run();
  }

  async adjustStock(itemCode: string, quantityChange: number, userId: string, reason?: string) {
    if (!Number.isInteger(quantityChange)) {
      return { error: 'quantity_change must be an integer' };
    }

    const item: any = await this.db
      .prepare('SELECT * FROM inventory_stock WHERE item_code = ?')
      .bind(itemCode)
      .first();
    if (!item) return { error: 'not_found' };

    const newQuantity = (item.stock_qty || 0) + quantityChange;
    if (newQuantity < 0) return { error: 'insufficient_stock' };

    await this.db
      .prepare('UPDATE inventory_stock SET stock_qty = ? WHERE item_code = ?')
      .bind(newQuantity, itemCode)
      .run();

    try {
      await this.db
        .prepare(
          'INSERT INTO inventory_log (item_id, previous_quantity, new_quantity, change_amount, reason, changed_by) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .bind(itemCode, item.stock_qty || 0, newQuantity, quantityChange, reason || 'manual adjustment', userId)
        .run();
    } catch (_) {}

    return {
      id: itemCode,
      previous_quantity: item.stock_qty || 0,
      new_quantity: newQuantity,
    };
  }

  // ── Warranty ──────────────────────────────────────────────────────────

  async getWarrantyList() {
    const result = await this.db
      .prepare('SELECT i.*, c.company_name FROM inventory_items i LEFT JOIN clients c ON i.client_id = c.id ORDER BY i.installed_date DESC LIMIT 100')
      .all();
    return result.results;
  }

  async registerWarranty(data: { serial_number: string; device_name: string; client_id?: string; installed_date?: string; warranty_months?: number; job_id?: string }) {
    const existing = await this.db
      .prepare('SELECT serial_number, status FROM inventory_items WHERE serial_number = ?')
      .bind(data.serial_number)
      .first();
    if (existing) return { error: 'already_registered' };

    await this.db
      .prepare(
        'INSERT OR REPLACE INTO inventory_items (serial_number, device_name, client_id, installed_date, warranty_months, status, job_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .bind(
        data.serial_number, data.device_name, data.client_id || null,
        data.installed_date || new Date().toISOString().split('T')[0],
        data.warranty_months || 12, 'Active', data.job_id || null
      )
      .run();

    return { serial_number: data.serial_number, status: 'Active', warranty_months: data.warranty_months || 12 };
  }

  async lookupWarranty(serial: string) {
    const item: any = await this.db
      .prepare('SELECT i.*, c.company_name FROM inventory_items i LEFT JOIN clients c ON i.client_id = c.id WHERE i.serial_number = ?')
      .bind(serial)
      .first();

    if (!item) return null;

    const installed = new Date(item.installed_date);
    const warrantyEnd = new Date(installed);
    warrantyEnd.setMonth(warrantyEnd.getMonth() + (item.warranty_months || 12));
    const now = new Date();
    const isActive = now <= warrantyEnd && item.status === 'Active';
    const daysLeft = Math.ceil((warrantyEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      ...item,
      warranty_end: warrantyEnd.toISOString().split('T')[0],
      warranty_active: isActive,
      warranty_days_left: daysLeft,
    };
  }

  // ── RMA ───────────────────────────────────────────────────────────────

  async getRmaList() {
    const result = await this.db
      .prepare("SELECT * FROM inventory_items WHERE status IN ('RMA Sent', 'RMA Completed') ORDER BY installed_date DESC LIMIT 100")
      .all();
    return result.results;
  }

  async raiseRma(serialNumber: string, distributor?: string, rmaId?: string, sentDate?: string) {
    const existing = await this.db
      .prepare('SELECT serial_number, status FROM inventory_items WHERE serial_number = ?')
      .bind(serialNumber)
      .first();
    if (!existing) return { error: 'not_found' };

    await this.db
      .prepare(
        "UPDATE inventory_items SET status = 'RMA Sent', distributor = ?, rma_tracking_id = ?, installed_date = COALESCE(?, installed_date) WHERE serial_number = ?"
      )
      .bind(distributor || null, rmaId || null, sentDate || null, serialNumber)
      .run();

    return { serial_number: serialNumber, status: 'RMA Sent' };
  }

  async updateRma(serialNumber: string, status?: string, distributor?: string, rmaTrackingId?: string) {
    const validStatuses = ['Active', 'Defective', 'RMA Sent', 'RMA Completed', 'Replaced'];
    if (status && !validStatuses.includes(status)) {
      return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    await this.db
      .prepare(
        'UPDATE inventory_items SET status = ?, distributor = ?, rma_tracking_id = ? WHERE serial_number = ?'
      )
      .bind(status || 'RMA Completed', distributor || null, rmaTrackingId || null, serialNumber)
      .run();

    return { serial_number: serialNumber, status: status || 'RMA Completed' };
  }

  // ── Batches ───────────────────────────────────────────────────────────

  async getBatches() {
    const result = await this.db
      .prepare(
        `SELECT ib.*, is2.item_name, is2.category
       FROM inventory_batches ib
       LEFT JOIN inventory_stock is2 ON ib.item_code = is2.item_code
       ORDER BY ib.created_at DESC LIMIT 200`
      )
      .all();
    return result.results;
  }

  async createBatch(data: { batch_code: string; item_code: string; buying_price?: number; supplier?: string; serials?: string[]; quantity?: number }) {
    const quantity = data.quantity || 0;
    if (!data.batch_code || !data.item_code || !quantity) {
      return { error: 'Missing required fields: batch_code, item_code, quantity' };
    }

    const item: any = await this.db
      .prepare('SELECT item_name FROM inventory_stock WHERE item_code = ?')
      .bind(data.item_code)
      .first();
    const deviceName = item ? item.item_name : 'Unknown Device';

    const existingBatch = await this.db
      .prepare('SELECT batch_code FROM inventory_batches WHERE batch_code = ?')
      .bind(data.batch_code)
      .first();

    if (existingBatch) {
      await this.db
        .prepare(
          `UPDATE inventory_batches
           SET item_code = ?, quantity = ?, remaining_qty = ?, buying_price = ?, supplier = ?
           WHERE batch_code = ?`
        )
        .bind(data.item_code, quantity, quantity, data.buying_price || 0, data.supplier || '', data.batch_code)
        .run();
    } else {
      await this.db
        .prepare(
          `INSERT INTO inventory_batches (batch_code, item_code, quantity, remaining_qty, buying_price, supplier)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(data.batch_code, data.item_code, quantity, quantity, data.buying_price || 0, data.supplier || '')
        .run();
    }

    if (Array.isArray(data.serials) && data.serials.length > 0) {
      for (const sn of data.serials) {
        if (!sn) continue;
        const existingSn = await this.db
          .prepare('SELECT serial_number FROM inventory_items WHERE serial_number = ?')
          .bind(sn)
          .first();
        if (!existingSn) {
          await this.db
            .prepare(
              `INSERT INTO inventory_items (serial_number, device_name, batch_code, status)
               VALUES (?, ?, ?, 'Active')`
            )
            .bind(sn, deviceName, data.batch_code)
            .run();
        }
      }
    }

    const totalQty: any = await this.db
      .prepare(
        'SELECT COALESCE(SUM(remaining_qty), 0) as total FROM inventory_batches WHERE item_code = ?'
      )
      .bind(data.item_code)
      .first();
    const newStockQty = totalQty ? totalQty.total : 0;

    await this.db
      .prepare('UPDATE inventory_stock SET stock_qty = ? WHERE item_code = ?')
      .bind(newStockQty, data.item_code)
      .run();

    return { message: 'Batch registered successfully', batch_code: data.batch_code, item_code: data.item_code };
  }

  async editBatch(data: { batch_code: string; buying_price?: number; supplier?: string; quantity?: number }) {
    if (!data.batch_code) return { error: 'Missing batch_code' };

    const updates: string[] = [];
    const values: any[] = [];
    if (data.buying_price !== undefined) { updates.push('buying_price = ?'); values.push(data.buying_price); }
    if (data.supplier !== undefined) { updates.push('supplier = ?'); values.push(data.supplier); }
    if (data.quantity !== undefined) {
      updates.push('quantity = ?');
      updates.push('remaining_qty = ?');
      values.push(data.quantity, data.quantity);
    }

    if (updates.length === 0) return { error: 'No fields to update' };
    values.push(data.batch_code);

    await this.db
      .prepare(`UPDATE inventory_batches SET ${updates.join(', ')} WHERE batch_code = ?`)
      .bind(...values)
      .run();

    return { message: 'Batch updated successfully', batch_code: data.batch_code };
  }

  async updatePrice(itemCode: string, unitPrice: number, unitPriceMmk: number) {
    await this.db
      .prepare(
        'UPDATE inventory_stock SET unit_price = ?, unit_price_mmk = ? WHERE item_code = ?'
      )
      .bind(unitPrice || 0, unitPriceMmk || 0, itemCode)
      .run();
    return { message: 'Price updated successfully', item_code: itemCode };
  }

  // ── Taxonomy ──────────────────────────────────────────────────────────

  async getInventoryCategories() {
    const result = await this.db.prepare('SELECT * FROM inv_categories ORDER BY name ASC').all();
    return result.results;
  }

  async getSubCategories() {
    const result = await this.db
      .prepare(`
        SELECT s.*, c.name as category_name
        FROM inv_sub_categories s
        LEFT JOIN inv_categories c ON s.category_id = c.id
        ORDER BY s.name ASC
      `)
      .all();
    return result.results;
  }

  async getBrands() {
    const result = await this.db.prepare('SELECT * FROM inv_brands ORDER BY name ASC').all();
    return result.results;
  }

  async getUnits() {
    const result = await this.db.prepare('SELECT * FROM inv_stock_units ORDER BY name ASC').all();
    return result.results;
  }
}
