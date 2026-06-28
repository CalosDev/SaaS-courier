import { ConfigService } from '@nestjs/config';

import { PrismaService } from './prisma.service';

function createConfigService(databaseUrl?: string): ConfigService {
  return {
    get: jest.fn((key: string) => {
      if (key === 'DATABASE_URL') {
        return databaseUrl;
      }

      return undefined;
    }),
  } as unknown as ConfigService;
}

describe('PrismaService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('throws a safe error when DATABASE_URL is missing', () => {
    expect(() => new PrismaService(createConfigService())).toThrow(
      'DATABASE_URL is required',
    );
  });

  it('connects during module initialization', async () => {
    const service = new PrismaService(
      createConfigService(
        'postgresql://courier:test@localhost:5432/courier_saas',
      ),
    );
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);

    await service.onModuleInit();

    expect(connectSpy).toHaveBeenCalledTimes(1);
  });

  it('disconnects during module destruction', async () => {
    const service = new PrismaService(
      createConfigService(
        'postgresql://courier:test@localhost:5432/courier_saas',
      ),
    );
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    await service.onModuleDestroy();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
