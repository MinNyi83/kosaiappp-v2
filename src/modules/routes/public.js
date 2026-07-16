/**
 * Public Routes — No authentication required (contact form, exchange rates, etc.)
 */

import { success, error } from '../utils/response.js';
import { getCorsHeaders } from '../utils/cors.js';

function register(router, env) {
  const db = env.DB;

  // ── POST /api/public/contact ──────────────────────────────────────────
  router.post('/api/public/contact', async (request) => {
    try {
      const { name, email, phone, message } = await request.json();
      if (!name || !email || !message) {
        return error('Missing required fields: name, email, message', 400);
      }

      const id = 'CONTACT-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          'INSERT INTO contact_submissions (id, name, email, phone, message) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(id, name, email, phone || null, message)
        .run();

      return success({ id, message: "Thank you! We'll get back to you soon." }, 201);
    } catch (err) {
      return error('Failed to submit contact form: ' + err.message, 500);
    }
  });

  // ── GET /api/public/exchange-rate ─────────────────────────────────────
  router.get('/api/public/exchange-rate', async (request) => {
    try {
      const url = new URL(request.url);
      const base = url.searchParams.get('base') || 'USD';
      const target = url.searchParams.get('target') || 'PHP';

      // Try DB first, then fall back to external API
      const cached = await db
        .prepare(
          "SELECT * FROM exchange_rates WHERE base_currency = ? AND target_currency = ? AND updated_at > datetime('now', '-1 hour')"
        )
        .bind(base, target)
        .first();

      if (cached) {
        return success({ base, target, rate: cached.rate, source: 'cache' });
      }

      // Fetch from external API (example: exchangerate-api.com)
      try {
        const resp = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
        const data = await resp.json();
        const rate = data.rates[target];
        if (rate) {
          // Cache it
          await db
            .prepare(
              "INSERT INTO exchange_rates (base_currency, target_currency, rate) VALUES (?, ?, ?) ON CONFLICT(base_currency, target_currency) DO UPDATE SET rate = excluded.rate, updated_at = datetime('now')"
            )
            .bind(base, target, rate)
            .run();
          return success({ base, target, rate, source: 'api' });
        }
        return error('Currency pair not found', 404);
      } catch {
        return error('Exchange rate service unavailable', 503);
      }
    } catch (err) {
      return error('Failed to fetch exchange rate: ' + err.message, 500);
    }
  });

  // ── GET /api/public/serials ───────────────────────────────────────────
  router.get('/api/public/serials', async (request) => {
    try {
      const url = new URL(request.url);
      const serial = url.searchParams.get('serial');
      if (!serial) return error('Missing serial parameter', 400);

      const item = await db
        .prepare(
          'SELECT i.name, i.sku, b.batch_number, s.serial_number, s.status FROM serial_numbers s JOIN inventory i ON s.item_id = i.id LEFT JOIN batches b ON s.batch_id = b.id WHERE s.serial_number = ?'
        )
        .bind(serial)
        .first();

      if (!item) return error('Serial number not found', 404);
      return success(item);
    } catch (err) {
      return error('Failed to lookup serial: ' + err.message, 500);
    }
  });

  // ── GET /api/public/technician/:id ────────────────────────────────────
  router.get('/api/public/technician/:id', async (request, params) => {
    try {
      const tech = await db
        .prepare('SELECT id, name, role FROM technicians WHERE id = ? AND active = 1')
        .bind(params.id)
        .first();

      if (!tech) return error('Technician not found', 404);
      return success(tech);
    } catch (err) {
      return error('Failed to verify technician: ' + err.message, 500);
    }
  });

  // ── GET /api/public/landing ───────────────────────────────────────────
  router.get('/api/public/landing', async (request) => {
    try {
      const sections = await db
        .prepare('SELECT * FROM landing_page_content WHERE active = 1 ORDER BY sort_order ASC')
        .all();

      const config = await db
        .prepare("SELECT key, value FROM system_config WHERE key LIKE 'landing.%'")
        .all();

      const configMap = {};
      for (const c of config.results) {
        configMap[c.key.replace('landing.', '')] = c.value;
      }

      return success({
        sections: sections.results,
        config: configMap,
      });
    } catch (err) {
      return error('Failed to fetch landing page: ' + err.message, 500);
    }
  });

  // ── GET /api/public/service-fees ──────────────────────────────────────
  router.get('/api/public/service-fees', async () => {
    try {
      const fees = await db
        .prepare('SELECT * FROM service_fees WHERE active = 1 ORDER BY category ASC, name ASC')
        .all();
      return success(fees.results);
    } catch (err) {
      return error('Failed to fetch service fees: ' + err.message, 500);
    }
  });
}

export { register };
