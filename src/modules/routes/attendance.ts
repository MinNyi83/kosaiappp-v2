/**
 * Attendance Routes — Clock in/out, attendance records, reports
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

  // ── POST /api/attendance/clock-in ─────────────────────────────────────
  router.post('/api/attendance/clock-in', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { latitude, longitude, notes } = (await request.json()) as any;

      // Check if already clocked in today
      const existing = await db
        .prepare(
          "SELECT id FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
        )
        .bind(user.id)
        .first();
      if (existing) return error('Already clocked in', 400);

      const id = 'ATT-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO attendance (id, technician_id, date, clock_in, clock_in_lat, clock_in_lng, notes) VALUES (?, ?, date('now'), datetime('now'), ?, ?, ?)"
        )
        .bind(id, user.id, latitude || null, longitude || null, notes || null)
        .run();

      return success({ id, message: 'Clocked in successfully' }, 201);
    } catch (err) {
      return error('Failed to clock in: ' + err.message, 500);
    }
  });

  // ── POST /api/attendance/clock-out ────────────────────────────────────
  router.post('/api/attendance/clock-out', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { latitude, longitude, notes } = (await request.json()) as any;

      const record = await db
        .prepare(
          "SELECT * FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
        )
        .bind(user.id)
        .first();
      if (!record) return error('No active clock-in found', 400);

      await db
        .prepare(
          "UPDATE attendance SET clock_out = datetime('now'), clock_out_lat = ?, clock_out_lng = ?, notes = CASE WHEN ? IS NOT NULL THEN ? ELSE notes END WHERE id = ?"
        )
        .bind(latitude || null, longitude || null, notes, notes, record.id)
        .run();

      return success({ id: record.id, message: 'Clocked out successfully' });
    } catch (err) {
      return error('Failed to clock out: ' + err.message, 500);
    }
  });

  // ── GET /api/attendance ───────────────────────────────────────────────
  router.get('/api/attendance', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const techId = url.searchParams.get('technician_id');

      let query =
        'SELECT a.*, t.name as technician_name FROM attendance a LEFT JOIN technicians t ON a.technician_id = t.id WHERE 1=1';
      const params = [];

      if (dateFrom) {
        query += ' AND a.date >= ?';
        params.push(dateFrom);
      }
      if (dateTo) {
        query += ' AND a.date <= ?';
        params.push(dateTo);
      }
      if (techId) {
        query += ' AND a.technician_id = ?';
        params.push(techId);
      }
      if (user.role?.toLowerCase() !== 'admin') {
        query += ' AND a.technician_id = ?';
        params.push(user.id);
      }

      query += ' ORDER BY a.date DESC, a.clock_in DESC';

      const result = await db
        .prepare(query)
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      return error('Failed to fetch attendance: ' + err.message, 500);
    }
  });

  // ── GET /api/attendance/status ────────────────────────────────────────
  router.get('/api/attendance/status', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const record = await db
        .prepare(
          "SELECT * FROM attendance WHERE technician_id = ? AND date = date('now') ORDER BY clock_in DESC LIMIT 1"
        )
        .bind(user.id)
        .first();

      return success({
        clocked_in: record ? !record.clock_out : false,
        record: record || null,
      });
    } catch (err) {
      return error('Failed to fetch status: ' + err.message, 500);
    }
  });
}

export { register };
