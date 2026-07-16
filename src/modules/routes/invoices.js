/**
 * Invoices Routes — CRUD, payment reconciliation, Google Drive export
 */

import { success, error } from "../utils/response.js";
import { verifyToken } from "../utils/jwt.js";
import { saveToGoogleDrive } from "../utils/google.js";

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return verifyToken(authHeader.slice(7));
  }

  // ── GET /api/invoices ─────────────────────────────────────────────────
  router.get("/api/invoices", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const clientId = url.searchParams.get("client_id");
      const page = parseInt(url.searchParams.get("page")) || 1;
      const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
      const offset = (page - 1) * limit;

      let query = "SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE 1=1";
      const params = [];

      if (status) { query += " AND i.status = ?"; params.push(status); }
      if (clientId) { query += " AND i.client_id = ?"; params.push(clientId); }

      query += " ORDER BY i.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error("Failed to fetch invoices: " + err.message, 500);
    }
  });

  // ── POST /api/invoices ────────────────────────────────────────────────
  router.post("/api/invoices", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const { client_id, items, amount, due_date, notes } = body;

      if (!client_id || !amount) {
        return error("Missing required fields: client_id, amount", 400);
      }

      const id = "INV-" + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO invoices (id, client_id, items, amount, due_date, notes, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"
        )
        .bind(id, client_id, items ? JSON.stringify(items) : "[]", amount, due_date || null, notes || null, user.id)
        .run();

      return success({ id, amount, status: "pending" }, 201);
    } catch (err) {
      return error("Failed to create invoice: " + err.message, 500);
    }
  });

  // ── PUT /api/invoices/:id/pay ─────────────────────────────────────────
  router.put("/api/invoices/:id/pay", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const { payment_method, payment_ref, amount_paid } = await request.json();

      const existing = await db
        .prepare("SELECT * FROM invoices WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Invoice not found", 404);
      if (existing.status === "paid") return error("Invoice already paid", 400);

      await db
        .prepare(
          "UPDATE invoices SET status = 'paid', payment_method = ?, payment_ref = ?, amount_paid = ?, paid_at = datetime('now'), paid_by = ? WHERE id = ?"
        )
        .bind(payment_method || null, payment_ref || null, amount_paid || existing.amount, user.id, params.id)
        .run();

      return success({ message: "Invoice marked as paid" });
    } catch (err) {
      return error("Failed to process payment: " + err.message, 500);
    }
  });

  // ── POST /api/invoices/:id/save-drive ─────────────────────────────────
  router.post("/api/invoices/:id/save-drive", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const invoice = await db
        .prepare("SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id WHERE i.id = ?")
        .bind(params.id)
        .first();
      if (!invoice) return error("Invoice not found", 404);

      // Generate PDF content (simplified — in production use a PDF library)
      const pdfContent = generateInvoiceHTML(invoice);

      // Save to Google Drive (requires OAuth setup)
      const driveResult = await saveToGoogleDrive(env, {
        fileName: `Invoice_${invoice.id}.html`,
        content: pdfContent,
        mimeType: "text/html",
        folderName: "Invoices",
      });

      await db
        .prepare("UPDATE invoices SET drive_file_id = ?, drive_url = ? WHERE id = ?")
        .bind(driveResult.fileId, driveResult.webViewLink, params.id)
        .run();

      return success({ message: "Saved to Google Drive", ...driveResult });
    } catch (err) {
      return error("Failed to save to Drive: " + err.message, 500);
    }
  });

  // ── POST /api/pos/checkout ────────────────────────────────────────────
  router.post("/api/pos/checkout", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const { client_id, items, payments, notes } = await request.json();
      if (!items || !items.length) return error("No items in cart", 400);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = subtotal * 0.12; // 12% VAT example
      const total = subtotal + tax;

      // Create invoice
      const invoiceId = "INV-" + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO invoices (id, client_id, items, amount, tax, total, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, 'paid', ?, ?)"
        )
        .bind(invoiceId, client_id || null, JSON.stringify(items), subtotal, tax, total, notes || null, user.id)
        .run();

      // Deduct inventory
      for (const item of items) {
        if (item.item_id) {
          await db
            .prepare("UPDATE inventory SET quantity = quantity - ? WHERE id = ? AND quantity >= ?")
            .bind(item.quantity, item.item_id, item.quantity)
            .run();
        }
      }

      return success({
        invoice_id: invoiceId,
        subtotal,
        tax,
        total,
        payment: payments || [],
      }, 201);
    } catch (err) {
      return error("Checkout failed: " + err.message, 500);
    }
  });
}

function generateInvoiceHTML(invoice) {
  const items = typeof invoice.items === "string" ? JSON.parse(invoice.items) : (invoice.items || []);
  const itemsHtml = items.map((item) =>
    `<tr><td>${item.name || item.description || "Item"}</td><td>${item.quantity || 1}</td><td>$${(item.price || 0).toFixed(2)}</td><td>$${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><style>body{font-family:Arial;padding:40px}table{width:100%;border-collapse:collapse}th,td{padding:8px;text-align:left;border-bottom:1px solid #ddd}.total{font-weight:bold;font-size:1.2em}</style></head><body>
    <h1>Invoice #${invoice.id}</h1>
    <p>Client: ${invoice.client_name || "N/A"}</p>
    <p>Date: ${invoice.created_at || new Date().toISOString()}</p>
    <table><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>${itemsHtml}</table>
    <p class="total">Total: $${Number(invoice.amount || 0).toFixed(2)}</p>
    <p>Status: ${invoice.status}</p>
  </body></html>`;
}

export { register };