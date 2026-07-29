/**
 * Survey Service — Business logic for site surveys
 *
 * Extracted from routes/surveys.ts for modular monolith architecture.
 * All methods accept db as parameter for testability.
 */

export interface SurveyCreateDTO {
  client_id: string;
  technician_id?: string;
  survey_type?: string;
  camera_count?: number;
  estimated_cable_meters?: number;
  cable_type?: string;
  site_type?: string;
  site_address?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  status?: string;
}

export interface SurveyUpdateDTO {
  camera_count?: number;
  estimated_cable_meters?: number;
  cable_type?: string;
  site_type?: string;
  site_address?: string;
  contact_person?: string;
  contact_phone?: string;
  notes?: string;
  status?: string;
}

export class SurveyService {
  constructor(private db: D1Database) {}

  async getById(surveyId: string) {
    const survey = await this.db.prepare(`
      SELECT s.*, c.company_name as client_name, c.contact_person, c.phone as client_phone,
             t.name as technician_name
      FROM site_surveys s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN technicians t ON s.technician_id = t.id
      WHERE s.id = ?
    `).bind(surveyId).first();
    if (!survey) return null;
    const photos = await this.db.prepare(
      'SELECT * FROM survey_photos WHERE survey_id = ? ORDER BY created_at ASC'
    ).bind(surveyId).all();
    return { ...survey, photos: photos.results || [] };
  }

  async list(filterClientId?: string) {
    let query = `
      SELECT s.*, c.company_name as client_name, c.contact_person,
             t.name as technician_name,
             (SELECT COUNT(*) FROM quotation_items qi
              JOIN quotations q ON qi.quotation_id = q.id
              WHERE q.survey_id_link = s.id) as item_count
      FROM site_surveys s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN technicians t ON s.technician_id = t.id
    `;
    const bindings: any[] = [];
    if (filterClientId) {
      query += ' WHERE s.client_id = ?';
      bindings.push(filterClientId);
    }
    query += ' ORDER BY s.created_at DESC';
    const { results } = await this.db.prepare(query).bind(...bindings).all();
    return results || [];
  }

  async create(data: SurveyCreateDTO) {
    const id = `SRV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await this.db.prepare(`
      INSERT INTO site_surveys (id, client_id, technician_id, survey_type, camera_count,
        estimated_cable_meters, cable_type, site_type, site_address, contact_person,
        contact_phone, notes, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      id, data.client_id, data.technician_id || null, data.survey_type || 'CCTV',
      data.camera_count || 0, data.estimated_cable_meters || 0, data.cable_type || 'Cat6',
      data.site_type || null, data.site_address || null, data.contact_person || null,
      data.contact_phone || null, data.notes || null, data.status || 'Draft'
    ).run();
    return id;
  }

  async update(surveyId: string, data: SurveyUpdateDTO) {
    const updates: string[] = [];
    const values: any[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        updates.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (updates.length === 0) return false;
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(surveyId);
    await this.db.prepare(`UPDATE site_surveys SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run();
    return true;
  }

  async complete(surveyId: string) {
    await this.db.prepare(`
      UPDATE site_surveys SET status = 'Completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(surveyId).run();
  }

  async approve(surveyId: string) {
    await this.db.prepare(`
      UPDATE site_surveys SET approval_status = 'Approved', approval_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(surveyId).run();
  }

  async addPhoto(surveyId: string, photoType: string, photoBase64: string) {
    const photoId = `SPH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    await this.db.prepare(`
      INSERT INTO survey_photos (id, survey_id, photo_type, photo_base64, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(photoId, surveyId, photoType, photoBase64).run();
    return photoId;
  }

  async deletePhoto(photoId: string, surveyId: string) {
    await this.db.prepare('DELETE FROM survey_photos WHERE id = ? AND survey_id = ?').bind(photoId, surveyId).run();
  }

  async getPhotos(surveyId: string) {
    const { results } = await this.db.prepare(
      'SELECT * FROM survey_photos WHERE survey_id = ? ORDER BY created_at ASC'
    ).bind(surveyId).all();
    return results || [];
  }

  async getStatusCounts() {
    const counts: Record<string, number> = {};
    for (const status of ['Draft', 'Completed', 'Approved']) {
      const row: any = await this.db.prepare(
        'SELECT COUNT(*) as count FROM site_surveys WHERE status = ?'
      ).bind(status).first();
      counts[status] = row?.count || 0;
    }
    return counts;
  }
}
