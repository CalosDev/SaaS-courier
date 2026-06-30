import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttpApp } from './http/configure-http-app';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = Number(process.env.PORT ?? 4000);

  app.enableShutdownHooks();
  configureHttpApp(app);

  await app.listen(port);
}

void bootstrap();
