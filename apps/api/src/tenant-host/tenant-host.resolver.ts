import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AuthenticatedRequest } from '../auth/http/authenticated-request.type';
import { OrganizationNotFoundError } from '../organizations/organization.errors';
import { OrganizationsService } from '../organizations/organizations.service';
import type { TenantHostContext } from './tenant-host.types';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

@Injectable()
export class TenantHostResolver {
  constructor(
    private readonly config: ConfigService,
    private readonly organizations: OrganizationsService,
  ) {}

  async resolve(
    request: AuthenticatedRequest,
  ): Promise<TenantHostContext | null> {
    if (this.config.get<string>('TENANT_SUBDOMAINS_ENABLED') !== 'true') {
      return null;
    }

    const hostname = this.normalizeHostname(request.hostname);
    if (this.isAllowedBareLocalhost(hostname)) {
      return null;
    }

    const baseDomain = this.normalizeHostname(
      this.config.get<string>('APP_BASE_DOMAIN') ?? '',
    );
    const suffix = `.${baseDomain}`;

    if (!hostname.endsWith(suffix)) {
      throw this.notFound();
    }

    const slug = hostname.slice(0, -suffix.length);
    if (!SLUG_PATTERN.test(slug)) {
      throw this.notFound();
    }

    try {
      const organization = await this.organizations.getBySlug(slug);
      if (!['ACTIVE', 'TRIAL'].includes(organization.status)) {
        throw this.notFound();
      }

      const tenantHost = {
        organizationId: organization.id,
        organizationSlug: organization.slug,
      };
      request.tenantHost = tenantHost;
      return tenantHost;
    } catch (error) {
      if (error instanceof OrganizationNotFoundError) {
        throw this.notFound();
      }
      throw error;
    }
  }

  private normalizeHostname(value: string): string {
    const normalized = value.trim().toLowerCase().replace(/\.$/, '');
    const withoutBrackets =
      normalized.startsWith('[') && normalized.endsWith(']')
        ? normalized.slice(1, -1)
        : normalized;

    if (!withoutBrackets || withoutBrackets.length > 253) {
      throw this.notFound();
    }

    if (LOCAL_HOSTS.has(withoutBrackets)) {
      return withoutBrackets;
    }

    const labels = withoutBrackets.split('.');
    if (
      labels.some(
        (label) =>
          !label ||
          label.length > 63 ||
          !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label),
      )
    ) {
      throw this.notFound();
    }

    return withoutBrackets;
  }

  private isAllowedBareLocalhost(hostname: string): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      this.config.get<string>('TENANT_ALLOW_BARE_LOCALHOST') === 'true' &&
      LOCAL_HOSTS.has(hostname)
    );
  }

  private notFound(): NotFoundException {
    return new NotFoundException('Tenant host was not found');
  }
}
