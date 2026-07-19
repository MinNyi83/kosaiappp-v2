# Facebook App Setup — Detailed Walkthrough

Step-by-step guide with exact clicks for setting up Facebook integration with n8n.

---

## Overview

You'll create:

1. A Facebook App (the "container" for your integrations)
2. A Facebook Page (your business page — you may already have one)
3. Messenger integration (for WF11 — client chat)
4. Lead Ads integration (for WF12 — capture leads)
5. Page Posts integration (for WF13 — post job completions)

---

## Part 1: Create Your Facebook App

### Step 1.1 — Go to Meta for Developers

1. Open browser: https://developers.facebook.com
2. Click **Log In** (top right)
3. Log in with your Facebook account (personal account is fine)

### Step 1.2 — Create a New App

1. Click **My Apps** (top right)
2. Click **Create App** (green button)
3. Select app type: **Business**
   - This is the correct type for Messenger, Pages, and Lead Ads
4. Click **Next**

### Step 1.3 — Fill in App Details

1. **App Name**: `Kosai`
   - (This is internal, only you see it)
2. **App Contact Email**: your email
3. **Business Account**: select your business account or create one
   - If you don't have one, click **Create a new business portfolio**
   - Name it `Awesome Myanmar` or similar
4. Click **Create App**

### Step 1.4 — App Dashboard

You're now at the app dashboard. It should look like:

```
┌─────────────────────────────────────────┐
│  Kosai                                  │
│                                         │
│  Add Products to Your App               │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Messenger│  │ Facebook │            │
│  │  Set Up  │  │  Login   │            │
│  └──────────┘  └──────────┘            │
│                                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ Pages API│  │ Lead Ads │            │
│  │  Set Up  │  │  Set Up  │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
```

---

## Part 2: Set Up Your Facebook Page

If you already have a Facebook Page for Awesome Myanmar, skip to Part 3.

### Step 2.1 — Create a Page

