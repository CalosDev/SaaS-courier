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
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import { CancelPackageDto } from './dto/cancel-package.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { ListPackagesDto } from './dto/list-packages.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import { PackagesService } from './packages.service';
import type {
  PackageEmployeeSummary,
  PackageListResult,
  PackageRecord,
} from './package.types';

@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Get()
  @RequirePermissions('packages.read')
  async listPackages(
    @CurrentSession() session: SessionContext,
    @Query() query: ListPackagesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.packagesService.list(
      session.organizationId,
      query,
    );

    return this.serializeList(result);
  }

  @Post()
  @RequirePermissions('packages.manage')
  @HttpCode(201)
  async createPackage(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreatePackageDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const packageRecord = await this.packagesService.create(
      session.organizationId,
      body,
      context,
    );

    return this.serializeSummary(packageRecord);
  }

  @Get(':packageId')
  @RequirePermissions('packages.read')
  async getPackage(
    @CurrentSession() session: SessionContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const packageRecord = await this.packagesService.getById(
      session.organizationId,
      packageId,
    );

    return this.serializeDetail(packageRecord);
  }

  @Patch(':packageId')
  @RequirePermissions('packages.manage')
  async updatePackage(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() body: UpdatePackageDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const packageRecord = await this.packagesService.update(
      session.organizationId,
      packageId,
      body,
      context,
    );

    return this.serializeDetail(packageRecord);
  }

  @Post(':packageId/cancel')
  @RequirePermissions('packages.manage')
  @HttpCode(200)
  async cancelPackage(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('packageId', new ParseUUIDPipe({ version: '4' })) packageId: string,
    @Body() body: CancelPackageDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const packageRecord = await this.packagesService.cancel(
      session.organizationId,
      packageId,
      body,
      context,
    );

    return this.serializeDetail(packageRecord);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeList(result: PackageListResult) {
    return {
      items: result.items.map((packageRecord) =>
        this.serializeSummary(packageRecord),
      ),
      pagination: result.pagination,
    };
  }

  private serializeSummary(packageRecord: PackageRecord) {
    return {
      id: packageRecord.id,
      internalTrackingNumber: packageRecord.internalTrackingNumber,
      externalTrackingNumber: packageRecord.externalTrackingNumber,
      status: packageRecord.status,
      source: packageRecord.source,
      customer: packageRecord.customer,
      prealert: packageRecord.prealert,
      registeredAt: packageRecord.registeredAt.toISOString(),
      createdAt: packageRecord.createdAt.toISOString(),
      updatedAt: packageRecord.updatedAt.toISOString(),
    };
  }

  private serializeDetail(packageRecord: PackageRecord) {
    return {
      ...this.serializeSummary(packageRecord),
      notes: packageRecord.notes,
      cancellationReason: packageRecord.cancellationReason,
      cancelledAt: packageRecord.cancelledAt?.toISOString() ?? null,
      registeredBy: this.serializeEmployee(packageRecord.registeredBy),
      cancelledBy: packageRecord.cancelledBy
        ? this.serializeEmployee(packageRecord.cancelledBy)
        : null,
    };
  }

  private serializeEmployee(employee: PackageEmployeeSummary) {
    return {
      id: employee.id,
      displayName: employee.displayName,
    };
  }
}
