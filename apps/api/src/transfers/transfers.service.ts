import {
  BadRequestException,
  ConflictException,
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
  InventoryMovementType,
  PackageStatus,
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
    if (dto.originFacilityId === dto.destinationFacilityId) {
      throw new ConflictException(
        'Origin and destination facilities must be different',
      );
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
      include: { inventoryPosition: true },
    });

    if (!pkg) throw new NotFoundException('Package not found');
    if (pkg.inventoryPosition?.facilityId !== transfer.originFacilityId) {
      throw new ConflictException(
        'Package must be in the transfer origin facility',
      );
    }

    const activeItem = await this.prisma.facilityTransferItem.findFirst({
      where: {
        organizationId: ctx.organizationId,
        packageId: dto.packageId,
        transfer: {
          status: {
            in: [
              FacilityTransferStatus.DRAFT,
              FacilityTransferStatus.IN_TRANSIT,
            ],
          },
        },
      },
      select: { id: true },
    });
    if (activeItem) {
      throw new ConflictException(
        'Package already belongs to an active transfer',
      );
    }

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

    const item = await this.prisma.facilityTransferItem.findFirst({
      where: {
        id: itemId,
        organizationId: ctx.organizationId,
        transferId,
      },
      select: { id: true },
    });
    if (!item) {
      throw new NotFoundException('Transfer item not found');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.facilityTransferItem.delete({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: itemId,
          },
        },
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
    const actorEmployeeId = ctx.actorEmployeeId;
    if (!actorEmployeeId) {
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
      const positions = await tx.packageInventoryPosition.findMany({
        where: {
          organizationId: ctx.organizationId,
          packageId: { in: transfer.items.map((item) => item.packageId) },
        },
      });
      if (
        positions.length !== transfer.items.length ||
        positions.some(
          (position) => position.facilityId !== transfer.originFacilityId,
        )
      ) {
        throw new ConflictException(
          'Every package must remain in the transfer origin facility',
        );
      }

      const occurredAt = new Date();
      for (const position of positions) {
        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: ctx.organizationId,
            packageId: position.packageId,
            facilityId: transfer.originFacilityId,
            fromLocationId: position.locationId,
            toLocationId: null,
            movedByEmployeeId: actorEmployeeId,
            movementType: InventoryMovementType.REMOVE,
            note: `Transfer ${transfer.transferNumber} dispatched`,
            occurredAt,
          },
        });
        await this.auditWriter.write(tx, {
          context: ctx,
          action: 'inventory.package.moved',
          entityType: 'INVENTORY_MOVEMENT',
          entityId: movement.id,
          changedFields: ['movementType', 'currentLocationId'],
          beforeData: { currentLocationId: position.locationId },
          afterData: {
            currentLocationId: null,
            movementType: InventoryMovementType.REMOVE,
          },
          payload: {
            packageId: position.packageId,
            facilityId: transfer.originFacilityId,
            movementType: InventoryMovementType.REMOVE,
            fromLocationId: position.locationId,
            toLocationId: null,
            occurredAt: occurredAt.toISOString(),
          },
        });
      }

      await tx.packageInventoryPosition.deleteMany({
        where: { id: { in: positions.map((position) => position.id) } },
      });
      await tx.package.updateMany({
        where: {
          organizationId: ctx.organizationId,
          id: { in: transfer.items.map((item) => item.packageId) },
        },
        data: { status: PackageStatus.IN_TRANSIT },
      });

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
          dispatchedById: actorEmployeeId,
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

  async cancelTransfer(ctx: CommandContext, transferId: string) {
    const transfer = await this.prisma.facilityTransfer.findUnique({
      where: { id: transferId, organizationId: ctx.organizationId },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (transfer.status !== FacilityTransferStatus.DRAFT) {
      throw new ConflictException('Only DRAFT transfers can be cancelled');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.facilityTransfer.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: transferId,
          },
        },
        data: {
          status: FacilityTransferStatus.CANCELLED,
          events: {
            create: { eventType: FacilityTransferEventType.CANCELLED },
          },
        },
      });
      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'facility_transfer.cancelled',
        entityType: 'FACILITY_TRANSFER',
        entityId: transferId,
        changedFields: ['status'],
        beforeData: { status: transfer.status },
        afterData: { status: updated.status },
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
    const actorEmployeeId = ctx.actorEmployeeId;
    if (!actorEmployeeId) {
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

    const placesPackage =
      dto.status === FacilityTransferItemStatus.RECEIVED ||
      dto.status === FacilityTransferItemStatus.DAMAGED;
    const destinationLocation = placesPackage
      ? await this.prisma.warehouseLocation.findUnique({
          where: {
            organizationId_id: {
              organizationId: ctx.organizationId,
              id: dto.destinationLocationId!,
            },
          },
        })
      : null;
    if (
      placesPackage &&
      (!destinationLocation ||
        !destinationLocation.isActive ||
        destinationLocation.facilityId !== transfer.destinationFacilityId)
    ) {
      throw new ConflictException(
        'Destination location must be active and belong to the destination facility',
      );
    }

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

      if (placesPackage && destinationLocation) {
        const occurredAt = new Date();
        const movement = await tx.inventoryMovement.create({
          data: {
            organizationId: ctx.organizationId,
            packageId: item.packageId,
            facilityId: transfer.destinationFacilityId,
            fromLocationId: null,
            toLocationId: destinationLocation.id,
            movedByEmployeeId: actorEmployeeId,
            movementType: InventoryMovementType.PUTAWAY,
            note: `Transfer ${transfer.transferNumber} received with status ${dto.status}`,
            occurredAt,
          },
        });
        await tx.packageInventoryPosition.upsert({
          where: {
            organizationId_packageId: {
              organizationId: ctx.organizationId,
              packageId: item.packageId,
            },
          },
          create: {
            organizationId: ctx.organizationId,
            packageId: item.packageId,
            facilityId: transfer.destinationFacilityId,
            locationId: destinationLocation.id,
            placedAt: occurredAt,
          },
          update: {
            facilityId: transfer.destinationFacilityId,
            locationId: destinationLocation.id,
            placedAt: occurredAt,
          },
        });
        await tx.package.update({
          where: {
            organizationId_id: {
              organizationId: ctx.organizationId,
              id: item.packageId,
            },
          },
          data: { status: PackageStatus.ARRIVED_AT_DESTINATION },
        });
        await this.auditWriter.write(tx, {
          context: ctx,
          action: 'inventory.package.moved',
          entityType: 'INVENTORY_MOVEMENT',
          entityId: movement.id,
          changedFields: ['movementType', 'currentLocationId'],
          beforeData: { currentLocationId: null },
          afterData: {
            currentLocationId: destinationLocation.id,
            movementType: InventoryMovementType.PUTAWAY,
          },
          payload: {
            packageId: item.packageId,
            facilityId: transfer.destinationFacilityId,
            movementType: InventoryMovementType.PUTAWAY,
            fromLocationId: null,
            toLocationId: destinationLocation.id,
            occurredAt: occurredAt.toISOString(),
          },
        });
      }

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
            receivedById: actorEmployeeId,
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
