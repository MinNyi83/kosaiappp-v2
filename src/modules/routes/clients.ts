/**
 * Clients Routes — Thin handlers delegating to ClientService (upgraded)
 */

import { success, error } from '../utils/response.js';
import { authenticate, requireCsrf } from '../utils/auth-middleware.js';
import { ClientService } from '../services/client.service.js';

function register(router, env) {
  const db = env.DB;
  const clientService = new ClientService(db);

  // ── GET /api/clients ──────────────────────────────────────────────────
  router.get('/api/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const result = await clientService.list({
        search: url.searchParams.get('search') || undefined,
        amc_status: url.searchParams.get('amc_status') || undefined,
        client_type: url.searchParams.get('client_type') || undefined,
        priority: url.searchParams.get('priority') || undefined,
        tags: url.searchParams.get('tags') || undefined,
        sort: url.searchParams.get('sort') || undefined,
        page: parseInt(url.searchParams.get('page') || '1'),
        limit: parseInt(url.searchParams.get('limit') || '200'),
      });
      return success(result);
    } catch (err: any) {
      return error('Failed to fetch clients: ' + err.message, 500);
    }
  });

  // ── GET /api/clients/stats ────────────────────────────────────────────
  router.get('/api/clients/stats', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const stats = await clientService.stats();
      return success(stats);
    } catch (err: any) {
      return error('Failed to fetch stats: ' + err.message, 500);
    }
  });

  // ── GET /api/clients/tags ─────────────────────────────────────────────
  router.get('/api/clients/tags', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const tags = await clientService.tags();
      return success(tags);
    } catch (err: any) {
      return error('Failed to fetch tags: ' + err.message, 500);
    }
  });

  // ── GET /api/clients/:id ──────────────────────────────────────────────
  router.get('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const client = await clientService.getById(params.id);
      if (!client) return error('Client not found', 404);
      return success(client);
    } catch (err: any) {
      return error('Failed to fetch client: ' + err.message, 500);
    }
  });

  // ── GET /api/clients/:id/history ──────────────────────────────────────
  router.get('/api/clients/:id/history', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      const history = await clientService.history(params.id);
      return success(history);
    } catch (err: any) {
      return error('Failed to fetch history: ' + err.message, 500);
    }
  });

  // ── POST /api/clients ─────────────────────────────────────────────────
  router.post('/api/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { company_name, contact_person, address, phone, email, notes, tags, client_type, priority, amc_status, amc_start, amc_end } = body;
      if (!company_name || !address) {
        return error('Missing required fields: company_name, address', 400);
      }

      const result = await clientService.create({ company_name, contact_person, address, phone, email, notes, tags, client_type, priority, amc_status, amc_start, amc_end });
      return success(result, 201);
    } catch (err: any) {
      return error('Failed to create client: ' + err.message, 500);
    }
  });

  // ── PUT /api/clients/:id ──────────────────────────────────────────────
  router.put('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const existing = await clientService.getById(params.id);
      if (!existing) return error('Client not found', 404);

      const body = (await request.json()) as any;
      const updated = await clientService.update(params.id, body);
      if (!updated) return error('No fields to update', 400);
      return success({ message: 'Client updated' });
    } catch (err: any) {
      return error('Failed to update client: ' + err.message, 500);
    }
  });

  // ── DELETE /api/clients/:id ───────────────────────────────────────────
  router.delete('/api/clients/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const existing = await clientService.getById(params.id);
      if (!existing) return error('Client not found', 404);

      await clientService.delete(params.id);
      return success({ message: 'Client deleted' });
    } catch (err: any) {
      return error('Failed to delete client: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/clients/bulk ──────────────────────────────────────
  router.post('/api/admin/clients/bulk', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { action, ids, updates } = body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return error('Missing ids array', 400);
      }

      if (action === 'bulk_delete') {
        await clientService.bulkDelete(ids);
        return success({ message: `${ids.length} client(s) deleted.` });
      } else if (action === 'bulk_update') {
        await clientService.bulkUpdate(ids, updates || {});
        return success({ message: `${ids.length} client(s) updated.` });
      } else {
        return error('Invalid action. Use bulk_delete or bulk_update.', 400);
      }
    } catch (err: any) {
      return error('Bulk operation failed: ' + err.message, 500);
    }
  });

  // ── Legacy admin endpoints (kept for backward compatibility) ──────────
  router.post('/api/admin/clients', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { company_name, contact_person, address, phone, email, notes, tags, client_type, priority, amc_status, amc_start, amc_end } = body;
      if (!company_name || !address) {
        return error('Missing required fields: company_name, address', 400);
      }

      const result = await clientService.create({ company_name, contact_person, address, phone, email, notes, tags, client_type, priority, amc_status, amc_start, amc_end });
      return success(result, 201);
    } catch (err: any) {
      return error('Failed to create client: ' + err.message, 500);
    }
  });

  router.post('/api/admin/clients/edit', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { id, ...data } = body;
      if (!id) return error('Missing client id', 400);

      const existing = await clientService.getById(id);
      if (!existing) return error('Client not found', 404);

      const updated = await clientService.update(id, data);
      if (!updated) return error('No fields to update', 400);
      return success({ message: 'Client updated' });
    } catch (err: any) {
      return error('Failed to update client: ' + err.message, 500);
    }
  });

  router.post('/api/admin/clients/delete', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body = (await request.json()) as any;
      const { id } = body;
      if (!id) return error('Missing client id', 400);

      const existing = await clientService.getById(id);
      if (!existing) return error('Client not found', 404);

      await clientService.delete(id);
      return success({ message: 'Client deleted' });
    } catch (err: any) {
      return error('Failed to delete client: ' + err.message, 500);
    }
  });

  router.get('/api/admin/clients/list', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const result = await clientService.list({ limit: 500 });
      return success(result.clients);
    } catch (err: any) {
      return error('Failed to fetch clients: ' + err.message, 500);
    }
  });
}

export { register };
