import { Body, Controller, Get, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import type { OrganizationRecord } from './organization.types';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('current')
  @RequirePermissions('organizations.read')
  async getCurrentOrganization(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const organization = await this.organizationsService.getById(
      session.organizationId,
    );

    return this.serializeOrganization(organization);
  }

  @Patch('current')
  @RequirePermissions('organizations.manage')
  async updateCurrentOrganization(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
    @Body() body: UpdateCurrentOrganizationDto,
  ) {
    this.setNoStore(response);

    const organization = await this.organizationsService.updateProfile(
      session.organizationId,
      body,
    );

    return this.serializeOrganization(organization);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeOrganization(organization: OrganizationRecord) {
    return {
      id: organization.id,
      legalName: organization.legalName,
      commercialName: organization.commercialName,
      slug: organization.slug,
      rnc: organization.rnc,
      email: organization.email,
      phone: organization.phone,
      countryCode: organization.countryCode,
      currencyCode: organization.currencyCode,
      timezone: organization.timezone,
      status: organization.status,
      planCode: organization.planCode,
      maxUsers: organization.maxUsers,
      maxFacilities: organization.maxFacilities,
      trialEndsAt: organization.trialEndsAt?.toISOString() ?? null,
      createdAt: organization.createdAt.toISOString(),
      updatedAt: organization.updatedAt.toISOString(),
    };
  }
}
