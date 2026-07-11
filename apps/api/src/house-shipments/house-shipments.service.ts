import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HouseShipmentsRepository } from './house-shipments.repository';
import { CreateHouseShipmentDto } from './dto/create-house-shipment.dto';
import { UpdateHouseShipmentDto } from './dto/update-house-shipment.dto';
import { AddPackagesToHouseShipmentDto } from './dto/add-packages-to-house-shipment.dto';
import { HouseShipmentRecord } from './house-shipment.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class HouseShipmentsService {
  private readonly auditOutbox = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: HouseShipmentsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    ctx: CommandContext,
    dispatchId: string,
    dto: CreateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    const existing = await this.prisma.houseShipment.findUnique({
      where: {
        organizationId_hawb: {
          organizationId: ctx.organizationId,
          hawb: dto.hawb,
        },
      },
    });

    if (existing) {
      throw new ConflictException('HAWB already exists in this organization');
    }

    const dispatch = await this.prisma.dispatch.findUnique({
      where: {
        organizationId_id: {
          organizationId: ctx.organizationId,
          id: dispatchId,
        },
      },
    });

    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }

    const shipment = await this.repository.create(
      ctx.organizationId,
      dispatchId,
      dto,
    );

    await this.auditOutbox.write(this.prisma, {
      context: ctx,
      action: 'house_shipment.created',
      entityType: 'HOUSE_SHIPMENT',
      entityId: shipment.id,
      changedFields: ['hawb', 'notes'],
      payload: dto as unknown as Record<string, unknown>,
    });

    return shipment;
  }

  async findByDispatchId(
    ctx: CommandContext,
    dispatchId: string,
  ): Promise<HouseShipmentRecord[]> {
    return this.repository.findByDispatchId(ctx.organizationId, dispatchId);
  }

  async findById(
    ctx: CommandContext,
    id: string,
  ): Promise<HouseShipmentRecord> {
    const shipment = await this.repository.findById(ctx.organizationId, id);
    if (!shipment) {
      throw new NotFoundException('House shipment not found');
    }
    return shipment;
  }

  async update(
    ctx: CommandContext,
    id: string,
    dto: UpdateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException(
        'Cannot update a closed or cancelled house shipment',
      );
    }

    if (dto.hawb && dto.hawb !== shipment.hawb) {
      const existing = await this.prisma.houseShipment.findUnique({
        where: {
          organizationId_hawb: {
            organizationId: ctx.organizationId,
            hawb: dto.hawb,
          },
        },
      });

      if (existing) {
        throw new ConflictException('HAWB already exists in this organization');
      }
    }

    const updated = await this.repository.update(ctx.organizationId, id, dto);

    return updated;
  }

  async addPackages(
    ctx: CommandContext,
    id: string,
    dto: AddPackagesToHouseShipmentDto,
  ): Promise<void> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException(
        'Cannot add packages to a closed or cancelled house shipment',
      );
    }

    // Verify packages
    const packages = await this.prisma.package.findMany({
      where: {
        organizationId: ctx.organizationId,
        id: { in: dto.packageIds },
      },
    });

    if (packages.length !== dto.packageIds.length) {
      throw new NotFoundException('One or more packages not found');
    }

    // Check if packages belong to the master shipment
    const invalidDispatch = packages.find(
      (pkg) => pkg.dispatchId !== shipment.dispatchId,
    );
    if (invalidDispatch) {
      throw new BadRequestException(
        `Package ${invalidDispatch.id} does not belong to the Master Shipment ${shipment.dispatchId}`,
      );
    }

    await this.repository.addPackages(ctx.organizationId, id, dto.packageIds);

    await this.auditOutbox.write(this.prisma, {
      context: ctx,
      action: 'house_shipment.packages.replaced',
      entityType: 'HOUSE_SHIPMENT',
      entityId: id,
      changedFields: ['packages'],
      payload: { addedPackages: dto.packageIds },
    });
  }

  async close(ctx: CommandContext, id: string): Promise<void> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException('House shipment is not in DRAFT status');
    }

    // Use transaction for closing
    await this.prisma.$transaction(async (tx) => {
      await tx.houseShipment.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id,
          },
        },
        data: {
          status: 'CLOSED',
        },
      });

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'house_shipment.closed',
        entityType: 'HOUSE_SHIPMENT',
        entityId: id,
        changedFields: ['status'],
        payload: { previousStatus: shipment.status, newStatus: 'CLOSED' },
      });
    });
  }

  async cancel(ctx: CommandContext, id: string): Promise<void> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status === 'CANCELLED') {
      throw new ConflictException('House shipment is already cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.houseShipment.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id,
          },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'house_shipment.cancelled',
        entityType: 'HOUSE_SHIPMENT',
        entityId: id,
        changedFields: ['status'],
        payload: { previousStatus: shipment.status, newStatus: 'CANCELLED' },
      });
    });
  }
}
