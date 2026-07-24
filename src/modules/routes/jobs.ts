/**
 * Jobs Routes — CRUD using service_records table
 * DB: service_records(id, client_id, technician_id, service_type, status, job_description,
 *     technician_notes, equipment_used, before_photo, after_photo, arrival_time,
 *     completion_time, ..., created_at, updated_at)
 * clients(id, company_name, contact_person, address, phone, amc_status, ...)
 * technicians(id, name, nickname, role, ...)
 */

import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';
import { uploadFileToGoogleDrive } from '../utils/google.js';

function register(router, env) {
  const db = env.DB;

  // Base SELECT with joins for all job queries
  const BASE_SELECT = `
    SELECT
      j.*,
      c.company_name,
      c.phone    AS client_phone,
      c.address  AS client_address,
      c.amc_status,
      t.name     AS tech_name,
      t.nickname AS tech_nickname,
      t.phone    AS tech_phone
    FROM service_records j
    LEFT JOIN clients    c ON j.client_id     = c.id
    LEFT JOIN technicians t ON j.technician_id = t.id
  `;

  // ── GET /api/jobs ─────────────────────────────────────────────────────
  router.get('/api/jobs', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const techId = url.searchParams.get('technician_id');
      const clientId = url.searchParams.get('client_id');
      const dateFrom = url.searchParams.get('date_from');
      const dateTo = url.searchParams.get('date_to');
      const search = url.searchParams.get('search');
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);
      const offset = (page - 1) * limit;

      let where = 'WHERE 1=1';
      const params: any[] = [];
      let countWhere = 'WHERE 1=1';
      const countParams: any[] = [];

      if (status) {
        where += ' AND j.status = ?';
        params.push(status);
        countWhere += ' AND j.status = ?';
        countParams.push(status);
      }
      if (techId) {
        where += ' AND j.technician_id = ?';
        params.push(techId);
        countWhere += ' AND j.technician_id = ?';
        countParams.push(techId);
      }
      if (clientId) {
        where += ' AND j.client_id = ?';
        params.push(clientId);
        countWhere += ' AND j.client_id = ?';
        countParams.push(clientId);
      }
      if (dateFrom) {
        where += ' AND j.created_at >= ?';
        params.push(dateFrom);
        countWhere += ' AND j.created_at >= ?';
        countParams.push(dateFrom);
      }
      if (dateTo) {
        where += ' AND j.created_at <= ?';
        params.push(dateTo);
        countWhere += ' AND j.created_at <= ?';
        countParams.push(dateTo);
      }
      if (search) {
        const like = `%${search}%`;
        where +=
          ' AND (j.id LIKE ? OR j.service_type LIKE ? OR j.job_description LIKE ? OR c.company_name LIKE ?)';
        params.push(like, like, like, like);
        countWhere +=
          ' AND (j.id LIKE ? OR j.service_type LIKE ? OR j.job_description LIKE ? OR c.company_name LIKE ?)';
        countParams.push(like, like, like, like);
      }

      // Non-admin see only their own jobs
      if (user.role?.toLowerCase() !== 'admin') {
        where += ' AND j.technician_id = ?';
        params.push(user.id);
        countWhere += ' AND j.technician_id = ?';
        countParams.push(user.id);
      }

      const query = BASE_SELECT + where + ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const countQuery = `SELECT COUNT(*) as total FROM service_records j LEFT JOIN clients c ON j.client_id = c.id ${countWhere}`;

      const [jobsResult, countResult] = await Promise.all([
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
        jobs: jobsResult.results,
        total: countResult?.total ?? 0,
        page,
        limit,
        totalPages: Math.ceil((countResult?.total ?? 0) / limit),
      });
    } catch (err) {
      console.error('Fetch jobs error:', err.message);
      return error('Failed to fetch jobs', 500);
    }
  });

  // ── GET /api/jobs/active ──────────────────────────────────────────────
  router.get('/api/jobs/active', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const activeStatuses = ['Pending', 'In Progress'];
      let where = `WHERE j.status IN (${activeStatuses.map(() => '?').join(',')})`;
      const params: any[] = [...activeStatuses];

      if (user.role?.toLowerCase() !== 'admin') {
        where += ' AND j.technician_id = ?';
        params.push(user.id);
      }

      const result = await db
        .prepare(BASE_SELECT + where + ' ORDER BY j.created_at DESC')
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch active jobs error:', err.message);
      return error('Failed to fetch active jobs', 500);
    }
  });

  // ── GET /api/jobs/calendar ────────────────────────────────────────────
  router.get('/api/jobs/calendar', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get('date_from') || new Date().toISOString().split('T')[0];
      const dateTo = url.searchParams.get('date_to');

      let where = 'WHERE j.created_at >= ?';
      const params: any[] = [dateFrom];

      if (dateTo) {
        where += ' AND j.created_at <= ?';
        params.push(dateTo);
      }
      if (user.role?.toLowerCase() !== 'admin') {
        where += ' AND j.technician_id = ?';
        params.push(user.id);
      }

      const result = await db
        .prepare(BASE_SELECT + where + ' ORDER BY j.created_at ASC')
        .bind(...params)
        .all();
      return success(result.results);
    } catch (err) {
      console.error('Fetch calendar error:', err.message);
      return error('Failed to fetch calendar', 500);
    }
  });

  // ── GET /api/jobs/receipt ────────────────────────────────────────────
  // MUST be registered before /:id to avoid wildcard capture
  router.get('/api/jobs/receipt', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const job_id = url.searchParams.get('job_id');
      if (!job_id) return success(null);

      const job = await db
        .prepare(
          `SELECT j.*, c.company_name, c.address, c.phone as client_phone, c.amc_status,
                  t.name as tech_name, t.phone as tech_phone
           FROM service_records j
           LEFT JOIN clients c ON j.client_id = c.id
           LEFT JOIN technicians t ON j.technician_id = t.id
           WHERE j.id = ?`
        )
        .bind(job_id)
        .first();

      return success(job || null);
    } catch (err) {
      console.error('Fetch receipt error:', err.message);
      return error('Failed to fetch receipt', 500);
    }
  });

  // ── GET /api/jobs/:id ─────────────────────────────────────────────────
  router.get('/api/jobs/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const job = await db
        .prepare(BASE_SELECT + 'WHERE j.id = ?')
        .bind(params.id)
        .first();

      if (!job) return error('Job not found', 404);

      if (user.role?.toLowerCase() !== 'admin' && job.technician_id !== user.id) {
        return error('Forbidden', 403);
      }

      return success(job);
    } catch (err) {
      console.error('Fetch job error:', err.message);
      return error('Failed to fetch job', 500);
    }
  });

  // ── POST /api/jobs ────────────────────────────────────────────────────
  router.post('/api/jobs', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { service_type, job_description, client_id, technician_id } = body;

      if (!service_type || !client_id || !job_description) {
        return error('Missing required fields: service_type, client_id, job_description', 400);
      }

      const id = 'SR-' + Date.now().toString(36).toUpperCase();

      await db
        .prepare(
          "INSERT INTO service_records (id, client_id, technician_id, service_type, job_description, status) VALUES (?, ?, ?, ?, ?, 'Pending')"
        )
        .bind(id, client_id, technician_id || null, service_type, job_description)
        .run();

      return success({ id, service_type, status: 'Pending' }, 201);
    } catch (err) {
      console.error('Create job error:', err.message);
      return error('Failed to create job', 500);
    }
  });

  // ── PUT /api/jobs/:id ─────────────────────────────────────────────────
  router.put('/api/jobs/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const existing = await db
        .prepare('SELECT * FROM service_records WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Job not found', 404);

      if (user.role?.toLowerCase() !== 'admin' && existing.technician_id !== user.id) {
        return error('Forbidden', 403);
      }

      const allowed = [
        'service_type',
        'job_description',
        'client_id',
        'technician_id',
        'status',
        'technician_notes',
        'equipment_used',
        'arrival_time',
        'completion_time',
        'before_photo',
        'after_photo',
        'checklist_data',
      ];
      const updates: string[] = [];
      const values: any[] = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(params.id);

      await db
        .prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Job updated' });
    } catch (err) {
      console.error('Update job error:', err.message);
      return error('Failed to update job', 500);
    }
  });

  // ── DELETE /api/jobs/:id ──────────────────────────────────────────────
  router.delete('/api/jobs/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const existing = await db
        .prepare('SELECT id FROM service_records WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Job not found', 404);

      await db.prepare('DELETE FROM service_records WHERE id = ?').bind(params.id).run();
      return success({ message: 'Job deleted' });
    } catch (err) {
      console.error('Delete job error:', err.message);
      return error('Failed to delete job', 500);
    }
  });

  // ── POST /api/jobs/:id/status ─────────────────────────────────────────
  router.post('/api/jobs/:id/status', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { status, notes } = (await request.json()) as any;
      if (!status) return error('Missing status', 400);

      const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
      if (!validStatuses.includes(status)) {
        return error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
      }

      const existing = await db
        .prepare('SELECT * FROM service_records WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Job not found', 404);

      if (user.role?.toLowerCase() !== 'admin' && existing.technician_id !== user.id) {
        return error('Forbidden', 403);
      }

      const updateFields: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const updateValues: any[] = [status];

      if (notes) {
        updateFields.push('technician_notes = ?');
        updateValues.push(notes);
      }
      if (status === 'In Progress' && !existing.arrival_time) {
        updateFields.push('arrival_time = CURRENT_TIMESTAMP');
      }
      if (status === 'Completed' && !existing.completion_time) {
        updateFields.push('completion_time = CURRENT_TIMESTAMP');
      }
      updateValues.push(params.id);

      await db
        .prepare(`UPDATE service_records SET ${updateFields.join(', ')} WHERE id = ?`)
        .bind(...updateValues)
        .run();

      // Send Telegram notification for status change
      try {
        const { sendTelegramNotification, sendTelegramPhotoNotification } = await import('../utils/telegram.js');

        // Get client info
        let clientName = 'N/A';
        if (existing.client_id) {
          const client = await db.prepare('SELECT company_name FROM clients WHERE id = ?').bind(existing.client_id).first();
          if (client) clientName = client.company_name;
        }

        const statusEmoji = { 'Pending': '⏳', 'In Progress': '🔧', 'Completed': '✅', 'Cancelled': '❌' };
        const emoji = statusEmoji[status] || '📋';
        const notifyText = `${emoji} *Job ${status}*\n\n` +
          `📋 *Job:* ${params.id}\n` +
          `👤 *Client:* ${clientName}\n` +
          `🔧 *Type:* ${existing.service_type}\n` +
          `👨‍💼 *Technician:* ${user.name}\n` +
          (notes ? `\n📝 ${notes}` : '');

        await sendTelegramNotification(env, notifyText);

        // Photos are sent on upload, not on status change
      } catch (e) {
        console.warn('Telegram notification failed:', e.message);
      }

      return success({ id: params.id, previous_status: existing.status, new_status: status });
    } catch (err) {
      console.error('Update status error:', err.message);
      return error('Failed to update job status', 500);
    }
  });

  // ── POST /api/jobs/:id/photo ──────────────────────────────────────────
  router.post('/api/jobs/:id/photo', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { photo_base64, photo_type } = body; // photo_type: 'before' or 'after'
      if (!photo_base64) return error('Missing photo_base64', 400);

      // Enforce 10MB max photo size
      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
      const estimatedSize = Math.ceil(base64Data.length * 3 / 4);
      if (estimatedSize > 10 * 1024 * 1024) {
        return error('Photo too large (max 10MB)', 400);
      }

      const existing = await db
        .prepare('SELECT * FROM service_records WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Job not found', 404);

      // Get client name for Drive folder
      let clientName = 'Unknown Client';
      if (existing.client_id) {
        const client = await db.prepare('SELECT company_name FROM clients WHERE id = ?').bind(existing.client_id).first();
        if (client) clientName = client.company_name;
      }

      // Convert base64 to blob
      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });

      const filename = `${params.id}_${photo_type || 'photo'}_${Date.now()}.jpg`;
      const driveFileId = await uploadFileToGoogleDrive(env, blob, filename, clientName, params.id);

      // Get Drive URL
      let photoUrl = null;
      if (driveFileId) {
        photoUrl = `https://drive.google.com/uc?id=${driveFileId}`;
      }

      // Update job with photo URL
      const field = photo_type === 'signature' ? 'before_photo' : (photo_type === 'after' ? 'after_photo' : 'before_photo');
      if (photoUrl) {
        await db
          .prepare(`UPDATE service_records SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
          .bind(photoUrl, params.id)
          .run();
      }

      // Send photo to Telegram immediately (use base64 for reliable delivery)
      try {
        const { sendTelegramPhotoNotification } = await import('../utils/telegram.js');
        const typeLabel = photo_type === 'before' ? 'Before' : photo_type === 'after' ? 'After' : 'Signature';
        await sendTelegramPhotoNotification(env, photo_base64, `📸 ${typeLabel} Photo — ${params.id}`);
      } catch (e) {
        console.warn('Telegram photo notification failed:', e.message);
      }

      return success({ drive_file_id: driveFileId, photo_url: photoUrl, field });
    } catch (err) {
      console.error('Upload photo error:', err.message);
      return error('Failed to upload photo', 500);
    }
  });

  // ── POST /api/jobs/:id/notify ─────────────────────────────────────────
  router.post('/api/jobs/:id/notify', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const { message } = body;

      const job = await db.prepare('SELECT j.*, c.company_name, c.phone FROM service_records j LEFT JOIN clients c ON j.client_id = c.id WHERE j.id = ?').bind(params.id).first();
      if (!job) return error('Job not found', 404);

      // Send Telegram notification
      try {
        const { sendTelegramNotification } = await import('../utils/telegram.js');
        const notifyText = `✅ *Job Completed*\n\n` +
          `📋 *Job:* ${params.id}\n` +
          `👤 *Client:* ${job.company_name || 'N/A'}\n` +
          `🔧 *Type:* ${job.service_type}\n` +
          `👨‍💼 *Technician:* ${user.name}\n` +
          (message ? `\n📝 ${message}` : '');
        await sendTelegramNotification(env, notifyText);
      } catch (e) {
        console.warn('Telegram notification failed:', e.message);
      }

      return success({ notified: true });
    } catch (err) {
      console.error('Send notification error:', err.message);
      return error('Failed to send notification', 500);
    }
  });

  // ── POST /api/admin/jobs/edit (alias for PUT /api/jobs/:id) ────────────
  router.post('/api/admin/jobs/edit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const id = body.id;
      if (!id) return error('Missing job id', 400);

      const allowed = ['client_id', 'technician_id', 'service_type', 'status', 'job_description', 'maps_url', 'arrival_lat', 'arrival_lng', 'technician_notes'];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);
      updates.push("updated_at = datetime('now')");
      values.push(id);

      await db.prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
      return success({ message: 'Job updated' });
    } catch (err) {
      console.error('Update job error:', err.message);
      return error('Failed to update job', 500);
    }
  });

  // ── POST /api/admin/jobs/cancel (alias for POST /api/jobs/:id/status) ──
  router.post('/api/admin/jobs/cancel', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = (await request.json()) as any;
      const id = body.id;
      if (!id) return error('Missing job id', 400);

      const existing = await db.prepare('SELECT * FROM service_records WHERE id = ?').bind(id).first();
      if (!existing) return error('Job not found', 404);

      await db.prepare("UPDATE service_records SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?").bind(id).run();
      return success({ id, previous_status: existing.status, new_status: 'Cancelled' });
    } catch (err) {
      console.error('Cancel job error:', err.message);
      return error('Failed to cancel job', 500);
    }
  });
}

export { register };
