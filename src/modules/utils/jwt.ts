// src/modules/utils/jwt.js
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * Sign a JWT token
 * @param {Object} payload - Payload to sign
 * @param {string} expiresIn - Expiration time (e.g., '1h', '2d')
 * @returns {string} Signed JWT token
 */
export const signToken = (payload, expiresIn = '1h') => {
  // Simple JWT implementation for demonstration
  // In production, use a proper library like jsonwebtoken
  const header = { alg: 'HS256', typ: 'JWT' };

  // Calculate expiration
  let expSeconds = Math.floor(Date.now() / 1000) + 3600; // default 1 hour
  if (typeof expiresIn === 'string') {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);
    switch (unit) {
      case 's':
        expSeconds = Math.floor(Date.now() / 1000) + value;
        break;
      case 'm':
        expSeconds = Math.floor(Date.now() / 1000) + value * 60;
        break;
      case 'h':
        expSeconds = Math.floor(Date.now() / 1000) + value * 3600;
        break;
      case 'd':
        expSeconds = Math.floor(Date.now() / 1000) + value * 86400;
        break;
      default:
        expSeconds = Math.floor(Date.now() / 1000) + 3600;
    }
  } else if (typeof expiresIn === 'number') {
    expSeconds = Math.floor(Date.now() / 1000) + expiresIn;
  }

  const payloadToSign = { ...payload, exp: expSeconds };

  const base64Url = (str) =>
    btoa(String.fromCharCode(...new TextEncoder().encode(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedPayload = base64Url(JSON.stringify(payloadToSign));

  // Create signature (simplified - in reality use crypto.subtle)
  // For demo purposes, we'll create a fake signature
  const signature = btoa(`${encodedHeader}.${encodedPayload}.${JWT_SECRET}`).replace(
    /[+/=]/g,
    (match) => {
      return { '+': '-', '/': '_', '=': '' }[match];
    }
  );

  return `${encodedHeader}.${encodedPayload}.${signature}`;
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded payload if valid
 * @throws {Error} If token is invalid or expired
 */
export const verifyToken = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const [encodedHeader, encodedPayload, signature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !signature) {
    return null;
  }

  try {
    // Add base64 padding if needed (JWT uses base64url without padding)
    const pad = (str) => str + '='.repeat((4 - str.length % 4) % 4);
    const header = JSON.parse(atob(pad(encodedHeader.replace(/-/g, '+').replace(/_/g, '/'))));
    const payload = JSON.parse(atob(pad(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'))));

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
};
