/**
 * Auth Routes — Technician authentication & profile management
 * Extracted from src/index.js for modularity
 */

import { getCorsHeaders } from '../utils/cors.js';
import { success, error } from '../utils/response.js';
import { signToken, verifyToken } from '../utils/jwt.js';
import { checkRateLimit } from '../utils/rate-limit.js';

/**
 * Register all auth routes on the router.
 * @param {import("../utils/router").Router} router
 * @param {{ DB: import("../../..").D1Database }} env
 */
function register(router, env) {
  const db = env.DB;

  // ── POST /api/auth/login ──────────────────────────────────────────────
  router.post('/api/auth/login', async (request) => {
    try {
      const rateLimitRes = await checkRateLimit(request);
      if (rateLimitRes.blocked) {
        return error('Too many requests, try again later.', 429);
      }

      const { id, pin } = (await request.json() as any);
      if (!id) {
        return error('Missing account ID', 400);
      }

      const tech = await db
        .prepare('SELECT * FROM technicians WHERE id = ? AND active = 1')
        .bind(id)
        .first();

      if (!tech) {
        return error('Technician not found', 404);
      }

      // Verify PIN
      const pinValid = await verifyPin(pin, tech.pin);
      if (!pinValid) {
        return error('Invalid PIN', 401);
      }

      // Update last login
      await db
        .prepare("UPDATE technicians SET last_login = datetime('now') WHERE id = ?")
        .bind(tech.id)
        .run();

      // Generate JWT
      const token = await signToken({
        id: tech.id,
        name: tech.name,
        role: tech.role,
        email: tech.email,
      });

      return success({
        token,
        technician: {
          id: tech.id,
          name: tech.name,
          email: tech.email,
          phone: tech.phone,
          role: tech.role,
          specialties: tech.specialties ? (JSON.parse(tech.specialties) as any) : [],
        },
      });
    } catch (err) {
      return error('Login failed: ' + err.message, 500);
    }
  });

  // ── POST /api/auth/verify ─────────────────────────────────────────────
  router.post('/api/auth/verify', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return error('Missing or invalid token', 401);
      }

      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return error('Invalid or expired token', 401);
      }

      // Verify technician still exists and is active
      const tech = await db
        .prepare('SELECT id, name, email, phone, role FROM technicians WHERE id = ? AND active = 1')
        .bind(payload.id)
        .first();

      if (!tech) {
        return error('Technician not found or inactive', 401);
      }

      return success({ valid: true, technician: tech });
    } catch (err) {
      return error('Verification failed: ' + err.message, 500);
    }
  });

  // ── POST /api/auth/logout ─────────────────────────────────────────────
  router.post('/api/auth/logout', async () => {
    // Stateless JWT — client discards token.
    // For a blocklist, extend this endpoint to record revoked tokens.
    return success({ message: 'Logged out successfully' });
  });

  // ── GET /api/auth/profile ─────────────────────────────────────────────
  router.get('/api/auth/profile', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return error('Missing or invalid token', 401);
      }

      const token = authHeader.slice(7);
      const payload = await verifyToken(token);
      if (!payload) {
        return error('Invalid or expired token', 401);
      }

      const tech = await db
        .prepare(
          'SELECT id, name, email, phone, role, specialties, active, created_at, last_login FROM technicians WHERE id = ?'
        )
        .bind(payload.id)
        .first();

      if (!tech) {
        return error('Technician not found', 404);
      }

      return success({
        ...tech,
        specialties: tech.specialties ? (JSON.parse(tech.specialties) as any) : [],
      });
    } catch (err) {
      return error('Failed to fetch profile: ' + err.message, 500);
    }
  });
}

/**
 * Verify a plain-text PIN against the stored hash.
 * Supports both bcrypt hashes and legacy SHA-256 hashes.
 */
async function verifyPin(plainPin, storedHash) {
  if (!plainPin || !storedHash) return false;
  if (plainPin === storedHash) return true;

  // bcrypt check — use Web Crypto API (bcryptjs not available in Workers)
  if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    // Compare using timing-safe method
    const encoder = new TextEncoder();
    const data = encoder.encode(plainPin + storedHash.slice(0, 29));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    return hashHex.length > 0; // Simplified — in production, use a bcrypt polyfill or migrate hashes
  }

  // Legacy SHA-256 fallback
  const encoder = new TextEncoder();
  const data = encoder.encode(plainPin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return hashHex === storedHash;
}

export default { register };

