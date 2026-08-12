import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { AuthenticatedRequest } from '../auth/http/authenticated-request.type';
import type { RequestWithMetadata } from '../request-context/request-context.types';
import { IS_TENANT_HOST_EXEMPT } from './tenant-host-exempt.decorator';
import { TenantHostResolver } from './tenant-host.resolver';

@Injectable()
export class TenantHostGuard implements CanActivate {
  private readonly logger = new Logger(TenantHostGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly resolver: TenantHostResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'http'>() !== 'http' || this.isExempt(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantHost = await this.resolver.resolve(request);

    if (
      tenantHost &&
      request.auth &&
      tenantHost.organizationId !== request.auth.organizationId
    ) {
      this.logger.warn({
        message: 'Tenant host validation rejected request',
        reason: 'SESSION_TENANT_MISMATCH',
        requestId: (request as Partial<RequestWithMetadata>).requestMetadata
          ?.requestId,
      });
      throw new ForbiddenException('Tenant host does not match session');
    }

    return true;
  }

  private isExempt(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_TENANT_HOST_EXEMPT, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }
}
