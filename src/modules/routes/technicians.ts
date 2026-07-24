/**
 * Technicians Routes — CRUD + management for technician accounts
 */

import { getCorsHeaders } from '../utils/cors.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';

/**
 * @param {import("../utils/router").Router} router
 * @param {{ DB: import("../../..").D1Database }} env
 */
function register(router, env) {
  const db = env.DB;

  // ── GET /api/technicians ──────────────────────────────────────────────
  router.get('/api/technicians', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const active = url.searchParams.get('active');
      const role = url.searchParams.get('role');

      let query = 'SELECT * FROM technicians WHERE 1=1';
      const params = [];

      if (active !== null) {
        query += ' AND active = ?';
        params.push(active === 'true' ? 1 : 0);
      }
      if (role) {
        query += ' AND role = ?';
        params.push(role);
      }
      query += ' ORDER BY name ASC';

      const stmt = db.prepare(query);
      const result = await (params.length ? stmt.bind(...params) : stmt).all();

      const technicians = result.results.map((t) => ({
        ...t,
        specialties: t.specialties ? (JSON.parse(t.specialties) as any) : [],
      }));

      return success(technicians);
    } catch (err) {
      return error('Failed to fetch technicians: ' + err.message, 500);
    }
  });

  // ── GET /api/technicians/:id ──────────────────────────────────────────
  router.get('/api/technicians/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const tech = await db
        .prepare('SELECT * FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();

      if (!tech) return error('Technician not found', 404);

      return success({
        ...tech,
        specialties: tech.specialties ? (JSON.parse(tech.specialties) as any) : [],
      });
    } catch (err) {
      return error('Failed to fetch technician: ' + err.message, 500);
    }
  });

  // ── POST /api/technicians ─────────────────────────────────────────────
  router.post('/api/technicians', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const body = (await request.json()) as any;
      const { name, email, phone, pin, role, specialties } = body;

      if (!name || !email || !pin) {
        return error('Missing required fields: name, email, pin', 400);
      }

      // Validate PIN: must be 4-6 digits
      if (!/^\d{4,6}$/.test(pin)) {
        return error('PIN must be 4-6 digits', 400);
      }

      // Hash PIN using Web Crypto API
      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const saltHex = Array.from(salt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const pinData = encoder.encode(pin + saltHex);
      const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedPin =
        '$sha256$' + saltHex + '$' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      // Generate ID
      const id = 'TECH-' + Date.now().toString(36).toUpperCase();

      const result = await db
        .prepare(
          'INSERT INTO technicians (id, name, email, phone, pin, role, specialties, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)'
        )
        .bind(
          id,
          name,
          email,
          phone || null,
          hashedPin,
          role || 'technician',
          specialties ? JSON.stringify(specialties) : '[]'
        )
        .run();

      return success({ id, name, email, role: role || 'technician' }, 201);
    } catch (err) {
      return error('Failed to create technician: ' + err.message, 500);
    }
  });

  // ── PUT /api/technicians/:id ──────────────────────────────────────────
  router.put('/api/technicians/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin' && user.id !== params.id) {
        return error('Forbidden', 403);
      }

      const body = (await request.json()) as any;
      const { name, email, phone, role, specialties, active } = body;

      const existing = await db
        .prepare('SELECT * FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Technician not found', 404);

      const updates = [];
      const values = [];

      if (name !== undefined) {
        updates.push('name = ?');
        values.push(name);
      }
      if (email !== undefined) {
        updates.push('email = ?');
        values.push(email);
      }
      if (phone !== undefined) {
        updates.push('phone = ?');
        values.push(phone);
      }
      if (role !== undefined && user.role?.toLowerCase() === 'admin') {
        updates.push('role = ?');
        values.push(role);
      }
      if (specialties !== undefined) {
        updates.push('specialties = ?');
        values.push(JSON.stringify(specialties));
      }
      if (active !== undefined && user.role?.toLowerCase() === 'admin') {
        updates.push('active = ?');
        values.push(active ? 1 : 0);
      }

      if (updates.length === 0) return error('No fields to update', 400);

      values.push(params.id);
      await db
        .prepare(`UPDATE technicians SET ${updates.join(', ')} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: 'Technician updated' });
    } catch (err) {
      return error('Failed to update technician: ' + err.message, 500);
    }
  });

  // ── DELETE /api/technicians/:id ───────────────────────────────────────
  router.delete('/api/technicians/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: admin only', 403);

      const existing = await db
        .prepare('SELECT id FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();
      if (!existing) return error('Technician not found', 404);

      // Soft-delete: set active = 0
      await db.prepare('UPDATE technicians SET active = 0 WHERE id = ?').bind(params.id).run();

      return success({ message: 'Technician deactivated' });
    } catch (err) {
      return error('Failed to delete technician: ' + err.message, 500);
    }
  });

  // ── PUT /api/technicians/:id/pin ──────────────────────────────────────
  router.put('/api/technicians/:id/pin', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);
      if (user.id !== params.id && user.role?.toLowerCase() !== 'admin') {
        return error('Forbidden', 403);
      }

      const { currentPin, newPin } = (await request.json()) as any;
      if (!currentPin || !newPin) {
        return error('Missing currentPin or newPin', 400);
      }

      const tech = await db
        .prepare('SELECT pin FROM technicians WHERE id = ?')
        .bind(params.id)
        .first();
      if (!tech) return error('Technician not found', 404);

      // Verify current PIN using Web Crypto API
      const encoder = new TextEncoder();
      const [_, algo, storedSalt, storedHash] =
        tech.pin.match(/^\$(sha256)\$([a-f0-9]+)\$([a-f0-9]+)$/) || [];
      if (algo === 'sha256') {
        const pinData = encoder.encode(currentPin + storedSalt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', pinData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
        if (computedHash !== storedHash) return error('Current PIN is incorrect', 401);
      } else {
        return error('Unknown hash algorithm', 500);
      }

      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newSaltHex = Array.from(newSalt)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const newPinData = encoder.encode(newPin + newSaltHex);
      const newHashBuffer = await crypto.subtle.digest('SHA-256', newPinData);
      const newHashArray = Array.from(new Uint8Array(newHashBuffer));
      const hashedPin =
        '$sha256$' +
        newSaltHex +
        '$' +
        newHashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      await db
        .prepare('UPDATE technicians SET pin = ? WHERE id = ?')
        .bind(hashedPin, params.id)
        .run();

      return success({ message: 'PIN updated successfully' });
    } catch (err) {
      return error('Failed to update PIN: ' + err.message, 500);
    }
  });
}

export default { register };
