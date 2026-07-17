# n8n Credentials Setup Guide

Complete reference for every API key, token, and credential needed across all 13 Kosai workflows.

---

## Quick Reference Table

| Credential | Type | Used By | Priority |
|---|---|---|---|
| Kosai API Key | HTTP Header | All workflows | REQUIRED |
| Telegram Bot Token | n8n Credential | All workflows | REQUIRED |
| Telegram Chat ID | Environment Variable | All workflows | REQUIRED |
| Facebook Page Access Token | Environment Variable | WF11, WF12, WF13 | OPTIONAL |
| Facebook Page ID | Environment Variable | WF13 | OPTIONAL |
| Facebook Verify Token | Environment Variable | WF11, WF12 | OPTIONAL |
| Google Sheets OAuth2 | n8n Credential | WF10 | OPTIONAL |
| SMTP Credentials | Environment Variable | WF05 | OPTIONAL |

---

## Credential 1: Kosai API Key

**Used by:** All 13 workflows

### What It Is
The JWT secret or API key that authenticates requests to your Kosai Cloudflare Worker API.

### Where to Find It
In your `.dev.vars` file:
```
JWT_SECRET=your_secret_here
```
Or if you're using the `ADMIN_SECRET`:
```
ADMIN_SECRET=SuperSecureAdminPass123!
```

### How to Configure in n8n
**Option A: Environment Variable (Recommended)**
Add to n8n environment:
```
KOSAI_API_KEY=your_jwt_secret_here
KOSAI_BASE_URL=https://your-worker.your-subdomain.workers.dev
```
Then in each HTTP Request node, the header is already set to:
```
Authorization: Bearer {{ $env.KOSAI_API_KEY }}
```

**Option B: n8n HTTP Header Auth Credential**
1. Go to **Credentials** → **Add Credential**
2. Search for **Header Auth**
3. Name: `Kosai API`
4. Header Name: `Authorization`
5. Header Value: `Bearer your_jwt_secret_here`
6. Save

### Which Workflows Use It
Every workflow with HTTP Request nodes that call your Kosai API.

---

## Credential 2: Telegram Bot Token

**Used by:** All 13 workflows

### What It Is
The API token for your Telegram bot, obtained from @BotFather.

### How to Get It
1. Open Telegram
2. Search for `@BotFather`
3. Send `/newbot`
4. Choose a name: `Kosai Notifications`
5. Choose a username: `kosai_notifs_bot`
6. BotFather replies with a token like: `8830448196:AAG5OMrCSmbCY5Pmr1A4s0OmFTfaNB5jRwA`
7. Copy this token

### How to Configure in n8n
1. Go to **Credentials** → **Add Credential**
2. Search for **Telegram**
3. Name: `Kosai Telegram Bot`
4. Access Token: paste the token from BotFather
5. Click **Save**

### Which Workflows Use It
All 13 workflows — every Telegram node should use this credential.

---

## Credential 3: Telegram Chat ID

**Used by:** All 13 workflows

### What It Is
Your personal Telegram chat ID where admin notifications are sent.

### How to Get It
1. Open Telegram
2. Search for `@userinfobot`
3. Send any message (e.g., "hi")
4. It replies with: `Your user ID is: 5556922076`
5. Copy that number

### How to Configure in n8n
Add to environment variables:
```
TELEGRAM_CHAT_ID=5556922076
TELEGRAM_DEFAULT_CHAT_ID=5556922076
```

### Which Workflows Use It
All 13 workflows — used as the target chat for admin notifications.

---

## Credential 4: Facebook Page Access Token

**Used by:** WF11, WF12, WF13

### What It Is
A token that allows n8n to send messages and post to your Facebook Page.

