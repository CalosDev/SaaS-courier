import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Dispatch } from '../generated/prisma/client';

@Injectable()
export class PrismaDispatchesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.DispatchUncheckedCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Dispatch> {
    return tx.dispatch.create({ data });
  }

  async findMany(params: {
    where?: Prisma.DispatchWhereInput;
    orderBy?: Prisma.DispatchOrderByWithRelationInput;
    include?: Prisma.DispatchInclude;
  }): Promise<Dispatch[]> {
    return this.prisma.dispatch.findMany(params);
  }

  async findById(
    organizationId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Dispatch | null> {
    return tx.dispatch.findUnique({
      where: { organizationId_id: { organizationId, id } },
      include: {
        packages: true,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Prisma.DispatchUncheckedUpdateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Dispatch> {
    return tx.dispatch.update({
      where: { organizationId_id: { organizationId, id } },
      data,
    });
  }

  async updatePackageAssociation(
    organizationId: string,
    dispatchId: string,
    packageIds: string[],
    connect: boolean,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Dispatch> {
    return tx.dispatch.update({
      where: { organizationId_id: { organizationId, id: dispatchId } },
      data: {
        packages: {
          [connect ? 'connect' : 'disconnect']: packageIds.map((id) => ({
            organizationId_id: { organizationId, id },
          })),
        },
      },
      include: {
        packages: true,
      },
    });
  }
}
