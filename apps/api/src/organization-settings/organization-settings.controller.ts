import { Body, Controller, Get, Patch, Post, Res } from '@nestjs/common';
import { HttpCode } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { OnboardingService } from './onboarding.service';
import { UpdateCurrentOrganizationSettingsDto } from './dto/update-current-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';
import type {
  OnboardingRecord,
  OrganizationCapabilitiesRecord,
  OrganizationSettingsCurrentRecord,
} from './organization-settings.types';

@Controller('organizations/current')
export class OrganizationSettingsController {
  constructor(
    private readonly organizationSettingsService: OrganizationSettingsService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Get('settings')
  @RequirePermissions('organizations.read')
  async getCurrentSettings(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeSettings(
      await this.organizationSettingsService.getCurrent(session.organizationId),
    );
  }

  @Patch('settings')
  @RequirePermissions('organizations.manage')
  async updateCurrentSettings(
    @CurrentSession() session: SessionContext,
    @Body() body: UpdateCurrentOrganizationSettingsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeSettings(
      await this.organizationSettingsService.updateCurrent(
        session.organizationId,
        body,
      ),
    );
  }

  @Get('capabilities')
  @RequirePermissions('organizations.read')
  async getCapabilities(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeCapabilities(
      await this.organizationSettingsService.getCapabilities(
        session.organizationId,
      ),
    );
  }

  @Get('onboarding')
  @RequirePermissions('organizations.read')
  async getOnboarding(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeOnboarding(
      await this.onboardingService.getCurrent(session.organizationId),
    );
  }

  @Post('onboarding/complete')
  @RequirePermissions('organizations.manage')
  @HttpCode(200)
  async completeOnboarding(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeOnboarding(
      await this.onboardingService.complete(session.organizationId),
    );
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeSettings(record: OrganizationSettingsCurrentRecord) {
    return {
      locale: record.settings.locale,
      dateFormat: record.settings.dateFormat,
      weightUnit: record.settings.weightUnit,
      dimensionUnit: record.settings.dimensionUnit,
      timezone: record.organization.timezone,
      currencyCode: record.organization.currencyCode,
      countryCode: record.organization.countryCode,
      customerCodeStrategy: record.settings.customerCodeStrategy,
      customerCodePrefix: record.settings.customerCodePrefix,
      customerCodeRandomLength: record.settings.customerCodeRandomLength,
      customerCodeSequencePadding: record.settings.customerCodeSequencePadding,
      onboardingCompletedAt:
        record.settings.onboardingCompletedAt?.toISOString() ?? null,
      createdAt: record.settings.createdAt.toISOString(),
      updatedAt: record.settings.updatedAt.toISOString(),
    };
  }

  private serializeCapabilities(record: OrganizationCapabilitiesRecord) {
    return record;
  }

  private serializeOnboarding(record: OnboardingRecord) {
    return {
      status: record.status,
      completedAt: record.completedAt?.toISOString() ?? null,
      steps: record.steps,
    };
  }
}
