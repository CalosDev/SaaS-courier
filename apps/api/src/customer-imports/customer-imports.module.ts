import { Module } from '@nestjs/common';
import { CustomerCodeService } from '../customers/customer-code.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomerImportsController } from './customer-imports.controller';
import { CustomerImportsRepository } from './customer-imports.repository';
import { CustomerImportsService } from './customer-imports.service';
import { PrismaCustomerImportsRepository } from './prisma-customer-imports.repository';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerImportsController],
  providers: [
    CustomerCodeService,
    CustomerImportsService,
    PrismaCustomerImportsRepository,
    {
      provide: CustomerImportsRepository,
      useExisting: PrismaCustomerImportsRepository,
    },
  ],
  exports: [CustomerImportsService],
})
export class CustomerImportsModule {}
