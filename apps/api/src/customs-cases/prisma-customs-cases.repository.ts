import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Prisma,
  CustomsCase,
  CustomsCaseEvent,
} from '../generated/prisma/client';

export type CustomsCaseWithEvents = CustomsCase & {
  events: CustomsCaseEvent[];
};

@Injectable()
export class PrismaCustomsCasesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.CustomsCaseCreateInput): Promise<CustomsCase> {
    return this.prisma.customsCase.create({ data });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<CustomsCaseWithEvents | null> {
    return this.prisma.customsCase.findUnique({
      where: {
        organizationId_id: { organizationId, id },
      },
      include: {
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async findAll(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.CustomsCaseWhereUniqueInput;
    where?: Prisma.CustomsCaseWhereInput;
    orderBy?: Prisma.CustomsCaseOrderByWithRelationInput;
  }): Promise<{ items: CustomsCase[]; total: number }> {
    const { skip, take, cursor, where, orderBy } = params;
    const [items, total] = await Promise.all([
      this.prisma.customsCase.findMany({
        skip,
        take,
        cursor,
        where,
        orderBy,
      }),
      this.prisma.customsCase.count({ where }),
    ]);

    return { items, total };
  }

  async update(params: {
    where: Prisma.CustomsCaseWhereUniqueInput;
    data: Prisma.CustomsCaseUpdateInput;
  }): Promise<CustomsCase> {
    const { where, data } = params;
    return this.prisma.customsCase.update({
      where,
      data,
    });
  }
}
