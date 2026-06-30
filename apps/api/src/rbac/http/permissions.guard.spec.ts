import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { InvalidSessionTokenError } from '../../sessions/session.errors';
import type { SessionContext } from '../../sessions/session.types';
import { Public } from '../../auth/http/public.decorator';
import { AuthenticatedOnly } from './authenticated-only.decorator';
import {
  AuthorizationPolicyMissingError,
  InsufficientPermissionsError,
} from './authorization.errors';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';

class PublicRouteTarget {
  @Public()
  handler(): void {}
}

class AuthenticatedRouteTarget {
  @AuthenticatedOnly()
  handler(): void {}
}

class UnclassifiedRouteTarget {
  handler(): void {}
}

class PermissionRouteTarget {
  @RequirePermissions('permissions.read')
  handler(): void {}
}

class MultiplePermissionsRouteTarget {
  @RequirePermissions('permissions.read', 'roles.manage')
  handler(): void {}
}

@RequirePermissions('permissions.read')
class CombinedPermissionsTarget {
  @RequirePermissions('roles.manage')
  handler(): void {}
}

class DuplicatePermissionsTarget {
  @RequirePermissions('permissions.read', 'permissions.read')
  handler(): void {}
}

describe('PermissionsGuard', () => {
  const session: SessionContext = {
    sessionId: 'f1f96a7d-c9d8-4c3a-b1d4-664d9d807017',
    userId: '8ff57a40-1e16-46ba-b154-4d0f88f33c9e',
    email: 'permissions.guard@courier.test',
    organizationId: 'b0f61e8d-184b-45fd-9d87-7e44685cb1a4',
    organizationSlug: 'guard-org',
    organizationName: 'Guard Org',
    employeeId: 'c1f17a78-a4d8-43bc-a5cd-fd4e7ee8f414',
    firstName: 'Grace',
    lastName: 'Hopper',
    facilityIds: ['bdb75f86-4432-495d-a113-9d4efba515a5'],
    expiresAt: new Date('2026-06-29T12:00:00.000Z'),
  };

  const rbacService = {
    getEffectivePermissionCodes: jest.fn<Promise<string[]>, [unknown]>(),
  };

  const guard = new PermissionsGuard(new Reflector(), rbacService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createContext(
    target: new () => unknown,
    request: Record<string, unknown>,
    handlerName = 'handler',
  ): ExecutionContext {
    const handler = (
      target.prototype as Record<string, (...args: never[]) => unknown>
    )[handlerName];

    return {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn().mockReturnValue(handler),
      getClass: jest.fn().mockReturnValue(target),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows routes marked as public without consulting RBAC', async () => {
    await expect(
      guard.canActivate(createContext(PublicRouteTarget, {})),
    ).resolves.toBe(true);

    expect(rbacService.getEffectivePermissionCodes).not.toHaveBeenCalled();
  });

  it('allows authenticated-only routes when request.auth is present', async () => {
    await expect(
      guard.canActivate(
        createContext(AuthenticatedRouteTarget, {
          auth: session,
        }),
      ),
    ).resolves.toBe(true);

    expect(rbacService.getEffectivePermissionCodes).not.toHaveBeenCalled();
  });

  it('rejects authenticated-only routes when request.auth is missing', async () => {
    await expect(
      guard.canActivate(createContext(AuthenticatedRouteTarget, {})),
    ).rejects.toBeInstanceOf(InvalidSessionTokenError);
  });

  it('rejects protected routes without an explicit policy', async () => {
    await expect(
      guard.canActivate(
        createContext(UnclassifiedRouteTarget, {
          auth: session,
        }),
      ),
    ).rejects.toBeInstanceOf(AuthorizationPolicyMissingError);
  });

  it('allows access when all required permissions are effective', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'permissions.read',
    ]);

    await expect(
      guard.canActivate(
        createContext(PermissionRouteTarget, {
          auth: session,
        }),
      ),
    ).resolves.toBe(true);

    expect(rbacService.getEffectivePermissionCodes).toHaveBeenCalledTimes(1);
    expect(rbacService.getEffectivePermissionCodes).toHaveBeenCalledWith({
      organizationId: session.organizationId,
      employeeId: session.employeeId,
    });
  });

  it('rejects access when a required permission is missing', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'roles.read',
    ]);

    await expect(
      guard.canActivate(
        createContext(PermissionRouteTarget, {
          auth: session,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it('requires every declared permission', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'permissions.read',
    ]);

    await expect(
      guard.canActivate(
        createContext(MultiplePermissionsRouteTarget, {
          auth: session,
        }),
      ),
    ).rejects.toBeInstanceOf(InsufficientPermissionsError);
  });

  it('combines controller and handler permissions', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'permissions.read',
      'roles.manage',
    ]);

    await expect(
      guard.canActivate(
        createContext(CombinedPermissionsTarget, {
          auth: session,
        }),
      ),
    ).resolves.toBe(true);
  });

  it('deduplicates repeated permissions before evaluation', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'permissions.read',
    ]);

    await expect(
      guard.canActivate(
        createContext(DuplicatePermissionsTarget, {
          auth: session,
        }),
      ),
    ).resolves.toBe(true);
  });

  it('does not inspect request body, query, params, or headers and does not mutate the session', async () => {
    rbacService.getEffectivePermissionCodes.mockResolvedValueOnce([
      'permissions.read',
    ]);

    const request = {
      auth: { ...session },
    } as Record<string, unknown>;

    for (const key of ['body', 'query', 'params', 'headers'] as const) {
      Object.defineProperty(request, key, {
        get() {
          throw new Error(`${key} should not be accessed`);
        },
      });
    }

    const originalSession = { ...(request.auth as SessionContext) };

    await expect(
      guard.canActivate(createContext(PermissionRouteTarget, request)),
    ).resolves.toBe(true);

    expect(request.auth).toEqual(originalSession);
    expect(rbacService.getEffectivePermissionCodes).toHaveBeenCalledTimes(1);
  });
});
