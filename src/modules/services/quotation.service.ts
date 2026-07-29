/**
 * Quotation Service — Business logic for price quotations
 *
 * Extracted from routes/surveys.ts for modular monolith architecture.
 * Handles quotation CRUD, line items, totals, portal, revisions, stock deduction.
 */

export interface QuotationCreateDTO {
  client_id: string;
  prepared_by?: string;
  survey_id_link?: string;
  currency?: string;
  valid_days?: number;
  valid_until?: string;
  terms_conditions?: string;
  quotation_notes?: string;
  discount_pct?: number;
  discount_amount?: number;
  tax_pct?: number;
  items?: LineItemCreateDTO[];
}

export interface QuotationUpdateDTO {
  status?: string;
  currency?: string;
  valid_until?: string;
  terms_conditions?: string;
  quotation_notes?: string;
  discount_pct?: number;
  discount_amount?: number;
  tax_pct?: number;
}

export interface LineItemCreateDTO {
  item_code?: string;
  name: string;
  description?: string;
  category?: string;
  quantity: number;
  unit_price: number;
  unit?: string;
  tax_rate?: number;
  discount?: number;
  sort_order?: number;
  notes?: string;
  inventory_item_id?: string;
}

export class QuotationService {
  constructor(private db: D1Database) {}

