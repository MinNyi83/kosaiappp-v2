/**
 * Telegram notification helpers.
 */

export async function sendTelegramNotification(env, text) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text, parse_mode: 'Markdown' }),
    });
    const data = (await res.json()) as any;
    if (!data.ok) {
      console.error('Telegram sendTelegramNotification failed:', data.description);
    }
  } catch (e) {
    console.error('Failed to send Telegram notification:', e.message);
  }
}

export async function sendTelegramMessage(env, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    const data = (await res.json()) as any;
    if (!data.ok) {
      console.error('Telegram sendTelegramMessage failed:', data.description);
    }
  } catch (e) {
    console.error('Failed to send Telegram message:', e.message);
  }
}

export async function sendTelegramPhotoNotification(env, photoSource, caption) {
  try {
    let uint8;
    let contentType = 'image/jpeg';

    if (photoSource.startsWith('data:')) {
      // Base64 data URI path
      const parts = photoSource.split(',');
      if (parts.length < 2) { console.warn('Invalid data URI'); return; }
      contentType = parts[0].split(':')[1].split(';')[0] || 'image/jpeg';
      const base64Str = parts[1].replace(/\s/g, '');
      try {
        if (typeof Buffer !== 'undefined') {
          uint8 = new Uint8Array(Buffer.from(base64Str, 'base64'));
        } else {
          const binaryStr = atob(base64Str);
          uint8 = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) uint8[i] = binaryStr.charCodeAt(i);
        }
      } catch (e) {
        console.error('Failed to decode base64 photo:', e.message);
        return;
      }
    } else if (photoSource.startsWith('https://')) {
      // Google Drive URL — use Drive API to download
      const { getGoogleAccessToken } = await import('./google.js');
      const token = await getGoogleAccessToken(env);

      // Extract file ID from Drive URL
      const fileIdMatch = photoSource.match(/[?&]id=([^&]+)/);
      if (fileIdMatch && token) {
        const fileId = fileIdMatch[1];
        const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (imgRes.ok) {
          contentType = imgRes.headers.get('content-type') || 'image/jpeg';
          uint8 = new Uint8Array(await imgRes.arrayBuffer());
        } else {
          console.error('Drive API download failed:', imgRes.status);
          // Fallback: send as text link
          await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: env.TELEGRAM_CHAT_ID,
              text: `${caption || '📸 Photo'}\n[View on Google Drive](${photoSource})`,
              parse_mode: 'Markdown',
            }),
          });
          return;
        }
      } else {
        // No token or no file ID — send as text link
        await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: env.TELEGRAM_CHAT_ID,
            text: `${caption || '📸 Photo'}\n[View on Google Drive](${photoSource})`,
            parse_mode: 'Markdown',
          }),
        });
        return;
      }
    } else {
      console.warn('sendTelegramPhotoNotification: unrecognized photo source format');
      return;
    }

    const blob = new Blob([uint8], { type: contentType });

    // Send as Photo (for inline preview) — no parse_mode to avoid emoji issues
    const formData = new FormData();
    formData.append('chat_id', env.TELEGRAM_CHAT_ID);
    formData.append('photo', blob, 'photo.jpg');
    if (caption) {
      formData.append('caption', caption);
    }

    const res = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`, {
      method: 'POST',
      body: formData,
    });
    const resData = (await res.json()) as any;

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
      const docRes = await fetch(
        `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`,
        {
          method: 'POST',
          body: docFormData,
        }
      );
      const docResData = (await docRes.json()) as any;
      if (!docResData.ok) {
        console.error('Telegram sendDocument fallback also failed:', docResData.description);
      }
    }
  } catch (e) {
    console.error('Failed to send Telegram photo/document:', e.message);
  }
}

export function arrayBufferToBase64(buffer) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
