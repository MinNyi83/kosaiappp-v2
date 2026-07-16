/**
 * Service Fees Routes — Manage service fee catalog
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

  // ── GET /api/service-fees ─────────────────────────────────────────────
  router.get("/api/service-fees", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const category = url.searchParams.get("category");
      const active = url.searchParams.get("active");

      let query = "SELECT * FROM service_fees WHERE 1=1";
      const params = [];

      if (category) { query += " AND category = ?"; params.push(category); }
      if (active !== null) { query += " AND active = ?"; params.push(active === "true" ? 1 : 0); }

      query += " ORDER BY category ASC, name ASC";
      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error("Failed to fetch service fees: " + err.message, 500);
    }
  });

  // ── POST /api/service-fees ────────────────────────────────────────────
  router.post("/api/service-fees", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);
      if (user.role !== "admin") return error("Forbidden: admin only", 403);

      const { name, category, price, description } = await request.json();
      if (!name || !category || !price) return error("Missing name, category, or price", 400);

      const id = "FEE-" + Date.now().toString(36).toUpperCase();
      await db
        .prepare("INSERT INTO service_fees (id, name, category, price, description, active) VALUES (?, ?, ?, ?, ?, 1)")
        .bind(id, name, category, price, description || null)
        .run();

      return success({ id, name, category, price }, 201);
    } catch (err) {
      return error("Failed to create service fee: " + err.message, 500);
    }
  });

  // ── PUT /api/service-fees/:id ─────────────────────────────────────────
  router.put("/api/service-fees/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);
      if (user.role !== "admin") return error("Forbidden: admin only", 403);

      const body = await request.json();
      const allowed = ["name", "category", "price", "description", "active"];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error("No fields to update", 400);
      values.push(params.id);

      await db
        .prepare(`UPDATE service_fees SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: "Service fee updated" });
    } catch (err) {
      return error("Failed to update service fee: " + err.message, 500);
    }
  });

  // ── DELETE /api/service-fees/:id ──────────────────────────────────────
  router.delete("/api/service-fees/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);
      if (user.role !== "admin") return error("Forbidden: admin only", 403);

      await db.prepare("DELETE FROM service_fees WHERE id = ?").bind(params.id).run();
      return success({ message: "Service fee deleted" });
    } catch (err) {
      return error("Failed to delete service fee: " + err.message, 500);
    }
  });
}

export { register };