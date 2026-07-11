import { Module } from '@nestjs/common';
import { SigaApiService } from './siga-api.service';

@Module({
  providers: [SigaApiService],
  exports: [SigaApiService],
})
export class SigaIntegrationModule {}
