import { Module } from '@nestjs/common';
import { BillingRepository } from './billing.repository';
import { InvoicesController } from './invoices.controller';
import { PaymentsController } from './payments.controller';
import { InvoicesService } from './invoices.service';
import { PaymentsService } from './payments.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InvoicesController, PaymentsController],
  providers: [BillingRepository, InvoicesService, PaymentsService],
  exports: [InvoicesService, PaymentsService],
})
export class BillingModule {}
