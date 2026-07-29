/**
 * Job Service — Business logic for service records
 *
 * Extracted from routes/jobs.ts for modular monolith architecture.
 * Handles job CRUD, status changes, photo uploads, notifications.
 */

export interface JobCreateDTO {
  client_id: string;
  technician_id?: string;
  service_type: string;
  job_description: string;
}

export interface JobUpdateDTO {
  service_type?: string;
  job_description?: string;
  client_id?: string;
  technician_id?: string;
  status?: string;
  technician_notes?: string;
  equipment_used?: string;
  arrival_time?: string;
  completion_time?: string;
  before_photo?: string;
  after_photo?: string;
  checklist_data?: string;
}

export interface JobListFilters {
  status?: string;
  technician_id?: string;
  client_id?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

const BASE_SELECT = `
  SELECT
    j.*,
    c.company_name,
    c.phone    AS client_phone,
    c.address  AS client_address,
    c.amc_status,
    t.name     AS tech_name,
    t.nickname AS tech_nickname,
    t.phone    AS tech_phone
  FROM service_records j
  LEFT JOIN clients    c ON j.client_id     = c.id
  LEFT JOIN technicians t ON j.technician_id = t.id
`;

export class JobService {
  constructor(private db: D1Database) {}

  async list(filters: JobListFilters, userId?: string, isAdmin?: boolean) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 200);
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params: any[] = [];
    let countWhere = 'WHERE 1=1';
    const countParams: any[] = [];

    if (filters.status) {
      where += ' AND j.status = ?';
      params.push(filters.status);
      countWhere += ' AND j.status = ?';
      countParams.push(filters.status);
    }
    if (filters.technician_id) {
      where += ' AND j.technician_id = ?';
      params.push(filters.technician_id);
      countWhere += ' AND j.technician_id = ?';
      countParams.push(filters.technician_id);
    }
    if (filters.client_id) {
      where += ' AND j.client_id = ?';
      params.push(filters.client_id);
      countWhere += ' AND j.client_id = ?';
      countParams.push(filters.client_id);
    }
    if (filters.date_from) {
      where += ' AND j.created_at >= ?';
      params.push(filters.date_from);
      countWhere += ' AND j.created_at >= ?';
      countParams.push(filters.date_from);
    }
    if (filters.date_to) {
      where += ' AND j.created_at <= ?';
      params.push(filters.date_to);
      countWhere += ' AND j.created_at <= ?';
      countParams.push(filters.date_to);
    }
    if (filters.search) {
      const like = `%${filters.search}%`;
      where += ' AND (j.id LIKE ? OR j.service_type LIKE ? OR j.job_description LIKE ? OR c.company_name LIKE ?)';
      params.push(like, like, like, like);
      countWhere += ' AND (j.id LIKE ? OR j.service_type LIKE ? OR j.job_description LIKE ? OR c.company_name LIKE ?)';
      countParams.push(like, like, like, like);
    }

    if (!isAdmin && userId) {
      where += ' AND j.technician_id = ?';
      params.push(userId);
      countWhere += ' AND j.technician_id = ?';
      countParams.push(userId);
    }

    const query = BASE_SELECT + where + ' ORDER BY j.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const countQuery = `SELECT COUNT(*) as total FROM service_records j LEFT JOIN clients c ON j.client_id = c.id ${countWhere}`;

    const [jobsResult, countResult] = await Promise.all([
      this.db.prepare(query).bind(...params).all(),
      this.db.prepare(countQuery).bind(...countParams).first(),
    ]);

