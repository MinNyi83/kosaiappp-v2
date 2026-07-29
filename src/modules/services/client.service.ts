/**
 * Client Service — Business logic for client records (upgraded)
 *
 * Handles client CRUD, search, stats, tags, bulk ops.
 */

export interface ClientCreateDTO {
  company_name: string;
  contact_person?: string;
  address: string;
  phone?: string;
  email?: string;
  notes?: string;
  tags?: string;
  client_type?: string;
  priority?: string;
  amc_status?: string;
  amc_start?: string;
  amc_end?: string;
}

export interface ClientUpdateDTO {
  company_name?: string;
  contact_person?: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
  tags?: string;
  client_type?: string;
  priority?: string;
  amc_status?: string;
  amc_start?: string;
  amc_end?: string;
}

export interface ClientListFilters {
  search?: string;
  amc_status?: string;
  client_type?: string;
  priority?: string;
  tags?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export class ClientService {
  constructor(private db: D1Database) {}

  async list(filters: ClientListFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 200, 500);
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM clients WHERE 1=1';
    const params: any[] = [];
    let countQuery = 'SELECT COUNT(*) as total FROM clients WHERE 1=1';
    const countParams: any[] = [];

    if (filters.search) {
      const like = `%${filters.search}%`;
      const clause = ' AND (company_name LIKE ? OR phone LIKE ? OR contact_person LIKE ? OR address LIKE ? OR email LIKE ? OR id LIKE ? OR tags LIKE ?)';
      query += clause;
      params.push(like, like, like, like, like, like, like);
      countQuery += clause;
      countParams.push(like, like, like, like, like, like, like);
    }
    if (filters.amc_status) {
      query += ' AND amc_status = ?';
      params.push(filters.amc_status);
      countQuery += ' AND amc_status = ?';
      countParams.push(filters.amc_status);
    }
    if (filters.client_type) {
      query += ' AND client_type = ?';
      params.push(filters.client_type);
      countQuery += ' AND client_type = ?';
      countParams.push(filters.client_type);
    }
    if (filters.priority) {
      query += ' AND priority = ?';
      params.push(filters.priority);
      countQuery += ' AND priority = ?';
      countParams.push(filters.priority);
    }
    if (filters.tags) {
      query += ' AND tags LIKE ?';
      params.push(`%${filters.tags}%`);
      countQuery += ' AND tags LIKE ?';
      countParams.push(`%${filters.tags}%`);
    }

    // Sort
    const sortMap: Record<string, string> = {
      'name-asc': 'company_name ASC',
      'name-desc': 'company_name DESC',
      'id-asc': 'id ASC',
      'id-desc': 'id DESC',
      'priority': "CASE priority WHEN 'VIP' THEN 0 WHEN 'High' THEN 1 WHEN 'Normal' THEN 2 ELSE 3 END ASC",
      'expiry': 'amc_end ASC NULLS LAST',
      'revenue': 'total_revenue DESC',
      'jobs': 'job_count DESC',
      'recent': 'last_contact DESC NULLS LAST',
      'newest': 'created_at DESC',
    };
    const sortCol = sortMap[filters.sort || 'name-asc'] || 'company_name ASC';
    query += ` ORDER BY ${sortCol} LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const [clientsResult, countResult] = await Promise.all([
      this.db.prepare(query).bind(...params).all(),
      this.db.prepare(countQuery).bind(...countParams).first(),
    ]);

    return {
      clients: clientsResult.results,
      total: countResult?.total ?? 0,
      page,
      limit,
      totalPages: Math.ceil(Number(countResult?.total ?? 0) / limit),
    };
  }

  async getById(clientId: string) {
    const client = await this.db.prepare('SELECT * FROM clients WHERE id = ?').bind(clientId).first();
    return client || null;
  }

  async create(data: ClientCreateDTO) {
    const id = 'CLT-' + Date.now().toString(36).toUpperCase();
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    await this.db
      .prepare(
        `INSERT INTO clients (id, company_name, contact_person, address, phone, email, notes, tags, client_type, priority, amc_status, amc_start, amc_end, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        id, data.company_name, data.contact_person || null, data.address,
        data.phone || null, data.email || null, data.notes || null,
        data.tags || null, data.client_type || 'Corporate',
        data.priority || 'Normal', data.amc_status || 'Inactive',
        data.amc_start || null, data.amc_end || null, now, now
      )
      .run();
    return { id, company_name: data.company_name, amc_status: data.amc_status || 'Inactive' };
  }

  async update(clientId: string, data: ClientUpdateDTO) {
    const allowed = ['company_name', 'contact_person', 'address', 'phone', 'email', 'notes', 'tags', 'client_type', 'priority', 'amc_status', 'amc_start', 'amc_end'];
    const updates: string[] = [];
    const values: any[] = [];
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

    for (const field of allowed) {
      if ((data as any)[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push((data as any)[field]);
      }
    }

    updates.push('updated_at = ?');
    values.push(now);

    if (updates.length === 1) return false; // only updated_at
    values.push(clientId);

    await this.db
      .prepare(`UPDATE clients SET ${updates.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();
    return true;
  }

  async delete(clientId: string) {
    await this.db.prepare('DELETE FROM clients WHERE id = ?').bind(clientId).run();
  }

  async stats() {
    const result = await this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN amc_status = 'Active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN amc_status = 'Expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN amc_status = 'Inactive' THEN 1 ELSE 0 END) as inactive,
        SUM(CASE WHEN amc_status = 'No AMC' THEN 1 ELSE 0 END) as no_amc,
        SUM(CASE WHEN amc_status = 'Individual' THEN 1 ELSE 0 END) as individual,
        SUM(CASE WHEN priority = 'VIP' THEN 1 ELSE 0 END) as vip,
        SUM(CASE WHEN priority = 'High' THEN 1 ELSE 0 END) as high_priority,
        ROUND(AVG(job_count), 1) as avg_jobs,
        ROUND(AVG(total_revenue), 0) as avg_revenue
      FROM clients
    `).first();
    return result;
  }

  async tags() {
    const result = await this.db.prepare(`
      SELECT tags FROM clients WHERE tags IS NOT NULL AND tags != ''
    `).all();
    const tagMap: Record<string, number> = {};
    (result.results || []).forEach((row: any) => {
      row.tags.split(',').map((t: string) => t.trim()).filter(Boolean).forEach((tag: string) => {
        tagMap[tag] = (tagMap[tag] || 0) + 1;
      });
    });
    return Object.entries(tagMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async bulkDelete(ids: string[]) {
    const placeholders = ids.map(() => '?').join(',');
    await this.db.prepare(`DELETE FROM clients WHERE id IN (${placeholders})`).bind(...ids).run();
  }

  async bulkUpdate(ids: string[], updates: Record<string, any>) {
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const fields = Object.keys(updates);
    if (fields.length === 0) return;
    const setClauses = fields.map(f => `${f} = ?`).join(', ');
    const placeholders = ids.map(() => '?').join(',');
    const values = [...Object.values(updates), now, ...ids];
    await this.db.prepare(`UPDATE clients SET ${setClauses}, updated_at = ? WHERE id IN (${placeholders})`).bind(...values).run();
  }

  async history(clientId: string) {
    const records = await this.db.prepare(`
      SELECT * FROM service_records WHERE client_id = ? ORDER BY created_at DESC LIMIT 50
    `).bind(clientId).all();
    return records.results || [];
  }
}
