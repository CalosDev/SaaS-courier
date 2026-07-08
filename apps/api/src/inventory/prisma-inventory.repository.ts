import { Injectable } from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { FacilityNotFoundError } from '../facilities/facility.errors';
import {
  Prisma,
  type InventoryMovement,
  type Package,
  type PackageInventoryPosition,
  type WarehouseLocation,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import {
  InventoryMovementConflictError,
  WarehouseLocationCodeConflictError,
  WarehouseLocationNotFoundError,
  WarehouseLocationUnavailableError,
} from './inventory.errors';
import { InventoryRepository } from './inventory.repository';
import type {
  CreateWarehouseLocationRecord,
  InventoryMovementRecord,
  InventoryPackageListResult,
  InventoryPackageRecord,
  InventoryMovementType,
  ListInventoryPackagesRecord,
  ListWarehouseLocationsRecord,
  MoveInventoryPackageRecord,
  UpdateWarehouseLocationRecord,
  WarehouseLocationListResult,
  WarehouseLocationRecord,
} from './inventory.types';

type WarehouseLocationWithRelations = WarehouseLocation & {
  facility: {
    id: string;
    code: string;
    name: string;
  };
};

type InventoryPackageWithRelations = Package & {
  customer: {
    id: string;
    customerCode: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  };
  reception: {
    facility: {
      id: string;
      code: string;
      name: string;
    };
    receivedAt: Date;
  } | null;
  inventoryPosition:
    | (PackageInventoryPosition & {
        location: {
          id: string;
          code: string;
          name: string;
          type: string;
        };
      })
    | null;
};

type InventoryMovementWithRelations = InventoryMovement & {
  facility: {
    id: string;
    code: string;
    name: string;
  };
  fromLocation: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
  toLocation: {
    id: string;
    code: string;
    name: string;
    type: string;
  } | null;
  movedByEmployee: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type LockedInventoryPackageRow = {
  id: string;
  status: 'RECEPTION_PENDING' | 'RECEIVED_AT_ORIGIN' | 'CANCELLED';
  reception_facility_id: string | null;
};

type LockedInventoryPositionRow = {
  id: string;
  facility_id: string;
  location_id: string;
  location_type: string;
};

@Injectable()
export class PrismaInventoryRepository implements InventoryRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async listLocations(
    input: ListWarehouseLocationsRecord,
  ): Promise<WarehouseLocationListResult> {
    const where: Prisma.WarehouseLocationWhereInput = {
      organizationId: input.organizationId,
      ...(input.facilityId !== undefined
        ? { facilityId: input.facilityId }
        : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.q
        ? {
            OR: [
              { code: { contains: input.q, mode: 'insensitive' } },
              { name: { contains: input.q, mode: 'insensitive' } },
              {
                facility: { code: { contains: input.q, mode: 'insensitive' } },
              },
              {
                facility: { name: { contains: input.q, mode: 'insensitive' } },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, items] = await this.prismaService.$transaction(
      async (tx) => {
        const total = await tx.warehouseLocation.count({ where });
        const rows = await tx.warehouseLocation.findMany({
          where,
          include: this.locationInclude(),
          orderBy: [
            { facility: { code: 'asc' } },
            { code: 'asc' },
            { id: 'asc' },
          ],
          skip,
          take: input.pageSize,
        });

        return [total, rows] as const;
      },
    );

    return {
      items: items.map((item) => this.toWarehouseLocationRecord(item)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async createLocation(
    input: CreateWarehouseLocationRecord,
    context: CommandContext,
  ): Promise<WarehouseLocationRecord> {
    try {
      const created = await this.prismaService.$transaction(async (tx) => {
        const facility = await tx.facility.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.facilityId,
            deletedAt: null,
          },
          select: { id: true, isActive: true },
        });

        if (!facility) {
          throw new FacilityNotFoundError(input.facilityId);
        }

        if (!facility.isActive) {
          throw new WarehouseLocationUnavailableError(
            'Facility is not available for warehouse locations',
          );
        }

        const location = await tx.warehouseLocation.create({
          data: {
            organizationId: input.organizationId,
            facilityId: input.facilityId,
            code: input.code,
            name: input.name,
            type: input.type,
            description: input.description,
            isActive: input.isActive,
          },
          include: this.locationInclude(),
        });

        const snapshot = this.locationSnapshot(location);
        await this.auditWriter.write(tx, {
          context,
          action: 'inventory.location.created',
          entityType: 'WAREHOUSE_LOCATION',
          entityId: location.id,
          changedFields: Object.keys(snapshot),
          afterData: snapshot,
          payload: snapshot,
        });

        return location;
      });

      return this.toWarehouseLocationRecord(created);
    } catch (error) {
      if (
        error instanceof FacilityNotFoundError ||
        error instanceof WarehouseLocationUnavailableError
      ) {
        throw error;
      }

      if (this.isLocationCodeConflict(error)) {
        throw new WarehouseLocationCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async updateLocation(
    input: UpdateWarehouseLocationRecord,
    context: CommandContext,
  ): Promise<WarehouseLocationRecord | null> {
    try {
      const updatedId = await this.prismaService.$transaction(async (tx) => {
        const current = await tx.warehouseLocation.findFirst({
          where: {
            organizationId: input.organizationId,
            id: input.locationId,
          },
          include: this.locationInclude(),
        });

        if (!current) {
          return null;
        }

        const changedFields = this.locationChangedFields(current, input);

        if (changedFields.length === 0) {
          return current.id;
        }

        const updated = await tx.warehouseLocation.update({
          where: { id: current.id },
          data: {
            ...(input.code !== undefined ? { code: input.code } : {}),
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.type !== undefined ? { type: input.type } : {}),
            ...(input.description !== undefined
              ? { description: input.description }
              : {}),
            ...(input.isActive !== undefined
              ? { isActive: input.isActive }
              : {}),
          },
          include: this.locationInclude(),
        });

        await this.auditWriter.write(tx, {
          context,
          action: 'inventory.location.updated',
          entityType: 'WAREHOUSE_LOCATION',
          entityId: updated.id,
          changedFields,
          beforeData: this.locationSnapshot(current),
          afterData: this.locationSnapshot(updated),
          payload: {
            ...this.locationSnapshot(updated),
            changedFields,
          },
        });

        return updated.id;
      });

      if (!updatedId) {
        return null;
      }

      const updated = await this.prismaService.warehouseLocation.findFirst({
        where: {
          organizationId: input.organizationId,
          id: updatedId,
        },
        include: this.locationInclude(),
      });

      return updated ? this.toWarehouseLocationRecord(updated) : null;
    } catch (error) {
      if (this.isLocationCodeConflict(error) && input.code) {
        throw new WarehouseLocationCodeConflictError(input.code);
      }

      throw error;
    }
  }

  async listPackages(
    input: ListInventoryPackagesRecord,
  ): Promise<InventoryPackageListResult> {
    const where: Prisma.PackageWhereInput = {
      organizationId: input.organizationId,
      deletedAt: null,
      status: 'RECEIVED_AT_ORIGIN',
      reception: {
        is: {
          organizationId: input.organizationId,
          ...(input.facilityId !== undefined
            ? { facilityId: input.facilityId }
            : {}),
        },
      },
      ...(input.locationId !== undefined
        ? {
            inventoryPosition: {
              is: {
                organizationId: input.organizationId,
                locationId: input.locationId,
              },
            },
          }
        : {}),
      ...(input.q
        ? {
            OR: [
              {
                internalTrackingNumber: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                externalTrackingNumber: {
                  contains: input.q,
                  mode: 'insensitive',
                },
              },
              {
                customer: {
                  customerCode: { contains: input.q, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  firstName: { contains: input.q, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  lastName: { contains: input.q, mode: 'insensitive' },
                },
              },
              {
                customer: {
                  businessName: { contains: input.q, mode: 'insensitive' },
                },
              },
              {
                inventoryPosition: {
                  is: {
                    location: {
                      code: { contains: input.q, mode: 'insensitive' },
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, rows] = await this.prismaService.$transaction(
      async (tx) => {
        const total = await tx.package.count({ where });
        const items = await tx.package.findMany({
          where,
          include: this.inventoryPackageInclude(),
          orderBy: [{ registeredAt: 'desc' }, { id: 'desc' }],
          skip,
          take: input.pageSize,
        });

        return [total, items] as const;
      },
    );

    return {
      items: rows.map((row) => this.toInventoryPackageRecord(row)),
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages:
          totalItems === 0 ? 0 : Math.ceil(totalItems / input.pageSize),
      },
    };
  }

  async movePackage(
    input: MoveInventoryPackageRecord,
    context: CommandContext,
  ): Promise<InventoryPackageRecord | null> {
    const packageId = await this.prismaService.$transaction(async (tx) => {
      const packageRow = await this.lockPackageForMovement(
        tx,
        input.organizationId,
        input.packageId,
      );

      if (!packageRow) {
        return null;
      }

      if (
        packageRow.status !== 'RECEIVED_AT_ORIGIN' ||
        packageRow.reception_facility_id === null
      ) {
        throw new InventoryMovementConflictError(
          'Only received packages can be placed or moved in inventory',
        );
      }

      const currentPosition = await this.lockCurrentPosition(
        tx,
        input.organizationId,
        input.packageId,
      );

      const targetLocation =
        input.toLocationId === null
          ? null
          : await tx.warehouseLocation.findFirst({
              where: {
                organizationId: input.organizationId,
                id: input.toLocationId,
              },
              include: this.locationInclude(),
            });

      if (input.toLocationId !== null && !targetLocation) {
        throw new WarehouseLocationNotFoundError(input.toLocationId);
      }

      if (targetLocation && !targetLocation.isActive) {
        throw new WarehouseLocationUnavailableError(
          'Target warehouse location is inactive',
        );
      }

      if (
        targetLocation &&
        targetLocation.facility.id !== packageRow.reception_facility_id
      ) {
        throw new InventoryMovementConflictError(
          'Inventory movements across facilities are out of scope',
        );
      }

      if (
        currentPosition &&
        currentPosition.facility_id !== packageRow.reception_facility_id
      ) {
        throw new InventoryMovementConflictError(
          'Current inventory position is inconsistent with package reception facility',
        );
      }

      const isNoop =
        input.toLocationId === null
          ? currentPosition === null
          : currentPosition?.location_id === input.toLocationId;

      if (isNoop) {
        return input.packageId;
      }

      this.assertMovementAllowed(
        input.movementType,
        currentPosition,
        targetLocation,
      );

      const occurredAt = new Date();
      const movement = await tx.inventoryMovement.create({
        data: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          facilityId: packageRow.reception_facility_id,
          fromLocationId: currentPosition?.location_id ?? null,
          toLocationId: targetLocation?.id ?? null,
          movedByEmployeeId: input.movedByEmployeeId,
          movementType: input.movementType,
          note: input.note,
          occurredAt,
        },
        include: this.inventoryMovementInclude(),
      });

      if (targetLocation) {
        if (currentPosition) {
          await tx.packageInventoryPosition.update({
            where: { id: currentPosition.id },
            data: {
              facilityId: targetLocation.facility.id,
              locationId: targetLocation.id,
              placedAt: occurredAt,
            },
          });
        } else {
          await tx.packageInventoryPosition.create({
            data: {
              organizationId: input.organizationId,
              packageId: input.packageId,
              facilityId: targetLocation.facility.id,
              locationId: targetLocation.id,
              placedAt: occurredAt,
            },
          });
        }
      } else if (currentPosition) {
        await tx.packageInventoryPosition.delete({
          where: { id: currentPosition.id },
        });
      }

      const beforeLocationId = currentPosition?.location_id ?? null;
      const afterLocationId = targetLocation?.id ?? null;

      await this.auditWriter.write(tx, {
        context,
        action: 'inventory.package.moved',
        entityType: 'INVENTORY_MOVEMENT',
        entityId: movement.id,
        changedFields: ['movementType', 'currentLocationId'],
        beforeData: { currentLocationId: beforeLocationId },
        afterData: {
          currentLocationId: afterLocationId,
          movementType: movement.movementType,
        },
        payload: this.inventoryMovementSnapshot(movement),
      });

      return input.packageId;
    });

    if (!packageId) {
      return null;
    }

    const moved = await this.findInventoryPackageById(
      this.prismaService,
      input.organizationId,
      packageId,
    );

    if (!moved) {
      throw new InventoryMovementConflictError(
        'Inventory package could not be reloaded after movement',
      );
    }

    return this.toInventoryPackageRecord(moved);
  }

  async listPackageMovements(
    organizationId: string,
    packageId: string,
  ): Promise<InventoryMovementRecord[]> {
    const rows = await this.prismaService.inventoryMovement.findMany({
      where: {
        organizationId,
        packageId,
      },
      include: this.inventoryMovementInclude(),
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row) => this.toInventoryMovementRecord(row));
  }

  private locationInclude() {
    return {
      facility: {
        select: { id: true, code: true, name: true },
      },
    } satisfies Prisma.WarehouseLocationInclude;
  }

  private inventoryPackageInclude() {
    return {
      customer: {
        select: {
          id: true,
          customerCode: true,
          firstName: true,
          lastName: true,
          businessName: true,
        },
      },
      reception: {
        select: {
          receivedAt: true,
          facility: {
            select: { id: true, code: true, name: true },
          },
        },
      },
      inventoryPosition: {
        include: {
          location: {
            select: { id: true, code: true, name: true, type: true },
          },
        },
      },
    } satisfies Prisma.PackageInclude;
  }

  private inventoryMovementInclude() {
    return {
      facility: {
        select: { id: true, code: true, name: true },
      },
      fromLocation: {
        select: { id: true, code: true, name: true, type: true },
      },
      toLocation: {
        select: { id: true, code: true, name: true, type: true },
      },
      movedByEmployee: {
        select: { id: true, firstName: true, lastName: true },
      },
    } satisfies Prisma.InventoryMovementInclude;
  }

  private async findInventoryPackageById(
    client: Prisma.TransactionClient | PrismaService,
    organizationId: string,
    packageId: string,
  ): Promise<InventoryPackageWithRelations | null> {
    return client.package.findFirst({
      where: {
        organizationId,
        id: packageId,
        deletedAt: null,
        status: 'RECEIVED_AT_ORIGIN',
      },
      include: this.inventoryPackageInclude(),
    });
  }

  private async lockPackageForMovement(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageId: string,
  ): Promise<LockedInventoryPackageRow | null> {
    const rows = await tx.$queryRaw<LockedInventoryPackageRow[]>(Prisma.sql`
      SELECT
        p.id,
        p.status,
        pr.facility_id AS reception_facility_id
      FROM packages p
      LEFT JOIN package_receptions pr
        ON pr.organization_id = p.organization_id
       AND pr.package_id = p.id
      WHERE p.organization_id = ${organizationId}
        AND p.id = ${packageId}
        AND p.deleted_at IS NULL
      FOR UPDATE OF p
    `);

    return rows[0] ?? null;
  }

  private async lockCurrentPosition(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageId: string,
  ): Promise<LockedInventoryPositionRow | null> {
    const rows = await tx.$queryRaw<LockedInventoryPositionRow[]>(Prisma.sql`
      SELECT
        pip.id,
        pip.facility_id,
        pip.location_id,
        wl.type AS location_type
      FROM package_inventory_positions pip
      INNER JOIN warehouse_locations wl
        ON wl.organization_id = pip.organization_id
       AND wl.id = pip.location_id
      WHERE pip.organization_id = ${organizationId}
        AND pip.package_id = ${packageId}
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private assertMovementAllowed(
    movementType: InventoryMovementType,
    currentPosition: LockedInventoryPositionRow | null,
    targetLocation: WarehouseLocationWithRelations | null,
  ): void {
    switch (movementType) {
      case 'PUTAWAY':
        if (currentPosition) {
          throw new InventoryMovementConflictError(
            'Package is already positioned in inventory',
          );
        }

        if (!targetLocation || targetLocation.type === 'HOLD') {
          throw new InventoryMovementConflictError(
            'Putaway requires an active non-hold location',
          );
        }
        return;
      case 'MOVE':
        if (!currentPosition || !targetLocation) {
          throw new InventoryMovementConflictError(
            'Move requires a current position and a target location',
          );
        }

        if (currentPosition.location_type === 'HOLD') {
          throw new InventoryMovementConflictError(
            'Use RELEASE to exit a hold location',
          );
        }

        if (targetLocation.type === 'HOLD') {
          throw new InventoryMovementConflictError(
            'Use HOLD to place a package in a hold location',
          );
        }
        return;
      case 'HOLD':
        if (!targetLocation || targetLocation.type !== 'HOLD') {
          throw new InventoryMovementConflictError(
            'Hold requires a target hold location',
          );
        }
        return;
      case 'RELEASE':
        if (!currentPosition || !targetLocation) {
          throw new InventoryMovementConflictError(
            'Release requires a current hold position and a target location',
          );
        }

        if (currentPosition.location_type !== 'HOLD') {
          throw new InventoryMovementConflictError(
            'Only packages in hold can be released',
          );
        }

        if (targetLocation.type === 'HOLD') {
          throw new InventoryMovementConflictError(
            'Release requires a non-hold target location',
          );
        }
        return;
      case 'REMOVE':
        if (!currentPosition) {
          throw new InventoryMovementConflictError(
            'Package is not currently positioned in inventory',
          );
        }
        return;
    }
  }

  private toWarehouseLocationRecord(
    row: WarehouseLocationWithRelations,
  ): WarehouseLocationRecord {
    return {
      id: row.id,
      organizationId: row.organizationId,
      facility: row.facility,
      code: row.code,
      name: row.name,
      type: row.type,
      description: row.description,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private toInventoryPackageRecord(
    row: InventoryPackageWithRelations,
  ): InventoryPackageRecord {
    if (!row.reception) {
      throw new InventoryMovementConflictError(
        'Package inventory record is missing a reception record',
      );
    }

    return {
      id: row.id,
      internalTrackingNumber: row.internalTrackingNumber,
      externalTrackingNumber: row.externalTrackingNumber,
      status: row.status,
      customer: {
        id: row.customer.id,
        customerCode: row.customer.customerCode,
        displayName: this.customerDisplayName(row.customer),
      },
      reception: {
        facility: row.reception.facility,
        receivedAt: row.reception.receivedAt,
      },
      currentPosition: row.inventoryPosition
        ? {
            location: {
              id: row.inventoryPosition.location.id,
              code: row.inventoryPosition.location.code,
              name: row.inventoryPosition.location.name,
              type: row.inventoryPosition.location
                .type as InventoryPackageRecord['currentPosition'] extends null
                ? never
                : NonNullable<
                    InventoryPackageRecord['currentPosition']
                  >['location']['type'],
            },
            placedAt: row.inventoryPosition.placedAt,
            updatedAt: row.inventoryPosition.updatedAt,
          }
        : null,
    };
  }

  private toInventoryMovementRecord(
    row: InventoryMovementWithRelations,
  ): InventoryMovementRecord {
    return {
      id: row.id,
      packageId: row.packageId,
      facility: row.facility,
      movementType: row.movementType,
      fromLocation: row.fromLocation
        ? {
            id: row.fromLocation.id,
            code: row.fromLocation.code,
            name: row.fromLocation.name,
            type: row.fromLocation.type as NonNullable<
              InventoryMovementRecord['fromLocation']
            >['type'],
          }
        : null,
      toLocation: row.toLocation
        ? {
            id: row.toLocation.id,
            code: row.toLocation.code,
            name: row.toLocation.name,
            type: row.toLocation.type as NonNullable<
              InventoryMovementRecord['toLocation']
            >['type'],
          }
        : null,
      movedBy: {
        id: row.movedByEmployee.id,
        displayName:
          `${row.movedByEmployee.firstName} ${row.movedByEmployee.lastName}`.trim(),
      },
      note: row.note,
      occurredAt: row.occurredAt,
      createdAt: row.createdAt,
    };
  }

  private locationSnapshot(row: WarehouseLocationWithRelations) {
    return {
      facilityId: row.facilityId,
      code: row.code,
      name: row.name,
      type: row.type,
      isActive: row.isActive,
    };
  }

  private locationChangedFields(
    current: WarehouseLocationWithRelations,
    input: UpdateWarehouseLocationRecord,
  ): string[] {
    const changed: string[] = [];

    if (input.code !== undefined && input.code !== current.code) {
      changed.push('code');
    }

    if (input.name !== undefined && input.name !== current.name) {
      changed.push('name');
    }

    if (input.type !== undefined && input.type !== current.type) {
      changed.push('type');
    }

    if (
      input.description !== undefined &&
      input.description !== current.description
    ) {
      changed.push('description');
    }

    if (input.isActive !== undefined && input.isActive !== current.isActive) {
      changed.push('isActive');
    }

    return changed;
  }

  private inventoryMovementSnapshot(row: InventoryMovementWithRelations) {
    return {
      packageId: row.packageId,
      facilityId: row.facilityId,
      movementType: row.movementType,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      note: row.note,
      occurredAt: row.occurredAt.toISOString(),
    };
  }

  private customerDisplayName(customer: {
    customerCode: string;
    firstName: string | null;
    lastName: string | null;
    businessName: string | null;
  }): string {
    if (customer.businessName) {
      return customer.businessName;
    }

    const fullName = [customer.firstName, customer.lastName]
      .filter(
        (value): value is string =>
          typeof value === 'string' && value.trim().length > 0,
      )
      .join(' ')
      .trim();

    return fullName || customer.customerCode;
  }

  private isLocationCodeConflict(error: unknown): boolean {
    return this.hasKnownTarget(
      error,
      'warehouse_locations_org_facility_code_key',
      'facilityId',
      'code',
      'facility_id',
    );
  }

  private hasKnownTarget(
    error: unknown,
    targetName: string,
    ...candidateFragments: string[]
  ): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';
    const driverAdapterCause = this.readDriverAdapterCause(error.meta);
    const constraintFields = Array.isArray(
      driverAdapterCause?.constraint?.fields,
    )
      ? driverAdapterCause.constraint.fields.join(',')
      : '';
    const originalMessage =
      typeof driverAdapterCause?.originalMessage === 'string'
        ? driverAdapterCause.originalMessage
        : '';
    const haystack = [targetText, constraintFields, originalMessage]
      .filter((value) => value.length > 0)
      .join(',');

    return (
      haystack.includes(targetName) ||
      candidateFragments.some((fragment) => haystack.includes(fragment))
    );
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
  }

  private readDriverAdapterCause(
    meta: Prisma.PrismaClientKnownRequestError['meta'],
  ):
    | {
        constraint?: {
          fields?: unknown;
        };
        originalMessage?: unknown;
      }
    | undefined {
    if (!meta || typeof meta !== 'object' || !('driverAdapterError' in meta)) {
      return undefined;
    }

    const driverAdapterError = meta.driverAdapterError;

    if (
      !driverAdapterError ||
      typeof driverAdapterError !== 'object' ||
      !('cause' in driverAdapterError)
    ) {
      return undefined;
    }

    const cause = driverAdapterError.cause;

    return cause && typeof cause === 'object' ? cause : undefined;
  }
}
