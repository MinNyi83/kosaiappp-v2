/**
 * Expenses Routes — CRUD for expense tracking
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

  // ── GET /api/expenses ─────────────────────────────────────────────────
  router.get('/api/expenses', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const category = url.searchParams.get('category');
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const status = url.searchParams.get('status');
      const page = parseInt(url.searchParams.get('page')) || 1;
      const limit = Math.min(parseInt(url.searchParams.get('limit')) || 50, 200);
      const offset = (page - 1) * limit;

      let query =
        'SELECT e.*, t.name as submitted_by_name FROM expenses e LEFT JOIN technicians t ON e.submitted_by = t.id WHERE 1=1';
      const params = [];
      let countQuery = 'SELECT COUNT(*) as total FROM expenses WHERE 1=1';
      const countParams = [];

      if (category) {
        query += ' AND e.category = ?';
        params.push(category);
        countQuery += ' AND category = ?';
        countParams.push(category);
      }
      if (dateFrom) {
        query += ' AND e.expense_date >= ?';
        params.push(dateFrom);
        countQuery += ' AND expense_date >= ?';
        countParams.push(dateFrom);
      }
      if (dateTo) {
        query += ' AND e.expense_date <= ?';
        params.push(dateTo);
        countQuery += ' AND expense_date <= ?';
        countParams.push(dateTo);
      }
      if (status) {
        query += ' AND e.status = ?';
        params.push(status);
        countQuery += ' AND status = ?';
        countParams.push(status);
      }
      if (user.role?.toLowerCase() !== 'admin') {
        query += ' AND e.submitted_by = ?';
        params.push(user.id);
        countQuery += ' AND submitted_by = ?';
        countParams.push(user.id);
      }

      query += ' ORDER BY e.expense_date DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const [expensesResult, countResult] = await Promise.all([
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
        expenses: expensesResult.results,
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit),
      });
    } catch (err) {
      return error('Failed to fetch expenses: ' + err.message, 500);
    }
  });

  // ── POST /api/expenses ────────────────────────────────────────────────
  router.post('/api/expenses', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const { amount, category, description, expense_date, receipt_url } = body;

      if (!amount || !category) {
        return error('Missing required fields: amount, category', 400);
      }

      const id = 'EXP-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO expenses (id, amount, category, description, expense_date, receipt_url, submitted_by, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')"
        )
        .bind(
          id,
          amount,
          category,
          description || null,
          expense_date || new Date().toISOString().split('T')[0],
          receipt_url || null,
          user.id
        )
        .run();

      return success({ id, amount, category, status: 'pending' }, 201);
    } catch (err) {
      return error('Failed to create expense: ' + err.message, 500);
    }
  });

  // ── PUT /api/expenses/:id/approve ─────────────────────────────────────
  router.put('/api/expenses/:id/approve', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const existing = await db
        .prepare('SELECT id, status FROM expenses WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Expense not found', 404);

      await db
        .prepare(
          "UPDATE expenses SET status = 'approved', approved_by = ?, approved_at = datetime('now') WHERE id = ?"
        )
        .bind(user.id, params.id)
        .run();

      return success({ message: 'Expense approved' });
    } catch (err) {
      return error('Failed to approve expense: ' + err.message, 500);
    }
  });

  // ── PUT /api/expenses/:id/reject ──────────────────────────────────────
  router.put('/api/expenses/:id/reject', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const { reason } = (await request.json() as any);
      const existing = await db
        .prepare('SELECT id FROM expenses WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Expense not found', 404);

      await db
        .prepare(
          "UPDATE expenses SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?"
        )
        .bind(reason || null, user.id, params.id)
        .run();

      return success({ message: 'Expense rejected' });
    } catch (err) {
      return error('Failed to reject expense: ' + err.message, 500);
    }
  });
}

export { register };

