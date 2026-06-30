import {
  UnauthorizedException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';

import type { SessionContext } from '../../sessions/session.types';
import type { AuthenticatedRequest } from './authenticated-request.type';

export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): SessionContext => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.auth) {
      throw new UnauthorizedException();
    }

    return request.auth;
  },
);
