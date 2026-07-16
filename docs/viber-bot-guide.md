# Viber Bot Setup Guide

This guide explains how to create a Viber Bot (Public Account), obtain your Authentication Token, find your Viber User ID, and link it to your CCTV Service System.

---

## Step 1: Create a Viber Bot / Public Account

1. Go to the [**Viber Admin Panel**](https://partners.viber.com) and log in with your Viber phone number.
2. Click **Create Bot Account** on the left sidebar.
3. Fill out the required details:
   - **Account Name**: e.g., `CCTV Service System`
   - **Category & Subcategory**: Select appropriate categories (e.g., Local Business).
   - **Language**: English
   - **Description**: Notification bot for FSM dispatches.
   - **Email Address**: Your email.
4. Click **Create** at the bottom.

---

## Step 2: Retrieve the Authentication Token

1. Once the account is created, you will see your **Token** (a long string of numbers and letters, e.g., `4edd81f2113abc12-abcde12345-123456`).
2. Copy this token. This will be your `VIBER_BOT_TOKEN`.

---

## Step 3: Find Your Viber User ID (Receiver ID)

Viber requires a specific **User ID** (Receiver ID) to send messages to a user. This is _not_ your phone number. To get your User ID:

1. Scan the QR code of your new Viber Bot to subscribe to it.
2. Send any test message to your bot.
3. To retrieve your User ID from that message, you can view the webhook logs or use a utility bot like the public Viber bot `@userinfo` (or similar) to capture your Viber ID.
4. The ID will look like this: `v0c3+1d2a3b4c5d6e7f8g==`. Copy it. This will be your `VIBER_RECEIVER_ID`.

---

## Step 4: Link Credentials to Your Worker

### For Local Development (`.dev.vars`)

Add the credentials to your [**.dev.vars**](file:///d:/kosai-project/v2/.dev.vars) file:

```env
VIBER_BOT_TOKEN="your_copied_viber_token"
VIBER_RECEIVER_ID="your_copied_viber_receiver_id"
```

### For Production (Cloudflare Worker Secrets)

Run these commands in your project terminal:

```powershell
npx wrangler secret put VIBER_BOT_TOKEN
npx wrangler secret put VIBER_RECEIVER_ID
```

_(Wrangler will prompt you to enter the copied values securely)_
