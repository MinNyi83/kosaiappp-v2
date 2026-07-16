// src/modules/utils/response.ts
export const success = (data: any, message: any = null, status: any = 200) => {
  let msg = typeof message === 'string' ? message : null;
  let code = typeof message === 'number' ? message : status;
  const body: any = { success: true, data };
  if (msg) body.message = msg;
  return new Response(JSON.stringify(body), {
    status: code,
    headers: { 'Content-Type': 'application/json' },
  });
};

export const error = (message: any = 'Internal Server Error', status: any = 500, details: any = null) => {
  const body: any = { success: false, error: message };
  if (details) body.details = details;
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Keep existing jsonResponse for backward compatibility if needed
export const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
};

// Aliases for test compatibility
export const createSuccessResponse = success;
export const createErrorResponse = error;

export const createNotFoundResponse = (resource: string) => {
  return error(`${resource} not found`, 404);
};

export const createUnauthorizedResponse = (message = 'Unauthorized') => {
  return error(message, 401);
};

export const createValidationErrorResponse = (errors: any) => {
  return error('Validation failed', 400, errors);
};
