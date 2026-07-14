import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/http/public.decorator';
import { SmtpEmailSender } from '../notifications/smtp-email.sender';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';

export interface HealthResponse {
  status: 'ok';
  service: 'courier-api';
  timestamp: string;
}

@Public()
@Controller('health')
export class HealthController {
  private readinessSnapshot:
    | {
        expiresAt: number;
        checks: Promise<[boolean, boolean, boolean]>;
      }
    | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly smtpSender: SmtpEmailSender,
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'courier-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  @Get('ready')
  async getReadiness() {
    const [database, storage, smtp] = await this.dependencyReadiness();
    const storageRequired = process.env.READINESS_REQUIRE_S3 === 'true';
    const smtpRequired = process.env.READINESS_REQUIRE_SMTP === 'true';
    const ready =
      database && (!storageRequired || storage) && (!smtpRequired || smtp);
    const body = {
      status: ready ? ('ready' as const) : ('not_ready' as const),
      service: 'courier-api' as const,
      checks: {
        database: database ? 'up' : 'down',
        objectStorage: storage ? 'up' : storageRequired ? 'down' : 'optional',
        smtp: smtp ? 'up' : smtpRequired ? 'down' : 'optional',
      },
      timestamp: new Date().toISOString(),
    };
    if (!ready) throw new ServiceUnavailableException(body);
    return body;
  }

  private dependencyReadiness(): Promise<[boolean, boolean, boolean]> {
    const now = Date.now();
    if (this.readinessSnapshot && this.readinessSnapshot.expiresAt > now) {
      return this.readinessSnapshot.checks;
    }

    const ttlMs = Math.max(
      0,
      Number.parseInt(process.env.READINESS_CACHE_TTL_MS ?? '5000', 10) || 0,
    );
    const checks = Promise.all([
      this.databaseReady(),
      this.storage.checkHealth(),
      this.smtpSender.checkHealth(),
    ]);
    this.readinessSnapshot = { expiresAt: now + ttlMs, checks };
    return checks;
  }

  private async databaseReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
