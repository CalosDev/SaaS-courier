import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentSession } from '../auth/http/current-session.decorator';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';
import type { SessionContext } from '../sessions/session.types';
import type { CommandContext } from '../request-context/request-context.types';
import { CurrentCommandContext } from '../request-context/current-command-context.decorator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ApplyPaymentDto } from './dto/apply-payment.dto';
import { VoidReasonDto } from './dto/void-reason.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequirePermissions('payments.manage')
  async create(
    @CurrentSession() session: SessionContext,
    @Body() body: CreatePaymentDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.paymentsService.createPayment(
      session.organizationId,
      body,
      context,
    );
  }

  @Get()
  @RequirePermissions('billing.read')
  async list(@CurrentSession() session: SessionContext) {
    const items = await this.paymentsService.listPayments(
      session.organizationId,
    );
    return { items };
  }

  @Get(':paymentId')
  @RequirePermissions('billing.read')
  async get(
    @CurrentSession() session: SessionContext,
    @Param('paymentId') paymentId: string,
  ) {
    return this.paymentsService.getPayment(session.organizationId, paymentId);
  }

  @Post(':paymentId/apply')
  @RequirePermissions('payments.manage')
  async apply(
    @CurrentSession() session: SessionContext,
    @Param('paymentId') paymentId: string,
    @Body() body: ApplyPaymentDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.paymentsService.applyPayment(
      session.organizationId,
      paymentId,
      body,
      context,
    );
  }

  @Post(':paymentId/void')
  @RequirePermissions('payments.manage')
  async voidPayment(
    @CurrentSession() session: SessionContext,
    @Param('paymentId') paymentId: string,
    @Body() body: VoidReasonDto,
    @CurrentCommandContext() context: CommandContext,
  ) {
    return this.paymentsService.voidPayment(
      session.organizationId,
      paymentId,
      body,
      context,
    );
  }
}
