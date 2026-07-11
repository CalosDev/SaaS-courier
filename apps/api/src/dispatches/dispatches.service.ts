import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaDispatchesRepository } from './prisma-dispatches.repository';

import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { UpdateDispatchDto } from './dto/update-dispatch.dto';
import { AddPackagesDto } from './dto/add-packages.dto';
import { DispatchStatus } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { randomUUID } from 'crypto';

@Injectable()
export class DispatchesService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: PrismaDispatchesRepository,
    private readonly prisma: PrismaService,
  ) {}

  private generateCode(): string {
    return `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  async createDispatch(ctx: CommandContext, dto: CreateDispatchDto) {
    if (!ctx.actorEmployeeId) {
      throw new BadRequestException('Employee ID is required');
    }

    if (dto.origin === dto.destination && dto.origin) {
      throw new BadRequestException(
        'Origin and destination cannot be the same',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const dispatch = await this.repository.create(
        {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          dispatchCode: this.generateCode(),
          origin: dto.origin,
          destination: dto.destination,
          departureTime: dto.departureTime
            ? new Date(dto.departureTime)
            : undefined,
          estimatedArrivalTime: dto.estimatedArrivalTime
            ? new Date(dto.estimatedArrivalTime)
            : undefined,
          carrier: dto.carrier,
          flightNumber: dto.flightNumber,
          mawb: dto.mawb,
          status: DispatchStatus.DRAFT,
        },
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.created',
        entityId: dispatch.id,
        entityType: 'DISPATCH',
        changedFields: [
          'id',
          'status',
          'dispatchCode',
          'origin',
          'destination',
        ],
        payload: { ...dispatch },
        metadata: {
          code: dispatch.dispatchCode,
          origin: dispatch.origin,
          destination: dispatch.destination,
        },
      });

      return dispatch;
    });
  }

  async getDispatches(organizationId: string) {
    return this.repository.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDispatchById(organizationId: string, dispatchId: string) {
    const dispatch = await this.repository.findById(organizationId, dispatchId);
    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }
    return dispatch;
  }

  async updateDispatch(
    ctx: CommandContext,
    dispatchId: string,
    dto: UpdateDispatchDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (
        existing.status === DispatchStatus.COMPLETED ||
        existing.status === DispatchStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot update dispatch in ${existing.status} status`,
        );
      }

      const updated = await this.repository.update(
        ctx.organizationId,
        dispatchId,
        {
          status: dto.status !== undefined ? dto.status : existing.status,
          origin: dto.origin !== undefined ? dto.origin : existing.origin,
          destination:
            dto.destination !== undefined
              ? dto.destination
              : existing.destination,
          departureTime:
            dto.departureTime !== undefined
              ? dto.departureTime
                ? new Date(dto.departureTime)
                : null
              : existing.departureTime,
          estimatedArrivalTime:
            dto.estimatedArrivalTime !== undefined
              ? dto.estimatedArrivalTime
                ? new Date(dto.estimatedArrivalTime)
                : null
              : existing.estimatedArrivalTime,
          actualArrivalTime:
            dto.actualArrivalTime !== undefined
              ? dto.actualArrivalTime
                ? new Date(dto.actualArrivalTime)
                : null
              : existing.actualArrivalTime,
          carrier: dto.carrier !== undefined ? dto.carrier : existing.carrier,
          flightNumber:
            dto.flightNumber !== undefined
              ? dto.flightNumber
              : existing.flightNumber,
          mawb: dto.mawb !== undefined ? dto.mawb : existing.mawb,
        },
        tx,
      );

      const changedFields: string[] = [];
      if (existing.status !== updated.status) changedFields.push('status');
      if (existing.mawb !== updated.mawb) changedFields.push('mawb');

      if (changedFields.length > 0 || Object.keys(dto).length > 0) {
        await this.auditWriter.write(tx, {
          context: ctx,
          action:
            existing.status !== updated.status
              ? 'dispatch.status_changed'
              : 'dispatch.updated',
          entityId: updated.id,
          entityType: 'DISPATCH',
          changedFields,
          payload: { ...updated },
          metadata: {
            dispatchId: updated.id,
            oldStatus: existing.status,
            newStatus: updated.status,
          },
        });
      }

      return updated;
    });
  }

  async addPackages(
    ctx: CommandContext,
    dispatchId: string,
    dto: AddPackagesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (existing.status !== DispatchStatus.DRAFT) {
        throw new BadRequestException(
          'Can only add packages to a DRAFT dispatch',
        );
      }

      const updated = await this.repository.updatePackageAssociation(
        ctx.organizationId,
        dispatchId,
        dto.packageIds,
        true,
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.packages_added',
        entityId: updated.id,
        entityType: 'DISPATCH',
        changedFields: ['packages'],
        payload: { packageIds: dto.packageIds },
        metadata: { dispatchId: updated.id, addedCount: dto.packageIds.length },
      });

      return updated;
    });
  }

  async removePackages(
    ctx: CommandContext,
    dispatchId: string,
    dto: AddPackagesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (existing.status !== DispatchStatus.DRAFT) {
        throw new BadRequestException(
          'Can only remove packages from a DRAFT dispatch',
        );
      }

      const updated = await this.repository.updatePackageAssociation(
        ctx.organizationId,
        dispatchId,
        dto.packageIds,
        false,
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.packages_removed',
        entityId: updated.id,
        entityType: 'DISPATCH',
        changedFields: ['packages'],
        payload: { packageIds: dto.packageIds },
        metadata: {
          dispatchId: updated.id,
          removedCount: dto.packageIds.length,
        },
      });

      return updated;
    });
  }
}
