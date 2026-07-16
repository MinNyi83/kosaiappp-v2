/**
 * Landing Page CMS Routes — Manage landing page content sections
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const user = await verifyToken(authHeader.slice(7));
    if (!user || user.role !== 'admin') return null;
    return user;
  }

  // ── GET /api/admin/landing ────────────────────────────────────────────
  router.get('/api/admin/landing', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const sections = await db
        .prepare('SELECT * FROM landing_page_content ORDER BY sort_order ASC')
        .all();

      return success(sections.results);
    } catch (err) {
      return error('Failed to fetch landing page: ' + err.message, 500);
    }
  });

  // ── POST /api/admin/landing ───────────────────────────────────────────
  router.post('/api/admin/landing', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { section_key, title, subtitle, content, image_url, sort_order, active } =
        await request.json();
      if (!section_key || !title) return error('Missing section_key or title', 400);

      const id = 'LND-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          'INSERT INTO landing_page_content (id, section_key, title, subtitle, content, image_url, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          section_key,
          title,
          subtitle || null,
          content || null,
          image_url || null,
          sort_order || 0,
          active !== undefined ? (active ? 1 : 0) : 1
        )
        .run();

      return success({ id, section_key, title }, 201);
    } catch (err) {
      return error('Failed to create section: ' + err.message, 500);
    }
  });

  // ── PUT /api/admin/landing/:id ────────────────────────────────────────
  router.put('/api/admin/landing/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body = await request.json();
      const allowed = [
        'section_key',
        'title',
        'subtitle',
        'content',
        'image_url',
        'sort_order',
        'active',
      ];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error('No fields to update', 400);
      values.push(params.id);

      await db
        .prepare(`UPDATE landing_page_content SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Section updated' });
    } catch (err) {
      return error('Failed to update section: ' + err.message, 500);
    }
  });

  // ── DELETE /api/admin/landing/:id ─────────────────────────────────────
  router.delete('/api/admin/landing/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      await db.prepare('DELETE FROM landing_page_content WHERE id = ?').bind(params.id).run();
      return success({ message: 'Section deleted' });
    } catch (err) {
      return error('Failed to delete section: ' + err.message, 500);
    }
  });
}

export { register };
