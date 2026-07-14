import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { Public } from '../auth/http/public.decorator';
import { SmtpEmailSender } from '../notifications/smtp-email.sender';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { RequirePermissions } from '../rbac/http/require-permissions.decorator';

export interface HealthResponse {
  status: 'ok';
  service: 'courier-api';
  timestamp: string;
}

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
  @Public()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'courier-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  @Public()
  getLiveness(): HealthResponse {
    return this.getHealth();
  }

  @Get('ready')
  @Public()
  async getReadiness() {
    const readiness = await this.resolveReadiness();
    const body = {
      status: readiness.ready ? ('ready' as const) : ('not_ready' as const),
      service: 'courier-api' as const,
      timestamp: new Date().toISOString(),
    };
    if (!readiness.ready) throw new ServiceUnavailableException(body);
    return body;
  }

  @Get('dependencies')
  @RequirePermissions('organizations.read')
  async getDependencies() {
    const readiness = await this.resolveReadiness();
    const body = {
      status: readiness.ready ? ('ready' as const) : ('not_ready' as const),
      service: 'courier-api' as const,
      checks: readiness.checks,
      timestamp: new Date().toISOString(),
    };
    if (!readiness.ready) throw new ServiceUnavailableException(body);
    return body;
  }

  private async resolveReadiness() {
    const [database, storage, smtp] = await this.dependencyReadiness();
    const storageRequired = process.env.READINESS_REQUIRE_S3 === 'true';
    const smtpRequired = process.env.READINESS_REQUIRE_SMTP === 'true';
    const ready =
      database && (!storageRequired || storage) && (!smtpRequired || smtp);
    return {
      ready,
      checks: {
        database: database ? 'up' : 'down',
        objectStorage: storage ? 'up' : storageRequired ? 'down' : 'optional',
        smtp: smtp ? 'up' : smtpRequired ? 'down' : 'optional',
      },
    };
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
