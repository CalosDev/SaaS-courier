import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import path from 'node:path';

import { Prisma, PrismaClient } from '../src/generated/prisma/client';

type SelectOneRow = {
  result: number | bigint | string | null;
};

config({ path: path.resolve(__dirname, '../../..', '.env'), quiet: true });

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;

  try {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is required. Copy .env.example to .env or set DATABASE_URL in the environment.',
      );
    }

    const adapter = new PrismaPg(connectionString);
    prisma = new PrismaClient({ adapter });

    const rows = await prisma.$queryRaw<SelectOneRow[]>(
      Prisma.sql`SELECT 1 AS result`,
    );
    const result = Number(rows[0]?.result);

    if (result !== 1) {
      throw new Error(
        'Database connection check failed: SELECT 1 did not return 1.',
      );
    }

    console.log('PostgreSQL connection verified: SELECT 1 returned 1.');
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : 'Database connection check failed.';

    console.error(message);
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

void main();
