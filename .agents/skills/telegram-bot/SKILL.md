---
name: telegram-bot
description: Rules and guidance on the Telegram Bot feature, including webhook commands, voice message processing, AI dispatching, and outbound notifications.
---

# 🤖 Telegram Bot Integration & Features

This skill guides you through the Telegram Bot features integrated into the Field Service Worker application. It covers incoming webhook processing, commands, voice transcription, AI dispatching, and outbound telemetry alerts.

## ⚙️ Environment Variables

The Telegram bot relies on the following environment variables in [**`wrangler.toml`**](file:///d:/kosai-project/v2/wrangler.toml) or [**`.dev.vars`**](file:///d:/kosai-project/v2/.dev.vars):

- `TELEGRAM_BOT_TOKEN`: The bot token obtained from BotFather.
- `TELEGRAM_CHAT_ID`: The target Telegram channel or group ID for dispatch alerts/notifications.
- `GEMINI_API_KEY`: API key for Gemini 2.5 Flash, used for voice transcription and dispatcher decision routing.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`: Credentials used by the bot to pull uploaded files from Google Drive securely before sending them to Telegram.

---

## 📡 Webhook Actions (`/api/telegram-webhook`)

Incoming webhook requests are handled via a `POST` handler at `/api/telegram-webhook`.

### 1. Telegram Slash Commands & Mentions

- **/status `[Ticket ID]`**:
  - Returns formatted details of a work order (e.g. `/status JOB-201`).
  - Fetches company, technician, service details, and displays the **Service Checklist** progress parsed from `checklist_data`.
- **/assign `[Ticket ID]` `[Tech ID/Name/Nickname]`**:
  - Assigns a technician to a ticket by specifying their Name, Nickname, or ID (e.g. `/assign JOB-201 Koko`).
  - Searches active technicians by `id`, `name`, or `nickname` (case-insensitive).
  - Automatically notifies the assigned technician and broadcasts the update.

### 2. AI Voice Transcription & Auto-Dispatch

- **Trigger condition**: When a voice message is received or the incoming message contains keywords: `dispatch`, `repair`, `cameras`, or `blank`.
- **Voice Transcription**:
  - Downloads voice message files via the Telegram Bot API (`getFile` and `file` endpoints).
  - Sends the audio (`audio/ogg`) to Gemini `gemini-2.5-flash` with the prompt: _"Transcribe this spoken technical issue or service complaint into plain English text. Do not summarize, output only the transcribed text."_
- **AI Technician Matcher & Router**:
  - Retrieves all active technicians.
  - Prompts Gemini to select a domain (`CCTV`, `Networking`, `WiFi`, `NAS`, `General Maintenance`) and choose the best matching technician based on the issue or explicit mention of names/nicknames.
  - Creates or updates a client record with ID `CLI-TG-JOB-TG-[random]` and a ticket with ID `JOB-TG-[random]`.
  - Sends a confirmation message back to the Telegram chat.

---

## 🔔 Outbound Notifications

The application triggers outbound alerts to the Telegram channel in these scenarios:

1. **Site Photos / Job Completion**:
   - Sends text and before/after photos during site uploads in [**`src/index.js`**](file:///d:/kosai-project/v2/src/index.js).
   - **Photo Delivery Pipeline**: Instead of passing raw Google Drive URLs (which Telegram cannot download because they require authorization), the worker retrieves the binary stream from Google Drive using the OAuth refresh token, formats it, and transmits it directly via `sendTelegramPhotoNotification`.
2. **System Database Backups**:
   - Sends database backup logs automatically upon backup events.
