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
import { uploadBackupToGoogleDrive, getGoogleAccessToken } from './modules/utils/google.js';
import { sendTelegramNotification } from './modules/utils/telegram.js';

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
      const origin = request.headers.get('Origin') || undefined;
      return new Response(null, { headers: getCorsHeaders(origin) });
    }

    // ── Build router and register all modules ───────────────────────────
    const router = new Router();
    for (const mod of routeModules) {
      const registerFn = (mod as any).register || (mod as any).default?.register;
      if (typeof registerFn === 'function') {
        registerFn(router, env);
      } else {
        console.warn('Warning: Route module is missing register function', mod);
      }
    }

    // ── Match and execute route ─────────────────────────────────────────
    const origin = request.headers.get('Origin') || undefined;
    const match = router.match(method, url.pathname);
    if (match) {
      try {
        const response = await match.handler(request, match.params);
        return wrapResponse(response, origin);
      } catch (err) {
        console.error(`Route error [${method} ${url.pathname}]:`, err);
        return wrapResponse(error('Internal server error', 500), origin);
      }
    }

    // ── 404 fallback ────────────────────────────────────────────────────
    return wrapResponse(error(`Not found: ${method} ${url.pathname}`, 404), origin);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(handleAutoBackup(env));
  },
};

async function handleAutoBackup(env) {
  const dateStr = new Date().toISOString().split('T')[0];
  try {
    const db = env.DB;
    const tables = [
      'technicians',
      'clients',
      'service_records',
      'inventory_stock',
      'inventory_batches',
      'inventory_items',
      'cash_safes',
      'cash_transactions',
      'service_fees',
      'system_config',
      'landing_page',
    ];

    const backup: any = {};
    for (const table of tables) {
      try {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = (result as any).results || [];
      } catch (e) {
        console.warn(`Auto-backup: table ${table} not found or query failed:`, e.message);
      }
    }

    backup._exported_at = new Date().toISOString();
    backup._exported_by = 'system_cron';

    const backupJsonString = JSON.stringify(backup);
    const filename = `backup_${dateStr}_autobackup.json`;

    // 1. Upload to Google Drive (non-blocking — Telegram fires regardless)
    let driveFileId: string | null = null;
    try {
      driveFileId = await uploadBackupToGoogleDrive(env, backupJsonString, filename);
    } catch (driveErr) {
      console.error('Auto-backup Google Drive upload failed:', driveErr);
    }

    // 2. Notify Telegram
    let logMessage =
      `📊 *Database Auto-Backup Report*\n\n` +
      `📅 *Date:* ${dateStr}\n` +
      `📂 *Backup File:* \`${filename}\`\n`;

    if (driveFileId) {
      logMessage += `✅ *Google Drive Upload:* Successful\n` + `🔑 *File ID:* \`${driveFileId}\`\n`;
    } else {
      logMessage += `⚠️ *Google Drive Upload:* Failed (Token/Permissions Issue)\n`;
    }

    // Include summary counts
    logMessage += `\n📦 *Record Summaries:*`;
    for (const table of Object.keys(backup)) {
      if (!table.startsWith('_')) {
        logMessage += `\n• \`${table}\`: ${backup[table].length} records`;
      }
    }

    await sendTelegramNotification(env, logMessage);
  } catch (err) {
    console.error('Auto-backup cron failed:', err);
    try {
      await sendTelegramNotification(
        env,
        `🚨 *Database Auto-Backup Failed!*\n\n📅 *Date:* ${dateStr}\n❌ *Error:* ${err.message}`
      );
    } catch (e) {
      console.error('Failed to notify Telegram about backup failure:', e);
    }
  }
}

/**
 * Wrap a response object or plain data into a proper Response.
 */
function wrapResponse(data, origin?: string) {
  const corsHeaders = getCorsHeaders(origin);

  if (data instanceof Response) {
    const newHeaders = new Headers(data.headers);
    Object.entries(corsHeaders).forEach(([key, val]) => {
      newHeaders.set(key, val);
    });
    return new Response(data.body, {
      status: data.status,
      statusText: data.statusText,
      headers: newHeaders,
    });
  }

  const body = JSON.stringify(data);
  return new Response(body, {
    status: data?.statusCode || 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}
