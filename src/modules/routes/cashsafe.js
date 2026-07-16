/**
 * Cash Safe Routes — Cash tracking, deposits, withdrawals, balance inquiry
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

  // ── GET /api/cash-safe/balance ────────────────────────────────────────
  router.get('/api/cash-safe/balance', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const balance = await db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance FROM cash_transactions"
        )
        .first();

      const todayTotal = await db
        .prepare(
          "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE date(created_at) = date('now')"
        )
        .first();

      return success({
        balance: balance.balance,
        today_total: todayTotal.total,
      });
    } catch (err) {
      return error('Failed to fetch balance: ' + err.message, 500);
    }
  });

  // ── POST /api/cash-safe/deposit ───────────────────────────────────────
  router.post('/api/cash-safe/deposit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { amount, notes } = await request.json();
      if (!amount || amount <= 0) return error('Invalid amount', 400);

      const id = 'CSH-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO cash_transactions (id, type, amount, notes, created_by) VALUES (?, 'deposit', ?, ?, ?)"
        )
        .bind(id, amount, notes || null, user.id)
        .run();

      return success({ id, type: 'deposit', amount }, 201);
    } catch (err) {
      return error('Deposit failed: ' + err.message, 500);
    }
  });

  // ── POST /api/cash-safe/withdraw ──────────────────────────────────────
  router.post('/api/cash-safe/withdraw', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { amount, notes } = await request.json();
      if (!amount || amount <= 0) return error('Invalid amount', 400);

      // Check sufficient balance
      const balance = await db
        .prepare(
          "SELECT COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance FROM cash_transactions"
        )
        .first();

      if (balance.balance < amount) return error('Insufficient balance', 400);

      const id = 'CSH-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO cash_transactions (id, type, amount, notes, created_by) VALUES (?, 'withdraw', ?, ?, ?)"
        )
        .bind(id, amount, notes || null, user.id)
        .run();

      return success({ id, type: 'withdraw', amount }, 201);
    } catch (err) {
      return error('Withdrawal failed: ' + err.message, 500);
    }
  });

  // ── GET /api/cash-safe/transactions ───────────────────────────────────
  router.get('/api/cash-safe/transactions', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const type = url.searchParams.get('type');

      let query =
        'SELECT ct.*, t.name as created_by_name FROM cash_transactions ct LEFT JOIN technicians t ON ct.created_by = t.id WHERE 1=1';
      const params = [];

      if (dateFrom) {
        query += ' AND ct.created_at >= ?';
        params.push(dateFrom);
      }
      if (dateTo) {
        query += ' AND ct.created_at <= ?';
        params.push(dateTo);
      }
      if (type) {
        query += ' AND ct.type = ?';
        params.push(type);
      }

      query += ' ORDER BY ct.created_at DESC LIMIT 100';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch transactions: ' + err.message, 500);
    }
  });
}

export { register };
