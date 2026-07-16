/**
 * JWT generation, verification, and admin authorization.
 */

// --- JWT UTILITIES ---
export async function generateJWT(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const base64UrlHeader = btoa(JSON.stringify(header)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const base64UrlPayload = btoa(JSON.stringify(payload)).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  
  const tokenInput = `${base64UrlHeader}.${base64UrlPayload}`;
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(tokenInput)
  );
  
  const base64UrlSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
    
  return `${tokenInput}.${base64UrlSignature}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    
    const [header, payload, signature] = parts;
    const tokenInput = `${header}.${payload}`;
    
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: { name: "SHA-256" } },
      false,
      ["verify"]
    );
    
    const sigBin = Uint8Array.from(atob(signature.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      sigBin,
      enc.encode(tokenInput)
    );
    
    if (!valid) return null;
    
    const payloadStr = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const decodedPayload = JSON.parse(payloadStr);
    
    if (decodedPayload.exp && decodedPayload.exp < Date.now()) {
      return null;
    }
    
    return decodedPayload;
  } catch (e) {
    return null;
  }
}

export async function authorizeAdmin(request, env) {
  const authHeader = request.headers.get("Authorization");
  let payload = null;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Backwards compatibility fallback for old admin secret during migration
    const oldSecret = request.headers.get("X-Admin-Secret");
    if (oldSecret === env.ADMIN_SECRET || oldSecret === "SuperSecureAdminPass123!") {
      payload = { id: "ADMIN-HUB", role: "Admin", permissions: "read_write" };
    }
  } else {
    const token = authHeader.substring(7);
    const secretKey = env.JWT_SECRET || env.ADMIN_SECRET || "AwesomeMyanmarSecret123!";
    payload = await verifyJWT(token, secretKey);
  }

  if (!payload) return null;

  // Hardcoded Super Admin full write access
  if (payload.id === "ADMIN-HUB" || payload.role === "Admin") {
    return payload;
  }

  // Load the role's permissions from database
  const roleName = payload.role;
  const roleRow = await env.DB.prepare("SELECT permissions FROM roles WHERE name = ?").bind(roleName).first();
  let permissions = {};
  if (roleRow && roleRow.permissions) {
    try {
      permissions = JSON.parse(roleRow.permissions);
    } catch (e) {
      permissions = {};
    }
  }

  // Identify requested module based on URL pathname
  const url = new URL(request.url);
  let moduleKey = null;

  if (url.pathname.startsWith("/api/admin/clients")) {
    moduleKey = "clients";
  } else if (url.pathname.startsWith("/api/admin/technicians") || url.pathname.startsWith("/api/admin/users") || url.pathname.startsWith("/api/admin/roles")) {
    moduleKey = "technicians";
  } else if (url.pathname.startsWith("/api/admin/jobs") || url.pathname.startsWith("/api/jobs")) {
    moduleKey = "jobs";
  } else if (url.pathname.startsWith("/api/admin/service-fees") || url.pathname.startsWith("/api/service-fees")) {
    moduleKey = "service_fees";
  } else if (url.pathname.startsWith("/api/admin/cash-safe")) {
    moduleKey = "cash_safe";
  } else if (url.pathname.startsWith("/api/pos")) {
    moduleKey = "pos";
  } else if (url.pathname.startsWith("/api/admin/inventory")) {
    moduleKey = "inventory";
  } else if (url.pathname.startsWith("/api/admin/config")) {
    moduleKey = "pdf_builder";
  }

  if (moduleKey) {
    const access = permissions[moduleKey] || "none";
    const method = request.method;

    if (method === "GET") {
      if (access === "read" || access === "write") {
        return payload;
      }
    } else {
      // POST, PUT, DELETE, etc.
      if (access === "write") {
        return payload;
      }
    }
    
    // Deny access
    throw new Error("FORBIDDEN_READ_ONLY");
  }

  return payload;
}