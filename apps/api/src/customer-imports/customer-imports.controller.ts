import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import type { CommandContext } from '../request-context/request-context.types';
import type { SessionContext } from '../sessions/session.types';
import { CustomerImportsService } from './customer-imports.service';
import { CreateCustomerImportDto } from './dto/create-customer-import.dto';
import type {
  CustomerImportJobRecord,
  CustomerImportRowRecord,
} from './customer-imports.types';

@Controller('customer-imports')
export class CustomerImportsController {
  constructor(
    private readonly customerImportsService: CustomerImportsService,
  ) {}

  @Get()
  @RequirePermissions('customers.read')
  async list(
    @CurrentSession() session: SessionContext,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const jobs = await this.customerImportsService.list(session.organizationId);

    return jobs.map((job) => this.serializeJobSummary(job));
  }

  @Post()
  @RequirePermissions('customers.manage')
  @HttpCode(201)
  async create(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Body() body: CreateCustomerImportDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const job = await this.customerImportsService.create(
      session.organizationId,
      session.employeeId,
      body,
      this.asImportContext(context),
    );

    return this.serializeJobDetail(job);
  }

  @Get(':importId')
  @RequirePermissions('customers.read')
  async getById(
    @CurrentSession() session: SessionContext,
    @Param('importId', new ParseUUIDPipe({ version: '4' }))
    importId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const job = await this.customerImportsService.getById(
      session.organizationId,
      importId,
    );

    return this.serializeJobDetail(job);
  }

  @Post(':importId/validate')
  @RequirePermissions('customers.manage')
  @HttpCode(200)
  async validate(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('importId', new ParseUUIDPipe({ version: '4' }))
    importId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const job = await this.customerImportsService.validate(
      session.organizationId,
      importId,
      this.asImportContext(context),
    );

    return this.serializeJobDetail(job);
  }

  @Post(':importId/commit')
  @RequirePermissions('customers.manage')
  @HttpCode(200)
  async commit(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('importId', new ParseUUIDPipe({ version: '4' }))
    importId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const job = await this.customerImportsService.commit(
      session.organizationId,
      importId,
      this.asImportContext(context),
    );

    return this.serializeJobDetail(job);
  }

  @Post(':importId/cancel')
  @RequirePermissions('customers.manage')
  @HttpCode(200)
  async cancel(
    @CurrentSession() session: SessionContext,
    @CurrentCommandContext() context: CommandContext,
    @Param('importId', new ParseUUIDPipe({ version: '4' }))
    importId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.setNoStore(response);

    const job = await this.customerImportsService.cancel(
      session.organizationId,
      importId,
      this.asImportContext(context),
    );

    return this.serializeJobDetail(job);
  }

  private setNoStore(response: Response): void {
    response.setHeader('Cache-Control', 'no-store');
  }

  private asImportContext(context: CommandContext): CommandContext {
    return { ...context, source: 'IMPORT' };
  }

  private serializeJobSummary(job: CustomerImportJobRecord) {
    return {
      id: job.id,
      name: job.name ?? null,
      status: job.status,
      preserveCustomerCodes: job.preserveCustomerCodes,
      totalRows: job.totalRows,
      validRows: job.validRows ?? 0,
      invalidRows: job.invalidRows ?? 0,
      importedRows: job.importedRows ?? 0,
    };
  }

  private serializeJobDetail(job: CustomerImportJobRecord) {
    return {
      ...this.serializeJobSummary(job),
      rows: (job.rows ?? []).map((row) => this.serializeRow(row)),
    };
  }

  private serializeRow(row: CustomerImportRowRecord) {
    return {
      id: row.id,
      rowNumber: row.rowNumber,
      rawData: row.rawData,
      normalizedData: row.normalizedData ?? null,
      status: row.status,
      validationErrors: row.validationErrors ?? null,
      importedCustomerId: row.importedCustomerId ?? null,
    };
  }
}
