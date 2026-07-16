/**
 * Telegram notification helpers.
 */

export async function sendTelegramNotification(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendTelegramNotification failed:", data.description);
    }
  } catch(e) {
    console.error("Failed to send Telegram notification:", e.message);
  }
}

export async function sendTelegramMessage(env, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
    const data = await res.json();
    if (!data.ok) {
      console.error("Telegram sendTelegramMessage failed:", data.description);
    }
  } catch(e) {
    console.error("Failed to send Telegram message:", e.message);
  }
}

export async function sendTelegramPhotoNotification(env, photoSource, caption) {
  try {
    let uint8;
    let contentType = 'image/jpeg';

    if (photoSource.startsWith('data:')) {
      // Legacy Base64 data URI path
      const parts = photoSource.split(',');
      if (parts.length < 2) return;
      contentType = parts[0].split(':')[1].split(';')[0];
      const base64Str = parts[1];
      if (typeof Buffer !== 'undefined') {
        uint8 = new Uint8Array(Buffer.from(base64Str, 'base64'));
      } else {
        const binaryStr = atob(base64Str);
        uint8 = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) uint8[i] = binaryStr.charCodeAt(i);
      }
    } else if (photoSource.startsWith('https://')) {
      // Google Drive URL — fetch image bytes using OAuth token
      const { getGoogleAccessToken } = await import('./google.js');
      const token = await getGoogleAccessToken(env);
      const fetchHeaders = token ? { Authorization: `Bearer ${token}` } : {};
      const imgRes = await fetch(photoSource, { headers: fetchHeaders });
      if (!imgRes.ok) {
        console.error('Failed to fetch photo from Drive for Telegram:', imgRes.status, photoSource);
        // Fallback: send as text link instead
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `${caption || '📸 Photo'}\n[View on Google Drive](${photoSource})`,
            parse_mode: 'Markdown'
          })
        });
        return;
      }
      contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      uint8 = new Uint8Array(await imgRes.arrayBuffer());
    } else {
      console.warn('sendTelegramPhotoNotification: unrecognized photo source format');
      return;
    }

    const blob = new Blob([uint8], { type: contentType });

    // Try sending as Photo first (for inline preview)
    const formData = new FormData();
    formData.append('chat_id', env.TELEGRAM_CHAT_ID);
    formData.append('photo', blob, 'photo.jpg');
    if (caption) {
      formData.append('caption', caption);
      formData.append('parse_mode', 'Markdown');
    }

    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData
    });
    const resData = await res.json();

    // If photo processing fails (e.g., HEIC, unsupported format, or too large), fallback to sendDocument
    if (!resData.ok) {
      console.warn('Telegram sendPhoto failed, trying sendDocument fallback:', resData.description);
      const docFormData = new FormData();
      docFormData.append('chat_id', env.TELEGRAM_CHAT_ID);
      let extension = 'jpg';
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('gif')) extension = 'gif';
      else if (contentType.includes('heic')) extension = 'heic';
      docFormData.append('document', blob, `photo.${extension}`);
      if (caption) {
        docFormData.append('caption', caption);
        docFormData.append('parse_mode', 'Markdown');
      }
      const docRes = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
        method: 'POST',
        body: docFormData
      });
      const docResData = await docRes.json();
      if (!docResData.ok) {
        console.error('Telegram sendDocument fallback also failed:', docResData.description);
      }
    }
  } catch(e) {
    console.error('Failed to send Telegram photo/document:', e.message);
  }
}

export function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}