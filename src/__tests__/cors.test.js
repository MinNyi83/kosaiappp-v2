import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCorsHeaders, handleCorsRequest } from '../modules/utils/cors';

describe('CORS Utilities', () => {
  describe('getCorsHeaders', () => {
    it('should return correct CORS headers', () => {
      const headers = getCorsHeaders('https://example.com');
      expect(headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
    });

    it('should allow wildcard origin when not specified', () => {
      const headers = getCorsHeaders();
      expect(headers['Access-Control-Allow-Origin']).toBe('*');
      expect(headers['Access-Control-Allow-Credentials']).toBeUndefined();
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
            if (key === 'Origin') return 'https://example.com';
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
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should return null for non-OPTIONS request', async () => {
      mockRequest.method = 'GET';
      const response = await handleCorsRequest(mockRequest, mockEnv);
      expect(response).toBeNull();
    });

    it('should handle missing origin header', async () => {
      mockRequest.method = 'OPTIONS';
      mockRequest.headers.get = (key) => (key === 'Origin' ? null : null);
      const response = await handleCorsRequest(mockRequest, mockEnv);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});