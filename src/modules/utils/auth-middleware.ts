/**
 * Shared authentication middleware for all route modules.
 * Extracts Bearer token from Authorization header or auth_token cookie.
 */
import { verifyToken } from './jwt.js';
import { validateCsrfToken } from './csrf.js';

export async function authenticate(request: Request): Promise<any> {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return await verifyToken(authHeader.slice(7));
  }

  // Fallback to auth_token cookie (httpOnly, secure)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(';').map(c => {
        const [key, ...val] = c.trim().split('=');
        return [key, val.join('=')];
      })
    );
    if (cookies.auth_token) {
      return await verifyToken(cookies.auth_token);
    }
  }

  return null;
}

/**
 * Require CSRF token for state-changing requests (POST, PUT, DELETE).
 * Returns true if valid, false if invalid.
 */
export async function requireCsrf(request: Request, userId: string): Promise<boolean> {
  const method = request.method.toUpperCase();
  // Safe methods don't need CSRF protection
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

  const csrfToken = request.headers.get('X-CSRF-Token');
  if (!csrfToken) return false;

  return await validateCsrfToken(csrfToken, userId);
}
