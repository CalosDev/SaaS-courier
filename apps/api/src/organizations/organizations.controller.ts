import { Body, Controller, Get, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';

import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import type { OrganizationRecord } from './organization.types';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { UpdateCurrentOrganizationDto } from './dto/update-current-organization.dto';
import { OrganizationsService } from './organizations.service';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { UpdateOrganizationRegulatoryProfileDto } from './dto/update-organization-regulatory-profile.dto';
import { OrganizationRegulatoryProfileService } from './organization-regulatory-profile.service';
import type { OrganizationRegulatoryProfileRecord } from './organization-regulatory-profile.types';

@Controller('organizations')
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly regulatoryProfiles: OrganizationRegulatoryProfileService,
  ) {}

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
    @CurrentCommandContext() context: CommandContext,
    @Res({ passthrough: true }) response: Response,
    @Body() body: UpdateCurrentOrganizationDto,
  ) {
    this.setNoStore(response);

    const organization = await this.organizationsService.updateProfile(
      session.organizationId,
      body,
      context,
    );

    return this.serializeOrganization(organization);
  }

  @Get('current/regulatory-profile')
  @RequirePermissions('organizations.read')
  async getCurrentRegulatoryProfile(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);
    return this.serializeRegulatoryProfile(
      await this.regulatoryProfiles.getCurrent(session.organizationId),
    );
  }

  @Patch('current/regulatory-profile')
  @RequirePermissions('organizations.manage')
  async updateCurrentRegulatoryProfile(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Res({ passthrough: true }) response: Response,
    @Body() body: UpdateOrganizationRegulatoryProfileDto,
  ) {
    this.setNoStore(response);
    return this.serializeRegulatoryProfile(
      await this.regulatoryProfiles.updateCurrent(
        session.organizationId,
        body,
        context,
      ),
    );
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

  private serializeRegulatoryProfile(
    profile: OrganizationRegulatoryProfileRecord,
  ) {
    return {
      fiscalAddress: profile.fiscalAddress,
      authorizedRepresentativeName: profile.authorizedRepresentativeName,
      authorizedRepresentativeEmail: profile.authorizedRepresentativeEmail,
      authorizedRepresentativePhone: profile.authorizedRepresentativePhone,
      courierRegistrationStatus: profile.courierRegistrationStatus,
      dgaOperatorCode: profile.dgaOperatorCode,
      electronicInvoicingStatus: profile.electronicInvoicingStatus,
      declaredAt: profile.declaredAt?.toISOString() ?? null,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
