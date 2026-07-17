/**
 * Telegram Routes — Bot webhook handler and message dispatch
 */

import { success, error } from '../utils/response.js';
import { verifyToken } from '../utils/jwt.js';
import { sendTelegramMessage } from '../utils/telegram.js';

function register(router, env) {
  const db = env.DB;

  // ── POST /api/telegram/webhook ────────────────────────────────────────
  router.post('/api/telegram/webhook', async (request) => {
    try {
      const update = (await request.json() as any);

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

      const { chat_id, text, parse_mode } = (await request.json() as any);
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
    .prepare("SELECT id, name FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)")
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
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

async function handleCommand(chatId, command, from, db, env) {
  const cmds = {
    '/start': 'Welcome to Awesome Myanmar Bot! Use /help to see available commands.',
    '/help': getHelpText(),
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
        const mins = Math.round((new Date(record.clock_out).getTime() - new Date(record.clock_in).getTime()) / 60000);
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
        jobs.results.map((j) => `• #${j.id}: ${j.job_description?.substring(0, 50)} [${j.status}]`).join('\n')
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
        jobs.results.map((j) => `• #${j.id}: ${j.job_description?.substring(0, 50)} (${j.completed_at || 'N/A'})`).join('\n')
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
        msg += `Jobs (${jobs.results.length}):\n` +
          jobs.results.map((j) => `• #${j.id}: ${j.job_description?.substring(0, 40)} [${j.status}]`).join('\n');
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
        ? (attendance.clock_out ? `Clocked out at ${attendance.clock_out}` : `Clocked in at ${attendance.clock_in}`)
        : 'Not clocked in today';
      const activeJobs = await db
        .prepare(
          "SELECT COUNT(*) as cnt FROM service_records WHERE technician_id = ? AND status IN ('Pending', 'In Progress')"
        )
        .bind(tech.id)
        .first();
      return (
        `*${tech.name}*\n\n` +
        `Clock: ${clockStatus}\n` +
        `Active jobs: ${activeJobs?.cnt || 0}`
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
          "SELECT id, job_description, service_type, status, technician_id, company_name, client_name, client_phone, address, checklist_data, created_at FROM service_records WHERE id = ?"
        )
        .bind(jobId)
        .first();
      if (!record) return 'Job not found.';
      let techName = 'Unassigned';
      if (record.technician_id) {
        const t = await db.prepare('SELECT name FROM technicians WHERE id = ?').bind(record.technician_id).first();
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
        checklist + '\n' +
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
        .prepare("SELECT id, status, technician_id FROM service_records WHERE id = ?")
        .bind(jobId)
        .first();
      if (!job) return 'Job not found.';
      if (job.status === 'Completed') return 'Job is already completed.';
      if (job.status === 'Cancelled') return 'Job is already cancelled.';
      await db
        .prepare("UPDATE service_records SET status = 'In Progress', technician_id = ?, updated_at = datetime('now') WHERE id = ?")
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
        .prepare("SELECT id, status FROM service_records WHERE id = ?")
        .bind(jobId)
        .first();
      if (!job) return 'Job not found.';
      const targetTech = await db
        .prepare(
          "SELECT id, name FROM technicians WHERE id = ? OR LOWER(name) = LOWER(?) OR LOWER(nickname) = LOWER(?)"
        )
        .bind(techQuery, techQuery, techQuery)
        .first();
      if (!targetTech) return 'Technician not found.';
      await db
        .prepare("UPDATE service_records SET technician_id = ?, status = CASE WHEN status = 'Pending' THEN 'In Progress' ELSE status END WHERE id = ?")
        .bind(targetTech.id, jobId)
        .run();
      return `Job #${jobId} assigned to ${targetTech.name}.`;
    },
    '/cancel': async () => {
      const args = command.split(' ').slice(1);
      const jobId = args[0];
      if (!jobId) return 'Usage: /cancel JOB-xxx';
      const job = await db
        .prepare("SELECT id, status FROM service_records WHERE id = ?")
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
      const techMap: Record<string, { name: string; nickname: string | null; totalMins: number; days: number }> = {};
      for (const r of records.results as any[]) {
        const key = r.name;
        if (!techMap[key]) techMap[key] = { name: r.name, nickname: r.nickname, totalMins: 0, days: 0 };
        if (r.clock_in && r.clock_out) {
          const inMin = parseInt(r.clock_in.slice(11, 13)) * 60 + parseInt(r.clock_in.slice(14, 16));
          const outMin = parseInt(r.clock_out.slice(11, 13)) * 60 + parseInt(r.clock_out.slice(14, 16));
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
          const mins = Math.round((new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime()) / 60000);
          dur = ` (${Math.floor(mins / 60)}h ${mins % 60}m)`;
        }
        return `${day}: ${ci} -> ${co}${dur}`;
      });
      return `*My History — ${tech.name}*\n_This week_\n\n${rows.join('\n')}`;
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
          .prepare("UPDATE service_records SET status = 'In Progress', technician_id = ? WHERE id = ?")
          .bind(tech.id, jobId)
          .run();
        reply = `Job #${jobId} accepted!`;
      } else {
        reply = 'You are not registered.';
      }
      break;
    }
    case 'complete_job':
      await db.prepare("UPDATE service_records SET status = 'Completed' WHERE id = ?").bind(jobId).run();
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
      .prepare("SELECT id FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)")
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

function getHelpText() {
  return (
    '🤖 *Awesome Myanmar Bot*\n\n' +
    '*General*\n' +
    '/start - Welcome message\n' +
    '/help - Show this help\n\n' +
    '*Attendance*\n' +
    '/clock - Quick clock status summary\n' +
    '/checkin or /clockin - Clock in for today\n' +
    '/checkout or /clockout - Clock out\n' +
    '/status - Check clock-in status & active jobs\n' +
    '/report - Weekly attendance summary\n' +
    '/team - See who is currently clocked in\n' +
    '/leaderboard - Weekly hours leaderboard\n' +
    '/history - My clock-in/out history this week\n\n' +
    '*Jobs*\n' +
    '/jobs - List your active jobs\n' +
    '/completed - List your completed jobs\n' +
    '/today - Show today\'s jobs & attendance\n' +
    '/ticket JOB-xxx - View job details\n\n' +
    '*Actions*\n' +
    '/accept JOB-xxx - Accept a job assignment\n' +
    '/assign JOB-xxx TechName - Assign technician\n' +
    '/cancel JOB-xxx - Cancel a job\n\n' +
    'Send any text to auto-create a job ticket.'
  );
}

export { register };