  async getById(quotationId: string) {
    const quo = await this.db.prepare(`
      SELECT q.*, c.company_name as client_name, c.contact_person, c.phone as client_phone,
             t.name as prepared_by_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN technicians t ON q.prepared_by = t.id
      WHERE q.id = ?
    `).bind(quotationId).first();
    if (!quo) return null;
    const items = await this.db.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC, created_at ASC'
    ).bind(quotationId).all();
    return { ...quo, line_items: items.results || [] };
  }

  async list(filterClientId?: string) {
    let query = `
      SELECT q.*, c.company_name as client_name, c.contact_person,
             t.name as prepared_by_name,
             (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as item_count
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN technicians t ON q.prepared_by = t.id
    `;
    const bindings: any[] = [];
    if (filterClientId) {
      query += ' WHERE q.client_id = ?';
      bindings.push(filterClientId);
    }
    query += ' ORDER BY q.created_at DESC';
    const { results } = await this.db.prepare(query).bind(...bindings).all();
    return results || [];
  }

  async create(data: QuotationCreateDTO) {
    const id = `QUO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const validDays = data.valid_days || 14;
    const validUntilDate = new Date();
    validUntilDate.setDate(validUntilDate.getDate() + validDays);
    const validUntil = data.valid_until || validUntilDate.toISOString().split('T')[0];
    const portalToken = crypto.randomUUID();

    await this.db.prepare(`
      INSERT INTO quotations (
        id, survey_id, survey_id_link, client_id, prepared_by, valid_days, valid_until,
        status, items, subtotal, discount, tax, total_amount, currency, exchange_rate,
        terms_conditions, portal_token, discount_pct, tax_pct, quotation_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, data.survey_id_link || null, data.survey_id_link || null,
      data.client_id, data.prepared_by || null,
      validDays, validUntil,
      'Draft', JSON.stringify(data.items || []),
      0, 0, 0, 0,
      data.currency || 'USD', 1.0,
      data.terms_conditions || null, portalToken,
      data.discount_pct || 0, data.tax_pct || 0,
      data.quotation_notes || null
    ).run();

    if (data.items && data.items.length > 0) {
      for (let i = 0; i < data.items.length; i++) {
        const item = { ...data.items[i], sort_order: i };
        await this.addLineItem(id, item);
      }
      await this.recalculateTotals(id);
    }

    return { id, portal_token: portalToken };
  }

  async update(quotationId: string, data: QuotationUpdateDTO) {
    const updates: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return false;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(quotationId);
    await this.db.prepare(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    await this.recalculateTotals(quotationId);
    return true;
  }

  async recalculateTotals(quotationId: string) {
    const items = await this.db.prepare(
      'SELECT quantity, unit_price FROM quotation_items WHERE quotation_id = ?'
    ).bind(quotationId).all();
    const quo: any = await this.db.prepare(
      'SELECT discount_pct, discount_amount, tax_pct FROM quotations WHERE id = ?'
    ).bind(quotationId).first();

    const subtotal = (items.results || []).reduce((sum: number, i: any) => sum + (i.quantity * i.unit_price), 0);
    const pctDiscount = subtotal * ((quo?.discount_pct || 0) / 100);
    const amtDiscount = quo?.discount_amount || 0;
    const discount = pctDiscount + amtDiscount;
    const afterDiscount = Math.max(0, subtotal - discount);
    const tax = afterDiscount * ((quo?.tax_pct || 0) / 100);
    const total = afterDiscount + tax;

    await this.db.prepare(`
      UPDATE quotations SET subtotal = ?, discount = ?, tax = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(
      Math.round(subtotal * 100) / 100,
      Math.round(discount * 100) / 100,
      Math.round(tax * 100) / 100,
      Math.round(total * 100) / 100,
      quotationId
    ).run();
    return { subtotal, discount, tax, total };
  }

  // ── Line Items ──────────────────────────────────────────────────────────

  async addLineItem(quotationId: string, data: LineItemCreateDTO) {
    const itemId = `QIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await this.db.prepare(`
      INSERT INTO quotation_items (id, quotation_id, item_code, name, description, category,
        quantity, unit_price, unit, tax_rate, discount, sort_order, notes, inventory_item_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      itemId, quotationId, data.item_code || null, data.name, data.description || null,
      data.category || 'hardware', data.quantity, data.unit_price, data.unit || 'pc',
      data.tax_rate || 0, data.discount || 0, data.sort_order || 0, data.notes || null,
      data.inventory_item_id || null
    ).run();
    await this.recalculateTotals(quotationId);
    return itemId;
  }

  async updateLineItem(quotationId: string, itemId: string, data: Partial<LineItemCreateDTO>) {
    const updates: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return false;
    values.push(itemId, quotationId);
    await this.db.prepare(
      `UPDATE quotation_items SET ${updates.join(', ')} WHERE id = ? AND quotation_id = ?`
    ).bind(...values).run();
    await this.recalculateTotals(quotationId);
    return true;
  }

  async deleteLineItem(quotationId: string, itemId: string) {
    await this.db.prepare('DELETE FROM quotation_items WHERE id = ? AND quotation_id = ?').bind(itemId, quotationId).run();
    await this.recalculateTotals(quotationId);
  }

  // ── Portal ──────────────────────────────────────────────────────────────

  async getPortalQuotation(token: string) {
    const quo: any = await this.db.prepare(`
      SELECT q.*, c.company_name as client_name, c.contact_person, c.phone as client_phone,
             t.name as prepared_by_name
      FROM quotations q
      LEFT JOIN clients c ON q.client_id = c.id
      LEFT JOIN technicians t ON q.prepared_by = t.id
      WHERE q.portal_token = ?
    `).bind(token).first();
    if (!quo) return null;

    if (!quo.viewed_at) {
      await this.db.prepare('UPDATE quotations SET viewed_at = CURRENT_TIMESTAMP WHERE id = ?').bind(quo.id).run();
    }

    const { results: lineItems } = await this.db.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order ASC'
    ).bind(quo.id).all();

    return {
      id: quo.id, client_name: quo.client_name, contact_person: quo.contact_person,
      prepared_by_name: quo.prepared_by_name, created_at: quo.created_at,
      valid_until: quo.valid_until, status: quo.status, currency: quo.currency,
      exchange_rate: quo.exchange_rate, valid_days: quo.valid_days,
      line_items: lineItems || [], subtotal: quo.subtotal, discount: quo.discount,
      discount_pct: quo.discount_pct, tax: quo.tax, tax_pct: quo.tax_pct,
      total_amount: quo.total_amount, terms_conditions: quo.terms_conditions,
      quotation_notes: quo.quotation_notes, client_signature: quo.client_signature,
    };
  }

  async approveWithSignature(token: string, signature?: string) {
    const quo: any = await this.db.prepare('SELECT id, status FROM quotations WHERE portal_token = ?').bind(token).first();
    if (!quo) return null;
    if (quo.status === 'Approved' || quo.status === 'Converted') return { alreadyFinalized: true };

    await this.db.prepare(`
      UPDATE quotations SET status = 'Approved', client_signature = ?,
        approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(signature || null, quo.id).run();
    return { id: quo.id };
  }

  async reject(token: string, reason?: string) {
    const quo: any = await this.db.prepare('SELECT id FROM quotations WHERE portal_token = ?').bind(token).first();
    if (!quo) return null;
    await this.db.prepare(`
      UPDATE quotations SET status = 'Rejected', rejection_reason = ?,
        rejected_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(reason || null, quo.id).run();
    return { id: quo.id };
  }

  // ── Revisions ───────────────────────────────────────────────────────────

  async getRevisions(quotationId: string) {
    const { results } = await this.db.prepare(
      'SELECT * FROM quotation_revisions WHERE quotation_id = ? ORDER BY revision_number DESC'
    ).bind(quotationId).all();
    return results || [];
  }

  async saveRevision(quotationId: string, userId: string, changeNotes?: string) {
    const quo: any = await this.db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
    if (!quo) return null;

    const { results: lineItems } = await this.db.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order'
    ).bind(quotationId).all();

    const snapshot = { quotation: quo, items: lineItems };
    const currentRev = (quo.current_revision || 0) + 1;
    const revId = `REV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

    await this.db.prepare(`
      INSERT INTO quotation_revisions (id, quotation_id, revision_number, snapshot_json, revised_by, change_notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(revId, quotationId, currentRev, JSON.stringify(snapshot), userId, changeNotes || null).run();

    await this.db.prepare(`
      UPDATE quotations SET current_revision = ?, last_updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(currentRev, userId, quotationId).run();

    return { revision_number: currentRev, revision_id: revId };
  }

  async restoreRevision(quotationId: string, revisionId: string, userId: string) {
    const rev: any = await this.db.prepare(
      'SELECT * FROM quotation_revisions WHERE id = ? AND quotation_id = ?'
    ).bind(revisionId, quotationId).first();
    if (!rev) return null;

    const snapshot = JSON.parse(rev.snapshot_json);

    // Auto-save current state
    await this.saveRevision(quotationId, userId, `Auto-saved before restore of revision ${rev.revision_number}`);

    // Restore items
    await this.db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').bind(quotationId).run();
    for (const item of (snapshot.items || [])) {
      const itemId = `QIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await this.db.prepare(`
        INSERT INTO quotation_items (id, quotation_id, item_code, name, description, category,
          quantity, unit_price, unit, tax_rate, discount, sort_order, inventory_item_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(itemId, quotationId, item.item_code, item.name, item.description, item.category,
        item.quantity, item.unit_price, item.unit, item.tax_rate, item.discount, item.sort_order,
        item.inventory_item_id).run();
    }

    // Restore quotation fields
    const currentRev = (snapshot.quotation.current_revision || 0) + 1;
    await this.db.prepare(`
      UPDATE quotations SET current_revision = ?, last_updated_by = ?, updated_at = CURRENT_TIMESTAMP,
        subtotal = ?, discount_amount = ?, discount_pct = ?, tax = ?, total_amount = ?, currency = ?, notes = ?
      WHERE id = ?
    `).bind(currentRev, userId, snapshot.quotation.subtotal, snapshot.quotation.discount_amount,
      snapshot.quotation.discount_pct, snapshot.quotation.tax, snapshot.quotation.total_amount,
      snapshot.quotation.currency, snapshot.quotation.notes, quotationId).run();

    return { revision_number: currentRev, restored_from: rev.revision_number };
  }

  // ── Stock Deduction ─────────────────────────────────────────────────────

  async deductStock(quotationId: string) {
    const { results: items } = await this.db.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ? AND inventory_item_id IS NOT NULL'
    ).bind(quotationId).all();

    if (!items || items.length === 0) return { deductions: [], errors: ['No inventory-linked items'] };

    const deductions: any[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const invItem: any = await this.db.prepare('SELECT * FROM inventory WHERE id = ?').bind(item.inventory_item_id).first();
      if (!invItem) { errors.push(`${item.item_code}: inventory record not found`); continue; }

      const currentStock = Number(invItem.quantity_in_stock || 0);
      const deductQty = Number(item.quantity || 0);
      if (currentStock < deductQty) {
        errors.push(`${item.name}: only ${currentStock} in stock, need ${deductQty}`);
        continue;
      }

      await this.db.prepare('UPDATE inventory SET quantity_in_stock = quantity_in_stock - ? WHERE id = ?').bind(deductQty, item.inventory_item_id).run();
      await this.db.prepare('UPDATE quotation_items SET stock_deducted = 1 WHERE id = ?').bind(item.id).run();
      deductions.push({ item_code: item.item_code, name: item.name, quantity: deductQty, remaining: currentStock - deductQty });
    }

    return { deductions, errors };
  }

  // ── Conversion ──────────────────────────────────────────────────────────

  async convertToJob(quotationId: string) {
    const quo: any = await this.db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
    if (!quo) return null;

    const { results: lineItems } = await this.db.prepare(
      'SELECT * FROM quotation_items WHERE quotation_id = ?'
    ).bind(quotationId).all();

    const jobId = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const description = `Converted from Quotation ${quotationId}. Items: ${(lineItems || []).map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`;

    await this.db.prepare(`
      INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description)
      VALUES (?, ?, ?, 'CCTV', 'Pending', ?)
    `).bind(jobId, quo.client_id, quo.prepared_by, description).run();

    await this.db.prepare(`UPDATE quotations SET status = 'Converted', converted_job_id = ? WHERE id = ?`).bind(jobId, quotationId).run();

    return { job_id: jobId };
  }

  async convertToInvoice(quotationId: string) {
    const quo: any = await this.db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
    if (!quo) return null;

    const invoiceId = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await this.db.prepare(`
      INSERT INTO invoices (id, client_id, items, amount, tax, total, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(invoiceId, quo.client_id, quo.items, quo.subtotal, quo.tax, quo.total_amount, quo.prepared_by).run();

    await this.db.prepare(`UPDATE quotations SET status = 'Converted', converted_invoice_id = ? WHERE id = ?`).bind(invoiceId, quotationId).run();

    return { invoice_id: invoiceId };
  }
}
