import { Module } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { CustomersModule } from '../customers/customers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { PackageCodeService } from './package-code.service';
import { PackageDocumentsController } from './package-documents.controller';
import { PackageDocumentsRepository } from './package-documents.repository';
import { PackageDocumentsService } from './package-documents.service';
import { PackageReceptionsController } from './package-receptions.controller';
import { PackageReceptionsRepository } from './package-receptions.repository';
import { PackageReceptionsService } from './package-receptions.service';
import { PackagesController } from './packages.controller';
import { PackagesRepository } from './packages.repository';
import { PrismaPackageDocumentsRepository } from './prisma-package-documents.repository';
import { PackagesService } from './packages.service';
import { PrismaPackageReceptionsRepository } from './prisma-package-receptions.repository';
import { PrismaPackagesRepository } from './prisma-packages.repository';

@Module({
  imports: [PrismaModule, CustomersModule, StorageModule],
  controllers: [
    PackagesController,
    PackageReceptionsController,
    PackageDocumentsController,
  ],
  providers: [
    ExternalTrackingNormalizer,
    PackageCodeService,
    PackageDocumentsService,
    PackageReceptionsService,
    PrismaPackageDocumentsRepository,
    PrismaPackageReceptionsRepository,
    PackagesService,
    PrismaPackagesRepository,
    {
      provide: PackagesRepository,
      useExisting: PrismaPackagesRepository,
    },
    {
      provide: PackageReceptionsRepository,
      useExisting: PrismaPackageReceptionsRepository,
    },
    {
      provide: PackageDocumentsRepository,
      useExisting: PrismaPackageDocumentsRepository,
    },
  ],
  exports: [
    PackageDocumentsService,
    PackageDocumentsRepository,
    PackageReceptionsService,
    PackageReceptionsRepository,
    PackagesService,
    PackagesRepository,
  ],
})
export class PackagesModule {}
