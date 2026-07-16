/**
 * Kosai v2 — Main Entry Point
 *
 * A modular Cloudflare Worker that routes requests to domain-specific modules.
 * Each module registers its routes on a shared Router instance.
 *
 * Route modules (src/modules/routes/):
 *   auth, technicians, clients, jobs, inventory, invoices, expenses,
 *   attendance, reports, admin, ai, telegram, public, google,
 *   batches, rma, distributors, cashsafe, servicefees, landing
 *
 * Utility modules (src/modules/utils/):
 *   cors, response, jwt, router, telegram, viber, google, gemini
 */

import { Router } from './modules/utils/router.js';
import { getCorsHeaders } from './modules/utils/cors.js';
import { error } from './modules/utils/response.js';

// ── Route module registry ────────────────────────────────────────────────
import * as authRoutes from './modules/routes/auth.js';
import * as techniciansRoutes from './modules/routes/technicians.js';
import * as clientsRoutes from './modules/routes/clients.js';
import * as jobsRoutes from './modules/routes/jobs.js';
import * as inventoryRoutes from './modules/routes/inventory.js';
import * as invoicesRoutes from './modules/routes/invoices.js';
import * as expensesRoutes from './modules/routes/expenses.js';
import * as attendanceRoutes from './modules/routes/attendance.js';
import * as reportsRoutes from './modules/routes/reports.js';
import * as adminRoutes from './modules/routes/admin.js';
import * as aiRoutes from './modules/routes/ai.js';
import * as telegramRoutes from './modules/routes/telegram.js';
import * as publicRoutes from './modules/routes/public.js';
import * as googleRoutes from './modules/routes/google.js';
import * as batchesRoutes from './modules/routes/batches.js';
import * as rmaRoutes from './modules/routes/rma.js';
import * as distributorsRoutes from './modules/routes/distributors.js';
import * as cashsafeRoutes from './modules/routes/cashsafe.js';
import * as servicefeesRoutes from './modules/routes/servicefees.js';
import * as landingRoutes from './modules/routes/landing.js';

const routeModules = [
  authRoutes,
  techniciansRoutes,
  clientsRoutes,
  jobsRoutes,
  inventoryRoutes,
  invoicesRoutes,
  expensesRoutes,
  attendanceRoutes,
  reportsRoutes,
  adminRoutes,
  aiRoutes,
  telegramRoutes,
  publicRoutes,
  googleRoutes,
  batchesRoutes,
  rmaRoutes,
  distributorsRoutes,
  cashsafeRoutes,
  servicefeesRoutes,
  landingRoutes,
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // ── CORS preflight ──────────────────────────────────────────────────
    if (method === 'OPTIONS') {
      return new Response(null, { headers: getCorsHeaders() });
    }

    // ── Build router and register all modules ───────────────────────────
    const router = new Router();
    for (const mod of routeModules) {
      mod.register(router, env);
    }

    // ── Match and execute route ─────────────────────────────────────────
    const match = router.match(method, url.pathname);
    if (match) {
      try {
        const response = await match.handler(request, match.params);
        return wrapResponse(response);
      } catch (err) {
        console.error(`Route error [${method} ${url.pathname}]:`, err);
        return wrapResponse(error('Internal server error', 500));
      }
    }

    // ── 404 fallback ────────────────────────────────────────────────────
    return wrapResponse(error(`Not found: ${method} ${url.pathname}`, 404));
  },
};

/**
 * Wrap a response object or plain data into a proper Response.
 */
function wrapResponse(data) {
  if (data instanceof Response) return data;

  const body = JSON.stringify(data);
  return new Response(body, {
    status: data?.statusCode || 200,
    headers: {
      'Content-Type': 'application/json',
      ...getCorsHeaders(),
    },
  });
}
