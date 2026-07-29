import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SurveyService } from '../modules/services/survey.service';
import { QuotationService } from '../modules/services/quotation.service';
import { JobService } from '../modules/services/job.service';
import { ClientService } from '../modules/services/client.service';
import { InventoryService } from '../modules/services/inventory.service';

function createMockDb() {
  const store: Record<string, any[]> = {};
  const chain = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn().mockResolvedValue(null),
    all: vi.fn().mockResolvedValue({ results: [] }),
    run: vi.fn().mockResolvedValue({}),
  };
  return {
    prepare: vi.fn().mockReturnValue(chain),
    _store: store,
    _chain: chain,
  };
}

describe('SurveyService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: SurveyService;

  beforeEach(() => {
    db = createMockDb();
    service = new SurveyService(db as any);
  });

  it('should return null for nonexistent survey', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.getById('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should create a survey and return id', async () => {
    const id = await service.create({ client_id: 'CLT-001', survey_type: 'CCTV' });
    expect(id).toMatch(/^SRV-/);
    expect(db.prepare).toHaveBeenCalled();
  });

  it('should update survey fields', async () => {
    const updated = await service.update('SRV-001', { camera_count: 8 });
    expect(updated).toBe(true);
  });

  it('should return false when no fields to update', async () => {
    const updated = await service.update('SRV-001', {});
    expect(updated).toBe(false);
  });

  it('should get status counts', async () => {
    db._chain.first.mockResolvedValue({ count: 5 });
    const counts = await service.getStatusCounts();
    expect(counts).toHaveProperty('Draft');
    expect(counts).toHaveProperty('Completed');
    expect(counts).toHaveProperty('Approved');
  });
});

describe('QuotationService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: QuotationService;

  beforeEach(() => {
    db = createMockDb();
    service = new QuotationService(db as any);
  });

  it('should return null for nonexistent quotation', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.getById('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should create a quotation and return id with portal_token', async () => {
    const result = await service.create({ client_id: 'CLT-001', items: [{ name: 'Camera', quantity: 4, unit_price: 100 }] });
    expect(result.id).toMatch(/^QUO-/);
    expect(result.portal_token).toBeDefined();
  });

  it('should update quotation fields', async () => {
    const updated = await service.update('QUO-001', { status: 'Sent' });
    expect(updated).toBe(true);
  });

  it('should add line item and recalculate', async () => {
    const itemId = await service.addLineItem('QUO-001', { name: 'NVR', quantity: 1, unit_price: 500 });
    expect(itemId).toMatch(/^QIT-/);
  });

  it('should delete line item', async () => {
    await service.deleteLineItem('QUO-001', 'QIT-001');
    expect(db.prepare).toHaveBeenCalled();
  });

  it('should approve with signature', async () => {
    db._chain.first.mockResolvedValue({ id: 'QUO-001', status: 'Sent' });
    const result = await service.approveWithSignature('token-123', 'data:image/png;base64,abc');
    expect(result).toEqual({ id: 'QUO-001' });
  });

  it('should return alreadyFinalized if already approved', async () => {
    db._chain.first.mockResolvedValue({ id: 'QUO-001', status: 'Approved' });
    const result = await service.approveWithSignature('token-123');
    expect(result).toEqual({ alreadyFinalized: true });
  });

  it('should reject quotation', async () => {
    db._chain.first.mockResolvedValue({ id: 'QUO-001' });
    const result = await service.reject('token-123', 'Too expensive');
    expect(result).toEqual({ id: 'QUO-001' });
  });

  it('should convert to job', async () => {
    db._chain.first.mockResolvedValue({ id: 'QUO-001', client_id: 'CLT-001', prepared_by: 'TECH-001' });
    db._chain.all.mockResolvedValue({ results: [{ name: 'Camera', quantity: 4 }] });
    const result = await service.convertToJob('QUO-001');
    expect(result?.job_id).toMatch(/^JOB-/);
  });

  it('should convert to invoice', async () => {
    db._chain.first.mockResolvedValue({ id: 'QUO-001', client_id: 'CLT-001', prepared_by: 'TECH-001', items: '[]', subtotal: 400, tax: 40, total_amount: 440 });
    const result = await service.convertToInvoice('QUO-001');
    expect(result?.invoice_id).toMatch(/^INV-/);
  });
});

describe('JobService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: JobService;

  beforeEach(() => {
    db = createMockDb();
    service = new JobService(db as any);
  });

  it('should list jobs with pagination', async () => {
    db._chain.all.mockResolvedValue({ results: [{ id: 'SR-001' }] });
    db._chain.first.mockResolvedValue({ total: 1 });
    const result = await service.list({ page: 1, limit: 10 }, 'tech-1', false);
    expect(result.jobs).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
  });

  it('should get active jobs', async () => {
    db._chain.all.mockResolvedValue({ results: [{ id: 'SR-001', status: 'Pending' }] });
    const result = await service.getActive('tech-1', false);
    expect(result).toHaveLength(1);
  });

  it('should return null for nonexistent job', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.getById('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should create a job', async () => {
    const result = await service.create({ client_id: 'CLT-001', service_type: 'CCTV', job_description: 'Install cameras' });
    expect(result.id).toMatch(/^SR-/);
    expect(result.status).toBe('Pending');
  });

  it('should update job fields', async () => {
    const updated = await service.update('SR-001', { technician_notes: 'All good' });
    expect(updated).toBe(true);
  });

  it('should return false when no fields to update', async () => {
    const updated = await service.update('SR-001', {});
    expect(updated).toBe(false);
  });

  it('should update status with valid status', async () => {
    db._chain.first.mockResolvedValue({ id: 'SR-001', status: 'Pending', arrival_time: null, completion_time: null });
    const result = await service.updateStatus('SR-001', 'In Progress');
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('new_status');
  });

  it('should reject invalid status', async () => {
    const result = await service.updateStatus('SR-001', 'InvalidStatus');
    expect(result).toHaveProperty('error');
  });

  it('should return not_found for nonexistent job', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.updateStatus('NONEXISTENT', 'Completed');
    expect(result.error).toBe('not_found');
  });

  it('should cancel job', async () => {
    db._chain.first.mockResolvedValue({ id: 'SR-001', status: 'Pending' });
    const result = await service.adminCancel('SR-001');
    expect(result).toHaveProperty('new_status', 'Cancelled');
  });
});

