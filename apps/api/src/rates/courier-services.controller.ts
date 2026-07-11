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
import { CreateCourierServiceDto } from './dto/create-courier-service.dto';
import { ListCourierServicesDto } from './dto/list-courier-services.dto';
import { UpdateCourierServiceDto } from './dto/update-courier-service.dto';
import { RatesService } from './rates.service';
import type {
  CourierServiceListResult,
  CourierServiceRecord,
} from './rates.types';

@Controller('services')
export class CourierServicesController {
  constructor(private readonly ratesService: RatesService) {}

  @Get()
  @RequirePermissions('rates.read')
  async listServices(
    @CurrentSession() session: SessionContext,
    @Query() query: ListCourierServicesDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeServiceList(
      await this.ratesService.listServices(session.organizationId, query),
    );
  }

  @Post()
  @RequirePermissions('rates.manage')
  @HttpCode(201)
  async createService(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateCourierServiceDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeService(
      await this.ratesService.createService(
        session.organizationId,
        body,
        context,
      ),
    );
  }

  @Patch(':serviceId')
  @RequirePermissions('rates.manage')
  async updateService(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('serviceId', new ParseUUIDPipe({ version: '4' })) serviceId: string,
    @Body() body: UpdateCourierServiceDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    return this.serializeService(
      await this.ratesService.updateService(
        session.organizationId,
        serviceId,
        body,
        context,
      ),
    );
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private serializeServiceList(result: CourierServiceListResult) {
    return {
      items: result.items.map((item) => this.serializeService(item)),
      pagination: result.pagination,
    };
  }

  private serializeService(record: CourierServiceRecord) {
    return {
      id: record.id,
      code: record.code,
      name: record.name,
      description: record.description,
      isActive: record.isActive,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
