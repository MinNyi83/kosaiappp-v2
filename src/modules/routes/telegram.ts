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
          await handleCommand(chatId, text, from, db, env);
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

async function handleCommand(chatId, command, from, db, env) {
  const cmds = {
    '/start': 'Welcome to Awesome Myanmar Bot! Use /help to see available commands.',
    '/help': getHelpText(),
    '/jobs': async () => {
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
        if (!techByName) return 'You are not registered as a technician. Contact your admin.';
        techId = techByName.id;
      }
      const jobs = await db
        .prepare(
          "SELECT id, job_description, service_type, status FROM service_records WHERE technician_id = ? AND status IN ('Pending', 'In Progress') ORDER BY created_at DESC LIMIT 5"
        )
        .bind(techId)
        .all();
      if (jobs.results.length === 0) return 'No active jobs assigned to you.';
      return (
        '*Your Active Jobs:*\n\n' +
        jobs.results.map((j) => `• #${j.id}: ${j.job_description?.substring(0, 50)} [${j.status}]`).join('\n')
      );
    },
    '/status': async () => {
      let techId = null;
      let techName = null;
      const tech = await db
        .prepare('SELECT id, name FROM technicians WHERE id = ?')
        .bind(from.id.toString())
        .first();
      if (tech) {
        techId = tech.id;
        techName = tech.name;
      } else {
        const username = (from.username || '').replace(/^@/, '');
        const techByName = await db
          .prepare("SELECT id, name FROM technicians WHERE LOWER(REPLACE(telegram_username, '@', '')) = LOWER(?)")
          .bind(username)
          .first();
        if (!techByName) return 'Not registered.';
        techId = techByName.id;
        techName = techByName.name;
      }
      return `Hello ${techName}! You are registered as a technician.`;
    },
  };

  const baseCmd = command.split(' ')[0].toLowerCase();
  const handler = cmds[baseCmd];

  let reply;
  if (typeof handler === 'function') {
    reply = await handler();
  } else if (typeof handler === 'string') {
    reply = handler;
  } else {
    reply = 'Unknown command. Use /help to see available commands.';
  }

  await sendTelegramMessage(env, chatId, reply);
}

async function handleCallbackQuery(chatId, data, from, db, env) {
  const [action, jobId] = data.split(':');
  let reply = 'Processing...';

  switch (action) {
    case 'accept_job':
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
        techId = techByName?.id;
      }
      if (techId) {
        await db
          .prepare("UPDATE service_records SET status = 'In Progress', technician_id = ? WHERE id = ?")
          .bind(techId, jobId)
          .run();
        reply = `Job #${jobId} accepted!`;
      } else {
        reply = 'You are not registered.';
      }
      break;
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
    '/start - Welcome message\n' +
    '/help - Show this help\n' +
    '/jobs - List your active jobs\n' +
    '/status - Check clock-in status\n\n' +
    'Send any text to auto-create a job ticket.'
  );
}

export { register };