describe('ClientService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: ClientService;

  beforeEach(() => {
    db = createMockDb();
    service = new ClientService(db as any);
  });

  it('should list clients', async () => {
    db._chain.all.mockResolvedValue({ results: [{ id: 'CLT-001', company_name: 'Acme' }] });
    db._chain.first.mockResolvedValue({ total: 1 });
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.clients).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('should return null for nonexistent client', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.getById('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should create a client', async () => {
    const result = await service.create({ company_name: 'Acme Corp', address: '123 Main St' });
    expect(result.id).toMatch(/^CLT-/);
    expect(result.company_name).toBe('Acme Corp');
  });

  it('should update client fields', async () => {
    const updated = await service.update('CLT-001', { phone: '09123456' });
    expect(updated).toBe(true);
  });

  it('should return false when no fields to update', async () => {
    const updated = await service.update('CLT-001', {});
    expect(updated).toBe(false);
  });

  it('should delete a client', async () => {
    await service.delete('CLT-001');
    expect(db.prepare).toHaveBeenCalled();
  });
});

describe('InventoryService', () => {
  let db: ReturnType<typeof createMockDb>;
  let service: InventoryService;

  beforeEach(() => {
    db = createMockDb();
    service = new InventoryService(db as any);
  });

  it('should list inventory items', async () => {
    db._chain.all.mockResolvedValue({ results: [{ item_code: 'CAM-001' }] });
    db._chain.first.mockResolvedValue({ total: 1 });
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items).toHaveLength(1);
  });

  it('should return null for nonexistent item', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.getById('NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should create inventory item (insert)', async () => {
    db._chain.first.mockResolvedValue(null); // no existing
    const result = await service.create({ item_code: 'cam-001', item_name: 'Camera' });
    expect(result.item_code).toBe('CAM-001');
  });

  it('should create inventory item (upsert)', async () => {
    db._chain.first.mockResolvedValue({ item_code: 'CAM-001' }); // existing
    const result = await service.create({ item_code: 'CAM-001', item_name: 'Camera Updated' });
    expect(result.item_code).toBe('CAM-001');
  });

  it('should update inventory fields', async () => {
    const updated = await service.update('CAM-001', { stock_qty: 50 });
    expect(updated).toBe(true);
  });

  it('should adjust stock correctly', async () => {
    db._chain.first.mockResolvedValue({ item_code: 'CAM-001', stock_qty: 10 });
    const result = await service.adjustStock('CAM-001', 5, 'user-1', 'restock');
    expect(result).toHaveProperty('new_quantity', 15);
  });

  it('should reject negative stock', async () => {
    db._chain.first.mockResolvedValue({ item_code: 'CAM-001', stock_qty: 2 });
    const result = await service.adjustStock('CAM-001', -5, 'user-1');
    expect(result.error).toBe('insufficient_stock');
  });

  it('should reject non-integer adjustment', async () => {
    const result = await service.adjustStock('CAM-001', 1.5, 'user-1');
    expect(result.error).toBe('quantity_change must be an integer');
  });

  it('should return not_found for nonexistent item adjustment', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.adjustStock('NONEXISTENT', 1, 'user-1');
    expect(result.error).toBe('not_found');
  });

  it('should register warranty', async () => {
    db._chain.first.mockResolvedValue(null); // no existing
    const result = await service.registerWarranty({ serial_number: 'SN-001', device_name: 'Camera' });
    expect(result).toHaveProperty('status', 'Active');
  });

  it('should reject duplicate warranty', async () => {
    db._chain.first.mockResolvedValue({ serial_number: 'SN-001', status: 'Active' });
    const result = await service.registerWarranty({ serial_number: 'SN-001', device_name: 'Camera' });
    expect(result.error).toBe('already_registered');
  });

  it('should lookup warranty with days left', async () => {
    db._chain.first.mockResolvedValue({
      serial_number: 'SN-001', installed_date: '2025-01-01', warranty_months: 12, status: 'Active',
    });
    const result = await service.lookupWarranty('SN-001');
    expect(result).toHaveProperty('warranty_active');
    expect(result).toHaveProperty('warranty_days_left');
  });

  it('should raise RMA', async () => {
    db._chain.first.mockResolvedValue({ serial_number: 'SN-001', status: 'Active' });
    const result = await service.raiseRma('SN-001', 'Supplier A', 'RMA-001');
    expect(result).toHaveProperty('status', 'RMA Sent');
  });

  it('should raise RMA for nonexistent serial', async () => {
    db._chain.first.mockResolvedValue(null);
    const result = await service.raiseRma('NONEXISTENT');
    expect(result.error).toBe('not_found');
  });

  it('should update RMA', async () => {
    const result = await service.updateRma('SN-001', 'RMA Completed');
    expect(result).toHaveProperty('status', 'RMA Completed');
  });

  it('should reject invalid RMA status', async () => {
    const result = await service.updateRma('SN-001', 'InvalidStatus');
    expect(result.error).toContain('Invalid status');
  });

  it('should update price', async () => {
    const result = await service.updatePrice('CAM-001', 100, 150000);
    expect(result).toHaveProperty('message', 'Price updated successfully');
  });
});
