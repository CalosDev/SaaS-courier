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
import { CancelPrealertDto } from './dto/cancel-prealert.dto';
import { CreatePrealertDto } from './dto/create-prealert.dto';
import { ListPrealertsDto } from './dto/list-prealerts.dto';
import { UpdatePrealertDto } from './dto/update-prealert.dto';
import { PrealertsService } from './prealerts.service';
import type {
  PrealertEmployeeSummary,
  PrealertListResult,
  PrealertMatchedPackageSummary,
  PrealertRecord,
} from './prealert.types';

@Controller('prealerts')
export class PrealertsController {
  constructor(private readonly prealertsService: PrealertsService) {}

  @Get()
  @RequirePermissions('prealerts.read')
  async listPrealerts(
    @CurrentSession() session: SessionContext,
    @Query() query: ListPrealertsDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const result = await this.prealertsService.list(
      session.organizationId,
      query,
    );

    return this.serializeList(result);
  }

  @Post()
  @RequirePermissions('prealerts.manage')
  @HttpCode(201)
  async createPrealert(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreatePrealertDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const prealert = await this.prealertsService.create(
      session.organizationId,
      body,
      context,
    );

    return this.serializeSummary(prealert);
  }

  @Get(':prealertId')
  @RequirePermissions('prealerts.read')
  async getPrealert(
    @CurrentSession() session: SessionContext,
    @Param('prealertId', new ParseUUIDPipe({ version: '4' }))
    prealertId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const prealert = await this.prealertsService.getById(
      session.organizationId,
      prealertId,
    );

    return this.serializeDetail(prealert);
  }

  @Patch(':prealertId')
  @RequirePermissions('prealerts.manage')
  async updatePrealert(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('prealertId', new ParseUUIDPipe({ version: '4' }))
    prealertId: string,
    @Body() body: UpdatePrealertDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const prealert = await this.prealertsService.update(
      session.organizationId,
      prealertId,
      body,
      context,
    );

    return this.serializeDetail(prealert);
  }

  @Post(':prealertId/cancel')
  @RequirePermissions('prealerts.manage')
  @HttpCode(200)
  async cancelPrealert(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('prealertId', new ParseUUIDPipe({ version: '4' }))
    prealertId: string,
    @Body() body: CancelPrealertDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const prealert = await this.prealertsService.cancel(
      session.organizationId,
      prealertId,
      body,
      context,
    );

    return this.serializeDetail(prealert);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeList(result: PrealertListResult) {
    return {
      items: result.items.map((prealert) => this.serializeSummary(prealert)),
      pagination: result.pagination,
    };
  }

  private serializeSummary(prealert: PrealertRecord) {
    return {
      id: prealert.id,
      prealertCode: prealert.prealertCode,
      externalTrackingNumber: prealert.externalTrackingNumber,
      carrierName: prealert.carrierName,
      storeName: prealert.storeName,
      purchaseDate: this.serializeDate(prealert.purchaseDate),
      description: prealert.description,
      quantity: prealert.quantity,
      declaredValue: prealert.declaredValue,
      currencyCode: prealert.currencyCode,
      invoiceStatus: prealert.invoiceStatus,
      status: prealert.status,
      customer: prealert.customer,
      matchedPackage: prealert.matchedPackage
        ? this.serializeMatchedPackage(prealert.matchedPackage)
        : null,
      createdAt: prealert.createdAt.toISOString(),
      updatedAt: prealert.updatedAt.toISOString(),
    };
  }

  private serializeDetail(prealert: PrealertRecord) {
    return {
      ...this.serializeSummary(prealert),
      notes: prealert.notes,
      cancellationReason: prealert.cancellationReason,
      cancelledAt: prealert.cancelledAt?.toISOString() ?? null,
      createdBy: this.serializeEmployee(prealert.createdBy),
      cancelledBy: prealert.cancelledBy
        ? this.serializeEmployee(prealert.cancelledBy)
        : null,
    };
  }

  private serializeEmployee(employee: PrealertEmployeeSummary) {
    return {
      id: employee.id,
      displayName: employee.displayName,
    };
  }

  private serializeMatchedPackage(
    packageSummary: PrealertMatchedPackageSummary,
  ) {
    return {
      id: packageSummary.id,
      internalTrackingNumber: packageSummary.internalTrackingNumber,
      status: packageSummary.status,
    };
  }

  private serializeDate(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }
}
