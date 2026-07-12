import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { AddTransferItemDto } from './dto/add-transfer-item.dto';
import { ReceiveTransferItemDto } from './dto/receive-transfer-item.dto';
import {
  FacilityTransferStatus,
  FacilityTransferItemStatus,
  FacilityTransferEventType,
} from '../generated/prisma/client';
import { randomBytes } from 'node:crypto';

@Injectable()
export class TransfersService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  private generateTransferNumber(): string {
    // Basic short random ID logic for TRF
    return `TRF${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  async createTransfer(ctx: CommandContext, dto: CreateTransferDto) {
    if (!ctx.actorEmployeeId) {
      throw new BadRequestException('Employee context is required');
    }

    // Validate facilities
    const [origin, destination] = await Promise.all([
      this.prisma.facility.findUnique({
        where: { id: dto.originFacilityId, organizationId: ctx.organizationId },
      }),
      this.prisma.facility.findUnique({
        where: {
          id: dto.destinationFacilityId,
          organizationId: ctx.organizationId,
        },
      }),
    ]);

    if (!origin) throw new NotFoundException('Origin facility not found');
    if (!destination)
      throw new NotFoundException('Destination facility not found');

    const transferNumber = this.generateTransferNumber();

    return this.prisma.$transaction(async (tx) => {
      const transfer = await tx.facilityTransfer.create({
        data: {
          organizationId: ctx.organizationId,
          transferNumber,
          originFacilityId: dto.originFacilityId,
          destinationFacilityId: dto.destinationFacilityId,
          notes: dto.notes,
          vehicleInfo: dto.vehicleInfo,
          createdById: ctx.actorEmployeeId!,
          status: FacilityTransferStatus.DRAFT,
          events: {
            create: {
              eventType: FacilityTransferEventType.CREATED,
            },
          },
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer.created',
        entityType: 'FACILITY_TRANSFER',
        entityId: transfer.id,
        changedFields: ['originFacilityId', 'destinationFacilityId'],
        payload: { transferId: transfer.id },
      });

      return transfer;
    });
  }

  async getTransfers(ctx: CommandContext) {
    return this.prisma.facilityTransfer.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        originFacility: true,
        destinationFacility: true,
        createdBy: true,
        _count: {
          select: { items: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTransferById(ctx: CommandContext, transferId: string) {
    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
      include: {
        originFacility: true,
        destinationFacility: true,
        createdBy: true,
        items: {
          include: {
            package: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!transfer) {
      throw new NotFoundException('Transfer not found');
    }

    return transfer;
  }

  async addItem(
    ctx: CommandContext,
    transferId: string,
    dto: AddTransferItemDto,
  ) {
    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== FacilityTransferStatus.DRAFT) {
      throw new BadRequestException('Transfer is not in DRAFT status');
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: dto.packageId, organizationId: ctx.organizationId },
    });

    if (!pkg) throw new NotFoundException('Package not found');

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      ctx.organizationId,
      dto.packageId,
      { operation: 'facility transfer item addition' },
    );

    return this.prisma.$transaction(async (tx) => {
      const item = await tx.facilityTransferItem.create({
        data: {
          organizationId: ctx.organizationId,
          transferId,
          packageId: dto.packageId,
          status: FacilityTransferItemStatus.PENDING,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer_item.added',
        entityType: 'FACILITY_TRANSFER',
        entityId: transferId,
        changedFields: ['addedPackageId'],
        payload: { packageId: dto.packageId, itemId: item.id },
      });

      return item;
    });
  }

  async removeItem(ctx: CommandContext, transferId: string, itemId: string) {
    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== FacilityTransferStatus.DRAFT) {
      throw new BadRequestException('Transfer is not in DRAFT status');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.facilityTransferItem.delete({
        where: { id: itemId, organizationId: ctx.organizationId },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer_item.removed',
        entityType: 'FACILITY_TRANSFER',
        entityId: transferId,
        changedFields: ['removedItemId'],
        payload: { removedItemId: itemId },
      });
    });
  }

  async dispatchTransfer(ctx: CommandContext, transferId: string) {
    if (!ctx.actorEmployeeId) {
      throw new BadRequestException('Employee context is required');
    }

    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
      include: { items: true },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== FacilityTransferStatus.DRAFT) {
      throw new BadRequestException('Transfer must be DRAFT to dispatch');
    }
    if (transfer.items.length === 0) {
      throw new BadRequestException('Cannot dispatch an empty transfer');
    }

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      ctx.organizationId,
      transfer.items.map((item) => item.packageId),
      { operation: 'facility transfer dispatch' },
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facilityTransfer.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: transferId,
          },
        },
        data: {
          status: FacilityTransferStatus.IN_TRANSIT,
          dispatchedAt: new Date(),
          dispatchedById: ctx.actorEmployeeId,
          events: {
            create: {
              eventType: FacilityTransferEventType.DISPATCHED,
            },
          },
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer.dispatched',
        entityType: 'FACILITY_TRANSFER',
        entityId: transferId,
        changedFields: ['status'],
        payload: { transferId },
      });

      return updated;
    });
  }

  async receiveItem(
    ctx: CommandContext,
    transferId: string,
    itemId: string,
    dto: ReceiveTransferItemDto,
  ) {
    if (!ctx.actorEmployeeId) {
      throw new BadRequestException('Employee context is required');
    }

    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
      include: { items: true },
    });

    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== FacilityTransferStatus.IN_TRANSIT) {
      throw new BadRequestException(
        'Transfer must be IN_TRANSIT to receive items',
      );
    }

    const item = transfer.items.find((i) => i.id === itemId);
    if (!item) throw new NotFoundException('Item not found in transfer');

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      ctx.organizationId,
      item.packageId,
      { operation: 'facility transfer item receipt' },
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedItem = await tx.facilityTransferItem.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: itemId,
          },
        },
        data: {
          status: dto.status,
          notes: dto.notes,
        },
      });

      let evType: FacilityTransferEventType | null = null;
      switch (dto.status) {
        case FacilityTransferItemStatus.RECEIVED:
          evType = FacilityTransferEventType.RECEIVED;
          break;
        case FacilityTransferItemStatus.MISSING:
          evType = FacilityTransferEventType.ITEM_MARKED_MISSING;
          break;
        case FacilityTransferItemStatus.DAMAGED:
          evType = FacilityTransferEventType.ITEM_MARKED_DAMAGED;
          break;
        case FacilityTransferItemStatus.PENDING:
          evType = null;
          break;
      }
      if (evType) {
        await tx.facilityTransferEvent.create({
          data: {
            organizationId: ctx.organizationId,
            transferId,
            eventType: evType,
            notes: `Item ${itemId}: ${dto.status}`,
          },
        });
      }

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer_item.received',
        entityType: 'FACILITY_TRANSFER',
        entityId: transferId,
        changedFields: ['itemId', 'status'],
        payload: { itemId, status: dto.status },
      });

      // Check if all items are processed (not PENDING)
      const allItems = await tx.facilityTransferItem.findMany({
        where: { organizationId: ctx.organizationId, transferId },
      });
      const allProcessed = allItems.every(
        (i) => i.status !== FacilityTransferItemStatus.PENDING,
      );

      if (allProcessed) {
        await tx.facilityTransfer.update({
          where: {
            organizationId_id: {
              organizationId: ctx.organizationId,
              id: transferId,
            },
          },
          data: {
            status: FacilityTransferStatus.COMPLETED,
            receivedAt: new Date(),
            receivedById: ctx.actorEmployeeId,
          },
        });

        await this.auditWriter.write(tx, {
          context: ctx,
          action: 'facility_transfer.completed',
          entityType: 'FACILITY_TRANSFER',
          entityId: transferId,
          changedFields: ['status'],
          payload: { transferId },
        });
      }

      return updatedItem;
    });
  }
}
