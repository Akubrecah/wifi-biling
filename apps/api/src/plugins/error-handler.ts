import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ERROR_CODES } from '@wifi-billing/shared';

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id || `req_${Date.now()}`;
  const timestamp = new Date().toISOString();

  // Handle Zod Schema Validation Errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Request payload validation failed',
        details: error.flatten().fieldErrors,
      },
      meta: { requestId, timestamp },
    });
  }

  // Handle Fastify Validation Errors
  if (error.validation) {
    return reply.status(400).send({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: error.message,
        details: error.validation,
      },
      meta: { requestId, timestamp },
    });
  }

  // Handle Rate Limiting Errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please slow down.',
      },
      meta: { requestId, timestamp },
    });
  }

  const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 600
    ? error.statusCode
    : 500;

  // Log 500 internal server errors
  if (statusCode === 500) {
    request.log.error(error);
  }

  return reply.status(statusCode).send({
    success: false,
    error: {
      code: error.code || ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: statusCode === 500 ? 'An unexpected server error occurred.' : error.message,
    },
    meta: { requestId, timestamp },
  });
}
