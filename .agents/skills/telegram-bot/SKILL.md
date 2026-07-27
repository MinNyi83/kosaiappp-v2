---
name: telegram-bot
description: Rules and guidance on the Telegram Bot feature, including webhook commands, voice message processing, photo message handling, AI dispatching, and outbound notifications.
---

# Telegram Bot Integration & Features

This skill guides you through the Telegram Bot features integrated into the KosAI Field Service system. It covers incoming webhook processing, commands, voice transcription, photo handling, AI dispatching, and outbound notifications.

## Environment Variables

The Telegram bot relies on the following environment variables in `wrangler.toml` or `.dev.vars`:

- `TELEGRAM_BOT_TOKEN`: The bot token obtained from BotFather.
- `TELEGRAM_CHAT_ID`: The target Telegram channel or group ID for dispatch alerts/notifications.
- `GEMINI_API_KEY`: API key for Gemini 2.5 Flash, used for voice transcription and dispatcher decision routing.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: Credentials used to pull uploaded files from Google Drive.

---

## Webhook Actions (`/api/telegram/webhook`)

Incoming webhook requests are handled via a `POST` handler at `/api/telegram/webhook`.

### Slash Commands (15+ commands)

| Command | Description | Access |
|---------|-------------|--------|
| `/start` | Welcome message | All |
| `/help` | Show all available commands | All |
| `/clock` | Quick clock status summary | All |
| `/checkin` or `/clockin` | Clock in for today | All |
| `/checkout` or `/clockout` | Clock out | All |
| `/status` | Check clock-in status & active jobs | All |
| `/report` | Weekly attendance summary | All |
| `/team` | See who is currently clocked in | All |
| `/leaderboard` | Weekly hours leaderboard | All |
| `/history` | My clock-in/out history this week | All |
| `/jobs` | List your active jobs | All |
| `/completed` | List your completed jobs | All |
| `/today` | Show today's jobs & attendance | All |
| `/ticket JOB-xxx` | View job details | All |
| `/accept JOB-xxx` | Accept a job assignment | All |
| `/assign JOB-xxx TechName` | Assign technician | Admin only |
| `/cancel JOB-xxx` | Cancel a job | Admin only |

### AI Voice Transcription & Auto-Dispatch

- **Trigger**: Voice message received (`update.message.voice`)
- **Transcription**: Downloads voice, sends to Gemini `gemini-2.5-flash` with prompt: _"Transcribe this spoken technical issue into plain English text."_
- **Auto-Matcher**: Gemini selects service domain (CCTV, Networking, WiFi, NAS, General Maintenance) and best technician
- **Creates**: Client record (`CLI-TG-...`) and job record (`JOB-TG-...`)
- **Confirms**: Sends dispatch message with assigned technician and Job ID

### Photo Message Handling

- **Trigger**: Photo message received (`update.message.photo`)
- **Processing**: Downloads highest-res photo, uploads to Google Drive via `uploadFileToGoogleDrive`
- **Storage**: Organized in `AWESOME Myanmar / {Client} / {JobID}/`
- **Creates**: Job record with `before_photo` pointing to Drive link
- **Confirms**: Sends Job ID back to Telegram chat

### Inline Keyboard Callbacks

- `accept_job` - Marks job as "In Progress" and assigns to technician
- `complete_job` - Marks job as "Completed"

---

## Outbound Notifications

### Status Change Notifications

Every job status change sends a text notification to the Telegram group:

```
✅ Job Completed

📋 Job: JOB-202
👤 Client: Omega Logistics Hub
🔧 Type: CCTV
👨‍💼 Technician: Alex Mercer
📝 5/5 checklist items, 2 hardware items used
```

**Status emojis:**
- `⏳` Pending
- `🔧` In Progress
- `✅` Completed
- `❌` Cancelled

### Photo Notifications

Every photo upload sends an inline photo to Telegram:

- **Trigger**: `POST /api/jobs/:id/photo` endpoint
- **Delivery**: Photo sent as inline image via `sendPhoto` API
- **Caption**: `📸 Before/After/Signature Photo — JOB-XXX`
- **Source**: Uses base64 data URI directly (avoids Drive re-download issues)

### Photo Delivery Pipeline

The `sendTelegramPhotoNotification` function handles photo delivery:

1. **Base64 data URI**: Decodes directly, creates Blob, sends via `sendPhoto`
2. **Google Drive URL**: Extracts file ID, uses Drive API to download, then sends via `sendPhoto`
3. **Fallback**: If photo fails, sends text link to Google Drive

**Important**: Always use base64 for delivery (not Drive URLs) to avoid authorization issues in Workers.

### System Notifications

- **Database Backups**: Sends backup logs on cron events (midnight schedule)
- **Job Assignment**: Notifies technicians when assigned via `/assign` or `accept_job`
- **Inventory Alerts**: Low stock alerts when inventory falls below threshold

### Notification Templates

```typescript
// Status change notification
const statusNotification = `${emoji} *Job ${status}*\n\n` +
  `📋 *Job:* ${jobId}\n` +
  `👤 *Client:* ${clientName}\n` +
  `🔧 *Type:* ${serviceType}\n` +
  `👨‍💼 *Technician:* ${techName}\n` +
  (notes ? `\n📝 ${notes}` : '');

// Photo notification caption
const photoCaption = `📸 ${typeLabel} Photo — ${jobId}`;
// typeLabel: 'Before', 'After', or 'Signature'

// Backup notification
const backupNotification = `📊 *Database Auto-Backup Report*\n\n` +
  `📅 *Date:* ${dateStr}\n` +
  `📂 *Backup File:* \`${filename}\`\n` +
  `✅ *Google Drive Upload:* Successful\n` +
  `🔑 *File ID:* \`${driveFileId}\`\n` +
  `\n📦 *Record Summaries:*` +
  `\n• \`service_records\`: ${count} records`;
```

---

## API Endpoints

### Notification Endpoints

- `POST /api/jobs/:id/status` - Updates status + sends Telegram notification
- `POST /api/jobs/:id/photo` - Uploads photo to Drive + sends to Telegram
- `POST /api/jobs/:id/notify` - Sends custom Telegram notification

### Utility Functions

```typescript
// Send text notification to default chat
sendTelegramNotification(env, text)

// Send photo notification with caption
sendTelegramPhotoNotification(env, photoBase64, caption)

// Send message to specific chat
sendTelegramMessage(env, chatId, text)
```

---

## Rules

- Photos must be sent as inline images (not Drive links)
- Use base64 data URIs for reliable photo delivery
- Remove `parse_mode: 'Markdown'` from photo captions (emoji can break parsing)
- Status notifications include emoji prefix for quick visual scanning
- All notifications are non-blocking (errors logged but don't fail the request)
- Quote user names and job IDs with backticks to prevent Markdown injection
