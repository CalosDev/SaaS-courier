import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import type { CommandContext } from '../request-context/request-context.types';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { VoidReasonDto } from './dto/void-reason.dto';

@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @RequirePermissions('billing.manage')
  async create(
    @CurrentSession() session: SessionContext,
    @Body() body: CreateInvoiceDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    try {
      return await this.invoicesService.createInvoice(
        session.organizationId,
        body,
        context,
      );
    } catch (error) {
      console.error('INVOICE CREATE ERROR:', error);
      throw error;
    }
  }

  @Get()
  @RequirePermissions('billing.read')
  async list(@CurrentSession() session: SessionContext) {
    const items = await this.invoicesService.listInvoices(
      session.organizationId,
    );
    return { items };
  }

  @Get(':invoiceId')
  @RequirePermissions('billing.read')
  async get(
    @CurrentSession() session: SessionContext,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.getInvoice(session.organizationId, invoiceId);
  }

  @Patch(':invoiceId')
  @RequirePermissions('billing.manage')
  async update(
    @CurrentSession() session: SessionContext,
    @Param('invoiceId') invoiceId: string,
    @Body() body: UpdateInvoiceDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.invoicesService.updateInvoice(
      session.organizationId,
      invoiceId,
      body,
      context,
    );
  }

  @Post(':invoiceId/issue')
  @RequirePermissions('billing.manage')
  async issue(
    @CurrentSession() session: SessionContext,
    @Param('invoiceId') invoiceId: string,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.invoicesService.issueInvoice(
      session.organizationId,
      invoiceId,
      context,
    );
  }

  @Post(':invoiceId/void')
  @RequirePermissions('billing.manage')
  async voidInvoice(
    @CurrentSession() session: SessionContext,
    @Param('invoiceId') invoiceId: string,
    @Body() body: VoidReasonDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.invoicesService.voidInvoice(
      session.organizationId,
      invoiceId,
      body,
      context,
    );
  }
}
