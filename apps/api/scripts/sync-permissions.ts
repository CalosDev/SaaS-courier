import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { RbacService } from '../src/rbac/rbac.service';

async function main(): Promise<void> {
  const applicationContext = await NestFactory.createApplicationContext(
    AppModule,
    {
      logger: ['error', 'warn'],
    },
  );

  try {
    const rbacService = applicationContext.get(RbacService);
    const result = await rbacService.syncPermissionCatalog();

    console.log(
      [
        'Permission catalog synchronized',
        `inserted=${result.inserted}`,
        `updated=${result.updated}`,
        `reactivated=${result.reactivated}`,
        `unchanged=${result.unchanged}`,
        `total=${result.totalActiveCatalogPermissions}`,
      ].join(' '),
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unknown permission synchronization error';

    console.error(`Permission catalog synchronization failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await applicationContext.close();
  }
}

void main();
