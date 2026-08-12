import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { isAllowedOrigin, loadAllowedOrigins } from './allowed-origin';

export function configureHttpApp(app: NestExpressApplication): void {
  const allowedOrigins = loadAllowedOrigins();

  app.set('trust proxy', loadTrustedProxies());
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

      callback(null, isAllowedOrigin(origin, allowedOrigins));
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

function loadTrustedProxies(): false | string[] {
  const configured = process.env.TRUST_PROXY?.trim() ?? 'false';

  if (configured === 'false') {
    return false;
  }

  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}