    return {
      jobs: jobsResult.results,
      total: countResult?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil(Number(countResult?.total ?? 0) / limit),
    };
  }

  async getActive(userId?: string, isAdmin?: boolean) {
    const activeStatuses = ['Pending', 'In Progress'];
    let where = `WHERE j.status IN (${activeStatuses.map(() => '?').join(',')})`;
    const params: any[] = [...activeStatuses];

    if (!isAdmin && userId) {
      where += ' AND j.technician_id = ?';
      params.push(userId);
    }

    const result = await this.db
      .prepare(BASE_SELECT + where + ' ORDER BY j.created_at DESC')
      .bind(...params)
      .all();
    return result.results;
  }

  async getCalendar(dateFrom?: string, dateTo?: string, userId?: string, isAdmin?: boolean) {
    const from = dateFrom || new Date().toISOString().split('T')[0];
    let where = 'WHERE j.created_at >= ?';
    const params: any[] = [from];

    if (dateTo) {
      where += ' AND j.created_at <= ?';
      params.push(dateTo);
    }
    if (!isAdmin && userId) {
      where += ' AND j.technician_id = ?';
      params.push(userId);
    }

    const result = await this.db
      .prepare(BASE_SELECT + where + ' ORDER BY j.created_at ASC')
      .bind(...params)
      .all();
    return result.results;
  }

  async getReceipt(jobId: string) {
    const job = await this.db
      .prepare(
        `SELECT j.*, c.company_name, c.address, c.phone as client_phone, c.amc_status,
                t.name as tech_name, t.phone as tech_phone
         FROM service_records j
         LEFT JOIN clients c ON j.client_id = c.id
         LEFT JOIN technicians t ON j.technician_id = t.id
         WHERE j.id = ?`
      )
      .bind(jobId)
      .first();
    return job || null;
  }

  async getById(jobId: string) {
    const job = await this.db
      .prepare(BASE_SELECT + 'WHERE j.id = ?')
      .bind(jobId)
      .first();
    return job || null;
  }

  async create(data: JobCreateDTO) {
    const id = 'SR-' + Date.now().toString(36).toUpperCase();
    await this.db
      .prepare(
        "INSERT INTO service_records (id, client_id, technician_id, service_type, job_description, status) VALUES (?, ?, ?, ?, ?, 'Pending')"
      )
      .bind(id, data.client_id, data.technician_id || null, data.service_type, data.job_description)
      .run();
    return { id, service_type: data.service_type, status: 'Pending' };
  }

  async update(jobId: string, data: JobUpdateDTO) {
    const allowed = [
      'service_type', 'job_description', 'client_id', 'technician_id', 'status',
      'technician_notes', 'equipment_used', 'arrival_time', 'completion_time',
      'before_photo', 'after_photo', 'checklist_data',
    ];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowed) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push((data as any)[field]);
      }
    }

    if (updates.length === 0) return false;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(jobId);

    await this.db
      .prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    return true;
  }

  async delete(jobId: string) {
    await this.db.prepare('DELETE FROM service_records WHERE id = ?').bind(jobId).run();
  }

  async updateStatus(jobId: string, status: string, notes?: string) {
    const validStatuses = ['Pending', 'In Progress', 'Completed', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` };
    }

    const existing: any = await this.db
      .prepare('SELECT * FROM service_records WHERE id = ?')
      .bind(jobId)
      .first();
    if (!existing) return { error: 'not_found' };

    const updateFields: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const updateValues: any[] = [status];

    if (notes) {
      updateFields.push('technician_notes = ?');
      updateValues.push(notes);
    }
    if (status === 'In Progress' && !existing.arrival_time) {
      updateFields.push('arrival_time = CURRENT_TIMESTAMP');
    }
    if (status === 'Completed' && !existing.completion_time) {
      updateFields.push('completion_time = CURRENT_TIMESTAMP');
    }
    updateValues.push(jobId);

    await this.db
      .prepare(`UPDATE service_records SET ${updateFields.join(', ')} WHERE id = ?`)
      .bind(...updateValues)
      .run();

    return { id: jobId, previous_status: existing.status, new_status: status, existing };
  }

  async adminEdit(jobId: string, data: Record<string, any>) {
    const allowed = ['client_id', 'technician_id', 'service_type', 'status', 'job_description', 'maps_url', 'arrival_lat', 'arrival_lng', 'technician_notes'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const field of allowed) {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    }

    if (updates.length === 0) return { error: 'no_fields' };
    updates.push("updated_at = datetime('now')");
    values.push(jobId);

    await this.db.prepare(`UPDATE service_records SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    return { success: true };
  }

  async adminCancel(jobId: string) {
    const existing: any = await this.db.prepare('SELECT * FROM service_records WHERE id = ?').bind(jobId).first();
    if (!existing) return { error: 'not_found' };

    await this.db.prepare("UPDATE service_records SET status = 'Cancelled', updated_at = datetime('now') WHERE id = ?").bind(jobId).run();
    return { id: jobId, previous_status: existing.status, new_status: 'Cancelled' };
  }
}
