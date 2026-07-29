/**
 * Site Surveys & Quotations Route Modules — Redesigned v2
 *
 * Key changes:
 * - quotation_items table for line-item CRUD
 * - survey_photos table for site photo management
 * - portal_token based auth for customer-facing quotation approval
 * - One-click "Generate from Survey" creates linked quotation with items
 * - Signature storage on approval
 * - Pipeline status counts
 * - CSRF protection on all state-changing endpoints
 * - Optimistic locking on quotation updates (updated_at check)
 * - Server-side PDF generation
 * - Email delivery for quotation send
 * - Inventory linkage + stock deduction on conversion
 * - Quotation versioning with revision history
 */
import { Router } from '../utils/router.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';
import { requireCsrf } from '../utils/csrf.js';
import { SurveyService } from '../services/survey.service.js';
import { QuotationService } from '../services/quotation.service.js';

export function register(router: Router, env: any) {
  const db = env.DB;
  const surveyService = new SurveyService(db);
  const quotationService = new QuotationService(db);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async function requireAdmin(request: Request) {
    const user = await authenticate(request);
    if (!user) return { user: null, error: error('Unauthorized', 401) };
    if (user.role?.toLowerCase() !== 'admin') return { user, error: error('Forbidden: admin access required', 403) };
    return { user, error: null };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SURVEY ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════════════════════

  // ── GET /api/surveys ────────────────────────────────────────────────────────
  router.get('/api/surveys', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const clientId = url.searchParams.get('client_id');

      const surveys = await surveyService.list(clientId || undefined);

      // Pipeline counts
      const counts = await surveyService.getStatusCounts();

      return success({ surveys, counts });
    } catch (err: any) {
      console.error('List surveys error:', err.message);
      return error('Failed to fetch site surveys', 500);
    }
  });

  // ── GET /api/surveys/:id ────────────────────────────────────────────────────
  router.get('/api/surveys/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const survey = await surveyService.getById(params.id);
      if (!survey) return error('Survey not found', 404);
      return success(survey);
    } catch (err: any) {
      console.error('Get survey error:', err.message);
      return error('Failed to fetch survey', 500);
    }
  });

  // ── POST /api/surveys ──────────────────────────────────────────────────────
  router.post('/api/surveys', async (request) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      if (!body.client_id) return error('client_id is required', 400);

      // Resolve client
      let client = await db.prepare('SELECT id, company_name, address, phone FROM clients WHERE id = ? OR company_name = ?').bind(body.client_id, body.client_id).first();
      let resolvedClientId = client?.id;

      if (!resolvedClientId) {
        resolvedClientId = `CLI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await db.prepare("INSERT INTO clients (id, company_name, address, amc_status) VALUES (?, ?, 'Site Survey Client', 'Individual')").bind(resolvedClientId, body.client_id).run();
        client = { id: resolvedClientId, company_name: body.client_id, address: 'Site Survey Client' };
      }

      const id = `SURV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const technicianId = body.technician_id || user.id;

      await db.prepare(`
        INSERT INTO site_surveys (
          id, client_id, technician_id, survey_type, status, building_type,
          camera_count, cable_type, estimated_cable_meters,
          power_source_notes, mounting_type, site_photos, notes,
          scheduled_date, checklist_data, approval_status,
          site_type, site_address, contact_name, contact_phone,
          existing_infrastructure, special_requirements
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, resolvedClientId, technicianId,
        body.survey_type || 'CCTV', body.status || 'Draft',
        body.building_type || null, body.camera_count || 0,
        body.cable_type || null, body.estimated_cable_meters || 0,
        body.power_source_notes || null, body.mounting_type || null,
        JSON.stringify(body.site_photos || []), body.notes || null,
        body.scheduled_date || new Date().toISOString().slice(0, 16).replace('T', ' '),
        JSON.stringify(body.checklist_data || {}), 'Pending',
        body.site_type || null, body.site_address || null,
        body.contact_name || null, body.contact_phone || null,
        body.existing_infrastructure || null, body.special_requirements || null
      ).run();

      // Telegram notification
      try {
        const tech = await db.prepare('SELECT name, phone FROM technicians WHERE id = ?').bind(technicianId).first();
        const { sendTelegramNotification } = await import('../utils/telegram.js');
        const notifText = `📍 *NEW SITE SURVEY ASSIGNED*\n\n` +
          `*Survey ID:* \`${id}\`\n` +
          `*Client:* ${client.company_name}\n` +
          `*Address:* ${client.address || 'On-site'}\n` +
          `*Technician:* ${tech?.name || 'Assigned Tech'}\n` +
          `*Scheduled:* ${body.scheduled_date || 'Today'}\n` +
          `*Type:* ${body.survey_type || 'CCTV'}\n` +
          `*Notes:* ${body.notes || 'On-site evaluation required'}`;
        await sendTelegramNotification(env, notifText);
      } catch (e: any) {
        console.warn('Failed to send survey dispatch notification:', e.message);
      }

      return success({ id, message: 'Site survey created & technician dispatched successfully' }, 201);
    } catch (err: any) {
      console.error('Create survey error:', err.message || err);
      return error(`Failed to create site survey: ${err.message || 'Database error'}`, 500);
    }
  });

  // ── PUT /api/surveys/:id/complete ──────────────────────────────────────────
  router.put('/api/surveys/:id/complete', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json().catch(() => ({}));

      await db.prepare(`
        UPDATE site_surveys SET
          camera_count = COALESCE(?, camera_count),
          cable_type = COALESCE(?, cable_type),
          estimated_cable_meters = COALESCE(?, estimated_cable_meters),
          power_source_notes = COALESCE(?, power_source_notes),
          mounting_type = COALESCE(?, mounting_type),
          checklist_data = COALESCE(?, checklist_data),
          site_photos = COALESCE(?, site_photos),
          notes = COALESCE(?, notes),
          building_type = COALESCE(?, building_type),
          site_type = COALESCE(?, site_type),
          site_address = COALESCE(?, site_address),
          contact_name = COALESCE(?, contact_name),
          contact_phone = COALESCE(?, contact_phone),
          existing_infrastructure = COALESCE(?, existing_infrastructure),
          special_requirements = COALESCE(?, special_requirements),
          status = 'Completed',
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        body.camera_count !== undefined ? body.camera_count : null,
        body.cable_type !== undefined ? body.cable_type : null,
        body.estimated_cable_meters !== undefined ? body.estimated_cable_meters : null,
        body.power_source_notes !== undefined ? body.power_source_notes : null,
        body.mounting_type !== undefined ? body.mounting_type : null,
        body.checklist_data !== undefined ? JSON.stringify(body.checklist_data) : null,
        body.site_photos !== undefined ? JSON.stringify(body.site_photos) : null,
        body.notes !== undefined ? body.notes : null,
        body.building_type !== undefined ? body.building_type : null,
        body.site_type !== undefined ? body.site_type : null,
        body.site_address !== undefined ? body.site_address : null,
        body.contact_name !== undefined ? body.contact_name : null,
        body.contact_phone !== undefined ? body.contact_phone : null,
        body.existing_infrastructure !== undefined ? body.existing_infrastructure : null,
        body.special_requirements !== undefined ? body.special_requirements : null,
        params.id
      ).run();

      return success({ id: params.id, message: 'Site survey completed successfully!' });
    } catch (err: any) {
      console.error('Complete survey error:', err.message);
      return error('Failed to complete site survey', 500);
    }
  });

  // ── POST /api/surveys/:id/approve ──────────────────────────────────────────
  router.post('/api/surveys/:id/approve', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);
      if (user.role?.toLowerCase() !== 'admin') return error('Forbidden: Admin only', 403);

      await db.prepare(`UPDATE site_surveys SET approval_status = 'Approved', approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(user.id, params.id).run();
      return success({ id: params.id, message: 'Site survey approved!' });
    } catch (err: any) {
      console.error('Approve survey error:', err.message);
      return error('Failed to approve site survey', 500);
    }
  });

  // ── POST /api/surveys/:id/photos ───────────────────────────────────────────
  router.post('/api/surveys/:id/photos', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      if (!body.photo_url) return error('photo_url is required', 400);

      const photoId = `PHO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await db.prepare(`
        INSERT INTO survey_photos (id, survey_id, photo_url, photo_type, caption, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(photoId, params.id, body.photo_url, body.photo_type || 'general', body.caption || null, user.id).run();

      return success({ id: photoId, message: 'Photo added' }, 201);
    } catch (err: any) {
      console.error('Add survey photo error:', err.message);
      return error('Failed to add photo', 500);
    }
  });

  // ── GET /api/surveys/:id/photos ────────────────────────────────────────────
  router.get('/api/surveys/:id/photos', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { results } = await db.prepare('SELECT * FROM survey_photos WHERE survey_id = ? ORDER BY created_at ASC').bind(params.id).all();
      return success(results || []);
    } catch (err: any) {
      console.error('List survey photos error:', err.message);
      return error('Failed to fetch photos', 500);
    }
  });

  // ── DELETE /api/surveys/:id/photos/:photoId ────────────────────────────────
  router.delete('/api/surveys/:id/photos/:photoId', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      await db.prepare('DELETE FROM survey_photos WHERE id = ? AND survey_id = ?').bind(params.photoId, params.id).run();
      return success({ message: 'Photo removed' });
    } catch (err: any) {
      console.error('Delete survey photo error:', err.message);
      return error('Failed to delete photo', 500);
    }
  });

  // ── POST /api/surveys/:id/generate-bom ─────────────────────────────────────
  router.post('/api/surveys/:id/generate-bom', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const survey: any = await db.prepare('SELECT * FROM site_surveys WHERE id = ?').bind(params.id).first();
      if (!survey) return error('Site survey not found', 404);

      const { generateAutomatedBOM } = await import('../utils/bom-generator.js');
      const bomResult = generateAutomatedBOM({
        camera_count: survey.camera_count || 8,
        cat6_meters: survey.estimated_cable_meters || 150,
        retention_days: 30,
        resolution: '1080p',
        ups_required: true,
        poe_switch_required: true
      });

      return success({
        survey_id: params.id,
        client_id: survey.client_id,
        items: bomResult.items,
        total_usd: bomResult.total_usd
      });
    } catch (err: any) {
      console.error('Generate BOM error:', err.message);
      return error('Failed to generate automated BOM', 500);
    }
  });

  // ── GET /api/surveys/:id/structural ────────────────────────────────────────
  router.get('/api/surveys/:id/structural', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const serverRoom = await db.prepare('SELECT * FROM server_rooms WHERE survey_id = ?').bind(params.id).first();
      const cameraPlacements = await db.prepare('SELECT * FROM camera_placements WHERE survey_id = ? ORDER BY camera_index_label ASC').bind(params.id).all();

      return success({
        survey_id: params.id,
        server_room: serverRoom || null,
        camera_placements: cameraPlacements?.results || []
      });
    } catch (err: any) {
      console.error('Get structural survey error:', err.message);
      return error('Failed to fetch structural survey details', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // QUOTATION ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/quotations ─────────────────────────────────────────────────────
  router.get('/api/quotations', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const clientId = url.searchParams.get('client_id');

      const quotations = await quotationService.list(clientId || undefined);

      // Status counts
      const counts = await db.prepare(`
        SELECT
          SUM(CASE WHEN status IN ('Draft','Sent') THEN 1 ELSE 0 END) as active,
          SUM(CASE WHEN status = 'Approved' THEN 1 ELSE 0 END) as approved,
          SUM(CASE WHEN status = 'Converted' THEN 1 ELSE 0 END) as converted
        FROM quotations
      `).first();

      return success({ quotations, counts: counts || { active: 0, approved: 0, converted: 0 } });
    } catch (err: any) {
      console.error('List quotations error:', err.message);
      return error('Failed to fetch quotations', 500);
    }
  });

  // ── GET /api/quotations/:id ────────────────────────────────────────────────
  router.get('/api/quotations/:id', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const quo = await quotationService.getById(params.id);
      if (!quo) return error('Quotation not found', 404);
      return success(quo);
    } catch (err: any) {
      console.error('Get quotation error:', err.message);
      return error('Failed to fetch quotation', 500);
    }
  });

  // ── POST /api/quotations/bulk ────────────────────────────────────────────────
  router.post('/api/quotations/bulk', async (request) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const { action, quotation_ids } = body;
      if (!action || !Array.isArray(quotation_ids) || quotation_ids.length === 0) {
        return error('action and quotation_ids[] are required', 400);
      }

      const allowed = ['send', 'convert-job', 'convert-invoice', 'delete', 'export-pdf'];
      if (!allowed.includes(action)) return error(`Invalid action. Allowed: ${allowed.join(', ')}`, 400);

      const results: any[] = [];
      const errors: string[] = [];

      for (const qid of quotation_ids) {
        try {
          const quo: any = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(qid).first();
          if (!quo) { errors.push(`${qid}: not found`); continue; }

          switch (action) {
            case 'send': {
              let portalToken = quo.portal_token;
              if (!portalToken) {
                portalToken = crypto.randomUUID();
                await db.prepare('UPDATE quotations SET portal_token = ? WHERE id = ?').bind(portalToken, qid).run();
              }
              const portalUrl = `${env.PUBLIC_URL || 'https://awesomemyanmar.pages.dev'}/portal.html?quote=${portalToken}`;
              const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order').bind(qid).all();
              const itemsList = (lineItems || []).map((i: any) => `• ${i.name} (x${i.quantity}) - $${(i.quantity * i.unit_price).toFixed(2)}`).join('\n');
              const { sendTelegramNotification } = await import('../utils/telegram.js');
              await sendTelegramNotification(env,
                `📄 *QUOTATION*\n*Quote:* \`${qid}\`\n*Total:* $${(quo.total_amount || 0).toFixed(2)}\n🔗 ${portalUrl}`
              );
              await db.prepare(`UPDATE quotations SET status = 'Sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(qid).run();
              results.push({ id: qid, status: 'sent' });
              break;
            }
            case 'convert-job': {
              const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').bind(qid).all();
              const jobId = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
              const desc = `Converted from ${qid}. Items: ${(lineItems || []).map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`;
              await db.prepare(`INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description) VALUES (?, ?, ?, 'CCTV', 'Pending', ?)`).bind(jobId, quo.client_id, quo.prepared_by, desc).run();
              await db.prepare(`UPDATE quotations SET status = 'Converted', converted_job_id = ? WHERE id = ?`).bind(jobId, qid).run();
              results.push({ id: qid, job_id: jobId });
              break;
            }
            case 'convert-invoice': {
              const invoiceId = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
              await db.prepare(`INSERT INTO invoices (id, client_id, items, amount, tax, total, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).bind(invoiceId, quo.client_id, quo.items, quo.subtotal, quo.tax, quo.total_amount, quo.prepared_by).run();
              await db.prepare(`UPDATE quotations SET status = 'Converted', converted_invoice_id = ? WHERE id = ?`).bind(invoiceId, qid).run();
              results.push({ id: qid, invoice_id: invoiceId });
              break;
            }
            case 'delete': {
              await db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').bind(qid).run();
              await db.prepare('DELETE FROM quotations WHERE id = ?').bind(qid).run();
              results.push({ id: qid, status: 'deleted' });
              break;
            }
            case 'export-pdf': {
              results.push({ id: qid, pdf_url: `${env.PUBLIC_URL || 'https://awesomemyanmar.pages.dev'}/api/quotations/${qid}/pdf` });
              break;
            }
          }
        } catch (e: any) { errors.push(`${qid}: ${e.message}`); }
      }

      return success({ action, processed: results.length, errors: errors.length > 0 ? errors : undefined, results });
    } catch (err: any) {
      console.error('Bulk quotation error:', err.message);
      return error('Failed bulk operation', 500);
    }
  });

  // ── POST /api/quotations ────────────────────────────────────────────────────
  router.post('/api/quotations', async (request) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      if (!body.client_id) return error('client_id is required', 400);

      // Resolve client
      let client = await db.prepare('SELECT id FROM clients WHERE id = ? OR company_name = ?').bind(body.client_id, body.client_id).first();
      let resolvedClientId = client?.id;
      if (!resolvedClientId) {
        resolvedClientId = `CLI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await db.prepare("INSERT INTO clients (id, company_name, address, amc_status) VALUES (?, ?, 'Quotation Client', 'Individual')").bind(resolvedClientId, body.client_id).run();
      }

      const result = await quotationService.create({
        client_id: resolvedClientId,
        prepared_by: user.id,
        survey_id_link: body.survey_id || null,
        currency: body.currency || 'USD',
        valid_days: body.valid_days || 14,
        valid_until: body.valid_until || undefined,
        terms_conditions: body.terms_conditions || undefined,
        quotation_notes: body.quotation_notes || undefined,
        discount_pct: body.discount_pct || 0,
        tax_pct: body.tax_pct || 0,
        items: body.items || undefined,
      });

      return success({ id: result.id, portal_token: result.portal_token, message: 'Quotation created successfully' }, 201);
    } catch (err: any) {
      console.error('Create quotation error:', err.message);
      return error('Failed to create quotation', 500);
    }
  });

  // ── PUT /api/quotations/:id ────────────────────────────────────────────────
  router.put('/api/quotations/:id', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const quo: any = await db.prepare('SELECT id, updated_at FROM quotations WHERE id = ?').bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      // Optimistic locking: check updated_at if client provides it
      if (body._client_updated_at && quo.updated_at && body._client_updated_at !== quo.updated_at) {
        return error('Quotation was modified by another user. Please refresh and try again.', 409);
      }

      const updates: string[] = [];
      const values: any[] = [];

      const allowed = ['valid_days', 'valid_until', 'currency', 'exchange_rate', 'terms_conditions', 'discount_pct', 'discount_amount', 'tax_pct', 'quotation_notes', 'status'];
      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        updates.push('last_updated_by = ?');
        values.push(user.id);
        values.push(params.id);
        await db.prepare(`UPDATE quotations SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
        await quotationService.recalculateTotals(params.id);
      }

      return success({ message: 'Quotation updated' });
    } catch (err: any) {
      console.error('Update quotation error:', err.message);
      return error('Failed to update quotation', 500);
    }
  });

  // ── POST /api/quotations/:id/items ──────────────────────────────────────────
  router.post('/api/quotations/:id/items', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      if (!body.name) return error('Item name is required', 400);

      const quo = await db.prepare('SELECT id FROM quotations WHERE id = ?').bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const maxOrder = await db.prepare('SELECT MAX(sort_order) as max_order FROM quotation_items WHERE quotation_id = ?').bind(params.id).first();

      const itemId = await quotationService.addLineItem(params.id, {
        item_code: body.item_code || undefined,
        name: body.name,
        category: body.category || 'hardware',
        quantity: body.quantity || 1,
        unit_price: body.unit_price || 0,
        unit: body.unit || 'pc',
        notes: body.notes || undefined,
        sort_order: (maxOrder?.max_order || 0) + 1,
      });

      const totals = await quotationService.recalculateTotals(params.id);
      return success({ id: itemId, ...totals, message: 'Item added' }, 201);
    } catch (err: any) {
      console.error('Add quotation item error:', err.message);
      return error('Failed to add item', 500);
    }
  });

  // ── PUT /api/quotations/:id/items/:itemId ──────────────────────────────────
  router.put('/api/quotations/:id/items/:itemId', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const item = await db.prepare('SELECT id FROM quotation_items WHERE id = ? AND quotation_id = ?').bind(params.itemId, params.id).first();
      if (!item) return error('Item not found', 404);

      const allowed: Record<string, any> = {};
      for (const field of ['name', 'item_code', 'category', 'quantity', 'unit_price', 'unit', 'notes', 'sort_order']) {
        if (body[field] !== undefined) allowed[field] = body[field];
      }

      if (Object.keys(allowed).length > 0) {
        await quotationService.updateLineItem(params.id, params.itemId, allowed);
      }

      const totals = await quotationService.recalculateTotals(params.id);
      return success({ ...totals, message: 'Item updated' });
    } catch (err: any) {
      console.error('Update quotation item error:', err.message);
      return error('Failed to update item', 500);
    }
  });

  // ── DELETE /api/quotations/:id/items/:itemId ────────────────────────────────
  router.delete('/api/quotations/:id/items/:itemId', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      await quotationService.deleteLineItem(params.id, params.itemId);
      const totals = await quotationService.recalculateTotals(params.id);
      return success({ ...totals, message: 'Item removed' });
    } catch (err: any) {
      console.error('Delete quotation item error:', err.message);
      return error('Failed to delete item', 500);
    }
  });

  // ── POST /api/quotations/:id/recalculate ───────────────────────────────────
  router.post('/api/quotations/:id/recalculate', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const totals = await quotationService.recalculateTotals(params.id);
      return success({ ...totals, message: 'Totals recalculated' });
    } catch (err: any) {
      console.error('Recalculate error:', err.message);
      return error('Failed to recalculate', 500);
    }
  });

  // ── POST /api/quotations/:id/generate-from-survey ──────────────────────────
  router.post('/api/quotations/:id/generate-from-survey', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo: any = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const surveyId = quo.survey_id_link || quo.survey_id;
      if (!surveyId) return error('No survey linked to this quotation', 400);

      const survey: any = await db.prepare('SELECT * FROM site_surveys WHERE id = ?').bind(surveyId).first();
      if (!survey) return error('Linked survey not found', 404);

      const { generateAutomatedBOM } = await import('../utils/bom-generator.js');
      const bomResult = generateAutomatedBOM({
        camera_count: survey.camera_count || 8,
        cat6_meters: survey.estimated_cable_meters || 150,
        retention_days: 30,
        resolution: '1080p',
        ups_required: true,
        poe_switch_required: true
      });

      // Clear existing items and insert BOM items
      await db.prepare('DELETE FROM quotation_items WHERE quotation_id = ?').bind(params.id).run();

      for (let i = 0; i < bomResult.items.length; i++) {
        const item = bomResult.items[i];
        const itemId = `QIT-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await db.prepare(`
          INSERT INTO quotation_items (id, quotation_id, item_code, name, category, quantity, unit_price, unit, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(itemId, params.id, item.item_code, item.name, item.category, item.quantity, item.unit_price, item.unit, i).run();
      }

      const totals = await quotationService.recalculateTotals(params.id);

      // Update quotation status
      await db.prepare(`UPDATE quotations SET status = 'Draft', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(params.id).run();

      return success({ items_count: bomResult.items.length, ...totals, message: 'Quotation populated from survey BOM' });
    } catch (err: any) {
      console.error('Generate from survey error:', err.message);
      return error('Failed to generate from survey', 500);
    }
  });

  // ── POST /api/quotations/:id/send ──────────────────────────────────────────
  router.post('/api/quotations/:id/send', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo: any = await db.prepare(`
        SELECT q.*, c.company_name as client_name, c.contact_person, c.phone as client_phone
        FROM quotations q LEFT JOIN clients c ON q.client_id = c.id WHERE q.id = ?
      `).bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      // Ensure portal token exists
      let portalToken = quo.portal_token;
      if (!portalToken) {
        portalToken = crypto.randomUUID();
        await db.prepare('UPDATE quotations SET portal_token = ? WHERE id = ?').bind(portalToken, params.id).run();
      }

      const portalUrl = `${env.PUBLIC_URL || 'https://awesomemyanmar.pages.dev'}/portal.html?quote=${portalToken}`;

      // Fetch line items
      const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order').bind(params.id).all();
      const itemsList = (lineItems || []).map((i: any) => `• ${i.name} (x${i.quantity}) - $${(i.quantity * i.unit_price).toFixed(2)}`).join('\n');

      const messageText =
        `📄 *FORMAL PRICE QUOTATION*\n\n` +
        `*Quote ID:* \`${quo.id}\`\n` +
        `*Client:* ${quo.client_name}\n` +
        `*Valid Until:* ${quo.valid_until || '14 days'}\n\n` +
        `*Items & BOQ:*\n${itemsList || 'Custom Solution'}\n\n` +
        `*Subtotal:* $${quo.subtotal?.toFixed(2)}\n` +
        `*Discount:* $${quo.discount?.toFixed(2)}\n` +
        `*Tax:* $${quo.tax?.toFixed(2)}\n` +
        `*Total Amount:* *$${quo.total_amount?.toFixed(2)} ${quo.currency}*\n\n` +
        `🔗 [Review & Digitally Sign Quotation](${portalUrl})`;

      const { sendTelegramNotification } = await import('../utils/telegram.js');
      await sendTelegramNotification(env, messageText);

      await db.prepare(`UPDATE quotations SET status = 'Sent', sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(params.id).run();

      return success({ message: 'Quotation sent via Telegram!', portal_url: portalUrl });
    } catch (err: any) {
      console.error('Send quotation error:', err.message);
      return error('Failed to send quotation', 500);
    }
  });

  // ── POST /api/quotations/:id/save-drive ────────────────────────────────────
  router.post('/api/quotations/:id/save-drive', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo: any = await db.prepare(`
        SELECT q.*, c.company_name as client_name, c.contact_person
        FROM quotations q LEFT JOIN clients c ON q.client_id = c.id WHERE q.id = ?
      `).bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order').bind(params.id).all();
      const itemsHtml = (lineItems || [])
        .map((i: any) => `<tr><td style="padding:8px;border:1px solid #ddd;">${i.name}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">$${i.unit_price}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">$${(i.quantity * i.unit_price).toFixed(2)}</td></tr>`)
        .join('');

      const htmlContent = `
        <!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotation ${quo.id}</title></head>
        <body style="font-family:Arial,sans-serif;padding:20px;color:#333;">
          <h2 style="color:#0f172a;">PRICE QUOTATION - ${quo.id}</h2>
          <p><b>Client:</b> ${quo.client_name || quo.client_id}</p>
          <p><b>Date:</b> ${quo.created_at || new Date().toISOString().split('T')[0]}</p>
          <p><b>Valid Until:</b> ${quo.valid_until || '14 Days'}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:15px;">
            <thead><tr style="background:#f1f5f9;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qty</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Unit Price</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <h3 style="text-align:right;margin-top:15px;">Total: $${quo.total_amount?.toFixed(2)} ${quo.currency}</h3>
        </body></html>`;

      const { uploadFileToGoogleDrive } = await import('../utils/google.js');
      const fileBlob = new Blob([htmlContent], { type: 'text/html' });
      const driveFileId = await uploadFileToGoogleDrive(env, fileBlob, `Quotation_${quo.id}.html`, quo.client_name || 'Unknown', 'Quotations');
      const driveUrl = driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null;

      await db.prepare(`UPDATE quotations SET drive_file_id = ?, drive_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(driveFileId, driveUrl, params.id).run();

      return success({ message: 'Saved to Google Drive!', drive_file_id: driveFileId, drive_url: driveUrl });
    } catch (err: any) {
      console.error('Save to Drive error:', err.message);
      return error(`Failed to save to Drive: ${err.message}`, 500);
    }
  });

  // ── POST /api/quotations/:id/convert-job ───────────────────────────────────
  router.post('/api/quotations/:id/convert-job', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo: any = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').bind(params.id).all();
      const jobId = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const description = `Converted from Quotation ${quo.id}. Items: ${(lineItems || []).map((i: any) => `${i.name} (x${i.quantity})`).join(', ')}`;

      await db.prepare(`INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description) VALUES (?, ?, ?, 'CCTV', 'Pending', ?)`).bind(jobId, quo.client_id, quo.prepared_by, description).run();
      await db.prepare(`UPDATE quotations SET status = 'Converted', converted_job_id = ? WHERE id = ?`).bind(jobId, params.id).run();

      return success({ job_id: jobId, message: 'Converted to Service Job' });
    } catch (err: any) {
      console.error('Convert to job error:', err.message);
      return error('Failed to convert to job', 500);
    }
  });

  // ── POST /api/quotations/:id/convert-invoice ───────────────────────────────
  router.post('/api/quotations/:id/convert-invoice', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo: any = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const invoiceId = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      await db.prepare(`INSERT INTO invoices (id, client_id, items, amount, tax, total, status, created_by) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`).bind(invoiceId, quo.client_id, quo.items, quo.subtotal, quo.tax, quo.total_amount, quo.prepared_by).run();
      await db.prepare(`UPDATE quotations SET status = 'Converted', converted_invoice_id = ? WHERE id = ?`).bind(invoiceId, params.id).run();

      return success({ invoice_id: invoiceId, message: 'Converted to POS Invoice' });
    } catch (err: any) {
      console.error('Convert to invoice error:', err.message);
      return error('Failed to convert to invoice', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PORTAL ENDPOINTS (Token-based, no auth required)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── GET /api/portal/quote/:token ────────────────────────────────────────────
  router.get('/api/portal/quote/:token', async (request, params) => {
    try {
      const quo = await quotationService.getPortalQuotation(params.token);
      if (!quo) return error('Quotation not found or invalid link', 404);
      return success(quo);
    } catch (err: any) {
      console.error('Portal quote error:', err.message);
      return error('Failed to fetch quotation', 500);
    }
  });

  // ── POST /api/portal/quote/:token/approve ──────────────────────────────────
  router.post('/api/portal/quote/:token/approve', async (request, params) => {
    try {
      const body: any = await request.json().catch(() => ({}));
      const result = await quotationService.approveWithSignature(params.token, body.signature);
      if (!result) return error('Quotation not found or invalid link', 404);
      if (result.alreadyFinalized) return error('Quotation already finalized', 400);
      return success({ message: 'Quotation approved successfully!', quotation_id: result.id });
    } catch (err: any) {
      console.error('Portal approve error:', err.message);
      return error('Failed to approve quotation', 500);
    }
  });

  // ── POST /api/portal/quote/:token/reject ───────────────────────────────────
  router.post('/api/portal/quote/:token/reject', async (request, params) => {
    try {
      const body: any = await request.json().catch(() => ({}));
      const result = await quotationService.reject(params.token, body.reason);
      if (!result) return error('Quotation not found or invalid link', 404);
      return success({ message: 'Quotation rejected', quotation_id: result.id });

    } catch (err: any) {
      console.error('Portal reject error:', err.message);
      return error('Failed to reject quotation', 500);
    }
  });

  // ── POST /api/ai/estimate-quotation ────────────────────────────────────────
  router.post('/api/ai/estimate-quotation', async (request) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const surveyId = body.survey_id;
      let survey: any = body.survey;
      if (surveyId && !survey) {
        survey = await db.prepare('SELECT * FROM site_surveys WHERE id = ?').bind(surveyId).first();
      }
      if (!survey) return error('Survey details or survey_id is required', 400);

      const prompt = `
        You are an expert CCTV and networking estimator. Based on the site survey details below, estimate an itemized Bill of Materials (BOM) with quantities and estimated unit prices in USD.
        
        Survey Details:
        - Survey Type: ${survey.survey_type || 'CCTV'}
        - Building Type: ${survey.building_type || 'General'}
        - Camera Count: ${survey.camera_count || 0}
        - Cable Type: ${survey.cable_type || 'Cat6'}
        - Cable Meters Estimate: ${survey.estimated_cable_meters || 0}
        - Power Notes: ${survey.power_source_notes || 'Standard'}
        - Mounting Type: ${survey.mounting_type || 'Indoor'}
        - Additional Notes: ${survey.notes || 'None'}

        Return strictly valid JSON only in this exact format without any markdown backticks:
        {
          "recommended_items": [
            { "name": "Item Name", "qty": 1, "unit_price": 50.00, "category": "hardware" }
          ],
          "estimated_subtotal": 0.00,
          "notes": "Estimation summary rationale"
        }
      `;

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) return error('GEMINI_API_KEY not configured', 500);

      const { fetchGeminiWithFallback } = await import('../utils/gemini.js');
      const payloadBody = { contents: [{ parts: [{ text: prompt }] }] };
      const geminiRes = await fetchGeminiWithFallback(apiKey, payloadBody, 'gemini-1.5-flash');
      const rawText = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      let estimation: any = {};
      try { estimation = JSON.parse(cleanJsonStr); } catch (e) { estimation = { raw_response: rawText, notes: 'Parsing failed' }; }

      return success(estimation);
    } catch (err: any) {
      console.error('AI estimation error:', err.message);
      return error('Failed to generate AI estimation', 500);
    }
  });

  // ── POST /api/enterprise/matrix/commit ─────────────────────────────────────
  router.post('/api/enterprise/matrix/commit', async (request) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const { project_id, cable_spec, camera_nodes, margin_pct, labor_hours, labor_rate, grand_total } = body;
      if (!project_id) return error('project_id is required', 400);

      let needsOverride = false;
      if (Array.isArray(camera_nodes)) {
        for (const node of camera_nodes) {
          if ((cable_spec || '').includes('cat6') && parseFloat(node.cable_length || 0) > 90) {
            needsOverride = true;
            break;
          }
        }
      }

      const quoteId = `QTN-ENT-${Date.now().toString(36).toUpperCase()}`;
      await db.prepare(`INSERT INTO cost_quotations_enterprise (quotation_id, project_id, raw_hardware_cost_basis, applied_margin_multiplier, estimated_labor_hours, blended_labor_rate_hourly, grand_total_value, is_active_version) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`).bind(
        quoteId, project_id, body.raw_hardware_basis || 0,
        1 + ((margin_pct || 35) / 100), labor_hours || 16, labor_rate || 95, grand_total || 0
      ).run();

      return success({
        quotation_id: quoteId, needs_override: needsOverride,
        status: needsOverride ? 'needs_override' : 'approved_signed',
        message: needsOverride ? 'Flagged for manager override (>{90}m Ethernet).' : 'Enterprise quote saved!'
      });
    } catch (err: any) {
      console.error('Enterprise matrix error:', err.message);
      return error('Failed to commit enterprise quotation', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SERVER-SIDE PDF GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── GET /api/quotations/:id/pdf ────────────────────────────────────────────
  router.get('/api/quotations/:id/pdf', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;

      const quo: any = await db.prepare(`
        SELECT q.*, c.company_name as client_name, c.contact_person, c.phone as client_phone, c.email as client_email
        FROM quotations q LEFT JOIN clients c ON q.client_id = c.id WHERE q.id = ?
      `).bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order').bind(params.id).all();

      const siteUrl = env.SITE_URL || 'https://awesomemyanmar.pages.dev';
      const itemsHtml = (lineItems || [])
        .map((i: any) => `
          <tr>
            <td style="padding:8px;border:1px solid #ddd;">${i.name || i.description || ''}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(i.unit_price).toFixed(2)}</td>
            <td style="padding:8px;border:1px solid #ddd;text-align:right;">$${(i.quantity * i.unit_price).toFixed(2)}</td>
          </tr>`).join('');

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotation ${quo.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #333; max-width: 800px; margin: 0 auto; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1e40af; padding-bottom: 15px; margin-bottom: 20px; }
          .company-name { font-size: 22px; font-weight: bold; color: #1e40af; }
          .quote-title { font-size: 16px; color: #666; }
          .meta { margin: 15px 0; }
          .meta p { margin: 4px 0; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #f1f5f9; padding: 8px; border: 1px solid #ddd; text-align: left; font-size: 13px; }
          td { font-size: 13px; }
          .totals { margin-top: 20px; text-align: right; }
          .totals .row { margin: 4px 0; font-size: 14px; }
          .totals .grand { font-size: 20px; font-weight: bold; color: #1e40af; border-top: 2px solid #1e40af; padding-top: 8px; }
          .footer { margin-top: 40px; font-size: 12px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 15px; }
        </style></head><body>
        <div class="header">
          <div>
            <div class="company-name">KOSAI Technical Services</div>
            <div class="quote-title">CCTV & Networking Solutions</div>
          </div>
          <div style="text-align:right;">
            <div class="quote-title">QUOTATION</div>
            <div style="font-size:14px;margin-top:4px;"><b>${quo.id}</b></div>
          </div>
        </div>
        <div class="meta">
          <p><b>Client:</b> ${quo.client_name || quo.client_id || 'N/A'}</p>
          <p><b>Contact:</b> ${quo.contact_person || 'N/A'} ${quo.client_phone ? '| ' + quo.client_phone : ''}</p>
          <p><b>Date:</b> ${quo.created_at || new Date().toISOString().split('T')[0]}</p>
          <p><b>Valid Until:</b> ${quo.valid_until || '14 Days'}</p>
        </div>
        <table>
          <thead><tr>
            <th style="text-align:left;">Item Description</th>
            <th style="text-align:center;">Qty</th>
            <th style="text-align:right;">Unit Price (${quo.currency})</th>
            <th style="text-align:right;">Total (${quo.currency})</th>
          </tr></thead>
          <tbody>${itemsHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;">No items</td></tr>'}</tbody>
        </table>
        <div class="totals">
          <div class="row">Subtotal: <b>$${Number(quo.subtotal || 0).toFixed(2)}</b></div>
          ${Number(quo.discount_amount || 0) > 0 ? `<div class="row">Discount ($${Number(quo.discount_amount).toFixed(2)}): <b>-$${Number(quo.discount_amount).toFixed(2)}</b></div>` : ''}
          ${Number(quo.discount_pct || 0) > 0 ? `<div class="row">Discount (${Number(quo.discount_pct)}%): <b>-$${(Number(quo.subtotal || 0) * Number(quo.discount_pct || 0) / 100).toFixed(2)}</b></div>` : ''}
          ${Number(quo.tax || 0) > 0 ? `<div class="row">Tax: <b>$${Number(quo.tax).toFixed(2)}</b></div>` : ''}
          <div class="grand">GRAND TOTAL: $${Number(quo.total_amount || 0).toFixed(2)} ${quo.currency || 'USD'}</div>
        </div>
        ${quo.notes ? `<div style="margin-top:20px;font-size:13px;"><b>Notes:</b><br>${quo.notes}</div>` : ''}
        <div class="footer">
          Generated by KOSAI Technical Services &bull; ${siteUrl}<br>
          This quotation is valid until ${quo.valid_until || '14 days from issue'}
        </div>
      </body></html>`;

      return new Response(html, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    } catch (err: any) {
      console.error('PDF generation error:', err.message);
      return error('Failed to generate PDF', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // EMAIL DELIVERY
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── POST /api/quotations/:id/send-email ────────────────────────────────────
  router.post('/api/quotations/:id/send-email', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const { email_to, email_cc, custom_message } = body;

      const quo: any = await db.prepare(`
        SELECT q.*, c.company_name as client_name, c.contact_person, c.email as client_email
        FROM quotations q LEFT JOIN clients c ON q.client_id = c.id WHERE q.id = ?
      `).bind(params.id).first();
      if (!quo) return error('Quotation not found', 404);

      const recipientEmail = email_to || quo.client_email;
      if (!recipientEmail) return error('No recipient email provided. Add client email or specify email_to.', 400);

      // Fetch line items
      const { results: lineItems } = await db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order').bind(params.id).all();

      // Build email HTML
      const siteUrl = env.SITE_URL || 'https://awesomemyanmar.pages.dev';
      const portalToken = quo.portal_token || crypto.randomUUID();
      const portalUrl = `${siteUrl}/portal.html?quote=${portalToken}`;
      const itemsHtml = (lineItems || [])
        .map((i: any) => `<tr><td style="padding:8px;border:1px solid #ddd;">${i.name || ''}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;">${i.quantity}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">$${Number(i.unit_price).toFixed(2)}</td><td style="padding:8px;border:1px solid #ddd;text-align:right;">$${(i.quantity * i.unit_price).toFixed(2)}</td></tr>`)
        .join('');

      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#333;">
          <div style="background:#1e40af;color:#fff;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">KOSAI Technical Services</h2>
            <p style="margin:4px 0 0;font-size:14px;opacity:0.9;">CCTV & Networking Solutions</p>
          </div>
          <div style="border:1px solid #e2e8f0;padding:25px;border-radius:0 0 8px 8px;">
            <p>Dear ${quo.contact_person || quo.client_name || 'Valued Customer'},</p>
            ${custom_message ? `<p>${custom_message}</p>` : `<p>Please find below our quotation for your review and approval.</p>`}
            <table style="width:100%;border-collapse:collapse;margin:15px 0;">
              <thead><tr style="background:#f1f5f9;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Item</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:center;">Qty</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Unit Price</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Total</th>
              </tr></thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div style="text-align:right;margin:15px 0;">
              <p>Subtotal: $${Number(quo.subtotal || 0).toFixed(2)}</p>
              ${Number(quo.discount_amount || 0) > 0 ? `<p>Discount: -$${Number(quo.discount_amount).toFixed(2)}</p>` : ''}
              ${Number(quo.tax || 0) > 0 ? `<p>Tax: $${Number(quo.tax).toFixed(2)}</p>` : ''}
              <p style="font-size:18px;font-weight:bold;color:#1e40af;">Total: $${Number(quo.total_amount || 0).toFixed(2)} ${quo.currency}</p>
            </div>
            <div style="text-align:center;margin:25px 0;">
              <a href="${portalUrl}" style="display:inline-block;background:#1e40af;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:bold;">Review & Approve Quotation</a>
            </div>
            <p style="font-size:13px;color:#666;">Quote ID: ${quo.id} | Valid Until: ${quo.valid_until || '14 Days'}</p>
          </div>
        </div>`;

      // Attempt to send via Resend if API key exists
      let emailSent = false;
      let emailError = '';
      if (env.RESEND_API_KEY) {
        try {
          const resendResp = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: env.EMAIL_FROM || 'KOSAI <quotations@awesomemyanmar.com>',
              to: [recipientEmail],
              cc: email_cc ? [email_cc] : undefined,
              subject: `Quotation ${quo.id} - KOSAI Technical Services`,
              html: emailHtml
            })
          });
          emailSent = resendResp.ok;
          if (!emailSent) emailError = await resendResp.text();
        } catch (e: any) { emailError = e.message; }
      } else {
        emailError = 'RESEND_API_KEY not configured — email queued but not sent';
      }

      // Update quotation
      await db.prepare(`
        UPDATE quotations SET status = 'Sent', sent_at = CURRENT_TIMESTAMP, email_sent_to = ?, email_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(recipientEmail, params.id).run();

      // Ensure portal token
      if (!quo.portal_token) {
        await db.prepare('UPDATE quotations SET portal_token = ? WHERE id = ?').bind(portalToken, params.id).run();
      }

      // Also send via Telegram as backup
      try {
        const { sendTelegramNotification } = await import('../utils/telegram.js');
        const itemsList = (lineItems || []).map((i: any) => `• ${i.name} (x${i.quantity}) - $${(i.quantity * i.unit_price).toFixed(2)}`).join('\n');
        await sendTelegramNotification(env,
          `📧 *QUOTATION EMAILED*\n\n` +
          `*To:* ${recipientEmail}\n` +
          `*Quote:* \`${quo.id}\`\n` +
          `*Total:* $${Number(quo.total_amount || 0).toFixed(2)} ${quo.currency}\n` +
          `*Portal:* ${portalUrl}`
        );
      } catch (_) { /* telegram backup is best-effort */ }

      return success({
        message: emailSent ? 'Quotation emailed successfully!' : `Email queued: ${emailError}`,
        email_sent: emailSent,
        recipient: recipientEmail,
        portal_url: portalUrl
      });
    } catch (err: any) {
      console.error('Send email error:', err.message);
      return error('Failed to send email', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // QUOTATION VERSIONING (Revisions)
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── GET /api/quotations/:id/revisions ──────────────────────────────────────
  router.get('/api/quotations/:id/revisions', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const revisions = await quotationService.getRevisions(params.id);
      return success({ revisions });
    } catch (err: any) {
      return error('Failed to load revisions', 500);
    }
  });

  // ── POST /api/quotations/:id/save-revision ─────────────────────────────────
  router.post('/api/quotations/:id/save-revision', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      const result = await quotationService.saveRevision(params.id, user.id, body.change_notes);
      if (!result) return error('Quotation not found', 404);
      return success({ ...result, message: `Revision ${result.revision_number} saved` });
    } catch (err: any) {
      console.error('Save revision error:', err.message);
      return error('Failed to save revision', 500);
    }
  });

  // ── POST /api/quotations/:id/restore-revision ──────────────────────────────
  router.post('/api/quotations/:id/restore-revision', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const body: any = await request.json();
      if (!body.revision_id) return error('revision_id is required', 400);

      const result = await quotationService.restoreRevision(params.id, body.revision_id, user.id);
      if (!result) return error('Revision not found', 404);
      return success({ ...result, message: `Restored from revision ${result.restored_from}` });
    } catch (err: any) {
      console.error('Restore revision error:', err.message);
      return error('Failed to restore revision', 500);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // INVENTORY STOCK DEDUCTION
  // ═══════════════════════════════════════════════════════════════════════════════

  // ── POST /api/quotations/:id/deduct-stock ──────────────────────────────────
  router.post('/api/quotations/:id/deduct-stock', async (request, params) => {
    try {
      const { user, error: authErr } = await requireAdmin(request);
      if (authErr) return authErr;
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const quo = await quotationService.getById(params.id);
      if (!quo) return error('Quotation not found', 404);

      const result = await quotationService.deductStock(params.id);
      if (result.errors?.includes('No inventory-linked items')) {
        return error('No inventory-linked items to deduct', 400);
      }

      return success({
        message: result.deductions.length > 0 ? `Deducted ${result.deductions.length} items from stock` : 'No items deducted',
        deductions: result.deductions,
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (err: any) {
      console.error('Deduct stock error:', err.message);
      return error('Failed to deduct stock', 500);
    }
  });
}
