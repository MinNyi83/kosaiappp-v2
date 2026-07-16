import { getCorsHeaders } from "./cors.js";

/**
 * Return a JSON response with CORS headers.
 */
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...getCorsHeaders() },
  });
}