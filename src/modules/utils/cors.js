/**
 * CORS headers for cross-origin requests.
 * Returns a plain object of header key-value pairs.
 */
export function getCorsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Secret",
    "Access-Control-Max-Age": "86400",
  };

  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a 204 Response with CORS headers, or null for non-OPTIONS requests.
 */
export function handleCorsRequest(request, env) {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("Origin") || "*";
  const corsHeaders = getCorsHeaders(origin);

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}