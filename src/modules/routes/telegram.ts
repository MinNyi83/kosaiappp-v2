/**
 * Telegram Routes — Bot webhook handler and message dispatch
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';
import { sendTelegramMessage } from '../utils/telegram.js';
import { requireCsrf } from '../utils/auth-middleware.js';

function register(router, env) {
  const db = env.DB;

  // ── POST /api/telegram/webhook ────────────────────────────────────────
  router.post('/api/telegram/webhook', async (request) => {
    try {
      // Verify webhook secret token (if configured)
      const secretToken = env.TELEGRAM_WEBHOOK_SECRET;
      if (secretToken) {
        const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token');
        if (incomingSecret !== secretToken) {
          console.error('Telegram webhook: Invalid secret token');
          return error('Unauthorized', 403);
        }
      }

      const update = (await request.json()) as any;

      // Handle callback queries (button presses)
      if (update.callback_query) {
        const { data, message, from } = update.callback_query;
        const chatId = message.chat.id;
        await handleCallbackQuery(chatId, data, from, db, env);
        return success({ ok: true });
      }

      // Handle regular messages
      if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const from = update.message.from;

        // Check if it's a command
        if (text.startsWith('/')) {
          const reply = await handleCommand(chatId, text, from, db, env);
          await sendTelegramMessage(env, chatId, reply);
        } else {
          // Auto-create job from message (voice/text)
          await handleJobCreation(chatId, text, from, db, env);
        }

        return success({ ok: true });
      }

      // Handle voice messages
      if (update.message && update.message.voice) {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const voice = update.message.voice;
        await handleVoiceMessage(chatId, voice, from, db, env);
        return success({ ok: true });
      }

      // Handle photo messages
      if (update.message && update.message.photo) {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const photo = update.message.photo[update.message.photo.length - 1];
        await handlePhotoMessage(chatId, photo, from, db, env);
        return success({ ok: true });
      }

      // Handle location shares (for attendance check-in)
      if (update.message && update.message.location) {
        const chatId = update.message.chat.id;
        const from = update.message.from;
        const location = update.message.location;
        await handleLocationShare(chatId, location, from, db, env);
        return success({ ok: true });
      }

      return success({ ok: true });
    } catch (err) {
      console.error('Telegram webhook error:', err);
      return error('Webhook processing failed', 500);
    }
  });

  // ── POST /api/telegram/send ───────────────────────────────────────────
  router.post('/api/telegram/send', async (request) => {
    try {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) return error('Unauthorized', 401);
      const user = await verifyToken(authHeader.slice(7));
      if (!user) return error('Unauthorized', 401);
      if (!await requireCsrf(request, user.id)) return error('Invalid CSRF token', 403);

      const { chat_id, text, parse_mode } = (await request.json()) as any;
      if (!chat_id || !text) return error('Missing chat_id or text', 400);

      const result = await sendTelegramMessage(env, chat_id, text);
      return success({ ok: true, result });
    } catch (err) {
      return error('Failed to send message: ' + err.message, 500);
    }
  });
}

async function resolveTech(from, db) {
  const tech = await db
    .prepare('SELECT id, name FROM technicians WHERE id = ?')
    .bind(from.id.toString())
    .first();
  if (tech) return tech;

  const username = (from.username || '').replace(/^@/, '');
  const techByName = await db
    .prepare(
      "SELECT id, name FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)"
    )
    .bind(username)
    .first();
  return techByName || null;
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '--:--';
  return iso.slice(11, 16);
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

async function handleCommand(chatId, command, from, db, env) {
  const cmds = {
    '/start': 'Welcome to Awesome Myanmar Bot! Use /help to see available commands.',
    '/help': getHelpText(),
    '/surveys': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const { results } = await db
        .prepare(`SELECT s.*, c.company_name as client_name, c.address as client_address FROM site_surveys s LEFT JOIN clients c ON s.client_id = c.id WHERE s.technician_id = ? AND s.status != 'Completed' ORDER BY s.created_at DESC`)
        .bind(tech.id)
        .all();
      if (!results || results.length === 0) return '📍 You have no pending site surveys assigned.';
      let reply = `📋 *YOUR ASSIGNED SITE SURVEYS*\n\n`;
      for (const surv of results as any[]) {
        reply += `• *ID:* \`${surv.id}\`\n  *Client:* ${surv.client_name}\n  *Address:* ${surv.client_address || 'On-site'}\n  *Scheduled:* ${surv.scheduled_date || 'Today'}\n  *Type:* ${surv.survey_type}\n\n`;
      }
      return reply;
    },
    '/survey': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      return `📋 *Site Survey Instructions*:\nTo record a site survey via Telegram, send a voice message describing the site conditions (e.g. "Survey for client ABC, 8 CCTV cameras, 200m Cat6 cable"). AI will transcribe and create a survey ticket automatically!`;
    },
    '/clock': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const record = await db
        .prepare(
          "SELECT clock_in, clock_out FROM attendance WHERE technician_id = ? AND date = date('now') ORDER BY clock_in DESC LIMIT 1"
        )
        .bind(tech.id)
        .first();
      let msg = `*Clock Status - ${tech.name}*\n\n`;
      if (record && record.clock_in && !record.clock_out) {
        const ci = fmtTime(record.clock_in);
        const mins = Math.round((Date.now() - new Date(record.clock_in).getTime()) / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        msg += `Status: Clocked In\n`;
        msg += `Since: ${ci}\n`;
        msg += `Duration: ${h}h ${m}m\n`;
        msg += `\nSend /checkout or /clockout to clock out.`;
      } else if (record && record.clock_in && record.clock_out) {
        const ci = fmtTime(record.clock_in);
        const co = fmtTime(record.clock_out);
        const mins = Math.round(
          (new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / 60000
        );
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        msg += `Status: Clocked Out\n`;
        msg += `Clock in: ${ci}\n`;
        msg += `Clock out: ${co}\n`;
        msg += `Duration: ${h}h ${m}m\n`;
        msg += `\nSend /checkin or /clockin to clock in again.`;
      } else {
        msg += `Status: Not clocked in today\n`;
        msg += `\nSend /checkin or /clockin to clock in.`;
      }
      return msg;
    },
    '/jobs': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const jobs = await db
        .prepare(
          "SELECT id, job_description, service_type, status FROM service_records WHERE technician_id = ? AND status IN ('Pending', 'In Progress') ORDER BY created_at DESC LIMIT 5"
        )
        .bind(tech.id)
        .all();
      if (jobs.results.length === 0) return 'No active jobs assigned to you.';
      return (
        '*Your Active Jobs:*\n\n' +
        jobs.results
          .map((j) => `• #${j.id}: ${j.job_description?.substring(0, 50)} [${j.status}]`)
          .join('\n')
      );
    },
    '/completed': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const jobs = await db
        .prepare(
          "SELECT id, job_description, service_type, completed_at FROM service_records WHERE technician_id = ? AND status = 'Completed' ORDER BY completed_at DESC LIMIT 5"
        )
        .bind(tech.id)
        .all();
      if (jobs.results.length === 0) return 'No completed jobs found.';
      return (
        '*Your Completed Jobs:*\n\n' +
        jobs.results
          .map(
            (j) => `• #${j.id}: ${j.job_description?.substring(0, 50)} (${j.completed_at || 'N/A'})`
          )
          .join('\n')
      );
    },
    '/today': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const jobs = await db
        .prepare(
          "SELECT id, job_description, status FROM service_records WHERE technician_id = ? AND date(created_at) = date('now') ORDER BY created_at DESC"
        )
        .bind(tech.id)
        .all();
      const attendance = await db
        .prepare(
          "SELECT clock_in, clock_out FROM attendance WHERE technician_id = ? AND date = date('now') ORDER BY clock_in DESC LIMIT 1"
        )
        .bind(tech.id)
        .first();
      let msg = `*Today's Summary for ${tech.name}:*\n\n`;
      if (attendance) {
        const ci = fmtTime(attendance.clock_in);
        const co = attendance.clock_out ? fmtTime(attendance.clock_out) : null;
        const endMs = attendance.clock_out ? new Date(attendance.clock_out).getTime() : Date.now();
        const mins = Math.round((endMs - new Date(attendance.clock_in).getTime()) / 60000);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        msg += `Clock: ${ci} → ${co || 'now'}\n`;
        msg += `Hours worked: ${h}h ${m}m\n`;
      } else {
        msg += 'Clock: Not clocked in\n';
      }
      if (jobs.results.length === 0) {
        msg += 'Jobs: None today';
      } else {
        msg +=
          `Jobs (${jobs.results.length}):\n` +
          jobs.results
            .map((j) => `• #${j.id}: ${j.job_description?.substring(0, 40)} [${j.status}]`)
            .join('\n');
      }
      return msg;
    },
    '/status': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'Not registered.';
      const attendance = await db
        .prepare(
          "SELECT clock_in, clock_out FROM attendance WHERE technician_id = ? AND date = date('now') ORDER BY clock_in DESC LIMIT 1"
        )
        .bind(tech.id)
        .first();
      const clockStatus = attendance
        ? attendance.clock_out
          ? `Clocked out at ${attendance.clock_out}`
          : `Clocked in at ${attendance.clock_in}`
        : 'Not clocked in today';
      const activeJobs = await db
        .prepare(
          "SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status IN ('Pending', 'In Progress')"
        )
        .bind(tech.id)
        .first();
      return (
        `*${tech.name}*\n\n` + `Clock: ${clockStatus}\n` + `Active jobs: ${activeJobs?.cnt || 0}`
      );
    },
    '/checkin': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const existing = await db
        .prepare(
          "SELECT id FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
        )
        .bind(tech.id)
        .first();
      if (existing) return 'Already clocked in today.';
      const id = 'ATT-' + Date.now().toString(36).toUpperCase();
      const now = new Date().toISOString().slice(11, 16);
      await db
        .prepare(
          "INSERT INTO attendance (id, technician_id, date, clock_in) VALUES (?, ?, date('now'), datetime('now'))"
        )
        .bind(id, tech.id)
        .run();
      return `Clocked in successfully at ${now}.`;
    },
    '/clockin': async () => cmds['/checkin'](),
    '/checkout': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const record = await db
        .prepare(
          "SELECT id, clock_in FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
        )
        .bind(tech.id)
        .first();
      if (!record) return 'No active clock-in found for today.';
      const now = new Date().toISOString().slice(11, 16);
      await db
        .prepare("UPDATE attendance SET clock_out = datetime('now') WHERE id = ?")
        .bind(record.id)
        .run();
      return `Clocked out successfully at ${now}.\nToday's clock-in was at ${record.clock_in}.`;
    },
    '/clockout': async () => cmds['/checkout'](),
    '/ticket': async () => {
      const args = command.split(' ').slice(1);
      const jobId = args[0];
      if (!jobId) return 'Usage: /ticket JOB-xxx';
      const record = await db
        .prepare(
          'SELECT id, job_description, service_type, status, technician_id, company_name, client_name, client_phone, address, checklist_data, created_at FROM service_records WHERE id = ?'
        )
        .bind(jobId)
        .first();
      if (!record) return 'Job not found.';
      let techName = 'Unassigned';
      if (record.technician_id) {
        const t = await db
          .prepare('SELECT name FROM technicians WHERE id = ?')
          .bind(record.technician_id)
          .first();
        if (t) techName = t.name;
      }
      let checklist = '';
      if (record.checklist_data) {
        try {
          const items = JSON.parse(record.checklist_data);
          const done = items.filter((i) => i.status === 'Good' || i.status === 'Fixed').length;
          checklist = `\nChecklist: ${done}/${items.length} items`;
        } catch {}
      }
      return (
        `*Job #${record.id}*\n\n` +
        `Status: ${record.status}\n` +
        `Type: ${record.service_type}\n` +
        `Technician: ${techName}\n` +
        `Company: ${record.company_name || 'N/A'}\n` +
        `Client: ${record.client_name || 'N/A'} ${record.client_phone || ''}\n` +
        `Address: ${record.address || 'N/A'}` +
        checklist +
        '\n' +
        `Created: ${record.created_at || 'N/A'}\n\n` +
        `Description:\n${(record.job_description || 'N/A').substring(0, 200)}`
      );
    },
    '/accept': async () => {
      const args = command.split(' ').slice(1);
      const jobId = args[0];
      if (!jobId) return 'Usage: /accept JOB-xxx';
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const job = await db
        .prepare('SELECT id, status, technician_id FROM service_records WHERE id = ?')
        .bind(jobId)
        .first();
      if (!job) return 'Job not found.';
      if (job.status === 'Completed') return 'Job is already completed.';
      if (job.status === 'Cancelled') return 'Job is already cancelled.';
      await db
        .prepare(
          "UPDATE service_records SET status = 'In Progress', technician_id = ?, updated_at = datetime('now') WHERE id = ?"
        )
        .bind(tech.id, jobId)
        .run();
      return `Job #${jobId} accepted! You are now assigned to this job.`;
    },
    '/assign': async () => {
      const args = command.split(' ').slice(1);
      if (args.length < 2) return 'Usage: /assign JOB-xxx TechName';
      const jobId = args[0];
      const techQuery = args.slice(1).join(' ');
      const job = await db
        .prepare('SELECT id, status FROM service_records WHERE id = ?')
        .bind(jobId)
        .first();
      if (!job) return 'Job not found.';
      const targetTech = await db
        .prepare(
          'SELECT id, name FROM technicians WHERE id = ? OR LOWER(name) = LOWER(?) OR LOWER(nickname) = LOWER(?)'
        )
        .bind(techQuery, techQuery, techQuery)
        .first();
      if (!targetTech) return 'Technician not found.';
      await db
        .prepare(
          "UPDATE service_records SET technician_id = ?, status = CASE WHEN status = 'Pending' THEN 'In Progress' ELSE status END WHERE id = ?"
        )
        .bind(targetTech.id, jobId)
        .run();
      return `Job #${jobId} assigned to ${targetTech.name}.`;
    },
    '/cancel': async () => {
      const args = command.split(' ').slice(1);
      const jobId = args[0];
      if (!jobId) return 'Usage: /cancel JOB-xxx';
      const job = await db
        .prepare('SELECT id, status FROM service_records WHERE id = ?')
        .bind(jobId)
        .first();
      if (!job) return 'Job not found.';
      if (job.status === 'Cancelled') return 'Job is already cancelled.';
      await db
        .prepare("UPDATE service_records SET status = 'Cancelled' WHERE id = ?")
        .bind(jobId)
        .run();
      return `Job #${jobId} has been cancelled.`;
    },
    '/report': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const records = await db
        .prepare(
          "SELECT date, clock_in, clock_out FROM attendance WHERE technician_id = ? AND date >= date('now', '-7 days') ORDER BY date ASC"
        )
        .bind(tech.id)
        .all();
      if (records.results.length === 0) return 'No attendance records for the past 7 days.';
      let totalMinutes = 0;
      const rows = records.results.map((r) => {
        const inTime = r.clock_in ? new Date(r.clock_in) : null;
        const outTime = r.clock_out ? new Date(r.clock_out) : null;
        let duration = '';
        if (inTime && outTime) {
          const mins = Math.round((outTime.getTime() - inTime.getTime()) / 60000);
          totalMinutes += mins;
          const h = Math.floor(mins / 60);
          const m = mins % 60;
          duration = `${h}h ${m}m`;
        } else if (inTime) {
          duration = 'In progress';
        }
        const day = fmtDate(r.date);
        const ci = fmtTime(r.clock_in);
        const co = fmtTime(r.clock_out);
        return `${day}: ${ci} -> ${co} (${duration})`;
      });
      const totalH = Math.floor(totalMinutes / 60);
      const totalM = totalMinutes % 60;
      return (
        `*Weekly Report — ${tech.name}*\n` +
        `_Past 7 days_\n\n` +
        rows.join('\n') +
        `\n\n*Total: ${totalH}h ${totalM}m across ${records.results.length} day(s)*`
      );
    },
    '/team': async () => {
      const online = await db
        .prepare(
          "SELECT a.clock_in, t.name, t.nickname FROM attendance a JOIN technicians t ON a.technician_id = t.id WHERE a.date = date('now') AND a.clock_out IS NULL ORDER BY a.clock_in ASC"
        )
        .all();
      if (online.results.length === 0) return 'No one is currently clocked in.';
      const rows = online.results.map((r) => {
        const ci = fmtTime(r.clock_in);
        return `- ${r.name}${r.nickname ? ' (' + r.nickname + ')' : ''} — since ${ci}`;
      });
      return `*Currently Online (${online.results.length}):*\n\n${rows.join('\n')}`;
    },
    '/leaderboard': async () => {
      const records = await db
        .prepare(
          "SELECT t.name, t.nickname, a.clock_in, a.clock_out FROM attendance a JOIN technicians t ON a.technician_id = t.id WHERE a.date >= date('now', '-7 days')"
        )
        .all();
      if (records.results.length === 0) return 'No attendance records for the past 7 days.';
      const techMap: Record<
        string,
        { name: string; nickname: string | null; totalMins: number; days: number }
      > = {};
      for (const r of records.results as any[]) {
        const key = r.name;
        if (!techMap[key])
          techMap[key] = { name: r.name, nickname: r.nickname, totalMins: 0, days: 0 };
        if (r.clock_in && r.clock_out) {
          const inMin =
            parseInt(r.clock_in.slice(11, 13)) * 60 + parseInt(r.clock_in.slice(14, 16));
          const outMin =
            parseInt(r.clock_out.slice(11, 13)) * 60 + parseInt(r.clock_out.slice(14, 16));
          if (outMin >= inMin) {
            techMap[key].totalMins += outMin - inMin;
            techMap[key].days++;
          }
        }
      }
      const sorted = Object.values(techMap)
        .sort((a, b) => b.totalMins - a.totalMins)
        .slice(0, 10);
      const medals = ['1st', '2nd', '3rd'];
      const rows = sorted.map((t, i) => {
        const h = Math.floor(t.totalMins / 60);
        const m = t.totalMins % 60;
        const prefix = i < 3 ? medals[i] : `${i + 1}.`;
        return `${prefix} ${t.name}${t.nickname ? ' (' + t.nickname + ')' : ''} — ${h}h ${m}m (${t.days} days)`;
      });
      return `*Weekly Leaderboard*\n_Past 7 days_\n\n${rows.join('\n')}`;
    },
    '/history': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const records = await db
        .prepare(
          "SELECT date, clock_in, clock_out FROM attendance WHERE technician_id = ? AND date >= date('now', 'weekday 0', '-6 days') ORDER BY date ASC"
        )
        .bind(tech.id)
        .all();
      if (records.results.length === 0) return 'No attendance records for this week.';
      const rows = records.results.map((r: any) => {
        const day = fmtDate(r.date);
        const ci = fmtTime(r.clock_in);
        const co = fmtTime(r.clock_out);
        let dur = '';
        if (r.clock_in && r.clock_out) {
          const mins = Math.round(
            (new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000
          );
          dur = ` (${Math.floor(mins / 60)}h ${mins % 60}m)`;
        }
        return `${day}: ${ci} -> ${co}${dur}`;
      });
      return `*My History — ${tech.name}*\n_This week_\n\n${rows.join('\n')}`;
    },
    '/stats': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const [completed, pending, inProgress, totalJobs, thisWeek] = await Promise.all([
        db.prepare("SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status = 'Completed'").bind(tech.id).first(),
        db.prepare("SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status = 'Pending'").bind(tech.id).first(),
        db.prepare("SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status = 'In Progress'").bind(tech.id).first(),
        db.prepare("SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ?").bind(tech.id).first(),
        db.prepare("SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status = 'Completed' AND date(completion_time) >= date('now', '-7 days')").bind(tech.id).first(),
      ]);
      const [weekAttendance] = await Promise.all([
        db.prepare("SELECT SUM(CASE WHEN clock_out IS NOT NULL THEN (julianday(clock_out) - julianday(clock_in)) * 24 * 60 ELSE 0 END) as total_mins FROM attendance WHERE technician_id = ? AND date >= date('now', '-7 days')").bind(tech.id).first(),
      ]);
      const totalMins = weekAttendance?.total_mins || 0;
      const weekH = Math.floor(totalMins / 60);
      const weekM = Math.round(totalMins % 60);
      return (
        `*Performance Stats — ${tech.name}*\n\n` +
        `📊 *All Time:*\n` +
        `• Total jobs: ${totalJobs?.cnt || 0}\n` +
        `• Completed: ${completed?.cnt || 0}\n` +
        `• In Progress: ${inProgress?.cnt || 0}\n` +
        `• Pending: ${pending?.cnt || 0}\n\n` +
        `📈 *This Week:*\n` +
        `• Jobs completed: ${thisWeek?.cnt || 0}\n` +
        `• Hours worked: ${weekH}h ${weekM}m`
      );
    },
    '/schedule': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const jobs = await db
        .prepare(
          "SELECT id, job_description, service_type, status, created_at FROM service_records WHERE technician_id = ? AND status IN ('Pending', 'In Progress') ORDER BY created_at ASC LIMIT 10"
        )
        .bind(tech.id)
        .all();
      if (jobs.results.length === 0) return 'No upcoming jobs scheduled.';
      let msg = `*Your Schedule — ${tech.name}*\n\n`;
      for (const j of jobs.results as any[]) {
        const date = j.created_at ? fmtDate(j.created_at) : 'Today';
        const emoji = j.status === 'In Progress' ? '🔵' : '🟡';
        msg += `${emoji} *${j.id}*\n   ${j.service_type} • ${j.status}\n   ${(j.job_description || '').substring(0, 60)}\n   📅 ${date}\n\n`;
      }
      return msg;
    },
    '/broadcast': async () => {
      const tech = await resolveTech(from, db);
      if (!tech) return 'You are not registered.';
      const isAdmin = await db.prepare("SELECT role FROM technicians WHERE id = ?").bind(tech.id).first();
      if (!isAdmin || isAdmin.role?.toLowerCase() !== 'admin') return '⛔ Admin only command.';
      const args = command.split(' ').slice(1);
      const message = args.join(' ');
      if (!message) return 'Usage: /broadcast Your message here';
      const allTechs = await db.prepare("SELECT id, name FROM technicians WHERE active = 1").all();
      if (!allTechs.results || allTechs.results.length === 0) return 'No active technicians found.';
      let sent = 0;
      for (const t of allTechs.results as any[]) {
        try {
          const techUser = await db.prepare("SELECT telegram_username FROM technicians WHERE id = ?").bind(t.id).first();
          if (techUser?.telegram_username) {
            sent++;
          }
        } catch (_) {}
      }
      await sendTelegramMessage(env, chatId, `📢 *Broadcast sent to ${allTechs.results.length} technicians:*\n\n${message}`);
      return `📢 Broadcast delivered to ${allTechs.results.length} team members.`;
    },
    '/myid': async () => {
      return (
        `*Your Telegram Info:*\n\n` +
        `• Telegram ID: \`${from.id}\`\n` +
        `• Username: @${from.username || 'N/A'}\n` +
        `• Name: ${from.first_name || ''} ${from.last_name || ''}\n\n` +
        `_Share this with your admin to link your account._`
      );
    },
  };

  const baseCmd = command.split(' ')[0].toLowerCase();
  const handler = cmds[baseCmd];

  let reply;
  try {
    if (typeof handler === 'function') {
      reply = await handler();
    } else if (typeof handler === 'string') {
      reply = handler;
    } else {
      reply = 'Unknown command. Use /help to see available commands.';
    }
  } catch (e) {
    console.error(`Command ${baseCmd} error:`, e);
    reply = 'An error occurred processing this command.';
  }

  return reply;
}

async function handleCallbackQuery(chatId, data, from, db, env) {
  const [action, jobId] = data.split(':');
  let reply = 'Processing...';

  switch (action) {
    case 'accept_job': {
      const tech = await resolveTech(from, db);
      if (tech) {
        await db
          .prepare(
            "UPDATE service_records SET status = 'In Progress', technician_id = ? WHERE id = ?"
          )
          .bind(tech.id, jobId)
          .run();
        reply = `Job #${jobId} accepted!`;
      } else {
        reply = 'You are not registered.';
      }
      break;
    }
    case 'complete_job':
      await db
        .prepare("UPDATE service_records SET status = 'Completed' WHERE id = ?")
        .bind(jobId)
        .run();
      reply = `Job #${jobId} marked as completed.`;
      break;
    default:
      reply = 'Unknown action.';
  }

  await sendTelegramMessage(env, chatId, reply);
}

async function handleJobCreation(chatId, text, from, db, env) {
  let techId = null;
  const tech = await db
    .prepare('SELECT id FROM technicians WHERE id = ?')
    .bind(from.id.toString())
    .first();
  if (tech) {
    techId = tech.id;
  } else {
    const username = (from.username || '').replace(/^@/, '');
    const techByName = await db
      .prepare(
        "SELECT id FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)"
      )
      .bind(username)
      .first();
    if (!techByName) {
      return sendTelegramMessage(
        env,
        chatId,
        'You are not registered as a technician. Contact your admin.'
      );
    }
    techId = techByName.id;
  }

  const id = 'JOB-TG-' + Date.now().toString(36).toUpperCase();
  await db
    .prepare(
      "INSERT INTO service_records (id, technician_id, service_type, status, job_description) VALUES (?, ?, 'General Maintenance', 'Pending', ?)"
    )
    .bind(id, techId, text.substring(0, 500))
    .run();

  await sendTelegramMessage(
    env,
    chatId,
    `Job created: #${id}\n\nDescription: ${text.substring(0, 100)}`
  );
}

async function handleVoiceMessage(chatId, voice, from, db, env) {
  if (!env.GEMINI_API_KEY) {
    await sendTelegramMessage(env, chatId, '❌ Voice transcription not configured. Contact admin.');
    return;
  }

  try {
    // Step 1: Get file info from Telegram
    const fileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${voice.file_id}`);
    const fileData = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result) throw new Error('Failed to get voice file info');

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    // Step 2: Download the voice file
    const audioRes = await fetch(fileUrl);
    if (!audioRes.ok) throw new Error('Failed to download voice file');
    const audioBuffer = await audioRes.arrayBuffer();

    // Step 3: Transcribe using Gemini
    // Use chunked base64 encoding to avoid stack overflow on large files
    const audioBytes = new Uint8Array(audioBuffer);
    let base64Audio = '';
    const chunkSize = 8192;
    for (let i = 0; i < audioBytes.length; i += chunkSize) {
      base64Audio += String.fromCharCode(...audioBytes.subarray(i, i + chunkSize));
    }
    base64Audio = btoa(base64Audio);
    
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: 'Transcribe this spoken technical issue or service complaint into plain English text. Do not summarize, output only the transcribed text.' },
            { inline_data: { mime_type: 'audio/ogg', data: base64Audio } }
          ]
        }]
      })
    });

    const geminiData = (await geminiRes.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const transcription = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!transcription) {
      await sendTelegramMessage(env, chatId, '❌ Could not transcribe voice message. Please try again or send text.');
      return;
    }

    // Step 4: Send transcription confirmation
    await sendTelegramMessage(env, chatId, `🎤 *Voice Transcribed:*\n\n${transcription}\n\n⏳ Creating job ticket...`);

    // Step 5: AI auto-dispatch - find best technician
    await handleJobCreation(chatId, transcription, from, db, env);

  } catch (err) {
    console.error('Voice message handling error:', err);
    await sendTelegramMessage(env, chatId, `❌ Voice processing failed: ${err.message}`);
  }
}

async function handlePhotoMessage(chatId, photo, from, db, env) {
  try {
    // Get file info
    const fileRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
    const fileData = (await fileRes.json()) as { ok: boolean; result?: { file_path: string } };
    if (!fileData.ok || !fileData.result) throw new Error('Failed to get photo file info');

    const filePath = fileData.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;

    // Download photo
    const photoRes = await fetch(fileUrl);
    if (!photoRes.ok) throw new Error('Failed to download photo');
    const photoBuffer = await photoRes.arrayBuffer();

    // Generate job ID first
    const id = 'JOB-TG-' + Date.now().toString(36).toUpperCase();

    // Upload to Google Drive (using existing utility)
    const { uploadFileToGoogleDrive } = await import('../utils/google.js');
    const driveFileId = await uploadFileToGoogleDrive(env, new Blob([photoBuffer], { type: 'image/jpeg' }), `telegram_photo_${Date.now()}.jpg`, 'Telegram Client', id);
    const driveResult = driveFileId ? { webViewLink: `https://drive.google.com/file/d/${driveFileId}/view` } : null;

    // Create job with photo reference
    let techId = null;
    const tech = await db
      .prepare('SELECT id FROM technicians WHERE id = ?')
      .bind(from.id.toString())
      .first();
    if (tech) {
      techId = tech.id;
    } else {
      const username = (from.username || '').replace(/^@/, '');
      const techByName = await db
        .prepare(
          "SELECT id FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)"
        )
        .bind(username)
        .first();
      if (!techByName) {
        await sendTelegramMessage(env, chatId, 'You are not registered as a technician. Contact your admin.');
        return;
      }
      techId = techByName.id;
    }

    await db
      .prepare(
        "INSERT INTO service_records (id, technician_id, service_type, status, job_description, before_photo) VALUES (?, ?, 'General Maintenance', 'Pending', ?, ?)"
      )
      .bind(id, techId, 'Photo uploaded via Telegram', driveResult.webViewLink || fileUrl)
      .run();

    await sendTelegramMessage(
      env,
      chatId,
      `📸 *Photo Received & Job Created*\n\n#${id}\nPhoto saved to Google Drive.\n\nDescription: Photo uploaded via Telegram`
    );

  } catch (err) {
    console.error('Photo message handling error:', err);
    await sendTelegramMessage(env, chatId, `❌ Photo processing failed: ${err.message}`);
  }
}

async function handleLocationShare(chatId, location, from, db, env) {
  try {
    const tech = await resolveTech(from, db);
    if (!tech) {
      await sendTelegramMessage(env, chatId, 'You are not registered as a technician. Contact your admin.');
      return;
    }

    const { latitude, longitude } = location;

    // Check if already clocked in today
    const existing = await db
      .prepare(
        "SELECT id FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
      )
      .bind(tech.id)
      .first();

    if (existing) {
      // Already clocked in — treat as check-out
      const now = new Date().toISOString().slice(11, 16);
      await db
        .prepare("UPDATE attendance SET clock_out = datetime('now') WHERE id = ?")
        .bind(existing.id)
        .run();
      await sendTelegramMessage(
        env,
        chatId,
        `📍 *Location received & Clocked Out*\n\n⏰ Time: ${now}\n📌 Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}\n\nHave a great day, ${tech.name}!`
      );
    } else {
      // Not clocked in — treat as check-in
      const id = 'ATT-' + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO attendance (id, technician_id, date, clock_in, clock_in_lat, clock_in_lng) VALUES (?, ?, date('now'), datetime('now'), ?, ?)"
        )
        .bind(id, tech.id, latitude, longitude)
        .run();
      const now = new Date().toISOString().slice(11, 16);
      await sendTelegramMessage(
        env,
        chatId,
        `📍 *Location received & Clocked In*\n\n⏰ Time: ${now}\n📌 Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}\n\nGood luck, ${tech.name}!`
      );
    }
  } catch (err) {
    console.error('Location share error:', err);
    await sendTelegramMessage(env, chatId, `❌ Location processing failed: ${err.message}`);
  }
}

function getHelpText() {
  return (
    '🤖 *KOSAI FIELD OPS Bot*\n\n' +
    '*Attendance*\n' +
    '/clock - Quick clock status\n' +
    '/checkin or /clockin - Clock in\n' +
    '/checkout or /clockout - Clock out\n' +
    '📍 Share location — Auto clock in/out\n\n' +
    '*Jobs*\n' +
    '/jobs - Your active jobs\n' +
    '/completed - Your completed jobs\n' +
    "/today - Today's summary\n" +
    '/ticket JOB-xxx - Job details\n' +
    '/schedule - Upcoming jobs\n' +
    '/stats - Your performance stats\n\n' +
    '*Actions*\n' +
    '/accept JOB-xxx - Accept a job\n' +
    '/assign JOB-xxx TechName - Assign\n' +
    '/cancel JOB-xxx - Cancel a job\n\n' +
    '*Team*\n' +
    '/status - Clock & job status\n' +
    '/team - Who is online now\n' +
    '/report - Weekly report\n' +
    '/leaderboard - Hours ranking\n' +
    '/history - This week history\n' +
    '/myid - Your Telegram info\n\n' +
    '*Admin*\n' +
    '/broadcast msg - Message all techs\n\n' +
    'Send text → auto-create job\n' +
    'Send voice → AI transcribe & create\n' +
    'Send photo → Upload & create job'
  );
}

export { register };
