import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createValidationErrorResponse,
} from '../modules/utils/response';

describe('Response Utilities', () => {
  describe('createSuccessResponse', () => {
    it('should return 200 with data and success true', async () => {
      const data = { id: 1, name: 'Test' };
      const response = createSuccessResponse(data);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toEqual(data);
    });

    it('should include message when provided', async () => {
      const response = createSuccessResponse({ id: 1 }, 'Created successfully');
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.message).toBe('Created successfully');
    });

    it('should set correct content-type header', async () => {
      const response = createSuccessResponse({});
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });
  });

  describe('createErrorResponse', () => {
    it('should return 500 by default with error message', async () => {
      const response = createErrorResponse('Internal server error');
      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Internal server error');
    });

    it('should use custom status code', async () => {
      const response = createErrorResponse('Bad request', 400);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Bad request');
    });

    it('should include details when provided', async () => {
      const response = createErrorResponse('Validation failed', 400, {
        field: 'email',
        issue: 'invalid format',
      });
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.details).toEqual({ field: 'email', issue: 'invalid format' });
    });
  });

  describe('createNotFoundResponse', () => {
    it('should return 404 with resource name', async () => {
      const response = createNotFoundResponse('Job');
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error).toBe('Job not found');
    });
  });

  describe('createUnauthorizedResponse', () => {
    it('should return 401 with default message', async () => {
      const response = createUnauthorizedResponse();
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should use custom message', async () => {
      const response = createUnauthorizedResponse('Token expired');
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Token expired');
    });
  });

  describe('createValidationErrorResponse', () => {
    it('should return 400 with validation errors', async () => {
      const errors = [
        { field: 'email', message: 'Invalid email' },
        { field: 'password', message: 'Too short' },
      ];
      const response = createValidationErrorResponse(errors);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toBe('Validation failed');
      expect(body.details).toEqual(errors);
    });
  });
});
