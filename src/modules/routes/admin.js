/**
 * Admin Routes — Admin-only operations: system config, roles, backups, AI tools
 */

import { success, error } from "../utils/response.js";
import { verifyToken } from "../utils/jwt.js";

function register(router, env) {
  const db = env.DB;

  async function authenticate(request) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
    const user = await verifyToken(authHeader.slice(7));
    if (!user || user.role !== "admin") return null;
    return user;
  }

  // ── GET /api/admin/technicians ────────────────────────────────────────
  router.get("/api/admin/technicians", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const result = await db
        .prepare("SELECT id, name, email, phone, role, specialties, active, created_at, last_login FROM technicians ORDER BY name ASC")
        .all();

      const technicians = result.results.map((t) => ({
        ...t,
        specialties: t.specialties ? JSON.parse(t.specialties) : [],
      }));

      return success(technicians);
    } catch (err) {
      return error("Failed to fetch technicians: " + err.message, 500);
    }
  });

  // ── PUT /api/admin/technicians/:id ────────────────────────────────────
  router.put("/api/admin/technicians/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const existing = await db
        .prepare("SELECT id FROM technicians WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Technician not found", 404);

      const allowed = ["name", "email", "phone", "role", "active", "specialties"];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(field === "specialties" ? JSON.stringify(body[field]) : body[field]);
        }
      }

      if (updates.length === 0) return error("No fields to update", 400);
      values.push(params.id);

      await db
        .prepare(`UPDATE technicians SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: "Technician updated" });
    } catch (err) {
      return error("Failed to update technician: " + err.message, 500);
    }
  });

  // ── DELETE /api/admin/technicians/:id ─────────────────────────────────
  router.delete("/api/admin/technicians/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      await db.prepare("DELETE FROM technicians WHERE id = ?").bind(params.id).run();
      return success({ message: "Technician deleted" });
    } catch (err) {
      return error("Failed to delete technician: " + err.message, 500);
    }
  });

  // ── GET /api/admin/clients ────────────────────────────────────────────
  router.get("/api/admin/clients", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page")) || 1;
      const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
      const offset = (page - 1) * limit;

      let query = "SELECT c.*, (SELECT COUNT(*) FROM jobs WHERE client_id = c.id) as job_count FROM clients c WHERE 1=1";
      const params = [];

      if (search) {
        const like = `%${search}%`;
        query += " AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)";
        params.push(like, like, like);
      }

      query += " ORDER BY c.name ASC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error("Failed to fetch clients: " + err.message, 500);
    }
  });

  // ── GET /api/admin/config/:key ────────────────────────────────────────
  router.get("/api/admin/config/:key", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const config = await db
        .prepare("SELECT * FROM system_config WHERE key = ?")
        .bind(params.key)
        .first();

      if (!config) return error("Config key not found", 404);
      return success(config);
    } catch (err) {
      return error("Failed to fetch config: " + err.message, 500);
    }
  });

  // ── POST /api/admin/config ────────────────────────────────────────────
  router.post("/api/admin/config", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const { key, value, description } = await request.json();
      if (!key || value === undefined) return error("Missing key or value", 400);

      await db
        .prepare(
          "INSERT INTO system_config (key, value, description, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, description = COALESCE(excluded.description, description), updated_by = excluded.updated_by, updated_at = datetime('now')"
        )
        .bind(key, typeof value === "object" ? JSON.stringify(value) : String(value), description || null, user.id)
        .run();

      return success({ key, value });
    } catch (err) {
      return error("Failed to save config: " + err.message, 500);
    }
  });

  // ── GET /api/admin/roles ──────────────────────────────────────────────
  router.get("/api/admin/roles", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const result = await db
        .prepare("SELECT * FROM roles ORDER BY name ASC")
        .all();

      return success(result.results);
    } catch (err) {
      return error("Failed to fetch roles: " + err.message, 500);
    }
  });

  // ── POST /api/admin/roles ─────────────────────────────────────────────
  router.post("/api/admin/roles", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const { name, permissions, description } = await request.json();
      if (!name) return error("Missing role name", 400);

      const id = "ROLE-" + Date.now().toString(36).toUpperCase();
      await db
        .prepare("INSERT INTO roles (id, name, permissions, description) VALUES (?, ?, ?, ?)")
        .bind(id, name, permissions ? JSON.stringify(permissions) : "[]", description || null)
        .run();

      return success({ id, name }, 201);
    } catch (err) {
      return error("Failed to create role: " + err.message, 500);
    }
  });

  // ── DELETE /api/admin/roles/:id ───────────────────────────────────────
  router.delete("/api/admin/roles/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      await db.prepare("DELETE FROM roles WHERE id = ?").bind(params.id).run();
      return success({ message: "Role deleted" });
    } catch (err) {
      return error("Failed to delete role: " + err.message, 500);
    }
  });

  // ── POST /api/admin/backup ────────────────────────────────────────────
  router.post("/api/admin/backup", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      // Export all tables to JSON
      const tables = ["technicians", "clients", "jobs", "inventory", "expenses", "attendance", "system_config"];
      const backup = {};

      for (const table of tables) {
        const result = await db.prepare(`SELECT * FROM ${table}`).all();
        backup[table] = result.results;
      }

      backup._exported_at = new Date().toISOString();
      backup._exported_by = user.id;

      return success(backup);
    } catch (err) {
      return error("Failed to create backup: " + err.message, 500);
    }
  });

  // ── POST /api/admin/restore ───────────────────────────────────────────
  router.post("/api/admin/restore", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      if (!body || !body._exported_at) return error("Invalid backup format", 400);

      const tables = ["technicians", "clients", "jobs", "inventory", "expenses", "attendance", "system_config"];
      let restored = 0;

      for (const table of tables) {
        if (Array.isArray(body[table]) && body[table].length > 0) {
          // Clear existing data
          await db.prepare(`DELETE FROM ${table}`).run();

          // Insert backup data (simplified — real impl needs column mapping)
          for (const row of body[table]) {
            const columns = Object.keys(row);
            const placeholders = columns.map(() => "?").join(", ");
            const values = columns.map((col) => row[col]);
            try {
              await db
                .prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`)
                .bind(...values)
                .run();
              restored++;
            } catch (e) {
              // Skip rows that fail (e.g. FK constraints)
              console.warn(`Skipped row in ${table}: ${e.message}`);
            }
          }
        }
      }

      return success({ message: `Restored ${restored} rows across ${tables.length} tables` });
    } catch (err) {
      return error("Failed to restore backup: " + err.message, 500);
    }
  });

  // ── GET /api/admin/stats ──────────────────────────────────────────────
  router.get("/api/admin/stats", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const [totalJobs, activeJobs, totalClients, totalTechs, totalExpenses, totalRevenue] = await Promise.all([
        db.prepare("SELECT COUNT(*) as count FROM jobs").first(),
        db.prepare("SELECT COUNT(*) as count FROM jobs WHERE status IN ('pending', 'assigned', 'in_progress')").first(),
        db.prepare("SELECT COUNT(*) as count FROM clients").first(),
        db.prepare("SELECT COUNT(*) as count FROM technicians WHERE active = 1").first(),
        db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE status = 'approved'").first(),
        db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'paid'").first(),
      ]);

      return success({
        total_jobs: totalJobs.count,
        active_jobs: activeJobs.count,
        total_clients: totalClients.count,
        active_technicians: totalTechs.count,
        total_expenses: totalExpenses.total,
        total_revenue: totalRevenue.total,
      });
    } catch (err) {
      return error("Failed to fetch stats: " + err.message, 500);
    }
  });
}

export { register };