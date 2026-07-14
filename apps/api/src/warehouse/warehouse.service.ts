import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import type { BatchPutawayDto } from './dto/batch-putaway.dto';

const INTERNAL_TRACKING_PATTERN = /^[A-Z0-9-]{3,24}$/;

@Injectable()
export class WarehouseService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly trackingNormalizer: ExternalTrackingNormalizer,
  ) {}

  async lookup(organizationId: string, rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    if (!code) throw new BadRequestException('Warehouse code is required');

    const normalized = this.trackingNormalizer.normalize(code).normalized;
    const packageRecord = await this.prisma.package.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          ...(INTERNAL_TRACKING_PATTERN.test(code)
            ? [{ internalTrackingNumber: code }]
            : []),
          { externalTrackingNumberNormalized: normalized },
          { prealert: { is: { prealertCode: code, deletedAt: null } } },
        ],
      },
      select: {
        id: true,
        internalTrackingNumber: true,
        externalTrackingNumber: true,
        status: true,
        customer: { select: { customerCode: true } },
        prealert: { select: { prealertCode: true } },
        reception: {
          select: {
            receivedAt: true,
            facility: { select: { id: true, code: true, name: true } },
          },
        },
        inventoryPosition: {
          select: {
            location: {
              select: { id: true, code: true, name: true, type: true },
            },
          },
        },
      },
    });

    if (packageRecord) {
      return {
        kind: 'PACKAGE' as const,
        package: {
          id: packageRecord.id,
          internalTrackingNumber: packageRecord.internalTrackingNumber,
          externalTrackingNumber: packageRecord.externalTrackingNumber,
          prealertCode: packageRecord.prealert?.prealertCode ?? null,
          status: packageRecord.status,
          customerCode: packageRecord.customer.customerCode,
          reception: packageRecord.reception
            ? {
                facility: packageRecord.reception.facility,
                receivedAt: packageRecord.reception.receivedAt.toISOString(),
              }
            : null,
          currentLocation: packageRecord.inventoryPosition?.location ?? null,
        },
      };
    }

    const prealert = await this.prisma.prealert.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          { prealertCode: code },
          { externalTrackingNumberNormalized: normalized },
        ],
      },
      select: {
        id: true,
        prealertCode: true,
        externalTrackingNumber: true,
        status: true,
        customer: { select: { customerCode: true } },
      },
    });
    if (!prealert) throw new NotFoundException('Warehouse item not found');

    return {
      kind: 'PREALERT' as const,
      prealert: {
        id: prealert.id,
        prealertCode: prealert.prealertCode,
        externalTrackingNumber: prealert.externalTrackingNumber,
        status: prealert.status,
        customerCode: prealert.customer.customerCode,
      },
    };
  }

  async batchPutaway(context: CommandContext, input: BatchPutawayDto) {
    const location = await this.prisma.warehouseLocation.findFirst({
      where: {
        organizationId: context.organizationId,
        id: input.toLocationId,
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });
    if (!location) throw new NotFoundException('Warehouse location not found');

    const seen = new Set<string>();
    const results: Array<Record<string, unknown>> = [];
    for (const rawCode of input.codes) {
      const code = rawCode.trim().toUpperCase();
      if (seen.has(code)) {
        results.push({ code, status: 'SKIPPED', reasonCode: 'DUPLICATE_SCAN' });
        continue;
      }
      seen.add(code);

      try {
        const resolved = await this.lookup(context.organizationId, code);
        if (resolved.kind !== 'PACKAGE' || !resolved.package.reception) {
          results.push({
            code,
            status: 'FAILED',
            reasonCode: 'PACKAGE_NOT_RECEIVED',
          });
          continue;
        }
        const alreadyPlaced =
          resolved.package.currentLocation?.id === input.toLocationId;
        if (alreadyPlaced) {
          results.push({
            code,
            packageId: resolved.package.id,
            internalTrackingNumber: resolved.package.internalTrackingNumber,
            status: 'ALREADY_PLACED',
            locationCode: location.code,
          });
          continue;
        }
        const moved = await this.inventoryService.movePackage(
          context.organizationId,
          resolved.package.id,
          {
            movementType: 'PUTAWAY',
            toLocationId: input.toLocationId,
            note: input.note,
          },
          context,
        );
        results.push({
          code,
          packageId: moved.id,
          internalTrackingNumber: moved.internalTrackingNumber,
          status: 'PLACED',
          locationCode: location.code,
        });
      } catch (error) {
        results.push({
          code,
          status: 'FAILED',
          reasonCode: this.errorCode(error),
        });
      }
    }

    const placed = results.filter((item) => item.status === 'PLACED').length;
    const failed = results.filter((item) => item.status === 'FAILED').length;
    await this.prisma.$transaction((tx) =>
      this.auditWriter.write(tx, {
        context,
        action: 'warehouse.batch_putaway.completed',
        entityType: 'INVENTORY_MOVEMENT',
        entityId: context.requestId,
        changedFields: ['currentLocationId'],
        metadata: {
          requested: input.codes.length,
          placed,
          failed,
          locationId: location.id,
        },
        payload: {
          requested: input.codes.length,
          placed,
          failed,
          locationId: location.id,
        },
      }),
    );

    return {
      location,
      summary: {
        requested: input.codes.length,
        placed,
        failed,
        skipped: results.length - placed - failed,
      },
      results,
    };
  }

  private errorCode(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const code = error.code;
      if (typeof code === 'string' && /^[A-Z0-9_]{3,80}$/.test(code)) {
        return code;
      }
    }
    return error instanceof NotFoundException
      ? 'WAREHOUSE_ITEM_NOT_FOUND'
      : 'WAREHOUSE_PUTAWAY_FAILED';
  }
}
