import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { AddTrackingEventDto } from './dto/add-tracking-event.dto';
import { Prisma, type PackageStatus } from '../generated/prisma/client';
import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { assertTrackingEventMatchesPackageStatus } from '../packages/package-status.policy';

type LockedPackageRow = {
  id: string;
  status: PackageStatus;
};

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingNormalizer: ExternalTrackingNormalizer,
  ) {}

  private readonly auditOutboxWriter = new PrismaAuditOutboxWriter();

  async resolvePublic(organizationSlug: string, reference: string) {
    const organization = await this.prisma.organization.findFirst({
      where: { slug: organizationSlug.toLowerCase(), status: 'ACTIVE' },
      select: { id: true, slug: true, commercialName: true },
    });
    if (!organization) throw new NotFoundException('Tracking not found');
    return this.resolveForOrganization(
      organization.id,
      reference,
      organization,
    );
  }

  async resolveAuthenticated(context: CommandContext, reference: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: context.organizationId },
      select: { id: true, slug: true, commercialName: true },
    });
    if (!organization) throw new NotFoundException('Tracking not found');
    return this.resolveForOrganization(
      context.organizationId,
      reference,
      organization,
    );
  }

  private async resolveForOrganization(
    organizationId: string,
    reference: string,
    organization: { id: string; slug: string; commercialName: string },
  ) {
    let normalized: string;
    try {
      normalized = this.trackingNormalizer.normalize(reference).normalized;
    } catch {
      throw new BadRequestException('Invalid tracking reference');
    }

    const pkg = await this.prisma.package.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        status: { not: 'CANCELLED' },
        OR: [
          { internalTrackingNumber: normalized },
          { externalTrackingNumberNormalized: normalized },
          {
            prealert: {
              prealertCode: normalized,
              status: { not: 'CANCELLED' },
            },
          },
        ],
      },
      select: {
        internalTrackingNumber: true,
        status: true,
        registeredAt: true,
        prealert: { select: { prealertCode: true } },
        trackingEvents: {
          orderBy: { createdAt: 'asc' },
          select: {
            eventType: true,
            location: true,
            createdAt: true,
          },
        },
      },
    });

    if (pkg) {
      const referenceType =
        pkg.internalTrackingNumber === normalized
          ? 'INTERNAL_TRACKING'
          : pkg.prealert?.prealertCode === normalized
            ? 'PREALERT_CODE'
            : 'EXTERNAL_TRACKING';
      return {
        organization: {
          slug: organization.slug,
          name: organization.commercialName,
        },
        referenceType,
        internalTrackingNumber: pkg.internalTrackingNumber,
        status: pkg.status,
        timeline:
          pkg.trackingEvents.length > 0
            ? pkg.trackingEvents
            : [
                {
                  eventType: pkg.status,
                  location: null,
                  createdAt: pkg.registeredAt,
                },
              ],
      };
    }

    const prealert = await this.prisma.prealert.findFirst({
      where: {
        organizationId,
        prealertCode: normalized,
        status: 'PENDING_ARRIVAL',
      },
      select: { prealertCode: true, status: true, createdAt: true },
    });
    if (!prealert) throw new NotFoundException('Tracking not found');
    return {
      organization: {
        slug: organization.slug,
        name: organization.commercialName,
      },
      referenceType: 'PREALERT_CODE',
      internalTrackingNumber: null,
      status: prealert.status,
      timeline: [
        {
          eventType: prealert.status,
          location: null,
          createdAt: prealert.createdAt,
        },
      ],
    };
  }

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
      const packages = await tx.$queryRaw<LockedPackageRow[]>(Prisma.sql`
        SELECT id, status
        FROM packages
        WHERE organization_id = ${context.organizationId}
          AND id = ${packageId}
          AND deleted_at IS NULL
        FOR UPDATE
      `);
      const pkg = packages[0];

      if (!pkg) {
        throw new NotFoundException('Package not found');
      }
      if (!context.actorEmployeeId) {
        throw new BadRequestException('Employee actor is required');
      }

      assertTrackingEventMatchesPackageStatus(pkg.status, dto.eventType);

      const newEvent = await tx.packageTrackingEvent.create({
        data: {
          organizationId: context.organizationId,
          packageId,
          eventType: dto.eventType,
          location: dto.location,
          description: dto.description,
          createdById: context.actorEmployeeId,
        },
      });

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
          packageStatus: pkg.status,
        },
        emitOutbox: true,
      });

      return newEvent;
    });
  }
}
