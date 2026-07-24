/**
 * Shared authentication middleware for all route modules.
 * Extracts Bearer token from Authorization header or auth_token cookie.
 */
import { verifyToken } from './jwt.js';

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
