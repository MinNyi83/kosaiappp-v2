/**
 * Invoices Routes — CRUD, payment reconciliation, Google Drive export
 */

import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';
import { uploadFileToGoogleDrive } from '../utils/google.js';

function register(router, env) {
  const db = env.DB;

  // ── GET /api/invoices ─────────────────────────────────────────────────
  router.get('/api/invoices', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const clientId = url.searchParams.get('client_id');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
      const offset = (page - 1) * limit;

      let query =
        'SELECT i.*, c.company_name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE 1=1';
      const params = [];

      if (status) {
        query += ' AND i.status = ?';
        params.push(status);
      }
      if (clientId) {
        query += ' AND i.client_id = ?';
        params.push(clientId);
      }

      query += ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch invoices: ' + err.message, 500);
    }
  });

  // ── POST /api/invoices ────────────────────────────────────────────────
  router.post('/api/invoices', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { client_id, items, amount, due_date, notes } = body;

      if (!client_id || !amount) {
        return error('Missing required fields: client_id, amount', 400);
      }

      const id = 'INV-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO invoices (id, client_id, items, amount, due_date, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"
        )
        .bind(
          id,
          client_id,
          items ? JSON.stringify(items) : '[]',
          amount,
          due_date || null,
          notes || null,
          user.id
        )
        .run();

      return success({ id, amount, status: 'pending' }, 201);
    } catch (err) {
      return error('Failed to create invoice: ' + err.message, 500);
    }
  });

  // ── PUT /api/invoices/:id/pay ─────────────────────────────────────────
  router.put('/api/invoices/:id/pay', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { payment_method, payment_ref, amount_paid } = (await request.json()) as any;

      const existing = await db
        .prepare('SELECT * FROM invoices WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Invoice not found', 404);
      if (existing.status === 'paid') return error('Invoice already paid', 400);

      await db
        .prepare(
          "UPDATE invoices SET status = 'paid', payment_method = ?, payment_ref = ?, amount_paid = ?, paid_at = datetime('now'), paid_by = ? WHERE id = ?"
        )
        .bind(
          payment_method || null,
          payment_ref || null,
          amount_paid || existing.amount,
          user.id,
          params.id
        )
        .run();

      return success({ message: 'Invoice marked as paid' });
    } catch (err) {
      return error('Failed to process payment: ' + err.message, 500);
    }
  });

  // ── POST /api/invoices/:id/save-drive ─────────────────────────────────
  router.post('/api/invoices/:id/save-drive', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const invoice = await db
        .prepare(
          'SELECT i.*, c.company_name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ?'
        )
        .bind(params.id)
        .first();
      if (!invoice) return error('Invoice not found', 404);

      // Generate PDF content (simplified — in production use a PDF library)
      const pdfContent = generateInvoiceHTML(invoice);

      // Save to Google Drive (requires OAuth setup)
      const fileBlob = new Blob([pdfContent], { type: 'text/html' });
      const driveFileId = await uploadFileToGoogleDrive(
        env,
        fileBlob,
        `Invoice_${invoice.id}.html`,
        invoice.client_name || 'Unknown Client',
        'Invoices'
      );

      const driveResult = { fileId: driveFileId, webViewLink: null };

      await db
        .prepare('UPDATE invoices SET drive_file_id = ?, drive_url = ? WHERE id = ?')
        .bind(driveResult.fileId, driveResult.webViewLink, params.id)
        .run();

      return success({ message: 'Saved to Google Drive', ...driveResult });
    } catch (err) {
      return error('Failed to save to Drive: ' + err.message, 500);
    }
  });

  // ── POST /api/pos/resolve-serial ──────────────────────────────────────
  router.get('/api/pos/resolve-serial', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const serial = url.searchParams.get('serial');
      if (!serial) return error('Missing serial parameter', 400);

      const item = await db
        .prepare('SELECT * FROM inventory_stock WHERE item_code = ?')
        .bind(serial)
        .first();

      if (!item) return error('Item not found', 404);
      return success(item);
    } catch (err) {
      return error('Serial lookup failed: ' + err.message, 500);
    }
  });

  // ── POST /api/pos/checkout ────────────────────────────────────────────
  router.post('/api/pos/checkout', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      // Frontend sends: { client_id, cart: [{item_code, qty}], discount, exchange_rate, ... }
      const cart = body.cart || body.items;
      if (!cart || !cart.length) return error('No items in cart', 400);

      // Look up item details from inventory_stock to get accurate prices and names
      const resolvedItems = [];
      for (const c of cart) {
        const stockItem = await db
          .prepare('SELECT * FROM inventory_stock WHERE item_code = ?')
          .bind(c.item_code)
          .first();
        if (!stockItem) continue;
        if ((stockItem.stock_qty || 0) < (c.qty || 1)) {
          return error(`Insufficient stock for ${stockItem.item_name}: available ${stockItem.stock_qty}, requested ${c.qty}`, 400);
        }
        resolvedItems.push({
          item_code: stockItem.item_code,
          name: stockItem.item_name,
          category: stockItem.category,
          price: stockItem.unit_price,
          price_mmk: stockItem.unit_price_mmk,
          quantity: c.qty || 1,
        });
      }
      if (!resolvedItems.length) return error('No valid items in cart', 400);

      // Calculate totals
      const subtotal = resolvedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const subtotalMmk = resolvedItems.reduce((sum, item) => sum + item.price_mmk * item.quantity, 0);
      const discount = body.discount || 0;
      const discountAmount = subtotal * (discount / 100);
      const afterDiscount = subtotal - discountAmount;
      const afterDiscountMmk = subtotalMmk - (subtotalMmk * discount / 100);
      const tax = afterDiscount * 0.0;
      const total = afterDiscount + tax;
      const totalMmk = afterDiscountMmk;

      // Create invoice record
      const invoiceId = 'INV-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO invoices (id, client_id, items, amount, total, status, notes, created_by) VALUES (?, ?, ?, ?, ?, 'paid', ?, ?)"
        )
        .bind(
          invoiceId,
          body.client_id || null,
          JSON.stringify(resolvedItems),
          total,
          total,
          body.notes || null,
          user.id
        )
        .run();

      // Deduct inventory_stock
      for (const item of resolvedItems) {
        await db
          .prepare('UPDATE inventory_stock SET stock_qty = stock_qty - ? WHERE item_code = ? AND stock_qty >= ?')
          .bind(item.quantity, item.item_code, item.quantity)
          .run();
      }

      // Record cash transaction if payment was made
      const paidA = body.paid_amount_a || 0;
      const paidB = body.paid_amount_b || 0;
      const totalPaid = paidA + paidB;
      if (totalPaid > 0) {
        const currency = body.currency_type || 'USD';
        const exchangeRate = body.exchange_rate || 1;
        const equivalentAmount = currency === 'MMK' ? totalPaid / exchangeRate : totalPaid;
        await db
          .prepare(
            "INSERT INTO cash_transactions (transaction_type, primary_currency, amount, exchange_rate, equivalent_amount, notes, linked_batch) VALUES ('Deposit', ?, ?, ?, ?, ?, ?)"
          )
          .bind(
            currency === 'MMK' ? 'MMK' : 'USD',
            totalPaid,
            exchangeRate,
            equivalentAmount,
            `POS Sale ${invoiceId}`,
            invoiceId
          )
          .run();

        // Update cash safe
        if (currency === 'MMK') {
          await db.prepare('UPDATE cash_safes SET mmk_balance = mmk_balance + ? WHERE id = 1').bind(totalPaid).run();
        } else {
          await db.prepare('UPDATE cash_safes SET usd_balance = usd_balance + ? WHERE id = 1').bind(totalPaid).run();
        }
      }

      // Handle credit if any
      const creditAmount = body.credit_amount || 0;
      if (creditAmount > 0 && body.client_id) {
        try {
          await db
            .prepare(
              "INSERT INTO client_credits (client_id, invoice_id, amount, status, created_at) VALUES (?, ?, ?, 'pending', datetime('now'))"
            )
            .bind(body.client_id, invoiceId, creditAmount)
            .run();
        } catch (_) {
          // client_credits table may not exist — skip gracefully
        }
      }

      return success(
        {
          invoice_id: invoiceId,
          subtotal,
          total_usd: total,
          total_mmk: totalMmk,
          discount,
          credit_amount: creditAmount,
          items: resolvedItems,
        },
        201
      );
    } catch (err) {
      return error('Checkout failed: ' + err.message, 500);
    }
  });
}

function generateInvoiceHTML(invoice) {
  const items =
    typeof invoice.items === 'string' ? (JSON.parse(invoice.items) as any) : invoice.items || [];
  const itemsHtml = items
    .map(
      (item) =>
        `<tr><td>${item.name || item.description || 'Item'}</td><td>${item.quantity || 1}</td><td>$${(item.price || 0).toFixed(2)}</td><td>$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><style>body{font-family:Arial;padding:40px}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}.total{font-weight:bold;font-size:1.2em}</style></head><body>
    <h1>Invoice #${invoice.id}</h1>
    <p>Client: ${invoice.client_name || 'N/A'}</p>
    <p>Date: ${invoice.created_at || new Date().toISOString()}</p>
    <table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>${itemsHtml}</table>
    <p class="total">Total: $${Number(invoice.amount || 0).toFixed(2)}</p>
    <p>Status: ${invoice.status}</p>
  </body></html>`;
}

export { register };
