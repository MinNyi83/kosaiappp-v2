import { execSync } from 'child_process';
import { unstable_dev } from 'wrangler';
import { describe, expect, it, beforeAll, afterAll } from 'vitest';

function seedDB(sql: string) {
  execSync(`npx wrangler d1 execute cctv-fsm-db --local --command "${sql.replace(/"/g, '\\"')}"`, {
    cwd: 'D:\\kosai-project\\v2',
    stdio: 'pipe',
  });
}

describe('E2E API Tests', () => {
  let worker: any;

  beforeAll(async () => {
    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should block unauthenticated access to admin routes', async () => {
    const res = await worker.fetch('/api/admin/clients', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  }, 15000);

  it('should respond with 401 on missing auth for protected POSTs', async () => {
    const res = await worker.fetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(401);
  }, 15000);
});

describe('POST /api/auth/login-password', () => {
  let worker: any;

  beforeAll(async () => {
    // Seed test admin via wrangler D1 CLI before worker starts
    seedDB("INSERT OR REPLACE INTO technicians (id, name, role, username, password, active, email) VALUES ('TEST-LOGIN-1', 'Test Login Admin', 'Admin', 'testlogin', 'pass123', 1, 'testlogin@test.com')");

    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });
  });

  afterAll(async () => {
    await worker.stop();
  });

  it('should reject missing fields', async () => {
    const res = await worker.fetch('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe('Missing username or password');
  });

  it('should reject invalid credentials', async () => {
    const res = await worker.fetch('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ username: 'nonexistent', password: 'wrong' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBe('Invalid credentials');
  });

  it('should return technician object (not user) on success', async () => {
    const res = await worker.fetch('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ username: 'testlogin', password: 'pass123' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    // Critical: response must have data.technician (not data.user)
    expect(data.data.technician).toBeDefined();
    expect(data.data.technician.role).toBe('Admin');
    expect(data.data.token).toBeDefined();
  });
});

describe('RMA & Warranty endpoints', () => {
  let worker: any;
  let token: string;

  beforeAll(async () => {
    // Seed admin user via wrangler D1 CLI
    seedDB("INSERT OR REPLACE INTO technicians (id, name, role, username, password, active, email) VALUES ('RMA-ADMIN', 'RMA Admin', 'Admin', 'rmaadmin', 'rmapass', 1, 'rma@test.com')");

    worker = await unstable_dev('src/index.ts', {
      experimental: { disableExperimentalWarning: true },
      local: true,
    });

    // Get auth token
    const loginRes = await worker.fetch('/api/auth/login-password', {
      method: 'POST',
      body: JSON.stringify({ username: 'rmaadmin', password: 'rmapass' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const loginData = await loginRes.json();
    token = loginData.data.token;
  });

  afterAll(async () => {
    await worker.stop();
  });

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  });

  it('GET /api/admin/warranty/list should return array (not 500)', async () => {
    const res = await worker.fetch('/api/admin/warranty/list', {
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  it('POST /api/admin/warranty/register should create warranty', async () => {
    const uniqueSerial = 'SN-TEST-' + Date.now();
    const res = await worker.fetch('/api/admin/warranty/register', {
      method: 'POST',
      body: JSON.stringify({
        serial_number: uniqueSerial,
        device_name: 'Test Camera',
        client_id: null,
        installed_date: '2024-01-15',
        warranty_months: 24,
      }),
      headers: authHeaders(),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.serial_number).toBe(uniqueSerial);
  });

  it('GET /api/admin/warranty/list should return registered warranty', async () => {
    const res = await worker.fetch('/api/admin/warranty/list', {
      headers: authHeaders(),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    const found = data.data.some((w: any) => w.serial_number === 'SN-TEST-001');
    expect(found).toBe(true);
  });

  it('POST /api/admin/rma/raise should update status to RMA Sent', async () => {
    const res = await worker.fetch('/api/admin/rma/raise', {
      method: 'POST',
      body: JSON.stringify({
        serial_number: 'SN-TEST-001',
        distributor: 'Test Supplier',
        rma_id: 'RMA-1001',
        sent_date: '2024-06-01',
      }),
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('RMA Sent');
  });

  it('GET /api/admin/rma/list should return RMA items', async () => {
    const res = await worker.fetch('/api/admin/rma/list', {
      headers: authHeaders(),
    });
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    const rmaItem = data.data.find((r: any) => r.serial_number === 'SN-TEST-001');
    expect(rmaItem).toBeDefined();
    expect(rmaItem.status).toBe('RMA Sent');
    expect(rmaItem.rma_tracking_id).toBe('RMA-1001');
  });

  it('POST /api/admin/rma/update should mark RMA completed', async () => {
    const res = await worker.fetch('/api/admin/rma/update', {
      method: 'POST',
      body: JSON.stringify({
        serial_number: 'SN-TEST-001',
        status: 'RMA Completed',
      }),
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.status).toBe('RMA Completed');
  });

  it('POST /api/admin/rma/raise should reject missing serial_number', async () => {
    const res = await worker.fetch('/api/admin/rma/raise', {
      method: 'POST',
      body: JSON.stringify({ distributor: 'Test' }),
      headers: authHeaders(),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/admin/rma/raise should reject unknown serial', async () => {
    const res = await worker.fetch('/api/admin/rma/raise', {
      method: 'POST',
      body: JSON.stringify({ serial_number: 'NONEXISTENT-SN' }),
      headers: authHeaders(),
    });
    expect(res.status).toBe(404);
  });
});
