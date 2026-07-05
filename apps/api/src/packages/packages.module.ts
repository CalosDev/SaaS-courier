import { Module } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { CustomersModule } from '../customers/customers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PackageCodeService } from './package-code.service';
import { PackagesController } from './packages.controller';
import { PackagesRepository } from './packages.repository';
import { PackagesService } from './packages.service';
import { PrismaPackagesRepository } from './prisma-packages.repository';

@Module({
  imports: [PrismaModule, CustomersModule],
  controllers: [PackagesController],
  providers: [
    ExternalTrackingNormalizer,
    PackageCodeService,
    PackagesService,
    PrismaPackagesRepository,
    {
      provide: PackagesRepository,
      useExisting: PrismaPackagesRepository,
    },
  ],
  exports: [PackagesService, PackagesRepository],
})
export class PackagesModule {}
