// src/modules/utils/response.js
export const success = (data, message = null, status = 200) => {
  const body = { success: true, data };
  if (message) body.message = message;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const error = (message = 'Internal Server Error', status = 500, details = null) => {
  const body = { success: false, error: message };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Keep existing jsonResponse for backward compatibility if needed
export const jsonResponse = (data, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Aliases for test compatibility
export const createSuccessResponse = success;
export const createErrorResponse = error;

export const createNotFoundResponse = (resource) => {
  return error(`${resource} not found`, 404);
};

export const createUnauthorizedResponse = (message = 'Unauthorized') => {
  return error(message, 401);
};

export const createValidationErrorResponse = (errors) => {
  return error('Validation failed', 400, errors);
};