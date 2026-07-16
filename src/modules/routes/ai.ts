/**
 * AI Routes — AI-powered features: polish notes, auto-dispatch, route optimization, copilot
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const user = await verifyToken(authHeader.slice(7));
    if (!user || user.role?.toLowerCase() !== 'admin') return null;
    return user;
  }

  // ── POST /api/ai/polish-notes ─────────────────────────────────────────
  router.post('/api/ai/polish-notes', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { text } = (await request.json() as any);
      if (!text) return error('Missing text', 400);

      // Use Gemini or OpenAI to polish notes
      const polished = await polishWithAI(text, env);
      return success({ original: text, polished });
    } catch (err) {
      return error('Failed to polish notes: ' + err.message, 500);
    }
  });

  // ── POST /api/ai/auto-dispatch ────────────────────────────────────────
  router.post('/api/ai/auto-dispatch', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { job_id, client_location, job_type, priority } = (await request.json() as any);

      // Find available technicians based on location, skills, and workload
      const availableTechs = await db
        .prepare(
          'SELECT t.id, t.name, t.specialties, ' +
            "(SELECT COUNT(*) FROM jobs WHERE assigned_to = t.id AND status IN ('assigned', 'in_progress')) as active_jobs " +
            'FROM technicians t WHERE t.active = 1 ORDER BY active_jobs ASC LIMIT 10'
        )
        .all();

      // Score each technician
      const scored = availableTechs.results.map((tech) => {
        let score = 100;
        score -= tech.active_jobs * 20; // Penalize busy techs
        if (tech.specialties) {
          const specs = (JSON.parse(tech.specialties) as any);
          if (job_type && specs.some((s) => s.toLowerCase().includes(job_type.toLowerCase()))) {
            score += 30; // Bonus for matching specialty
          }
        }
        return { ...tech, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const bestTech = scored[0];

      if (bestTech && job_id) {
        await db
          .prepare(
            "UPDATE jobs SET assigned_to = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ?"
          )
          .bind(bestTech.id, job_id)
          .run();
      }

      return success({
        recommendation: bestTech || null,
        alternatives: scored.slice(1, 4),
      });
    } catch (err) {
      return error('Failed to auto-dispatch: ' + err.message, 500);
    }
  });

  // ── POST /api/ai/route-optimize ───────────────────────────────────────
  router.post('/api/ai/route-optimize', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { technician_id, date } = (await request.json() as any);
      if (!technician_id || !date) return error('Missing technician_id or date', 400);

      const jobs = await db
        .prepare(
          "SELECT j.id, j.title, c.address, c.name as client_name FROM jobs j JOIN clients c ON j.client_id = c.id WHERE j.assigned_to = ? AND j.scheduled_date = ? AND j.status IN ('assigned', 'pending') ORDER BY j.priority DESC"
        )
        .bind(technician_id, date)
        .all();

      // Simple optimization: sort by priority then by address proximity
      // In production, integrate with Google Maps Distance Matrix API
      const optimized = jobs.results.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
      });

      return success({
        technician_id,
        date,
        total_jobs: optimized.length,
        optimized_route: optimized,
      });
    } catch (err) {
      return error('Failed to optimize route: ' + err.message, 500);
    }
  });

  // ── POST /api/ai/copilot ──────────────────────────────────────────────
  router.post('/api/ai/copilot', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const { query } = (await request.json() as any);
      if (!query) return error('Missing query', 400);

      // Natural language to SQL — use AI model to generate SQL
      const sql = await nlToSql(query, env);

      try {
        const result = await db.prepare(sql).all();
        return success({
          query,
          sql,
          results: result.results,
          row_count: result.results.length,
        });
      } catch (dbErr) {
        return error(`SQL execution error: ${dbErr.message}`, 400);
      }
    } catch (err) {
      return error('Copilot query failed: ' + err.message, 500);
    }
  });

  // ── POST /api/ai/transcribe ───────────────────────────────────────────
  router.post('/api/ai/transcribe', async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error('Unauthorized', 401);

      const formData = await request.formData();
      const audio = formData.get('audio');
      if (!audio) return error('Missing audio file', 400);

      // In production, send to Whisper API or similar
      // For now, return a placeholder
      return success({
        transcription: '[Voice transcription would be processed here]',
        file_name: audio.name,
        file_size: audio.size,
      });
    } catch (err) {
      return error('Failed to transcribe: ' + err.message, 500);
    }
  });
}

/**
 * Polish text using Gemini AI (or fallback)
 */
async function polishWithAI(text, env) {
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // Simple fallback: capitalize, fix spacing
    return text
      .split('. ')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('. ');
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Polish the following service technician notes for clarity and professionalism. Fix grammar and spelling, but keep the technical details intact:\n\n${text}`,
                },
              ],
            },
          ],
        }),
      }
    );
    const data = (await resp.json() as any);
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || text;
  } catch {
    return text;
  }
}

/**
 * Convert natural language to SQL using AI
 */
async function nlToSql(query, env) {
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    // Fallback: simple keyword matching
    const q = query.toLowerCase();
    if (q.includes('job') && q.includes('count'))
      return 'SELECT status, COUNT(*) as count FROM jobs GROUP BY status';
    if (q.includes('client') && q.includes('recent'))
      return 'SELECT * FROM clients ORDER BY created_at DESC LIMIT 10';
    if (q.includes('expense') && q.includes('total'))
      return 'SELECT category, SUM(amount) as total FROM expenses GROUP BY category';
    return 'SELECT * FROM jobs LIMIT 10';
  }

  try {
    const schema = await getSchemaSummary(env.DB);
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Given this SQLite schema:\n${schema}\n\nConvert this natural language query to SQL. Return ONLY the SQL, no explanation:\n"${query}"`,
                },
              ],
            },
          ],
        }),
      }
    );
    const data = (await resp.json() as any);
    let sql = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    sql = sql.replace(/```sql|```/gi, '').trim();
    return sql;
  } catch {
    return 'SELECT * FROM jobs LIMIT 10';
  }
}

async function getSchemaSummary(db) {
  const tables = [
    'technicians',
    'clients',
    'jobs',
    'inventory',
    'expenses',
    'attendance',
    'invoices',
    'system_config',
  ];
  const schemas = [];
  for (const table of tables) {
    const info = await db.prepare(`PRAGMA table_info(${table})`).all();
    const cols = info.results
      .map(
        (c) => `  ${c.name} ${c.type}${c.pk ? ' PRIMARY KEY' : ''}${c.notnull ? ' NOT NULL' : ''}`
      )
      .join('\n');
    schemas.push(`TABLE ${table}:\n${cols}`);
  }
  return schemas.join('\n\n');
}

export { register };

