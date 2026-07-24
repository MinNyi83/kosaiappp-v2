/**
 * CSRF protection utility.
 * Generates and validates CSRF tokens for state-changing endpoints.
 * Tokens are short-lived (15 min) and bound to the user's session.
 */

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET;

function getCsrfSecret(): string {
  if (!CSRF_SECRET) {
    throw new Error('CSRF_SECRET or JWT_SECRET must be defined in environment variables');
  }
  return CSRF_SECRET;
}

/**
 * Generate a CSRF token for a user session
 */
export async function generateCsrfToken(userId: string): Promise<string> {
  const payload = {
    csrf: true,
    uid: userId,
    iat: Math.floor(Date.now() / 1000),
  };
  const data = JSON.stringify(payload);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getCsrfSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return btoa(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '.' + sigB64;
}

/**
 * Validate a CSRF token
 */
export async function validateCsrfToken(token: string, userId: string): Promise<boolean> {
  if (!token) return false;
  try {
    const [dataB64, sigB64] = token.split('.');
    if (!dataB64 || !sigB64) return false;

    const data = atob(dataB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(data);

    // Check token is for CSRF and matches user
    if (!payload.csrf || payload.uid !== userId) return false;

    // Check expiration (15 minutes)
    const age = Math.floor(Date.now() / 1000) - payload.iat;
    if (age > 900) return false;

    // Verify signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(getCsrfSecret()),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(data));
  } catch {
    return false;
  }
}

/**
 * Middleware: validate CSRF token for POST/PUT/DELETE requests
 */
export async function requireCsrf(request: Request, userId: string): Promise<boolean> {
  // Only check state-changing methods
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const csrfToken = request.headers.get('X-CSRF-Token');
  return await validateCsrfToken(csrfToken, userId);
}
