import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { CarrierConnectionsController } from './carrier-connections.controller';
import { CarrierConnectionsService } from './carrier-connections.service';
import { CarrierSecretProvider } from './carrier-secret.provider';
import { CarrierWebhooksController } from './carrier-webhooks.controller';
import { PackageCarrierEventsController } from './package-carrier-events.controller';

@Module({
  imports: [PrismaModule],
  controllers: [
    CarrierConnectionsController,
    CarrierWebhooksController,
    PackageCarrierEventsController,
  ],
  providers: [
    CarrierConnectionsService,
    CarrierSecretProvider,
    ExternalTrackingNormalizer,
  ],
  exports: [CarrierConnectionsService],
})
export class CarrierIntegrationsModule {}
