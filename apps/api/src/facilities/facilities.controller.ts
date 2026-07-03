import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CreateFacilityDto } from './dto/create-facility.dto';
import { ListFacilitiesDto } from './dto/list-facilities.dto';
import { UpdateFacilityDto } from './dto/update-facility.dto';
import type { FacilityListResult, FacilityRecord } from './facility.types';
import { FacilitiesService } from './facilities.service';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';

@Controller('facilities')
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @RequirePermissions('facilities.read')
  async listFacilities(
    @CurrentSession() session: SessionContext,
    @Query() query: ListFacilitiesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const facilities = await this.facilitiesService.list(
      session.organizationId,
      query,
    );

    return this.serializeFacilityList(facilities);
  }

  @Post()
  @RequirePermissions('facilities.manage')
  @HttpCode(201)
  async createFacility(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateFacilityDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const facility = await this.facilitiesService.create(
      session.organizationId,
      body,
      context,
    );

    return this.serializeFacility(facility);
  }

  @Get(':facilityId')
  @RequirePermissions('facilities.read')
  async getFacility(
    @CurrentSession() session: SessionContext,
    @Param('facilityId', new ParseUUIDPipe({ version: '4' }))
    facilityId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const facility = await this.facilitiesService.getById(
      session.organizationId,
      facilityId,
    );

    return this.serializeFacility(facility);
  }

  @Patch(':facilityId')
  @RequirePermissions('facilities.manage')
  async updateFacility(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('facilityId', new ParseUUIDPipe({ version: '4' }))
    facilityId: string,
    @Body() body: UpdateFacilityDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const facility = await this.facilitiesService.update(
      session.organizationId,
      facilityId,
      body,
      context,
    );

    return this.serializeFacility(facility);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeFacilityList(result: FacilityListResult) {
    return {
      items: result.items.map((facility) => this.serializeFacility(facility)),
      pagination: result.pagination,
    };
  }

  private serializeFacility(facility: FacilityRecord) {
    return {
      id: facility.id,
      code: facility.code,
      name: facility.name,
      type: facility.type,
      ownershipType: facility.ownershipType,
      countryCode: facility.countryCode,
      province: facility.province,
      city: facility.city,
      addressLine1: facility.addressLine1,
      addressLine2: facility.addressLine2,
      phone: facility.phone,
      email: facility.email,
      isCustomerFacing: facility.isCustomerFacing,
      isPackageOrigin: facility.isPackageOrigin,
      isDistributionCenter: facility.isDistributionCenter,
      isActive: facility.isActive,
      createdAt: facility.createdAt.toISOString(),
      updatedAt: facility.updatedAt.toISOString(),
    };
  }
}