1. Open Facebook: https://www.facebook.com
2. Click **Pages** in the left sidebar (or go to https://facebook.com/pages/create)
3. Click **Create New Page**
4. Fill in:
   - **Page name**: `Awesome Myanmar CCTV & Infrastructure`
   - **Category**: `Security Company` or `Technology Company`
   - **Description**: `Professional CCTV, Networking, WiFi, and NAS solutions in Myanmar`
5. Click **Create Page**

### Step 2.2 — Complete Your Page

Add these to make it look professional:

1. **Profile Photo**: your logo (`logo.png`)
2. **Cover Photo**: a project photo or branded banner
3. **Contact Info**: phone, email, website
4. **Location**: your office address
5. **Business Hours**: your operating hours

### Step 2.3 — Get Your Page ID

1. Go to your new Page
2. Click **About** in the left sidebar
3. Scroll to the bottom
4. Find **Page ID** (e.g., `123456789012345`)
5. Copy it — you'll need this for `FB_PAGE_ID`

---

## Part 3: Add Messenger to Your App

### Step 3.1 — Add Messenger Product

1. Go back to your app: https://developers.facebook.com → **My Apps** → **Kosai**
2. On the dashboard, find **Messenger** and click **Set Up**
   - If you don't see it, click **Add Products** and add **Messenger**

### Step 3.2 — Generate a Page Access Token

1. In the left sidebar, go to **Messenger** → **Settings**
2. Scroll down to **Access Tokens**
3. You'll see a dropdown to select your page
4. Select **Awesome Myanmar CCTV & Infrastructure** (your page)
5. Click **Generate Token**
6. A popup shows the token — **copy it immediately**
   - It looks like: `EAAIxxxxxxxxxxxxxx...`
   - This is your `FB_PAGE_ACCESS_TOKEN`
   - **Save it somewhere safe** — you can't see it again!

### Step 3.3 — Verify Your Token Works

Test in terminal:

```bash
curl "https://graph.facebook.com/v18.0/me?access_token=YOUR_TOKEN_HERE"
```

Should return:

```json
{
  "name": "Awesome Myanmar CCTV & Infrastructure",
  "id": "123456789012345"
}
```

If it works, your token is valid.

---

## Part 4: Set Up Webhooks

### Step 4.1 — Create a Verify Token

Make up a secret string. This is like a password that proves the webhook request is really from Facebook.

Example: `KosaiFBVerify2024!Secure`

**Important**: Use the EXACT same string in both Facebook and n8n.

### Step 4.2 — Subscribe to Webhooks

1. In your app, go to **Messenger** → **Settings**
2. Scroll to **Webhooks**
3. Click **Subscribe to Events**

4. A popup appears:
   - **Callback URL**: `https://your-public-n8n-url/webhook/kosai/facebook/messenger`
     - This must be HTTPS and publicly accessible
     - If using Cloudflare Tunnel: `https://abc-xyz.trycloudflare.com/webhook/kosai/facebook/messenger`
     - If using DDNS: `http://kosai.synology.me:5678/webhook/kosai/facebook/messenger`

   - **Verify Token**: `KosaiFBVerify2024!Secure`
     - Must match exactly what you set in n8n environment

5. Click **Verify and Save**

### Step 4.3 — Subscribe to Events

After verification, you'll see a list of events to subscribe to:

| Event                 | Check    | Purpose                       |
| --------------------- | -------- | ----------------------------- |
| `messages`            | YES      | Receive messages from clients |
| `messaging_postbacks` | YES      | Handle "Get Started" button   |
| `messaging_optins`    | Optional | Track opt-ins                 |
| `message_deliveries`  | Optional | Track delivery status         |
| `message_reads`       | Optional | Track read receipts           |

1. Check **messages** and **messaging_postbacks**
2. Click **Save**

---

## Part 5: Configure n8n for Facebook

### Step 5.1 — Set Environment Variables

In n8n → **Settings** → **Environment Variables**, add:

```
FB_PAGE_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxx
FB_PAGE_ID=123456789012345
FB_VERIFY_TOKEN=KosaiFBVerify2024!Secure
```

### Step 5.2 — Update n8n Webhook URL

In n8n, the webhook URL must match what you gave Facebook.

For WF11 (Messenger), the webhook path is:

```
/webhook/kosai/facebook/messenger
```

Full URL examples:

- Local: `http://192.168.1.100:5678/webhook/kosai/facebook/messenger`
- Cloudflare Tunnel: `https://abc-xyz.trycloudflare.com/webhook/kosai/facebook/messenger`
- DDNS: `http://kosai.synology.me:5678/webhook/kosai/facebook/messenger`

### Step 5.3 — Activate WF11

1. Open workflow `WF11 Facebook Messenger Client Chat`
2. Toggle to **Active**
3. The webhook is now live

---

## Part 6: Test Facebook Messenger

### Step 6.1 — Send a Test Message

1. Go to your Facebook Page
2. Click **Message** (or **Send Message** button)
3. Type: "Hello, I need CCTV installation"
4. Send it

### Step 6.2 — Check n8n Execution

1. In n8n, go to **Executions** (left sidebar)
2. You should see a new execution for `WF11`
3. Click on it to see the flow
4. Check:
   - Webhook received the message ✓
   - Message was parsed ✓
   - Intent was classified ✓
   - Auto-reply was sent ✓
   - Telegram alert was sent ✓

### Step 6.3 — Check Facebook for Auto-Reply

Go back to your Facebook Page messenger:

- You should receive an auto-reply like:
  ```
  Hello! Welcome to Awesome Myanmar. We provide CCTV,
  Networking, WiFi, and NAS solutions. How can we help
  you today?
  ```

### Step 6.4 — Check Telegram for Agent Alert

Open Telegram:

- You should receive a notification about the Facebook message

---

## Part 7: Set Up Lead Ads (WF12)

### Step 7.1 — Enable Lead Ads

1. In your app, go to **Add Products** → **Lead Ads** → **Set Up**
2. It will ask you to configure the webhook
3. Use the same callback URL and verify token as Messenger

### Step 7.2 — Create a Lead Ad Form

1. Go to https://adsmanager.facebook.com
2. Click **Create** → **Lead generation** objective
3. Set up your ad (budget, audience, etc.)
4. In the **Ad Setup** section, choose **Instant Form**
5. Click **Create New Form**
6. Add these fields:
   - **Full Name** (required)
   - **Email** (required)
   - **Phone Number** (required)
   - **Service Interest** (dropdown):
     - CCTV Installation
     - Networking
     - WiFi Setup
     - NAS Storage
     - General Maintenance
   - **Additional Details** (short text, optional)
7. Click **Create Form**

### Step 7.3 — Subscribe to Lead Events

1. In your app, go to **Settings** → **Webhooks**
2. Click **Subscribe to Events**
3. Add a new subscription:
   - Callback URL: same as Messenger
   - Verify Token: same as Messenger
4. Subscribe to event: `leads`
5. Click **Save**

### Step 7.4 — Activate WF12

1. Open workflow `WF12 Facebook Lead Ads`
2. Toggle to **Active**

### Step 7.5 — Test with a Test Lead

1. In your Lead Ad form, click **Preview Form**
2. Fill in test data
3. Submit
4. Check n8n execution
5. Check Telegram for the new lead alert

---

## Part 8: Set Up Page Posts (WF13)

### Step 8.1 — Get Pages API Permission

1. In your app, go to **App Review** → **Permissions and Features**
2. Find `pages_manage_posts` and request it
3. For development/testing, you can use it immediately if your app is in Development Mode

### Step 8.2 — Set Page Access Token with Post Permission

Your token from Part 3 should already have this. If not:

1. Go to **Graph API Explorer**: https://developers.facebook.com/tools/explorer/
2. Select your app from the dropdown
3. Click **Generate Access Token**
4. Check these permissions:
   - `pages_messaging`
   - `pages_manage_posts`
   - `pages_read_engagement`
5. Select your page
6. Generate and copy the token
7. Update `FB_PAGE_ACCESS_TOKEN` in n8n

### Step 8.3 — Activate WF13

1. Open workflow `WF13 Facebook Page Job Post`
2. Toggle to **Active**

### Step 8.4 — Test a Page Post

```bash
curl -X POST http://YOUR_IP:5678/webhook/kosai/facebook/job-post \
  -H "Content-Type: application/json" \
  -d '{"jobId":"JOB-TEST-001"}'
```

Check your Facebook Page — you should see a new post.

---

## Part 9: Facebook App Review (For Production)

Your app works in Development Mode for testing. For production (public users), you need app review.

### Step 9.1 — Switch to Live Mode

1. In your app, top left, switch from **Development** to **Live**
2. Facebook will prompt you to complete app review

### Step 9.2 — Complete App Review

1. Go to **App Review** → **Permissions and Features**
2. Request these permissions:
   - `pages_messaging` — to send/receive messages
   - `pages_manage_posts` — to post to your page
   - `pages_read_engagement` — to read engagement
3. For each permission:
   - Click **Request**
   - Explain how you use it (e.g., "We use messaging to communicate with clients about their CCTV installation jobs")
   - Provide a screencast showing the feature in action
4. Submit for review

### Step 9.3 — While Waiting for Review

Your app still works for:

- You and your team (as admins/moderators of the page)
- People who message your page for the first time (24-hour window)

---

## Troubleshooting

### "Invalid OAuth Redirect URI" error

- Go to **Facebook Login** → **Settings**
- Add your n8n URL to **Valid OAuth Redirect URIs**

### Webhook verification fails

- Ensure HTTPS (Facebook requires it)
- Verify token matches exactly in both places
- Check n8n is publicly accessible
- Check n8n logs for errors

### Messages not sending

1. Check token has `pages_messaging` permission
2. Verify Page ID is correct
3. Check token hasn't expired (tokens expire after 60 days)
4. Test with Graph API Explorer

### Lead Ads not triggering

1. Verify `leads` event is subscribed
2. Check the Lead Ad form is published
3. Test with the form preview feature

### Posts not appearing

1. Check token has `pages_manage_posts` permission
2. Verify Page ID is correct
3. Check if your app is in Live mode (required for public posts)

### Token expired

1. Go to Graph API Explorer
2. Generate a new token
3. Update `FB_PAGE_ACCESS_TOKEN` in n8n
4. Restart n8n container

---

## Quick Checklist

- [ ] Facebook App created (Business type)
- [ ] Facebook Page created (or existing)
- [ ] Messenger product added
- [ ] Page Access Token generated and saved
- [ ] Verify Token created (`KosaiFBVerify2024!Secure`)
- [ ] Webhook subscribed (messages + postbacks)
- [ ] n8n environment variables set
- [ ] WF11 activated and tested
- [ ] Lead Ads form created (if using WF12)
- [ ] WF12 activated and tested
- [ ] WF13 activated and tested
- [ ] App review submitted (for production)

---

## Environment Variables Summary

```bash
# Facebook — add to n8n environment
FB_PAGE_ACCESS_TOKEN=EAAIxxxxxxxxxxxxxx...
FB_PAGE_ID=123456789012345
FB_VERIFY_TOKEN=KosaiFBVerify2024!Secure
```

---

## Webhook URLs

| Purpose   | URL Path                            |
| --------- | ----------------------------------- |
| Messenger | `/webhook/kosai/facebook/messenger` |
| Lead Ads  | `/webhook/kosai/facebook/leads`     |
| Job Posts | `/webhook/kosai/facebook/job-post`  |

Full URL: `https://your-public-url` + path
