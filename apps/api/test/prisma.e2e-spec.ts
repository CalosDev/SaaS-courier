import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

type SelectOneRow = {
  result: number | bigint | string | null;
};

describe('Prisma integration', () => {
  it('executes SELECT 1 through PrismaService and closes the connection', async () => {
    process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

    let app: INestApplication | undefined;
    let disconnectSpy:
      | jest.SpiedFunction<PrismaService['$disconnect']>
      | undefined;

    try {
      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();

      const prisma = app.get(PrismaService);
      disconnectSpy = jest.spyOn(prisma, '$disconnect');
      const rows = await prisma.$queryRaw<SelectOneRow[]>`SELECT 1 AS result`;

      expect(Number(rows[0]?.result)).toBe(1);
    } finally {
      await app?.close();
    }

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
