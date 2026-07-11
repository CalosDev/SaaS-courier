import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, OperationalHold } from '../generated/prisma/client';

@Injectable()
export class PrismaHoldsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.OperationalHoldUncheckedCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OperationalHold> {
    return tx.operationalHold.create({ data });
  }

  async findMany(params: {
    where?: Prisma.OperationalHoldWhereInput;
    orderBy?: Prisma.OperationalHoldOrderByWithRelationInput;
  }): Promise<OperationalHold[]> {
    return this.prisma.operationalHold.findMany(params);
  }

  async findById(
    organizationId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OperationalHold | null> {
    return tx.operationalHold.findUnique({
      where: { organizationId_id: { organizationId, id } },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Prisma.OperationalHoldUncheckedUpdateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<OperationalHold> {
    return tx.operationalHold.update({
      where: { organizationId_id: { organizationId, id } },
      data,
    });
  }
}
