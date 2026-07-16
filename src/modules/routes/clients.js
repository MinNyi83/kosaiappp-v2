/**
 * Clients Routes — CRUD + search for client records
 */

import { success, error } from "../utils/response.js";
import { verifyToken } from "../utils/jwt.js";

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    return verifyToken(authHeader.slice(7));
  }

  // ── GET /api/clients ──────────────────────────────────────────────────
  router.get("/api/clients", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page")) || 1;
      const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
      const offset = (page - 1) * limit;

      let query = "SELECT * FROM clients WHERE 1=1";
      const params = [];
      let countQuery = "SELECT COUNT(*) as total FROM clients WHERE 1=1";
      const countParams = [];

      if (search) {
        const like = `%${search}%`;
        query += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?)";
        params.push(like, like, like, like);
        countQuery += " AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?)";
        countParams.push(like, like, like, like);
      }

      query += " ORDER BY name ASC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [clientsResult, countResult] = await Promise.all([
        db.prepare(query).bind(...params).all(),
        db.prepare(countQuery).bind(...countParams).first(),
      ]);

      return success({
        clients: clientsResult.results,
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit),
      });
    } catch (err) {
      return error("Failed to fetch clients: " + err.message, 500);
    }
  });

  // ── GET /api/clients/:id ──────────────────────────────────────────────
  router.get("/api/clients/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const client = await db
        .prepare("SELECT * FROM clients WHERE id = ?")
        .bind(params.id)
        .first();

      if (!client) return error("Client not found", 404);
      return success(client);
    } catch (err) {
      return error("Failed to fetch client: " + err.message, 500);
    }
  });

  // ── POST /api/clients ─────────────────────────────────────────────────
  router.post("/api/clients", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const { name, phone, email, address, notes } = body;

      if (!name || !phone) {
        return error("Missing required fields: name, phone", 400);
      }

      const id = "CLT-" + Date.now().toString(36).toUpperCase();

      await db
        .prepare(
          "INSERT INTO clients (id, name, phone, email, address, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(id, name, phone, email || null, address || null, notes || null, user.id)
        .run();

      return success({ id, name, phone, email: email || null }, 201);
    } catch (err) {
      return error("Failed to create client: " + err.message, 500);
    }
  });

  // ── PUT /api/clients/:id ──────────────────────────────────────────────
  router.put("/api/clients/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const { name, phone, email, address, notes } = body;

      const existing = await db
        .prepare("SELECT id FROM clients WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Client not found", 404);

      const updates = [];
      const values = [];
      if (name !== undefined) { updates.push("name = ?"); values.push(name); }
      if (phone !== undefined) { updates.push("phone = ?"); values.push(phone); }
      if (email !== undefined) { updates.push("email = ?"); values.push(email); }
      if (address !== undefined) { updates.push("address = ?"); values.push(address); }
      if (notes !== undefined) { updates.push("notes = ?"); values.push(notes); }

      if (updates.length === 0) return error("No fields to update", 400);

      updates.push("updated_at = datetime('now')");
      values.push(params.id);

      await db
        .prepare(`UPDATE clients SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: "Client updated" });
    } catch (err) {
      return error("Failed to update client: " + err.message, 500);
    }
  });

  // ── DELETE /api/clients/:id ───────────────────────────────────────────
  router.delete("/api/clients/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const existing = await db
        .prepare("SELECT id FROM clients WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Client not found", 404);

      await db.prepare("DELETE FROM clients WHERE id = ?").bind(params.id).run();
      return success({ message: "Client deleted" });
    } catch (err) {
      return error("Failed to delete client: " + err.message, 500);
    }
  });
}

export default { register };