/**
 * Reports Routes — Aggregated data for dashboards and exports
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';
import { getCorsHeaders } from '../utils/cors.js';

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return await verifyToken(authHeader.slice(7));
  }

  // ── GET /api/reports/dashboard ────────────────────────────────────────
  router.get('/api/reports/dashboard', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        .toISOString()
        .split('T')[0];

      const [
        todayJobs,
        pendingJobs,
        monthlyJobs,
        monthlyRevenue,
        topTechnicians,
        recentJobs,
        statusBreakdown,
      ] = await Promise.all([
        db
          .prepare("SELECT COUNT(*) as count FROM service_records WHERE date(created_at) = ?")
          .bind(today)
          .first(),
        db.prepare("SELECT COUNT(*) as count FROM service_records WHERE status = 'Pending'").first(),
        db
          .prepare('SELECT COUNT(*) as count FROM service_records WHERE created_at >= ?')
          .bind(startOfMonth)
          .first(),
        db
          .prepare(
            "SELECT COALESCE(SUM(amount), 0) as total FROM cash_transactions WHERE transaction_type = 'Deposit' AND created_at >= ?"
          )
          .bind(startOfMonth)
          .first(),
        db
          .prepare(
            "SELECT t.name, COUNT(j.id) as job_count FROM service_records j JOIN technicians t ON j.technician_id = t.id WHERE j.status = 'Completed' AND j.updated_at >= ? GROUP BY j.technician_id ORDER BY job_count DESC LIMIT 5"
          )
          .bind(startOfMonth)
          .all(),
        db
          .prepare(
            'SELECT j.*, c.company_name as client_name FROM service_records j LEFT JOIN clients c ON j.client_id = c.id ORDER BY j.created_at DESC LIMIT 10'
          )
          .all(),
        db.prepare('SELECT status, COUNT(*) as count FROM service_records GROUP BY status').all(),
      ]);

      return success({
        today_jobs: todayJobs.count,
        pending_jobs: pendingJobs.count,
        monthly_jobs: monthlyJobs.count,
        monthly_revenue: monthlyRevenue.total,
        top_technicians: topTechnicians.results,
        recent_jobs: recentJobs.results,
        status_breakdown: statusBreakdown.results,
      });
    } catch (err) {
      return error('Failed to fetch dashboard: ' + err.message, 500);
    }
  });

  // ── GET /api/reports/jobs ─────────────────────────────────────────────
  router.get('/api/reports/jobs', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const groupBy = url.searchParams.get('group_by') || 'status'; // status, technician, date

      let query = '';
      const params = [];

      switch (groupBy) {
        case 'technician':
          query =
            "SELECT t.name as group_key, COUNT(j.id) as total, SUM(CASE WHEN j.status = 'Completed' THEN 1 ELSE 0 END) as completed FROM service_records j RIGHT JOIN technicians t ON j.technician_id = t.id WHERE 1=1";
          if (dateFrom) {
            query += ' AND j.created_at >= ?';
            params.push(dateFrom);
          }
          if (dateTo) {
            query += ' AND j.created_at <= ?';
            params.push(dateTo);
          }
          query += ' GROUP BY t.name ORDER BY total DESC';
          break;
        case 'date':
          query =
            "SELECT date(created_at) as group_key, COUNT(*) as total, SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) as completed FROM service_records WHERE 1=1";
          if (dateFrom) {
            query += ' AND created_at >= ?';
            params.push(dateFrom);
          }
          if (dateTo) {
            query += ' AND created_at <= ?';
            params.push(dateTo);
          }
          query += ' GROUP BY date(created_at) ORDER BY group_key DESC LIMIT 30';
          break;
        default: // status
          query = 'SELECT status as group_key, COUNT(*) as total FROM service_records WHERE 1=1';
          if (dateFrom) {
            query += ' AND created_at >= ?';
            params.push(dateFrom);
          }
          if (dateTo) {
            query += ' AND created_at <= ?';
            params.push(dateTo);
          }
          query += ' GROUP BY status';
      }

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch job report: ' + err.message, 500);
    }
  });

  // ── GET /api/reports/revenue ──────────────────────────────────────────
  router.get('/api/reports/revenue', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const period = url.searchParams.get('period') || 'monthly'; // daily, monthly, yearly

      let dateFormat;
      switch (period) {
        case 'daily':
          dateFormat = '%Y-%m-%d';
          break;
        case 'yearly':
          dateFormat = '%Y';
          break;
        default:
          dateFormat = '%Y-%m';
      }

      const result = await db
        .prepare(
          `SELECT strftime('${dateFormat}', created_at) as period, COUNT(*) as transaction_count, SUM(amount) as revenue FROM cash_transactions WHERE transaction_type = 'Deposit' GROUP BY period ORDER BY period DESC LIMIT 12`
        )
        .all();

      return success(result.results);
    } catch (err) {
      return error('Failed to fetch revenue report: ' + err.message, 500);
    }
  });

  // ── GET /api/reports/export ───────────────────────────────────────────
  router.get('/api/reports/export', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const type = url.searchParams.get('type') || 'jobs'; // jobs, clients, inventory, expenses
      const format = url.searchParams.get('format') || 'json'; // json, csv

      let data;
      switch (type) {
        case 'clients':
          data = await db.prepare('SELECT * FROM clients ORDER BY company_name ASC').all();
          break;
        case 'inventory':
          data = await db.prepare('SELECT * FROM inventory_stock ORDER BY item_name ASC').all();
          break;
        case 'expenses':
          // expenses table may not exist — return empty if so
          try {
            data = await db
              .prepare(
                'SELECT e.*, t.name as submitted_by_name FROM expenses e LEFT JOIN technicians t ON e.submitted_by = t.id ORDER BY e.created_at DESC'
              )
              .all();
          } catch (_) {
            data = { results: [] };
          }
          break;
        default: // jobs
          data = await db
            .prepare(
              'SELECT j.*, c.company_name as client_name, t.name as technician_name FROM service_records j LEFT JOIN clients c ON j.client_id = c.id LEFT JOIN technicians t ON j.technician_id = t.id ORDER BY j.created_at DESC'
            )
            .all();
      }

      if (format === 'csv') {
        const rows = data.results;
        if (rows.length === 0) return success([]);
        const headers = Object.keys(rows[0]);
        const csvLines = [headers.join(',')];
        for (const row of rows) {
          csvLines.push(
            headers
              .map((h) => {
                const val = row[h];
                if (val === null || val === undefined) return '';
                const str = String(val);
                return str.includes(',') || str.includes('"')
                  ? `"${str.replace(/"/g, '""')}"`
                  : str;
              })
              .join(',')
          );
        }
        return new Response(csvLines.join('\n'), {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${type}_export.csv"`,
            ...getCorsHeaders(),
          },
        });
      }

      return success(data.results);
    } catch (err) {
      return error('Failed to export data: ' + err.message, 500);
    }
  });
}

export { register };
