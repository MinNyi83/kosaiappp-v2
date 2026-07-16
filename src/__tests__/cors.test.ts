import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCorsHeaders, handleCorsRequest } from '../modules/utils/cors';

describe('CORS Utilities', () => {
  describe('getCorsHeaders', () => {
    it('should return correct CORS headers for allowed origin', () => {
      const headers = getCorsHeaders('https://awesomemyanmar.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://awesomemyanmar.com');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should fallback to default origin when not specified or disallowed', () => {
      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('https://awesomemyanmar.com');
    });
  });

  describe('handleCorsRequest', () => {
    let mockRequest;
    let mockEnv;

    beforeEach(() => {
      mockRequest = {
        method: 'GET',
        headers: {
          get: (key) => {
            if (key === 'Origin') return 'https://awesomemyanmar.com';
            return null;
          },
        },
      };
      mockEnv = {};
    });

    it('should return 204 for OPTIONS request', async () => {
      mockRequest.method = 'OPTIONS';
      const response = await handleCorsRequest(mockRequest, mockEnv);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://awesomemyanmar.com');
    });

    it('should return null for non-OPTIONS request', async () => {
      mockRequest.method = 'GET';
      const response = await handleCorsRequest(mockRequest, mockEnv);
      expect(response).toBeNull();
    });

    it('should handle missing origin header by falling back to default', async () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers.get = (key) => (key === 'Origin' ? null : null);
      const response = await handleCorsRequest(mockRequest, mockEnv);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://awesomemyanmar.com');
    });
  });
});

