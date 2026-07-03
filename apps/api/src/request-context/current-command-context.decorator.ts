import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  CommandContext,
  RequestWithMetadata,
} from './request-context.types';

export function buildCurrentCommandContext(
  request: RequestWithMetadata,
): CommandContext {
  if (!request.auth) {
    throw new UnauthorizedException('Authentication is required');
  }

  return {
    organizationId: request.auth.organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: request.auth.userId,
    actorEmployeeId: request.auth.employeeId,
    source: 'HTTP',
    requestId: request.requestMetadata.requestId,
    correlationId: request.requestMetadata.correlationId,
    ipAddress: request.requestMetadata.ipAddress,
    userAgent: request.requestMetadata.userAgent,
  };
}

export const CurrentCommandContext = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CommandContext =>
    buildCurrentCommandContext(
      context.switchToHttp().getRequest<RequestWithMetadata>(),
    ),
);
