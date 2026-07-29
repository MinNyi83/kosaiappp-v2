/**
 * Jobs Routes — Thin handlers delegating to JobService
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';
import { uploadFileToGoogleDrive } from '../utils/google.js';
import { JobService } from '../services/job.service.js';

function register(router, env) {
  const db = env.DB;
  const jobService = new JobService(db);

  // ── GET /api/jobs ─────────────────────────────────────────────────────
  router.get('/api/jobs', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const result = await jobService.list(
        {
          status: url.searchParams.get('status') || undefined,
          technician_id: url.searchParams.get('technician_id') || undefined,
          client_id: url.searchParams.get('client_id') || undefined,
          date_from: url.searchParams.get('date_from') || undefined,
          date_to: url.searchParams.get('date_to') || undefined,
          search: url.searchParams.get('search') || undefined,
          page: parseInt(url.searchParams.get('page') || '1'),
          limit: parseInt(url.searchParams.get('limit') || '50'),
        },
        user.id,
        user.role?.toLowerCase() === 'admin'
      );
      return success(result);
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
      const result = await jobService.getActive(user.id, user.role?.toLowerCase() === 'admin');
      return success(result);
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
      const result = await jobService.getCalendar(
        url.searchParams.get('date_from') || undefined,
        url.searchParams.get('date_to') || undefined,
        user.id,
        user.role?.toLowerCase() === 'admin'
      );
      return success(result);
    } catch (err) {
      console.error('Fetch calendar error:', err.message);
      return error('Failed to fetch calendar', 500);
    }
  });

  // ── GET /api/jobs/receipt ────────────────────────────────────────────
  router.get('/api/jobs/receipt', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const url = new URL(request.url);
      const job_id = url.searchParams.get('job_id');
      if (!job_id) return success(null);
      const job = await jobService.getReceipt(job_id);
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
      const job = await jobService.getById(params.id);
      if (!job) return error('Job not found', 404);
      if (user.role?.toLowerCase() !== 'admin' && (job as any).technician_id !== user.id) {
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { service_type, job_description, client_id, technician_id } = body;
      if (!service_type || !client_id || !job_description) {
        return error('Missing required fields: service_type, client_id, job_description', 400);
      }

      const result = await jobService.create({ client_id, technician_id, service_type, job_description });
      return success(result, 201);
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const existing = await jobService.getById(params.id);
      if (!existing) return error('Job not found', 404);
      if (user.role?.toLowerCase() !== 'admin' && (existing as any).technician_id !== user.id) {
        return error('Forbidden', 403);
      }

      const body = (await request.json()) as any;
      const updated = await jobService.update(params.id, body);
      if (!updated) return error('No fields to update', 400);
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const existing = await jobService.getById(params.id);
      if (!existing) return error('Job not found', 404);
      await jobService.delete(params.id);
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

      const { requireCsrf } = await import('../utils/csrf.js');
      if (!(await requireCsrf(request, user.id))) {
        return error('Invalid CSRF token', 403);
      }

      const result = await jobService.updateStatus(params.id, status, notes);
      if (result.error === 'not_found') return error('Job not found', 404);
      if (result.error) return error(result.error, 400);

      // Send Telegram notification for status change
      try {
        const { sendTelegramNotification } = await import('../utils/telegram.js');
        let clientName = 'N/A';
        if ((result as any).existing?.client_id) {
          const client = await db.prepare('SELECT company_name FROM clients WHERE id = ?').bind((result as any).existing.client_id).first();
          if (client) clientName = (client as any).company_name;
        }

        const statusEmoji: Record<string, string> = { 'Pending': '⏳', 'In Progress': '🔧', 'Completed': '✅', 'Cancelled': '❌' };
        const emoji = statusEmoji[status] || '📋';
        const notifyText = `${emoji} *Job ${status}*\n\n` +
          `📋 *Job:* ${params.id}\n` +
          `👤 *Client:* ${clientName}\n` +
          `🔧 *Type:* ${(result as any).existing?.service_type}\n` +
          `👨‍💼 *Technician:* ${user.name}\n` +
          (notes ? `\n📝 ${notes}` : '');

        await sendTelegramNotification(env, notifyText);
      } catch (e: any) {
        console.warn('Telegram notification failed:', e.message);
      }

      return success({ id: params.id, previous_status: (result as any).previous_status, new_status: (result as any).new_status });
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { photo_base64, photo_type } = body;
      if (!photo_base64) return error('Missing photo_base64', 400);

      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
      const estimatedSize = Math.ceil(base64Data.length * 3 / 4);
      if (estimatedSize > 10 * 1024 * 1024) {
        return error('Photo too large (max 10MB)', 400);
      }

      const existing = await jobService.getById(params.id);
      if (!existing) return error('Job not found', 404);

      let clientName = 'Unknown Client';
      if ((existing as any).client_id) {
        const client = await db.prepare('SELECT company_name FROM clients WHERE id = ?').bind((existing as any).client_id).first();
        if (client) clientName = (client as any).company_name;
      }

      const binaryStr = atob(base64Data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'image/jpeg' });

      const filename = `${params.id}_${photo_type || 'photo'}_${Date.now()}.jpg`;
      const driveFileId = await uploadFileToGoogleDrive(env, blob, filename, clientName, params.id);

      let photoUrl = null;
      if (driveFileId) {
        photoUrl = `https://drive.google.com/uc?id=${driveFileId}`;
      }

      const field = photo_type === 'signature' ? 'before_photo' : (photo_type === 'after' ? 'after_photo' : 'before_photo');
      if (photoUrl) {
        await jobService.update(params.id, { [field]: photoUrl } as any);
      }

      try {
        const { sendTelegramPhotoNotification } = await import('../utils/telegram.js');
        const typeLabel = photo_type === 'before' ? 'Before' : photo_type === 'after' ? 'After' : 'Signature';
        await sendTelegramPhotoNotification(env, photo_base64, `📸 ${typeLabel} Photo — ${params.id}`);
      } catch (e: any) {
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
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { message } = body;

      const job: any = await db.prepare('SELECT j.*, c.company_name, c.phone FROM service_records j LEFT JOIN clients c ON j.client_id = c.id WHERE j.id = ?').bind(params.id).first();
      if (!job) return error('Job not found', 404);

      try {
        const { sendTelegramNotification } = await import('../utils/telegram.js');
        const notifyText = `✅ *Job Completed*\n\n` +
          `📋 *Job:* ${params.id}\n` +
          `👤 *Client:* ${job.company_name || 'N/A'}\n` +
          `🔧 *Type:* ${job.service_type}\n` +
          `👨‍💼 *Technician:* ${user.name}\n` +
          (message ? `\n📝 ${message}` : '');
        await sendTelegramNotification(env, notifyText);
      } catch (e: any) {
        console.warn('Telegram notification failed:', e.message);
      }

      return success({ notified: true });
    } catch (err) {
      console.error('Send notification error:', err.message);
      return error('Failed to send notification', 500);
    }
  });

  // ── POST /api/admin/jobs/edit ─────────────────────────────────────────
  router.post('/api/admin/jobs/edit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const id = body.id;
      if (!id) return error('Missing job id', 400);

      const result = await jobService.adminEdit(id, body);
      if (result.error === 'no_fields') return error('No fields to update', 400);
      return success({ message: 'Job updated' });
    } catch (err) {
      console.error('Update job error:', err.message);
      return error('Failed to update job', 500);
    }
  });

  // ── POST /api/admin/jobs/cancel ───────────────────────────────────────
  router.post('/api/admin/jobs/cancel', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const id = body.id;
      if (!id) return error('Missing job id', 400);

      const result = await jobService.adminCancel(id);
      if (result.error === 'not_found') return error('Job not found', 404);
      return success(result);
    } catch (err) {
      console.error('Cancel job error:', err.message);
      return error('Failed to cancel job', 500);
    }
  });
}

export { register };
