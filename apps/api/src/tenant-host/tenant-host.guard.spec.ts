import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { SessionContext } from '../sessions/session.types';
import { TenantHostGuard } from './tenant-host.guard';
import type { TenantHostResolver } from './tenant-host.resolver';

describe('TenantHostGuard', () => {
  const organizationId = '4f486262-1cc5-4422-8e9c-322a2c2173a2';
  const tenantHost = { organizationId, organizationSlug: 'courier-a' };

  function context(request: Record<string, unknown>): ExecutionContext {
    return {
      getType: jest.fn().mockReturnValue('http'),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  }

  function guard(
    exempt: boolean,
    resolve = jest.fn().mockResolvedValue(tenantHost),
  ) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(exempt),
    } as unknown as Reflector;
    return {
      guard: new TenantHostGuard(reflector, {
        resolve,
      } as unknown as TenantHostResolver),
      resolve,
    };
  }

  it('does not resolve explicitly exempt routes', async () => {
    const subject = guard(true);

    await expect(subject.guard.canActivate(context({}))).resolves.toBe(true);
    expect(subject.resolve).not.toHaveBeenCalled();
  });

  it('allows a session that matches the resolved tenant', async () => {
    const subject = guard(false);
    const request = {
      auth: { organizationId } as SessionContext,
    };

    await expect(subject.guard.canActivate(context(request))).resolves.toBe(
      true,
    );
  });

  it('rejects a valid session reused from another tenant host', async () => {
    const subject = guard(false);
    const request = {
      auth: {
        organizationId: '5aaf3d8b-4168-4228-bd88-3ef0c25a3293',
      } as SessionContext,
      requestMetadata: { requestId: 'request-1' },
    };

    await expect(
      subject.guard.canActivate(context(request)),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
