import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import {
  formatOutboxStatus,
  type OutboxStatusSnapshot,
} from '../src/outbox/outbox-status';
import { PrismaService } from '../src/prisma/prisma.service';

async function main(): Promise<void> {
  const applicationContext = await NestFactory.createApplicationContext(
    AppModule,
    { logger: ['error', 'warn'] },
  );

  try {
    const prisma = applicationContext.get(PrismaService);
    const now = new Date();
    const [groupedCounts, oldestPending, available, locked] = await Promise.all(
      [
        prisma.outboxEvent.groupBy({
          by: ['status'],
          _count: { _all: true },
        }),
        prisma.outboxEvent.aggregate({
          where: { status: 'PENDING' },
          _min: { occurredAt: true },
        }),
        prisma.outboxEvent.count({
          where: { status: 'PENDING', availableAt: { lte: now } },
        }),
        prisma.outboxEvent.count({
          where: { lockedUntil: { gt: now } },
        }),
      ],
    );
    const counts: OutboxStatusSnapshot['counts'] = {
      PENDING: 0,
      PROCESSING: 0,
      PUBLISHED: 0,
      FAILED: 0,
      DEAD_LETTER: 0,
    };

    for (const row of groupedCounts) {
      counts[row.status] = row._count._all;
    }

    const oldestOccurredAt = oldestPending._min.occurredAt;
    console.log(
      formatOutboxStatus({
        counts,
        oldestPendingAgeSeconds: oldestOccurredAt
          ? (now.getTime() - oldestOccurredAt.getTime()) / 1000
          : null,
        available,
        locked,
      }),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown outbox status error';
    console.error(`Outbox status failed: ${message}`);
    process.exitCode = 1;
  } finally {
    await applicationContext.close();
  }
}

void main();
