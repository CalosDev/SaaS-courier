import { Injectable } from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { Prisma, type PackageReception } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  InvalidPackageStatusTransitionError,
  PackageNotFoundError,
} from './package.errors';
import {
  PackageReceptionConflictError,
  PackageReceptionFacilityUnavailableError,
} from './package-reception.errors';
import type {
  PackageReceptionRecord,
  ReceivePackageRecord,
} from './package-reception.types';
import { PackageReceptionsRepository } from './package-receptions.repository';

type ReceptionWithRelations = PackageReception & {
  facility: { id: string; code: string; name: string };
  receivedByEmployee: { id: string; firstName: string; lastName: string };
};

type LockedPackageRow = {
  id: string;
  status: 'RECEPTION_PENDING' | 'RECEIVED_AT_ORIGIN' | 'CANCELLED';
};

@Injectable()
export class PrismaPackageReceptionsRepository implements PackageReceptionsRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async receive(
    input: ReceivePackageRecord,
    context: CommandContext,
  ): Promise<PackageReceptionRecord> {
    const receptionId = await this.prismaService.$transaction(async (tx) => {
      const packageRecord = await this.lockPackage(
        tx,
        input.organizationId,
        input.packageId,
      );

      if (!packageRecord) {
        throw new PackageNotFoundError(input.packageId);
      }

      const existing = await this.findWithRelations(
        tx,
        input.organizationId,
        input.packageId,
      );

      if (existing) {
        if (!this.matches(existing, input)) {
          throw new PackageReceptionConflictError(
            'Package was already received with different measurements',
          );
        }

        return existing.id;
      }

      if (packageRecord.status !== 'RECEPTION_PENDING') {
        throw new InvalidPackageStatusTransitionError(
          `Package cannot be received from status ${packageRecord.status}`,
        );
      }

      const facility = await tx.facility.findFirst({
        where: {
          organizationId: input.organizationId,
          id: input.facilityId,
          isActive: true,
          isPackageOrigin: true,
          deletedAt: null,
          employeeFacilities: {
            some: {
              organizationId: input.organizationId,
              employeeId: input.receivedByEmployeeId,
            },
          },
        },
        select: { id: true },
      });

      if (!facility) {
        throw new PackageReceptionFacilityUnavailableError();
      }

      const settings = await tx.organizationSettings.findUnique({
        where: { organizationId: input.organizationId },
        select: { weightUnit: true, dimensionUnit: true },
      });

      const created = await tx.packageReception.create({
        data: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          facilityId: input.facilityId,
          receivedByEmployeeId: input.receivedByEmployeeId,
          weight: input.weight,
          weightUnit: settings?.weightUnit ?? 'LB',
          length: input.length,
          width: input.width,
          height: input.height,
          dimensionUnit: settings?.dimensionUnit ?? 'IN',
          pieceCount: input.pieceCount,
          condition: input.condition,
        },
      });

      const updated = await tx.package.updateMany({
        where: {
          organizationId: input.organizationId,
          id: input.packageId,
          status: 'RECEPTION_PENDING',
          deletedAt: null,
        },
        data: { status: 'RECEIVED_AT_ORIGIN' },
      });

      if (updated.count !== 1) {
        throw new InvalidPackageStatusTransitionError(
          'Package status changed during reception',
        );
      }

      const snapshot = this.snapshot(created);
      await this.auditWriter.write(tx, {
        context,
        action: 'package.received',
        entityType: 'PACKAGE',
        entityId: input.packageId,
        changedFields: ['status', 'reception'],
        beforeData: { status: 'RECEPTION_PENDING' },
        afterData: { status: 'RECEIVED_AT_ORIGIN', reception: snapshot },
        payload: { status: 'RECEIVED_AT_ORIGIN', reception: snapshot },
      });

      return created.id;
    });

    const reception = await this.findByPackageId(
      input.organizationId,
      input.packageId,
    );

    if (!reception || reception.id !== receptionId) {
      throw new PackageReceptionConflictError(
        'Package reception could not be loaded after creation',
      );
    }

    return reception;
  }

  async findByPackageId(
    organizationId: string,
    packageId: string,
  ): Promise<PackageReceptionRecord | null> {
    const row = await this.findWithRelations(
      this.prismaService,
      organizationId,
      packageId,
    );

    return row ? this.toRecord(row) : null;
  }

  private async lockPackage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageId: string,
  ): Promise<LockedPackageRow | null> {
    const rows = await tx.$queryRaw<LockedPackageRow[]>(Prisma.sql`
      SELECT id, status
      FROM packages
      WHERE organization_id = ${organizationId}
        AND id = ${packageId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private findWithRelations(
    client: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    packageId: string,
  ): Promise<ReceptionWithRelations | null> {
    return client.packageReception.findUnique({
      where: {
        organizationId_packageId: { organizationId, packageId },
      },
      include: {
        facility: { select: { id: true, code: true, name: true } },
        receivedByEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private matches(
    reception: ReceptionWithRelations,
    input: ReceivePackageRecord,
  ): boolean {
    return (
      reception.facilityId === input.facilityId &&
      reception.receivedByEmployeeId === input.receivedByEmployeeId &&
      reception.weight.toFixed(3) === input.weight &&
      reception.length.toFixed(2) === input.length &&
      reception.width.toFixed(2) === input.width &&
      reception.height.toFixed(2) === input.height &&
      reception.pieceCount === input.pieceCount &&
      reception.condition === input.condition
    );
  }

  private snapshot(reception: PackageReception): Record<string, unknown> {
    return {
      id: reception.id,
      packageId: reception.packageId,
      facilityId: reception.facilityId,
      receivedByEmployeeId: reception.receivedByEmployeeId,
      weight: reception.weight.toFixed(3),
      weightUnit: reception.weightUnit,
      length: reception.length.toFixed(2),
      width: reception.width.toFixed(2),
      height: reception.height.toFixed(2),
      dimensionUnit: reception.dimensionUnit,
      pieceCount: reception.pieceCount,
      condition: reception.condition,
      receivedAt: reception.receivedAt.toISOString(),
    };
  }

  private toRecord(reception: ReceptionWithRelations): PackageReceptionRecord {
    return {
      id: reception.id,
      organizationId: reception.organizationId,
      packageId: reception.packageId,
      facility: reception.facility,
      receivedBy: {
        id: reception.receivedByEmployee.id,
        displayName:
          `${reception.receivedByEmployee.firstName} ${reception.receivedByEmployee.lastName}`.trim(),
      },
      weight: reception.weight.toFixed(3),
      weightUnit: reception.weightUnit,
      length: reception.length.toFixed(2),
      width: reception.width.toFixed(2),
      height: reception.height.toFixed(2),
      dimensionUnit: reception.dimensionUnit,
      pieceCount: reception.pieceCount,
      condition: reception.condition,
      receivedAt: reception.receivedAt,
      createdAt: reception.createdAt,
    };
  }
}
