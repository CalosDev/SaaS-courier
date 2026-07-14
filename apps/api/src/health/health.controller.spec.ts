import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SmtpEmailSender } from '../notifications/smtp-email.sender';
import { ObjectStorageService } from '../storage/object-storage.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const prisma = { $queryRaw: jest.fn() };
  const storage = { checkHealth: jest.fn() };
  const smtp = { checkHealth: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ObjectStorageService, useValue: storage },
        { provide: SmtpEmailSender, useValue: smtp },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns readiness checks when required dependencies are available', async () => {
    prisma.$queryRaw.mockResolvedValue([{ value: 1 }]);
    storage.checkHealth.mockResolvedValue(true);
    smtp.checkHealth.mockResolvedValue(true);
    process.env.READINESS_REQUIRE_S3 = 'true';
    process.env.READINESS_REQUIRE_SMTP = 'false';

    await expect(controller.getReadiness()).resolves.toMatchObject({
      status: 'ready',
      checks: { database: 'up', objectStorage: 'up' },
    });
  });

  it('checks independent readiness dependencies concurrently', async () => {
    const pending = new Promise<boolean>(() => undefined);
    prisma.$queryRaw.mockReturnValue(pending);
    storage.checkHealth.mockReturnValue(pending);
    smtp.checkHealth.mockReturnValue(pending);

    void controller.getReadiness();
    await Promise.resolve();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.checkHealth).toHaveBeenCalledTimes(1);
    expect(smtp.checkHealth).toHaveBeenCalledTimes(1);
  });

  it('reuses a recent readiness snapshot', async () => {
    prisma.$queryRaw.mockResolvedValue([{ value: 1 }]);
    storage.checkHealth.mockResolvedValue(true);
    smtp.checkHealth.mockResolvedValue(true);

    await controller.getReadiness();
    await controller.getReadiness();

    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(storage.checkHealth).toHaveBeenCalledTimes(1);
    expect(smtp.checkHealth).toHaveBeenCalledTimes(1);
  });

  it('returns the API health status', () => {
    const response = controller.getHealth();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('courier-api');
    expect(typeof response.timestamp).toBe('string');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
