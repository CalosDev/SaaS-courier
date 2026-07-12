import { ConflictException, Injectable } from '@nestjs/common';
import { HoldStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OperationalHoldGuard {
  constructor(private readonly prisma: PrismaService) {}

  async assertNoActivePackageHolds(
    organizationId: string,
    packageIds: string | string[],
    options: {
      operation?: string;
      tx?: Prisma.TransactionClient;
    } = {},
  ): Promise<void> {
    const ids = [
      ...new Set(Array.isArray(packageIds) ? packageIds : [packageIds]),
    ]
      .map((id) => id.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      return;
    }

    const client = options.tx ?? this.prisma;
    const activeHold = await client.operationalHold.findFirst({
      where: {
        organizationId,
        targetType: 'PACKAGE',
        targetId: { in: ids },
        status: HoldStatus.ACTIVE,
      },
      select: {
        id: true,
        targetId: true,
        reason: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!activeHold) {
      return;
    }

    const operation = options.operation ? ` for ${options.operation}` : '';

    throw new ConflictException(
      `Package ${activeHold.targetId} has an active operational hold${operation}`,
    );
  }
}
