/**
 * CORS headers for cross-origin requests.
 * Returns a plain object of header key-value pairs.
 */
const ALLOWED_ORIGINS = [
  'https://awesomemyanmar.com',
  'https://kosai-admin.pages.dev',
  'tauri://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:8787',
  'http://localhost:8787',
];

export function getCorsHeaders(origin?: string) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Secret',
    'Access-Control-Max-Age': '86400',
  };

  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  if (origin) {
    headers['Access-Control-Allow-Origin'] = allowed;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else {
    headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS[0];
  }

  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a 204 Response with CORS headers, or null for non-OPTIONS requests.
 */
export function handleCorsRequest(request, env) {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  const origin = request.headers.get('Origin') || '*';
  const corsHeaders = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

