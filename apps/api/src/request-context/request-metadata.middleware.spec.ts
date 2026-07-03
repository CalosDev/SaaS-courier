import type { NextFunction, Request, Response } from 'express';

import { RequestMetadataMiddleware } from './request-metadata.middleware';
import type { RequestWithMetadata } from './request-context.types';

describe('RequestMetadataMiddleware', () => {
  const middleware = new RequestMetadataMiddleware();

  it('generates a server request id and ignores an incoming request id', () => {
    const request = {
      headers: { 'x-request-id': 'client-controlled' },
    } as unknown as RequestWithMetadata;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request as Request, response, next);

    expect(request.requestMetadata.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(request.requestMetadata.requestId).not.toBe('client-controlled');
    expect(setHeader).toHaveBeenCalledWith(
      'X-Request-Id',
      request.requestMetadata.requestId,
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts only safe correlation ids', () => {
    const valid = {
      headers: { 'x-correlation-id': 'import:batch_2026-07.02' },
    } as unknown as RequestWithMetadata;
    middleware.use(
      valid as Request,
      { setHeader: jest.fn() } as unknown as Response,
      jest.fn(),
    );
    expect(valid.requestMetadata.correlationId).toBe('import:batch_2026-07.02');

    const invalid = {
      headers: { 'x-correlation-id': 'unsafe value with spaces' },
    } as unknown as RequestWithMetadata;
    middleware.use(
      invalid as Request,
      { setHeader: jest.fn() } as unknown as Response,
      jest.fn(),
    );
    expect(invalid.requestMetadata.correlationId).toBe(
      invalid.requestMetadata.requestId,
    );
  });
});
