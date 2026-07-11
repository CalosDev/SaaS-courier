import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { AddTrackingEventDto } from './dto/add-tracking-event.dto';
import { TrackingEventType, PackageStatus } from '../generated/prisma/client';

@Injectable()
export class TrackingService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly auditOutboxWriter = new PrismaAuditOutboxWriter();

  async findAllForPackage(context: CommandContext, packageId: string) {
    return this.prisma.packageTrackingEvent.findMany({
      where: {
        organizationId: context.organizationId,
        packageId,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async addEvent(
    context: CommandContext,
    packageId: string,
    dto: AddTrackingEventDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: {
          organizationId_id: {
            organizationId: context.organizationId,
            id: packageId,
          },
        },
      });

      if (!pkg || pkg.deletedAt) {
        throw new NotFoundException('Package not found');
      }

      const newEvent = await tx.packageTrackingEvent.create({
        data: {
          organizationId: context.organizationId,
          packageId,
          eventType: dto.eventType,
          location: dto.location,
          description: dto.description,
          createdById: context.actorEmployeeId!,
        },
      });

      // Update package status depending on event type if needed
      // Map tracking events to package statuses
      let newPackageStatus: PackageStatus | undefined = undefined;
      switch (dto.eventType) {
        case TrackingEventType.RECEIVED_AT_ORIGIN:
          newPackageStatus = PackageStatus.RECEIVED_AT_ORIGIN;
          break;
        case TrackingEventType.IN_TRANSIT:
          newPackageStatus = PackageStatus.IN_TRANSIT;
          break;
        case TrackingEventType.ARRIVED_AT_DESTINATION:
          newPackageStatus = PackageStatus.ARRIVED_AT_DESTINATION;
          break;
        case TrackingEventType.OUT_FOR_DELIVERY:
          newPackageStatus = PackageStatus.OUT_FOR_DELIVERY;
          break;
        case TrackingEventType.DELIVERED:
          newPackageStatus = PackageStatus.DELIVERED;
          break;
        default:
          break; // Keep current status
      }

      if (newPackageStatus && pkg.status !== newPackageStatus) {
        await tx.package.update({
          where: {
            organizationId_id: {
              organizationId: context.organizationId,
              id: packageId,
            },
          },
          data: {
            status: newPackageStatus,
          },
        });
      }

      await this.auditOutboxWriter.write(tx, {
        context,
        action: 'package.tracking.added',
        entityType: 'PACKAGE_TRACKING_EVENT',
        entityId: newEvent.id,
        changedFields: ['eventType', 'location', 'description'],
        afterData: newEvent,
        payload: {
          packageId,
          eventType: dto.eventType,
        },
        emitOutbox: true,
      });

      return newEvent;
    });
  }
}
