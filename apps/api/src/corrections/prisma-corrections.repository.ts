import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, CorrectionRequest } from '../generated/prisma/client';

@Injectable()
export class PrismaCorrectionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    data: Prisma.CorrectionRequestUncheckedCreateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CorrectionRequest> {
    return tx.correctionRequest.create({ data });
  }

  async findMany(params: {
    where?: Prisma.CorrectionRequestWhereInput;
    orderBy?: Prisma.CorrectionRequestOrderByWithRelationInput;
  }): Promise<CorrectionRequest[]> {
    return this.prisma.correctionRequest.findMany(params);
  }

  async findById(
    organizationId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CorrectionRequest | null> {
    return tx.correctionRequest.findUnique({
      where: { organizationId_id: { organizationId, id } },
      include: {
        decisions: true,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: Prisma.CorrectionRequestUncheckedUpdateInput,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CorrectionRequest> {
    return tx.correctionRequest.update({
      where: { organizationId_id: { organizationId, id } },
      data,
    });
  }

  async recordDecision(
    organizationId: string,
    correctionRequestId: string,
    employeeId: string,
    decision: 'APPROVED' | 'REJECTED' | 'APPLIED',
    reason?: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    return tx.correctionDecision.create({
      data: {
        organizationId,
        correctionRequestId,
        decidedByEmployeeId: employeeId,
        decision,
        reason,
      },
    });
  }
}