### How to Get It
1. Go to [Meta for Developers](https://developers.facebook.com)
2. Create an App → Type: **Business**
3. In your App, go to **Add Products** → Add **Messenger**
4. Go to **Messenger** → **Settings**
5. Under **Access Tokens**, click **Generate Token**
6. Select your Facebook Page
7. Copy the token (long string like `EAAI...`)

### Permissions Required
When generating the token, make sure these permissions are included:
- `pages_messaging` — send/receive messages
- `pages_manage_posts` — post to page
- `pages_read_engagement` — read comments/likes

### How to Configure in n8n
Add to environment variables:
```
FB_PAGE_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxxxxxxxxxxx
```

### Which Workflows Use It
- **WF11** — Send auto-replies to Messenger messages
- **WF12** — Send welcome messages to new leads
- **WF13** — Post job completions to your Page

---

## Credential 5: Facebook Page ID

**Used by:** WF13

### What It Is
The unique ID of your Facebook Page.

### How to Get It
1. Go to your Facebook Page
2. Click **About**
3. Scroll to the bottom
4. Find **Page ID** (a number like `123456789012345`)
5. Copy it

### How to Configure in n8n
Add to environment variables:
```
FB_PAGE_ID=123456789012345
```

### Which Workflows Use It
- **WF13** — Posts to this specific Facebook Page

---

## Credential 6: Facebook Verify Token

**Used by:** WF11, WF12

### What It Is
A custom string you create to verify that webhook requests are really from Facebook.

### How to Create It
1. Make up any secret string, e.g., `KosaiFB2024!Secure`
2. Use the same string in both Meta for Developers and n8n

### How to Configure in n8n
Add to environment variables:
```
FB_VERIFY_TOKEN=KosaiFB2024!Secure
```

### How to Configure in Meta for Developers
1. Go to your App → **Messenger** → **Settings**
2. Under **Webhooks**, click **Subscribe to Events**
3. Callback URL: `https://your-n8n-url/webhook/kosai/facebook/messenger`
4. Verify Token: `KosaiFB2024!Secure` (must match n8n)
5. Click **Verify and Save**

### Which Workflows Use It
- **WF11** — Facebook Messenger webhook verification
- **WF12** — Facebook Lead Ads webhook verification

---

## Credential 7: Google Sheets OAuth2

**Used by:** WF10

### What It Is
OAuth2 credentials that allow n8n to read/write your Google Sheets.

### How to Get It
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services** → **Library**
4. Search for **Google Sheets API** → Click **Enable**
5. Go to **APIs & Services** → **Credentials**
6. Click **Create Credentials** → **OAuth client ID**
7. Application type: **Web application**
8. Authorized redirect URIs: add `https://your-n8n-url/rest/oauth2-credential/callback`
9. Copy the **Client ID** and **Client Secret**

### How to Configure in n8n
1. Go to **Credentials** → **Add Credential**
2. Search for **Google Sheets OAuth2**
3. Name: `Google Sheets`
4. Client ID: paste from Google Cloud
5. Client Secret: paste from Google Cloud
6. Click **Sign in with Google**
7. Authorize access to your Google account
8. Save

### Which Workflows Use It
- **WF10** — Writes backup data to Google Sheets

---

## Credential 8: SMTP (Email)

**Used by:** WF05 (optional)

### What It Is
Email server credentials for sending reports via email.

### How to Get It
Use your email provider's SMTP settings:

**Gmail:**
```
Host: smtp.gmail.com
Port: 587
User: your-email@gmail.com
Password: your-app-password (not your regular password)
```
To get a Gmail App Password:
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable 2-Factor Authentication
3. Go to **App passwords**
4. Generate one for "Mail"

**Other providers:**
| Provider | Host | Port |
|---|---|---|
| Outlook | smtp.office365.com | 587 |
| Yahoo | smtp.mail.yahoo.com | 587 |
| Custom | check with your provider | 587/465 |

### How to Configure in n8n
Add to environment variables:
```
SMTP_FROM=noreply@awesomemyanmar.com
ADMIN_EMAIL=nyinyimin2007@gmail.com
```

### Which Workflows Use It
- **WF05** — Sends weekly attendance CSV report via email

---

## All Environment Variables Summary

Copy this block into your n8n environment variables:

```bash
# ── REQUIRED ──────────────────────────────────────────────
KOSAI_BASE_URL=https://your-worker.workers.dev
KOSAI_API_KEY=your_jwt_secret
TELEGRAM_CHAT_ID=your_chat_id
TELEGRAM_DEFAULT_CHAT_ID=your_chat_id

# ── FACEBOOK (Required for WF11, WF12, WF13) ─────────────
FB_PAGE_ACCESS_TOKEN=your_facebook_token
FB_PAGE_ID=your_page_id
FB_VERIFY_TOKEN=your_custom_verify_token

# ── GOOGLE SHEETS (Required for WF10) ────────────────────
# Configured via OAuth2 credential in n8n UI, not env vars

# ── EMAIL (Optional for WF05) ────────────────────────────
SMTP_FROM=noreply@awesomemyanmar.com
ADMIN_EMAIL=nyinyimin2007@gmail.com
```

---

## All n8n Credentials Summary

| Credential Name | Type | Where to Create |
|---|---|---|
| Kosai API | Header Auth | n8n → Credentials → Add |
| Kosai Telegram Bot | Telegram | n8n → Credentials → Add |
| Google Sheets | OAuth2 | n8n → Credentials → Add |

---

## Workflow → Credential Mapping

| Workflow | Kosai API | Telegram | Facebook | Google Sheets | SMTP |
|---|---|---|---|---|---|
| WF01 Job Auto-Assign | YES | YES | - | - | - |
| WF02 Low Stock Alert | YES | YES | - | - | - |
| WF03 Client Onboarding | YES | YES | - | - | - |
| WF04 Invoice Reconciliation | YES | YES | - | - | - |
| WF05 Attendance Report | YES | YES | - | - | YES |
| WF06 Notification Hub | - | YES | - | - | - |
| WF07 Job Status Alert | YES | YES | - | - | - |
| WF08 Daily Digest | YES | YES | - | - | - |
| WF09 Expense Approval | YES | YES | - | - | - |
| WF10 Data Backup | YES | YES | - | YES | - |
| WF11 FB Messenger | - | YES | YES | - | - |
| WF12 FB Lead Ads | YES | YES | YES | - | - |
| WF13 FB Page Post | YES | YES | YES | - | - |

---

## Minimum Setup (Quick Start)

If you just want to get started with the basics:

1. **Kosai API** — copy `JWT_SECRET` from `.dev.vars`
2. **Telegram Bot** — create bot via @BotFather
3. **Telegram Chat ID** — get from @userinfobot

That's it — 3 things and 9 out of 13 workflows work.

---

## Full Setup (All Features)

For all 13 workflows:

1. Kosai API key
2. Telegram Bot token
3. Telegram Chat ID
4. Facebook Page Access Token
5. Facebook Page ID
6. Facebook Verify Token
7. Google Sheets OAuth2
8. SMTP credentials (optional)

---

## Testing Each Credential

### Test Kosai API
```bash
curl -H "Authorization: Bearer YOUR_KEY" https://your-worker.workers.dev/api/technicians
```
Should return a JSON array of technicians.

### Test Telegram Bot
```bash
curl -X POST "https://api.telegram.org/botYOUR_TOKEN/sendMessage" \
  -d chat_id=YOUR_CHAT_ID \
  -d text="Test from n8n"
```
Should return `"ok": true`.

### Test Facebook Token
```bash
curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN"
```
Should return your Page info.

### Test Google Sheets
In n8n, create a test workflow:
1. Manual Trigger → Google Sheets → Read spreadsheet
2. Select your credential
3. Enter a spreadsheet ID
4. Execute — should return rows

---

## Security Notes

1. **Never commit tokens to git** — keep them in environment variables only
2. **Use least-privilege tokens** — Facebook tokens should only have needed permissions
3. **Rotate tokens periodically** — especially API keys
4. **Restrict Telegram bot** — only accept messages from known chat IDs
5. **Use HTTPS** for all webhook URLs in production
