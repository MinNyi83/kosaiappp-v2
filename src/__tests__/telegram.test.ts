import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the telegram utility
vi.mock('../modules/utils/telegram.js', () => ({
  sendTelegramMessage: vi.fn().mockResolvedValue(undefined),
  sendTelegramNotification: vi.fn().mockResolvedValue(undefined),
  sendTelegramPhotoNotification: vi.fn().mockResolvedValue(undefined),
}));

// Mock the JWT utility
vi.mock('../modules/utils/jwt.js', () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

// Mock the google utility for photo upload
vi.mock('../modules/utils/google.js', () => ({
  uploadFileToGoogleDrive: vi.fn().mockResolvedValue('mock-file-id'),
}));

import { register } from '../modules/routes/telegram.js';
import { sendTelegramMessage } from '../modules/utils/telegram.js';
import { verifyToken } from '../modules/utils/jwt.js';

// Simple router mock
function createMockRouter() {
  const routes: Record<string, Function> = {};
  return {
    post: (path: string, handler: Function) => {
      routes[path] = handler;
    },
    get: (path: string, handler: Function) => {
      routes[path] = handler;
    },
    routes,
  };
}

// Simple request mock
function createRequest(body: any, headers: Record<string, string> = {}) {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => headers[name] || null,
    },
  };
}

describe('Telegram Routes', () => {
  let router: ReturnType<typeof createMockRouter>;
  let mockDb: any;
  let mockEnv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createMockRouter();
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue(undefined),
    };
    mockEnv = {
      DB: mockDb,
      TELEGRAM_BOT_TOKEN: 'test-bot-token',
      TELEGRAM_CHAT_ID: '123456',
      GEMINI_API_KEY: 'test-gemini-key',
    };
    register(router, mockEnv);
  });

  describe('POST /api/telegram/webhook', () => {
    it('should handle text messages and create job', async () => {
      // Mock technician lookup
      mockDb.first
        .mockResolvedValueOnce({ id: 'TECH-1', name: 'Test Tech' }) // resolveTech
        .mockResolvedValueOnce(null); // existing clock-in check (not needed here)

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: 'AC unit broken at office',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalled();
    });

    it('should handle /help command', async () => {
      mockDb.first.mockResolvedValue({ id: 'TECH-1', name: 'Test Tech' });

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: '/help',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        mockEnv,
        99999,
        expect.stringContaining('Awesome Myanmar Bot')
      );
    });

    it('should handle /start command', async () => {
      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: '/start',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        mockEnv,
        99999,
        expect.stringContaining('Welcome')
      );
    });

    it('should handle /checkin command for registered tech', async () => {
      mockDb.first
        .mockResolvedValueOnce({ id: 'TECH-1', name: 'Test Tech' }) // resolveTech
        .mockResolvedValueOnce(null); // no existing clock-in

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: '/checkin',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        mockEnv,
        99999,
        expect.stringContaining('Clocked in')
      );
    });

    it('should handle /checkout command', async () => {
      mockDb.first
        .mockResolvedValueOnce({ id: 'TECH-1', name: 'Test Tech' }) // resolveTech
        .mockResolvedValueOnce({ id: 'ATT-1', clock_in: '2024-01-15T09:00:00' }); // active record

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: '/checkout',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        mockEnv,
        99999,
        expect.stringContaining('Clocked out')
      );
    });

    it('should handle /jobs command with active jobs', async () => {
      mockDb.first.mockResolvedValue({ id: 'TECH-1', name: 'Test Tech' });
      mockDb.all.mockResolvedValue({
        results: [
          { id: 'JOB-1', job_description: 'Fix AC', service_type: 'Maintenance', status: 'Pending' },
        ],
      });

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        message: {
          text: '/jobs',
          chat: { id: 99999 },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(
        mockEnv,
        99999,
        expect.stringContaining('Active Jobs')
      );
    });

    it('should handle callback query for accept_job', async () => {
      mockDb.first.mockResolvedValue({ id: 'TECH-1', name: 'Test Tech' });

      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({
        callback_query: {
          data: 'accept_job:JOB-123',
          message: { chat: { id: 99999 } },
          from: { id: 12345, username: 'testuser' },
        },
      });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalled();
    });

    it('should return ok for empty updates', async () => {
      const handler = router.routes['/api/telegram/webhook'];
      const req = createRequest({});

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/telegram/send', () => {
    it('should require authentication', async () => {
      (verifyToken as any).mockResolvedValue(null);

      const handler = router.routes['/api/telegram/send'];
      const req = createRequest(
        { chat_id: 123, text: 'Hello' },
        { Authorization: 'Bearer invalid-token' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Unauthorized');
    });

    it('should require chat_id and text', async () => {
      (verifyToken as any).mockResolvedValue({ id: '1', role: 'admin' });

      const handler = router.routes['/api/telegram/send'];
      const req = createRequest(
        { chat_id: 123 },
        { Authorization: 'Bearer valid-token' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Missing chat_id or text');
    });

    it('should send message when authenticated', async () => {
      (verifyToken as any).mockResolvedValue({ id: '1', role: 'admin' });

      const handler = router.routes['/api/telegram/send'];
      const req = createRequest(
        { chat_id: 123, text: 'Test message' },
        { Authorization: 'Bearer valid-token' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(sendTelegramMessage).toHaveBeenCalledWith(mockEnv, 123, 'Test message');
    });
  });
});
