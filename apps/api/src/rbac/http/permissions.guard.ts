import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InvalidSessionTokenError } from '../../sessions/session.errors';
import { IS_PUBLIC_ROUTE } from '../../auth/http/public.decorator';
import type { AuthenticatedRequest } from '../../auth/http/authenticated-request.type';
import type { PermissionCode } from '../permission.catalog';
import { RbacService } from '../rbac.service';
import {
  AUTHENTICATED_ONLY_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from './authorization.constants';
import {
  AuthorizationPolicyMissingError,
  InsufficientPermissionsError,
} from './authorization.errors';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<'http'>() !== 'http') {
      return true;
    }

    if (this.isPublicRoute(context)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request.auth;
    const requiredPermissions = this.getRequiredPermissions(context);
    const isAuthenticatedOnlyRoute = this.isAuthenticatedOnlyRoute(context);

    if (!session) {
      throw new InvalidSessionTokenError();
    }

    if (requiredPermissions.length === 0) {
      if (isAuthenticatedOnlyRoute) {
        return true;
      }

      throw new AuthorizationPolicyMissingError();
    }

    const effectivePermissionCodes =
      await this.rbacService.getEffectivePermissionCodes({
        organizationId: session.organizationId,
        employeeId: session.employeeId,
      });
    const effectivePermissions = new Set(effectivePermissionCodes);

    if (
      requiredPermissions.some(
        (permission) => !effectivePermissions.has(permission),
      )
    ) {
      throw new InsufficientPermissionsError();
    }

    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private isAuthenticatedOnlyRoute(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) === true
    );
  }

  private getRequiredPermissions(
    context: ExecutionContext,
  ): readonly PermissionCode[] {
    const permissions =
      this.reflector.getAllAndMerge<readonly PermissionCode[]>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];

    return [...new Set(permissions)];
  }
}
