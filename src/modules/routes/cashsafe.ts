/**
 * Cash Safe Routes — Cash tracking, deposits, withdrawals, balance inquiry
 * DB: cash_transactions(id INTEGER PK, job_id TEXT, transaction_type TEXT,
 *     primary_currency TEXT, amount REAL, exchange_rate REAL,
 *     equivalent_amount REAL, notes TEXT, created_at TEXT, receive_mmk INTEGER, linked_batch TEXT)
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

  // ── Shared balance helper ─────────────────────────────────────────────
  async function fetchBalance() {
    // Deposits/income add, expenses/withdrawals subtract
    const usdRow = await db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN transaction_type IN ('Deposit','Income','income','deposit') THEN amount ELSE -amount END), 0) as balance
         FROM cash_transactions WHERE primary_currency = 'USD'`
      )
      .first();

    const mmkRow = await db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN transaction_type IN ('Deposit','Income','income','deposit') THEN amount ELSE -amount END), 0) as balance
         FROM cash_transactions WHERE primary_currency = 'MMK'`
      )
      .first();

    const usd = usdRow?.balance ?? 0;
    const mmk = mmkRow?.balance ?? 0;

    return {
      usd_balance: usd,
      mmk_balance: mmk,
      balance: usd,
    };
  }

  // ── GET /api/cash-safe/balance ────────────────────────────────────────
  router.get('/api/cash-safe/balance', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      return success(await fetchBalance());
    } catch (err) {
      return error('Failed to fetch balance: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/cash/safe (alias — used by admin.js frontend) ───────
  router.get('/api/admin/cash/safe', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      return success(await fetchBalance());
    } catch (err) {
      return error('Failed to fetch balance: ' + err.message, 500);
    }
  });

  // ── Shared transaction list helper ─────────────────────────────────────
  async function getTransactions(request) {
    const url = new URL(request.url);
    const dateFrom = url.searchParams.get('date_from');
    const dateTo   = url.searchParams.get('date_to');
    const txType   = url.searchParams.get('type') || url.searchParams.get('transaction_type');
    const currency = url.searchParams.get('currency') || url.searchParams.get('primary_currency');

    let query = 'SELECT * FROM cash_transactions WHERE 1=1';
    const params: any[] = [];

    if (dateFrom) { query += ' AND created_at >= ?'; params.push(dateFrom); }
    if (dateTo)   { query += ' AND created_at <= ?'; params.push(dateTo); }
    if (txType)   { query += ' AND transaction_type = ?'; params.push(txType); }
    if (currency) { query += ' AND primary_currency = ?'; params.push(currency); }

    query += ' ORDER BY created_at DESC LIMIT 200';
    const result = await db.prepare(query).bind(...params).all();
    return result.results;
  }

  // ── GET /api/cash-safe/transactions ───────────────────────────────────
  router.get('/api/cash-safe/transactions', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      return success(await getTransactions(request));
    } catch (err) {
      return error('Failed to fetch transactions: ' + err.message, 500);
    }
  });

  // ── GET /api/admin/cash/transactions (alias — used by admin.js) ────────
  router.get('/api/admin/cash/transactions', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      return success(await getTransactions(request));
    } catch (err) {
      return error('Failed to fetch transactions: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/cash/transact ─────────────────────────────────────
  // Main transaction endpoint used by admin.js submitCashTransaction()
  router.post('/api/admin/cash/transact', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json() as any);
      const {
        transaction_type,
        primary_currency,
        amount,
        exchange_rate,
        job_id,
        notes,
        receive_mmk,
        linked_batch,
      } = body;

      const amt = parseFloat(amount);
      const rate = parseFloat(exchange_rate) || 1;
      if (!amt || amt <= 0) return error('Invalid amount', 400);
      if (!transaction_type)  return error('Missing transaction_type', 400);
      if (!primary_currency)  return error('Missing primary_currency', 400);

      const equivalent = primary_currency === 'USD' ? amt * rate : amt / rate;

      await db
        .prepare(
          `INSERT INTO cash_transactions
            (job_id, transaction_type, primary_currency, amount, exchange_rate, equivalent_amount, notes, receive_mmk, linked_batch)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          job_id || null,
          transaction_type,
          primary_currency,
          amt,
          rate,
          equivalent,
          notes || null,
          receive_mmk ? 1 : 0,
          linked_batch || null
        )
        .run();

      return success({ transaction_type, primary_currency, amount: amt }, 201);
    } catch (err) {
      return error('Transaction failed: ' + err.message, 500);
    }
  });

  // ── POST /api/cash-safe/deposit ───────────────────────────────────────
  router.post('/api/cash-safe/deposit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const { amount, notes, currency } = (await request.json() as any);
      if (!amount || amount <= 0) return error('Invalid amount', 400);
      await db
        .prepare(
          `INSERT INTO cash_transactions (transaction_type, primary_currency, amount, exchange_rate, equivalent_amount, notes)
           VALUES ('Deposit', ?, ?, 1, ?, ?)`
        )
        .bind(currency || 'USD', amount, amount, notes || null)
        .run();
      return success({ type: 'Deposit', amount }, 201);
    } catch (err) {
      return error('Deposit failed: ' + err.message, 500);
    }
  });

  // ── POST /api/cash-safe/withdraw ──────────────────────────────────────
  router.post('/api/cash-safe/withdraw', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const { amount, notes, currency } = (await request.json() as any);
      if (!amount || amount <= 0) return error('Invalid amount', 400);
      await db
        .prepare(
          `INSERT INTO cash_transactions (transaction_type, primary_currency, amount, exchange_rate, equivalent_amount, notes)
           VALUES ('Withdrawal', ?, ?, 1, ?, ?)`
        )
        .bind(currency || 'USD', amount, amount, notes || null)
        .run();
      return success({ type: 'Withdrawal', amount }, 201);
    } catch (err) {
      return error('Withdrawal failed: ' + err.message, 500);
    }
  });
}

export { register };
