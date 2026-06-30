import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

export function configureHttpApp(app: NestExpressApplication): void {
  const allowedOrigins = loadAllowedOrigins();

  app.use(
    helmet({
      hsts: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      callback(null, allowedOrigins.includes(origin));
    },
    methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );
}

function loadAllowedOrigins(): string[] {
  const rawOrigins = process.env.CORS_ORIGINS ?? 'http://localhost:3000';

  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
