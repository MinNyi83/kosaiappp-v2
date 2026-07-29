/**
 * Sync Routes — REST API for offline-first sync between local clients and cloud D1.
 *
 * POST /api/sync/push      — Push client changes to server
 * GET  /api/sync/pull       — Pull server changes to client
 * GET  /api/sync/changes    — Get all changes since timestamp
 * GET  /api/sync/status     — Get sync status for client
 */

import { Router } from '../utils/router.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';
import { requireCsrf } from '../utils/csrf.js';
import { SyncService } from '../services/sync.service.js';

export function register(router: Router, env: any) {
  const syncService = new SyncService(env.DB);

  // ── POST /api/sync/push ────────────────────────────────────────────────
  router.post('/api/sync/push', async (request) => {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);
    if (!(await requireCsrf(request, user.id))) return error('Invalid CSRF token', 403);

    try {
      const body = await request.json();
      const { client_id, records, last_pull_timestamp } = body;

      if (!client_id || !Array.isArray(records)) {
        return error('Missing client_id or records array', 400);
      }

      const result = await syncService.push({
        client_id,
        records,
        last_pull_timestamp,
      });

      return success(result);
    } catch (err) {
      console.error('Sync push error:', err);
      return error('Sync push failed', 500);
    }
  });

  // ── GET /api/sync/pull ─────────────────────────────────────────────────
  router.get('/api/sync/pull', async (request) => {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);

    try {
      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id') || user.id;
      const since = url.searchParams.get('since') || undefined;
      const tables = url.searchParams.get('tables')?.split(',') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '500', 10);

      const result = await syncService.pull({
        client_id,
        since,
        tables,
        limit,
      });

      return success(result);
    } catch (err) {
      console.error('Sync pull error:', err);
      return error('Sync pull failed', 500);
    }
  });

  // ── GET /api/sync/changes ──────────────────────────────────────────────
  router.get('/api/sync/changes', async (request) => {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);
    if (user.role?.toLowerCase() !== 'admin') return error('Admin only', 403);

    try {
      const url = new URL(request.url);
      const since = url.searchParams.get('since') || new Date(Date.now() - 86400000).toISOString();
      const tables = url.searchParams.get('tables')?.split(',') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '1000', 10);

      const result = await syncService.getChanges({ since, tables, limit });
      return success(result);
    } catch (err) {
      console.error('Sync changes error:', err);
      return error('Sync changes failed', 500);
    }
  });

  // ── GET /api/sync/status ───────────────────────────────────────────────
  router.get('/api/sync/status', async (request) => {
    const user = await authenticate(request);
    if (!user) return error('Unauthorized', 401);

    try {
      const url = new URL(request.url);
      const client_id = url.searchParams.get('client_id') || user.id;

      const result = await syncService.getStatus(client_id);
      return success(result);
    } catch (err) {
      console.error('Sync status error:', err);
      return error('Sync status failed', 500);
    }
  });
}
