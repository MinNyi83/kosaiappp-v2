/**
 * AI Routes — AI-powered features: polish notes, auto-dispatch, route optimization, copilot
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';
import { fetchGeminiWithFallback } from '../utils/gemini.js';
import { validateSql, ALLOWED_TABLES } from '../utils/sql-validator.js';

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxRequests = 20, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

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

      if (!checkRateLimit(`polish:${user.id}`, 15)) {
        return error('Rate limit exceeded. Try again in a minute.', 429);
      }

      const { text } = (await request.json()) as any;
      if (!text) return error('Missing text', 400);

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

      if (!checkRateLimit(`dispatch:${user.id}`, 10)) {
        return error('Rate limit exceeded. Try again in a minute.', 429);
      }

      const { job_id, client_location, job_type, priority } = (await request.json()) as any;

      // Find available technicians based on location, skills, and workload
      const availableTechs = await db
        .prepare(
          'SELECT t.id, t.name, t.specialties, ' +
            "(SELECT COUNT(*) FROM service_records WHERE technician_id = t.id AND status IN ('Pending', 'In Progress')) as active_jobs " +
            'FROM technicians t WHERE t.active = 1 ORDER BY active_jobs ASC LIMIT 10'
        )
        .all();

      // Score each technician
      const scored = availableTechs.results.map((tech) => {
        let score = 100;
        score -= tech.active_jobs * 20; // Penalize busy techs
        if (tech.specialties) {
          const specs = JSON.parse(tech.specialties) as any;
          if (
            job_type &&
            specs.some((s: string) => s.toLowerCase().includes(job_type.toLowerCase()))
          ) {
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
            "UPDATE service_records SET technician_id = ?, status = 'In Progress', updated_at = datetime('now') WHERE id = ?"
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

      const { technician_id, date } = (await request.json()) as any;
      if (!technician_id || !date) return error('Missing technician_id or date', 400);

      const jobs = await db
        .prepare(
          "SELECT sr.id, sr.service_type, sr.status, c.company_name, c.address FROM service_records sr LEFT JOIN clients c ON sr.client_id = c.id WHERE sr.technician_id = ? AND sr.status IN ('Pending', 'In Progress') ORDER BY sr.created_at ASC"
        )
        .bind(technician_id)
        .all();

      return success({
        technician_id,
        date,
        total_jobs: jobs.results.length,
        optimized_route: jobs.results,
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

      if (!checkRateLimit(`copilot:${user.id}`, 10)) {
        return error('Rate limit exceeded. Try again in a minute.', 429);
      }

      const { query } = (await request.json()) as any;
      if (!query) return error('Missing query', 400);

      // Natural language to SQL — use AI model to generate SQL
      const sql = await nlToSql(query, env);

      // Security: validate the generated SQL before execution
      const validationError = validateSql(sql);
      if (validationError) {
        return error(`Query rejected: ${validationError}`, 400);
      }

      try {
        const result = await db.prepare(sql).all();
        return success({
          query,
          sql,
          results: result.results.slice(0, 50), // Limit results
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

      if (!checkRateLimit(`transcribe:${user.id}`, 5)) {
        return error('Rate limit exceeded. Try again in a minute.', 429);
      }

      const formData = await request.formData();
      const audio = formData.get('audio') as File | null;
      if (!audio) return error('Missing audio file', 400);

      const GEMINI_API_KEY = env.GEMINI_API_KEY;
      if (!GEMINI_API_KEY) {
        return error('Transcription service not configured', 503);
      }

      // Convert audio to base64 for Gemini
      const arrayBuffer = await audio.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const result = await fetchGeminiWithFallback(GEMINI_API_KEY, {
        contents: [
          {
            parts: [
              { inline_data: { mime_type: audio.type || 'audio/ogg', data: base64 } },
              {
                text: 'Transcribe this audio accurately. Return only the transcribed text, no commentary.',
              },
            ],
          },
        ],
      });

      const transcription = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      if (!transcription) {
        return error('Could not transcribe audio', 422);
      }

      return success({ transcription, file_name: audio.name, file_size: audio.size });
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
    const data = await fetchGeminiWithFallback(GEMINI_API_KEY, {
      contents: [
        {
          parts: [
            {
              text: `Polish the following service technician notes for clarity and professionalism. Fix grammar and spelling, but keep the technical details intact:\n\n${text}`,
            },
          ],
        },
      ],
    });
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
      return 'SELECT status, COUNT(*) as count FROM service_records GROUP BY status';
    if (q.includes('client') && q.includes('recent'))
      return 'SELECT * FROM clients ORDER BY created_at DESC LIMIT 10';
    if (q.includes('expense') && q.includes('total'))
      return 'SELECT category, SUM(amount) as total FROM expenses GROUP BY category';
    return 'SELECT * FROM service_records LIMIT 10';
  }

  try {
    const schema = await getSchemaSummary(env.DB);
    const data = await fetchGeminiWithFallback(GEMINI_API_KEY, {
      contents: [
        {
          parts: [
            {
              text: `Given this SQLite schema:\n${schema}\n\nConvert this natural language query to SQL. Return ONLY the SQL, no explanation. Only use SELECT statements on these tables: ${ALLOWED_TABLES.join(', ')}:\n"${query}"`,
            },
          ],
        },
      ],
    });
    let sql = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    sql = sql.replace(/```sql|```/gi, '').trim();
    return sql;
  } catch {
    return 'SELECT * FROM service_records LIMIT 10';
  }
}

async function getSchemaSummary(db) {
  const schemas = [];
  for (const table of ALLOWED_TABLES) {
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
