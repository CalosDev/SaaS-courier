import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ObjectStorageService } from './object-storage.service';
import {
  S3ObjectStorageConfig,
  S3ObjectStorageService,
} from './s3-object-storage.service';
import { UnconfiguredObjectStorageService } from './unconfigured-object-storage.service';

@Module({
  providers: [
    {
      provide: ObjectStorageService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const config = loadStorageConfig(configService);

        if (!config) {
          return new UnconfiguredObjectStorageService();
        }

        return new S3ObjectStorageService(config);
      },
    },
  ],
  exports: [ObjectStorageService],
})
export class StorageModule {}

function loadStorageConfig(
  configService: ConfigService,
): S3ObjectStorageConfig | null {
  const endpoint = text(configService.get<string>('S3_ENDPOINT'));
  const region = text(configService.get<string>('S3_REGION'));
  const bucketName = text(configService.get<string>('S3_BUCKET'));
  const accessKeyId = text(configService.get<string>('S3_ACCESS_KEY'));
  const secretAccessKey = text(configService.get<string>('S3_SECRET_KEY'));

  if (!endpoint || !region || !bucketName || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return {
    endpoint,
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: parseBoolean(
      configService.get<string>('S3_FORCE_PATH_STYLE'),
      true,
    ),
  };
}

function text(value: string | undefined): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length > 0 ? normalized : null;
}

function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  const normalized = value?.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return defaultValue;
}
