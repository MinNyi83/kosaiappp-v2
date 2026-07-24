// src/modules/utils/jwt.ts — HMAC-SHA256 JWT implementation
const JWT_SECRET = process.env.JWT_SECRET;

function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return JWT_SECRET;
}

function base64UrlEncode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  return new Uint8Array([...binary].map((c) => c.charCodeAt(0)));
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getJwtSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

/**
 * Sign a JWT token with HMAC-SHA256
 */
export const signToken = async (payload: any, expiresIn: string | number = '24h'): Promise<string> => {
  const header = { alg: 'HS256', typ: 'JWT' };

  let expSeconds = Math.floor(Date.now() / 1000) + 86400; // default 24 hours
  if (typeof expiresIn === 'string') {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);
    switch (unit) {
      case 's': expSeconds = Math.floor(Date.now() / 1000) + value; break;
      case 'm': expSeconds = Math.floor(Date.now() / 1000) + value * 60; break;
      case 'h': expSeconds = Math.floor(Date.now() / 1000) + value * 3600; break;
      case 'd': expSeconds = Math.floor(Date.now() / 1000) + value * 86400; break;
    }
  } else if (typeof expiresIn === 'number') {
    expSeconds = Math.floor(Date.now() / 1000) + expiresIn;
  }

  const payloadToSign = { ...payload, exp: expSeconds };
  const encodedHeader = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payloadToSign)));

  const key = await getKey();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
  );

  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(new Uint8Array(signature))}`;
};

/**
 * Verify a JWT token with HMAC-SHA256
 * Returns decoded payload if valid, null if invalid/expired/tampered
 */
export const verifyToken = async (token: string): Promise<any> => {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  try {
    // Verify signature
    const key = await getKey();
    const signatureBytes = base64UrlDecode(encodedSignature);
    const dataBytes = new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes.buffer as ArrayBuffer,
      dataBytes
    );

    if (!valid) return null;

    // Decode payload
    const payloadBytes = base64UrlDecode(encodedPayload);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
};
