/**
 * Shared authentication middleware for all route modules.
 * Extracts Bearer token from Authorization header and verifies JWT.
 */
import { verifyToken } from './jwt.js';

export async function authenticate(request: Request): Promise<any> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return await verifyToken(authHeader.slice(7));
}
