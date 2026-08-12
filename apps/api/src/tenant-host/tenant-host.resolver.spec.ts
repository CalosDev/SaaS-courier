import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { AuthenticatedRequest } from '../auth/http/authenticated-request.type';
import { OrganizationNotFoundError } from '../organizations/organization.errors';
import type { OrganizationsService } from '../organizations/organizations.service';
import { TenantHostResolver } from './tenant-host.resolver';

describe('TenantHostResolver', () => {
  const organization = {
    id: '4f486262-1cc5-4422-8e9c-322a2c2173a2',
    slug: 'courier-a',
    status: 'ACTIVE',
  };

  function createResolver(
    configuration: Record<string, string> = {},
    getBySlug = jest.fn().mockResolvedValue(organization),
  ) {
    const config = {
      get: jest.fn((key: string) => configuration[key]),
    } as unknown as ConfigService;
    const organizations = { getBySlug } as unknown as OrganizationsService;

    return {
      resolver: new TenantHostResolver(config, organizations),
      getBySlug,
    };
  }

  function request(hostname: string): AuthenticatedRequest {
    return { hostname } as AuthenticatedRequest;
  }

  it('does not resolve hosts when tenant subdomains are disabled', async () => {
    const { resolver, getBySlug } = createResolver({
      TENANT_SUBDOMAINS_ENABLED: 'false',
    });

    await expect(resolver.resolve(request('localhost'))).resolves.toBeNull();
    expect(getBySlug).not.toHaveBeenCalled();
  });

  it('normalizes a tenant hostname and attaches the resolved context', async () => {
    const { resolver, getBySlug } = createResolver({
      TENANT_SUBDOMAINS_ENABLED: 'true',
      APP_BASE_DOMAIN: 'platform.test',
    });
    const incoming = request('Courier-A.Platform.Test.');

    await expect(resolver.resolve(incoming)).resolves.toEqual({
      organizationId: organization.id,
      organizationSlug: organization.slug,
    });
    expect(getBySlug).toHaveBeenCalledWith('courier-a');
    expect(incoming.tenantHost?.organizationId).toBe(organization.id);
  });

  it('allows bare localhost only outside production when explicitly enabled', async () => {
    const previousNodeEnvironment = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const { resolver, getBySlug } = createResolver({
      TENANT_SUBDOMAINS_ENABLED: 'true',
      TENANT_ALLOW_BARE_LOCALHOST: 'true',
      APP_BASE_DOMAIN: 'localhost',
    });

    try {
      await expect(resolver.resolve(request('localhost'))).resolves.toBeNull();
      expect(getBySlug).not.toHaveBeenCalled();
    } finally {
      process.env.NODE_ENV = previousNodeEnvironment;
    }
  });

  it.each([
    ['platform.test'],
    ['courier-a.other.test'],
    ['nested.courier-a.platform.test'],
    ['-invalid.platform.test'],
  ])('rejects an invalid or non-tenant host: %s', async (hostname) => {
    const { resolver } = createResolver({
      TENANT_SUBDOMAINS_ENABLED: 'true',
      APP_BASE_DOMAIN: 'platform.test',
    });

    await expect(resolver.resolve(request(hostname))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('does not reveal missing or inactive organizations', async () => {
    const missing = createResolver(
      {
        TENANT_SUBDOMAINS_ENABLED: 'true',
        APP_BASE_DOMAIN: 'platform.test',
      },
      jest.fn().mockRejectedValue(new OrganizationNotFoundError('missing')),
    );
    const inactive = createResolver(
      {
        TENANT_SUBDOMAINS_ENABLED: 'true',
        APP_BASE_DOMAIN: 'platform.test',
      },
      jest.fn().mockResolvedValue({ ...organization, status: 'SUSPENDED' }),
    );

    await expect(
      missing.resolver.resolve(request('missing.platform.test')),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      inactive.resolver.resolve(request('courier-a.platform.test')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
