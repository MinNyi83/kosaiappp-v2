import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock the google utility
vi.mock('../modules/utils/google.js', () => ({
  getGoogleAccessToken: vi.fn(),
  getOrCreateDriveFolder: vi.fn(),
  uploadFileToGoogleDrive: vi.fn(),
  uploadBackupToGoogleDrive: vi.fn(),
}));

// Mock the JWT utility
vi.mock('../modules/utils/jwt.js', () => ({
  verifyToken: vi.fn(),
  signToken: vi.fn(),
}));

import { register } from '../modules/routes/google.js';
import {
  getGoogleAccessToken,
  getOrCreateDriveFolder,
  uploadFileToGoogleDrive,
  uploadBackupToGoogleDrive,
} from '../modules/utils/google.js';
import { verifyToken, signToken } from '../modules/utils/jwt.js';

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
function createRequest(body: any, headers: Record<string, string> = {}, url: string = 'http://localhost') {
  return {
    json: () => Promise.resolve(body),
    headers: {
      get: (name: string) => headers[name] || null,
    },
    url,
  };
}

describe('Google Routes', () => {
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
      GOOGLE_CLIENT_ID: 'test-client-id',
      GOOGLE_CLIENT_SECRET: 'test-client-secret',
      GOOGLE_REFRESH_TOKEN: 'test-refresh-token',
      BASE_URL: 'https://kosai.app',
    };
    register(router, mockEnv);
  });

  describe('POST /api/auth/google', () => {
    it('should require Google credential', async () => {
      const handler = router.routes['/api/auth/google'];
      const req = createRequest({});

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Missing Google credential');
    });

    it('should reject invalid Google token', async () => {
      // Mock failed Google token verification
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ error: 'invalid_token' }),
      });

      const handler = router.routes['/api/auth/google'];
      const req = createRequest({ credential: 'invalid-token' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Invalid Google token');

      vi.restoreAllMocks();
    });

    it('should auto-register new technician', async () => {
      // Mock successful Google token verification
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            sub: 'google-123',
            email: 'newuser@test.com',
            name: 'New User',
          }),
      });

      (signToken as any).mockResolvedValue('mock-jwt-token');

      // Mock no existing tech on first call, then return new tech on second call after insert
      mockDb.first
        .mockResolvedValueOnce(null) // No existing tech found
        .mockResolvedValueOnce({ // Return newly created tech
          id: 'TECH-NEW',
          name: 'New User',
          email: 'newuser@test.com',
          role: 'technician',
          google_id: 'google-123',
        });

      const handler = router.routes['/api/auth/google'];
      const req = createRequest({ credential: 'valid-token' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.token).toBe('mock-jwt-token');
      expect(data.data.technician.email).toBe('newuser@test.com');

      vi.restoreAllMocks();
    });

    it('should login existing technician', async () => {
      // Mock successful Google token verification
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            sub: 'google-123',
            email: 'existing@test.com',
            name: 'Existing User',
          }),
      });

      (signToken as any).mockResolvedValue('mock-jwt-token');

      // Mock existing tech
      mockDb.first.mockResolvedValue({
        id: 'TECH-1',
        name: 'Existing User',
        email: 'existing@test.com',
        role: 'technician',
        google_id: 'google-123',
      });

      const handler = router.routes['/api/auth/google'];
      const req = createRequest({ credential: 'valid-token' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.technician.id).toBe('TECH-1');

      vi.restoreAllMocks();
    });
  });

  describe('POST /api/auth/login-password', () => {
    it('should require username and password', async () => {
      const handler = router.routes['/api/auth/login-password'];
      const req = createRequest({ username: 'test' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Missing username or password');
    });

    it('should reject invalid credentials', async () => {
      mockDb.first.mockResolvedValue(null);

      const handler = router.routes['/api/auth/login-password'];
      const req = createRequest({ username: 'test', password: 'wrong' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Invalid credentials');
    });

    it('should login with correct credentials', async () => {
      mockDb.first.mockResolvedValue({
        id: 'TECH-1',
        name: 'Test Tech',
        email: 'test@test.com',
        role: 'technician',
        password: 'correct-password',
        active: 1,
      });

      (signToken as any).mockResolvedValue('mock-jwt-token');

      const handler = router.routes['/api/auth/login-password'];
      const req = createRequest({ username: 'test', password: 'correct-password' });

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.token).toBe('mock-jwt-token');
      expect(data.data.technician.id).toBe('TECH-1');
    });
  });

  describe('GET /api/auth/google/drive-url', () => {
    it('should generate Google Drive OAuth URL', async () => {
      const handler = router.routes['/api/auth/google/drive-url'];
      const req = createRequest({});

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.auth_url).toContain('accounts.google.com');
      expect(data.data.auth_url).toContain('client_id=test-client-id');
      expect(data.data.auth_url).toContain('drive.file');
    });
  });

  describe('GET /api/auth/google/drive-callback', () => {
    it('should require authorization code', async () => {
      const handler = router.routes['/api/auth/google/drive-callback'];
      const req = createRequest({}, {}, 'http://localhost/callback');

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Missing authorization code');
    });

    it('should exchange code for tokens', async () => {
      // Mock token exchange
      globalThis.fetch = vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            access_token: 'access-token',
            refresh_token: 'refresh-token',
            expires_in: 3600,
          }),
      });

      const handler = router.routes['/api/auth/google/drive-callback'];
      const req = createRequest(
        {},
        {},
        'http://localhost/callback?code=auth-code-123'
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.message).toBe('Google Drive connected successfully');
      expect(data.data.access_token).toBe('access-token');

      vi.restoreAllMocks();
    });
  });

  describe('POST /api/resolve-maps-url', () => {
    it('should require authentication', async () => {
      (verifyToken as any).mockResolvedValue(null);

      const handler = router.routes['/api/resolve-maps-url'];
      const req = createRequest(
        { url: 'https://maps.google.com/@16.8661,96.1951' },
        { Authorization: 'Bearer invalid' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Unauthorized');
    });

    it('should parse coordinates from Maps URL', async () => {
      (verifyToken as any).mockResolvedValue({ id: '1', role: 'admin' });

      const handler = router.routes['/api/resolve-maps-url'];
      const req = createRequest(
        { url: 'https://www.google.com/maps/place/Office/@16.8661,96.1951,17z' },
        { Authorization: 'Bearer valid' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.data.latitude).toBe(16.8661);
      expect(data.data.longitude).toBe(96.1951);
      expect(data.data.source).toBe('parsed');
    });

    it('should return error for invalid URL', async () => {
      (verifyToken as any).mockResolvedValue({ id: '1', role: 'admin' });

      const handler = router.routes['/api/resolve-maps-url'];
      const req = createRequest(
        { url: 'https://example.com/not-a-map' },
        { Authorization: 'Bearer valid' }
      );

      const res = await handler(req);
      const data = await res.json();

      expect(data.error).toBe('Could not resolve coordinates from URL');
    });
  });
});

describe('Google Drive Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getGoogleAccessToken', () => {
    it('should return null if credentials missing', async () => {
      const { getGoogleAccessToken } = await import('../modules/utils/google.js');
      (getGoogleAccessToken as any).mockImplementation(async (env) => {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
          return null;
        }
        return 'token';
      });
      const result = await getGoogleAccessToken({});
      expect(result).toBeNull();
    });

    it('should return null if credentials are placeholders', async () => {
      const { getGoogleAccessToken } = await import('../modules/utils/google.js');
      (getGoogleAccessToken as any).mockImplementation(async (env) => {
        if (
          env.GOOGLE_CLIENT_SECRET?.includes('PASTE_YOUR_') ||
          env.GOOGLE_REFRESH_TOKEN?.includes('PASTE_YOUR_')
        ) {
          return null;
        }
        return 'token';
      });
      const result = await getGoogleAccessToken({
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'PASTE_YOUR_SECRET',
        GOOGLE_REFRESH_TOKEN: 'test',
      });
      expect(result).toBeNull();
    });

    it('should fetch access token successfully', async () => {
      const { getGoogleAccessToken } = await import('../modules/utils/google.js');
      (getGoogleAccessToken as any).mockResolvedValue('new-access-token');
      const result = await getGoogleAccessToken({
        GOOGLE_CLIENT_ID: 'test',
        GOOGLE_CLIENT_SECRET: 'secret',
        GOOGLE_REFRESH_TOKEN: 'refresh',
      });
      expect(result).toBe('new-access-token');
    });
  });

  describe('getOrCreateDriveFolder', () => {
    it('should return existing folder id', async () => {
      const { getOrCreateDriveFolder } = await import('../modules/utils/google.js');
      (getOrCreateDriveFolder as any).mockResolvedValue('existing-folder-id');
      const result = await getOrCreateDriveFolder('token', 'TestFolder');
      expect(result).toBe('existing-folder-id');
    });

    it('should create new folder if not exists', async () => {
      const { getOrCreateDriveFolder } = await import('../modules/utils/google.js');
      (getOrCreateDriveFolder as any).mockResolvedValue('new-folder-id');
      const result = await getOrCreateDriveFolder('token', 'NewFolder');
      expect(result).toBe('new-folder-id');
    });
  });
});
