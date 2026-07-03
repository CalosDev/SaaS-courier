import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

import type { RequestWithMetadata } from './request-context.types';

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

@Injectable()
export class RequestMetadataMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestWithMetadata = request as RequestWithMetadata;
    const requestId = randomUUID();
    const incomingCorrelationId = request.headers['x-correlation-id'];
    const correlationId =
      typeof incomingCorrelationId === 'string' &&
      CORRELATION_ID_PATTERN.test(incomingCorrelationId)
        ? incomingCorrelationId
        : requestId;

    requestWithMetadata.requestMetadata = {
      requestId,
      correlationId,
      ipAddress: this.limit(request.ip, 64),
      userAgent: this.limit(request.headers['user-agent'], 512),
    };
    response.setHeader('X-Request-Id', requestId);
    next();
  }

  private limit(value: string | undefined, maxLength: number): string | null {
    if (!value) {
      return null;
    }

    return value.slice(0, maxLength);
  }
}
