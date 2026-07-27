/**
 * Site Surveys & Quotations Route Modules
 */
import { Router } from '../utils/router.js';
import { success, error } from '../utils/response.js';
import { authenticate } from '../utils/auth-middleware.js';

export function register(router: Router, env: any) {
  const db = env.DB;

  // ── GET /api/surveys ──────────────────────────────────────────────────────
  router.get('/api/surveys', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const clientId = url.searchParams.get('client_id');

      let query = `
        SELECT s.*, c.company_name as client_name, t.name as technician_name
        FROM site_surveys s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN technicians t ON s.technician_id = t.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        query += ` AND s.status = ?`;
        params.push(status);
      }
      if (clientId) {
        query += ` AND s.client_id = ?`;
        params.push(clientId);
      }

      query += ` ORDER BY s.created_at DESC`;
      const stmt = db.prepare(query);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return success(results || []);
    } catch (err: any) {
      console.error('List surveys error:', err.message);
      return error('Failed to fetch site surveys', 500);
    }
  });

  // ── POST /api/surveys ─────────────────────────────────────────────────────
  router.post('/api/surveys', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body: any = await request.json();
      if (!body.client_id) return error('client_id is required', 400);

      // Check if client_id exists in clients table, or resolve by company_name / create fallback
      let client = await db.prepare('SELECT id FROM clients WHERE id = ? OR company_name = ?').bind(body.client_id, body.client_id).first();
      let resolvedClientId = client?.id;

      if (!resolvedClientId) {
        // Auto-create client entry if non-existent ID or company name was entered
        resolvedClientId = `CLI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await db
          .prepare("INSERT INTO clients (id, company_name, address, amc_status) VALUES (?, ?, 'Site Survey Client', 'Individual')")
          .bind(resolvedClientId, body.client_id)
          .run();
      }

      const id = `SURV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const technicianId = body.technician_id || user.id;

      await db
        .prepare(
          `INSERT INTO site_surveys (
            id, client_id, technician_id, survey_type, status, building_type,
            camera_count, cable_type, estimated_cable_meters,
            power_source_notes, mounting_type, site_photos, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          resolvedClientId,
          technicianId,
          body.survey_type || 'CCTV',
          body.status || 'Draft',
          body.building_type || null,
          body.camera_count || 0,
          body.cable_type || null,
          body.estimated_cable_meters || 0,
          body.power_source_notes || null,
          body.mounting_type || null,
          JSON.stringify(body.site_photos || []),
          body.notes || null
        )
        .run();

      return success({ id, message: 'Site survey created successfully' }, 201);
    } catch (err: any) {
      console.error('Create survey error:', err.message || err);
      return error(`Failed to create site survey: ${err.message || 'Database error'}`, 500);
    }
  });

  // ── GET /api/quotations ───────────────────────────────────────────────────
  router.get('/api/quotations', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const url = new URL(request.url);
      const status = url.searchParams.get('status');

      let query = `
        SELECT q.*, c.company_name as client_name, t.name as prepared_by_name
        FROM quotations q
        LEFT JOIN clients c ON q.client_id = c.id
        LEFT JOIN technicians t ON q.prepared_by = t.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        query += ` AND q.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY q.created_at DESC`;
      const stmt = db.prepare(query);
      const { results } = params.length > 0 ? await stmt.bind(...params).all() : await stmt.all();

      return success(results || []);
    } catch (err: any) {
      console.error('List quotations error:', err.message);
      return error('Failed to fetch quotations', 500);
    }
  });

  // ── POST /api/quotations ──────────────────────────────────────────────────
  router.post('/api/quotations', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const body: any = await request.json();
      if (!body.client_id) return error('client_id is required', 400);

      // Check if client_id exists in clients table, or resolve by company_name / create fallback
      let client = await db.prepare('SELECT id FROM clients WHERE id = ? OR company_name = ?').bind(body.client_id, body.client_id).first();
      let resolvedClientId = client?.id;

      if (!resolvedClientId) {
        resolvedClientId = `CLI-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
        await db
          .prepare("INSERT INTO clients (id, company_name, address, amc_status) VALUES (?, ?, 'Quotation Client', 'Individual')")
          .bind(resolvedClientId, body.client_id)
          .run();
      }

      const id = `QUO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const preparedBy = body.prepared_by || user.id;
      const itemsJson = JSON.stringify(body.items || []);
      const validDays = body.valid_days || 14;

      // Calculate valid_until date
      const validUntilDate = new Date();
      validUntilDate.setDate(validUntilDate.getDate() + validDays);
      const validUntil = body.valid_until || validUntilDate.toISOString().split('T')[0];

      await db
        .prepare(
          `INSERT INTO quotations (
            id, survey_id, client_id, prepared_by, valid_days, valid_until, status, items,
            subtotal, discount, tax, total_amount, currency, exchange_rate, terms_conditions
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          body.survey_id || null,
          resolvedClientId,
          preparedBy,
          validDays,
          validUntil,
          body.status || 'Draft',
          itemsJson,
          body.subtotal || 0,
          body.discount || 0,
          body.tax || 0,
          body.total_amount || 0,
          body.currency || 'USD',
          body.exchange_rate || 1.0,
          body.terms_conditions || null
        )
        .run();

      return success({ id, message: 'Quotation created successfully' }, 201);
    } catch (err: any) {
      console.error('Create quotation error:', err.message);
      return error('Failed to create quotation', 500);
    }
  });

  // ── POST /api/quotations/:id/convert-job ─────────────────────────────────
  router.post('/api/quotations/:id/convert-job', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const quotationId = params.id;
      const quo = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
      if (!quo) return error('Quotation not found', 404);

      const jobId = `JOB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const items = JSON.parse(quo.items || '[]');
      const description = `Converted from Quotation ${quo.id}. Items: ${items.map((i: any) => `${i.name} (x${i.qty})`).join(', ')}`;

      await db
        .prepare(
          `INSERT INTO service_records (id, client_id, technician_id, service_type, status, job_description)
           VALUES (?, ?, ?, 'CCTV', 'Pending', ?)`
        )
        .bind(jobId, quo.client_id, quo.prepared_by, description)
        .run();

      await db
        .prepare(`UPDATE quotations SET status = 'Converted', converted_job_id = ? WHERE id = ?`)
        .bind(jobId, quotationId)
        .run();

      return success({ job_id: jobId, message: 'Quotation successfully converted to Service Job' });
    } catch (err: any) {
      console.error('Convert to job error:', err.message);
      return error('Failed to convert quotation to job', 500);
    }
  });

  // ── POST /api/quotations/:id/convert-invoice ─────────────────────────────
  router.post('/api/quotations/:id/convert-invoice', async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const quotationId = params.id;
      const quo = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
      if (!quo) return error('Quotation not found', 404);

      const invoiceId = `INV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

      await db
        .prepare(
          `INSERT INTO invoices (id, client_id, items, amount, tax, total, status, created_by)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`
        )
        .bind(
          invoiceId,
          quo.client_id,
          quo.items,
          quo.subtotal,
          quo.tax,
          quo.total_amount,
          quo.prepared_by
        )
        .run();

      await db
        .prepare(`UPDATE quotations SET status = 'Converted', converted_invoice_id = ? WHERE id = ?`)
        .bind(invoiceId, quotationId)
        .run();

      return success({ invoice_id: invoiceId, message: 'Quotation successfully converted to POS Invoice' });
    } catch (err: any) {
      console.error('Convert to invoice error:', err.message);
      return error('Failed to convert quotation to invoice', 500);
    }
  });

  // ── POST /api/ai/estimate-quotation ──────────────────────────────────────
  router.post('/api/ai/estimate-quotation', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

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
            { "name": "Item Name", "qty": 1, "unit_price": 50.00, "category": "Hardware" }
          ],
          "estimated_subtotal": 0.00,
          "notes": "Estimation summary rationale"
        }
      `;

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) return error('GEMINI_API_KEY not configured', 500);

      const { fetchGeminiWithFallback } = await import('../utils/gemini.js');
      const payloadBody = {
        contents: [{ parts: [{ text: prompt }] }],
      };

      const geminiRes = await fetchGeminiWithFallback(apiKey, payloadBody, 'gemini-1.5-flash');
      const rawText = geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleanJsonStr = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      let estimation: any = {};
      try {
        estimation = JSON.parse(cleanJsonStr);
      } catch (e) {
        estimation = { raw_response: rawText, notes: 'Parsing failed, raw response attached' };
      }

      return success(estimation);
    } catch (err: any) {
      console.error('AI quotation estimation error:', err.message);
      return error('Failed to generate AI quotation estimation', 500);
    }
  });

  // ── GET /api/portal/quotation/:id ─────────────────────────────────────────
  router.get('/api/portal/quotation/:id', async (request, params) => {
    try {
      const quotationId = params.id;
      const quo = await db
        .prepare(
          `SELECT q.*, c.company_name as client_name, c.contact_person, c.phone as client_phone
           FROM quotations q
           LEFT JOIN clients c ON q.client_id = c.id
           WHERE q.id = ?`
        )
        .bind(quotationId)
        .first();

      if (!quo) return error('Quotation not found', 404);

      return success({
        id: quo.id,
        client_name: quo.client_name,
        contact_person: quo.contact_person,
        quotation_date: quo.quotation_date,
        valid_until: quo.valid_until,
        status: quo.status,
        currency: quo.currency,
        exchange_rate: quo.exchange_rate,
        items: JSON.parse(quo.items || '[]'),
        subtotal: quo.subtotal,
        discount: quo.discount,
        tax: quo.tax,
        total_amount: quo.total_amount,
        terms_conditions: quo.terms_conditions,
      });
    } catch (err: any) {
      console.error('Fetch portal quotation error:', err.message);
      return error('Failed to fetch quotation details', 500);
    }
  });

  // ── POST /api/portal/quotation/:id/approve ────────────────────────────────
  router.post('/api/portal/quotation/:id/approve', async (request, params) => {
    try {
      const quotationId = params.id;
      const body: any = await request.json().catch(() => ({}));
      const clientSignature = body.signature || null;

      const quo = await db.prepare('SELECT * FROM quotations WHERE id = ?').bind(quotationId).first();
      if (!quo) return error('Quotation not found', 404);

      await db
        .prepare(`UPDATE quotations SET status = 'Approved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(quotationId)
        .run();

      return success({ message: 'Quotation approved successfully by client!', quotation_id: quotationId });
    } catch (err: any) {
      console.error('Approve quotation error:', err.message);
      return error('Failed to approve quotation', 500);
    }
  });
}
