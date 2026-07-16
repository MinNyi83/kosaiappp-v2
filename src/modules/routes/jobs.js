/**
 * Jobs Routes — CRUD, dispatch, status updates, photo uploads, scheduling
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

  // ── GET /api/jobs ─────────────────────────────────────────────────────
  router.get("/api/jobs", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const techId = url.searchParams.get("technician_id");
      const clientId = url.searchParams.get("client_id");
      const dateFrom = url.searchParams.get("date_from");
      const dateTo = url.searchParams.get("date_to");
      const search = url.searchParams.get("search");
      const page = parseInt(url.searchParams.get("page")) || 1;
      const limit = Math.min(parseInt(url.searchParams.get("limit")) || 50, 200);
      const offset = (page - 1) * limit;

      let query = "SELECT j.*, c.name as client_name, c.phone as client_phone, c.address as client_address FROM jobs j LEFT JOIN clients c ON j.client_id = c.id WHERE 1=1";
      const params = [];
      let countQuery = "SELECT COUNT(*) as total FROM jobs j WHERE 1=1";
      const countParams = [];

      if (status) {
        query += " AND j.status = ?";
        params.push(status);
        countQuery += " AND j.status = ?";
        countParams.push(status);
      }
      if (techId) {
        query += " AND j.assigned_to = ?";
        params.push(techId);
        countQuery += " AND j.assigned_to = ?";
        countParams.push(techId);
      }
      if (clientId) {
        query += " AND j.client_id = ?";
        params.push(clientId);
        countQuery += " AND j.client_id = ?";
        countParams.push(clientId);
      }
      if (dateFrom) {
        query += " AND j.scheduled_date >= ?";
        params.push(dateFrom);
        countQuery += " AND j.scheduled_date >= ?";
        countParams.push(dateFrom);
      }
      if (dateTo) {
        query += " AND j.scheduled_date <= ?";
        params.push(dateTo);
        countQuery += " AND j.scheduled_date <= ?";
        countParams.push(dateTo);
      }
      if (search) {
        const like = `%${search}%`;
        query += " AND (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)";
        params.push(like, like, like);
        countQuery += " AND (j.title LIKE ? OR j.description LIKE ? OR c.name LIKE ?)";
        countParams.push(like, like, like);
      }

      // Non-admin see only their own jobs
      if (user.role !== "admin") {
        query += " AND j.assigned_to = ?";
        params.push(user.id);
        countQuery += " AND j.assigned_to = ?";
        countParams.push(user.id);
      }

      query += " ORDER BY j.scheduled_date DESC, j.created_at DESC LIMIT ? OFFSET ?";
      params.push(limit, offset);

      const [jobsResult, countResult] = await Promise.all([
        db.prepare(query).bind(...params).all(),
        db.prepare(countQuery).bind(...countParams).first(),
      ]);

      return success({
        jobs: jobsResult.results,
        total: countResult.total,
        page,
        limit,
        totalPages: Math.ceil(countResult.total / limit),
      });
    } catch (err) {
      return error("Failed to fetch jobs: " + err.message, 500);
    }
  });

  // ── GET /api/jobs/active ──────────────────────────────────────────────
  router.get("/api/jobs/active", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const activeStatuses = ["pending", "assigned", "in_progress", "on_hold"];
      let query = "SELECT j.*, c.name as client_name, c.phone as client_phone, c.address as client_address FROM jobs j LEFT JOIN clients c ON j.client_id = c.id WHERE j.status IN (?, ?, ?, ?)";
      const params = [...activeStatuses];

      if (user.role !== "admin") {
        query += " AND j.assigned_to = ?";
        params.push(user.id);
      }

      query += " ORDER BY j.priority DESC, j.scheduled_date ASC";

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error("Failed to fetch active jobs: " + err.message, 500);
    }
  });

  // ── GET /api/jobs/:id ─────────────────────────────────────────────────
  router.get("/api/jobs/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const job = await db
        .prepare("SELECT j.*, c.name as client_name, c.phone as client_phone, c.address as client_address FROM jobs j LEFT JOIN clients c ON j.client_id = c.id WHERE j.id = ?")
        .bind(params.id)
        .first();

      if (!job) return error("Job not found", 404);

      // Non-admin can only view their own jobs
      if (user.role !== "admin" && job.assigned_to !== user.id) {
        return error("Forbidden", 403);
      }

      return success(job);
    } catch (err) {
      return error("Failed to fetch job: " + err.message, 500);
    }
  });

  // ── POST /api/jobs ────────────────────────────────────────────────────
  router.post("/api/jobs", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const { title, description, client_id, scheduled_date, priority, job_type, notes } = body;

      if (!title || !client_id) {
        return error("Missing required fields: title, client_id", 400);
      }

      const id = "JOB-" + Date.now().toString(36).toUpperCase();

      await db
        .prepare(
          "INSERT INTO jobs (id, title, description, client_id, assigned_to, scheduled_date, priority, status, job_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)"
        )
        .bind(
          id, title, description || null, client_id,
          body.assigned_to || user.id,
          scheduled_date || new Date().toISOString().split("T")[0],
          priority || "normal", job_type || "standard",
          notes || null, user.id
        )
        .run();

      return success({ id, title, status: "pending" }, 201);
    } catch (err) {
      return error("Failed to create job: " + err.message, 500);
    }
  });

  // ── PUT /api/jobs/:id ─────────────────────────────────────────────────
  router.put("/api/jobs/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const body = await request.json();
      const existing = await db
        .prepare("SELECT * FROM jobs WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Job not found", 404);

      if (user.role !== "admin" && existing.assigned_to !== user.id) {
        return error("Forbidden", 403);
      }

      const allowed = ["title", "description", "client_id", "assigned_to", "scheduled_date", "priority", "status", "job_type", "notes"];
      const updates = [];
      const values = [];

      for (const field of allowed) {
        if (body[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(body[field]);
        }
      }

      if (updates.length === 0) return error("No fields to update", 400);

      updates.push("updated_at = datetime('now')");
      values.push(params.id);

      await db
        .prepare(`UPDATE jobs SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return success({ message: "Job updated" });
    } catch (err) {
      return error("Failed to update job: " + err.message, 500);
    }
  });

  // ── DELETE /api/jobs/:id ──────────────────────────────────────────────
  router.delete("/api/jobs/:id", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);
      if (user.role !== "admin") return error("Forbidden: admin only", 403);

      const existing = await db
        .prepare("SELECT id FROM jobs WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Job not found", 404);

      await db.prepare("DELETE FROM jobs WHERE id = ?").bind(params.id).run();
      return success({ message: "Job deleted" });
    } catch (err) {
      return error("Failed to delete job: " + err.message, 500);
    }
  });

  // ── POST /api/jobs/:id/status ─────────────────────────────────────────
  router.post("/api/jobs/:id/status", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const { status, notes } = await request.json();
      if (!status) return error("Missing status", 400);

      const validStatuses = ["pending", "assigned", "in_progress", "completed", "cancelled", "on_hold"];
      if (!validStatuses.includes(status)) {
        return error(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, 400);
      }

      const existing = await db
        .prepare("SELECT * FROM jobs WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Job not found", 404);

      if (user.role !== "admin" && existing.assigned_to !== user.id) {
        return error("Forbidden", 403);
      }

      await db
        .prepare("UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(status, params.id)
        .run();

      // Log status change
      await db
        .prepare(
          "INSERT INTO job_log (job_id, previous_status, new_status, notes, changed_by) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(params.id, existing.status, status, notes || null, user.id)
        .run();

      return success({ id: params.id, previous_status: existing.status, new_status: status });
    } catch (err) {
      return error("Failed to update job status: " + err.message, 500);
    }
  });

  // ── POST /api/jobs/:id/photos ─────────────────────────────────────────
  router.post("/api/jobs/:id/photos", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const existing = await db
        .prepare("SELECT id FROM jobs WHERE id = ?")
        .bind(params.id)
        .first();
      if (!existing) return error("Job not found", 404);

      const formData = await request.formData();
      const photo = formData.get("photo");
      if (!photo) return error("Missing photo file", 400);

      // Store photo metadata in DB (actual file storage depends on your setup)
      const photoId = "PHOTO-" + Date.now().toString(36).toUpperCase();
      await db
        .prepare(
          "INSERT INTO job_photos (id, job_id, file_name, file_type, file_size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(photoId, params.id, photo.name, photo.type, photo.size, user.id)
        .run();

      return success({ id: photoId, message: "Photo uploaded" }, 201);
    } catch (err) {
      return error("Failed to upload photo: " + err.message, 500);
    }
  });

  // ── GET /api/jobs/:id/photos ──────────────────────────────────────────
  router.get("/api/jobs/:id/photos", async (request, params) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const photos = await db
        .prepare("SELECT * FROM job_photos WHERE job_id = ? ORDER BY created_at DESC")
        .bind(params.id)
        .all();

      return success(photos.results);
    } catch (err) {
      return error("Failed to fetch photos: " + err.message, 500);
    }
  });

  // ── GET /api/jobs/calendar ────────────────────────────────────────────
  router.get("/api/jobs/calendar", async (request) => {
    try {
      const user = await authenticate(request);
      if (!user) return error("Unauthorized", 401);

      const url = new URL(request.url);
      const dateFrom = url.searchParams.get("date_from") || new Date().toISOString().split("T")[0];
      const dateTo = url.searchParams.get("date_to");

      let query = "SELECT j.id, j.title, j.status, j.priority, j.scheduled_date, j.assigned_to, t.name as technician_name, c.name as client_name FROM jobs j LEFT JOIN technicians t ON j.assigned_to = t.id LEFT JOIN clients c ON j.client_id = c.id WHERE j.scheduled_date >= ?";
      const params = [dateFrom];

      if (dateTo) {
        query += " AND j.scheduled_date <= ?";
        params.push(dateTo);
      }
      if (user.role !== "admin") {
        query += " AND j.assigned_to = ?";
        params.push(user.id);
      }

      query += " ORDER BY j.scheduled_date ASC, j.priority DESC";

      const result = await db.prepare(query).bind(...params).all();
      return success(result.results);
    } catch (err) {
      return error("Failed to fetch calendar: " + err.message, 500);
    }
  });
}

export { register };