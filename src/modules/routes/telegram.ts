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
    '/start': 'Welcome to Kosai Service Bot! Use /help to see available commands.',
    '/help': getHelpText(),
    '/jobs': async () => {
      const tech = await db
        .prepare('SELECT id FROM technicians WHERE telegram_id = ?')
        .bind(from.id)
        .first();
      if (!tech) return 'You are not registered as a technician. Contact your admin.';
      const jobs = await db
        .prepare(
          "SELECT id, title, status, priority FROM jobs WHERE assigned_to = ? AND status IN ('pending', 'assigned', 'in_progress') ORDER BY priority DESC, scheduled_date ASC LIMIT 5"
        )
        .bind(tech.id)
        .all();
      if (jobs.results.length === 0) return 'No active jobs assigned to you.';
      return (
        '📋 *Your Active Jobs:*\n\n' +
        jobs.results.map((j) => `• #${j.id}: ${j.title} [${j.status}]`).join('\n')
      );
    },
    '/status': async () => {
      const tech = await db
        .prepare('SELECT id, name FROM technicians WHERE telegram_id = ?')
        .bind(from.id)
        .first();
      if (!tech) return 'Not registered.';
      const att = await db
        .prepare(
          "SELECT * FROM attendance WHERE technician_id = ? AND date = date('now') AND clock_out IS NULL"
        )
        .bind(tech.id)
        .first();
      return att ? `✅ You are clocked in (since ${att.clock_in})` : '❌ You are clocked out.';
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
  // Parse callback data: action:jobId
  const [action, jobId] = data.split(':');
  let reply = 'Processing...';

  switch (action) {
    case 'accept_job':
      const tech = await db
        .prepare('SELECT id FROM technicians WHERE telegram_id = ?')
        .bind(from.id)
        .first();
      if (tech) {
        await db
          .prepare("UPDATE jobs SET status = 'assigned', assigned_to = ? WHERE id = ?")
          .bind(tech.id, jobId)
          .run();
        reply = `✅ Job #${jobId} accepted!`;
      } else {
        reply = '❌ You are not registered.';
      }
      break;
    case 'complete_job':
      await db.prepare("UPDATE jobs SET status = 'completed' WHERE id = ?").bind(jobId).run();
      reply = `✅ Job #${jobId} marked as completed.`;
      break;
    default:
      reply = 'Unknown action.';
  }

  await sendTelegramMessage(env, chatId, reply);
}

async function handleJobCreation(chatId, text, from, db, env) {
  // Simple auto-dispatch: create a job from a Telegram message
  const tech = await db
    .prepare('SELECT id FROM technicians WHERE telegram_id = ?')
    .bind(from.id)
    .first();
  if (!tech) {
    return sendTelegramMessage(
      env,
      chatId,
      'You are not registered as a technician. Contact your admin.'
    );
  }

  const id = 'JOB-' + Date.now().toString(36).toUpperCase();
  await db
    .prepare(
      "INSERT INTO jobs (id, title, description, status, created_by, notes) VALUES (?, ?, ?, 'pending', ?, ?)"
    )
    .bind(
      id,
      text.substring(0, 100),
      text,
      tech.id,
      `Created via Telegram by ${from.first_name || from.id}`
    )
    .run();

  await sendTelegramMessage(
    env,
    chatId,
    `✅ Job created: #${id}\n\nTitle: ${text.substring(0, 100)}`
  );
}

function getHelpText() {
  return (
    '🤖 *Kosai Bot Commands*\n\n' +
    '/start - Welcome message\n' +
    '/help - Show this help\n' +
    '/jobs - List your active jobs\n' +
    '/status - Check clock-in status\n\n' +
    'Send any text to auto-create a job ticket.'
  );
}

export { register };

